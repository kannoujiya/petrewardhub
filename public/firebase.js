import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Yahan apna config paste karo
const firebaseConfig = {
  apiKey: "ABC123...",
  authDomain: "petrewardhub.firebaseapp.com",
  projectId: "petrewardhub",
  storageBucket: "petrewardhub.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdefg"
};

// Firebase app initialize
const app = initializeApp(firebaseConfig);

// Firestore database
const db = getFirestore(app);

export default db;
