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
