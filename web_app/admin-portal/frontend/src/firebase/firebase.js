import { initializeApp } from "firebase/app";
import { getAuth, browserSessionPersistence, setPersistence, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getQaConfig } from './qaConfig';


// Firebase config from .env
const qa = getQaConfig(import.meta.env);
const firebaseConfig = qa || {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
if (qa) connectAuthEmulator(auth, `http://${qa.host}:9099`, { disableWarnings: true });
setPersistence(auth, browserSessionPersistence);
export const db = getFirestore(app);
if (qa) connectFirestoreEmulator(db, qa.host, 8080);

export default app;
