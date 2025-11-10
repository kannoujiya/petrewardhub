// ------------------ app.js ------------------

// Shortcut
const $ = (s, r = document) => r.querySelector(s);

// ----------- Safe page logic -----------
const PAGE = location.pathname.split("/").pop(); // current file name
const PROTECTED_PAGES = ["select-pet.html", "quiz.html", "offers.html", "claim.html", "profile.html"];

// ---------- Real-time coins in header ----------
window.attachCoinListener = function (emailEl, coinEl, logoutBtn) {
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      // User not logged in
      if (emailEl) emailEl.textContent = "Not signed in";
      if (coinEl) coinEl.textContent = "0";

      // Redirect only on protected pages (not on index.html!)
      if (PROTECTED_PAGES.includes(PAGE)) {
        location.replace("index.html");
      }
      return;
    }

    // User is logged in
    if (emailEl) emailEl.textContent = "Signed in as " + (user.email || "user");
    if (logoutBtn) {
      logoutBtn.style.display = "inline-block";
      logoutBtn.onclick = async () => {
        await auth.signOut();
        location.replace("index.html");
      };
    }

    // Real-time coin updates
    db.collection("users")
      .doc(user.uid)
      .onSnapshot((s) => {
        const coins = (s.data() && s.data().coins) || 0;
        if (coinEl) coinEl.textContent = coins;
      });
  });
};

// ---------- Login handler ----------
(function () {
  const loginBtn = $("#loginBtn");
  if (!loginBtn) return;

  loginBtn.addEventListener("click", async () => {
    const email = $("#loginEmail")?.value.trim();
    const pass = $("#loginPass")?.value.trim();
    const msg = $("#loginMsg");
    if (!email || !pass) {
      if (msg) msg.textContent = "Please enter email & password";
      return;
    }

    try {
      // Disable button
      loginBtn.disabled = true;
      loginBtn.textContent = "Logging in...";

      // Sign in
      await auth.signInWithEmailAndPassword(email, pass);

      // Wait for Firebase to confirm
      await new Promise((res) => {
        const unsub = auth.onAuthStateChanged((u) => {
          if (u) {
            unsub();
            res();
          }
        });
      });

      // Close modal if present
      const overlay = $("#loginOverlay");
      if (overlay) overlay.style.display = "none";

      // ✅ Redirect directly to select-pet.html
      location.href = "select-pet.html";
    } catch (e) {
      if (msg) msg.textContent = e.message || "Login failed";
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Login";
    }
  });
})();

// ---------- Avoid auto redirect after login ----------
if (PAGE === "index.html") {
  // Remove any auth redirect logic on homepage entirely
  firebase.auth().onAuthStateChanged(() => {
    // Do nothing — let user stay logged in peacefully
  });
}
