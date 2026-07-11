# Moving Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-protected, per-user moving address-change checklist (MVP of the README "MoveAddress" product) as a static site served at `https://proxy-eval-max.github.io/moving-checklist/`.

**Architecture:** Static single-page app in vanilla JS ES modules, no build step. Each user profile is one AES-GCM-encrypted JSON file in the repo (`moving-checklist/data/<username>.enc.json`); the password derives the encryption key via PBKDF2. Reads go through the GitHub Contents API unauthenticated (public repo); writes use a fine-grained Personal Access Token. A hand-rolled hash router switches views inside one `index.html`.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES modules), Web Crypto API (`crypto.subtle`), GitHub Contents REST API. Tests run with Node's built-in test runner (`node --test`); Node 26 provides global `crypto.subtle` and `fetch`.

## Global Constraints

- All app files live under top-level `moving-checklist/`. Served at `/moving-checklist/`. Encrypted data under `moving-checklist/data/`.
- **No build step, no framework, no bundler, no runtime dependencies.** Browser loads modules via `<script type="module">`. All asset paths **relative**.
- Repo: owner `proxy-eval-max`, repo `proxy-eval-max.github.io`, branch `main`. API base: `https://api.github.com`.
- Crypto: PBKDF2, SHA-256, **250000** iterations, 16-byte salt; AES-GCM, 12-byte IV, 128-bit tag. Use global `crypto` (works in browser and Node 26).
- Usernames: normalized `toLowerCase()`, must match `^[a-z0-9_-]{1,32}$` (safe filenames, no path traversal).
- Passwords: minimum length **8** on create-profile.
- Encrypted file format version `v: 1`. State `schemaVersion: 1`.
- No sensitive identifiers ever collected (no SSN, DL#, passport, bank#).
- Add top-level `.nojekyll`; add `moving-checklist/package.json` = `{"type":"module"}` (for Node ESM tests; ignored by GitHub Pages).
- Commit style: conventional commits; each task ends with a commit.

---

## File Structure

```
.nojekyll                         # top-level; disable Jekyll
moving-checklist/
  package.json                    # {"type":"module"} — test tooling only
  index.html                      # shell + auth gate + view container
  css/styles.css                  # responsive, accessible, light/dark aware
  js/
    b64.js                        # base64 <-> Uint8Array helpers
    crypto.js                     # PBKDF2 + AES-GCM encrypt/decrypt
    dates.js                      # move-date offset -> recommended/deadline dates
    tasks-data.js                 # national + TX/Austin task templates
    rules.js                      # personalization engine (README §9)
    github.js                     # Contents API getFile/putFile/deleteFile
    store.js                      # in-memory state, load/save/export/delete
    auth.js                       # login / createProfile / logout / session
    ui.js                         # tiny DOM helpers (el, clear, on)
    app.js                        # boot + hash router + auth gate wiring
    views/
      onboarding.js
      dashboard.js
      checklist.js
      task-detail.js
      settings.js
  data/
    .gitkeep
  tests/
    crypto.test.js
    dates.test.js
    tasks-data.test.js
    rules.test.js
    github.test.js
    store.test.js
    auth.test.js
```

---

## Task 1: Scaffold — folder, config, shell, DOM helpers

**Files:**
- Create: `.nojekyll`
- Create: `moving-checklist/package.json`
- Create: `moving-checklist/data/.gitkeep`
- Create: `moving-checklist/index.html`
- Create: `moving-checklist/css/styles.css`
- Create: `moving-checklist/js/ui.js`

**Interfaces:**
- Produces: `ui.js` exports `el(tag, attrs = {}, children = [])`, `clear(node)`, `on(node, event, handler)`, `qs(sel, root = document)`.

- [ ] **Step 1: Create config + placeholder files**

`.nojekyll` (empty file).

`moving-checklist/package.json`:
```json
{
  "name": "moving-checklist",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

`moving-checklist/data/.gitkeep` (empty file).

- [ ] **Step 2: Create `moving-checklist/js/ui.js`**

```js
// Tiny DOM helpers. No framework.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v === true ? "" : String(v));
    }
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
export function on(node, event, handler) { node.addEventListener(event, handler); return node; }
export function qs(sel, root = document) { return root.querySelector(sel); }
```

- [ ] **Step 3: Create `moving-checklist/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MoveAddress — Moving Checklist</title>
  <link rel="stylesheet" href="./css/styles.css" />
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header id="topbar" hidden>
    <span class="brand">MoveAddress</span>
    <nav id="nav" aria-label="Main"></nav>
    <span class="spacer"></span>
    <span id="who"></span>
    <button id="logout-btn" type="button">Log out</button>
  </header>
  <main id="main" tabindex="-1"></main>
  <div id="toast" role="status" aria-live="polite" hidden></div>
  <script type="module" src="./js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `moving-checklist/css/styles.css`**

```css
:root {
  --bg: #ffffff; --fg: #14181f; --muted: #5b6570; --line: #dfe3e8;
  --card: #f6f8fa; --accent: #1a56db; --accent-fg: #fff;
  --ok: #167c3d; --warn: #b45309; --danger: #b42318; --radius: 10px;
}
@media (prefers-color-scheme: dark) {
  :root { --bg:#0f1419; --fg:#e6e9ee; --muted:#9aa4b0; --line:#252c36;
    --card:#171d25; --accent:#4f83ff; --accent-fg:#0f1419; }
}
* { box-sizing: border-box; }
body { margin:0; font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  background:var(--bg); color:var(--fg); }
.skip-link { position:absolute; left:-999px; }
.skip-link:focus { left:8px; top:8px; background:var(--accent); color:var(--accent-fg);
  padding:8px 12px; border-radius:6px; z-index:10; }
#topbar { display:flex; align-items:center; gap:12px; padding:10px 16px;
  border-bottom:1px solid var(--line); flex-wrap:wrap; }
.brand { font-weight:700; }
.spacer { flex:1; }
#nav a { color:var(--fg); text-decoration:none; padding:6px 10px; border-radius:6px; }
#nav a.active, #nav a:hover { background:var(--card); }
#main { max-width:880px; margin:0 auto; padding:20px 16px 64px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:var(--radius);
  padding:16px; margin:12px 0; }
h1,h2,h3 { line-height:1.25; }
label { display:block; margin:10px 0 4px; font-weight:600; }
input,select,textarea,button { font:inherit; }
input,select,textarea { width:100%; padding:10px; border:1px solid var(--line);
  border-radius:8px; background:var(--bg); color:var(--fg); }
button { cursor:pointer; padding:10px 16px; border:1px solid var(--line);
  border-radius:8px; background:var(--card); color:var(--fg); min-height:44px; }
button.primary { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
button:focus-visible, a:focus-visible, input:focus-visible { outline:3px solid var(--accent);
  outline-offset:2px; }
.error { color:var(--danger); font-weight:600; }
.muted { color:var(--muted); }
.badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px;
  border:1px solid var(--line); }
.badge.legally-required { color:var(--danger); border-color:var(--danger); }
.badge.financially-important { color:var(--warn); border-color:var(--warn); }
.row { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.ring { --p:0; width:120px; height:120px; border-radius:50%;
  background:conic-gradient(var(--accent) calc(var(--p)*1%), var(--line) 0);
  display:grid; place-items:center; }
.ring > span { width:88px; height:88px; border-radius:50%; background:var(--bg);
  display:grid; place-items:center; font-weight:700; font-size:20px; }
#toast { position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
  background:var(--fg); color:var(--bg); padding:10px 16px; border-radius:8px; z-index:20; }
ul.tasklist { list-style:none; padding:0; }
ul.tasklist li { border:1px solid var(--line); border-radius:8px; padding:12px;
  margin:8px 0; background:var(--bg); }
ul.tasklist a { color:var(--fg); text-decoration:none; font-weight:600; }
.controls { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
@media (max-width:560px){ #main{padding:12px;} .ring{width:96px;height:96px;} }
```

- [ ] **Step 5: Verify scaffold loads and Node ESM works**

Run: `cd moving-checklist && node -e "import('./js/ui.js').then(m=>console.log(typeof m.el))"`
Expected: prints `function`

Run: `python3 -m http.server -d moving-checklist 8099 >/dev/null 2>&1 & sleep 1; curl -s -o /dev/null -w "%{http_code}" http://localhost:8099/index.html; kill %1`
Expected: `200`

- [ ] **Step 6: Commit**

```bash
git add .nojekyll moving-checklist/package.json moving-checklist/data/.gitkeep \
  moving-checklist/index.html moving-checklist/css/styles.css moving-checklist/js/ui.js
git commit -m "feat: scaffold moving-checklist static app shell"
```

---

## Task 2: base64 helpers + crypto (PBKDF2 + AES-GCM)

**Files:**
- Create: `moving-checklist/js/b64.js`
- Create: `moving-checklist/js/crypto.js`
- Test: `moving-checklist/tests/crypto.test.js`

**Interfaces:**
- `b64.js`: `bytesToB64(uint8)` → string; `b64ToBytes(str)` → Uint8Array.
- `crypto.js`: `async encrypt(password, plaintextObj)` → `{ kdf:{algo:"PBKDF2",hash:"SHA-256",iterations:250000,salt}, cipher:{algo:"AES-GCM",iv}, ciphertext }` (salt/iv/ciphertext base64). `async decrypt(password, blob)` → the original object; throws `Error("decrypt-failed")` on wrong password or tamper.

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/crypto.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt } from "../js/crypto.js";

test("round-trips an object", async () => {
  const obj = { hello: "world", n: 42, nested: { a: [1, 2, 3] } };
  const blob = await encrypt("correct horse", obj);
  assert.equal(blob.kdf.iterations, 250000);
  assert.ok(blob.kdf.salt && blob.cipher.iv && blob.ciphertext);
  const out = await decrypt("correct horse", blob);
  assert.deepEqual(out, obj);
});

test("wrong password fails", async () => {
  const blob = await encrypt("right", { a: 1 });
  await assert.rejects(() => decrypt("wrong", blob), /decrypt-failed/);
});

test("tampered ciphertext fails", async () => {
  const blob = await encrypt("pw", { a: 1 });
  const bad = { ...blob, ciphertext: blob.ciphertext.slice(0, -4) + "AAAA" };
  await assert.rejects(() => decrypt("pw", bad), /decrypt-failed/);
});

test("two encryptions of same data differ (random salt/iv)", async () => {
  const a = await encrypt("pw", { x: 1 });
  const b = await encrypt("pw", { x: 1 });
  assert.notEqual(a.ciphertext, b.ciphertext);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test tests/crypto.test.js`
Expected: FAIL — cannot find `../js/crypto.js`.

- [ ] **Step 3: Implement `moving-checklist/js/b64.js`**

```js
export function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
```

- [ ] **Step 4: Implement `moving-checklist/js/crypto.js`**

```js
import { bytesToB64, b64ToBytes } from "./b64.js";

const ITERATIONS = 250000;
const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(password, plaintextObj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = enc.encode(JSON.stringify(plaintextObj));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, data));
  return {
    kdf: { algo: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt: bytesToB64(salt) },
    cipher: { algo: "AES-GCM", iv: bytesToB64(iv) },
    ciphertext: bytesToB64(ct),
  };
}

export async function decrypt(password, blob) {
  try {
    const salt = b64ToBytes(blob.kdf.salt);
    const iv = b64ToBytes(blob.cipher.iv);
    const key = await deriveKey(password, salt);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, key, b64ToBytes(blob.ciphertext));
    return JSON.parse(dec.decode(pt));
  } catch {
    throw new Error("decrypt-failed");
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd moving-checklist && node --test tests/crypto.test.js`
Expected: PASS (4 tests). Note: Node's `btoa`/`atob` are global in Node 26.

- [ ] **Step 6: Commit**

```bash
git add moving-checklist/js/b64.js moving-checklist/js/crypto.js moving-checklist/tests/crypto.test.js
git commit -m "feat: add base64 helpers and PBKDF2/AES-GCM crypto"
```

---

## Task 3: date logic

**Files:**
- Create: `moving-checklist/js/dates.js`
- Test: `moving-checklist/tests/dates.test.js`

**Interfaces:**
- Produces: `addDays(isoDate, n)` → `YYYY-MM-DD`; `recommendedDate(moveDate, offsetDays)` → `YYYY-MM-DD` (offset negative = before move); `daysBetween(fromIso, toIso)` → integer; `bucket(recommendedIso, todayIso)` → one of `"overdue" | "due_soon" | "upcoming"` (`due_soon` = within 7 days inclusive, not past).

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/dates.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, recommendedDate, daysBetween, bucket } from "../js/dates.js";

test("addDays handles month boundaries", () => {
  assert.equal(addDays("2026-01-30", 3), "2026-02-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("recommendedDate applies offset from move date", () => {
  assert.equal(recommendedDate("2026-08-01", -14), "2026-07-18");
  assert.equal(recommendedDate("2026-08-01", 10), "2026-08-11");
});

test("daysBetween counts calendar days", () => {
  assert.equal(daysBetween("2026-07-11", "2026-07-18"), 7);
  assert.equal(daysBetween("2026-07-18", "2026-07-11"), -7);
});

test("bucket classifies relative to today", () => {
  assert.equal(bucket("2026-07-01", "2026-07-11"), "overdue");
  assert.equal(bucket("2026-07-15", "2026-07-11"), "due_soon");
  assert.equal(bucket("2026-08-30", "2026-07-11"), "upcoming");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test tests/dates.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `moving-checklist/js/dates.js`**

```js
// All dates are "YYYY-MM-DD" strings, treated as UTC calendar days.
function toUTC(iso) { const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d); }
function fromUTC(ms) { return new Date(ms).toISOString().slice(0, 10); }
const DAY = 86400000;

export function addDays(iso, n) { return fromUTC(toUTC(iso) + n * DAY); }
export function recommendedDate(moveDate, offsetDays) { return addDays(moveDate, offsetDays); }
export function daysBetween(fromIso, toIso) { return Math.round((toUTC(toIso) - toUTC(fromIso)) / DAY); }
export function bucket(recommendedIso, todayIso) {
  const d = daysBetween(todayIso, recommendedIso);
  if (d < 0) return "overdue";
  if (d <= 7) return "due_soon";
  return "upcoming";
}
export function todayIso() { return new Date().toISOString().slice(0, 10); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test tests/dates.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add moving-checklist/js/dates.js moving-checklist/tests/dates.test.js
git commit -m "feat: add move-date offset and bucketing logic"
```

---

## Task 4: task templates data

**Files:**
- Create: `moving-checklist/js/tasks-data.js`
- Test: `moving-checklist/tests/tasks-data.test.js`

**Interfaces:**
- Produces: `TEMPLATES` array. Each template: `{ id, title, category, description, reason, priority, offsetDays, deadlineNote, timing:"before"|"after"|"any", officialUrl, agency, method, estTime, requiredInfo:[], steps:[], verifiedOn, applies:(a)=>boolean }` where `a` is the onboarding answers object (see Task 6 shape). `priority` ∈ `"Legally required"|"Financially important"|"Prevents service interruption"|"Recommended"|"Optional"`. `CATEGORIES` array of strings for grouping/order.

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/tasks-data.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, CATEGORIES } from "../js/tasks-data.js";

const PRIORITIES = ["Legally required","Financially important",
  "Prevents service interruption","Recommended","Optional"];

test("templates are well-formed with unique ids", () => {
  assert.ok(TEMPLATES.length >= 15);
  const ids = new Set();
  for (const t of TEMPLATES) {
    assert.match(t.id, /^[a-z0-9-]+$/, `bad id ${t.id}`);
    assert.ok(!ids.has(t.id), `dup id ${t.id}`); ids.add(t.id);
    for (const f of ["title","category","description","reason","priority",
      "timing","officialUrl","agency","method","estTime","verifiedOn"]) {
      assert.ok(t[f] != null && t[f] !== "", `${t.id} missing ${f}`);
    }
    assert.ok(PRIORITIES.includes(t.priority), `${t.id} bad priority`);
    assert.ok(["before","after","any"].includes(t.timing));
    assert.ok(Number.isInteger(t.offsetDays));
    assert.ok(Array.isArray(t.steps) && t.steps.length > 0);
    assert.ok(CATEGORIES.includes(t.category), `${t.id} category not listed`);
    assert.equal(typeof t.applies, "function");
    assert.match(t.officialUrl, /^https:\/\//);
  }
});

test("USPS mail forwarding applies to everyone", () => {
  const usps = TEMPLATES.find(t => t.id === "usps-forwarding");
  assert.ok(usps);
  assert.equal(usps.applies({}), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test tests/tasks-data.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `moving-checklist/js/tasks-data.js`**

```js
// Task templates: national baseline + Texas/Austin specifics.
// `applies(a)` receives onboarding answers (see rules.js / store.js state.move).
export const CATEGORIES = [
  "Mail and identity", "Government", "Vehicle and transportation", "Utilities",
  "Financial accounts", "Insurance", "Employment", "Health",
  "Family and education", "Pets", "Immigration", "Professional licenses",
  "Shopping and subscriptions", "Property and housing",
];

const isTX = (a) => (a.newZip || "").startsWith("7");       // TX ZIPs start 75-79/733
const movingToNewState = (a) => a.moveType === "across_states";

export const TEMPLATES = [
  {
    id: "usps-forwarding", title: "Set up USPS mail forwarding",
    category: "Mail and identity",
    description: "Forward mail from your old address to your new one.",
    reason: "Ensures you keep receiving important mail during the transition.",
    priority: "Prevents service interruption", offsetDays: -14, timing: "any",
    deadlineNote: "Start ~2 weeks before moving so forwarding is active on move day.",
    officialUrl: "https://moversguide.usps.com/", agency: "USPS",
    method: "Online", estTime: "10 minutes",
    requiredInfo: ["Old address", "New address", "Move date", "Payment for $1.10 identity fee"],
    steps: ["Open the official USPS Mover's Guide.",
      "Choose individual or family forwarding.", "Enter old and new addresses and start date.",
      "Pay the small identity-verification fee.", "Save the confirmation code."],
    verifiedOn: "2026-07-11", applies: () => true,
  },
  {
    id: "voter-registration", title: "Update voter registration",
    category: "Government",
    description: "Update your voter registration to your new address.",
    reason: "You told us you are registered to vote; your registration must match your address.",
    priority: "Legally required", offsetDays: 7, timing: "after",
    deadlineNote: "Update promptly; deadlines apply before elections.",
    officialUrl: "https://vote.gov/", agency: "State election office",
    method: "Online", estTime: "10 minutes",
    requiredInfo: ["New residential address", "ID as required by your state"],
    steps: ["Open vote.gov and select your state.", "Choose 'update registration'.",
      "Enter your new address.", "Submit and save confirmation."],
    verifiedOn: "2026-07-11", applies: (a) => a.voter === true,
  },
  {
    id: "irs-address", title: "Update your address with the IRS",
    category: "Government",
    description: "Notify the IRS of your new address using Form 8822.",
    reason: "Keeps tax correspondence and refunds coming to the right place.",
    priority: "Recommended", offsetDays: 14, timing: "after",
    deadlineNote: "No hard deadline, but do it before tax season.",
    officialUrl: "https://www.irs.gov/faqs/irs-procedures/address-changes",
    agency: "IRS", method: "Online or mail (Form 8822)", estTime: "15 minutes",
    requiredInfo: ["Old and new address", "SSN or ITIN (entered on the IRS site only)"],
    steps: ["Open the official IRS address-change page.",
      "Follow the current method (online account or Form 8822).",
      "Submit and keep a copy for your records."],
    verifiedOn: "2026-07-11", applies: () => true,
  },
  {
    id: "uscis-address", title: "Update your address with USCIS",
    category: "Immigration",
    description: "File a change of address with USCIS.",
    reason: "You indicated you are a permanent resident or visa holder. USPS forwarding does NOT update USCIS, and there is a legal deadline.",
    priority: "Legally required", offsetDays: 3, timing: "after",
    deadlineNote: "Most noncitizens must report an address change to USCIS within 10 days of moving.",
    officialUrl: "https://www.uscis.gov/addresschange", agency: "USCIS",
    method: "Online (USCIS account)", estTime: "20 minutes",
    requiredInfo: ["New address", "Immigration case / receipt numbers"],
    steps: ["Log in to your USCIS online account.", "Open Change of Address (AR-11).",
      "Update the address for all associated cases.",
      "Submit and save the confirmation. This is informational, not legal advice — verify with official USCIS sources."],
    verifiedOn: "2026-07-11",
    applies: (a) => a.immigration === "permanent_resident" || a.immigration === "visa_holder",
  },
  {
    id: "tx-dl-address", title: "Update Texas driver license address",
    category: "Mail and identity",
    description: "Change the address on your Texas driver license or ID.",
    reason: "You own a vehicle / are moving within Texas; your license must reflect your current address.",
    priority: "Legally required", offsetDays: 7, timing: "after",
    deadlineNote: "Texas law requires updating within 30 days of moving.",
    officialUrl: "https://www.dps.texas.gov/section/driver-license/change-your-address",
    agency: "Texas DPS", method: "Online", estTime: "10-15 minutes",
    requiredInfo: ["Current driver license", "New residential address", "Payment for replacement fee"],
    steps: ["Open the official Texas DPS address-change page.",
      "Confirm online eligibility.", "Enter and review the new address.",
      "Pay any replacement fee.", "Save the confirmation number.",
      "Mark complete when the new card arrives."],
    verifiedOn: "2026-07-11", applies: (a) => isTX(a) && !movingToNewState(a),
  },
  {
    id: "tx-vehicle-registration", title: "Update Texas vehicle registration address",
    category: "Vehicle and transportation",
    description: "Update your vehicle registration record with the Texas DMV.",
    reason: "You own or lease a vehicle and are moving within Texas.",
    priority: "Legally required", offsetDays: 10, timing: "after",
    deadlineNote: "Update your registration address promptly after moving.",
    officialUrl: "https://www.txdmv.gov/motorists/register-your-vehicle",
    agency: "Texas DMV", method: "Online or county tax office", estTime: "15 minutes",
    requiredInfo: ["License plate number", "New address", "Insurance information"],
    steps: ["Open the official Texas DMV page.", "Locate address-update for registration.",
      "Enter the new address.", "Submit and save confirmation."],
    verifiedOn: "2026-07-11", applies: (a) => a.hasVehicle && isTX(a) && !movingToNewState(a),
  },
  {
    id: "auto-insurance-garaging", title: "Update auto insurance garaging address",
    category: "Insurance",
    description: "Tell your auto insurer where the vehicle is now kept.",
    reason: "You own a vehicle; premiums and coverage depend on the garaging address.",
    priority: "Financially important", offsetDays: -3, timing: "any",
    deadlineNote: "Update on or before move day to keep coverage accurate.",
    officialUrl: "https://www.naic.org/", agency: "Your auto insurer",
    method: "Call or online account", estTime: "15 minutes",
    requiredInfo: ["Policy number", "New address", "Vehicle details"],
    steps: ["Log in to your insurer or call them.", "Update the garaging/residential address.",
      "Confirm any premium change.", "Save the updated declarations page."],
    verifiedOn: "2026-07-11", applies: (a) => a.hasVehicle === true,
  },
  {
    id: "toll-account", title: "Update toll account address",
    category: "Vehicle and transportation",
    description: "Update your toll transponder account (e.g. TxTag) address.",
    reason: "You own a vehicle; toll bills and violations go to your account address.",
    priority: "Recommended", offsetDays: 7, timing: "after",
    deadlineNote: "Update to avoid missed toll statements.",
    officialUrl: "https://www.txtag.org/", agency: "Toll authority",
    method: "Online account", estTime: "10 minutes",
    requiredInfo: ["Account number", "New address"],
    steps: ["Log in to your toll account.", "Update the mailing address.", "Save confirmation."],
    verifiedOn: "2026-07-11", applies: (a) => a.hasVehicle === true,
  },
  {
    id: "new-state-dl", title: "Apply for a new driver license in your new state",
    category: "Mail and identity",
    description: "Get a driver license issued by your new state.",
    reason: "You are moving to another state and must transfer your license.",
    priority: "Legally required", offsetDays: 14, timing: "after",
    deadlineNote: "Most states require a new license within 30-90 days of establishing residency.",
    officialUrl: "https://www.usa.gov/motor-vehicle-services", agency: "New state DMV",
    method: "In person (usually)", estTime: "Varies",
    requiredInfo: ["Proof of residency", "Current license", "Identity documents"],
    steps: ["Find your new state's DMV via the official USA.gov directory.",
      "Review new-resident requirements.", "Book an appointment if needed.",
      "Bring required documents and complete the transfer."],
    verifiedOn: "2026-07-11", applies: (a) => movingToNewState(a),
  },
  {
    id: "new-state-vehicle-registration", title: "Register your vehicle in your new state",
    category: "Vehicle and transportation",
    description: "Register your vehicle and complete any inspection/emissions requirements.",
    reason: "You are moving to another state with a vehicle.",
    priority: "Legally required", offsetDays: 21, timing: "after",
    deadlineNote: "Deadlines vary by state; some require inspection first.",
    officialUrl: "https://www.usa.gov/motor-vehicle-services", agency: "New state DMV",
    method: "Varies", estTime: "Varies",
    requiredInfo: ["Title", "Proof of insurance", "Proof of residency"],
    steps: ["Check your new state's registration and inspection rules.",
      "Complete any required inspection/emissions test.",
      "Register the vehicle and get new plates."],
    verifiedOn: "2026-07-11", applies: (a) => a.hasVehicle && movingToNewState(a),
  },
  {
    id: "electricity-transfer", title: "Transfer or set up electricity",
    category: "Utilities",
    description: "Stop service at the old home and start it at the new one.",
    reason: "You pay for utilities; power must be on when you arrive.",
    priority: "Prevents service interruption", offsetDays: -7, timing: "any",
    deadlineNote: "Schedule at least a week ahead so power is on move day.",
    officialUrl: "https://austinenergy.com/moving", agency: "Austin Energy / your provider",
    method: "Online or phone", estTime: "15 minutes",
    requiredInfo: ["New address", "Move-in date", "Account details"],
    steps: ["Contact your electric provider.", "Schedule stop at old and start at new address.",
      "Confirm the start date.", "Save confirmation."],
    verifiedOn: "2026-07-11", applies: (a) => !(a.housing === "rent" && a.utilitiesIncluded),
  },
  {
    id: "water-transfer", title: "Transfer or set up water service",
    category: "Utilities",
    description: "Arrange water/wastewater service at the new address.",
    reason: "You pay for utilities; water service must be active.",
    priority: "Prevents service interruption", offsetDays: -7, timing: "any",
    deadlineNote: "Schedule about a week ahead.",
    officialUrl: "https://www.austintexas.gov/department/austin-water",
    agency: "Austin Water / your provider", method: "Online or phone", estTime: "15 minutes",
    requiredInfo: ["New address", "Move-in date"],
    steps: ["Contact your water utility.", "Schedule start at the new address.", "Save confirmation."],
    verifiedOn: "2026-07-11", applies: (a) => !(a.housing === "rent" && a.utilitiesIncluded),
  },
  {
    id: "confirm-utilities-landlord", title: "Confirm utility responsibility with landlord",
    category: "Utilities",
    description: "Confirm which utilities are included and which you must set up.",
    reason: "You rent with utilities included; confirm the split before move-in.",
    priority: "Recommended", offsetDays: -10, timing: "before",
    deadlineNote: "Confirm before signing/moving to avoid surprises.",
    officialUrl: "https://www.austintexas.gov/department/housing",
    agency: "Landlord / property manager", method: "Email or phone", estTime: "10 minutes",
    requiredInfo: ["Lease terms"],
    steps: ["Ask the landlord which utilities are included.",
      "Get it in writing.", "Note which ones you must open yourself."],
    verifiedOn: "2026-07-11", applies: (a) => a.housing === "rent" && a.utilitiesIncluded === true,
  },
  {
    id: "internet-transfer", title: "Transfer or install internet service",
    category: "Utilities",
    description: "Schedule internet at the new address.",
    reason: "Internet often needs a scheduled install; book early.",
    priority: "Prevents service interruption", offsetDays: -10, timing: "any",
    deadlineNote: "Install slots fill up; book ~2 weeks ahead.",
    officialUrl: "https://broadbandmap.fcc.gov/", agency: "Your ISP",
    method: "Online or phone", estTime: "20 minutes",
    requiredInfo: ["New address", "Preferred install date"],
    steps: ["Check provider availability at the new address.",
      "Schedule transfer or new install.", "Confirm the appointment window."],
    verifiedOn: "2026-07-11", applies: () => true,
  },
  {
    id: "notify-landlord", title: "Notify current landlord and arrange deposit return",
    category: "Property and housing",
    description: "Give notice and confirm how your deposit will be returned.",
    reason: "You rent; proper notice protects your deposit.",
    priority: "Financially important", offsetDays: -30, timing: "before",
    deadlineNote: "Give notice per your lease (often 30-60 days).",
    officialUrl: "https://www.austintexas.gov/department/tenant-landlord",
    agency: "Landlord", method: "Written notice", estTime: "20 minutes",
    requiredInfo: ["Lease notice terms", "Forwarding address for deposit"],
    steps: ["Review your lease notice period.", "Send written move-out notice.",
      "Provide a forwarding address for the deposit.", "Schedule the move-out inspection."],
    verifiedOn: "2026-07-11", applies: (a) => a.housing === "rent",
  },
  {
    id: "employer-payroll", title: "Update employer and payroll address",
    category: "Employment",
    description: "Update your address with HR/payroll.",
    reason: "Keeps tax withholding and year-end forms correct.",
    priority: "Financially important", offsetDays: -3, timing: "any",
    deadlineNote: "Update before the next payroll cycle after moving.",
    officialUrl: "https://www.irs.gov/", agency: "Your employer",
    method: "HR portal", estTime: "10 minutes",
    requiredInfo: ["New address"],
    steps: ["Open your HR/payroll portal.", "Update your home address.",
      "Check state tax withholding if you changed states.", "Save confirmation."],
    verifiedOn: "2026-07-11", applies: () => true,
  },
  {
    id: "banks-cards", title: "Update banks and credit cards",
    category: "Financial accounts",
    description: "Update your address on bank and credit-card accounts.",
    reason: "Ensures statements, cards, and fraud alerts reach you.",
    priority: "Financially important", offsetDays: -3, timing: "any",
    deadlineNote: "Update around move day.",
    officialUrl: "https://www.consumerfinance.gov/", agency: "Your bank / card issuers",
    method: "Online account", estTime: "15 minutes",
    requiredInfo: ["New address", "Account logins"],
    steps: ["Log in to each bank/card account.", "Update the mailing address.",
      "Request replacement cards if needed."],
    verifiedOn: "2026-07-11", applies: () => true,
  },
  {
    id: "renters-insurance", title: "Update or start renters insurance",
    category: "Insurance",
    description: "Update your renters policy for the new address.",
    reason: "You rent; coverage is tied to the insured address.",
    priority: "Financially important", offsetDays: -3, timing: "any",
    deadlineNote: "Have coverage active on move-in day.",
    officialUrl: "https://www.naic.org/", agency: "Your insurer",
    method: "Online or phone", estTime: "15 minutes",
    requiredInfo: ["New address", "Policy number"],
    steps: ["Contact your renters-insurance provider.", "Update the covered address.",
      "Confirm effective date and save the policy."],
    verifiedOn: "2026-07-11", applies: (a) => a.housing === "rent",
  },
  {
    id: "homeowners-insurance", title: "Update or start homeowners insurance",
    category: "Insurance",
    description: "Set up or update homeowners insurance for the new home.",
    reason: "You own; the property must be insured.",
    priority: "Financially important", offsetDays: -7, timing: "before",
    deadlineNote: "Coverage typically required at closing / before move-in.",
    officialUrl: "https://www.naic.org/", agency: "Your insurer",
    method: "Online or phone", estTime: "20 minutes",
    requiredInfo: ["New address", "Property details"],
    steps: ["Contact your insurer.", "Set up or update the homeowners policy.",
      "Confirm the effective date.", "Save the declarations page."],
    verifiedOn: "2026-07-11", applies: (a) => a.housing === "own",
  },
  {
    id: "school-records", title: "Update school or daycare records",
    category: "Family and education",
    description: "Update address and transfer records for children's school/daycare.",
    reason: "You have children enrolled; districts are address-based.",
    priority: "Recommended", offsetDays: -14, timing: "any",
    deadlineNote: "Start early; enrollment may depend on your address/district.",
    officialUrl: "https://www.austinisd.org/", agency: "School district / daycare",
    method: "Contact school", estTime: "Varies",
    requiredInfo: ["New address", "Proof of residency"],
    steps: ["Contact the current and new school/daycare.",
      "Confirm the district for your new ZIP.", "Transfer or update records."],
    verifiedOn: "2026-07-11", applies: (a) => a.children === true,
  },
  {
    id: "pet-microchip", title: "Update pet microchip and vet records",
    category: "Pets",
    description: "Update your contact info in the microchip registry and with your vet.",
    reason: "You have pets; an up-to-date microchip helps reunite you if they get lost.",
    priority: "Recommended", offsetDays: 7, timing: "after",
    deadlineNote: "Update soon after moving.",
    officialUrl: "https://www.aaha.org/your-pet/pet-microchip-lookup/",
    agency: "Microchip registry / vet", method: "Online", estTime: "10 minutes",
    requiredInfo: ["Microchip number", "New address and phone"],
    steps: ["Look up your pet's microchip registry.", "Update your contact info.",
      "Update records with a new local vet if needed."],
    verifiedOn: "2026-07-11", applies: (a) => a.pets === true,
  },
  {
    id: "govt-benefits", title: "Update government benefit programs",
    category: "Government",
    description: "Update your address for benefit programs you receive.",
    reason: "You receive government benefits; address changes can affect eligibility and mail.",
    priority: "Legally required", offsetDays: 3, timing: "after",
    deadlineNote: "Report changes promptly to avoid interruptions.",
    officialUrl: "https://www.usa.gov/benefits", agency: "Relevant benefit agency",
    method: "Online or phone", estTime: "Varies",
    requiredInfo: ["New address", "Program account details"],
    steps: ["Identify each benefit program you receive.",
      "Report your new address to each.", "Save confirmations."],
    verifiedOn: "2026-07-11", applies: (a) => a.benefits === true,
  },
  {
    id: "professional-license", title: "Update professional license address",
    category: "Professional licenses",
    description: "Update the address on any professional licenses you hold.",
    reason: "You hold professional licenses; boards require current contact info.",
    priority: "Recommended", offsetDays: 14, timing: "after",
    deadlineNote: "Update per your licensing board's rules.",
    officialUrl: "https://www.usa.gov/professional-licenses", agency: "Licensing board",
    method: "Online", estTime: "Varies",
    requiredInfo: ["License number", "New address"],
    steps: ["Log in to your licensing board portal.", "Update your address of record.",
      "Save confirmation."],
    verifiedOn: "2026-07-11", applies: (a) => a.professionalLicenses === true,
  },
  {
    id: "subscriptions", title: "Update shopping and subscription addresses",
    category: "Shopping and subscriptions",
    description: "Update your default address on retailers and subscriptions.",
    reason: "Prevents deliveries going to your old home.",
    priority: "Optional", offsetDays: 3, timing: "any",
    deadlineNote: "Update before your next delivery/renewal.",
    officialUrl: "https://www.usa.gov/", agency: "Retailers / subscription services",
    method: "Online accounts", estTime: "20 minutes",
    requiredInfo: ["New address"],
    steps: ["List active subscriptions and retailers.",
      "Update the default shipping address on each.", "Update any auto-delivery."],
    verifiedOn: "2026-07-11", applies: () => true,
  },
  {
    id: "healthcare-providers", title: "Update healthcare providers and pharmacy",
    category: "Health",
    description: "Update your address with doctors, pharmacy, and health portal.",
    reason: "Keeps prescriptions and medical mail flowing; find local providers if moving far.",
    priority: "Recommended", offsetDays: 10, timing: "after",
    deadlineNote: "Update before your next prescription refill.",
    officialUrl: "https://www.healthcare.gov/", agency: "Your providers / pharmacy",
    method: "Portal or phone", estTime: "20 minutes",
    requiredInfo: ["New address"],
    steps: ["Update your address in each health portal.",
      "Transfer your pharmacy if moving far.", "Update your health-insurance address."],
    verifiedOn: "2026-07-11", applies: () => true,
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test tests/tasks-data.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add moving-checklist/js/tasks-data.js moving-checklist/tests/tasks-data.test.js
git commit -m "feat: add national + Texas/Austin task templates"
```

---

## Task 5: personalization engine (rules)

**Files:**
- Create: `moving-checklist/js/rules.js`
- Test: `moving-checklist/tests/rules.test.js`

**Interfaces:**
- Consumes: `TEMPLATES` from `tasks-data.js`; `recommendedDate` from `dates.js`.
- Produces: `generateTasks(move)` → array of task-state objects `{ id, templateId, status:"not_started", reason, recommendedDate, deadlineNote, confirmationNumber:"", notes:"", updatedAt:null }` for every template whose `applies(move)` is true, ordered by `CATEGORIES`. `mergeTasks(oldTasks, move)` → regenerated list that **preserves** `status/confirmationNumber/notes/updatedAt` for retained ids and drops tasks no longer applicable.

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/rules.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTasks, mergeTasks } from "../js/rules.js";

const base = { newZip: "78701", moveDate: "2026-08-01", moveType: "within_state",
  housing: "rent", hasVehicle: false, utilitiesIncluded: false, voter: false,
  children: false, pets: false, benefits: false, immigration: "citizen",
  professionalLicenses: false };

test("within-Texas + vehicle yields TX DL and registration + toll + auto insurance", () => {
  const ids = generateTasks({ ...base, hasVehicle: true }).map(t => t.id);
  for (const id of ["tx-dl-address","tx-vehicle-registration","toll-account","auto-insurance-garaging"])
    assert.ok(ids.includes(id), `missing ${id}`);
});

test("permanent resident adds USCIS task", () => {
  const ids = generateTasks({ ...base, immigration: "permanent_resident" }).map(t => t.id);
  assert.ok(ids.includes("uscis-address"));
});

test("rent + utilities included drops electricity/water, adds landlord-confirm, keeps internet", () => {
  const ids = generateTasks({ ...base, utilitiesIncluded: true }).map(t => t.id);
  assert.ok(!ids.includes("electricity-transfer"));
  assert.ok(!ids.includes("water-transfer"));
  assert.ok(ids.includes("confirm-utilities-landlord"));
  assert.ok(ids.includes("internet-transfer"));
});

test("moving to another state adds new-state DL and registration", () => {
  const ids = generateTasks({ ...base, moveType: "across_states", hasVehicle: true }).map(t => t.id);
  assert.ok(ids.includes("new-state-dl"));
  assert.ok(ids.includes("new-state-vehicle-registration"));
  assert.ok(!ids.includes("tx-dl-address"));
});

test("recommendedDate is computed from move date and offset", () => {
  const usps = generateTasks(base).find(t => t.id === "usps-forwarding");
  assert.equal(usps.recommendedDate, "2026-07-18"); // -14 from 2026-08-01
});

test("mergeTasks preserves status/notes for retained tasks", () => {
  const first = generateTasks(base);
  const usps = first.find(t => t.id === "usps-forwarding");
  usps.status = "completed"; usps.notes = "done"; usps.confirmationNumber = "ABC";
  const merged = mergeTasks(first, base);
  const m = merged.find(t => t.id === "usps-forwarding");
  assert.equal(m.status, "completed");
  assert.equal(m.notes, "done");
  assert.equal(m.confirmationNumber, "ABC");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test tests/rules.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `moving-checklist/js/rules.js`**

```js
import { TEMPLATES, CATEGORIES } from "./tasks-data.js";
import { recommendedDate } from "./dates.js";

function orderByCategory(tasks) {
  return tasks.slice().sort((a, b) => {
    const ca = CATEGORIES.indexOf(templateOf(a.templateId).category);
    const cb = CATEGORIES.indexOf(templateOf(b.templateId).category);
    return ca - cb;
  });
}
export function templateOf(id) { return TEMPLATES.find(t => t.id === id); }

export function generateTasks(move) {
  const chosen = TEMPLATES.filter(t => {
    try { return t.applies(move) === true; } catch { return false; }
  });
  const tasks = chosen.map(t => ({
    id: t.id, templateId: t.id, status: "not_started", reason: t.reason,
    recommendedDate: move.moveDate ? recommendedDate(move.moveDate, t.offsetDays) : null,
    deadlineNote: t.deadlineNote, confirmationNumber: "", notes: "", updatedAt: null,
  }));
  return orderByCategory(tasks);
}

export function mergeTasks(oldTasks, move) {
  const fresh = generateTasks(move);
  const prev = new Map(oldTasks.map(t => [t.id, t]));
  for (const t of fresh) {
    const p = prev.get(t.id);
    if (p) {
      t.status = p.status; t.confirmationNumber = p.confirmationNumber;
      t.notes = p.notes; t.updatedAt = p.updatedAt;
    }
  }
  return fresh;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test tests/rules.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add moving-checklist/js/rules.js moving-checklist/tests/rules.test.js
git commit -m "feat: add rule-based personalization engine"
```

---

## Task 6: GitHub Contents API wrapper

**Files:**
- Create: `moving-checklist/js/github.js`
- Test: `moving-checklist/tests/github.test.js`

**Interfaces:**
- Produces: constants `OWNER="proxy-eval-max"`, `REPO="proxy-eval-max.github.io"`. `dataPath(username)` → `"moving-checklist/data/<username>.enc.json"`. `async getFile(path, token)` → `{ text, sha } | null` (null on 404; `token` optional). `async putFile(path, text, message, sha, token)` → `{ sha }` (throws `Error("no-token")` if no token, `Error("conflict")` on 409, `Error("auth")` on 401/403). `async deleteFile(path, message, sha, token)` → true. Accepts an injectable `fetchImpl` last arg on each for testing (defaults to global `fetch`).

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/github.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataPath, getFile, putFile, deleteFile } from "../js/github.js";

function fakeFetch(routes) {
  return async (url, opts = {}) => {
    const key = `${opts.method || "GET"} ${url}`;
    const r = routes[key];
    if (!r) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  };
}

test("dataPath builds the per-user path", () => {
  assert.equal(dataPath("anirudh"), "moving-checklist/data/anirudh.enc.json");
});

test("getFile decodes base64 content and returns sha", async () => {
  const path = dataPath("anirudh");
  const content = Buffer.from(JSON.stringify({ hi: 1 })).toString("base64");
  const url = `https://api.github.com/repos/proxy-eval-max/proxy-eval-max.github.io/contents/${path}`;
  const f = fakeFetch({ [`GET ${url}`]: { status: 200, body: { content, sha: "abc" } } });
  const res = await getFile(path, null, f);
  assert.equal(res.sha, "abc");
  assert.equal(JSON.parse(res.text).hi, 1);
});

test("getFile returns null on 404", async () => {
  const res = await getFile(dataPath("nobody"), null, fakeFetch({}));
  assert.equal(res, null);
});

test("putFile without token throws no-token", async () => {
  await assert.rejects(() => putFile(dataPath("x"), "{}", "msg", null, null, fakeFetch({})), /no-token/);
});

test("putFile with token returns new sha", async () => {
  const path = dataPath("anirudh");
  const url = `https://api.github.com/repos/proxy-eval-max/proxy-eval-max.github.io/contents/${path}`;
  const f = fakeFetch({ [`PUT ${url}`]: { status: 200, body: { content: { sha: "new" } } } });
  const res = await putFile(path, "{}", "msg", "old", "tok", f);
  assert.equal(res.sha, "new");
});

test("putFile surfaces 409 as conflict", async () => {
  const path = dataPath("anirudh");
  const url = `https://api.github.com/repos/proxy-eval-max/proxy-eval-max.github.io/contents/${path}`;
  const f = fakeFetch({ [`PUT ${url}`]: { status: 409, body: {} } });
  await assert.rejects(() => putFile(path, "{}", "msg", "old", "tok", f), /conflict/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test tests/github.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `moving-checklist/js/github.js`**

```js
export const OWNER = "proxy-eval-max";
export const REPO = "proxy-eval-max.github.io";
const API = "https://api.github.com";

export function dataPath(username) { return `moving-checklist/data/${username}.enc.json`; }
function url(path) { return `${API}/repos/${OWNER}/${REPO}/contents/${path}`; }
function b64encode(text) {
  // UTF-8 safe base64 encode, works in browser and Node.
  const bytes = new TextEncoder().encode(text);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(b64) {
  const clean = (b64 || "").replace(/\n/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function headers(token) {
  const h = { "Accept": "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function getFile(path, token, fetchImpl = fetch) {
  const res = await fetchImpl(url(path), { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "auth" : "read-failed");
  const body = await res.json();
  return { text: b64decode(body.content), sha: body.sha };
}

export async function putFile(path, text, message, sha, token, fetchImpl = fetch) {
  if (!token) throw new Error("no-token");
  const payload = { message, content: b64encode(text) };
  if (sha) payload.sha = sha;
  const res = await fetchImpl(url(path), {
    method: "PUT", headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 409) throw new Error("conflict");
  if (res.status === 401 || res.status === 403) throw new Error("auth");
  if (!res.ok) throw new Error("write-failed");
  const body = await res.json();
  return { sha: body.content.sha };
}

export async function deleteFile(path, message, sha, token, fetchImpl = fetch) {
  if (!token) throw new Error("no-token");
  const res = await fetchImpl(url(path), {
    method: "DELETE", headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("auth");
  if (!res.ok) throw new Error("delete-failed");
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test tests/github.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add moving-checklist/js/github.js moving-checklist/tests/github.test.js
git commit -m "feat: add GitHub Contents API wrapper"
```

---

## Task 7: store (in-memory state, load/save/export/delete)

**Files:**
- Create: `moving-checklist/js/store.js`
- Test: `moving-checklist/tests/store.test.js`

**Interfaces:**
- Consumes: `encrypt`/`decrypt` (crypto.js), `getFile`/`putFile`/`deleteFile`/`dataPath` (github.js).
- Produces a module-singleton store with injectable deps for testing via `__setDeps({ github, crypto })`:
  - `emptyState(username)` → `{ profile:{username,createdAt:null}, move:{...defaults}, tasks:[], meta:{onboarded:false, schemaVersion:1} }`.
  - `async load(username, password, token)` → sets in-memory `{state, username, password, sha}`; returns state. Throws `Error("no-profile")` if file missing, `Error("decrypt-failed")` on bad password.
  - `getState()` → current state (or null). `setState(next)` → replaces state, marks dirty.
  - `async save(token)` → re-encrypt current state, `putFile` with stored sha, update sha. Throws `no-token` if none.
  - `async remove(token)` → deleteFile for current user.
  - `exportBlobText()` → the current encrypted-file JSON string (for download).
  - `session()` → `{ username, hasState:boolean }`; `clear()` wipes memory.

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/store.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as store from "../js/store.js";
import * as realCrypto from "../js/crypto.js";

function memGithub() {
  const files = new Map();
  return {
    files,
    dataPath: (u) => `moving-checklist/data/${u}.enc.json`,
    async getFile(path) { return files.has(path) ? { text: files.get(path), sha: "s" + files.size } : null; },
    async putFile(path, text) { if (!arguments[4] && false) {} files.set(path, text); return { sha: "s" + files.size }; },
    async deleteFile(path) { files.delete(path); return true; },
  };
}

test("load throws no-profile when file missing", async () => {
  store.__setDeps({ github: memGithub(), crypto: realCrypto });
  await assert.rejects(() => store.load("ghost", "pw", "tok"), /no-profile/);
});

test("save then load round-trips state", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  // seed a profile by encrypting an empty state directly
  const st = store.emptyState("anirudh");
  st.meta.onboarded = true; st.move.newZip = "78701";
  const blob = await realCrypto.encrypt("pw", st);
  gh.files.set(gh.dataPath("anirudh"), JSON.stringify(blob));

  const loaded = await store.load("anirudh", "pw", "tok");
  assert.equal(loaded.move.newZip, "78701");
  loaded.move.moveDate = "2026-08-01";
  store.setState(loaded);
  await store.save("tok");

  store.clear();
  const again = await store.load("anirudh", "pw", "tok");
  assert.equal(again.move.moveDate, "2026-08-01");
});

test("load with wrong password throws decrypt-failed", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  const blob = await realCrypto.encrypt("right", store.emptyState("bob"));
  gh.files.set(gh.dataPath("bob"), JSON.stringify(blob));
  await assert.rejects(() => store.load("bob", "wrong", "tok"), /decrypt-failed/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test tests/store.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `moving-checklist/js/store.js`**

```js
import * as defaultGithub from "./github.js";
import * as defaultCrypto from "./crypto.js";

let github = defaultGithub;
let cryptoMod = defaultCrypto;
export function __setDeps(deps) {
  if (deps.github) github = deps.github;
  if (deps.crypto) cryptoMod = deps.crypto;
}

let mem = { state: null, username: null, password: null, sha: null };

export function emptyState(username) {
  return {
    profile: { username, createdAt: null },
    move: { oldZip: "", newZip: "", moveDate: "", moveType: "", housing: "",
      hasVehicle: false, utilitiesIncluded: false, voter: false, children: false,
      pets: false, benefits: false, immigration: "prefer_not", professionalLicenses: false,
      reminderPref: "browser" },
    tasks: [], meta: { onboarded: false, schemaVersion: 1 },
  };
}

export async function load(username, password, token) {
  const path = github.dataPath(username);
  const file = await github.getFile(path, token);
  if (!file) throw new Error("no-profile");
  const blob = JSON.parse(file.text);
  const state = await cryptoMod.decrypt(password, blob); // throws decrypt-failed
  mem = { state, username, password, sha: file.sha };
  return state;
}

export function getState() { return mem.state; }
export function setState(next) { mem.state = next; }
export function session() { return { username: mem.username, hasState: !!mem.state }; }
export function clear() { mem = { state: null, username: null, password: null, sha: null }; }

async function encryptCurrent() {
  const blob = await cryptoMod.encrypt(mem.password, mem.state);
  return JSON.stringify(
    { v: 1, username: mem.username, ...blob }, null, 2);
}

export async function exportBlobText() { return encryptCurrent(); }

export async function save(token) {
  const path = github.dataPath(mem.username);
  const text = await encryptCurrent();
  const res = await github.putFile(path, text, `Update ${mem.username} checklist`, mem.sha, token);
  mem.sha = res.sha;
  return true;
}

export async function remove(token) {
  const path = github.dataPath(mem.username);
  await github.deleteFile(path, `Delete ${mem.username} profile`, mem.sha, token);
  clear();
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test tests/store.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add moving-checklist/js/store.js moving-checklist/tests/store.test.js
git commit -m "feat: add in-memory encrypted store with load/save/export"
```

---

## Task 8: auth (login, create profile, token, session helpers)

**Files:**
- Create: `moving-checklist/js/auth.js`
- Test: `moving-checklist/tests/auth.test.js`

**Interfaces:**
- Consumes: `store` (load/emptyState/setState/save/clear), `github` (getFile/putFile/dataPath), `crypto` (encrypt).
- Produces:
  - `normalizeUsername(raw)` → lowercased trimmed; `validUsername(u)` → boolean (`^[a-z0-9_-]{1,32}$`).
  - `getToken()` / `setToken(t)` / `clearToken()` — localStorage-backed (key `mc.gh.token`); guarded for non-browser (no-op if `localStorage` undefined).
  - `async login(username, password, token)` → normalizes, `store.load`; maps `no-profile`/`decrypt-failed` to a single thrown `Error("bad-credentials")`.
  - `async createProfile(username, password, token)` → validate username + password length ≥ 8; throw `Error("exists")` if file present; encrypt empty state; `putFile`; then `store.load` to establish session. Throws `Error("no-token")` if no token (creation requires a write).
  - `logout()` → `store.clear()`.
  - Accepts injectable deps via `__setDeps({ store, github, crypto })`.

- [ ] **Step 1: Write the failing test** — `moving-checklist/tests/auth.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../js/auth.js";
import * as store from "../js/store.js";
import * as realCrypto from "../js/crypto.js";

function memGithub() {
  const files = new Map();
  return { files,
    dataPath: (u) => `moving-checklist/data/${u}.enc.json`,
    async getFile(path) { return files.has(path) ? { text: files.get(path), sha: "s1" } : null; },
    async putFile(path, text) { files.set(path, text); return { sha: "s2" }; },
    async deleteFile(path) { files.delete(path); return true; } };
}

test("validUsername enforces charset", () => {
  assert.equal(auth.validUsername("anirudh"), true);
  assert.equal(auth.validUsername("rwik_2"), true);
  assert.equal(auth.validUsername("bad name"), false);
  assert.equal(auth.validUsername("../etc"), false);
});

test("createProfile then login works; second create throws exists", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  auth.__setDeps({ store, github: gh, crypto: realCrypto });
  await auth.createProfile("anirudh", "password1", "tok");
  assert.ok(gh.files.has(gh.dataPath("anirudh")));
  await assert.rejects(() => auth.createProfile("anirudh", "password1", "tok"), /exists/);
  store.clear();
  const st = await auth.login("Anirudh", "password1", "tok");
  assert.equal(st.profile.username, "anirudh");
});

test("createProfile rejects short password", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  auth.__setDeps({ store, github: gh, crypto: realCrypto });
  await assert.rejects(() => auth.createProfile("bob", "short", "tok"), /weak-password/);
});

test("login with wrong password throws bad-credentials", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  auth.__setDeps({ store, github: gh, crypto: realCrypto });
  await auth.createProfile("carol", "password1", "tok");
  store.clear();
  await assert.rejects(() => auth.login("carol", "nope", "tok"), /bad-credentials/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd moving-checklist && node --test tests/auth.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `moving-checklist/js/auth.js`**

```js
import * as defaultStore from "./store.js";
import * as defaultGithub from "./github.js";
import * as defaultCrypto from "./crypto.js";

let store = defaultStore, github = defaultGithub, cryptoMod = defaultCrypto;
export function __setDeps(d) {
  if (d.store) store = d.store; if (d.github) github = d.github; if (d.crypto) cryptoMod = d.crypto;
}

const TOKEN_KEY = "mc.gh.token";
const hasLS = typeof localStorage !== "undefined";
export function getToken() { return hasLS ? localStorage.getItem(TOKEN_KEY) : null; }
export function setToken(t) { if (hasLS) localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { if (hasLS) localStorage.removeItem(TOKEN_KEY); }

export function normalizeUsername(raw) { return (raw || "").trim().toLowerCase(); }
export function validUsername(u) { return /^[a-z0-9_-]{1,32}$/.test(u); }

export async function login(usernameRaw, password, token) {
  const username = normalizeUsername(usernameRaw);
  if (!validUsername(username)) throw new Error("bad-credentials");
  try {
    return await store.load(username, password, token);
  } catch (e) {
    if (e.message === "no-profile" || e.message === "decrypt-failed")
      throw new Error("bad-credentials");
    throw e;
  }
}

export async function createProfile(usernameRaw, password, token) {
  const username = normalizeUsername(usernameRaw);
  if (!validUsername(username)) throw new Error("invalid-username");
  if (!password || password.length < 8) throw new Error("weak-password");
  if (!token) throw new Error("no-token");
  const path = github.dataPath(username);
  const existing = await github.getFile(path, token);
  if (existing) throw new Error("exists");
  const state = store.emptyState(username);
  state.profile.createdAt = new Date().toISOString();
  const blob = await cryptoMod.encrypt(password, state);
  const text = JSON.stringify({ v: 1, username, ...blob }, null, 2);
  await github.putFile(path, text, `Create ${username} profile`, null, token);
  return store.load(username, password, token);
}

export function logout() { store.clear(); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd moving-checklist && node --test tests/auth.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd moving-checklist && node --test tests/`
Expected: all tests PASS across every file.

- [ ] **Step 6: Commit**

```bash
git add moving-checklist/js/auth.js moving-checklist/tests/auth.test.js
git commit -m "feat: add auth (login, create profile, token, session)"
```

---

## Task 9: app boot + router + auth gate UI

**Files:**
- Create: `moving-checklist/js/app.js`
- Modify: `moving-checklist/index.html` (already has containers; no change expected unless wiring reveals a gap)

**Interfaces:**
- Consumes: `auth`, `store`, `ui`, and view modules (Tasks 10-14).
- Produces: `navigate(route)`; a `mountAuthGate()` that renders login + create-profile; `renderTopbar()`; `toast(msg)`. Views (Tasks 10-14) each export `render(root, ctx)` where `ctx = { state, save, navigate, toast, token }`.
- Router routes: `""`/`#/` → dashboard (or onboarding if `!state.meta.onboarded`), `#/onboarding`, `#/checklist`, `#/task/<id>`, `#/settings`.

- [ ] **Step 1: Implement `moving-checklist/js/app.js`**

```js
import * as auth from "./auth.js";
import * as store from "./store.js";
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
  const token = auth.getToken();
  if (!token) { toast("Add a GitHub token in Settings to save."); return false; }
  try { await store.save(token); toast("Saved."); return true; }
  catch (e) {
    if (e.message === "conflict") toast("Remote copy changed — reload from Settings.");
    else if (e.message === "auth") toast("Token rejected — re-enter it in Settings.");
    else toast("Save failed.");
    return false;
  }
}

function ctx() {
  return { state: store.getState(), save, navigate, toast, token: auth.getToken() };
}

const ROUTES = {
  "onboarding": onboarding, "checklist": checklist, "settings": settings,
};

export function navigate(route) {
  if (route && location.hash !== route) { location.hash = route; return; }
  render();
}

function render() {
  const st = store.getState();
  if (!st) { mountAuthGate(); return; }
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
  const links = [["dashboard","#/","Dashboard"],["checklist","#/checklist","Checklist"],
    ["settings","#/settings","Settings"]];
  for (const [route, href, label] of links) {
    const a = el("a", { href, "data-route": route, text: label });
    nav.append(a);
  }
  qs("#who").textContent = store.session().username || "";
  qs("#logout-btn").onclick = () => { auth.logout(); location.hash = ""; renderTopbar(); mountAuthGate(); qs("#topbar").hidden = true; };
}

export function mountAuthGate() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const err = el("p", { class: "error", role: "alert" });
  const token = auth.getToken() || "";

  const uLogin = el("input", { id: "li-user", autocomplete: "username", "aria-label": "Username" });
  const pLogin = el("input", { id: "li-pass", type: "password", autocomplete: "current-password", "aria-label": "Password" });
  const loginBtn = el("button", { class: "primary", type: "button", text: "Log in" });
  loginBtn.onclick = async () => {
    err.textContent = "";
    try { await auth.login(uLogin.value, pLogin.value, auth.getToken()); location.hash = ""; render(); }
    catch (e) { err.textContent = e.message === "bad-credentials"
      ? "Incorrect username or password." : "Could not reach GitHub. Try again."; }
  };

  const uNew = el("input", { id: "cp-user", "aria-label": "New username" });
  const pNew = el("input", { id: "cp-pass", type: "password", "aria-label": "New password (min 8)" });
  const pNew2 = el("input", { id: "cp-pass2", type: "password", "aria-label": "Confirm password" });
  const tokIn = el("input", { id: "cp-token", type: "password", value: token, "aria-label": "GitHub token" });
  const createBtn = el("button", { class: "primary", type: "button", text: "Create profile" });
  createBtn.onclick = async () => {
    err.textContent = "";
    if (pNew.value !== pNew2.value) { err.textContent = "Passwords do not match."; return; }
    if (tokIn.value) auth.setToken(tokIn.value.trim());
    try {
      await auth.createProfile(uNew.value, pNew.value, auth.getToken());
      location.hash = "#/onboarding"; render();
    } catch (e) {
      const map = { "no-token": "A GitHub token is required to create a profile.",
        "exists": "That profile already exists — try logging in.",
        "weak-password": "Password must be at least 8 characters.",
        "invalid-username": "Username may use a-z, 0-9, _ and - only." };
      err.textContent = map[e.message] || "Could not create profile.";
    }
  };

  root.append(
    el("h1", { text: "MoveAddress" }),
    el("p", { class: "muted", text: "Your personalized moving address-change checklist." }),
    err,
    el("section", { class: "card" }, [
      el("h2", { text: "Log in" }),
      el("label", { text: "Username", for: "li-user" }), uLogin,
      el("label", { text: "Password", for: "li-pass" }), pLogin,
      el("div", { class: "row" }, [loginBtn]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Create a profile" }),
      el("label", { text: "Username", for: "cp-user" }), uNew,
      el("label", { text: "Password (min 8 characters)", for: "cp-pass" }), pNew,
      el("label", { text: "Confirm password", for: "cp-pass2" }), pNew2,
      el("label", { text: "GitHub token (needed to save; stored in this browser)", for: "cp-token" }), tokIn,
      el("p", { class: "muted", html: "Use a fine-grained token scoped to this repo with Contents: read &amp; write." }),
      el("div", { class: "row" }, [createBtn]),
    ]),
    el("p", { class: "muted", html: "Informational only — not legal advice. Official agency instructions control. Verify high-stakes requirements (immigration, taxes, licensing) with official sources." }),
  );
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    main().innerHTML = "<h1>Unsupported</h1><p>This app needs a modern browser over HTTPS (Web Crypto).</p>";
    return;
  }
  mountAuthGate();
});
```

- [ ] **Step 2: Verify the gate renders (manual)**

Run: `python3 -m http.server -d moving-checklist 8099 >/dev/null 2>&1 & sleep 1; curl -s http://localhost:8099/index.html | grep -c 'app.js'; kill %1`
Expected: `1` (page served). Then open `http://localhost:8099/` in a browser: login + create-profile cards render, no console errors. (Views are stubbed next; navigation after login is exercised in later tasks.)

- [ ] **Step 3: Commit**

```bash
git add moving-checklist/js/app.js moving-checklist/index.html
git commit -m "feat: add app boot, hash router, and auth gate UI"
```

---

## Task 10: onboarding view

**Files:**
- Create: `moving-checklist/js/views/onboarding.js`

**Interfaces:**
- Consumes: `ui` (el/clear), `generateTasks`/`mergeTasks` (rules.js), store state via `ctx`.
- Produces: `render(root, ctx)`. On submit: writes answers into `ctx.state.move`, sets `ctx.state.meta.onboarded = true`, regenerates `ctx.state.tasks` via `mergeTasks(existing, move)`, calls `ctx.save()`, then `ctx.navigate("#/")`.

- [ ] **Step 1: Implement `moving-checklist/js/views/onboarding.js`**

```js
import { el, clear } from "../ui.js";
import { mergeTasks } from "../rules.js";

const FIELDS = [
  ["oldZip", "Current ZIP code", "text"],
  ["newZip", "New ZIP code", "text"],
  ["moveDate", "Move date", "date"],
];
const SELECTS = [
  ["moveType", "Type of move", [["within_city","Within the same city"],
    ["within_state","Within the same state"],["across_states","To another state"]]],
  ["housing", "Do you rent or own?", [["rent","Rent"],["own","Own"]]],
  ["immigration", "Citizenship / immigration status",
    [["citizen","U.S. citizen"],["permanent_resident","Permanent resident"],
     ["visa_holder","Visa holder"],["prefer_not","Prefer not to say"]]],
  ["reminderPref", "Reminder preference", [["browser","Browser/in-app"],["email","Email (shown in-app only)"]]],
];
const BOOLS = [
  ["hasVehicle", "Do you own or lease a vehicle?"],
  ["utilitiesIncluded", "Are utilities included in your rent?"],
  ["voter", "Are you registered to vote?"],
  ["children", "Do you have children in school or daycare?"],
  ["pets", "Do you have pets?"],
  ["benefits", "Do you receive government benefits?"],
  ["professionalLicenses", "Do you hold professional licenses?"],
];

export function render(root, ctx) {
  clear(root);
  const m = ctx.state.move;
  const inputs = {};
  const form = el("form", { class: "card" });
  form.append(el("h1", { text: "Tell us about your move" }),
    el("p", { class: "muted", text: "ZIP codes and move type are enough — no street address or ID numbers needed." }));

  for (const [key, label, type] of FIELDS) {
    const i = el("input", { id: `ob-${key}`, type, value: m[key] || "" });
    inputs[key] = () => i.value;
    form.append(el("label", { text: label, for: `ob-${key}` }), i);
  }
  for (const [key, label, opts] of SELECTS) {
    const s = el("select", { id: `ob-${key}` },
      opts.map(([v, t]) => el("option", { value: v, text: t, selected: m[key] === v })));
    inputs[key] = () => s.value;
    form.append(el("label", { text: label, for: `ob-${key}` }), s);
  }
  for (const [key, label] of BOOLS) {
    const s = el("select", { id: `ob-${key}` }, [
      el("option", { value: "no", text: "No", selected: !m[key] }),
      el("option", { value: "yes", text: "Yes", selected: !!m[key] }),
    ]);
    inputs[key] = () => s.value === "yes";
    form.append(el("label", { text: label, for: `ob-${key}` }), s);
  }

  const submit = el("button", { class: "primary", type: "submit", text: "Generate my checklist" });
  form.append(el("div", { class: "row" }, [submit]));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    for (const key of Object.keys(inputs)) ctx.state.move[key] = inputs[key]();
    ctx.state.meta.onboarded = true;
    ctx.state.tasks = mergeTasks(ctx.state.tasks || [], ctx.state.move);
    await ctx.save();
    ctx.navigate("#/");
  });
  root.append(form);
}
```

- [ ] **Step 2: Manual verify**

Open the site, create a profile, complete onboarding → redirected to dashboard, `tasks` populated. (Dashboard lands in Task 11; until then confirm no console error and hash becomes `#/`.)

- [ ] **Step 3: Commit**

```bash
git add moving-checklist/js/views/onboarding.js
git commit -m "feat: add onboarding questionnaire view"
```

---

## Task 11: dashboard view

**Files:**
- Create: `moving-checklist/js/views/dashboard.js`

**Interfaces:**
- Consumes: `ui`, `dates` (`todayIso`, `daysBetween`, `bucket`), `templateOf` (rules.js), `CATEGORIES` (tasks-data.js).
- Produces: `render(root, ctx)`. Shows countdown, progress ring (% completed), overdue + due-this-week counts, before/after split, next 3 recommended tasks (not completed, soonest recommendedDate), category progress.

- [ ] **Step 1: Implement `moving-checklist/js/views/dashboard.js`**

```js
import { el, clear } from "../ui.js";
import { todayIso, daysBetween, bucket } from "../dates.js";
import { templateOf } from "../rules.js";
import { CATEGORIES } from "../tasks-data.js";

const DONE = new Set(["completed", "not_applicable", "skipped"]);

export function render(root, ctx) {
  clear(root);
  const st = ctx.state, tasks = st.tasks || [];
  const today = todayIso();
  const total = tasks.length;
  const done = tasks.filter(t => DONE.has(t.status)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const active = tasks.filter(t => !DONE.has(t.status));
  const overdue = active.filter(t => t.recommendedDate && bucket(t.recommendedDate, today) === "overdue");
  const dueSoon = active.filter(t => t.recommendedDate && bucket(t.recommendedDate, today) === "due_soon");
  const before = active.filter(t => templateOf(t.templateId)?.timing === "before");
  const after = active.filter(t => templateOf(t.templateId)?.timing === "after");

  const header = el("div", { class: "row" });
  const ring = el("div", { class: "ring" }, [el("span", { text: `${pct}%` })]);
  ring.style.setProperty("--p", pct);
  let countdown = "Set your move date in onboarding";
  if (st.move.moveDate) {
    const d = daysBetween(today, st.move.moveDate);
    countdown = d >= 0 ? `${d} days until your move` : `${-d} days since your move`;
  }
  header.append(ring, el("div", {}, [
    el("h1", { text: countdown }),
    el("p", { class: "muted", text: `${done} of ${total} tasks complete` }),
  ]));

  const alerts = el("section", { class: "card" }, [
    el("h2", { text: "At a glance" }),
    el("div", { class: "row" }, [
      stat(overdue.length, "Overdue"), stat(dueSoon.length, "Due this week"),
      stat(before.length, "Before move"), stat(after.length, "After move"),
    ]),
  ]);

  const next = active
    .filter(t => t.recommendedDate)
    .sort((a, b) => a.recommendedDate.localeCompare(b.recommendedDate))
    .slice(0, 3);
  const nextCard = el("section", { class: "card" }, [
    el("h2", { text: "Next recommended tasks" }),
    next.length ? el("ul", { class: "tasklist" }, next.map(t => taskLink(t, ctx)))
      : el("p", { class: "muted", text: "Nothing scheduled — you're all caught up." }),
  ]);

  const byCat = CATEGORIES.map(cat => {
    const inCat = tasks.filter(t => templateOf(t.templateId)?.category === cat);
    if (!inCat.length) return null;
    const d = inCat.filter(t => DONE.has(t.status)).length;
    return el("li", {}, [`${cat}: ${d}/${inCat.length}`]);
  }).filter(Boolean);
  const catCard = el("section", { class: "card" }, [
    el("h2", { text: "Category progress" }), el("ul", {}, byCat),
  ]);

  root.append(header, alerts, nextCard, catCard);
}

function stat(n, label) {
  return el("div", { class: "card", style: "flex:1;min-width:120px;text-align:center" },
    [el("div", { style: "font-size:28px;font-weight:700", text: String(n) }),
     el("div", { class: "muted", text: label })]);
}
function taskLink(t, ctx) {
  const tpl = templateOf(t.templateId);
  const a = el("a", { href: `#/task/${t.id}`, text: tpl?.title || t.id });
  return el("li", {}, [a, el("div", { class: "muted", text: t.recommendedDate ? `Recommended by ${t.recommendedDate}` : "" })]);
}
```

- [ ] **Step 2: Manual verify**

After onboarding, dashboard shows countdown, ring %, four stat tiles, next-3 list with working links, and category progress. No console errors.

- [ ] **Step 3: Commit**

```bash
git add moving-checklist/js/views/dashboard.js
git commit -m "feat: add dashboard view"
```

---

## Task 12: checklist view (filters + sorting)

**Files:**
- Create: `moving-checklist/js/views/checklist.js`

**Interfaces:**
- Consumes: `ui`, `dates` (`todayIso`, `bucket`), `templateOf` (rules.js).
- Produces: `render(root, ctx)`. Filter dropdown (all / due_soon / overdue / before / after / completed / optional) and sort dropdown (recommended / deadline / priority / category / est time). Renders task rows linking to `#/task/<id>` with priority badge + status.

- [ ] **Step 1: Implement `moving-checklist/js/views/checklist.js`**

```js
import { el, clear } from "../ui.js";
import { todayIso, bucket } from "../dates.js";
import { templateOf } from "../rules.js";

const DONE = new Set(["completed", "not_applicable", "skipped"]);
const PRIORITY_ORDER = ["Legally required","Financially important",
  "Prevents service interruption","Recommended","Optional"];
const STATUS_LABEL = { not_started:"Not started", in_progress:"In progress",
  submitted:"Submitted", waiting:"Waiting for confirmation", completed:"Completed",
  not_applicable:"Not applicable", skipped:"Skipped" };

let state = { filter: "all", sort: "recommended" };

export function render(root, ctx) {
  clear(root);
  const today = todayIso();
  const all = ctx.state.tasks || [];

  const filterSel = select("Filter", state.filter, [
    ["all","All"],["due_soon","Due this week"],["overdue","Overdue"],
    ["before","Before move"],["after","After move"],["completed","Completed"],
    ["optional","Optional"]], v => { state.filter = v; render(root, ctx); });
  const sortSel = select("Sort", state.sort, [
    ["recommended","Recommended date"],["deadline","Deadline note"],["priority","Priority"],
    ["category","Category"],["time","Estimated time"]], v => { state.sort = v; render(root, ctx); });

  let list = all.filter(t => passesFilter(t, today));
  list = sortTasks(list);

  const ul = el("ul", { class: "tasklist" }, list.length
    ? list.map(t => row(t))
    : [el("li", { class: "muted", text: "No tasks match this filter." })]);

  root.append(
    el("h1", { text: "Your checklist" }),
    el("div", { class: "controls card" }, [filterSel, sortSel]),
    ul);
}

function passesFilter(t, today) {
  const tpl = templateOf(t.templateId);
  switch (state.filter) {
    case "all": return true;
    case "completed": return DONE.has(t.status);
    case "optional": return tpl?.priority === "Optional";
    case "before": return tpl?.timing === "before";
    case "after": return tpl?.timing === "after";
    case "due_soon": return t.recommendedDate && bucket(t.recommendedDate, today) === "due_soon" && !DONE.has(t.status);
    case "overdue": return t.recommendedDate && bucket(t.recommendedDate, today) === "overdue" && !DONE.has(t.status);
    default: return true;
  }
}
function sortTasks(list) {
  const by = state.sort, tpl = (t) => templateOf(t.templateId) || {};
  const cmp = {
    recommended: (a, b) => (a.recommendedDate || "9999").localeCompare(b.recommendedDate || "9999"),
    deadline: (a, b) => (tpl(a).deadlineNote || "").localeCompare(tpl(b).deadlineNote || ""),
    priority: (a, b) => PRIORITY_ORDER.indexOf(tpl(a).priority) - PRIORITY_ORDER.indexOf(tpl(b).priority),
    category: (a, b) => (tpl(a).category || "").localeCompare(tpl(b).category || ""),
    time: (a, b) => (tpl(a).estTime || "").localeCompare(tpl(b).estTime || ""),
  }[by];
  return list.slice().sort(cmp);
}
function row(t) {
  const tpl = templateOf(t.templateId) || {};
  const cls = "badge " + (tpl.priority || "").toLowerCase().replace(/\s+/g, "-");
  return el("li", {}, [
    el("div", { class: "row" }, [
      el("a", { href: `#/task/${t.id}`, text: tpl.title || t.id }),
      el("span", { class: cls, text: tpl.priority || "" }),
    ]),
    el("div", { class: "muted", text:
      `${STATUS_LABEL[t.status] || t.status}${t.recommendedDate ? " · by " + t.recommendedDate : ""} · ${tpl.category || ""}` }),
  ]);
}
function select(label, value, opts, onChange) {
  const s = el("select", { "aria-label": label },
    opts.map(([v, t]) => el("option", { value: v, text: t, selected: v === value })));
  s.addEventListener("change", () => onChange(s.value));
  return el("label", { text: label, style: "margin:0" }, [s]);
}
```

- [ ] **Step 2: Manual verify**

Checklist page lists tasks; changing filter/sort updates the list live; priority badges color per class; links open task detail.

- [ ] **Step 3: Commit**

```bash
git add moving-checklist/js/views/checklist.js
git commit -m "feat: add checklist view with filters and sorting"
```

---

## Task 13: task-detail view

**Files:**
- Create: `moving-checklist/js/views/task-detail.js`

**Interfaces:**
- Consumes: `ui`, `templateOf` (rules.js).
- Produces: `render(root, ctx, taskId)`. Shows why-it-matters, timing, prep list, official link (new tab, labeled official), steps, status `<select>`, confirmation-number input, notes textarea, and a Save button that writes back into the task and calls `ctx.save()`. "Copy new address" button.

- [ ] **Step 1: Implement `moving-checklist/js/views/task-detail.js`**

```js
import { el, clear } from "../ui.js";
import { templateOf } from "../rules.js";

const STATUSES = [["not_started","Not started"],["in_progress","In progress"],
  ["submitted","Submitted"],["waiting","Waiting for confirmation"],
  ["completed","Completed"],["not_applicable","Not applicable"],["skipped","Skipped"]];

export function render(root, ctx, taskId) {
  clear(root);
  const task = (ctx.state.tasks || []).find(t => t.id === taskId);
  const tpl = task && templateOf(task.templateId);
  if (!task || !tpl) { root.append(el("p", { class: "error", text: "Task not found." }),
    el("a", { href: "#/checklist", text: "Back to checklist" })); return; }

  const badge = el("span", { class: "badge " + tpl.priority.toLowerCase().replace(/\s+/g, "-"), text: tpl.priority });
  const statusSel = el("select", { id: "td-status", "aria-label": "Status" },
    STATUSES.map(([v, t]) => el("option", { value: v, text: t, selected: task.status === v })));
  const conf = el("input", { id: "td-conf", value: task.confirmationNumber || "", "aria-label": "Confirmation number" });
  const notes = el("textarea", { id: "td-notes", rows: "4", "aria-label": "Private notes" });
  notes.value = task.notes || "";

  const saveBtn = el("button", { class: "primary", type: "button", text: "Save task" });
  saveBtn.onclick = async () => {
    task.status = statusSel.value;
    task.confirmationNumber = conf.value;
    task.notes = notes.value;
    task.updatedAt = new Date().toISOString();
    await ctx.save();
  };

  const official = el("a", { href: tpl.officialUrl, target: "_blank", rel: "noopener noreferrer",
    class: "", text: `Open official ${tpl.agency} website ↗` });
  const copyBtn = el("button", { type: "button", text: "Copy new ZIP" });
  copyBtn.onclick = () => { navigator.clipboard?.writeText(ctx.state.move.newZip || ""); ctx.toast("Copied new ZIP."); };

  root.append(
    el("a", { href: "#/checklist", class: "muted", text: "← Back to checklist" }),
    el("div", { class: "row" }, [el("h1", { text: tpl.title }), badge]),
    el("p", {}, [task.reason || tpl.reason]),
    el("section", { class: "card" }, [
      el("h2", { text: "Why this matters" }), el("p", { text: tpl.description }),
      el("h3", { text: "Timing" }),
      el("ul", {}, [
        el("li", { text: `Recommended by: ${task.recommendedDate || "set a move date"}` }),
        el("li", { text: `Deadline: ${tpl.deadlineNote}` }),
        el("li", { text: `Estimated time: ${tpl.estTime}` }),
        el("li", { text: `Method: ${tpl.method}` }),
      ]),
    ]),
    el("section", { class: "card" }, [
      el("h3", { text: "Prepare" }),
      el("ul", {}, (tpl.requiredInfo || []).map(x => el("li", { text: x }))),
      el("h3", { text: "Steps" }),
      el("ol", {}, (tpl.steps || []).map(x => el("li", { text: x }))),
      el("p", { class: "muted", html: "External link is the <strong>official</strong> government/provider site." }),
      el("div", { class: "row" }, [el("button", { class: "primary", type: "button",
        onClick: () => window.open(tpl.officialUrl, "_blank", "noopener") }, ["Go to official website"]), copyBtn]),
    ]),
    el("section", { class: "card" }, [
      el("h3", { text: "Track progress" }),
      el("label", { text: "Status", for: "td-status" }), statusSel,
      el("label", { text: "Confirmation number", for: "td-conf" }), conf,
      el("label", { text: "Private notes", for: "td-notes" }), notes,
      el("div", { class: "row" }, [saveBtn]),
    ]),
    el("p", { class: "muted", text: `Guidance last verified ${tpl.verifiedOn}. Informational only, not legal advice.` }),
  );
}
```

- [ ] **Step 2: Manual verify**

Open a task → change status + add confirmation number/notes → Save → toast "Saved." Navigate away and back → values persisted (in memory) and on reload from GitHub after save.

- [ ] **Step 3: Commit**

```bash
git add moving-checklist/js/views/task-detail.js
git commit -m "feat: add task detail view with progress tracking"
```

---

## Task 14: settings view (token, move details, backup, delete)

**Files:**
- Create: `moving-checklist/js/views/settings.js`

**Interfaces:**
- Consumes: `ui`, `auth` (getToken/setToken/clearToken/logout), `store` (exportBlobText/remove/setState/session), `mergeTasks` (rules.js).
- Produces: `render(root, ctx)`. Sections: GitHub token entry/clear; edit move details (re-runs `mergeTasks` preserving progress, then `ctx.save()`); download encrypted backup; delete profile (confirm → `store.remove(token)` → back to gate); logout; legal disclaimer.

- [ ] **Step 1: Implement `moving-checklist/js/views/settings.js`**

```js
import { el, clear } from "../ui.js";
import * as auth from "../auth.js";
import * as store from "../store.js";
import { mergeTasks } from "../rules.js";

export function render(root, ctx) {
  clear(root);
  const st = ctx.state;

  // Token
  const tokIn = el("input", { type: "password", value: auth.getToken() || "", "aria-label": "GitHub token" });
  const saveTok = el("button", { class: "primary", type: "button", text: "Save token" });
  saveTok.onclick = () => { auth.setToken(tokIn.value.trim()); ctx.toast("Token saved."); };
  const clearTok = el("button", { type: "button", text: "Remove token" });
  clearTok.onclick = () => { auth.clearToken(); tokIn.value = ""; ctx.toast("Token removed."); };

  // Move details (regenerate preserving progress)
  const zip = el("input", { value: st.move.newZip || "", "aria-label": "New ZIP" });
  const date = el("input", { type: "date", value: st.move.moveDate || "", "aria-label": "Move date" });
  const regen = el("button", { class: "primary", type: "button", text: "Update & regenerate" });
  regen.onclick = async () => {
    st.move.newZip = zip.value; st.move.moveDate = date.value;
    st.tasks = mergeTasks(st.tasks || [], st.move);
    await ctx.save(); ctx.toast("Checklist updated."); ctx.navigate("#/");
  };

  // Backup
  const backup = el("button", { type: "button", text: "Download encrypted backup" });
  backup.onclick = async () => {
    const text = await store.exportBlobText();
    const blob = new Blob([text], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob),
      download: `${store.session().username}.enc.json` });
    document.body.append(a); a.click(); a.remove();
  };

  // Delete
  const del = el("button", { type: "button", text: "Delete this profile" });
  del.style.borderColor = "var(--danger)"; del.style.color = "var(--danger)";
  del.onclick = async () => {
    if (!confirm("Delete this profile and its encrypted data from the repo? This cannot be undone.")) return;
    const token = auth.getToken();
    if (!token) { ctx.toast("A token is required to delete."); return; }
    try { await store.remove(token); location.hash = ""; location.reload(); }
    catch { ctx.toast("Delete failed."); }
  };

  root.append(
    el("h1", { text: "Settings" }),
    el("section", { class: "card" }, [
      el("h2", { text: "GitHub token" }),
      el("p", { class: "muted", html: "Fine-grained token, this repo only, Contents: read &amp; write. Stored in this browser; sent only to api.github.com. If your device is compromised the token can leak." }),
      tokIn, el("div", { class: "row" }, [saveTok, clearTok]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Move details" }),
      el("label", { text: "New ZIP code" }), zip,
      el("label", { text: "Move date" }), date,
      el("p", { class: "muted", text: "Regenerating keeps your status, notes, and confirmation numbers on tasks that still apply." }),
      el("div", { class: "row" }, [regen]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Your data" }),
      el("p", { class: "muted", text: "Your data is encrypted with your password. The backup file is encrypted too." }),
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

- [ ] **Step 2: Manual verify**

Settings renders all sections; save/remove token toasts; regenerate updates tasks and returns to dashboard; backup downloads a `.enc.json`; delete prompts confirm.

- [ ] **Step 3: Commit**

```bash
git add moving-checklist/js/views/settings.js
git commit -m "feat: add settings view (token, move details, backup, delete)"
```

---

## Task 15: end-to-end verification, README pointer, deploy notes

**Files:**
- Create: `moving-checklist/README.md`
- Modify: `README.md` (append a short pointer to the app)

**Interfaces:** none (docs + verification).

- [ ] **Step 1: Run the full test suite**

Run: `cd moving-checklist && node --test tests/`
Expected: all tests pass (crypto, dates, tasks-data, rules, github, store, auth).

- [ ] **Step 2: Full manual E2E against a local server**

Run: `python3 -m http.server -d moving-checklist 8099`
In a browser at `http://localhost:8099/`:
1. Create profile `anirudh` with a token + password → onboarding → dashboard renders.
2. Open a task, set status "submitted" + confirmation number, Save → toast "Saved."
3. Reload the page, log in as `anirudh` → the saved status/number persist (proves GitHub round-trip).
4. Log out; create profile `rwik` → independent checklist.
5. In a different browser (no token), log in as `anirudh` → data loads read-only (unauthenticated read); saving shows the "add a token" toast.
Document any failure and fix before proceeding. (This step requires a real fine-grained PAT for the repo.)

- [ ] **Step 3: Write `moving-checklist/README.md`**

```markdown
# MoveAddress — Moving Checklist

Static, password-protected moving address-change checklist.
Live: https://proxy-eval-max.github.io/moving-checklist/

## How it works
- Each profile is one AES-GCM-encrypted file in `data/<username>.enc.json`.
- Your password derives the encryption key (PBKDF2, 250k iterations) — it is never stored.
- Reading works unauthenticated (public repo). Saving needs a fine-grained GitHub
  Personal Access Token (this repo only, Contents: read & write), pasted once and kept
  in your browser's localStorage.

## Create the first profiles
1. Open the site, use "Create a profile", pick a username (e.g. `anirudh`), a password
   (min 8 chars), and paste your token.
2. Complete onboarding to generate the checklist.
3. Repeat for other people (e.g. `rwik`).

## Develop / test
No build step. Run the logic tests with Node 20+:
```
cd moving-checklist && node --test tests/
```
Serve locally: `python3 -m http.server -d moving-checklist 8099`

## Security notes
- The login is not an access wall (all code is public), but the data is genuinely
  encrypted and unreadable without the password.
- No sensitive identifiers (SSN, license, passport, bank numbers) are collected.
- Informational only — not legal advice.
```

- [ ] **Step 4: Append pointer to top-level `README.md`**

Add at the very top of `README.md` (before the existing product plan), preserving the rest:

```markdown
> **Live app:** A working MVP of this product is deployed at
> [`/moving-checklist/`](https://proxy-eval-max.github.io/moving-checklist/).
> Source is in [`moving-checklist/`](./moving-checklist/). See its
> [README](./moving-checklist/README.md) for setup.

```

- [ ] **Step 5: Confirm GitHub Pages settings (manual note)**

Ensure the repo's GitHub Pages is set to deploy from `main` at root (Settings → Pages).
The app will be live at `https://proxy-eval-max.github.io/moving-checklist/`.
`.nojekyll` ensures files under `moving-checklist/` are served verbatim.

- [ ] **Step 6: Commit**

```bash
git add moving-checklist/README.md README.md
git commit -m "docs: add app README and top-level pointer"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** auth+encryption (Tasks 2,7,8), persistence/sync incl. conflict + no-token degradation (Tasks 6,7,9), onboarding (10), rules engine incl. all four README §9 examples (5), task data national+TX/Austin (4), dashboard/checklist/task-detail/settings (11-14), accessibility/mobile via CSS + ARIA (1,9-14), security disclaimers + data export + delete (14), testing (2-8,15). Reminders are intentionally in-app only (no server) — surfaced in dashboard buckets, noted in spec §6.5.
- **Out of scope (per spec §11):** uploads, email/SMS sending, household collaboration, admin portal, direct submissions — not implemented by design.
- **Type consistency:** `move` answer keys are identical across onboarding.js, store.emptyState, rules.js, and tasks-data `applies()`. Task-state shape (`id/templateId/status/reason/recommendedDate/deadlineNote/confirmationNumber/notes/updatedAt`) is produced in rules.js and consumed unchanged in every view. `ctx` shape (`state/save/navigate/toast/token`) is identical in app.js and all views. Status vocabulary matches spec §6.4.
```
