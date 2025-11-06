/* =========================================================
   PetRewardHub — Fixed app.js with working authentication
========================================================= */

/* ---------- 1) FIREBASE CONFIG ---------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
  authDomain: "petrewardhub.firebaseapp.com",
  projectId: "petrewardhub",
  storageBucket: "petrewardhub.firebasestorage.app",
  messagingSenderId: "1087250543825",
  appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};

const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

/* ---------- 2) FIREBASE INITIALIZATION ---------- */
let auth, db;

function initializeFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.error("Firebase SDK not loaded");
      return false;
    }
    
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    
    console.log("Firebase initialized successfully");
    return true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return false;
  }
}

// Initialize immediately
initializeFirebase();

/* ---------- 3) HELPER FUNCTIONS ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const path = () => (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const isIndex = () => /(^$|index\.html$)/.test(path());
const isSelectPet = () => path() === 'select-pet.html';
const isQuiz = () => path() === 'quiz.html';
const isOffers = () => path() === 'offers.html';
const isClaim = () => path() === 'claim.html';
const isSignup = () => path() === 'signup.html';

const PETS = ["Dog", "Cat", "Bird", "Rabbit", "Small Mammal", "Reptile", "Fish", "Ferret", "Horse"];

const QUIZ_BANK = {
  Dog: [
    { q: "What size is your dog?", a: ["Small (under 20 lbs)", "Medium (20–50 lbs)", "Large (50+ lbs)"] },
    { q: "Food sensitivities?", a: ["Yes", "No"] },
    { q: "Activity level?", a: ["Low", "Moderate", "High"] },
    { q: "Enjoys chew toys?", a: ["Yes", "Sometimes", "No"] },
    { q: "Use GPS/camera gadget?", a: ["Yes", "Maybe", "No"] }
  ],
  Cat: [
    { q: "Indoor or outdoor?", a: ["Indoor", "Outdoor", "Both"] },
    { q: "Age group?", a: ["Kitten", "Adult", "Senior"] },
    { q: "Likes to climb?", a: ["Yes", "No"] },
    { q: "Food preference?", a: ["Wet", "Dry", "Both"] },
    { q: "Use cat toys?", a: ["Often", "Sometimes", "Never"] }
  ]
};

/* ---------- 4) AUTHENTICATION FUNCTIONS ---------- */
function checkAuthState() {
  return new Promise((resolve) => {
    if (!auth) {
      console.error("Auth not initialized");
      resolve(null);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      console.log("Auth state changed:", user ? user.email : "No user");
      resolve(user);
    }, (error) => {
      console.error("Auth state error:", error);
      resolve(null);
    });
  });
}

async function handleSignup(email, password, name) {
  try {
    console.log("Starting signup for:", email);
    
    if (!auth) {
      throw new Error("Authentication service not available");
    }

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    console.log("User created:", user.uid);

    // Save user data to Firestore
    if (db) {
      await db.collection('users').doc(user.uid).set({
        email: user.email,
        name: name || '',
        coins: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("User data saved to Firestore");
    }

    return { success: true, user };
  } catch (error) {
    console.error("Signup error:", error);
    return { success: false, error: error.message };
  }
}

async function handleLogin(email, password) {
  try {
    console.log("Attempting login for:", email);
    
    if (!auth) {
      throw new Error("Authentication service not available");
    }

    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    console.log("Login successful:", userCredential.user.email);
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: error.message };
  }
}

/* ---------- 5) PAGE INITIALIZERS ---------- */
async function initIndex() {
  console.log("Initializing index page");
  
  const user = await checkAuthState();
  if (user) {
    console.log("User already logged in, redirecting to select-pet");
    setTimeout(() => {
      window.location.href = 'select-pet.html';
    }, 500);
    return;
  }

  // Login form handler
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log("Login form submitted");
      
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value.trim();
      const errorEl = $('#loginError');

      if (!email || !password) {
        if (errorEl) {
          errorEl.textContent = 'Please fill all fields';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      const result = await handleLogin(email, password);
      
      if (result.success) {
        if (errorEl) errorEl.classList.add('hidden');
        closeLoginModal();
        setTimeout(() => {
          window.location.href = 'select-pet.html';
        }, 1000);
      } else {
        if (errorEl) {
          errorEl.textContent = result.error;
          errorEl.classList.remove('hidden');
        }
      }
    });
  }
}

async function initSignup() {
  console.log("Initializing signup page");
  
  const user = await checkAuthState();
  if (user) {
    console.log("User already logged in, redirecting to select-pet");
    window.location.href = 'select-pet.html';
    return;
  }

  const signupForm = $('#signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log("Signup form submitted");
      
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

      if (password.length < 6) {
        if (errorEl) {
          errorEl.textContent = 'Password must be at least 6 characters';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      const result = await handleSignup(email, password, name);
      
      if (result.success) {
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.classList.add('hidden');
        }
        alert('🎉 Signup successful! Redirecting...');
        setTimeout(() => {
          window.location.href = 'select-pet.html';
        }, 1500);
      } else {
        if (errorEl) {
          errorEl.textContent = result.error;
          errorEl.classList.remove('hidden');
        }
      }
    });
  }
}

async function initSelect() {
  console.log("Initializing select pet page");
  
  const user = await checkAuthState();
  if (!user) {
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }

  console.log("User authenticated, showing pet selection");
}

async function initQuiz() {
  console.log("Initializing quiz page");
  
  const user = await checkAuthState();
  if (!user) {
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const pet = userDoc.data()?.selectedPet || 'Dog';
    const bank = QUIZ_BANK[pet] || QUIZ_BANK.Dog;
    const box = $('#questionBox');
    const title = $('#quizTitle');
    
    if (title) title.textContent = `Quiz for ${pet}`;
    
    let currentQuestion = 0;
    let answers = [];

    function renderQuestion() {
      const question = bank[currentQuestion];
      box.innerHTML = `
        <div class="mb-6">
          <div class="text-xl font-bold text-slate-800 mb-4">${question.q}</div>
          <div class="space-y-3">
            ${question.a.map(option => `
              <div class="petCard cursor-pointer p-4 text-center hover:bg-blue-50 transition-colors border border-gray-200 rounded-xl" 
                   onclick="selectAnswer('${option}')">
                ${option}
              </div>
            `).join('')}
          </div>
          <div class="text-sm text-slate-500 mt-4 text-center">
            Question ${currentQuestion + 1} of ${bank.length}
          </div>
        </div>
      `;
    }

    window.selectAnswer = (answer) => {
      answers[currentQuestion] = answer;
      
      if (currentQuestion < bank.length - 1) {
        currentQuestion++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    };

    async function finishQuiz() {
      try {
        await db.collection('users').doc(user.uid).set({
          quizAnswers: answers,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        window.location.href = 'offers.html';
      } catch (error) {
        console.error('Error saving quiz:', error);
        alert('Error saving quiz answers. Please try again.');
      }
    }

    renderQuestion();
  } catch (error) {
    console.error('Quiz initialization error:', error);
    alert('Error loading quiz. Please try again.');
  }
}

async function initOffers() {
  console.log("Initializing offers page");
  
  const user = await checkAuthState();
  if (!user) {
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }

  const emailEl = $('#userEmail');
  if (emailEl) emailEl.textContent = user.email;

  // Coin listener
  if (db) {
    db.collection('users').doc(user.uid).onSnapshot((doc) => {
      const coins = doc.data()?.coins || 0;
      const coinEl = $('#coinCount');
      if (coinEl) coinEl.textContent = coins;
      
      const claimArea = $('#claimArea');
      const claimText = $('#claimText');
      if (claimArea && claimText) {
        if (coins >= 100) {
          claimArea.classList.remove('hidden');
          claimText.textContent = `You have ${coins} coins. Redeem 100 coins for a free gadget.`;
        } else {
          claimArea.classList.add('hidden');
        }
      }
    });
  }

  // Claim modal handlers
  $('#openClaim')?.addEventListener('click', () => {
    $('#claimModal')?.classList.remove('hidden');
  });
  
  $('#claimCancel')?.addEventListener('click', () => {
    $('#claimModal')?.classList.add('hidden');
    const status = $('#claimStatus');
    if (status) status.textContent = '';
  });
  
  $('#claimSubmit')?.addEventListener('click', submitClaim);
}

/* ---------- 6) CLAIM FUNCTION ---------- */
async function submitClaim() {
  const name = $('#claimName')?.value?.trim();
  const address = $('#claimAddress')?.value?.trim();
  const email = $('#claimEmail')?.value?.trim();
  const statusEl = $('#claimStatus');

  if (!name || !address || !email) {
    alert('Please fill all fields');
    return;
  }

  const user = await checkAuthState();
  if (!user) {
    alert('Login required');
    window.location.href = 'index.html';
    return;
  }

  if (statusEl) statusEl.textContent = 'Submitting...';

  try {
    // Deduct coins
    const userRef = db.collection('users').doc(user.uid);
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      const coins = doc.data()?.coins || 0;
      
      if (coins < 100) {
        throw new Error('Insufficient coins');
      }
      
      transaction.update(userRef, {
        coins: coins - 100,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // Get pet info
    const userDoc = await userRef.get();
    const pet = userDoc.data()?.selectedPet || '';

    // Submit to Google Sheets
    const payload = {
      userUid: user.uid,
      userEmail: email,
      pet: pet,
      offerTitle: 'Redeem 100 coins',
      name: name,
      address: address,
      claimedAt: new Date().toISOString()
    };

    const response = await fetch(SHEETS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      if (statusEl) statusEl.textContent = '✅ Claim submitted! Item will arrive in 1-2 weeks.';
      setTimeout(() => {
        $('#claimModal')?.classList.add('hidden');
      }, 3000);
    } else {
      throw new Error('Failed to submit claim');
    }
  } catch (error) {
    console.error('Claim error:', error);
    if (statusEl) statusEl.textContent = `Error: ${error.message}`;
  }
}

/* ---------- 7) ROUTER ---------- */
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing page:", path());
  
  // Wait a bit for Firebase to initialize
  setTimeout(() => {
    if (isIndex()) {
      initIndex();
    } else if (isSignup()) {
      initSignup();
    } else if (isSelectPet()) {
      initSelect();
    } else if (isQuiz()) {
      initQuiz();
    } else if (isOffers()) {
      initOffers();
    }
  }, 100);
});

/* ---------- 8) GLOBAL MODAL FUNCTIONS ---------- */
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');
    if (form) form.reset();
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }
}

// Utility functions for product modals
function openProductModal(productId) {
  console.log('Opening product modal:', productId);
}

function closeProductModal() {
  console.log('Closing product modal');
}

function showImagePreview(element, imageSrc) {
  console.log('Showing image preview:', imageSrc);
}

function closeImagePreview() {
  console.log('Closing image preview');
}

function startEarning() {
  window.location.href = 'select-pet.html';
}

// Close modals on outside click
document.addEventListener('click', function(e) {
  const modals = ['loginModal', 'productModal', 'imagePreview', 'claimModal'];
  modals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal && e.target === modal) {
      if (modalId === 'loginModal') closeLoginModal();
      if (modalId === 'productModal') closeProductModal();
      if (modalId === 'imagePreview') closeImagePreview();
      if (modalId === 'claimModal') $('#claimModal')?.classList.add('hidden');
    }
  });
});

// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeLoginModal();
    closeProductModal();
    closeImagePreview();
    $('#claimModal')?.classList.add('hidden');
  }
});