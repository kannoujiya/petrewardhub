// Firebase configuration - using exact provided values
const firebaseConfig = {
  apiKey: "AIzaSyDQFmVlYyJGc0GaY5F6p2fWKqrrYkrQzAo",
  authDomain: "petrewardhub.firebaseapp.com",
  projectId: "petrewardhub",
  storageBucket: "petrewardhub.appspot.com",
  messagingSenderId: "1087250543825",
  appId: "1:1087250543825:web:4d92bc084978fab9a0c1f0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();