// =========================
// 🐾 PetRewardHub — FINAL FIXED AUTH VERSION
// =========================

function qs(s, r=document){return r.querySelector(s);}
function qsa(s, r=document){return Array.from(r.querySelectorAll(s));}

// --------------------------
// 🔐 Firebase Auth Guard (Final Stable)
// --------------------------
async function guardAuthOrRedirect(redirectUrl) {
  let user = auth.currentUser;

  // Wait for Firebase to finish initializing auth state
  if (!user) {
    user = await new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(u => {
        unsub();
        resolve(u);
      });
      // fallback timeout
      setTimeout(() => resolve(null), 2500);
    });
  }

  if (!user) {
    console.log("🚫 No user, redirecting to homepage...");
    window.location.replace(redirectUrl);
  } else {
    console.log("✅ Auth OK:", user.email);
  }
}

// --------------------------
// 🧩 LOGIN FIX (final)
// --------------------------
function setupLoginModal(){
  const loginBtn = qs('#loginBtn');
  const emailEl = qs('#loginEmail');
  const passEl = qs('#loginPass');
  const msg = qs('#loginMsg');
  const loginOverlay = qs('#loginOverlay');
  const openLoginBtn = qs('#openLoginBtn');
  const closeBtn = qs('#loginClose');

  const showOverlay = show => loginOverlay.style.display = show ? 'flex' : 'none';

  openLoginBtn?.addEventListener('click',()=>showOverlay(true));
  closeBtn?.addEventListener('click',()=>showOverlay(false));
  loginOverlay?.addEventListener('click',(e)=>{ if(e.target===loginOverlay) showOverlay(false); });

  loginBtn?.addEventListener('click', async ()=>{
    msg.textContent = '';
    const email = emailEl.value.trim();
    const pass = passEl.value.trim();
    if(!email || !pass){ msg.textContent = 'Please fill in both fields'; return; }

    try {
      console.log("🔐 Attempting Firebase login...");
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      console.log("✅ Credentials accepted for:", cred.user.email);

      // Wait for auth state persistence
      await new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(u => {
          if (u) { unsub(); resolve(u); }
        });
      });

      // Small delay to ensure persistence is written
      await new Promise(r => setTimeout(r, 400));

      console.log("🎯 Redirecting user to select-pet.html");
      window.location.href = "select-pet.html";

    } catch (e) {
      console.error("❌ Login error:", e);
      msg.textContent = e.message || 'Login failed. Try again.';
    }
  });
}

// --------------------------
// 🐶 PET SELECTION
// --------------------------
const PETS=[
  {key:'Dog',emoji:'🐶'},{key:'Cat',emoji:'🐱'},{key:'Bird',emoji:'🐦'},
  {key:'Rabbit',emoji:'🐰'},{key:'Fish',emoji:'🐠'},{key:'Horse',emoji:'🐴'},
  {key:'Ferret',emoji:'🦦'},{key:'Reptile',emoji:'🦎'},{key:'Small Mammal',emoji:'🐹'}
];

function renderPetGrid(){
  const grid = qs('#petGrid');
  if(!grid) return;
  grid.innerHTML = PETS.map(p=>`
    <article class="card pet" data-pet="${p.key}">
      <div class="card-body" style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:36px">${p.emoji}</div>
        <div><strong>${p.key}</strong><div class="caption">Select</div></div>
      </div>
    </article>`).join('');

  qsa('.pet').forEach(el=>{
    el.addEventListener('click', async ()=>{
      const pet = el.getAttribute('data-pet');
      console.log("🐾 Selected pet:", pet);

      const user = await new Promise(resolve=>{
        const existing = auth.currentUser;
        if(existing){ resolve(existing); return; }
        const unsub = auth.onAuthStateChanged(u=>{
          if(u){ unsub(); resolve(u); }
        });
        setTimeout(()=>resolve(null),2000);
      });

      if(!user){
        console.log("⚠️ No user found. Redirecting...");
        window.location.replace('index.html?loginOpen=true');
        return;
      }

      await db.collection('users').doc(user.uid).set({
        selectedPet: pet,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      console.log("✅ Pet saved, moving to quiz.html");
      window.location.href = "quiz.html";
    });
  });
}

// --------------------------
// 🎁 GIFTS ON FRONT PAGE
// --------------------------
const gifts=[
  {id:'toy',title:'Interactive Dog Toy',img:'https://images.unsplash.com/photo-1568572933382-74d440642117?q=80&w=800',uses:'Keeps your dog active and mentally engaged.'},
  {id:'bed',title:'Cozy Cat Bed',img:'https://images.unsplash.com/photo-1601758173928-194d1263ffcd?q=80&w=800',uses:'Soft and warm place for cats to nap peacefully.'},
  {id:'bowl',title:'Anti-Spill Pet Bowl',img:'https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?q=80&w=800',uses:'Prevents messy spills and keeps feeding area clean.'},
  {id:'feeder',title:'Automatic Pet Feeder',img:'https://images.unsplash.com/photo-1516222338250-863216ce01ea?q=80&w=800',uses:'Perfect feeding schedules even when you’re away.'}
];
function renderGifts(){
  const grid = qs('#giftGrid');
  if(!grid) return;
  grid.innerHTML = gifts.map(g=>`
    <article class="card" data-gift="${g.id}">
      <img src="${g.img}" alt="${g.title}" loading="lazy"/>
      <div class="card-body">
        <strong>${g.title}</strong>
        <div class="caption">Worth 100 coins</div>
      </div>
    </article>`).join('');
  qsa('[data-gift]').forEach(el=>el.addEventListener('click',()=>openGiftZoom(el.getAttribute('data-gift'))));
}

function openGiftZoom(id){
  const g = gifts.find(x=>x.id===id);
  const overlay = qs('#giftOverlay');
  const box = qs('#giftZoomContent');
  if(!g || !overlay || !box) return;

  box.innerHTML = `
    <img src="${g.img}" alt="${g.title}" style="width:100%;border-radius:12px"/>
    <h3>${g.title}</h3><p>${g.uses}</p>
    <button class="btn btn-primary" id="getGiftBtn">Get this Free Gift</button>
  `;
  overlay.style.display = 'flex';
  qs('#getGiftBtn').onclick = ()=> {
    if(!auth.currentUser){
      qs('#loginOverlay').style.display='flex';
    } else {
      window.location.href = 'offers.html';
    }
  };
}
qs('#giftClose')?.addEventListener('click',()=>qs('#giftOverlay').style.display='none');

// --------------------------
// 🚀 INIT
// --------------------------
document.addEventListener('DOMContentLoaded',()=>{
  if(qs('#giftGrid')) renderGifts();
  setupLoginModal();
});
