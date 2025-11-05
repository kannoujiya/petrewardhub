/* =========================================================
   PetRewardHub — app.js (Pure HTML/CSS/JS + Firebase compat)
   PAGES (window._page):
     - index     : login/signup + Google; auto-redirect to select-pet.html
     - select    : choose pet (USA-legal)
     - quiz      : 5 Qs, one-per-page, per selected pet
     - offers    : AdBlue feed (JSONP), append sub1=UID, estimate coins
     - claim     : deduct 100 coins + send details to Google Sheet

   IMPORTANT:
   - Do NOT use React/imports here. We use <script> SDKs in HTML.
   - Coins are added ONLY by Netlify postback on confirmed conversions.
========================================================= */

/* ---------- 1) CONFIG: YOUR LIVE KEYS ---------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
  authDomain: "petrewardhub.firebaseapp.com",
  projectId: "petrewardhub",
  storageBucket: "petrewardhub.firebasestorage.app",
  messagingSenderId: "1087250543825",
  appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};

// Google Apps Script Web App (Sheet webhook)
const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

/* ---------- 2) INIT FIREBASE (compat SDK only) ---------- */
if (!window.firebase) {
  console.error("Firebase SDK not found. Include compat SDKs in HTML <head>.");
}
let _appInited = false;
try {
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(FIREBASE_CONFIG);
    _appInited = true;
  }
} catch (e) {
  // ignore "already exists"
}
const auth = firebase.auth();
const db   = firebase.firestore();

/* ---------- 3) UTILITIES ---------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const nowIso = () => new Date().toISOString();

const isIndex     = () => window._page === 'index';
const isSelectPet = () => window._page === 'select';
const isQuiz      = () => window._page === 'quiz';
const isOffers    = () => window._page === 'offers';
const isClaim     = () => window._page === 'claim';

/* UI coin estimate only (real coins via server postback) */
function estimateCoins(convText){
  const t = (convText||"").toLowerCase();
  if ((t.includes("app") && (t.includes("install") || t.includes("download") || t.includes("cpi") || t.includes("cpe")))) return 8; // app install
  if (t.includes("email") || t.includes("lead") || t.includes("submit email")) return 15; // email submit / lead
  if (t.includes("survey") || t.includes("signup") || t.includes("register") || t.includes("sign up")) return 10; // survey/signup
  if (t.includes("cpl")) return 12;
  return 10;
}
function addSub1(urlStr, uid){
  try { const u = new URL(urlStr); u.searchParams.set("sub1", uid); return u.toString(); }
  catch(e){ return urlStr + (urlStr.includes("?")?"&":"?") + "sub1=" + encodeURIComponent(uid); }
}

/* ---------- 4) QUIZ BANK ---------- */
const PETS = ["Dog","Cat","Bird","Rabbit","Small Mammal","Reptile","Fish","Ferret","Horse"];
const QUIZ_BANK = {
  Dog:[{q:"What size is your dog?",a:["Small (under 20 lbs)","Medium (20–50 lbs)","Large (50+ lbs)"]},{q:"Food sensitivities?",a:["Yes","No"]},{q:"Activity level?",a:["Low","Moderate","High"]},{q:"Enjoys chew toys?",a:["Yes","Sometimes","No"]},{q:"Use GPS/camera gadget?",a:["Yes","Maybe","No"]}],
  Cat:[{q:"Indoor or outdoor?",a:["Indoor","Outdoor","Both"]},{q:"Age group?",a:["Kitten","Adult","Senior"]},{q:"Likes to climb?",a:["Yes","No"]},{q:"Food preference?",a:["Wet","Dry","Both"]},{q:"Cat toys usage?",a:["Often","Sometimes","Never"]}],
  Bird:[{q:"Type of bird?",a:["Parrot","Canary/Finch","Other"]},{q:"Cage size matters?",a:["Yes","No"]},{q:"Provide toys?",a:["Yes","No"]},{q:"Specialized diet?",a:["Yes","No"]},{q:"Training guides?",a:["Yes","Maybe","No"]}],
  Rabbit:[{q:"Indoor/outdoor rabbit?",a:["Indoor","Outdoor","Both"]},{q:"Diet restrictions?",a:["Yes","No"]},{q:"Likes chew toys?",a:["Yes","Sometimes","No"]},{q:"Regular grooming?",a:["Yes","No"]},{q:"DIY rabbit toys?",a:["Yes","Maybe","No"]}],
  "Small Mammal":[{q:"Type?",a:["Hamster","Guinea Pig","Other"]},{q:"Habitat size important?",a:["Yes","No"]},{q:"Specialty food?",a:["Yes","No"]},{q:"Use chew toys?",a:["Yes","No"]},{q:"Interested in gadgets?",a:["Yes","Maybe","No"]}],
  Reptile:[{q:"Type?",a:["Lizard","Snake","Turtle/Other"]},{q:"Needs heat lamp?",a:["Yes","No"]},{q:"Special diet?",a:["Yes","No"]},{q:"Track humidity/temp?",a:["Yes","No"]},{q:"Habitat gadgets?",a:["Yes","Maybe","No"]}],
  Fish:[{q:"Tank size?",a:["<10 gal","10–50 gal",">50 gal"]},{q:"Freshwater or saltwater?",a:["Freshwater","Saltwater","Both"]},{q:"Filter type?",a:["Hang-on","Canister","Internal/Other"]},{q:"Use water conditioners?",a:["Yes","No"]},{q:"Auto feeders?",a:["Yes","Maybe","No"]}],
  Ferret:[{q:"Cage size?",a:["Small","Medium","Large"]},{q:"Diet specialized?",a:["Yes","No"]},{q:"Daily playtime?",a:["<1 hr","1–3 hrs",">3 hrs"]},{q:"Enrichment toys?",a:["Yes","Sometimes","No"]},{q:"Specialty gadgets?",a:["Yes","Maybe","No"]}],
  Horse:[{q:"Riding or companion?",a:["Riding","Companion","Both"]},{q:"Stable setup?",a:["Basic","Moderate","Advanced"]},{q:"Feed type?",a:["Hay","Pellets","Mixed"]},{q:"Use trackers?",a:["Yes","No"]},{q:"Grooming gadgets?",a:["Yes","Maybe","No"]}],
};

/* ---------- 5) AUTH HELPERS ---------- */
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

/* ---------- 6) PAGE CONTROLLERS ---------- */
/* INDEX: login/signup + redirect to select-pet.html */
function initIndex(){
  const emailIn = $('#email');
  const passIn  = $('#password');
  const status  = $('#authStatus');
  const setStatus = (t)=>{ if(status) status.textContent = t; };

  $('#loginBtn')?.addEventListener('click', async ()=>{
    try { await loginWithEmail(emailIn.value.trim(), passIn.value.trim()); setStatus('Logged in'); setTimeout(()=>location.href='select-pet.html', 400); }
    catch(e){ setStatus(e.message); }
  });
  $('#signupBtn')?.addEventListener('click', async ()=>{
    try { await signupWithEmail('', emailIn.value.trim(), passIn.value.trim()); setStatus('Signed up'); setTimeout(()=>location.href='select-pet.html', 400); }
    catch(e){ setStatus(e.message); }
  });
  $('#googleSignIn')?.addEventListener('click', async ()=>{
    try { await loginWithGoogle(); setStatus('Google sign-in OK'); setTimeout(()=>location.href='select-pet.html', 400); }
    catch(e){ setStatus(e.message); }
  });

  // Auto-redirect if already signed in
  auth.onAuthStateChanged(u=>{
    if(u) setTimeout(()=>location.href='select-pet.html', 300);
  });
}

/* SELECT PET */
function initSelect(){
  auth.onAuthStateChanged(u=>{
    if(!u){ alert('Please login first'); location.href='index.html'; return; }
    const grid = $('#petGrid'); if(!grid) return;
    grid.innerHTML = '';
    PETS.forEach(p=>{
      const el = document.createElement('div');
      el.className = 'petCard';
      const emoji = p==='Dog'?'🐶':p==='Cat'?'🐱':p==='Bird'?'🐦':p==='Rabbit'?'🐰':p==='Fish'?'🐟':p==='Horse'?'🐴':'🐾';
      el.innerHTML = `<div style="font-size:32px">${emoji}</div><div style="margin-top:6px;font-weight:600">${p}</div>`;
      el.onclick = async ()=>{
        await db.collection('users').doc(u.uid).set({ selectedPet: p, updatedAt: new Date() }, { merge:true });
        location.href = 'quiz.html';
      };
      grid.appendChild(el);
    });
  });
}

/* QUIZ */
function initQuiz(){
  auth.onAuthStateChanged(async u=>{
    if(!u){ alert('Please login first'); location.href='index.html'; return; }
    const snap = await db.collection('users').doc(u.uid).get();
    const pet = (snap.data() && snap.data().selectedPet) || 'Dog';
    const bank = QUIZ_BANK[pet] || QUIZ_BANK.Dog;
    const box = $('#quizBox'); const title = $('#quizTitle');
    if(title) title.textContent = `Quiz for ${pet}`;
    let i=0; const answers=[];
    function render(){
      const q = bank[i];
      box.innerHTML = `<div class="card"><div style="font-weight:700;margin-bottom:10px">${q.q}</div></div>`;
      q.a.forEach(opt=>{
        const b = document.createElement('button');
        b.textContent = opt; b.style.margin='6px';
        b.onclick = ()=>{ answers[i]=opt; if(i<bank.length-1){ i++; render(); } else finish(); };
        box.appendChild(b);
      });
      const p = document.createElement('div'); p.className='muted'; p.style.marginTop='8px'; p.textContent = `Question ${i+1} of ${bank.length}`;
      box.appendChild(p);
    }
    async function finish(){
      await db.collection('users').doc(u.uid).set({ quizAnswers: answers, updatedAt: new Date() }, { merge:true });
      location.href = 'offers.html';
    }
    render();
  });
}

/* OFFERS (AdBlue JSONP feed + sub1 append) */
function initOffers(){
  auth.onAuthStateChanged(u=>{
    if(!u){ alert('Please login first'); location.href='index.html'; return; }

    const FEED = "https://d1y3y09sav47f5.cloudfront.net/public/offers/feed.php?user_id=481160&api_key=89a09f95e53dde3a5e593491e1134540&s1=&s2=&callback=?";
    if(!window.jQuery){ alert("jQuery not loaded on offers.html"); return; }

    jQuery.getJSON(FEED, function(offers){
      const list = (offers||[]).slice(0,8);
      const wrap = $('#offerContainer'); wrap.innerHTML = '';
      if(list.length===0){ wrap.innerHTML = '<div class="muted">No offers right now.</div>'; return; }
      list.forEach(of=>{
        const conv = of.conversion || '';
        const est  = estimateCoins(conv);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div>
              <div style="font-weight:700">${of.anchor || 'Offer'}</div>
              <div class="muted" style="font-size:13px">${conv}</div>
              <div class="muted" style="font-size:12px;margin-top:4px">Est. ${est} coins (after confirmation)</div>
            </div>
            <div>
              <a class="offer-link" href="${of.url||'#'}" target="_blank" rel="noopener">Open</a>
            </div>
          </div>
        `;
        // Ensure sub1 is appended at click time
        card.querySelector('.offer-link').addEventListener('click', (e)=>{
          e.preventDefault();
          const finalUrl = addSub1(of.url||'#', u.uid);
          window.open(finalUrl, '_blank');
        });
        wrap.appendChild(card);
      });
    });

    // Show live coin count (from server postbacks)
    db.collection('users').doc(u.uid).onSnapshot(doc=>{
      const coins = (doc.data() && doc.data().coins) || 0;
      const el = document.getElementById('coinCount');
      if(el) el.textContent = coins;
      const claim = document.getElementById('claimArea');
      const claimText = document.getElementById('claimText');
      if(claim){
        if(coins >= 100){
          claim.classList.remove('hidden');
          if(claimText) claimText.textContent = `You have ${coins} coins. Redeem 100 coins for a free gadget.`;
          document.getElementById('openClaim')?.addEventListener('click', ()=>{
            document.getElementById('claimModal')?.classList.remove('hidden');
          });
        } else {
          claim.classList.add('hidden');
        }
      }
    });

    // claim modal
    document.getElementById('claimCancel')?.addEventListener('click', ()=>{
      document.getElementById('claimModal')?.classList.add('hidden');
      const s = document.getElementById('claimStatus'); if(s) s.textContent = '';
    });
    document.getElementById('claimSubmit')?.addEventListener('click', submitClaimHandler);
  });
}

/* CLAIM (standalone page) */
function initClaim(){
  auth.onAuthStateChanged(u=>{
    if(!u){ alert('Please login first'); location.href='index.html'; return; }
    document.getElementById('claimSubmit')?.addEventListener('click', submitClaimHandler);
  });
}

/* Claim handler (modal or page) */
async function submitClaimHandler(){
  const name = (document.getElementById('claimName')||document.getElementById('claimNamePage'))?.value?.trim();
  const address = (document.getElementById('claimAddress')||document.getElementById('claimAddressPage'))?.value?.trim();
  const email = (document.getElementById('claimEmail')||document.getElementById('claimEmailPage'))?.value?.trim();
  const statusEl = document.getElementById('claimStatus') || document.getElementById('claimResult');

  if(!name || !address || !email){ alert('Please fill all fields'); return; }
  const user = auth.currentUser; if(!user){ alert('Login required'); location.href='index.html'; return; }

  if(statusEl) statusEl.textContent = 'Submitting...';

  try{
    // Deduct 100 coins transactionally (client-side)
    const userRef = db.collection('users').doc(user.uid);
    await db.runTransaction(async t=>{
      const snap = await t.get(userRef);
      const coins = (snap.data() && snap.data().coins) || 0;
      if(coins < 100) throw new Error('Insufficient coins');
      t.update(userRef, { coins: coins - 100, updatedAt: new Date() });
    });

    // get selected pet
    const s = await db.collection('users').doc(user.uid).get();
    const pet = (s.data() && s.data().selectedPet) || '';

    // Send to Google Sheet
    const payload = { userUid:user.uid, userEmail:email, pet, offerTitle:'Redeem 100 coins', name, address, claimedAt: nowIso() };
    const res = await fetch(SHEETS_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    let ok = res.ok, j=null; try{ j = await res.json(); }catch(e){}
    if(ok || (j && j.result==='success')){
      if(statusEl) statusEl.textContent = 'Claim saved. Item will arrive in 1–2 weeks.';
      const modal = document.getElementById('claimModal'); if(modal) setTimeout(()=>modal.classList.add('hidden'), 1500);
    } else {
      if(statusEl) statusEl.textContent = 'Error saving claim.';
    }
  }catch(e){
    if(statusEl) statusEl.textContent = 'Error: ' + (e.message || e);
  }
}

/* ---------- 7) ROUTER ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  if(isIndex())     return initIndex();
  if(isSelectPet()) return initSelect();
  if(isQuiz())      return initQuiz();
  if(isOffers())    return initOffers();
  if(isClaim())     return initClaim();
});
