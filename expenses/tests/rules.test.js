import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MEMBERS } from "../js/members.js";
import { MEMBERS_SALT } from "../js/hash.js";

const rulesPath = new URL("../../firestore.rules", import.meta.url);
const rules = await readFile(rulesPath, "utf8");

// The rules are the real gate. If the client and the rules ever disagree about the
// salt or the digests, sign-in silently breaks — or worse, stops gating. Pin both.
test("the rules hash with the same salt as the client", () => {
  assert.ok(rules.includes(`'${MEMBERS_SALT}'`),
    `firestore.rules must salt with '${MEMBERS_SALT}'`);
});

test("the rules allowlist exactly the client's member digests", () => {
  const inRules = (rules.match(/'[0-9a-f]{64}'/g) || []).map(s => s.slice(1, -1));
  assert.deepEqual(inRules.sort(), MEMBERS.map(m => m.emailHash).sort());
});

test("the rules carry no plaintext addresses either", () => {
  assert.deepEqual(rules.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [], []);
});

test("entries are immutable and everything unmatched is denied", () => {
  assert.match(rules, /allow update: if false/);
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});

test("writes require a verified email and a throttle-meter bump", () => {
  assert.match(rules, /email_verified == true/);
  assert.match(rules, /getAfter\(/);
  assert.match(rules, /duration\.value\(2, 's'\)/);
});
