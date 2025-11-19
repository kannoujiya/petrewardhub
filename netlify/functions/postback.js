const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const initializeFirebaseAdmin = () => {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'petrewardhub'
      });
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
};

// Initialize Firebase Admin
initializeFirebaseAdmin();
const db = getFirestore();

exports.handler = async (event) => {
  // Log the incoming request
  console.log('Postback received:', {
    method: event.httpMethod,
    query: event.queryStringParameters,
    headers: event.headers
  });

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  // Parse query parameters
  const { sub1, payout, offer_id } = event.queryStringParameters;
  
  console.log('Postback parameters:', { sub1, payout, offer_id });

  // Validate required parameters
  if (!sub1) {
    console.error('Missing sub1 parameter');
    return {
      statusCode: 400,
      body: 'Missing sub1 parameter'
    };
  }

  if (!payout || isNaN(parseFloat(payout))) {
    console.error('Invalid payout parameter:', payout);
    return {
      statusCode: 400,
      body: 'Invalid payout parameter'
    };
  }

  // Calculate coins based on payout - Easy offers: 10 coins, Other offers: 20 coins
  const payoutValue = parseFloat(payout);
  const coinsToAdd = payoutValue < 1.5 ? 10 : 20;

  console.log('Coin calculation:', { payout: payoutValue, coinsToAdd });

  try {
    // First, check if user exists
    const userRef = db.collection('users').doc(sub1);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`User ${sub1} not found in Firestore`);
      return {
        statusCode: 404,
        body: `User ${sub1} not found`
      };
    }

    console.log('User found:', userDoc.data());

    // Check for duplicate postback (idempotency)
    const postbackId = `${offer_id || 'unknown'}_${sub1}`;
    const postbackRef = db.collection('postbacks').doc(postbackId);
    const postbackDoc = await postbackRef.get();

    if (postbackDoc.exists) {
      console.log('Duplicate postback detected, skipping:', postbackId);
      return {
        statusCode: 200,
        body: 'OK - Duplicate postback ignored'
      };
    }

    // Use transaction to ensure atomic update
    const result = await db.runTransaction(async (transaction) => {
      const currentUserDoc = await transaction.get(userRef);
      const currentCoins = currentUserDoc.data().coins || 0;
      
      console.log('Current coins:', currentCoins, 'Adding:', coinsToAdd);

      // Increment user coins
      transaction.update(userRef, {
        coins: currentCoins + coinsToAdd
      });

      // Log postback
      transaction.set(postbackRef, {
        uid: sub1,
        offer_id: offer_id || 'unknown',
        payout: payoutValue,
        coinsAdded: coinsToAdd,
        previousBalance: currentCoins,
        newBalance: currentCoins + coinsToAdd,
        processedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp()
      });

      return { 
        success: true, 
        coinsAdded: coinsToAdd,
        previousBalance: currentCoins,
        newBalance: currentCoins + coinsToAdd
      };
    });

    console.log('Postback processed successfully:', result);

    return {
      statusCode: 200,
      body: 'OK'
    };

  } catch (error) {
    console.error('Postback processing error:', error);
    
    return {
      statusCode: 500,
      body: `Error processing postback: ${error.message}`
    };
  }
};