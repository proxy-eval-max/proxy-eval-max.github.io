// AES-GCM sealed blobs with a PBKDF2-derived key.
//
// Same envelope the moving-checklist export uses (data/*.enc.json): PBKDF2-SHA256
// over a random 16-byte salt, then AES-256-GCM with a random 12-byte IV. GCM is
// authenticated, so a wrong key fails loudly instead of returning garbage — which
// is what lets `unseal` double as "is this passphrase the right one?".
//
// Runs unchanged in the browser and in node: both expose Web Crypto as
// globalThis.crypto, and both have atob/btoa.
export const KDF_ITERATIONS = 250_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(plaintext, passphrase) {
  if (!passphrase) throw new Error("no-passphrase");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(plaintext)));
  return {
    v: 1,
    kdf: { algo: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt: b64(salt) },
    cipher: { algo: "AES-GCM", iv: b64(iv) },
    ciphertext: b64(ct),
  };
}

// Returns the plaintext, or null for the wrong passphrase / a malformed record.
// Never throws: callers use it to test candidate keys.
export async function unseal(record, passphrase) {
  if (!record || !passphrase) return null;
  try {
    const key = await deriveKey(passphrase, unb64(record.kdf.salt),
      record.kdf.iterations || KDF_ITERATIONS);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(record.cipher.iv) }, key, unb64(record.ciphertext));
    return dec.decode(pt);
  } catch {
    return null;
  }
}
