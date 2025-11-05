/* app.js — COMPLETE front-end logic for PetRewardHub
   REPLACE:
     - FIREBASE_CONFIG with your Firebase web config
     - SHEETS_WEBHOOK with Google Apps Script Web App URL
   NOTES:
     - Coins are displayed from Firestore only.
     - Netlify function (server-side) must handle AdBlue postbacks and update Firestore.
*/
import React, { useEffect } from "react";
import db from './firebase';
import { collection, addDoc } from "firebase/firestore";

function App() {
  useEffect(() => {
    async function testFirebase() {
      try {
        const docRef = await addDoc(collection(db, "test"), {
          message: "Hello Test Mode!"
        });
        console.log("Firebase Connected! Document ID:", docRef.id);
      } catch (e) {
        console.error("Error connecting Firebase:", e);
      }
    }

    testFirebase();
  }, []);

  return (
    <div>
      <h1>PetRewardHub Firebase Test</h1>
      <p>Check console for Firebase connection result.</p>
    </div>
  );
}

export default App;


/* ================== CONFIG (REPLACE) ================== */
// inside public/app.js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
  authDomain: "petrewardhub.firebaseapp.com",
  projectId: "petrewardhub",
  storageBucket: "petrewardhub.firebasestorage.app",
  messagingSenderId: "1087250543825",
  appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};

// Initialize Firebase (compat)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();


const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec"; // replace
/* ===================================================== */

/* ---------- Init Firebase (compat) ---------- */
if (window.firebase && firebase.initializeApp) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    // ignore if already initialized
  }
} else {
  console.warn('Firebase SDK not found. Ensure Firebase SDK script tags are present in HTML pages.');
}

const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- Utilities ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const isOffersPage = () => location.pathname.endsWith('offers.html');
const isQuizPage = () => location.pathname.endsWith('quiz.html');
const isSelectPet = () => location.pathname.endsWith('select-pet.html');

function safeText(s){ return (s||'').toString(); }
function formatCoins(n){ return Number(n||0); }

/* Map Ad conversion / description text to estimated coins.
   This is only estimation for UI; actual coins come from server postback.
*/
function estimateCoinsFromConversion(convText){
  if(!convText) return 10;
  const t = convText.toLowerCase();
  // App installs, CPE-like
  if (t.includes('app') && (t.includes('install') || t.includes('download') || t.includes('cpi') || t.includes('cpe'))) return 8;
  // Email submit / lead capture
  if (t.includes('email') || t.includes('lead') || t.includes('submit email')) return 15;
  // Survey / signup / registration
  if (t.includes('survey') || t.includes('signup') || t.includes('register') || t.includes('sign up')) return 10;
  // Pay-per-action, pay-per-lead
  if (t.includes('cpl') || t.includes('lead')) return 12;
  // Default fallback
  return 10;
}

/* Helper to append sub1 param to a URL (returns new URL string) */
function appendSub1(urlStr, uid){
  try {
    const url = new URL(urlStr);
    url.searchParams.set('sub1', uid);
    return url.toString();
  } catch(e){
    // fallback: naive append
    const sep = urlStr.includes('?') ? '&' : '?';
    return urlStr + sep + 'sub1=' + encodeURIComponent(uid);
  }
}

/* ---------- AUTH: Signup / Login helpers ---------- */
async function signupWithEmail(name, email, password){
  const res = await auth.createUserWithEmailAndPassword(email, password);
  const user = res.user;
  await db.collection('users').doc(user.uid).set({
    name: name || '',
    email: user.email || '',
    coins: 0,
    createdAt: new Date()
  }, { merge: true });
  return user;
}
async function loginWithEmail(email, password){
  const res = await auth.signInWithEmailAndPassword(email, password);
  return res.user;
}
async function loginWithGoogle(){
  const provider = new firebase.auth.GoogleAuthProvider();
  const res = await auth.signInWithPopup(provider);
  const user = res.user;
  await db.collection('users').doc(user.uid).set({
    email: user.email || '',
    name: user.displayName || '',
    updatedAt: new Date()
  }, { merge: true });
  return user;
}

/* Expose signup helper for signup page form (index used) */
window.signupWithEmail = signupWithEmail;

/* ---------- PET LIST + QUIZ BANK ---------- */
const PETS = ["Dog","Cat","Bird","Rabbit","Small Mammal","Reptile","Fish","Ferret","Horse"];

const QUIZ_BANK = {
  Dog: [
    { q: "What size is your dog?", a:["Small (under 20 lbs)","Medium (20-50 lbs)","Large (50+ lbs)"] },
    { q: "Does your dog have any food sensitivities?", a:["Yes","No"] },
    { q: "Activity level?", a:["Low","Moderate","High"] },
    { q: "Does your dog enjoy chew toys?", a:["Yes","Sometimes","No"] },
    { q: "Would you use a GPS/camera pet gadget?", a:["Yes","Maybe","No"] }
  ],
  Cat: [
    { q: "Is your cat indoor or outdoor?", a:["Indoor","Outdoor","Both"] },
    { q: "Age group?", a:["Kitten","Adult","Senior"] },
    { q: "Does your cat like to climb?", a:["Yes","No"] },
    { q: "Food preference?", a:["Wet","Dry","Both"] },
    { q: "How often use cat toys?", a:["Often","Sometimes","Never"] }
  ],
  Bird: [
    { q: "What type of bird do you have?", a:["Parrot","Canary/Finch","Other"] },
    { q: "Cage size matters?", a:["Yes","No"] },
    { q: "Do you provide toys?", a:["Yes","No"] },
    { q: "Is diet specialized?", a:["Yes","No"] },
    { q: "Would you buy training guides?", a:["Yes","Maybe","No"] }
  ],
  Rabbit: [
    { q: "Indoor or outdoor rabbit?", a:["Indoor","Outdoor","Both"] },
    { q: "Diet restrictions?", a:["Yes","No"] },
    { q: "Likes chew toys?", a:["Yes","Sometimes","No"] },
    { q: "Is grooming regular?", a:["Yes","No"] },
    { q: "Interested in DIY rabbit toys?", a:["Yes","Maybe","No"] }
  ],
  "Small Mammal": [
    { q: "Type of small mammal?", a:["Hamster","Guinea Pig","Other"] },
    { q: "Habitat size important?", a:["Yes","No"] },
    { q: "Do you buy specialty food?", a:["Yes","No"] },
    { q: "Use chew toys?", a:["Yes","No"] },
    { q: "Interested in small-mammal gadgets?", a:["Yes","Maybe","No"] }
  ],
  Reptile: [
    { q: "Type of reptile?", a:["Lizard","Snake","Turtle/Other"] },
    { q: "Does it require heat lamp?", a:["Yes","No"] },
    { q: "Specialized diet?", a:["Yes","No"] },
    { q: "Do you track humidity/temp?", a:["Yes","No"] },
    { q: "Interested in habitat gadgets?", a:["Yes","Maybe","No"] }
  ],
  Fish: [
    { q: "Tank size?", a:["Small (<10 gal)","Medium (10-50 gal)","Large (50+ gal)"] },
    { q: "Freshwater or saltwater?", a:["Freshwater","Saltwater","Both"] },
    { q: "Filter type?", a:["Hang-on","Canister","Internal/Other"] },
    { q: "Do you use water conditioners?", a:["Yes","No"] },
    { q: "Interested in auto feeders?", a:["Yes","Maybe","No"] }
  ],
  Ferret: [
    { q: "Cage size?", a:["Small","Medium","Large"] },
    { q: "Diet specialized?", a:["Yes","No"] },
    { q: "Playtime daily?", a:["<1 hr","1-3 hrs",">3 hrs"] },
    { q: "Use enrichment toys?", a:["Yes","Sometimes","No"] },
    { q: "Would you buy specialty gadgets?", a:["Yes","Maybe","No"] }
  ],
  Horse: [
    { q: "Riding or companion?", a:["Riding","Companion","Both"] },
    { q: "Stable setup?", a:["Basic","Moderate","Advanced"] },
    { q: "Feed type?", a:["Hay","Pellets","Mixed"] },
    { q: "Do you use tech (trackers)?", a:["Yes","No"] },
    { q: "Interested in grooming gadgets?", a:["Yes","Maybe","No"] }
  ]
};

/* ---------- SELECT PET PAGE: render pet grid ---------- */
function renderPetGrid(){
  const grid = document.getElementById('petGrid');
  if(!grid) return;
  grid.innerHTML = '';
  PETS.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'petCard';
    const emoji = p==='Dog'?'🐶':p==='Cat'?'🐱':p==='Bird'?'🐦':p==='Rabbit'?'🐰':p==='Fish'?'🐟':p==='Horse'?'🐴':'🐾';
    el.innerHTML = `<div class="text-4xl">${emoji}</div><div class="mt-2">${p}</div>`;
    el.onclick = async () => {
      const user = auth.currentUser;
      if(!user){ alert('Please login first'); window.location.href='index.html'; return; }
      await db.collection('users').doc(user.uid).set({ selectedPet: p, updatedAt: new Date() }, { merge:true });
      window.location.href = 'quiz.html';
    };
    grid.appendChild(el);
  });
}

/* ---------- QUIZ: one-question-per-page flow ---------- */
function startQuizUI(){
  auth.onAuthStateChanged(async user => {
    if(!user){ alert('Please login'); window.location.href='index.html'; return; }
    const doc = await db.collection('users').doc(user.uid).get();
    const pet = (doc.data() && doc.data().selectedPet) || 'Dog';
    renderQuizForPet(pet);
  });
}

function renderQuizForPet(pet){
  const bank = QUIZ_BANK[pet] || QUIZ_BANK['Dog'];
  let index = 0;
  const answers = [];
  const questionBox = document.getElementById('questionBox');
  const progress = document.getElementById('quizProgress');
  const title = document.getElementById('quizTitle');
  if(title) title.textContent = `Quiz for ${pet}`;

  function render(){
    const q = bank[index];
    questionBox.innerHTML = '';
    const qdiv = document.createElement('div');
    qdiv.className = 'text-lg font-semibold mb-3';
    qdiv.textContent = q.q;
    questionBox.appendChild(qdiv);

    q.a.forEach(opt=>{
      const btn = document.createElement('div');
      btn.className = 'petCard mt-2';
      btn.style.padding = '10px';
      btn.textContent = opt;
      btn.onclick = () => {
        answers[index] = opt;
        if(index < bank.length - 1){ index++; render(); } else finishQuiz();
      };
      questionBox.appendChild(btn);
    });

    progress.textContent = `Question ${index+1} of ${bank.length}`;
  }

  async function finishQuiz(){
    const user = auth.currentUser;
    if(!user){ alert('Login required'); window.location.href='index.html'; return; }
    await db.collection('users').doc(user.uid).set({ quizAnswers: answers, updatedAt: new Date() }, { merge:true });
    window.location.href = 'offers.html';
  }

  render();
}

/* ---------- OFFERS: process AdBlue feed output and attach sub1 ---------- */
function processAdBlueOffers(uid){
  // The offers HTML may already be injected by the feed (offers.html inlined script).
  // We find all .offer-link anchors (rendered by feed) and rewrite href to include sub1,
  // estimate coin value from conversion text (nearby), and attach a click handler.
  const offerLinks = Array.from(document.querySelectorAll('.offer-link'));
  if(offerLinks.length === 0){
    // If feed used other markup, try to find anchors inside .offer-card
    const cardAnchors = Array.from(document.querySelectorAll('#offerContainer a'));
    if(cardAnchors.length === 0) return;
    cardAnchors.forEach(a => attachOfferBehavior(a, uid));
    return;
  }
  offerLinks.forEach(a => attachOfferBehavior(a, uid));
}

function findConversionTextForAnchor(anchorEl){
  // try to find nearby conversion text: parent .offer-card > ... > .text-sm
  const card = anchorEl.closest('.offer-card') || anchorEl.closest('div');
  if(!card) return '';
  const conv = card.querySelector('.text-sm') || card.querySelector('.meta') || null;
  return conv ? conv.textContent : '';
}

function attachOfferBehavior(anchorEl, uid){
  if(!anchorEl) return;
  const originalHref = anchorEl.getAttribute('href') || '#';
  const convText = findConversionTextForAnchor(anchorEl);
  const estCoins = estimateCoinsFromConversion(convText);
  // set visual badge of estimated coins (non-binding)
  let badge = anchorEl.closest('.offer-card')?.querySelector('.est-badge');
  if(!badge && anchorEl.closest('.offer-card')){
    badge = document.createElement('div');
    badge.className = 'est-badge text-xs text-slate-600';
    badge.style.marginTop = '6px';
    anchorEl.closest('.offer-card').querySelector('div')?.appendChild(badge);
  }
  if(badge) badge.innerText = `Est. ${estCoins} coins (after confirmed)`;

  // replace href with a JS handler to ensure sub1 appended at open time
  anchorEl.addEventListener('click', (e) => {
    // allow Ctrl/Cmd to open in new tab if user desires
    e.preventDefault();
    // compute URL with sub1
    const finalUrl = appendSub1(originalHref, uid);
    window.open(finalUrl, '_blank');
    // we do NOT add coins client-side; server postback will add whichever coins are due
  });

  // For accessibility set rel and target
  anchorEl.setAttribute('target','_blank');
  anchorEl.setAttribute('rel','noopener noreferrer');
}

/* Initialize offers page: watch auth, display uid, listen to Firestore coins */
function initOffersPage(){
  auth.onAuthStateChanged(user=>{
    if(!user){ alert('Please login'); window.location.href='index.html'; return; }
    // show email
    const emailEl = document.getElementById('userEmail');
    if(emailEl) emailEl.textContent = user.email || user.uid;
    // set up coins listener
    db.collection('users').doc(user.uid).onSnapshot(doc=>{
      const data = doc.data() || {};
      const coins = data.coins || 0;
      const coinEl = document.getElementById('coinCount');
      if(coinEl) coinEl.textContent = coins;
      // show claim area if >=100
      const claimArea = document.getElementById('claimArea');
      if(claimArea) {
        if (coins >= 100) {
          claimArea.classList.remove('hidden');
          const claimText = document.getElementById('claimText');
          if(claimText) claimText.textContent = `You have ${coins} coins. Redeem 100 coins for a free gadget.`;
        } else {
          claimArea.classList.add('hidden');
        }
      }
    });

    // Because AdBlue feed is loaded client-side (via JSONP), we might need to wait for it.
    // Poll for offers up to 5s
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const links = document.querySelectorAll('.offer-link, #offerContainer a');
      if (links.length > 0 || attempts > 25) {
        clearInterval(poll);
        processAdBlueOffers(user.uid);
      }
    }, 200);
    // bind claim modal handlers
    bindClaimHandlers();
  });
}

/* ---------- CLAIM modal and claim page ---------- */
function bindClaimHandlers(){
  const openClaim = document.getElementById('openClaim');
  const claimModal = document.getElementById('claimModal');
  const claimCancel = document.getElementById('claimCancel');
  const claimSubmit = document.getElementById('claimSubmit');

  if(openClaim) openClaim.addEventListener('click', ()=> claimModal.classList.remove('hidden'));
  if(claimCancel) claimCancel.addEventListener('click', ()=> claimModal.classList.add('hidden'));
  if(claimSubmit) claimSubmit.addEventListener('click', submitClaimHandler);
}

async function submitClaimHandler(){
  const name = document.getElementById('claimName')?.value.trim();
  const address = document.getElementById('claimAddress')?.value.trim();
  const email = document.getElementById('claimEmail')?.value.trim();
  if(!name || !address || !email){ alert('Please fill all fields'); return; }
  const user = auth.currentUser;
  if(!user){ alert('Login required'); window.location.href='index.html'; return; }
  const statusEl = document.getElementById('claimStatus');
  if(statusEl) statusEl.textContent = 'Submitting...';

  try {
    // Deduct 100 coins transactionally (client-side). This ensures UI shows updated coins.
    // Note: Real security requires server-side validation — make sure to add anti-abuse checks later.
    const userRef = db.collection('users').doc(user.uid);
    await db.runTransaction(async t => {
      const snap = await t.get(userRef);
      const coins = (snap.data() && snap.data().coins) || 0;
      if(coins < 100) throw new Error('Insufficient coins');
      t.update(userRef, { coins: coins - 100, updatedAt: new Date() });
    });

    // Post claim to Google Sheets webhook
    const payload = {
      userUid: user.uid,
      userEmail: email,
      pet: (await db.collection('users').doc(user.uid).get()).data().selectedPet || '',
      offerTitle: 'Redeem 100 coins',
      name, address,
      claimedAt: new Date().toISOString()
    };

    const res = await fetch(SHEETS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if(json.result === 'success' || res.ok){
      if(statusEl) statusEl.textContent = 'Claim saved. Item will arrive in ~1–2 weeks.';
      setTimeout(()=> {
        const claimModal = document.getElementById('claimModal');
        if(claimModal) claimModal.classList.add('hidden');
        if(statusEl) statusEl.textContent = '';
      }, 2000);
    } else {
      if(statusEl) statusEl.textContent = 'Error saving claim.';
    }
  } catch(err){
    if(statusEl) statusEl.textContent = 'Error: ' + (err.message || err);
  }
}

/* Claim page (standalone) handler */
const claimSubmitPageBtn = document.getElementById('claimSubmitPage');
if(claimSubmitPageBtn){
  claimSubmitPageBtn.addEventListener('click', async () => {
    const name = document.getElementById('claimNamePage')?.value.trim();
    const address = document.getElementById('claimAddressPage')?.value.trim();
    const email = document.getElementById('claimEmailPage')?.value.trim();
    if(!name || !address || !email) return alert('Please fill all');
    const payload = { userUid: (auth.currentUser && auth.currentUser.uid) || 'guest', userEmail: email, pet: 'unknown', offerTitle: 'Redeem', name, address, claimedAt: new Date().toISOString() };
    try {
      const res = await fetch(SHEETS_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const json = await res.json();
      if(json.result === 'success' || res.ok) document.getElementById('claimResult').textContent = 'Saved. Delivery ~1–2 weeks.';
      else document.getElementById('claimResult').textContent = 'Error saving.';
    } catch(e) { document.getElementById('claimResult').textContent = 'Error: ' + e.message; }
  });
}

/* ---------- INDEX Login modal bindings ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Login modal form
  const loginForm = document.getElementById('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      document.getElementById('loginError')?.classList.add('hidden');
      const email = document.getElementById('loginEmail')?.value.trim();
      const pass = document.getElementById('loginPassword')?.value.trim();
      try {
        await loginWithEmail(email, pass);
        closeLoginModal();
        window.location.href = 'select-pet.html';
      } catch(err){
        document.getElementById('loginError').textContent = err.message || 'Login failed';
        document.getElementById('loginError').classList.remove('hidden');
      }
    });
  }

  // Signup page binding
  const signupForm = document.getElementById('signupForm');
  if(signupForm){
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      document.getElementById('signupError')?.classList.add('hidden');
      const name = document.getElementById('signupName')?.value.trim();
      const email = document.getElementById('signupEmail')?.value.trim();
      const pass = document.getElementById('signupPassword')?.value.trim();
      try {
        await signupWithEmail(name, email, pass);
        window.location.href = 'select-pet.html';
      } catch(err){
        document.getElementById('signupError').textContent = err.message || 'Signup failed';
        document.getElementById('signupError').classList.remove('hidden');
      }
    });
  }

  // Render pet grid on select-pet page
  if(isSelectPet()) renderPetGrid();

  // Start quiz if on quiz page
  if(isQuizPage()) startQuizUI();

  // If offers page, init offers logic
  if(isOffersPage()) initOffersPage();
});

/* ---------- Helper: detect and process AdBlue feed JSONP insertion for offers.html ----------
   The offers page includes a small inline JSONP call that inserts HTML into #offerContainer.
   We poll for anchors and when found, we process them and attach sub1 appends.
   (This is primarily handled in initOffersPage -> processAdBlueOffers)
*/

/* ---------- Notes to deployer ----------
  - Replace FIREBASE_CONFIG and SHEETS_WEBHOOK.
  - Ensure Netlify function '/.netlify/functions/postback' is configured and AdBlue postback is set:
      https://your-site.netlify.app/.netlify/functions/postback?sub1={sub1}&payout={payout}&offer_id={offer_id}
  - The server-side postback (Part 3) must update Firestore user coins. Client only listens to Firestore.
  - For debugging, simulate postback:
      curl "https://your-site.netlify.app/.netlify/functions/postback?sub1=USER_UID&payout=1.5&offer_id=test"
*/

