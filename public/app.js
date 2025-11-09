/* app.js — Handles login, signup, quiz, offers, and reward claim */

const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

const $ = (sel) => document.querySelector(sel);
const filename = () => location.pathname.split("/").pop() || "index.html";

const isIndex = () => filename() === "index.html" || filename() === "";
const isSignup = () => filename() === "signup.html";
const isSelectPet = () => filename() === "select-pet.html";
const isQuiz = () => filename() === "quiz.html";
const isOffers = () => filename() === "offers.html";
const isClaim = () => filename() === "claim.html";

/* -------- LOGIN PAGE -------- */
function initLogin() {
  const email = $("#loginEmail");
  const pass = $("#loginPassword");
  const btn = $("#loginBtn");
  const errorBox = $("#loginError");

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await auth.signInWithEmailAndPassword(email.value.trim(), pass.value.trim());
      window.location.href = "select-pet.html";
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

/* -------- SIGNUP PAGE -------- */
function initSignup() {
  const name = $("#signupName");
  const email = $("#signupEmail");
  const pass = $("#signupPassword");
  const btn = $("#signupBtn");
  const errorBox = $("#signupError");

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const cred = await auth.createUserWithEmailAndPassword(email.value.trim(), pass.value.trim());
      await db.collection("users").doc(cred.user.uid).set({
        name: name.value.trim(),
        email: email.value.trim(),
        coins: 0,
        createdAt: new Date()
      });
      window.location.href = "select-pet.html";
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

/* -------- SELECT PET PAGE -------- */
function initSelectPet() {
  auth.onAuthStateChanged((user) => {
    if (!user) return (window.location.href = "index.html");

    const pets = ["Dog", "Cat", "Bird", "Rabbit", "Fish", "Horse", "Ferret", "Reptile"];
    const grid = $("#petGrid");
    grid.innerHTML = "";

    pets.forEach((p) => {
      const card = document.createElement("div");
      card.className = "petCard";
      card.innerHTML = `<div class='emoji'>${p === "Dog" ? "🐶" : p === "Cat" ? "🐱" : "🐾"}</div><div>${p}</div>`;
      card.onclick = async () => {
        await db.collection("users").doc(user.uid).set({ selectedPet: p }, { merge: true });
        window.location.href = "quiz.html";
      };
      grid.appendChild(card);
    });
  });
}

/* -------- QUIZ PAGE -------- */
function initQuiz() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) return (window.location.href = "index.html");

    const doc = await db.collection("users").doc(user.uid).get();
    const pet = (doc.data() && doc.data().selectedPet) || "Dog";

    const questions = {
      Dog: ["What size is your dog?", "Is your dog active?", "Does your dog love toys?", "Indoor or outdoor?", "Would you try a pet gadget?"],
      Cat: ["Indoor or outdoor?", "Age group?", "Does your cat climb?", "Food type?", "Use toys?"],
    }[pet] || ["Do you love pets?", "Have a pet now?", "Would adopt again?", "Buy accessories?", "Recommend pet tech?"];

    const box = $("#questionBox");
    const progress = $("#quizProgress");
    let i = 0;

    function render() {
      box.innerHTML = `<div class='card'><h3>${questions[i]}</h3></div>`;
      ["Yes", "No", "Maybe"].forEach((opt) => {
        const btn = document.createElement("button");
        btn.textContent = opt;
        btn.onclick = () => {
          i++;
          if (i < questions.length) render();
          else finish();
        };
        box.appendChild(btn);
      });
      progress.textContent = `Question ${i + 1} of ${questions.length}`;
    }

    async function finish() {
      await db.collection("users").doc(user.uid).set({ quizDone: true }, { merge: true });
      window.location.href = "offers.html";
    }

    render();
  });
}

/* -------- OFFERS PAGE -------- */
function initOffers() {
  auth.onAuthStateChanged((user) => {
    if (!user) return (window.location.href = "index.html");

    $("#userEmail").textContent = user.email;
    db.collection("users").doc(user.uid).onSnapshot((doc) => {
      $("#coinCount").textContent = (doc.data() && doc.data().coins) || 0;
    });

    const interval = setInterval(() => {
      const links = document.querySelectorAll("#offerContainer a");
      if (links.length > 0) {
        clearInterval(interval);
        links.forEach((a) => {
          a.href += `&sub1=${user.uid}`;
          a.target = "_blank";
        });
      }
    }, 300);
  });
}

/* -------- CLAIM PAGE -------- */
function initClaim() {
  const btn = $("#claimSubmitPage");
  btn.addEventListener("click", async () => {
    const name = $("#claimNamePage").value.trim();
    const address = $("#claimAddressPage").value.trim();
    const email = $("#claimEmailPage").value.trim();

    const user = auth.currentUser;
    if (!user) return alert("Login required");

    const payload = { userUid: user.uid, userEmail: email, name, address, claimedAt: new Date().toISOString() };
    await fetch(SHEETS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    alert("Reward claim submitted!");
  });
}

/* -------- ROUTER -------- */
document.addEventListener("DOMContentLoaded", () => {
  if (isIndex()) initLogin();
  else if (isSignup()) initSignup();
  else if (isSelectPet()) initSelectPet();
  else if (isQuiz()) initQuiz();
  else if (isOffers()) initOffers();
  else if (isClaim()) initClaim();
});
