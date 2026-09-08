// The only two people this tracker is for — as two opaque slots, `p1` and `p2`.
//
// Nothing identifying is written down here. No email addresses (only salted
// SHA-256 digests of them) and no names: the display names are sealed in
// data/names.enc.json and unlocked at sign-in, see names.js. The ids are
// deliberately dull, because they end up in Firestore documents, in CSS
// selectors and in the DOM, and every one of those is readable by anyone.
//
// Be clear-eyed about what the digests buy: they keep addresses out of the page
// source and out of git, so a scraper finds nothing to harvest. They are NOT
// secrecy — the salt ships with the client, so anyone who already suspects an
// address can hash it and confirm. The thing that actually keeps other people
// out is firestore.rules, which checks the same digests server-side.
//
// To change an address, regenerate the digest with:
//   node tools/hash-email.js <the-address>
// and paste it into both this file and firestore.rules. tests/members.test.js
// fails if a literal address or a name ever lands back in the client source.
import { MEMBERS_SALT, sha256Hex } from "./hash.js";

export const MEMBERS = [
  { id: "p1", emailHash: "2ebb87562543e2375120196201baf13f19c21fac65514361536454c78fe66996" },
  { id: "p2", emailHash: "dd2af658a76da97333aea44e68e7ba818eac89e2130406615d3e48417e9cd456" },
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
export function isMemberId(id) { return !!memberById(id); }
export function otherThan(id) { return MEMBERS.find(m => m.id !== id)?.id || null; }
