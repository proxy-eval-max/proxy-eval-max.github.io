// Firebase web config for the shared "proxy-eval" project. This is NOT a secret —
// it only identifies the project to the client. Security comes from Firebase Auth
// + the Firestore rules in ../firestore.rules, not from hiding this.
//
// Re-exported from the moving-checklist app so the two pages can never drift onto
// different projects. If you ever split them, inline the object here.
export { firebaseConfig, isConfigured } from "../../moving-checklist/js/firebase-config.js";

// App Check (reCAPTCHA v3) site key. Leave empty to run without App Check —
// the app still works, but the project's API surface is then open to bot abuse.
// See ../README.md → "Locking it down" for how to create the key and turn on
// enforcement in the Firebase console.
export const APP_CHECK_SITE_KEY = "";
