// Display names, kept out of the source.
//
// The two people's names live nowhere in this repo. They sit in
// data/names.enc.json as two sealed copies of the same small JSON payload —
// {"p1":"…","p2":"…"} — each copy encrypted under a key derived from one
// partner's email address. Sign in, and the client tries your address against
// both records; the one that authenticates hands back both names for the session.
// They are never written to storage and never leave memory.
//
// Why this actually hides something, unlike the usual "obfuscated in the bundle":
// the key is your email address, and no email address appears anywhere in the
// repo. The honest limit is in the shape of that secret rather than the
// cryptography — an address is guessable in a way a random key is not, and the
// salted digests in members.js / firestore.rules let a determined reader test a
// guess cheaply. So this defeats crawling and casual reading, which is what it
// is for. It is not protection against someone who already knows your address.
//
// Regenerate the file (names never pass through the repo or a diff) with:
//   node tools/seal-names.js
import { unseal } from "./secret.js";
import { normalizeEmail } from "./members.js";

// Shown until the sealed file has been fetched and opened — and permanently, if
// it is missing. The app stays usable with them; it just gets less personal.
const PLACEHOLDER = { p1: "Partner one", p2: "Partner two" };

let names = null;

export function nameOf(id) {
  return (names && names[id]) || PLACEHOLDER[id] || String(id ?? "");
}

export const namesUnsealed = () => names !== null;

// Injectable fetch so the tests never touch the network.
const defaultFetch = (url) => fetch(url, { cache: "no-store" });

/**
 * Try `email` against every record in the sealed file.
 * @returns {Promise<boolean>} true if the names are now available.
 */
export async function unsealNames(email, fetchImpl = defaultFetch) {
  const pass = normalizeEmail(email);
  if (!pass) return false;

  let file;
  try {
    const res = await fetchImpl(new URL("../data/names.enc.json", import.meta.url));
    if (!res.ok) return false;
    file = await res.json();
  } catch {
    return false; // no sealed file yet, or offline: fall back to placeholders
  }

  for (const record of file?.records || []) {
    const pt = await unseal(record, pass);
    if (!pt) continue;
    try {
      const parsed = JSON.parse(pt);
      // Only take the two known slots, and only strings — a sealed file is
      // trusted-ish, but it still shouldn't be able to inject arbitrary keys.
      const next = {};
      for (const id of Object.keys(PLACEHOLDER)) {
        if (typeof parsed?.[id] === "string" && parsed[id].trim())
          next[id] = parsed[id].trim().slice(0, 40);
      }
      if (!Object.keys(next).length) return false;
      names = next;
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function forgetNames() { names = null; }

// Test-only: stand in for a successful unseal without a sealed file on disk.
export function __setNames(next) { names = next ? { ...next } : null; }
