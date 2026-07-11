# Firebase Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MoveAddress data layer (GitHub-token + encrypted git files) with Firebase Auth (Google sign-in) + Cloud Firestore, keeping the frontend static on GitHub Pages and the checklist content/rules/views unchanged.

**Architecture:** The browser talks directly to Firebase via the modular SDK loaded from the gstatic CDN. Auth is Google sign-in; each user's checklist lives in a Firestore doc `users/{uid}` as plaintext, protected by security rules. Data-access logic takes Firebase primitives via injected `deps` objects so it is Node-testable without the SDK or network. A one-time migration decrypts the legacy `anirudh` git file and writes it into Firestore.

**Tech Stack:** HTML5, CSS3, vanilla JS ES modules (no build step), Firebase JS SDK v10.12.0 (Auth + Firestore) from `https://www.gstatic.com/firebasejs/…`, Node's built-in test runner (Node 26).

## Global Constraints

- All app files under `moving-checklist/`, served at `/moving-checklist/`. No build step, no bundler. All local asset paths relative.
- Firebase SDK pinned to **10.12.0**, imported from `https://www.gstatic.com/firebasejs/10.12.0/…` (this is the one allowed external dependency; introduced deliberately, replacing the old "fully self-contained" rule).
- Firestore doc per user: **`users/{uid}`**. State shape stored **plaintext** (no encryption): `{ profile:{createdAt}, move:{...}, tasks:[...], meta:{onboarded,schemaVersion} }`. `profile.username` is dropped (identity = Google account).
- Security rules live in the Firebase console (owner-published), NOT in the repo: `match /users/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }`.
- `js/firebase-config.js` is committed with sentinel value `"REPLACE_ME"` for `apiKey` (owner replaces with the real web config). `isConfigured()` guards the app; the web config is public, not a secret.
- The `ctx` contract for views is `{ state, save, navigate, toast }` (the `token` field is removed).
- Data-access modules (`firestore.js`, `store.js`, `migration.js`, `auth.js`) receive Firebase primitives via a `deps` object argument or injectable module deps, so tests use in-memory fakes.
- Test command: `node --test 'tests/*.test.js'` (bare `node --test tests/` is broken on Node 26). `package.json` already uses the correct form.
- `move` answer keys and task-state shape are unchanged from the existing app; do not alter them.
- Conventional-commit messages; each task ends with a commit (scoped `git add`, never `-A`/`.`).

---

## File Structure

```
moving-checklist/
  js/
    firebase-config.js   # NEW — web config (committed, sentinel default) + isConfigured()
    firebase.js          # NEW — initializeApp; exports auth, db, provider, authDeps, fsDeps
    firestore.js         # NEW — loadUserState/saveUserState/deleteUserState (deps-injected)
    migration.js         # NEW — importLegacy()/toImportState() (one-time old-profile import)
    store.js             # REWRITTEN — in-memory state, load/save/remove via firestore.js
    auth.js              # REWRITTEN — Firebase Auth (Google) wrappers (deps-injected)
    app.js               # REWRITTEN — Google sign-in gate + onAuth boot + router
    github.js            # DELETED (data path replaced by firestore.js)
    crypto.js, b64.js    # RETAINED (used only by migration.js)
    dates.js, rules.js, tasks-data.js, ui.js   # UNCHANGED
    views/
      onboarding.js, dashboard.js, checklist.js, task-detail.js  # UNCHANGED
      settings.js        # REWRITTEN — drop token; add import; delete via Firestore; JSON backup
  tests/
    firestore.test.js    # NEW
    migration.test.js    # NEW
    store.test.js        # REWRITTEN (fake firestore module)
    auth.test.js         # REWRITTEN (fake Firebase auth deps)
    github.test.js       # DELETED
    crypto.test.js, dates.test.js, rules.test.js, tasks-data.test.js  # UNCHANGED
```

**Sequencing note:** leaf modules first (firebase, firestore, migration, store, auth), then the integrators (settings, app) last. Because browser modules are parse-verified only and imports aren't resolved by `node --check`, intermediate cross-module references may be temporarily inconsistent; the app is expected to fully load only after Task 7, and Task 8 runs the whole-app parse sweep + owner E2E.

---

## Task 1: Firebase config + init module

**Files:**
- Create: `moving-checklist/js/firebase-config.js`
- Create: `moving-checklist/js/firebase.js`

**Interfaces:**
- Produces: `firebase-config.js` exports `firebaseConfig` (object) and `isConfigured()` → boolean.
- Produces: `firebase.js` exports `auth`, `db`, `provider`, and bundles `authDeps = { auth, provider, signInWithPopup, signOut, onAuthStateChanged }` and `fsDeps = { db, doc, getDoc, setDoc, deleteDoc }`.

- [ ] **Step 1: Create `moving-checklist/js/firebase-config.js`**

```js
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
```

- [ ] **Step 2: Create `moving-checklist/js/firebase.js`**

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// Bundled dependency objects so other modules never import the CDN directly.
export const authDeps = { auth, provider, signInWithPopup, signOut, onAuthStateChanged };
export const fsDeps = { db, doc, getDoc, setDoc, deleteDoc };
```

- [ ] **Step 3: Verify parse**

Run: `cd moving-checklist && node --check js/firebase-config.js && node --check js/firebase.js`
Expected: no output (both parse). `node --check` does not resolve the gstatic imports, so this succeeds offline.

- [ ] **Step 4: Commit**

```bash
git add moving-checklist/js/firebase-config.js moving-checklist/js/firebase.js
git commit -m "feat: add Firebase init + config modules"
```

---

## Task 2: Firestore data access + remove GitHub data path

**Files:**
- Create: `moving-checklist/js/firestore.js`
- Test: `moving-checklist/tests/firestore.test.js`
- Delete: `moving-checklist/js/github.js`, `moving-checklist/tests/github.test.js`

**Interfaces:**
- Produces: `loadUserState(deps, uid)` → the doc data object or `null` if no doc; `saveUserState(deps, uid, state)` → `true`; `deleteUserState(deps, uid)` → `true`. `deps = { db, doc, getDoc, setDoc, deleteDoc }` (matches `firebase.js` `fsDeps`).

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/firestore.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadUserState, saveUserState, deleteUserState } from "../js/firestore.js";

// Fake Firestore deps backed by an in-memory Map. doc() returns a string ref key.
function fakeDeps() {
  const m = new Map();
  return {
    _m: m,
    db: {},
    doc: (_db, col, uid) => `${col}/${uid}`,
    getDoc: async (ref) => ({ exists: () => m.has(ref), data: () => m.get(ref) }),
    setDoc: async (ref, data) => { m.set(ref, JSON.parse(JSON.stringify(data))); },
    deleteDoc: async (ref) => { m.delete(ref); },
  };
}

test("loadUserState returns null when the doc is missing", async () => {
  const deps = fakeDeps();
  assert.equal(await loadUserState(deps, "u1"), null);
});

test("save then load round-trips the state", async () => {
  const deps = fakeDeps();
  const state = { move: { newZip: "78701" }, tasks: [{ id: "a", status: "completed" }], meta: { onboarded: true } };
  assert.equal(await saveUserState(deps, "u1", state), true);
  const out = await loadUserState(deps, "u1");
  assert.deepEqual(out, state);
  // stored under the uid-specific ref, not shared
  assert.equal(await loadUserState(deps, "other"), null);
});

test("deleteUserState removes the doc", async () => {
  const deps = fakeDeps();
  await saveUserState(deps, "u1", { meta: { onboarded: true } });
  assert.equal(await deleteUserState(deps, "u1"), true);
  assert.equal(await loadUserState(deps, "u1"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test 'tests/firestore.test.js'`
Expected: FAIL — cannot find `../js/firestore.js`.

- [ ] **Step 3: Implement `moving-checklist/js/firestore.js`**

```js
// Per-user Firestore document access. All Firebase primitives arrive via `deps`
// ({ db, doc, getDoc, setDoc, deleteDoc }) so this module is testable without the SDK.
export async function loadUserState(deps, uid) {
  const snap = await deps.getDoc(deps.doc(deps.db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserState(deps, uid, state) {
  await deps.setDoc(deps.doc(deps.db, "users", uid), state);
  return true;
}

export async function deleteUserState(deps, uid) {
  await deps.deleteDoc(deps.doc(deps.db, "users", uid));
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test 'tests/firestore.test.js'`
Expected: PASS (3 tests).

- [ ] **Step 5: Delete the obsolete GitHub data path**

```bash
git rm moving-checklist/js/github.js moving-checklist/tests/github.test.js
```

Then confirm no remaining references: `grep -rn "github.js\|from \"./github\|from \"../github" moving-checklist/js` → expect no matches (migration.js in Task 4 uses `fetch` directly, not github.js).

- [ ] **Step 6: Run full suite**

Run: `cd moving-checklist && node --test 'tests/*.test.js'`
Expected: all pass; github tests gone; firestore tests present.

- [ ] **Step 7: Commit**

```bash
git add moving-checklist/js/firestore.js moving-checklist/tests/firestore.test.js
git commit -m "feat: add Firestore data access; remove GitHub data path"
```

---

## Task 3: Rewrite store around Firestore

**Files:**
- Rewrite: `moving-checklist/js/store.js`
- Rewrite (replace): `moving-checklist/tests/store.test.js`

**Interfaces:**
- Consumes: `firestore.js` (`loadUserState`/`saveUserState`/`deleteUserState`).
- Produces: `emptyState()` → fresh state (no username); `configure(deps)` sets the Firestore `deps` used for all calls; `__setDeps({ fs, fsDeps })` for tests; `load(uid)` → doc data or `null` (sets in-memory `{state,uid}`); `startFresh(uid)` → sets and returns `emptyState()`; `getState()`; `setState(next)`; `importState(state)`; `session()` → `{uid,hasState}`; `clear()`; `save()` → persists current state (throws `Error("no-session")` if no uid/state); `remove()` → deletes doc + clears; `exportText()` → pretty JSON of current state.

- [ ] **Step 1: Write the failing test** — replace `moving-checklist/tests/store.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as store from "../js/store.js";

// Fake firestore module backed by an in-memory map (ignores fsDeps).
function memFs() {
  const m = new Map();
  return {
    _m: m,
    async loadUserState(_deps, uid) { return m.has(uid) ? JSON.parse(m.get(uid)) : null; },
    async saveUserState(_deps, uid, state) { m.set(uid, JSON.stringify(state)); return true; },
    async deleteUserState(_deps, uid) { m.delete(uid); return true; },
  };
}

test("load returns null for a new user", async () => {
  store.__setDeps({ fs: memFs(), fsDeps: {} });
  store.clear();
  assert.equal(await store.load("newuser"), null);
});

test("startFresh gives an empty, un-onboarded state", async () => {
  store.__setDeps({ fs: memFs(), fsDeps: {} });
  const st = store.startFresh("u1");
  assert.equal(st.meta.onboarded, false);
  assert.deepEqual(st.tasks, []);
  assert.equal(st.move.immigration, "prefer_not");
  assert.equal("username" in st.profile, false);
});

test("setState + save + reload round-trips via firestore", async () => {
  const fs = memFs();
  store.__setDeps({ fs, fsDeps: {} });
  const st = store.startFresh("u1");
  st.meta.onboarded = true; st.move.newZip = "78701";
  store.setState(st);
  await store.save();
  store.clear();
  const again = await store.load("u1");
  assert.equal(again.move.newZip, "78701");
  assert.equal(again.meta.onboarded, true);
});

test("remove deletes the doc and clears the session", async () => {
  const fs = memFs();
  store.__setDeps({ fs, fsDeps: {} });
  store.startFresh("u1"); await store.save();
  await store.remove();
  assert.equal(store.getState(), null);
  assert.equal(await store.load("u1"), null);
});

test("save with no session throws no-session", async () => {
  store.__setDeps({ fs: memFs(), fsDeps: {} });
  store.clear();
  await assert.rejects(() => store.save(), /no-session/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test 'tests/store.test.js'`
Expected: FAIL — the new exports (`startFresh`, `configure`, new `load` signature) don't exist yet / old store API mismatch.

- [ ] **Step 3: Rewrite `moving-checklist/js/store.js`**

```js
import * as defaultFs from "./firestore.js";

let fs = defaultFs;
let fsDeps = null; // set at boot via configure(), or in tests via __setDeps

export function configure(deps) { fsDeps = deps; }
export function __setDeps(d) { if (d.fs) fs = d.fs; if (d.fsDeps !== undefined) fsDeps = d.fsDeps; }

let mem = { state: null, uid: null };

export function emptyState() {
  return {
    profile: { createdAt: null },
    move: { oldZip: "", newZip: "", moveDate: "", moveType: "", housing: "",
      hasVehicle: false, utilitiesIncluded: false, voter: false, children: false,
      pets: false, benefits: false, immigration: "prefer_not", professionalLicenses: false,
      reminderPref: "browser" },
    tasks: [], meta: { onboarded: false, schemaVersion: 1 },
  };
}

export async function load(uid) {
  const data = await fs.loadUserState(fsDeps, uid);
  mem = { state: data, uid };
  return data; // null if new user
}
export function startFresh(uid) { mem = { state: emptyState(), uid }; return mem.state; }
export function getState() { return mem.state; }
export function setState(next) { mem.state = next; }
export function importState(state) { mem.state = state; }
export function session() { return { uid: mem.uid, hasState: !!mem.state }; }
export function clear() { mem = { state: null, uid: null }; }

export async function save() {
  if (!mem.uid || !mem.state) throw new Error("no-session");
  await fs.saveUserState(fsDeps, mem.uid, mem.state);
  return true;
}
export async function remove() {
  if (!mem.uid) throw new Error("no-session");
  await fs.deleteUserState(fsDeps, mem.uid);
  clear();
  return true;
}
export function exportText() { return JSON.stringify(mem.state, null, 2); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test 'tests/store.test.js'`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add moving-checklist/js/store.js moving-checklist/tests/store.test.js
git commit -m "feat: rewrite store to persist via Firestore"
```

---

## Task 4: One-time legacy import

**Files:**
- Create: `moving-checklist/js/migration.js`
- Test: `moving-checklist/tests/migration.test.js`

**Interfaces:**
- Consumes: `crypto.js` (`decrypt`).
- Produces: `toImportState(oldState)` → `{ profile (username stripped), move, tasks, meta }`; `importLegacy(username, password, fetchImpl = fetch)` → the import-ready state, or throws `Error("import-failed")` on any fetch/parse/decrypt failure.

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/migration.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toImportState, importLegacy } from "../js/migration.js";
import { encrypt } from "../js/crypto.js";

test("toImportState strips profile.username and defaults arrays", () => {
  const out = toImportState({
    profile: { username: "anirudh", createdAt: "2026-01-01" },
    move: { newZip: "78701" }, tasks: [{ id: "a" }], meta: { onboarded: true, schemaVersion: 1 },
  });
  assert.equal("username" in out.profile, false);
  assert.equal(out.profile.createdAt, "2026-01-01");
  assert.equal(out.move.newZip, "78701");
  assert.deepEqual(out.tasks, [{ id: "a" }]);
  assert.equal(out.meta.onboarded, true);
});

test("importLegacy fetches, decrypts, and returns stripped state", async () => {
  const oldState = { profile: { username: "anirudh", createdAt: "x" },
    move: { newZip: "78701" }, tasks: [{ id: "usps-forwarding", status: "completed" }],
    meta: { onboarded: true, schemaVersion: 1 } };
  const blob = await encrypt("pw123456", oldState);
  const fakeFetch = async (url) => {
    assert.match(url, /anirudh\.enc\.json$/);
    return { ok: true, text: async () => JSON.stringify(blob) };
  };
  const out = await importLegacy("Anirudh", "pw123456", fakeFetch);
  assert.equal("username" in out.profile, false);
  assert.equal(out.tasks[0].status, "completed");
});

test("importLegacy throws import-failed on wrong password", async () => {
  const blob = await encrypt("right", { profile: {}, move: {}, tasks: [], meta: {} });
  const fakeFetch = async () => ({ ok: true, text: async () => JSON.stringify(blob) });
  await assert.rejects(() => importLegacy("anirudh", "wrong", fakeFetch), /import-failed/);
});

test("importLegacy throws import-failed on 404", async () => {
  const fakeFetch = async () => ({ ok: false, status: 404, text: async () => "" });
  await assert.rejects(() => importLegacy("ghost", "pw", fakeFetch), /import-failed/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test 'tests/migration.test.js'`
Expected: FAIL — cannot find `../js/migration.js`.

- [ ] **Step 3: Implement `moving-checklist/js/migration.js`**

```js
// One-time import of a legacy password-encrypted profile from the old git-backed store.
import { decrypt } from "./crypto.js";

const OWNER = "proxy-eval-max";
const REPO = "proxy-eval-max.github.io";

export function toImportState(oldState) {
  const src = oldState || {};
  const profile = { ...(src.profile || {}) };
  delete profile.username;
  return {
    profile,
    move: src.move,
    tasks: src.tasks || [],
    meta: src.meta || { onboarded: true, schemaVersion: 1 },
  };
}

export async function importLegacy(username, password, fetchImpl = fetch) {
  const uname = (username || "").trim().toLowerCase();
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/moving-checklist/data/${uname}.enc.json`;
  let res;
  try { res = await fetchImpl(url); } catch { throw new Error("import-failed"); }
  if (!res.ok) throw new Error("import-failed");
  let blob;
  try { blob = JSON.parse(await res.text()); } catch { throw new Error("import-failed"); }
  let state;
  try { state = await decrypt(password, blob); } catch { throw new Error("import-failed"); }
  return toImportState(state);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test 'tests/migration.test.js'`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add moving-checklist/js/migration.js moving-checklist/tests/migration.test.js
git commit -m "feat: add one-time legacy profile import"
```

---

## Task 5: Rewrite auth around Firebase Auth

**Files:**
- Rewrite: `moving-checklist/js/auth.js`
- Rewrite (replace): `moving-checklist/tests/auth.test.js`

**Interfaces:**
- Produces: `signInWithGoogle(deps)` → the signed-in user (throws `Error("popup-closed")`, `Error("popup-blocked")`, or `Error("signin-failed")`); `logout(deps)` → the `signOut` promise; `onAuth(deps, cb)` → registers `onAuthStateChanged(auth, cb)` and returns its unsubscribe; `currentUser(deps)` → `auth.currentUser`. `deps = { auth, provider, signInWithPopup, signOut, onAuthStateChanged }` (matches `firebase.js` `authDeps`).

- [ ] **Step 1: Write the failing test** — replace `moving-checklist/tests/auth.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { signInWithGoogle, logout, onAuth, currentUser } from "../js/auth.js";

function fakeDeps(overrides = {}) {
  const calls = { signIn: 0, signOut: 0, onAuth: 0 };
  const deps = {
    calls,
    auth: { currentUser: overrides.currentUser ?? null },
    provider: { name: "google" },
    signInWithPopup: async (auth, provider) => {
      calls.signIn++; assert.equal(provider.name, "google");
      if (overrides.signInError) throw overrides.signInError;
      return { user: { uid: "u1", displayName: "Rwik" } };
    },
    signOut: async () => { calls.signOut++; },
    onAuthStateChanged: (auth, cb) => { calls.onAuth++; calls.cb = cb; return () => { calls.unsub = true; }; },
  };
  return deps;
}

test("signInWithGoogle returns the user on success", async () => {
  const deps = fakeDeps();
  const user = await signInWithGoogle(deps);
  assert.equal(user.uid, "u1");
  assert.equal(deps.calls.signIn, 1);
});

test("signInWithGoogle maps popup-closed", async () => {
  const deps = fakeDeps({ signInError: { code: "auth/popup-closed-by-user" } });
  await assert.rejects(() => signInWithGoogle(deps), /popup-closed/);
});

test("signInWithGoogle maps popup-blocked", async () => {
  const deps = fakeDeps({ signInError: { code: "auth/popup-blocked" } });
  await assert.rejects(() => signInWithGoogle(deps), /popup-blocked/);
});

test("signInWithGoogle maps unknown errors to signin-failed", async () => {
  const deps = fakeDeps({ signInError: { code: "auth/network-request-failed" } });
  await assert.rejects(() => signInWithGoogle(deps), /signin-failed/);
});

test("onAuth registers the callback and logout calls signOut", async () => {
  const deps = fakeDeps();
  const cb = () => {};
  const unsub = onAuth(deps, cb);
  assert.equal(deps.calls.onAuth, 1);
  assert.equal(deps.calls.cb, cb);
  unsub(); assert.equal(deps.calls.unsub, true);
  await logout(deps);
  assert.equal(deps.calls.signOut, 1);
});

test("currentUser reads auth.currentUser", () => {
  const deps = fakeDeps({ currentUser: { uid: "u9" } });
  assert.equal(currentUser(deps).uid, "u9");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test 'tests/auth.test.js'`
Expected: FAIL — new exports don't exist / old username-token API mismatch.

- [ ] **Step 3: Rewrite `moving-checklist/js/auth.js`**

```js
// Firebase Auth (Google) wrappers. Firebase primitives arrive via `deps`
// ({ auth, provider, signInWithPopup, signOut, onAuthStateChanged }) so the wiring
// seam is testable without the SDK.
export async function signInWithGoogle(deps) {
  try {
    const res = await deps.signInWithPopup(deps.auth, deps.provider);
    return res.user;
  } catch (e) {
    const code = e && e.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request")
      throw new Error("popup-closed");
    if (code === "auth/popup-blocked") throw new Error("popup-blocked");
    throw new Error("signin-failed");
  }
}

export function logout(deps) { return deps.signOut(deps.auth); }
export function onAuth(deps, cb) { return deps.onAuthStateChanged(deps.auth, cb); }
export function currentUser(deps) { return deps.auth.currentUser; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test 'tests/auth.test.js'`
Expected: PASS (6 tests).

- [ ] **Step 5: Run full suite**

Run: `cd moving-checklist && node --test 'tests/*.test.js'`
Expected: all pass (crypto, dates, tasks-data, rules, firestore, store, migration, auth).

- [ ] **Step 6: Commit**

```bash
git add moving-checklist/js/auth.js moving-checklist/tests/auth.test.js
git commit -m "feat: rewrite auth around Firebase Google sign-in"
```

---

## Task 6: Rewrite settings view

**Files:**
- Rewrite: `moving-checklist/js/views/settings.js`

**Interfaces:**
- Consumes: `ui` (`el`/`clear`), `store` (`remove`/`exportText`/`importState`), `rules` (`mergeTasks`), `migration` (`importLegacy`). Uses the `ctx` contract `{ state, save, navigate, toast }`.
- Produces: `render(root, ctx)`.

- [ ] **Step 1: Rewrite `moving-checklist/js/views/settings.js`**

```js
import { el, clear } from "../ui.js";
import * as store from "../store.js";
import { mergeTasks } from "../rules.js";
import { importLegacy } from "../migration.js";

export function render(root, ctx) {
  clear(root);
  const st = ctx.state;

  // Move details (regenerate, preserving progress)
  const zip = el("input", { value: st.move.newZip || "", "aria-label": "New ZIP" });
  const date = el("input", { type: "date", value: st.move.moveDate || "", "aria-label": "Move date" });
  const regen = el("button", { class: "primary", type: "button", text: "Update & regenerate" });
  regen.onclick = async () => {
    st.move.newZip = zip.value; st.move.moveDate = date.value;
    st.tasks = mergeTasks(st.tasks || [], st.move);
    const ok = await ctx.save();
    if (ok) ctx.toast("Checklist updated.");
    ctx.navigate("#/");
  };

  // One-time import from the legacy password-based version
  const iUser = el("input", { "aria-label": "Old username" });
  const iPass = el("input", { type: "password", "aria-label": "Old password" });
  const iErr = el("p", { class: "error", role: "alert" });
  const importBtn = el("button", { type: "button", text: "Import my old checklist" });
  importBtn.onclick = async () => {
    iErr.textContent = "";
    if (!confirm("Importing will REPLACE your current checklist with the imported one. Continue?")) return;
    try {
      const state = await importLegacy(iUser.value, iPass.value);
      store.importState(state);
      const ok = await ctx.save();
      if (ok) { ctx.toast("Imported."); ctx.navigate("#/"); }
    } catch {
      iErr.textContent = "Could not import — check the username and password.";
    }
  };

  // Backup (plaintext JSON)
  const backup = el("button", { type: "button", text: "Download my data (JSON)" });
  backup.onclick = () => {
    const blob = new Blob([store.exportText()], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "moveaddress-data.json" });
    document.body.append(a); a.click(); a.remove();
  };

  // Delete
  const del = el("button", { type: "button", text: "Delete my data" });
  del.style.borderColor = "var(--danger)"; del.style.color = "var(--danger)";
  del.onclick = async () => {
    if (!confirm("Delete your checklist data from the database? This cannot be undone.")) return;
    try { await store.remove(); location.hash = ""; location.reload(); }
    catch { ctx.toast("Delete failed."); }
  };

  root.append(
    el("h1", { text: "Settings" }),
    el("section", { class: "card" }, [
      el("h2", { text: "Move details" }),
      el("label", { text: "New ZIP code" }), zip,
      el("label", { text: "Move date" }), date,
      el("p", { class: "muted", text: "Regenerating keeps your status, notes, and confirmation numbers on tasks that still apply." }),
      el("div", { class: "row" }, [regen]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Import old checklist" }),
      el("p", { class: "muted", text: "One-time import from the previous password-based version. This replaces your current data." }),
      el("label", { text: "Old username" }), iUser,
      el("label", { text: "Old password" }), iPass, iErr,
      el("div", { class: "row" }, [importBtn]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Your data" }),
      el("p", { class: "muted", text: "Your data is stored privately in your account — only you can read it." }),
      el("div", { class: "row" }, [backup]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Danger zone" }),
      el("div", { class: "row" }, [del]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Disclaimer" }),
      el("p", { class: "muted", text: "MoveAddress is informational and is not a law firm. Requirements can change and official agency instructions control. Immigration, tax, and legal guidance here is not legal advice — verify high-stakes requirements with official sources." }),
    ]),
  );
}
```

- [ ] **Step 2: Verify parse**

Run: `cd moving-checklist && node --check js/views/settings.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add moving-checklist/js/views/settings.js
git commit -m "feat: settings view for Firebase (import, JSON backup, delete)"
```

---

## Task 7: Rewrite app boot + Google sign-in gate

**Files:**
- Rewrite: `moving-checklist/js/app.js`

**Interfaces:**
- Consumes: `auth`, `store`, `firebase.js` (`authDeps`, `fsDeps`), `firebase-config.js` (`isConfigured`), `ui`, and the five view modules. Provides `ctx = { state, save, navigate, toast }` to views (task-detail also gets `taskId`).

- [ ] **Step 1: Rewrite `moving-checklist/js/app.js`**

```js
import * as auth from "./auth.js";
import * as store from "./store.js";
import { authDeps, fsDeps } from "./firebase.js";
import { isConfigured } from "./firebase-config.js";
import { el, clear, qs } from "./ui.js";
import * as onboarding from "./views/onboarding.js";
import * as dashboard from "./views/dashboard.js";
import * as checklist from "./views/checklist.js";
import * as taskDetail from "./views/task-detail.js";
import * as settings from "./views/settings.js";

const main = () => qs("#main");

export function toast(msg) {
  const t = qs("#toast"); t.textContent = msg; t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 2500);
}

async function save() {
  try { await store.save(); toast("Saved."); return true; }
  catch { toast("Save failed — check your connection."); return false; }
}

function ctx() { return { state: store.getState(), save, navigate, toast }; }

const ROUTES = { onboarding, checklist, settings };

export function navigate(route) {
  if (route && location.hash !== route) { location.hash = route; return; }
  render();
}

function render() {
  const st = store.getState();
  if (!st) { mountGate(); return; }
  renderTopbar();
  const hash = location.hash.replace(/^#\//, "");
  const root = main(); clear(root); root.focus();
  if (!st.meta.onboarded && hash !== "onboarding") { location.hash = "#/onboarding"; return; }
  if (hash.startsWith("task/")) return taskDetail.render(root, ctx(), hash.slice(5));
  const view = ROUTES[hash] || dashboard;
  markActive(hash || "dashboard");
  view.render(root, ctx());
}

function markActive(name) {
  for (const a of document.querySelectorAll("#nav a"))
    a.classList.toggle("active", a.dataset.route === name);
}

function renderTopbar() {
  const bar = qs("#topbar"); bar.hidden = false;
  const nav = qs("#nav"); clear(nav);
  for (const [route, href, label] of [["dashboard", "#/", "Dashboard"],
    ["checklist", "#/checklist", "Checklist"], ["settings", "#/settings", "Settings"]])
    nav.append(el("a", { href, "data-route": route, text: label }));
  const u = auth.currentUser(authDeps);
  qs("#who").textContent = u ? (u.displayName || u.email || "") : "";
  qs("#logout-btn").onclick = () => auth.logout(authDeps); // onAuth fires → gate
}

export function mountGate() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const err = el("p", { class: "error", role: "alert" });
  const btn = el("button", { class: "primary", type: "button", text: "Sign in with Google" });
  btn.onclick = async () => {
    err.textContent = "";
    try { await auth.signInWithGoogle(authDeps); }
    catch (e) {
      err.textContent = e.message === "popup-blocked" ? "Popup blocked — allow popups and try again."
        : e.message === "popup-closed" ? "Sign-in cancelled." : "Sign-in failed. Try again.";
    }
  };
  root.append(
    el("h1", { text: "MoveAddress" }),
    el("p", { class: "muted", text: "Your personalized moving address-change checklist." }),
    err,
    el("section", { class: "card" }, [
      el("h2", { text: "Sign in" }),
      el("p", { class: "muted", text: "Sign in with your Google account to create or open your checklist." }),
      el("div", { class: "row" }, [btn]),
    ]),
    el("p", { class: "muted", html: "Informational only — not legal advice. Official agency instructions control. Verify high-stakes requirements (immigration, taxes, licensing) with official sources." }),
  );
}

async function onUser(user) {
  if (!user) { store.clear(); location.hash = ""; mountGate(); return; }
  try {
    const data = await store.load(user.uid);
    if (!data) store.startFresh(user.uid);
  } catch {
    main().innerHTML = "<h1>Could not load your data</h1><p>Check your connection and reload.</p>";
    return;
  }
  if (!location.hash) location.hash = "#/";
  render();
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (!isConfigured()) {
    main().innerHTML = "<h1>Setup needed</h1><p>Firebase is not configured. Set your project's web config in <code>js/firebase-config.js</code>.</p>";
    return;
  }
  store.configure(fsDeps);
  auth.onAuth(authDeps, onUser);
});
```

- [ ] **Step 2: Verify parse + whole-app parse sweep**

Run: `cd moving-checklist && node --check js/app.js && for f in js/firebase.js js/firebase-config.js js/firestore.js js/store.js js/auth.js js/migration.js js/views/*.js; do node --check "$f" || echo "PARSE FAIL: $f"; done`
Expected: no output / no "PARSE FAIL" lines.

- [ ] **Step 3: Confirm no dangling references to removed APIs**

Run: `grep -rn "getToken\|setToken\|clearToken\|github\.js\|createProfile\|validUsername\|exportBlobText\|store.load(\"" moving-checklist/js` 
Expected: no matches (old token/username/github/encrypted-store APIs fully gone from the JS).

- [ ] **Step 4: Commit**

```bash
git add moving-checklist/js/app.js
git commit -m "feat: Google sign-in gate + Firebase auth boot"
```

---

## Task 8: Verification, docs, owner handoff

**Files:**
- Modify: `moving-checklist/README.md`
- Modify: `README.md` (top-level pointer)

- [ ] **Step 1: Full test suite + parse sweep**

Run: `cd moving-checklist && node --test 'tests/*.test.js'`
Expected: all pass — crypto, dates, tasks-data, rules, firestore, store, migration, auth. (No github tests.)
Run the parse sweep from Task 7 Step 2 again; expect clean.

- [ ] **Step 2: Rewrite `moving-checklist/README.md`**

```markdown
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
```

- [ ] **Step 3: Update the top-level `README.md` pointer**

Read the current top-level README. The existing pointer block mentions setup via the app's README; the description paragraph mentions PBKDF2/AES-GCM encryption, which is now only true for the legacy path. Update the description paragraph (added earlier at the top) so the sentence about encryption reads for the current design:

Replace the sentence:
`Each person has their own profile, encrypted with their password (PBKDF2 + AES-GCM) and synced to this repo, so no one else can read their data.`
with:
`Each person signs in with Google and their checklist is stored privately in their own Firebase account, readable only by them.`

Use Edit to change only that sentence; leave the rest of the README intact.

- [ ] **Step 4: Commit**

```bash
git add moving-checklist/README.md README.md
git commit -m "docs: update for Firebase auth + Firestore storage"
```

- [ ] **Step 5: Owner manual E2E (requires Firebase config from §3 of the spec)**

Not automatable here — the owner performs after filling `js/firebase-config.js` and completing the Firebase console setup:
1. Serve locally or use the live site; sign in with Google → land on onboarding → complete it → dashboard renders.
2. Change a task status + confirmation number, Save → reload the page → still signed in, state restored from Firestore.
3. Sign out; sign in with a *different* Google account → independent empty checklist; confirm neither account sees the other's data.
4. Settings → Import old checklist → enter `anirudh` + old password → verify the old checklist imports.
Document any failure and fix before relying on it.

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** hosting unchanged (all tasks); Firebase setup documented (Task 8 §Step 2, spec §3); Google auth (Task 5, app gate Task 7); Firestore model + rules (Task 2 + docs); config/SDK loading (Task 1, constraint-pinned 10.12.0); migration (Task 4 + settings Task 6); error handling (auth error mapping Task 5, save/load guards Tasks 3/7, config guard Task 7, import failure Task 4/6); testing (Tasks 2–5 Node tests + Task 8 sweep + owner E2E); security notes (docs).
- **Removed:** GitHub Contents write path, PAT handling, encrypted per-user files, username/password auth — verified absent by the Task 7 Step 3 grep.
- **Type/contract consistency:** `deps` shapes match `firebase.js` exports (`authDeps`/`fsDeps`) and the injected test fakes; `ctx` is `{state, save, navigate, toast}` in app.js and every view (token dropped); the `move` keys and task-state shape are identical to the existing (unchanged) onboarding/rules/views; `store` exports consumed by app.js (`configure`, `load`, `startFresh`, `getState`, `clear`) and settings.js (`remove`, `exportText`, `importState`) all exist in the Task 3 rewrite.
- **Unchanged views** (onboarding/dashboard/checklist/task-detail) already use only `ctx.state` + `{state,save,navigate,toast}`; no edits needed — confirm during the Task 7 parse sweep.
```
