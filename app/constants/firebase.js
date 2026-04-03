import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCjTliflbzkU6QL6COWI1yn7d5kWQa5qJ8",
  authDomain: "smart-crib-app.firebaseapp.com",
  databaseURL: "https://smart-crib-app-default-rtdb.firebaseio.com",
  projectId: "smart-crib-app",
  storageBucket: "smart-crib-app.firebasestorage.app",
  messagingSenderId: "326480470767",
  appId: "1:326480470767:web:f273ba582f6ecc9ca2711a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue };