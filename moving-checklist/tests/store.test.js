import { test } from "node:test";
import assert from "node:assert/strict";
import * as store from "../js/store.js";
import * as realCrypto from "../js/crypto.js";

function memGithub() {
  const files = new Map();
  return {
    files,
    dataPath: (u) => `moving-checklist/data/${u}.enc.json`,
    async getFile(path) { return files.has(path) ? { text: files.get(path), sha: "s" + files.size } : null; },
    async putFile(path, text) { files.set(path, text); return { sha: "s" + files.size }; },
    async deleteFile(path) { files.delete(path); return true; },
  };
}

test("load throws no-profile when file missing", async () => {
  store.__setDeps({ github: memGithub(), crypto: realCrypto });
  await assert.rejects(() => store.load("ghost", "pw", "tok"), /no-profile/);
});

test("save then load round-trips state", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  // seed a profile by encrypting an empty state directly
  const st = store.emptyState("anirudh");
  st.meta.onboarded = true; st.move.newZip = "78701";
  const blob = await realCrypto.encrypt("pw", st);
  gh.files.set(gh.dataPath("anirudh"), JSON.stringify(blob));

  const loaded = await store.load("anirudh", "pw", "tok");
  assert.equal(loaded.move.newZip, "78701");
  loaded.move.moveDate = "2026-08-01";
  store.setState(loaded);
  await store.save("tok");

  store.clear();
  const again = await store.load("anirudh", "pw", "tok");
  assert.equal(again.move.moveDate, "2026-08-01");
});

test("load with wrong password throws decrypt-failed", async () => {
  const gh = memGithub();
  store.__setDeps({ github: gh, crypto: realCrypto });
  const blob = await realCrypto.encrypt("right", store.emptyState("bob"));
  gh.files.set(gh.dataPath("bob"), JSON.stringify(blob));
  await assert.rejects(() => store.load("bob", "wrong", "tok"), /decrypt-failed/);
});
