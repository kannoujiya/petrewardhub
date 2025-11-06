/* =========================================================
   PetRewardHub — Fixed Authentication & Firebase Issues
========================================================= */

// Firebase configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
    authDomain: "petrewardhub.firebaseapp.com",
    projectId: "petrewardhub",
    storageBucket: "petrewardhub.firebasestorage.app",
    messagingSenderId: "1087250543825",
    appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};

const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

// Global variables
let auth = null;
let db = null;

/* ---------- FIREBASE INITIALIZATION ---------- */
function initializeFirebase() {
    console.log("🔄 Initializing Firebase...");
    
    try {
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.error("❌ Firebase SDK not loaded");
            return false;
        }

        // Initialize Firebase app
        let app;
        if (!firebase.apps.length) {
            app = firebase.initializeApp(FIREBASE_CONFIG);
            console.log("✅ Firebase App initialized");
        } else {
            app = firebase.app();
            console.log("✅ Firebase App already initialized");
        }

        // Initialize services
        auth = firebase.auth();
        db = firebase.firestore();
        
        console.log("✅ Firebase Auth & Firestore initialized");
        return true;
        
    } catch (error) {
        console.error("❌ Firebase initialization failed:", error);
        return false;
    }
}

// Initialize Firebase immediately when script loads
initializeFirebase();

/* ---------- HELPER FUNCTIONS ---------- */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function getCurrentPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path.toLowerCase();
}

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
    }
}

function hideError(element) {
    if (element) {
        element.textContent = '';
        element.classList.add('hidden');
    }
}

function showLoading(button) {
    const loading = button.querySelector('.loading');
    if (loading) loading.classList.add('active');
    button.disabled = true;
}

function hideLoading(button) {
    const loading = button.querySelector('.loading');
    if (loading) loading.classList.remove('active');
    button.disabled = false;
}

/* ---------- AUTHENTICATION FUNCTIONS ---------- */
async function waitForAuth() {
    return new Promise((resolve) => {
        if (!auth) {
            console.error("Auth not available");
            resolve(null);
            return;
        }

        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

async function signUpUser(email, password, name) {
    console.log("🔄 Starting signup process...");
    
    if (!auth) {
        throw new Error("Authentication service not initialized. Please refresh the page.");
    }

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log("✅ User created:", user.uid);

        // Save user data to Firestore
        if (db) {
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                name: name || '',
                coins: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("✅ User data saved to Firestore");
        }

        return user;
        
    } catch (error) {
        console.error("❌ Signup error:", error);
        throw error;
    }
}

async function loginUser(email, password) {
    console.log("🔄 Starting login process...");
    
    if (!auth) {
        throw new Error("Authentication service not initialized. Please refresh the page.");
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log("✅ Login successful:", userCredential.user.email);
        return userCredential.user;
    } catch (error) {
        console.error("❌ Login error:", error);
        throw error;
    }
}

/* ---------- PAGE INITIALIZERS ---------- */
async function initIndexPage() {
    console.log("🏠 Initializing index page...");
    
    const user = await waitForAuth();
    if (user) {
        console.log("👤 User already logged in, redirecting...");
        setTimeout(() => {
            window.location.href = 'select-pet.html';
        }, 1000);
        return;
    }

    // Setup login form
    const loginForm = $('#loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = $('#loginEmail').value.trim();
            const password = $('#loginPassword').value.trim();
            const errorEl = $('#loginError');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            // Validation
            if (!email || !password) {
                showError(errorEl, 'Please fill in all fields');
                return;
            }

            showLoading(submitBtn);
            hideError(errorEl);

            try {
                await loginUser(email, password);
                hideError(errorEl);
                closeLoginModal();
                
                // Show success message
                alert('✅ Login successful! Redirecting...');
                
                setTimeout(() => {
                    window.location.href = 'select-pet.html';
                }, 1500);
                
            } catch (error) {
                showError(errorEl, error.message);
            } finally {
                hideLoading(submitBtn);
            }
        });
    }

    console.log("✅ Index page initialized");
}

async function initSignupPage() {
    console.log("📝 Initializing signup page...");
    
    const user = await waitForAuth();
    if (user) {
        console.log("👤 User already logged in, redirecting...");
        window.location.href = 'select-pet.html';
        return;
    }

    const signupForm = $('#signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = $('#signupEmail').value.trim();
            const password = $('#signupPassword').value.trim();
            const name = $('#signupName').value.trim();
            const errorEl = $('#signupError');
            const submitBtn = signupForm.querySelector('button[type="submit"]');

            // Validation
            if (!email || !password) {
                showError(errorEl, 'Please fill in all fields');
                return;
            }

            if (password.length < 6) {
                showError(errorEl, 'Password must be at least 6 characters long');
                return;
            }

            showLoading(submitBtn);
            hideError(errorEl);

            try {
                await signUpUser(email, password, name);
                hideError(errorEl);
                
                // Show success message
                alert('🎉 Signup successful! Redirecting to pet selection...');
                
                setTimeout(() => {
                    window.location.href = 'select-pet.html';
                }, 2000);
                
            } catch (error) {
                let errorMessage = error.message;
                
                // User-friendly error messages
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'This email is already registered. Please login instead.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Please enter a valid email address.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'Password is too weak. Please use a stronger password.';
                }
                
                showError(errorEl, errorMessage);
            } finally {
                hideLoading(submitBtn);
            }
        });
    }

    console.log("✅ Signup page initialized");
}

async function initSelectPetPage() {
    console.log("🐾 Initializing select pet page...");
    
    const user = await waitForAuth();
    if (!user) {
        alert('Please login first');
        window.location.href = 'index.html';
        return;
    }

    console.log("✅ Select pet page ready for user:", user.email);
}

async function initQuizPage() {
    console.log("❓ Initializing quiz page...");
    
    const user = await waitForAuth();
    if (!user) {
        alert('Please login first');
        window.location.href = 'index.html';
        return;
    }

    // Quiz logic here...
    console.log("✅ Quiz page ready for user:", user.email);
}

async function initOffersPage() {
    console.log("💰 Initializing offers page...");
    
    const user = await waitForAuth();
    if (!user) {
        alert('Please login first');
        window.location.href = 'index.html';
        return;
    }

    // Offers logic here...
    console.log("✅ Offers page ready for user:", user.email);
}

/* ---------- MODAL FUNCTIONS ---------- */
function openLoginModal() {
    const modal = $('#loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeLoginModal() {
    const modal = $('#loginModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        // Clear form
        const form = $('#loginForm');
        const errorEl = $('#loginError');
        if (form) form.reset();
        if (errorEl) hideError(errorEl);
    }
}

/* ---------- ROUTER ---------- */
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 DOM loaded, current page:", getCurrentPage());
    
    // Re-initialize Firebase to ensure it's ready
    if (!auth || !db) {
        console.log("🔄 Re-initializing Firebase...");
        initializeFirebase();
    }

    // Wait a moment for Firebase to fully initialize
    setTimeout(() => {
        const page = getCurrentPage();
        
        switch (page) {
            case 'index.html':
            case '':
                initIndexPage();
                break;
            case 'signup.html':
                initSignupPage();
                break;
            case 'select-pet.html':
                initSelectPetPage();
                break;
            case 'quiz.html':
                initQuizPage();
                break;
            case 'offers.html':
                initOffersPage();
                break;
            default:
                console.log("📄 Unknown page:", page);
        }
    }, 500);
});

// Global functions
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;

// Error boundary
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});