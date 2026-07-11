# MoveAddress — Firebase Data Layer (Auth + Firestore)

**Date:** 2026-07-11
**Status:** Approved design, pending spec review
**Live URL:** https://proxy-eval-max.github.io/moving-checklist/
**Repo:** proxy-eval-max/proxy-eval-max.github.io (branch: main)
**Supersedes:** the data/auth portions of `2026-07-11-moving-checklist-design.md` (checklist content, rules engine, and views are unchanged).

## 1. Summary

Replace the app's data layer. Today each profile is an AES-GCM-encrypted JSON file
committed to the repo via the GitHub Contents API, requiring every writer to hold a
GitHub Personal Access Token. This moves authentication to **Firebase Auth (Google
sign-in)** and storage to **Cloud Firestore**, with per-user access enforced by Firestore
security rules. The frontend stays a static site on GitHub Pages; only auth + storage
change.

Goals:
- Remove the GitHub-token requirement entirely.
- Real, server-enforced per-user access control (not client-side gating).
- Keep the existing checklist content, personalization rules, and views untouched.
- Provide a one-time path to import the existing `anirudh` profile.

Non-goals: client-side encryption (data is stored plaintext in Firestore, protected by
Auth + rules — this was an explicit decision), realtime multi-user editing, offline
persistence, and any change to checklist content/rules/views beyond wiring.

## 2. Hosting

Unchanged: static files under `moving-checklist/`, served at
`https://proxy-eval-max.github.io/moving-checklist/`. No build step. The browser calls
Firebase directly; there is no server of our own.

## 3. Firebase project setup (owner action — requires the owner's Google account)

These are performed once in the Firebase console and are prerequisites for the app to
function. They are the owner's responsibility; the app cannot create them.

1. Create a Firebase project.
2. **Authentication → Sign-in method → enable Google** provider.
3. Create a **Cloud Firestore** database (production mode).
4. **Authentication → Settings → Authorized domains:** add `proxy-eval-max.github.io`
   (and `localhost` for local testing).
5. Publish the security rules (§6).
6. Copy the **web app config** and provide it to the implementation (see §5).

## 4. Authentication

- Firebase Auth with the **Google provider**, via `signInWithPopup`.
- The auth gate is a single **"Sign in with Google"** button. No usernames, no passwords.
- Each signed-in user has a stable `auth.uid`. First sign-in = profile creation (their
  Firestore doc is created on first save / onboarding).
- `onAuthStateChanged` drives the app: signed-out → show the sign-in gate; signed-in →
  load the user's state and render the app.
- Logout = `signOut(auth)`.
- Session persistence: Firebase default (`browserLocalPersistence`) so a returning user is
  still signed in.

## 5. Firebase config & SDK loading

- The Firebase **web config** (`apiKey`, `authDomain`, `projectId`, `storageBucket`,
  `messagingSenderId`, `appId`) is placed in `js/firebase-config.js` and committed. This is
  **not a secret** — it identifies the project to the client; all security comes from the
  Auth + Firestore rules. (If the owner prefers, `firebase-config.js` can be git-ignored
  and provided at deploy, but committing is the documented default.)
- The Firebase JS SDK (v10+, modular) is loaded from the official CDN via ES module
  imports, e.g.:
  ```js
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import { getFirestore, doc, getDoc, setDoc, deleteDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  ```
- **Consequence:** this introduces an external runtime dependency (gstatic CDN). Acceptable
  on GitHub Pages (no CSP). It is a deliberate change from the previous "fully
  self-contained, no external dependencies" constraint, which no longer holds for the data
  layer. A pinned SDK version string is used (not `latest`) for reproducibility.

## 6. Firestore data model & security rules

- One document per user: **`users/{uid}`**.
- Document contents = the existing in-memory state shape, stored as plaintext:
  ```json
  {
    "profile": { "createdAt": "<iso>" },
    "move": { "oldZip": "", "newZip": "", "moveDate": "", "moveType": "", "housing": "",
      "hasVehicle": false, "utilitiesIncluded": false, "voter": false, "children": false,
      "pets": false, "benefits": false, "immigration": "prefer_not",
      "professionalLicenses": false, "reminderPref": "browser" },
    "tasks": [ { "id": "...", "templateId": "...", "status": "not_started", "reason": "...",
      "recommendedDate": "...", "deadlineNote": "...", "confirmationNumber": "",
      "notes": "", "updatedAt": null } ],
    "meta": { "onboarded": false, "schemaVersion": 1 }
  }
  ```
  (`profile.username` is dropped — identity is the Google account; display name/email come
  from the Firebase user object.)
- **Security rules** (published in the console):
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
  This is the entire access-control model: a user can read/write only their own doc; no one
  else can read it.

## 7. Code changes

### New / rewritten
- `js/firebase-config.js` — the web config object (committed).
- `js/firebase.js` — `initializeApp` + exports initialized `auth` and `db`; sets the Google
  provider.
- `js/firestore.js` — **replaces `js/github.js`** for the data path:
  - `async loadUserState(uid)` → the doc data, or `null` if no doc yet.
  - `async saveUserState(uid, state)` → `setDoc(doc(db,"users",uid), state)`.
  - `async deleteUserState(uid)` → `deleteDoc(...)`.
  - Injectable Firestore handle for testing.
- `js/auth.js` — rewritten around Firebase Auth: `signInWithGoogle()`, `logout()`,
  `onAuth(callback)` (wraps `onAuthStateChanged`), `currentUser()`. Username
  validation/token helpers are removed.
- `js/store.js` — keeps the in-memory `getState()/setState()/emptyState()` role; `load`
  and `save` now delegate to `firestore.js` keyed by `uid` (no encryption, no sha).
- `js/app.js` — auth gate becomes the Google sign-in button + disclaimer; boot uses
  `onAuth` instead of the login/create-profile forms; `ctx` becomes
  `{ state, save, navigate, toast }` (drop `token`); `save()` no longer checks for a token.

### Retained, but only for migration (§8)
- `js/crypto.js` (decrypt) and a minimal read-only GitHub fetch — used solely by the import
  flow. Not on the normal path.

### Unchanged
- `js/tasks-data.js`, `js/rules.js`, `js/dates.js`, `js/ui.js`, `js/b64.js`.
- All five views (`onboarding`, `dashboard`, `checklist`, `task-detail`, `settings`) —
  they consume `ctx.state` and the unchanged `{state, save, navigate, toast}` contract.
  Settings loses the GitHub-token section and gains a "Sign out" affordance; the
  backup/delete/move-details sections adapt to Firestore (delete → `deleteUserState`).

### Removed from the normal flow
- The GitHub Contents API write path, the PAT entry/localStorage handling, and the
  per-user `data/*.enc.json` write model. Existing `data/*.enc.json` files remain in the
  repo until migrated, then may be deleted.

## 8. One-time migration (import old profile)

The old `anirudh` profile is an AES-GCM blob at
`moving-checklist/data/anirudh.enc.json`, encrypted with anirudh's password.

Flow (after Google sign-in, exposed in Settings as **"Import my old checklist"**):
1. User enters the old **username** and **password**.
2. App fetches `data/<username>.enc.json` (unauthenticated GitHub read, reusing the old
   fetch), then `crypto.decrypt(password, blob)` client-side → the old `state`.
3. Strip `state.profile.username`; write the resulting `{ profile, move, tasks, meta }`
   into the current user's Firestore doc via `saveUserState(uid, state)`.
4. Confirm success; the checklist now appears. The legacy file can then be deleted from the
   repo by the owner.

On wrong password/missing file: a single "Could not import — check the username and
password" message (same non-leaking behavior as before). Import is idempotent-safe: it
overwrites the current Firestore doc, so the user is warned it will replace existing data.

## 9. Error handling

- **Sign-in popup blocked/closed:** catch `auth/popup-blocked` and
  `auth/popup-closed-by-user` → friendly toast; offer to retry. (Redirect fallback is out
  of scope but noted.)
- **Firestore read/write failure (network/permission):** clear toast; in-memory state is
  preserved; retry available.
- **No Firestore doc yet (new user):** `loadUserState` returns `null` → app starts the user
  at onboarding with a fresh `emptyState()`.
- **Migration decrypt failure:** unified "could not import" message.
- **Firebase config missing/invalid:** a hard error page instructing to set
  `firebase-config.js` (mirrors the existing Web-Crypto-unavailable guard).

## 10. Testing

No build step; Firebase SDK is browser-only and network-backed, so:
- **Pure logic unchanged** — `rules`, `dates`, `tasks-data`, `crypto` tests keep passing
  (`node --test 'tests/*.test.js'`).
- **`store.js` / `firestore.js`** — tested with an injected fake Firestore handle (in-memory
  map), mirroring the current store test approach: save→load round-trip, delete, null on
  missing doc. No real network.
- **`auth.js`** — the Firebase-dependent parts are thin wrappers; unit-test the injectable
  seams (e.g. `onAuth` dispatch) with a fake auth object where practical; the popup flow is
  verified manually.
- **Migration** — the decrypt+shape-transform step is a pure function over a fetched blob;
  test it with a locally-encrypted fixture (reusing `crypto.encrypt`).
- **Manual E2E** (owner, after Firebase setup): sign in with Google → onboard → change a
  task + save → reload (state persists from Firestore) → sign in as a *different* Google
  account → independent empty checklist → confirm neither can read the other's doc → run
  the one-time import for `anirudh`.

Firebase calls are isolated in `firebase.js`/`firestore.js`/`auth.js` so pure logic stays
testable without network.

## 11. Rollout

1. Owner completes §3 Firebase setup and provides the web config.
2. Implement behind the new modules; keep the app served from the same path.
3. Manual E2E per §10.
4. Import `anirudh`; once verified, optionally delete legacy `data/*.enc.json`.

## 12. Security notes (honest)

- Access control is now **server-enforced** by Firestore rules — a real improvement over
  the previous client-side login gate.
- Data is **plaintext in Firestore** (explicit decision): Google, and anyone with the
  project's Firebase admin access, can read it. No sensitive identifiers are collected
  (unchanged from the original design — no SSN/DL/passport/bank numbers).
- The Firebase web config is public by design; it is not a credential.
- Migration briefly handles the old password in-browser to decrypt; it is never stored or
  sent anywhere.
