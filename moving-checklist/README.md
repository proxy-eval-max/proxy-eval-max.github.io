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
No build step. Run the logic tests with Node 26+:
```
cd moving-checklist && node --test 'tests/*.test.js'
```
Serve locally: `python3 -m http.server -d moving-checklist 8099`

## Security notes
- The login is not an access wall (all code is public), but the data is genuinely
  encrypted and unreadable without the password.
- No sensitive identifiers (SSN, license, passport, bank numbers) are collected.
- Informational only — not legal advice.
