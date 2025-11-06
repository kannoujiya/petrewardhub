// app.js - Simplified version that works with firebase-init.js

const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec";

// Helper functions
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

// Authentication functions
async function signUpUser(email, password, name) {
    console.log("🔄 Starting signup...");
    
    if (!firebase.auth) {
        throw new Error("Authentication service not ready. Please wait...");
    }

    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log("✅ User created:", user.uid);

        // Save to Firestore
        if (firebase.firestore) {
            await firebase.firestore().collection('users').doc(user.uid).set({
                email: user.email,
                name: name || '',
                coins: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("✅ User data saved");
        }

        return user;
    } catch (error) {
        console.error("❌ Signup error:", error);
        throw error;
    }
}

async function loginUser(email, password) {
    console.log("🔄 Starting login...");
    
    if (!firebase.auth) {
        throw new Error("Authentication service not ready. Please wait...");
    }

    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        console.log("✅ Login successful");
        return userCredential.user;
    } catch (error) {
        console.error("❌ Login error:", error);
        throw error;
    }
}

// Page initializers
async function initSignupPage() {
    console.log("📝 Initializing signup page...");
    
    const signupForm = $('#signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = $('#signupEmail').value.trim();
            const password = $('#signupPassword').value.trim();
            const name = $('#signupName').value.trim();
            const errorEl = $('#signupError');
            const submitBtn = signupForm.querySelector('button[type="submit"]');

            if (!email || !password) {
                showError(errorEl, 'Please fill in all fields');
                return;
            }

            if (password.length < 6) {
                showError(errorEl, 'Password must be at least 6 characters');
                return;
            }

            showLoading(submitBtn);
            hideError(errorEl);

            try {
                await signUpUser(email, password, name);
                hideError(errorEl);
                
                alert('🎉 Signup successful! Redirecting...');
                setTimeout(() => {
                    window.location.href = 'select-pet.html';
                }, 2000);
                
            } catch (error) {
                let errorMessage = error.message;
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Email already registered. Please login instead.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Please enter a valid email address.';
                }
                showError(errorEl, errorMessage);
            } finally {
                hideLoading(submitBtn);
            }
        });
    }
}

async function initIndexPage() {
    console.log("🏠 Initializing index page...");
    
    const loginForm = $('#loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = $('#loginEmail').value.trim();
            const password = $('#loginPassword').value.trim();
            const errorEl = $('#loginError');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

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
}

// Wait for Firebase to be ready, then initialize page
window.addEventListener('firebaseReady', function() {
    console.log("🎉 Firebase is ready! Initializing page...");
    
    const page = getCurrentPage();
    console.log("📄 Current page:", page);
    
    switch (page) {
        case 'index.html':
        case '':
            initIndexPage();
            break;
        case 'signup.html':
            initSignupPage();
            break;
        case 'select-pet.html':
            // Will be handled by inline script
            break;
        default:
            console.log("📄 Page handler not implemented:", page);
    }
});

// If Firebase is already ready when we load
if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
    console.log("🔥 Firebase already ready!");
    window.dispatchEvent(new Event('firebaseReady'));
}