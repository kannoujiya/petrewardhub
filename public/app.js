// Global application state and utilities
class PetRewardHub {
  constructor() {
    this.currentUser = null;
    this.userData = null;
    this.coinUnsubscribe = null;
  }

  // Initialize auth state listener
  init() {
    auth.onAuthStateChanged(async (user) => {
      this.currentUser = user;
      if (user) {
        await this.loadUserData(user.uid);
        this.setupCoinListener(user.uid);
      } else {
        this.cleanupCoinListener();
        this.guardProtectedPages(); // Check if user is trying to access protected pages
      }
      this.updateUI();
    });
  }

  // Guard protected pages - redirect to index if not authenticated
  guardProtectedPages() {
    const currentPage = window.location.pathname.split('/').pop();
    const protectedPages = ['select-pet.html', 'quiz.html', 'offers.html', 'gifts.html', 'claim.html', 'thankyou.html'];
    
    if (protectedPages.includes(currentPage)) {
      window.location.href = 'index.html';
    }
  }

  // Load user data from Firestore
  async loadUserData(uid) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        this.userData = doc.data();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  // Setup real-time coin listener
  setupCoinListener(uid) {
    this.coinUnsubscribe = db.collection('users').doc(uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          this.userData = doc.data();
          this.updateCoinBadge();
          this.updateClaimButtons();
        }
      });
  }

  // Cleanup coin listener
  cleanupCoinListener() {
    if (this.coinUnsubscribe) {
      this.coinUnsubscribe();
      this.coinUnsubscribe = null;
    }
  }

  // Update UI based on auth state
  updateUI() {
    this.updateCoinBadge();
    this.updateAuthButtons();
    this.updateClaimButtons();
  }

  // Update coin badge in navbar
  updateCoinBadge() {
    const coinBadge = document.getElementById('coinBadge');
    if (coinBadge && this.userData) {
      coinBadge.textContent = this.userData.coins || 0;
    }
  }

  // Update auth buttons visibility
  updateAuthButtons() {
    const authButtons = document.getElementById('authButtons');
    const userNav = document.getElementById('userNav');
    
    if (authButtons && userNav) {
      if (this.currentUser) {
        authButtons.style.display = 'none';
        userNav.style.display = 'flex';
      } else {
        authButtons.style.display = 'flex';
        userNav.style.display = 'none';
      }
    }
  }

  // Update claim buttons based on coin balance
  updateClaimButtons() {
    const claimButtons = document.querySelectorAll('[data-claim-button]');
    claimButtons.forEach(button => {
      const requiredCoins = parseInt(button.getAttribute('data-coins-required')) || 100;
      if (this.userData && this.userData.coins >= requiredCoins) {
        button.disabled = false;
        button.textContent = button.getAttribute('data-enabled-text') || 'Claim Now';
      } else {
        button.disabled = true;
        button.textContent = button.getAttribute('data-disabled-text') || 'Need More Coins';
      }
    });
  }

  // Login handler
  async login(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      this.currentUser = userCredential.user;
      await this.loadUserData(this.currentUser.uid);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Signup handler with 25 coin bonus
  async signup(name, email, password) {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Create user document in Firestore with 25 coin signup bonus
      await db.collection('users').doc(user.uid).set({
        name: name,
        email: email,
        coins: 25, // 25 coin signup bonus
        selectedPet: null,
        quizDone: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      this.currentUser = user;
      await this.loadUserData(user.uid);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Logout handler
  async logout() {
    try {
      await auth.signOut();
      this.currentUser = null;
      this.userData = null;
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Check if user is authenticated and redirect if not
  requireAuth(redirectUrl = 'index.html') {
    return new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        unsubscribe();
        if (!user) {
          window.location.href = redirectUrl;
          reject(new Error('Not authenticated'));
          return;
        }
        this.currentUser = user;
        await this.loadUserData(user.uid);
        resolve(user);
      });
    });
  }

  // Save selected pet
  async saveSelectedPet(pet) {
    if (!this.currentUser) return false;
    
    try {
      await db.collection('users').doc(this.currentUser.uid).update({
        selectedPet: pet
      });
      await this.loadUserData(this.currentUser.uid); // Reload user data
      return true;
    } catch (error) {
      console.error('Error saving pet:', error);
      return false;
    }
  }

  // Mark quiz as complete
  async completeQuiz() {
    if (!this.currentUser) return false;
    
    try {
      await db.collection('users').doc(this.currentUser.uid).update({
        quizDone: true
      });
      await this.loadUserData(this.currentUser.uid); // Reload user data
      return true;
    } catch (error) {
      console.error('Error completing quiz:', error);
      return false;
    }
  }

  // Submit claim
  async submitClaim(giftData, formData) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const requiredCoins = giftData.coins || 100;
    
    try {
      // Use transaction to ensure atomic coin deduction
      const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(this.currentUser.uid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        if (userData.coins < requiredCoins) {
          throw new Error('Insufficient coins');
        }
        
        // Deduct coins
        transaction.update(userRef, {
          coins: firebase.firestore.FieldValue.increment(-requiredCoins)
        });
        
        // Create claim record
        const claimRef = db.collection('claims').doc();
        transaction.set(claimRef, {
          uid: this.currentUser.uid,
          giftId: giftData.id,
          giftName: giftData.name,
          name: formData.name,
          address: formData.address,
          email: formData.email,
          phone: formData.phone,
          coinsDeducted: requiredCoins,
          status: 'submitted',
          claimedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { claimId: claimRef.id };
      });
      
      // Submit to Google Sheets webhook
      await this.submitToGoogleSheets(formData, giftData);
      
      return { success: true, claimId: result.claimId };
    } catch (error) {
      console.error('Claim submission error:', error);
      return { success: false, error: error.message };
    }
  }

  // Submit claim to Google Sheets
  async submitToGoogleSheets(formData, giftData) {
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbzmGjBk_WcIDS9CADLRODmn6tFmyTYICki-uBfvM7sgTBTiksSdOwVnLjrSXxOI_CQUSg/exec';
    
    const payload = {
      name: formData.name,
      address: formData.address,
      email: formData.email,
      phone: formData.phone,
      gift: giftData.name,
      coins: giftData.coins,
      timestamp: new Date().toISOString(),
      userId: this.currentUser.uid
    };
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('Successfully submitted to Google Sheets');
    } catch (error) {
      console.error('Google Sheets webhook error:', error);
      // Don't throw error - Firestore transaction already succeeded
    }
  }
}

// Global app instance
const app = new PetRewardHub();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
  
  // Attach header auth for protected pages
  if (typeof attachHeaderAuth === 'function') {
    attachHeaderAuth();
  }
});

// Header auth setup for protected pages
function attachHeaderAuth() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => app.logout());
  }
}

// Modal management
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Close modal on outside click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('loginModal');
  if (e.target === modal) {
    closeLoginModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLoginModal();
  }
});

// Start user journey function
function startUserJourney() {
  if (app.currentUser) {
    // User is logged in, check if they completed previous steps
    if (!app.userData.selectedPet) {
      window.location.href = 'select-pet.html';
    } else if (!app.userData.quizDone) {
      window.location.href = 'quiz.html';
    } else {
      window.location.href = 'offers.html';
    }
  } else {
    // User not logged in, open login modal
    openLoginModal();
  }
}

// Redirect user to appropriate page after login
function redirectAfterLogin() {
  if (!app.userData.selectedPet) {
    window.location.href = 'select-pet.html';
  } else if (!app.userData.quizDone) {
    window.location.href = 'quiz.html';
  } else {
    window.location.href = 'offers.html';
  }
}