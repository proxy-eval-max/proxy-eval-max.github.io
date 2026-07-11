// Firebase web config. This is NOT a secret — it only identifies the project to the
// client. All security is enforced by Firebase Auth + Firestore rules, not by hiding this.
// Replace the "REPLACE_ME" values with your project's config from the Firebase console:
// Project settings → General → Your apps → SDK setup and configuration.
export const firebaseConfig = {
  apiKey: "AIzaSyBVHyzTIQ3BkzlIgiaqiNxyZFsJBHz51nI",
  authDomain: "proxy-eval.firebaseapp.com",
  projectId: "proxy-eval",
  storageBucket: "proxy-eval.firebasestorage.app",
  messagingSenderId: "726735473376",
  appId: "1:726735473376:web:cc62b2b71ca11db8585e85",
  measurementId: "G-5EY09X15FH",
};

export function isConfigured() {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_ME";
}
