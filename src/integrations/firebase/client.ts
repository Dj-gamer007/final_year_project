import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";

// Hardcoding public configuration to ensure deployment on GitHub Pages 
// works without complex secrets configuration.
const firebaseConfig = {
  apiKey: "AIzaSyAXhWQh-SLsuhMzaBmYgPzXYHiSdLPcxlA",
  authDomain: "aimeethub.firebaseapp.com",
  projectId: "aimeethub",
  storageBucket: "aimeethub.firebasestorage.app",
  messagingSenderId: "853431644639",
  appId: "1:853431644639:web:370d145c8d0a9fda4ad46a",
  measurementId: "G-LMG6PEN6T0"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  console.info("[Firebase] Initialized with hardcoded config");
} catch (error) {
  console.error("[Firebase] Initialization failed:", error);
}

export { app, auth, googleProvider };
