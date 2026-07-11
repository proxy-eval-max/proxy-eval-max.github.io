import { test } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../js/auth.js";
import * as store from "../js/store.js";
import * as realCrypto from "../js/crypto.js";

function memGithub() {
  const files = new Map();
  return { files,
    dataPath: (u) => `moving-checklist/data/${u}.enc.json`,
    async getFile(path) { return files.has(path) ? { text: files.get(path), sha: "s1" } : null; },
    async putFile(path, text) { files.set(path, text); return { sha: "s2" }; },
    async deleteFile(path) { files.delete(path); return true; } };
}

test("validUsername enforces charset", () => {
  assert.equal(auth.validUsername("anirudh"), true);
  assert.equal(auth.validUsername("rwik_2"), true);
  assert.equal(auth.validUsername("bad name"), false);
  assert.equal(auth.validUsername("../etc"), false);
});

test("createProfile then login works; second create throws exists", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  auth.__setDeps({ store, github: gh, crypto: realCrypto });
  await auth.createProfile("anirudh", "password1", "tok");
  assert.ok(gh.files.has(gh.dataPath("anirudh")));
  await assert.rejects(() => auth.createProfile("anirudh", "password1", "tok"), /exists/);
  store.clear();
  const st = await auth.login("Anirudh", "password1", "tok");
  assert.equal(st.profile.username, "anirudh");
});

test("createProfile rejects short password", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  auth.__setDeps({ store, github: gh, crypto: realCrypto });
  await assert.rejects(() => auth.createProfile("bob", "short", "tok"), /weak-password/);
});

test("login with wrong password throws bad-credentials", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  auth.__setDeps({ store, github: gh, crypto: realCrypto });
  await auth.createProfile("carol", "password1", "tok");
  store.clear();
  await assert.rejects(() => auth.login("carol", "nope", "tok"), /bad-credentials/);
});
