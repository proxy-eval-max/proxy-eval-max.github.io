import { test } from "node:test";
import assert from "node:assert/strict";
import { loadUserState, saveUserState, deleteUserState } from "../js/firestore.js";

// Fake Firestore deps backed by an in-memory Map. doc() returns a string ref key.
function fakeDeps() {
  const m = new Map();
  return {
    _m: m,
    db: {},
    doc: (_db, col, uid) => `${col}/${uid}`,
    getDoc: async (ref) => ({ exists: () => m.has(ref), data: () => m.get(ref) }),
    setDoc: async (ref, data) => { m.set(ref, JSON.parse(JSON.stringify(data))); },
    deleteDoc: async (ref) => { m.delete(ref); },
  };
}

test("loadUserState returns null when the doc is missing", async () => {
  const deps = fakeDeps();
  assert.equal(await loadUserState(deps, "u1"), null);
});

test("save then load round-trips the state", async () => {
  const deps = fakeDeps();
  const state = { move: { newZip: "78701" }, tasks: [{ id: "a", status: "completed" }], meta: { onboarded: true } };
  assert.equal(await saveUserState(deps, "u1", state), true);
  const out = await loadUserState(deps, "u1");
  assert.deepEqual(out, state);
  // stored under the uid-specific ref, not shared
  assert.equal(await loadUserState(deps, "other"), null);
});

test("deleteUserState removes the doc", async () => {
  const deps = fakeDeps();
  await saveUserState(deps, "u1", { meta: { onboarded: true } });
  assert.equal(await deleteUserState(deps, "u1"), true);
  assert.equal(await loadUserState(deps, "u1"), null);
});
