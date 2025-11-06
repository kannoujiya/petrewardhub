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

// Google Sheet webhook (Apps Script “Web App” URL)
const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

/* ---------- 2) INIT (single) ---------- */
if (!window.firebase) {
  console.error("Firebase SDK missing. Add compat SDKs in <head> before app.js");
}
try { if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG); } catch(e){}
const auth = firebase.auth();
const db   = firebase.firestore();

/* ---------- 3) HELPERS ---------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const path = () => (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const isIndex     = () => /(^$|index\.html$)/.test(path());
const isSelectPet = () => path()==='select-pet.html';
const isQuiz      = () => path()==='quiz.html';
const isOffers    = () => path()==='offers.html';
const isClaim     = () => path()==='claim.html';

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
  try{ const u = new URL(urlStr); u.searchParams.set("sub1", uid); return u.toString(); }
  catch(e){ return urlStr+(urlStr.includes("?")?"&":"?")+"sub1="+encodeURIComponent(uid); }
}

/* ---------- 4) INDEX (Login/Signup) ---------- */
function initIndex(){
  const emailIn = $('#email');
  const passIn  = $('#password');
  const status  = $('#authStatus');
  const S = (t,c)=>{ if(status){ status.textContent=t; status.style.color=c||'#333'; } };

  $('#loginBtn')?.addEventListener('click', async ()=>{
    try{
      await auth.signInWithEmailAndPassword(emailIn.value.trim(), passIn.value.trim());
      S('Login successful! Redirecting…','green');
      setTimeout(()=>location.href='select-pet.html', 800);
    }catch(e){ S(e.message,'red'); }
  });

  $('#signupBtn')?.addEventListener('click', async ()=>{
    try{
      const res = await auth.createUserWithEmailAndPassword(emailIn.value.trim(), passIn.value.trim());
      await db.collection('users').doc(res.user.uid).set({
        email: res.user.email||'',
        coins: 0,
        createdAt: new Date()
      }, { merge:true });
      S('Signup successful! Redirecting…','green');
      setTimeout(()=>location.href='select-pet.html', 800);
    }catch(e){ S(e.message,'red'); }
  });

  $('#googleSignIn')?.addEventListener('click', async ()=>{
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      const r = await auth.signInWithPopup(provider);
      await db.collection('users').doc(r.user.uid).set({
        email: r.user.email||'',
        name: r.user.displayName||'',
        updatedAt: new Date()
      }, { merge:true });
      S('Google login successful! Redirecting…','green');
      setTimeout(()=>location.href='select-pet.html', 800);
    }catch(e){ S(e.message,'red'); }
  });

  // Already logged in? jump ahead
  auth.onAuthStateChanged(u=>{ if(u) setTimeout(()=>location.href='select-pet.html', 600); });
}

/* ---------- 5) SELECT PET ---------- */
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
        await db.collection('users').doc(u.uid).set({ selectedPet:p, updatedAt:new Date() }, { merge:true });
        location.href='quiz.html';
      };
      grid.appendChild(el);
    });
  });
}

/* ---------- 6) QUIZ (5 Q one-per-page) ---------- */
function initQuiz(){
  auth.onAuthStateChanged(async u=>{
    if(!u){ alert('Please login first'); location.href='index.html'; return; }
    const snap = await db.collection('users').doc(u.uid).get();
    const pet  = (snap.data() && snap.data().selectedPet) || 'Dog';
    const bank = QUIZ_BANK[pet] || QUIZ_BANK.Dog;
    const box  = $('#quizBox') || $('#questionBox') || $('#question_box'); // support old ids
    const title= $('#quizTitle') || $('#quizHero');
    if(title) title.textContent = `Quiz for ${pet}`;
    let i=0, answers=[];
    function render(){
      const q = bank[i];
      box.innerHTML = `<div class="card"><div style="font-weight:700;margin-bottom:10px">${q.q}</div></div>`;
      q.a.forEach(opt=>{
        const b = document.createElement('div');
        b.className = 'petCard'; b.style.cursor='pointer'; b.style.marginTop='8px'; b.textContent = opt;
        b.onclick = ()=>{ answers[i]=opt; if(i<bank.length-1){ i++; render(); } else finish(); };
        box.appendChild(b);
      });
      const p = document.createElement('div'); p.className='muted small'; p.style.marginTop='6px'; p.textContent=`Question ${i+1} of ${bank.length}`;
      box.appendChild(p);
    }
    async function finish(){
      await db.collection('users').doc(u.uid).set({ quizAnswers:answers, updatedAt:new Date() }, { merge:true });
      location.href='offers.html';
    }
    render();
  });
}

/* ---------- 7) OFFERS (AdBlue JSONP + sub1) ---------- */
function initOffers(){
  auth.onAuthStateChanged(u=>{
    if(!u){ alert('Please login first'); location.href='index.html'; return; }
    const emailEl = $('#userEmail'); if(emailEl) emailEl.textContent = u.email||u.uid;

    // Live coin listener
    db.collection('users').doc(u.uid).onSnapshot(doc=>{
      const coins = (doc.data() && doc.data().coins) || 0;
      const el = $('#coinCount'); if(el) el.textContent = coins;
      const claim = $('#claimArea'); const text = $('#claimText');
      if(claim){
        if(coins>=100){ claim.classList.remove('hidden'); if(text) text.textContent=`You have ${coins} coins. Redeem 100 coins for a free gadget.`; }
        else claim.classList.add('hidden');
      }
    });

    // Process anchors created by your existing JSONP feed
    function processLinks(){
      const anchors = Array.from(document.querySelectorAll('#offerContainer a, a.offer-link'));
      anchors.forEach(a=>{
        const href = a.getAttribute('href') || '#';
        a.setAttribute('target','_blank');
        a.setAttribute('rel','noopener');
        a.addEventListener('click', (e)=>{
          e.preventDefault();
          window.open(addSub1(href, u.uid), '_blank');
        }, { once:true });
        // Try to show estimated coins (if conversion text visible near link)
        const card = a.closest('div');
        const convEl = card?.querySelector('.meta, .text-sm, [data-conv]');
        const conv = convEl ? convEl.textContent : '';
        const est  = estimateCoins(conv);
        if(card && !card.querySelector('.est-badge')){
          const b = document.createElement('div');
          b.className='est-badge muted small'; b.style.marginTop='4px'; b.textContent = `Est. ${est} coins (after confirmation)`;
          card.appendChild(b);
        }
      });
    }

    // Wait up to 5s for JSONP to inject offers, then post-process
    let tries=0; const timer=setInterval(()=>{
      tries++;
      const done = document.querySelector('#offerContainer a');
      if(done || tries>25){ clearInterval(timer); processLinks(); }
    }, 200);

    // Claim modal (if your offers.html has it)
    $('#openClaim')?.addEventListener('click', ()=> $('#claimModal')?.classList.remove('hidden'));
    $('#claimCancel')?.addEventListener('click', ()=> { $('#claimModal')?.classList.add('hidden'); const s=$('#claimStatus'); if(s) s.textContent=''; });
    $('#claimSubmit')?.addEventListener('click', submitClaim);
  });
}

/* ---------- 8) CLAIM ---------- */
async function submitClaim(){
  const name = $('#claimName')?.value?.trim();
  const addr = $('#claimAddress')?.value?.trim();
  const email= $('#claimEmail')?.value?.trim();
  const status = $('#claimStatus');
  if(!name||!addr||!email) return alert('Please fill all fields');
  const u = auth.currentUser; if(!u){ alert('Login required'); location.href='index.html'; return; }

  if(status) status.textContent = 'Submitting...';

  try{
    // Deduct 100 coins atomically
    const ref = db.collection('users').doc(u.uid);
    await db.runTransaction(async t=>{
      const s = await t.get(ref);
      const coins = (s.data() && s.data().coins) || 0;
      if(coins < 100) throw new Error('Insufficient coins');
      t.update(ref, { coins: coins-100, updatedAt:new Date() });
    });

    // read selected pet
    const s = await db.collection('users').doc(u.uid).get();
    const pet = (s.data() && s.data().selectedPet) || '';

    const payload = { userUid:u.uid, userEmail:email, pet, offerTitle:'Redeem 100 coins', name, address:addr, claimedAt:new Date().toISOString() };
    const res = await fetch(SHEETS_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    let ok = res.ok, j=null; try{ j = await res.json(); }catch(e){}
    if(ok || (j && j.result==='success')){
      if(status) status.textContent = 'Claim saved. Item will arrive in 1–2 weeks.';
      setTimeout(()=>$('#claimModal')?.classList.add('hidden'), 1500);
    } else {
      if(status) status.textContent = 'Error saving claim.';
    }
  }catch(e){
    if(status) status.textContent = 'Error: '+(e.message||e);
  }
}

/* ---------- 9) ROUTER ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  if(isIndex())     return initIndex();
  if(isSelectPet()) return initSelect();
  if(isQuiz())      return initQuiz();
  if(isOffers())    return initOffers();
  if(isClaim())     return; // claim page binds inline or through modal
});
