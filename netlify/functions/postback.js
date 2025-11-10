const admin = require("firebase-admin");

let app;
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  try {
    const params = event.queryStringParameters;
    const uid = params.sub1;
    const payout = parseFloat(params.payout || 0);
    const offerId = params.offer_id || "unknown";

    if (!uid) {
      console.log("❌ Missing UID in postback");
      return {
        statusCode: 400,
        body: "Missing sub1 UID",
      };
    }

    // 🪙 Decide coin reward
    const coinsToAdd = payout >= 1.5 ? 20 : 10;

    // ✅ Firestore update
    await db.runTransaction(async (t) => {
      const ref = db.collection("users").doc(uid);
      const userDoc = await t.get(ref);
      if (!userDoc.exists) {
        console.log("❌ User not found:", uid);
        return;
      }

      t.update(ref, {
        coins: admin.firestore.FieldValue.increment(coinsToAdd),
        lastOffer: offerId,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`✅ Postback success for UID: ${uid} | +${coinsToAdd} coins`);

    // ✅ MUST RETURN 200 + SUCCESS BODY
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: "SUCCESS",
    };
  } catch (error) {
    console.error("❌ Postback error:", error);
    return {
      statusCode: 500,
      body: "SERVER_ERROR",
    };
  }
};
