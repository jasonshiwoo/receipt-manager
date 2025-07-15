import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdvix82B-0me0U9cphldwiD4ZMOd0Sfu0",
  authDomain: "receipt-manager-2c61b.firebaseapp.com",
  projectId: "receipt-manager-2c61b",
  storageBucket: "receipt-manager-2c61b.firebasestorage.app",
  messagingSenderId: "1082387604545",
  appId: "1:1082387604545:web:06d1a663f62ca4a48592c0",
  measurementId: "G-3CY92QPVK7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Cloud Functions and get a reference to the service
export const functions = getFunctions(app);

export default app;
