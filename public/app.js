/* =========================================================
   PetRewardHub — Fixed app.js (no React, pure HTML + Firebase compat)
   - Keeps your existing UI/HTML as-is (same classes, same layout)
   - Signup/Login -> redirect to select-pet.html
   - Select pet -> quiz.html
   - Quiz -> offers.html
   - Offers -> AdBlue links auto-add sub1=UID (coins added by server postback)
   - Claim -> deduct 100 coins + send to Google Sheet
========================================================= */

/* ---------- 1) YOUR LIVE CONFIG ---------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
  authDomain: "petrewardhub.firebaseapp.com",
  projectId: "petrewardhub",
  storageBucket: "petrewardhub.firebasestorage.app",
  messagingSenderId: "1087250543825",
  appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};

// Google Sheet webhook (Apps Script "Web App" URL)
const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

/* ---------- 2) INIT (single) ---------- */
function initializeFirebase() {
  if (typeof firebase === 'undefined') {
    console.error("Firebase SDK missing. Add compat SDKs in <head> before app.js");
    return null;
  }
  
  try { 
    if (!firebase.apps.length) {
      return firebase.initializeApp(FIREBASE_CONFIG);
    }
    return firebase.app();
  } catch(e){
    console.error("Firebase init error:", e);
    return null;
  }
}

// Initialize immediately
const firebaseApp = initializeFirebase();
const auth = firebaseApp ? firebase.auth() : null;
const db = firebaseApp ? firebase.firestore() : null;

/* ---------- 3) HELPERS ---------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const path = () => (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const isIndex     = () => /(^$|index\.html$)/.test(path());
const isSelectPet = () => path()==='select-pet.html';
const isQuiz      = () => path()==='quiz.html';
const isOffers    = () => path()==='offers.html';
const isClaim     = () => path()==='claim.html';
const isSignup    = () => path()==='signup.html';

const PETS = ["Dog","Cat","Bird","Rabbit","Small Mammal","Reptile","Fish","Ferret","Horse"];

const QUIZ_BANK = {
  Dog:[{q:"What size is your dog?",a:["Small (under 20 lbs)","Medium (20–50 lbs)","Large (50+ lbs)"]},{q:"Food sensitivities?",a:["Yes","No"]},{q:"Activity level?",a:["Low","Moderate","High"]},{q:"Enjoys chew toys?",a:["Yes","Sometimes","No"]},{q:"Use GPS/camera gadget?",a:["Yes","Maybe","No"]}],
  Cat:[{q:"Indoor or outdoor?",a:["Indoor","Outdoor","Both"]},{q:"Age group?",a:["Kitten","Adult","Senior"]},{q:"Likes to climb?",a:["Yes","No"]},{q:"Food preference?",a:["Wet","Dry","Both"]},{q:"Use cat toys?",a:["Often","Sometimes","Never"]}],
  Bird:[{q:"Type of bird?",a:["Parrot","Canary/Finch","Other"]},{q:"Cage size matters?",a:["Yes","No"]},{q:"Provide toys?",a:["Yes","No"]},{q:"Specialized diet?",a:["Yes","No"]},{q:"Training guides?",a:["Yes","Maybe","No"]}],
  Rabbit:[{q:"Indoor/outdoor rabbit?",a:["Indoor","Outdoor","Both"]},{q:"Diet restrictions?",a:["Yes","No"]},{q:"Likes chew toys?",a:["Yes","Sometimes","No"]},{q:"Regular grooming?",a:["Yes","No"]},{q:"DIY rabbit toys?",a:["Yes","Maybe","No"]}],
  "Small Mammal":[{q:"Type?",a:["Hamster","Guinea Pig","Other"]},{q:"Habitat size important?",a:["Yes","No"]},{q:"Specialty food?",a:["Yes","No"]},{q:"Use chew toys?",a:["Yes","No"]},{q:"Interested in gadgets?",a:["Yes","Maybe","No"]}],
  Reptile:[{q:"Type?",a:["Lizard","Snake","Turtle/Other"]},{q:"Needs heat lamp?",a:["Yes","No"]},{q:"Special diet?",a:["Yes","No"]},{q:"Track humidity/temp?",a:["Yes","No"]},{q:"Habitat gadgets?",a:["Yes","Maybe","No"]}],
  Fish:[{q:"Tank size?",a:["<10 gal","10–50 gal",">50 gal"]},{q:"Freshwater or saltwater?",a:["Fresh","Salt","Both"]},{q:"Filter type?",a:["Hang-on","Canister","Internal/Other"]},{q:"Use water conditioners?",a:["Yes","No"]},{q:"Auto feeders?",a:["Yes","Maybe","No"]}],
  Ferret:[{q:"Cage size?",a:["Small","Medium","Large"]},{q:"Diet specialized?",a:["Yes","No"]},{q:"Daily playtime?",a:["<1 hr","1–3 hrs",">3 hrs"]},{q:"Enrichment toys?",a:["Yes","Sometimes","No"]},{q:"Specialty gadgets?",a:["Yes","Maybe","No"]}],
  Horse:[{q:"Riding or companion?",a:["Riding","Companion","Both"]},{q:"Stable setup?",a:["Basic","Moderate","Advanced"]},{q:"Feed type?",a:["Hay","Pellets","Mixed"]},{q:"Use trackers?",a:["Yes","No"]},{q:"Grooming gadgets?",a:["Yes","Maybe","No"]}],
};

function estimateCoins(convText){
  const t = (convText||"").toLowerCase();
  if ((t.includes("app") && (t.includes("install")||t.includes("download")||t.includes("cpi")||t.includes("cpe")))) return 8;
  if (t.includes("email") || t.includes("lead") || t.includes("submit email")) return 15;
  if (t.includes("survey") || t.includes("signup") || t.includes("register") || t.includes("sign up")) return 10;
  if (t.includes("cpl")) return 12;
  return 10;
}

function addSub1(urlStr, uid){
  try{ 
    const u = new URL(urlStr); 
    u.searchParams.set("sub1", uid); 
    return u.toString(); 
  } catch(e){ 
    return urlStr+(urlStr.includes("?")?"&":"?")+"sub1="+encodeURIComponent(uid); 
  }
}

/* ---------- 4) AUTH STATE MANAGEMENT ---------- */
function checkAuth() {
  return new Promise((resolve) => {
    if (!auth) {
      resolve(null);
      return;
    }
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    }, (error) => {
      console.error("Auth state error:", error);
      resolve(null);
    });
  });
}

/* ---------- 5) INDEX (Login/Signup) ---------- */
async function initIndex(){
  const user = await checkAuth();
  if (user) {
    // Already logged in, redirect to select pet
    setTimeout(() => location.href = 'select-pet.html', 500);
    return;
  }

  // Login modal form
  $('#loginForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = $('#loginEmail')?.value.trim();
    const password = $('#loginPassword')?.value.trim();
    const errorEl = $('#loginError');
    
    if (!email || !password) {
      if (errorEl) {
        errorEl.textContent = 'Please fill all fields';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    try{
      await auth.signInWithEmailAndPassword(email, password);
      closeLoginModal();
      setTimeout(() => location.href = 'select-pet.html', 800);
    } catch(e){ 
      if (errorEl) {
        errorEl.textContent = e.message;
        errorEl.classList.remove('hidden');
      }
    }
  });
}

/* ---------- 6) SIGNUP PAGE ---------- */
async function initSignup(){
  const user = await checkAuth();
  if (user) {
    // Already logged in, redirect to select pet
    setTimeout(() => location.href = 'select-pet.html', 500);
    return;
  }

  $('#signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#signupEmail').value.trim();
    const password = $('#signupPassword').value.trim();
    const name = $('#signupName').value.trim();
    const errorEl = $('#signupError');

    if (!email || !password) {
      if (errorEl) {
        errorEl.textContent = 'Please fill all fields';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    try {
      const res = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(res.user.uid).set({
        email: res.user.email||'',
        name: name || '',
        coins: 0,
        createdAt: new Date()
      }, { merge: true });
      
      alert('Signup successful! Redirecting…');
      setTimeout(() => location.href = 'select-pet.html', 800);
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
      }
    }
  });
}

/* ---------- 7) SELECT PET ---------- */
async function initSelect(){
  const user = await checkAuth();
  if (!user) {
    alert('Please login first');
    location.href = 'index.html';
    return;
  }

  // Pet cards are already rendered by inline script, just ensure auth works
  console.log("Select pet page ready for user:", user.uid);
}

/* ---------- 8) QUIZ (5 Q one-per-page) ---------- */
async function initQuiz(){
  const user = await checkAuth();
  if (!user) {
    alert('Please login first');
    location.href = 'index.html';
    return;
  }

  try {
    const snap = await db.collection('users').doc(user.uid).get();
    const pet  = (snap.data() && snap.data().selectedPet) || 'Dog';
    const bank = QUIZ_BANK[pet] || QUIZ_BANK.Dog;
    const box  = $('#quizBox') || $('#questionBox') || $('#question_box');
    const title= $('#quizTitle') || $('#quizHero');
    
    if(title) title.textContent = `Quiz for ${pet}`;
    
    let i = 0, answers = [];
    
    function render(){
      const q = bank[i];
      box.innerHTML = `
        <div class="mb-6">
          <div class="text-xl font-bold text-slate-800 mb-4">${q.q}</div>
          <div class="space-y-3">
            ${q.a.map(opt => `
              <div class="petCard cursor-pointer p-4 text-center hover:bg-blue-50 transition-colors" data-answer="${opt}">
                ${opt}
              </div>
            `).join('')}
          </div>
          <div class="text-sm text-slate-500 mt-4 text-center">Question ${i+1} of ${bank.length}</div>
        </div>
      `;

      // Add click listeners to answers
      box.querySelectorAll('.petCard').forEach(card => {
        card.addEventListener('click', () => {
          answers[i] = card.getAttribute('data-answer');
          if (i < bank.length - 1) {
            i++;
            render();
          } else {
            finish();
          }
        });
      });
    }

    async function finish(){
      try {
        await db.collection('users').doc(user.uid).set({ 
          quizAnswers: answers, 
          updatedAt: new Date() 
        }, { merge: true });
        location.href = 'offers.html';
      } catch (error) {
        console.error('Error saving quiz:', error);
        alert('Error saving quiz answers. Please try again.');
      }
    }

    render();
  } catch (error) {
    console.error('Quiz init error:', error);
    alert('Error loading quiz. Please try again.');
  }
}

/* ---------- 9) OFFERS (AdBlue JSONP + sub1) ---------- */
async function initOffers(){
  const user = await checkAuth();
  if (!user) {
    alert('Please login first');
    location.href = 'index.html';
    return;
  }

  const emailEl = $('#userEmail'); 
  if (emailEl) emailEl.textContent = user.email || user.uid;

  // Live coin listener
  const unsubscribe = db.collection('users').doc(user.uid).onSnapshot(doc => {
    const coins = (doc.data() && doc.data().coins) || 0;
    const el = $('#coinCount'); 
    if (el) el.textContent = coins;
    
    const claim = $('#claimArea'); 
    const text = $('#claimText');
    if (claim) {
      if (coins >= 100) { 
        claim.classList.remove('hidden'); 
        if (text) text.textContent = `You have ${coins} coins. Redeem 100 coins for a free gadget.`; 
      } else {
        claim.classList.add('hidden');
      }
    }
  });

  // Process anchors created by your existing JSONP feed
  function processLinks(){
    const anchors = Array.from(document.querySelectorAll('#offerContainer a, a.offer-link'));
    anchors.forEach(a => {
      const href = a.getAttribute('href') || '#';
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
      
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(addSub1(href, user.uid), '_blank');
      }, { once: true });
      
      // Try to show estimated coins
      const card = a.closest('div');
      const convEl = card?.querySelector('.meta, .text-sm, [data-conv]');
      const conv = convEl ? convEl.textContent : '';
      const est  = estimateCoins(conv);
      
      if (card && !card.querySelector('.est-badge')) {
        const b = document.createElement('div');
        b.className = 'est-badge text-xs text-slate-500 mt-2';
        b.textContent = `Est. ${est} coins (after confirmation)`;
        card.appendChild(b);
      }
    });
  }

  // Wait for JSONP to inject offers
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const done = document.querySelector('#offerContainer a');
    if (done || tries > 25) { 
      clearInterval(timer); 
      processLinks(); 
    }
  }, 200);

  // Claim modal
  $('#openClaim')?.addEventListener('click', () => $('#claimModal')?.classList.remove('hidden'));
  $('#claimCancel')?.addEventListener('click', () => { 
    $('#claimModal')?.classList.add('hidden'); 
    const s = $('#claimStatus'); 
    if (s) s.textContent = ''; 
  });
  $('#claimSubmit')?.addEventListener('click', submitClaim);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    unsubscribe();
  });
}

/* ---------- 10) CLAIM ---------- */
async function submitClaim(){
  const name = $('#claimName')?.value?.trim();
  const addr = $('#claimAddress')?.value?.trim();
  const email = $('#claimEmail')?.value?.trim();
  const status = $('#claimStatus');
  
  if (!name || !addr || !email) {
    alert('Please fill all fields');
    return;
  }

  const user = await checkAuth();
  if (!user) {
    alert('Login required');
    location.href = 'index.html';
    return;
  }

  if (status) status.textContent = 'Submitting...';

  try {
    // Deduct 100 coins atomically
    const ref = db.collection('users').doc(user.uid);
    await db.runTransaction(async t => {
      const s = await t.get(ref);
      const coins = (s.data() && s.data().coins) || 0;
      if (coins < 100) throw new Error('Insufficient coins');
      t.update(ref, { coins: coins - 100, updatedAt: new Date() });
    });

    // Read selected pet
    const s = await db.collection('users').doc(user.uid).get();
    const pet = (s.data() && s.data().selectedPet) || '';

    const payload = { 
      userUid: user.uid, 
      userEmail: email, 
      pet, 
      offerTitle: 'Redeem 100 coins', 
      name, 
      address: addr, 
      claimedAt: new Date().toISOString() 
    };
    
    const res = await fetch(SHEETS_WEBHOOK, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    let ok = res.ok, j = null; 
    try { j = await res.json(); } catch(e) {}
    
    if (ok || (j && j.result === 'success')) {
      if (status) status.textContent = 'Claim saved. Item will arrive in 1–2 weeks.';
      setTimeout(() => $('#claimModal')?.classList.add('hidden'), 1500);
    } else {
      if (status) status.textContent = 'Error saving claim.';
    }
  } catch (e) {
    console.error('Claim error:', e);
    if (status) status.textContent = 'Error: ' + (e.message || e);
  }
}

/* ---------- 11) ROUTER ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (!firebaseApp) {
    console.error('Firebase not initialized');
    return;
  }

  if (isIndex())     return initIndex();
  if (isSignup())    return initSignup();
  if (isSelectPet()) return initSelect();
  if (isQuiz())      return initQuiz();
  if (isOffers())    return initOffers();
  if (isClaim())     return; // claim page binds inline or through modal
});

/* ---------- 12) GLOBAL MODAL FUNCTIONS ---------- */
function openLoginModal() { 
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.remove('hidden'); 
    document.body.style.overflow = 'hidden'; 
  }
}

function closeLoginModal(){ 
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('hidden'); 
    document.body.style.overflow = 'auto'; 
    
    // Clear form
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');
    if (form) form.reset();
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }
}

// Product modal functions (for index.html reward popups)
function openProductModal(productId) {
  // This will be overridden by the inline script in index.html
  console.log('Product modal requested for:', productId);
}

function closeProductModal() {
  // This will be overridden by the inline script in index.html
  console.log('Closing product modal');
}

function showImagePreview(element, imageSrc) {
  // This will be overridden by the inline script in index.html
  console.log('Image preview requested:', imageSrc);
}

function closeImagePreview() {
  // This will be overridden by the inline script in index.html
  console.log('Closing image preview');
}

function startEarning() {
  // Redirect to start the earning process
  window.location.href = 'select-pet.html';
}

/* ---------- 13) UTILITY FUNCTIONS ---------- */
function changeMainImage(src) {
  const mainImage = document.querySelector('#productContent .bg-gray-50 img');
  if (mainImage) {
    mainImage.src = src;
  }
}

// Close modals on outside click
document.addEventListener('click', (e) => {
  const productModal = document.getElementById('productModal');
  const loginModal = document.getElementById('loginModal');
  const imagePreview = document.getElementById('imagePreview');
  
  if (productModal && e.target === productModal) {
    closeProductModal();
  }
  if (loginModal && e.target === loginModal) {
    closeLoginModal();
  }
  if (imagePreview && e.target === imagePreview) {
    closeImagePreview();
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeProductModal();
    closeLoginModal();
    closeImagePreview();
  }
});

/* ---------- 14) FIREBASE AUTH LISTENERS ---------- */
if (auth) {
  // Global auth state listener for debugging
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('User logged in:', user.email);
    } else {
      console.log('User logged out');
    }
  });
}

/* ---------- 15) ERROR HANDLING ---------- */
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    initializeFirebase, 
    checkAuth, 
    estimateCoins, 
    addSub1 
  };
}