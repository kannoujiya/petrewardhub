// firebase-init.js
// This ensures Firebase loads before any other scripts

console.log("🚀 Loading Firebase SDKs...");

// Firebase configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
    authDomain: "petrewardhub.firebaseapp.com",
    projectId: "petrewardhub",
    storageBucket: "petrewardhub.firebasestorage.app",
    messagingSenderId: "1087250543825",
    appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};

// Initialize Firebase immediately when SDKs are loaded
function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error("❌ Firebase SDK not loaded yet");
            return false;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
            console.log("✅ Firebase initialized successfully");
        } else {
            console.log("✅ Firebase already initialized");
        }
        
        return true;
    } catch (error) {
        console.error("❌ Firebase initialization error:", error);
        return false;
    }
}

// Wait for Firebase SDKs to load
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        const checkFirebase = setInterval(() => {
            attempts++;
            
            if (typeof firebase !== 'undefined') {
                clearInterval(checkFirebase);
                console.log("🔥 Firebase SDK loaded successfully");
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkFirebase);
                console.error("❌ Firebase SDK failed to load");
                reject(new Error("Firebase SDK failed to load within timeout"));
            }
        }, 100);
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log("📄 DOM loaded, initializing Firebase...");
    
    try {
        await waitForFirebase();
        const initialized = initializeFirebase();
        
        if (initialized) {
            console.log("🎉 Firebase ready to use!");
            // Fire custom event to let other scripts know Firebase is ready
            window.dispatchEvent(new Event('firebaseReady'));
        } else {
            throw new Error("Failed to initialize Firebase");
        }
    } catch (error) {
        console.error("🔥 Firebase initialization failed:", error);
        alert("Error: Unable to load authentication service. Please refresh the page.");
    }
});

// Also try to initialize immediately in case DOM is already loaded
if (document.readyState === 'loading') {
    console.log("📄 Document still loading, waiting...");
} else {
    console.log("📄 Document ready, initializing Firebase immediately...");
    waitForFirebase().then(() => initializeFirebase());
}