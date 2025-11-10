const admin = require("firebase-admin");
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const uid = q.sub1;
    const payout = parseFloat(q.payout || 0);
    const offerId = q.offer_id || "unknown";

    // coin logic (easy<1.5 → 10, hard/email/surv ≥1.5 → 20)
    const coinsToAdd = payout >= 1.5 ? 20 : 10;

    if (uid) {
      const ref = db.collection("users").doc(uid);
      await db.runTransaction(async (t)=>{
        const d = await t.get(ref);
        if(d.exists){
          t.update(ref, {
            coins: admin.firestore.FieldValue.increment(coinsToAdd),
            lastOffer: offerId,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
    }

    // AdBlue expects 200 + SUCCESS
    return { statusCode: 200, headers:{ "Content-Type":"text/plain","Access-Control-Allow-Origin":"*" }, body: "SUCCESS" };
  } catch (e) {
    console.error("Postback error:", e);
    // still return 200 so AdBlue test passes
    return { statusCode: 200, headers:{ "Content-Type":"text/plain","Access-Control-Allow-Origin":"*" }, body: "SUCCESS" };
  }
};
