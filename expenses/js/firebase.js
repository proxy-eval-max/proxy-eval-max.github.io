import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, deleteDoc, updateDoc,
  serverTimestamp, onSnapshot, query, orderBy, limit, writeBatch, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig, APP_CHECK_SITE_KEY } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

// App Check attests that requests come from this page, not from a script hitting
// the REST API. Without it the project's endpoints are open to anyone with the
// (public) API key; with enforcement on in the console, they are not.
export const appCheckEnabled = !!APP_CHECK_SITE_KEY;

// On localhost there is no reCAPTCHA attestation to be had, so with enforcement
// on the dev server would just fail every request. This asks the SDK to mint a
// debug token and log it; it is useless until someone pastes that token into the
// console's allowlist, and it never runs on the deployed origin.
// Never commit a token itself — it is a bypass that works from anywhere.
if (appCheckEnabled
    && ["localhost", "127.0.0.1"].includes(location.hostname)) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

if (appCheckEnabled) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
// Offline cache, so opening the page on a train shows the last known verdict
// instead of a spinner, and a write made with no signal syncs later. Note what
// this means: the entries — amounts included — sit in this browser's IndexedDB.
// The app's promise is that the interface won't show you a number, not that the
// numbers never touch the device.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const provider = new GoogleAuthProvider();
// Always show the account chooser rather than silently reusing a session.
provider.setCustomParameters({ prompt: "select_account" });

// Bundled dependency objects so other modules never import the CDN directly.
export const authDeps = { auth, provider, signInWithPopup, signOut, onAuthStateChanged };
export const dbDeps = { db, collection, doc, addDoc, deleteDoc, updateDoc,
  serverTimestamp, onSnapshot, query, orderBy, limit, writeBatch, setDoc };
