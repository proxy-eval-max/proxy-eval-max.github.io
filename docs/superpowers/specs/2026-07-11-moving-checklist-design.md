# MoveAddress — Password-Protected Moving Checklist (GitHub Pages)

**Date:** 2026-07-11
**Status:** Approved design, pending spec review
**Live URL:** https://proxy-eval-max.github.io/moving-checklist/
**Repo:** proxy-eval-max/proxy-eval-max.github.io (branch: main)

## 1. Summary

A static single-page web app that implements the MVP of the **MoveAddress** product
described in `README.md`: a personalized, per-user moving address-change checklist.

Each person has their own profile protected by a username + password. The password is
used to **encrypt** that user's data (not merely to gate access), and the encrypted blob
is stored in the repo so it syncs across devices. The site is hosted on GitHub Pages, so
all logic runs client-side; there is no server.

First profiles to create: **anirudh** and **rwik**. New profiles are created through a
self-service "Create profile" flow — no credentials are ever hardcoded.

## 2. Hosting & path layout

- App served at `https://proxy-eval-max.github.io/moving-checklist/`.
- All app files live in the top-level `moving-checklist/` folder of the repo (this is what
  GitHub Pages maps to the `/moving-checklist/` path).
- Encrypted per-user data lives in `moving-checklist/data/`.
- All asset references are **relative** so the app works from that path without a base tag.

## 3. Architecture

Vanilla JavaScript with **ES modules** — no build step, no framework, no bundler. GitHub
Pages serves the files as-is. A small hand-rolled hash router (`#/dashboard`,
`#/checklist`, `#/task/<id>`, `#/onboarding`, `#/settings`) switches views inside a single
`index.html` shell.

Rationale: static hosting is most robust with plain files; the app is view-driven and does
not need a framework; no build pipeline means no deploy tooling to maintain.

### File structure

```
moving-checklist/
  index.html            # shell + login/create-profile gate
  css/styles.css        # responsive, accessible styling (light/dark aware)
  js/
    app.js              # boot + hash router + view mounting
    crypto.js           # PBKDF2 key derivation + AES-GCM encrypt/decrypt
    github.js           # GitHub Contents API read/write wrapper
    store.js            # in-memory state + load/save (encrypt <-> github)
    auth.js             # login, create-profile, logout, session
    onboarding.js       # move questionnaire
    rules.js            # personalization engine (README §9 rules)
    tasks-data.js       # national + Texas/Austin task templates (README §8, §12)
    dates.js            # deadline / recommended-date computation from move date
    views/
      dashboard.js      # progress ring, next tasks, overdue, category progress
      checklist.js      # filters, sorting, task rows
      task-detail.js    # status, timing, prep, official link, notes, confirmation #
      settings.js       # profile, move details, token, data export, delete profile
  data/                 # per-user encrypted blobs (created at runtime)
    .gitkeep
```

Top-level `.nojekyll` file added to the repo so GitHub Pages serves the files without
Jekyll processing.

## 4. Authentication & encryption

Core principle: the **password IS the encryption key source**. There is no separate site
password and no plaintext secret anywhere.

### Key derivation & cipher (Web Crypto API)

- `PBKDF2` with `SHA-256`, **250,000 iterations**, a per-user random 16-byte salt →
  256-bit key.
- Data encrypted with **AES-GCM** (12-byte random IV, 128-bit auth tag).
- Web Crypto (`crypto.subtle`) is available on all modern browsers over HTTPS (GitHub Pages
  is HTTPS), which is required for `crypto.subtle`.

### Per-user file format

Path: `moving-checklist/data/<username>.enc.json`. The username is public (it is the
filename); everything else in the user's state is inside the ciphertext.

```json
{
  "v": 1,
  "username": "anirudh",
  "kdf": { "algo": "PBKDF2", "hash": "SHA-256", "iterations": 250000, "salt": "<base64>" },
  "cipher": { "algo": "AES-GCM", "iv": "<base64>" },
  "ciphertext": "<base64>"
}
```

Usernames are normalized to lowercase and restricted to `[a-z0-9_-]` (safe filenames, no
path traversal).

### Login flow

1. User enters username + password.
2. App fetches `data/<username>.enc.json` (unauthenticated read; see §5).
3. Derive key from password + stored salt; attempt AES-GCM decrypt.
4. Success (GCM auth tag validates) → logged in, decrypted state loaded into memory.
   Failure → "Incorrect username or password." (Indistinguishable messaging for
   missing-user vs. wrong-password to avoid confirming which usernames exist beyond the
   already-public filenames.)

### Create-profile flow

1. User enters a new username + password (+ confirm password).
2. If `data/<username>.enc.json` already exists → "That profile already exists."
3. Generate salt + IV, encrypt an empty initial state, `PUT` the new file to the repo
   (requires a token; see §5).
4. Log the user in and send them to onboarding.

This same flow creates **anirudh** and **rwik**; anirudh is not special-cased.

### Session

Decrypted state and the derived key live in memory for the tab session only. On logout /
tab close they are gone. The GitHub token persists in `localStorage` (see risk notes).
No auto-login of the decryption — the password must be re-entered each session, since the
key cannot be stored securely on a static page.

## 5. Persistence & sync (GitHub Contents API)

All reads and writes go through `https://api.github.com/repos/proxy-eval-max/proxy-eval-max.github.io/contents/moving-checklist/data/<username>.enc.json`.

- **Read** (`GET`): returns file content (base64) + `sha`. Works **unauthenticated** for a
  public repo (60 requests/hour/IP — ample for login). This means a user can log in and use
  the app read-only on a brand-new device with no token.
- **Write** (`PUT`): requires an `Authorization: Bearer <token>` header, a commit
  `message`, base64 `content`, and the current `sha` (for updates). Needs a
  **fine-grained Personal Access Token** scoped to only this repo with **Contents:
  read+write**.

### Token handling

- On first save (or via Settings), the app prompts for the token and stores it in
  `localStorage` under a namespaced key.
- The token is sent only to `api.github.com`.
- If no token is present, saving is disabled; the app still works locally for the session
  and offers **"Download encrypted backup"** (the `.enc.json` blob) so no work is lost.

### Save model

- State is held in memory and marked dirty on change.
- Saves are **explicit + debounced-autosave**: an explicit "Save" button, plus autosave a
  few seconds after changes settle (only when a token is present).
- Each save re-fetches the latest `sha`, re-encrypts the full state, and `PUT`s it.
- **Conflict handling:** if the `PUT` returns 409 (sha mismatch — edited elsewhere), the
  app re-fetches, informs the user their remote copy changed, and offers to reload remote or
  overwrite. (Single-user-per-profile makes true conflicts rare; this is a safety net.)

## 6. Application features (MVP)

Scope follows README §23 "MVP features"; everything in README §23 "Features to postpone"
is out of scope (no document uploads, no email scanning, no SMS, no household
collaboration, no marketplace, no direct/automatic updates).

### 6.1 Onboarding questionnaire (README §5 step 1, §27)

Collects, without requiring a full street address or any government ID number:
current ZIP, new ZIP, move date, move type (within-city / within-state / across-states),
rent vs own, vehicle ownership, utilities-included-in-rent, voter registration, children,
pets, government benefits, immigration context (citizen / permanent resident / visa holder
/ prefer not to say), professional licenses, reminder preference (email/browser — see 6.5).

### 6.2 Personalization engine (README §9)

`rules.js` takes the onboarding answers and selects/annotates task templates from
`tasks-data.js`. Implements the README §9 rule examples, at minimum:
- Within-Texas + vehicle → TX driver license, TX vehicle registration, auto-insurance
  garaging, toll account, lender/lease.
- Permanent resident / visa holder → USCIS address-change task with strong deadline warning
  + disclaimer that USPS forwarding does not update USCIS.
- Rents + utilities included → drop electricity/water transfer, add "confirm utility
  responsibility with landlord," keep internet.
- Moving to another state → new driver license, new vehicle registration, inspection/
  emissions, old-state voter review, state-tax note, health-network review.
Each generated task records **why it appears** (README §19) for display.

### 6.3 Task data (README §8, §12, §28)

`tasks-data.js` ships a curated template set: a **national/generic** baseline plus
**Texas + Austin** specifics (USPS, TX DPS driver license, TX DMV vehicle registration, TX
voter registration, IRS, USCIS, City of Austin Utilities / Austin Energy / Austin Water /
Austin Resource Recovery, Texas Gas Service, internet, toll accounts, Travis/Williamson/
Hays county note, insurance, school district). Each template carries the README §10 fields
that make sense for a static MVP: id, title, category, description, reason, applicable
locations, eligibility rules, priority (Legally required / Financially important / Prevents
service interruption / Recommended / Optional — README §19), recommended offset from move
date, legal-deadline note, before/after-move restriction, official URL, agency, method,
estimated time, required info, steps, and a **source last-verified date**.

Official external links are visibly labeled as official government/provider sites (README
§17) and open in a new tab.

### 6.4 Views

- **Dashboard** (README §7): move-date countdown, progress ring (% complete), next 3
  recommended tasks, overdue + due-this-week, before/after-move split, category progress,
  recent activity.
- **Checklist** (README §7): filters (all / due soon / overdue / before move / moving day /
  after move / completed / optional) and sort (recommended / deadline / priority / category
  / estimated time).
- **Task detail** (README §7, §28): summary, why-it-matters, timing (earliest / recommended
  / legal deadline / est. time), preparation list, "Open Official Website" button, steps,
  status control (Not started / In progress / Submitted / Waiting for confirmation /
  Completed / Not applicable / Skipped — README §10), confirmation-number field, notes.
- **Settings**: profile info, edit move details (regenerates checklist while preserving
  status/notes on retained tasks), GitHub token entry, download encrypted backup, delete
  profile (deletes the repo file via API), logout. Includes the legal disclaimer from
  README §17.

### 6.5 Reminders (README §11) — MVP subset

Deadlines and recommended dates are computed by `dates.js` from the move date. The
dashboard surfaces overdue / due-this-week groupings and the timeline ordering. **Email and
SMS reminders are out of scope** (no server to send them); this is noted honestly in the
UI. Optional: a "Add to calendar (.ics export)" for tasks with dates — low cost, no
server — included if it does not complicate the core.

## 7. Data model (in-memory, encrypted at rest)

Decrypted user state (the plaintext inside `ciphertext`):

```json
{
  "profile": { "username": "anirudh", "createdAt": "<iso>" },
  "move": {
    "oldZip": "", "newZip": "", "moveDate": "", "moveType": "",
    "housing": "", "hasVehicle": false, "utilitiesIncluded": false,
    "voter": false, "children": false, "pets": false, "benefits": false,
    "immigration": "prefer_not", "professionalLicenses": false
  },
  "tasks": [
    {
      "id": "tx-dl-address", "templateId": "tx-dl-address",
      "status": "not_started", "reason": "...",
      "recommendedDate": "<iso>", "deadlineNote": "...",
      "confirmationNumber": "", "notes": "", "updatedAt": "<iso>"
    }
  ],
  "meta": { "onboarded": true, "schemaVersion": 1 }
}
```

Task templates (definitions) live in code (`tasks-data.js`); user state stores only per-task
status/notes/confirmation keyed by template id, so template updates flow through without
migrations.

## 8. Error handling

- **Wrong password / missing profile:** unified "Incorrect username or password."
- **Network / API failure on read:** clear message; allow retry.
- **No token on save:** disable save, explain, offer encrypted backup download.
- **Bad/expired token (401/403):** prompt to re-enter token; do not lose in-memory state.
- **Save conflict (409/sha mismatch):** re-fetch and offer reload-remote vs. overwrite.
- **Web Crypto unavailable (non-HTTPS/old browser):** hard error page explaining HTTPS is
  required.
- **Corrupt/undecryptable blob:** treated as wrong password (GCM failure is
  indistinguishable by design).

## 9. Accessibility & mobile (README §19, §20)

Keyboard navigable, ARIA labels, high contrast, large tap targets, clear inline errors,
mobile-responsive forms. Mobile prioritizes today's tasks, one-tap official links, mark
complete, confirmation number, and a "Copy new address" affordance.

## 10. Security & privacy notes (honest limitations)

1. The login is not an access wall (all client code is public), but **data confidentiality
   is real** — encrypted blobs are useless without the password even though the repo is
   public.
2. **No sensitive identifiers stored** (README §16): no SSN, driver-license, passport, or
   bank numbers — users enter those directly on official sites.
3. **Token in `localStorage`:** a fine-grained, repo-scoped, contents-only token limits
   blast radius; it is transmitted only to `api.github.com`. If the device is compromised,
   the token can leak — acceptable for a personal/family tool and documented in Settings.
4. Password strength is the user's responsibility; PBKDF2 at 250k iterations raises brute-
   force cost. A minimum-length check is enforced on create-profile.
5. Legal disclaimer (README §17) shown: informational only, not legal advice, official
   agency instructions control.

## 11. Out of scope (postponed per README §23)

Document/photo uploads, Gmail/Outlook scanning, SMS reminders, server-sent email reminders,
household collaboration/assignment, native apps, provider marketplace, AI chat assistant,
multi-country, admin content portal, direct/automatic address submission.

## 12. Testing approach

No build step, so testing is browser-based and unit-level where possible:
- **Crypto round-trip:** encrypt→decrypt returns original; wrong password fails; tampered
  ciphertext fails (GCM). Runnable in a tiny `test.html` harness using the same modules.
- **Rules engine:** each README §9 example produces the expected task set (pure-function
  tests, no network).
- **Date logic:** offsets from a fixed move date produce expected recommended/deadline
  dates.
- **Manual E2E checklist:** create profile → onboard → see personalized list → change a
  task status + confirmation # → save → reload → state restored; login on a second browser
  (unauthenticated read) shows saved state.
- GitHub API calls are isolated in `github.js` so pure logic is testable without network.

## 13. Deliverables / first run

1. Files under `moving-checklist/` + top-level `.nojekyll`, committed to `main`.
2. GitHub Pages serving from `main` (root) — confirm/enable in repo settings.
3. On the live site: create the **anirudh** profile (choose password), complete onboarding,
   verify save with a token; then create **rwik** the same way.
