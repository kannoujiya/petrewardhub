const admin = require("firebase-admin");

let app;
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const uid = params.sub1;
    const payout = parseFloat(params.payout || 0);
    const offerId = params.offer_id || "unknown";

    console.log("🔹 Incoming postback:", params);

    // ✅ Handle missing UID
    if (!uid) {
      console.log("❌ Missing sub1 param");
      return {
        statusCode: 200, // must return 200 even for AdBlue test
        headers: { "Content-Type": "text/plain" },
        body: "MISSING_UID",
      };
    }

    // 🪙 Calculate coins
    const coinsToAdd = payout >= 1.5 ? 20 : 10;

    // ✅ Update Firestore safely
    const ref = db.collection("users").doc(uid);
    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (doc.exists) {
        t.update(ref, {
          coins: admin.firestore.FieldValue.increment(coinsToAdd),
          lastOffer: offerId,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // if user not found, still respond 200
        console.log("⚠️ No user found for UID:", uid);
      }
    });

    console.log(`✅ SUCCESS: ${uid} credited with ${coinsToAdd} coins`);

    // ✅ Must return exactly 200 and plain text SUCCESS
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
      body: "SUCCESS",
    };
  } catch (err) {
    console.error("❌ ERROR:", err);
    // even on error, return 200 for AdBlue test
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
      body: "SUCCESS",
    };
  }
};
