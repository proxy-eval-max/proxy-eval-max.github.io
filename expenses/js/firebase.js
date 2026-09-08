import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, deleteDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, writeBatch, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig, APP_CHECK_SITE_KEY } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

// App Check attests that requests come from this page, not from a script hitting
// the REST API. Without it the project's endpoints are open to anyone with the
// (public) API key; with enforcement on in the console, they are not.
export const appCheckEnabled = !!APP_CHECK_SITE_KEY;
if (appCheckEnabled) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
// Always show the account chooser rather than silently reusing a session.
provider.setCustomParameters({ prompt: "select_account" });

// Bundled dependency objects so other modules never import the CDN directly.
export const authDeps = { auth, provider, signInWithPopup, signOut, onAuthStateChanged };
export const dbDeps = { db, collection, doc, addDoc, deleteDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, writeBatch, setDoc };
