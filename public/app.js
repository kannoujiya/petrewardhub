/* app.js — PetRewardHub
   Full working version with permanent logs, Firebase Auth + Firestore
   Make sure firebase-init.js loads before this file.
*/

const SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const filename = () => location.pathname.split("/").pop() || "index.html";
const page = filename();

const isIndex = page === "index.html" || page === "";
const isSignup = page === "signup.html";
const isSelectPet = page === "select-pet.html";
const isQuiz = page === "quiz.html";
const isOffers = page === "offers.html";
const isClaim = page === "claim.html";

/* ---------- LOGIN PAGE ---------- */
function initLogin() {
  const email = $("#loginEmail");
  const pass = $("#loginPassword");
  const btn = $("#loginBtn");
  const errorBox = $("#loginError");
  const infoBox = document.createElement("div");
  infoBox.style.fontSize = "12px";
  infoBox.style.marginTop = "8px";
  infoBox.style.color = "#666";
  btn.parentNode.appendChild(infoBox);

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const mail = email.value.trim();
    const pwd = pass.value.trim();
    if (!mail || !pwd) {
      errorBox.textContent = "⚠️ Please fill all fields.";
      return;
    }
    infoBox.textContent = "⏳ Connecting to Firebase...";
    console.log("Login attempt for:", mail);
    try {
      await auth.signInWithEmailAndPassword(mail, pwd);
      infoBox.textContent = "✅ Login successful! Redirecting...";
      console.log("✅ Login success");
      window.location.href = "select-pet.html";
    } catch (err) {
      console.error("❌ Login error:", err);
      infoBox.textContent = "❌ " + (err.message || "Unknown error");
      errorBox.textContent = err.message;
    }
  });
}

/* ---------- SIGNUP PAGE ---------- */
function initSignup() {
  const name = $("#signupName");
  const email = $("#signupEmail");
  const pass = $("#signupPassword");
  const btn = $("#signupBtn");
  const errorBox = $("#signupError");
  const infoBox = document.createElement("div");
  infoBox.style.fontSize = "12px";
  infoBox.style.marginTop = "8px";
  infoBox.style.color = "#666";
  btn.parentNode.appendChild(infoBox);

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const nm = name.value.trim();
    const mail = email.value.trim();
    const pwd = pass.value.trim();
    if (!nm || !mail || !pwd) {
      errorBox.textContent = "⚠️ Please fill all fields.";
      return;
    }
    infoBox.textContent = "⏳ Creating account...";
    console.log("Signup attempt:", mail);
    try {
      const cred = await auth.createUserWithEmailAndPassword(mail, pwd);
      const user = cred.user;
      await db.collection("users").doc(user.uid).set({
        name: nm,
        email: mail,
        coins: 0,
        createdAt: new Date(),
      });
      infoBox.textContent = "✅ Account created! Redirecting...";
      console.log("✅ Signup success");
      window.location.href = "select-pet.html";
    } catch (err) {
      console.error("❌ Signup error:", err);
      infoBox.textContent = "❌ " + (err.message || "Error");
      errorBox.textContent = err.message;
    }
  });
}

/* ---------- SELECT PET PAGE ---------- */
function initSelectPet() {
  auth.onAuthStateChanged((user) => {
    if (!user) return (window.location.href = "index.html");
    const grid = $("#petGrid");
    grid.innerHTML = "";
    const pets = [
      { name: "Dog", emoji: "🐶" },
      { name: "Cat", emoji: "🐱" },
      { name: "Bird", emoji: "🐦" },
      { name: "Rabbit", emoji: "🐰" },
      { name: "Fish", emoji: "🐟" },
      { name: "Horse", emoji: "🐴" },
      { name: "Reptile", emoji: "🦎" },
      { name: "Ferret", emoji: "🦦" },
    ];

    pets.forEach((p) => {
      const card = document.createElement("div");
      card.className = "petCard";
      card.innerHTML = `<div class='emoji'>${p.emoji}</div><div>${p.name}</div>`;
      card.onclick = async () => {
        await db.collection("users").doc(user.uid).set(
          {
            selectedPet: p.name,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        console.log("Pet selected:", p.name);
        window.location.href = "quiz.html";
      };
      grid.appendChild(card);
    });
  });
}

/* ---------- QUIZ PAGE ---------- */
function initQuiz() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) return (window.location.href = "index.html");
    const doc = await db.collection("users").doc(user.uid).get();
    const pet = (doc.data() && doc.data().selectedPet) || "Dog";
    console.log("Loaded quiz for:", pet);

    const questionSets = {
      Dog: [
        "What size is your dog?",
        "Is your dog active?",
        "Does your dog love toys?",
        "Indoor or outdoor?",
        "Would you try a pet gadget?",
      ],
      Cat: [
        "Indoor or outdoor?",
        "Age group?",
        "Does your cat climb?",
        "Food type?",
        "Use toys?",
      ],
    };
    const qs = questionSets[pet] || [
      "Do you love pets?",
      "Own one now?",
      "Would adopt again?",
      "Buy accessories?",
      "Recommend pet tech?",
    ];

    let i = 0;
    const box = $("#questionBox");
    const progress = $("#quizProgress");

    function render() {
      box.innerHTML = `<div class='card'><h3>${qs[i]}</h3></div>`;
      ["Yes", "No", "Maybe"].forEach((opt) => {
        const b = document.createElement("button");
        b.className = "button";
        b.textContent = opt;
        b.onclick = () => {
          i++;
          if (i < qs.length) render();
          else finish();
        };
        box.appendChild(b);
      });
      progress.textContent = `Question ${i + 1}/${qs.length}`;
    }

    async function finish() {
      await db.collection("users").doc(user.uid).set({ quizDone: true }, { merge: true });
      console.log("Quiz completed");
      window.location.href = "offers.html";
    }

    render();
  });
}

/* ---------- OFFERS PAGE ---------- */
function initOffers() {
  auth.onAuthStateChanged((user) => {
    if (!user) return (window.location.href = "index.html");
    $("#userEmail").textContent = user.email;
    db.collection("users").doc(user.uid).onSnapshot((doc) => {
      const coins = (doc.data() && doc.data().coins) || 0;
      $("#coinCount").textContent = coins;
    });

    // attach sub1 UID to all offers
    const interval = setInterval(() => {
      const links = document.querySelectorAll("#offerContainer a");
      if (links.length > 0) {
        clearInterval(interval);
        links.forEach((a) => {
          a.href += `&sub1=${user.uid}`;
          a.target = "_blank";
        });
        console.log("Offers linked with userID:", user.uid);
      }
    }, 300);
  });
}

/* ---------- CLAIM PAGE ---------- */
function initClaim() {
  const btn = $("#claimSubmitPage");
  btn.addEventListener("click", async () => {
    const name = $("#claimNamePage").value.trim();
    const address = $("#claimAddressPage").value.trim();
    const email = $("#claimEmailPage").value.trim();
    const user = auth.currentUser;
    if (!user) return alert("Please login first.");

    const payload = {
      userUid: user.uid,
      userEmail: email,
      name,
      address,
      claimedAt: new Date().toISOString(),
    };
    try {
      await fetch(SHEETS_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      alert("✅ Reward claim submitted!");
      console.log("Claim submitted:", payload);
    } catch (err) {
      console.error("❌ Claim error:", err);
      alert("Error submitting claim.");
    }
  });
}

/* ---------- ROUTER ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (isIndex) initLogin();
  else if (isSignup) initSignup();
  else if (isSelectPet) initSelectPet();
  else if (isQuiz) initQuiz();
  else if (isOffers) initOffers();
  else if (isClaim) initClaim();
});
