// Firebase web config. This is NOT a secret — it only identifies the project to the
// client. All security is enforced by Firebase Auth + Firestore rules, not by hiding this.
// Replace the "REPLACE_ME" values with your project's config from the Firebase console:
// Project settings → General → Your apps → SDK setup and configuration.
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

export function isConfigured() {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_ME";
}
