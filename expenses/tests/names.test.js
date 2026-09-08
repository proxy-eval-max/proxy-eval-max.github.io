import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seal } from "../js/secret.js";
import { nameOf, namesUnsealed, unsealNames, forgetNames, __setNames }
  from "../js/names.js";

const PAYLOAD = JSON.stringify({ p1: "Ada", p2: "Grace" });
const fileWith = (records) => ({ ok: true, json: async () => ({ v: 1, records }) });

test("placeholders until something is unsealed", () => {
  forgetNames();
  assert.equal(namesUnsealed(), false);
  assert.equal(nameOf("p1"), "Partner one");
  assert.equal(nameOf("p2"), "Partner two");
  assert.equal(nameOf("nobody"), "nobody");
});

test("the right address unseals both names", async () => {
  forgetNames();
  const records = [await seal(PAYLOAD, "one@example.com"),
    await seal(PAYLOAD, "two@example.com")];
  // Second record, to prove it tries every one rather than just the first.
  assert.equal(await unsealNames("  Two@Example.COM ", () => fileWith(records)), true);
  assert.equal(nameOf("p1"), "Ada");
  assert.equal(nameOf("p2"), "Grace");
});

test("a stranger's address leaves the placeholders in place", async () => {
  forgetNames();
  const records = [await seal(PAYLOAD, "one@example.com")];
  assert.equal(await unsealNames("nope@example.com", () => fileWith(records)), false);
  assert.equal(namesUnsealed(), false);
  assert.equal(nameOf("p1"), "Partner one");
});

// The page has to keep working before the sealed file exists, or the first deploy
// is a blank screen instead of a slightly impersonal one.
test("a missing or broken sealed file degrades to placeholders", async () => {
  forgetNames();
  assert.equal(await unsealNames("one@example.com", () => ({ ok: false })), false);
  assert.equal(await unsealNames("one@example.com", () => { throw new Error("offline"); }), false);
  assert.equal(await unsealNames("", () => fileWith([])), false);
  assert.equal(nameOf("p1"), "Partner one");
});

test("only the two known slots are taken from the payload", async () => {
  forgetNames();
  const junk = '{"p1":"Ada","p2":"Grace","p3":"Intruder","__proto__":"x"}';
  const records = [await seal(junk, "one@example.com")];
  await unsealNames("one@example.com", () => fileWith(records));
  assert.equal(nameOf("p3"), "p3");
  assert.equal(nameOf("p1"), "Ada");
});

test("signing out forgets the names", () => {
  __setNames({ p1: "Ada", p2: "Grace" });
  assert.equal(namesUnsealed(), true);
  forgetNames();
  assert.equal(namesUnsealed(), false);
});

// If the sealed file is ever committed, it must be opaque: base64 and metadata,
// nothing that reads as a name.
test("any committed sealed file contains only ciphertext and parameters", async () => {
  let raw;
  try {
    raw = await readFile(new URL("../data/names.enc.json", import.meta.url), "utf8");
  } catch {
    return; // not sealed yet; nothing to check
  }
  const file = JSON.parse(raw);
  assert.ok(Array.isArray(file.records) && file.records.length);
  for (const r of file.records) {
    assert.deepEqual(Object.keys(r).sort(), ["cipher", "ciphertext", "kdf", "v"]);
    for (const b64 of [r.ciphertext, r.cipher.iv, r.kdf.salt])
      assert.match(b64, /^[A-Za-z0-9+/]+={0,2}$/);
  }
});
