// Netlify Function: postback.js
// Purpose: handle AdBlue Media postback confirmations and increment Firestore coins
// Env: FIREBASE_SERVICE_ACCOUNT must contain stringified Firebase service account JSON
// URL example AdBlue should call:
// https://YOUR_SITE.netlify.app/.netlify/functions/postback?sub1={sub1}&payout={payout}&offer_id={offer_id}

const admin = require("firebase-admin");

let appInitialized = false;
function init() {
  if (appInitialized) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT env var");
  const serviceAccount = JSON.parse(svc);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  appInitialized = true;
}

exports.handler = async (event) => {
  try {
    init();
    const qs = event.queryStringParameters || {};
    const uid = qs.sub1 || qs.s1 || null;
    const payout = parseFloat(qs.payout || 0);
    const offerId = qs.offer_id || "unknown";

    if (!uid) return { statusCode: 400, body: "Missing sub1 (user ID)" };

    // Map payout or offer type to coins; fallback 10
    const coinsToAdd = payout > 0 ? Math.round(payout * 10) : 10;

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const logRef = db.collection("conversion_logs").doc();

    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      if (!doc.exists) {
        t.set(userRef, { coins: coinsToAdd, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        t.update(userRef, {
          coins: admin.firestore.FieldValue.increment(coinsToAdd),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      t.set(logRef, {
        userUid: uid,
        offerId,
        payout,
        coinsAdded: coinsToAdd,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Postback error:", err);
    return { statusCode: 500, body: "Server error" };
  }
};
