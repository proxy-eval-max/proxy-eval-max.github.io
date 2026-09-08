// Salted SHA-256, shared by the client and by tools/hash-email.js.
//
// The salt is a domain separator, not a secret — it ships in the bundle. It stops
// a generic rainbow table of common gmail addresses from matching these digests;
// it does not stop someone who guesses the address outright. Keep it byte-identical
// to the SALT constant in ../firestore.rules or sign-in will fail server-side.
export const MEMBERS_SALT = "whose-turn/v1/";

const enc = new TextEncoder();

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
