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
