// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBILNWDqC3M_R0FckJNccvTgmWtOVk64AM",
  authDomain: "reward-system-be06c.firebaseapp.com",
  projectId: "reward-system-be06c",
  storageBucket: "reward-system-be06c.firebasestorage.app",
  messagingSenderId: "1045207248141",
  appId: "1:1045207248141:web:dddd81004b91cff287d444"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Auth engine initialize
export const auth = getAuth(app);

// Language
auth.languageCode = 'en';

export { RecaptchaVerifier, signInWithPhoneNumber };