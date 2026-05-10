import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDzN1TWU_sWdd7_AxbMcvlvjEzKYKiOVUg",
  authDomain: "nifes-fuhso-check-in.firebaseapp.com",
  projectId: "nifes-fuhso-check-in",
  storageBucket: "nifes-fuhso-check-in.firebasestorage.app",
  messagingSenderId: "862375541759",
  appId: "1:862375541759:web:eaebc464f93afb4f89c5ca",
  measurementId: "G-PSJJHG8DMV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
