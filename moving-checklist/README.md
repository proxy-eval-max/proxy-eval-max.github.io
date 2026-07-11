# MoveAddress — Moving Checklist

Static, Google-sign-in moving address-change checklist.
Live: https://proxy-eval-max.github.io/moving-checklist/

## How it works
- Sign in with Google (Firebase Auth). No passwords, no tokens.
- Each user's checklist is a Firestore document `users/<uid>`, readable/writable only by
  that signed-in user (enforced by Firestore security rules).
- Frontend is a static site on GitHub Pages; the browser talks to Firebase directly.

## Firebase setup (one time, by the project owner)
1. Create a Firebase project (console.firebase.google.com).
2. Authentication → Sign-in method → enable **Google**.
3. Create a **Cloud Firestore** database (production mode).
4. Authentication → Settings → Authorized domains → add `proxy-eval-max.github.io`
   (and `localhost` for local testing).
5. Publish these Firestore rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
6. Copy your web app config into `js/firebase-config.js` (replace the `REPLACE_ME` values).
   This config is not a secret — security comes from Auth + the rules above.

## Importing an old profile
The previous version stored password-encrypted profiles in the repo. After signing in,
go to **Settings → Import old checklist**, enter the old username + password once, and it
imports into your Firebase account.

## Develop / test
No build step. Run the logic tests with Node 26+:
```
cd moving-checklist && node --test 'tests/*.test.js'
```
Serve locally: `python3 -m http.server -d moving-checklist 8099` (Firebase needs a real
config and `localhost` in Authorized domains to function).

## Security notes
- Access control is server-enforced by Firestore rules.
- Data is stored plaintext in Firestore (readable by the project's Firebase admins/Google).
- No sensitive identifiers (SSN, license, passport, bank numbers) are collected.
- Informational only — not legal advice.
