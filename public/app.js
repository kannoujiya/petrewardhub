// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Which page
const PAGE = location.pathname.split("/").pop().toLowerCase();
const PROTECTED = ["select-pet.html", "quiz.html", "offers.html", "claim.html", "profile.html", "gifts.html"];

// ---------- Firebase helpers (auth/db are global from firebase-init.js) ----------
/** Show user email + realtime coins everywhere */
window.attachHeaderAuth = function attachHeaderAuth() {
  const emailEl = $("#userEmail");
  const coinEl  = $("#coinBadge");
  const logout  = $("#logoutBtn");

  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      if (emailEl) emailEl.textContent = "Not signed in";
      if (coinEl) coinEl.textContent = "0";
      if (logout) logout.style.display = "none";
      if (PROTECTED.includes(PAGE)) location.replace("index.html");
      return;
    }
    if (emailEl) emailEl.textContent = "Signed in as " + (user.email || "user");

    if (logout) {
      logout.style.display = "inline-block";
      logout.onclick = async () => { await auth.signOut(); location.replace("index.html"); };
    }
    db.collection("users").doc(user.uid).onSnapshot(snap => {
      const coins = (snap.data() && snap.data().coins) || 0;
      if (coinEl) coinEl.textContent = coins;
    });
  });
};

/** Require auth for claim-like actions: if not logged, open login modal if available */
window.requireAuthForAction = function(cbIfAuthed) {
  const overlay = $("#loginOverlay");
  firebase.auth().onAuthStateChanged(user => {
    if (user) cbIfAuthed(user);
    else {
      if (overlay) {
        overlay.style.display = "flex";
        document.body.style.overflow = "hidden";
      } else {
        location.href = "index.html"; // fallback
      }
    }
  });
};

// ---------- Login modal (if present) ----------
(function bindLoginModal() {
  document.addEventListener("DOMContentLoaded", () => {
    const overlay = $("#loginOverlay");
    const openBtn = $("#openLoginBtn");
    const closeBtn = $("#loginClose");
    const loginBtn = $("#loginBtn");
    const emailIn  = $("#loginEmail");
    const passIn   = $("#loginPass");
    const msg      = $("#loginMsg");

    if (openBtn && overlay) {
      openBtn.addEventListener("click", () => {
        overlay.style.display = "flex";
        setTimeout(() => $(".modal")?.classList.add("open"), 0);
        document.body.style.overflow = "hidden";
      });
    }
    if (closeBtn && overlay) {
      const close = () => {
        $(".modal")?.classList.remove("open");
        setTimeout(() => { overlay.style.display = "none"; document.body.style.overflow = ""; }, 120);
      };
      closeBtn.addEventListener("click", close);
      overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && overlay.style.display === "flex") close(); });
    }
    if (loginBtn) {
      loginBtn.addEventListener("click", async () => {
        try {
          msg.textContent = "";
          const email = (emailIn?.value || "").trim();
          const pass  = (passIn?.value || "").trim();
          if (!email || !pass) { msg.textContent = "Please enter email & password"; return; }
          loginBtn.disabled = true; loginBtn.textContent = "Logging in...";
          await auth.signInWithEmailAndPassword(email, pass);
          await new Promise(res => { const u = auth.onAuthStateChanged(x => { if (x) { u(); res(); } }); });
          $(".modal")?.classList.remove("open");
          setTimeout(() => { $("#loginOverlay").style.display = "none"; document.body.style.overflow = ""; }, 120);
          // Route to select-pet on homepage; else stay
          if (PAGE === "index.html") location.href = "select-pet.html";
        } catch (e) {
          msg.textContent = e.message || "Login failed";
        } finally {
          loginBtn.disabled = false; loginBtn.textContent = "Login";
        }
      });
    }
  });
})();

// ---------- Offers JSONP loader (used by offers.html) ----------
window.loadAdBlueOffers = function({ containerSel, uid, country, limit = 9 }) {
  const $container = $(containerSel);
  if (!$container) return;
  $container.innerHTML = "<p>⏳ Fetching offers...</p>";

  const src = "https://d1y3y09sav47f5.cloudfront.net/public/offers/feed.php"
    + `?user_id=481160&api_key=89a09f95e53dde3a5e593491e1134540`
    + `&s1=${encodeURIComponent(uid || "")}`
    + `&s2=${encodeURIComponent(country || "")}`
    + `&callback=?`;

  // Use jQuery JSONP (guaranteed)
  // Note: jQuery v1.12.4 should be loaded on offers.html
  if (!window.jQuery) { $container.innerHTML = "<p>⚠️ jQuery missing.</p>"; return; }
  window.jQuery.getJSON(src, function(offers){
    if (!offers || !offers.length) {
      $container.innerHTML = "<p>⚠️ No offers available for this region.</p>";
      return;
    }
    const items = offers.slice(0, limit);
    const html = items.map(offer => {
      const title = offer.name || offer.anchor || "Special Offer";
      const desc  = offer.conversion || "Complete this task to earn rewards!";
      const img   = offer.network_icon || "https://placekitten.com/300/200";
      const payout= parseFloat(offer.payout || 0);
      const url   = (offer.url || offer.tracking_url || "#") + "&sub1=" + (uid || "");
      const coins = payout >= 2 ? 20 : 10;
      return `
      <div class="card p-4 flex flex-col">
        <img src="${img}" alt="${title}" class="rounded-lg mb-3 w-full h-40 object-cover">
        <h3 class="font-semibold text-lg mb-1">${title}</h3>
        <p class="text-sm text-gray-600 mb-2">${desc}</p>
        <span class="inline-block mb-3 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-yellow-300">
          💰 Earn ${coins} Coins
        </span>
        <a href="${url}" target="_blank" class="btn btn-dark mt-auto">Open Offer</a>
      </div>`;
    }).join("");
    $container.innerHTML = html;
  }).fail(function(){
    $container.innerHTML = "<p>⚠️ Could not load offers. Try again later.</p>";
  });
};

// ---------- Gift modal utility (used by gifts.html) ----------
window.openGiftModal = function({ title, img, coins, details }) {
  const overlay = $("#giftOverlay");
  const box = $("#giftModal");
  if(!overlay || !box) return;
  $("#giftTitle").textContent = title;
  $("#giftImg").src = img;
  $("#giftCoins").textContent = coins + " Coins";
  $("#giftDesc").textContent = details;
  overlay.style.display = "flex";
  setTimeout(() => box.classList.add("open"), 0);
  document.body.style.overflow = "hidden";
};
window.closeGiftModal = function() {
  const overlay = $("#giftOverlay"); const box = $("#giftModal");
  if(!overlay || !box) return;
  box.classList.remove("open");
  setTimeout(()=>{ overlay.style.display = "none"; document.body.style.overflow = ""; }, 120);
};
window.claimGift = function() {
  requireAuthForAction(() => location.href = "claim.html");
};
