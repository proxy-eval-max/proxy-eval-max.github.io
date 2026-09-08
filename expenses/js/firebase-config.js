// Firebase web config. This is NOT a secret — it only identifies the project and
// this particular web app to the client. Security is enforced by Firebase Auth and
// the Firestore rules at the repo root, not by hiding any of this.
//
// Same "proxy-eval" project as moving-checklist (same apiKey / authDomain /
// projectId / storageBucket / messagingSenderId — shared Auth, shared database),
// but a *separate web app registration*: its own appId and its own analytics
// stream. That separation matters because App Check registers per web app, so this
// page attests against its own reCAPTCHA registration.
//
// tests/firebase-config.test.js fails if the two apps ever drift onto different
// projects, or if this one stops being distinct.
export const firebaseConfig = {
  apiKey: "AIzaSyBVHyzTIQ3BkzlIgiaqiNxyZFsJBHz51nI",
  authDomain: "proxy-eval.firebaseapp.com",
  projectId: "proxy-eval",
  storageBucket: "proxy-eval.firebasestorage.app",
  messagingSenderId: "726735473376",
  appId: "1:726735473376:web:12e055afca414f19585e85",
  measurementId: "G-6S9PZWQ41W",
};

export function isConfigured() {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_ME";
}

// App Check (reCAPTCHA v3) site key for THIS web app registration. The site key is
// public by design — it ships in the page either way. The reCAPTCHA *secret* key
// lives in the Firebase console and must never appear here.
//
// Leave empty to run without App Check: the app still works and shows a footer
// note. See ../README.md → "Locking it down".
export const APP_CHECK_SITE_KEY = "6LdtA7EtAAAAACwluRGpD-6tr53M-2E9G_zdzYfD";
