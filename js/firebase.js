// filepath: /got-milk-app/got-milk-app/src/js/firebase.js
// Firebase configuration - replace with your own keys
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firestore and Storage instances
const db = firebase.firestore();
const storage = firebase.storage();

export { db, storage };