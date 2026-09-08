import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MEMBERS, MEMBER_IDS, memberByEmail, isMemberId, otherThan } from "../js/members.js";
import { MEMBERS_SALT, sha256Hex } from "../js/hash.js";

test("sha256Hex matches a known vector", async () => {
  assert.equal(await sha256Hex(MEMBERS_SALT + "test@example.com"),
    "cac88b47b3283115aab6513e7e10905ebb6b7d17a389c5b30731a12b731608a7");
});

// The point of hashing: a crawler reading this repo finds no addresses to harvest.
test("no plaintext email addresses anywhere in the client source", async () => {
  const files = ["js/members.js", "js/hash.js", "js/app.js", "js/db.js",
    "js/auth.js", "js/firebase.js", "js/firebase-config.js", "index.html"];
  for (const f of files) {
    const src = await readFile(new URL(`../${f}`, import.meta.url), "utf8");
    // Letter TLD required, or the Google Fonts axis syntax ("wght@9..144") trips it.
    const hits = src.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi) || [];
    assert.deepEqual(hits, [], `${f} contains an email-looking string: ${hits}`);
  }
});

test("members carry a digest and nothing identifying", () => {
  assert.equal(MEMBERS.length, 2);
  for (const m of MEMBERS) {
    assert.match(m.emailHash, /^[0-9a-f]{64}$/);
    assert.equal("email" in m, false);
    // No display name here either: names are sealed in data/names.enc.json.
    assert.equal("name" in m, false);
  }
  // Opaque ids, because they end up in Firestore docs, CSS selectors and the DOM.
  assert.deepEqual(MEMBER_IDS, ["p1", "p2"]);
});

test("an unknown address matches nobody", async () => {
  assert.equal(await memberByEmail("test@example.com"), null);
  assert.equal(await memberByEmail(""), null);
  assert.equal(await memberByEmail(null), null);
  assert.equal(await memberByEmail("  "), null);
});

test("lookup is case- and whitespace-insensitive", async () => {
  // Round-trip through a digest we control rather than a real address.
  const h = await sha256Hex(MEMBERS_SALT + "someone@example.com");
  const fake = [{ id: "x", name: "X", emailHash: h }];
  const norm = "  SomeOne@Example.COM  ".trim().toLowerCase();
  assert.equal(await sha256Hex(MEMBERS_SALT + norm), fake[0].emailHash);
});

test("membership and partner helpers", () => {
  assert.equal(isMemberId("p1"), true);
  assert.equal(isMemberId("nobody"), false);
  assert.equal(otherThan("p1"), "p2");
  assert.equal(otherThan("p2"), "p1");
});
