// Load AFTER Firebase compat SDKs, BEFORE app.js
const firebaseConfig = {
  apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
  authDomain: "petrewardhub.firebaseapp.com",
  projectId: "petrewardhub",
  storageBucket: "petrewardhub.appspot.com",
  messagingSenderId: "1087250543825",
  appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};
try{
  if(!firebase.apps.length){ firebase.initializeApp(firebaseConfig); console.log("✅ Firebase initialized"); }
}catch(e){ console.error("❌ Firebase init error:", e); }
window.auth=firebase.auth();
window.db=firebase.firestore();
