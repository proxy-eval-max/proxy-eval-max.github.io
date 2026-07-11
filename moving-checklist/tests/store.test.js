import { test } from "node:test";
import assert from "node:assert/strict";
import * as store from "../js/store.js";

// Fake firestore module backed by an in-memory map (ignores fsDeps).
function memFs() {
  const m = new Map();
  return {
    _m: m,
    async loadUserState(_deps, uid) { return m.has(uid) ? JSON.parse(m.get(uid)) : null; },
    async saveUserState(_deps, uid, state) { m.set(uid, JSON.stringify(state)); return true; },
    async deleteUserState(_deps, uid) { m.delete(uid); return true; },
  };
}

test("load returns null for a new user", async () => {
  store.__setDeps({ fs: memFs(), fsDeps: {} });
  store.clear();
  assert.equal(await store.load("newuser"), null);
});

test("startFresh gives an empty, un-onboarded state", async () => {
  store.__setDeps({ fs: memFs(), fsDeps: {} });
  const st = store.startFresh("u1");
  assert.equal(st.meta.onboarded, false);
  assert.deepEqual(st.tasks, []);
  assert.equal(st.move.immigration, "prefer_not");
  assert.equal("username" in st.profile, false);
});

test("setState + save + reload round-trips via firestore", async () => {
  const fs = memFs();
  store.__setDeps({ fs, fsDeps: {} });
  const st = store.startFresh("u1");
  st.meta.onboarded = true; st.move.newZip = "78701";
  store.setState(st);
  await store.save();
  store.clear();
  const again = await store.load("u1");
  assert.equal(again.move.newZip, "78701");
  assert.equal(again.meta.onboarded, true);
});

test("remove deletes the doc and clears the session", async () => {
  const fs = memFs();
  store.__setDeps({ fs, fsDeps: {} });
  store.startFresh("u1"); await store.save();
  await store.remove();
  assert.equal(store.getState(), null);
  assert.equal(await store.load("u1"), null);
});

test("save with no session throws no-session", async () => {
  store.__setDeps({ fs: memFs(), fsDeps: {} });
  store.clear();
  await assert.rejects(() => store.save(), /no-session/);
});
