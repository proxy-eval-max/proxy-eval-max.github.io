import { test } from "node:test";
import assert from "node:assert/strict";
import { seal, unseal, KDF_ITERATIONS } from "../js/secret.js";

test("a sealed record round-trips with the right passphrase", async () => {
  const rec = await seal("hello there", "key@example.com");
  assert.equal(await unseal(rec, "key@example.com"), "hello there");
});

test("the wrong passphrase yields null, not garbage", async () => {
  const rec = await seal("hello there", "key@example.com");
  assert.equal(await unseal(rec, "other@example.com"), null);
  assert.equal(await unseal(rec, ""), null);
  assert.equal(await unseal(rec, null), null);
});

test("a malformed or tampered record yields null instead of throwing", async () => {
  assert.equal(await unseal(null, "k"), null);
  assert.equal(await unseal({}, "k"), null);
  const rec = await seal("hello there", "k");
  // Flip a byte of ciphertext: GCM authenticates, so this must fail closed.
  const bad = { ...rec, ciphertext: "A" + rec.ciphertext.slice(1) };
  assert.equal(await unseal(bad, "k"), null);
});

test("the record itself carries no plaintext and no key material", async () => {
  const rec = await seal("Ada and Grace", "key@example.com");
  const json = JSON.stringify(rec);
  for (const leak of ["Ada", "Grace", "key@example.com"])
    assert.equal(json.includes(leak), false, `record leaks ${leak}`);
  assert.equal(rec.kdf.iterations, KDF_ITERATIONS);
  assert.equal(rec.cipher.algo, "AES-GCM");
});

test("each sealing uses a fresh salt and iv", async () => {
  const a = await seal("same", "k");
  const b = await seal("same", "k");
  assert.notEqual(a.kdf.salt, b.kdf.salt);
  assert.notEqual(a.cipher.iv, b.cipher.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test("seal refuses an empty passphrase", async () => {
  await assert.rejects(() => seal("x", ""), /no-passphrase/);
});
