// The only two people this tracker is for.
//
// Email addresses are not written down here — only salted SHA-256 hashes of them.
// Be clear-eyed about what that buys: it keeps the addresses out of the page
// source and out of git, so a scraper crawling the repo or the deployed JS finds
// nothing to harvest. It is NOT secrecy. The salt ships with the client, so
// anyone who already suspects an address can hash it and confirm the match. The
// thing that actually keeps other people out is the Firestore rules
// (firestore.rules at the repo root), which check the same hashes server-side.
//
// To change or add an address, regenerate the digest with:
//   node tools/hash-email.js <the-address>
// and paste it into both this file and firestore.rules. tests/members.test.js fails
// the build if a literal address ever lands back in the client source.
import { MEMBERS_SALT, sha256Hex } from "./hash.js";

export const MEMBERS = [
  { id: "anirudh", name: "Anirudh",
    emailHash: "2ebb87562543e2375120196201baf13f19c21fac65514361536454c78fe66996" },
  { id: "pallavi", name: "Pallavi",
    emailHash: "dd2af658a76da97333aea44e68e7ba818eac89e2130406615d3e48417e9cd456" },
];

export const MEMBER_IDS = MEMBERS.map(m => m.id);

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hashEmail(email) {
  return sha256Hex(MEMBERS_SALT + normalizeEmail(email));
}

// Async because it hashes: resolve once at sign-in, then use the plain id.
export async function memberByEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  const h = await hashEmail(e);
  return MEMBERS.find(m => timingSafeEqualHex(m.emailHash, h)) || null;
}

// Constant-time-ish hex compare. Overkill for a two-person app, but comparing
// digests with === is the kind of habit that bites somewhere that matters.
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function memberById(id) { return MEMBERS.find(m => m.id === id) || null; }
export function nameOf(id) { return memberById(id)?.name || id; }
export function otherThan(id) { return MEMBERS.find(m => m.id !== id)?.id || null; }
