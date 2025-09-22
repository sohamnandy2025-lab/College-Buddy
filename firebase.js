// firebase.js
// Beginner-friendly Firebase helper for College Buddy
// ---------------------------------------------------
// What this file does
// - Initializes Firebase (App, Auth, Firestore)
// - Provides helper functions to:
//   1) getAllProfiles(): read all documents from the `users` collection
//   2) createOrUpdateProfile(uid, profileObj): create or update a user document with the given UID
// - Includes comments that explain how to replace any sample `profiles.json` fetch with live data from Firestore
//
// How to include this file on a static site (no build step)
// - Ensure your HTML uses a module script:
//   <script type="module">
//     import { initFirebase, getAllProfiles, createOrUpdateProfile } from "./firebase.js";
//     const firebaseConfig = {
//       apiKey: "YOUR_API_KEY",
//       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
//       projectId: "YOUR_PROJECT_ID",
//       storageBucket: "YOUR_PROJECT_ID.appspot.com",
//       messagingSenderId: "YOUR_SENDER_ID",
//       appId: "YOUR_APP_ID"
//     };
//     initFirebase(firebaseConfig);
//   </script>
//
// Prerequisites (one-time setup in Firebase Console)
// 1) Create a Firebase project: https://console.firebase.google.com/
// 2) Add a Web App in Project Settings > General > Your apps (</> icon)
//    - Copy the config object (apiKey, authDomain, projectId, etc.). Use it in initFirebase().
// 3) Enable Firestore:
//    - In the console, go to Build > Firestore Database > Create database.
//    - Choose a region close to your users.
//    - Start in Production mode (recommended). You can loosen rules during development if needed.
// 4) Create the `users` collection (optional first doc):
//    - In Firestore Data, click Start collection > Collection ID: users
//    - Add a document with ID equal to a test UID (or auto-ID), include fields like:
//      name (string), college (string), year (number), branch (string), hobbies (array), skills (array)
// 5) Enable Authentication providers:
//    - Go to Build > Authentication > Get Started
//    - Sign-in method tab:
//      a) Enable Google: toggle ON, save
//      b) Enable Email/Password: toggle ON, save
//    - Under Users tab, you can add test users or register via your UI later.
//
// Firestore security rules (basic idea)
// - For local development, you can temporarily allow reads to everyone and writes to authenticated users.
// - In production, restrict as needed. Example starting point:
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /users/{userId} {
//         allow read: if true;                // Consider restricting to authenticated only
//         allow write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//   }
//
// Replacing profiles.json with Firestore data
// -------------------------------------------
// If your frontend currently does something like:
//   const profiles = await fetch('profiles.json').then(r => r.json());
// Replace it with Firestore reads:
//   import { initFirebase, getAllProfiles } from './firebase.js';
//   initFirebase(firebaseConfig);
//   const profiles = await getAllProfiles();
//   // `profiles` is an array of objects from the `users` collection
//
// CDN imports for Firebase v10+ (modular SDK). Works in browsers with type="module".
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let app = null;
let db = null;
let auth = null;
let googleProvider = null;

// Initializes Firebase using the provided config object from your Firebase Console
// Returns the initialized services for convenience.
export function initFirebase(config) {
  if (app) {
    // Already initialized; return existing handles
    return { app, db, auth, googleProvider };
  }
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  return { app, db, auth, googleProvider };
}

// Fetch all user profiles from the `users` collection
// Returns an array of objects like: [{ id: '<docId>', name: '...', college: '...', ... }, ...]
export async function getAllProfiles() {
  if (!db) throw new Error('Firebase not initialized. Call initFirebase(config) first.');
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Create or update a profile document under `users/{uid}`
// - uid: string (user's UID from Firebase Auth)
// - profileObj: plain object with the profile fields you want to store
//   Example: { name: 'Alex', college: 'XYZ University', year: 3, branch: 'CSE', hobbies: ['music'], skills: ['JS'] }
export async function createOrUpdateProfile(uid, profileObj) {
  if (!db) throw new Error('Firebase not initialized. Call initFirebase(config) first.');
  if (!uid) throw new Error('Missing uid');
  await setDoc(doc(db, 'users', uid), profileObj, { merge: true });
}

// Optional: you can add sign-in helpers if you want (not required for the brief)
// Example usage (in your UI code):
//   import { initFirebase } from './firebase.js';
//   const { auth, googleProvider } = initFirebase(firebaseConfig);
//   // Google sign-in popup
//   // import { signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
//   // await signInWithPopup(auth, googleProvider);
