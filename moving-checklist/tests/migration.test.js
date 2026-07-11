import { test } from "node:test";
import assert from "node:assert/strict";
import { toImportState, importLegacy } from "../js/migration.js";
import { encrypt } from "../js/crypto.js";

test("toImportState strips profile.username and defaults arrays", () => {
  const out = toImportState({
    profile: { username: "anirudh", createdAt: "2026-01-01" },
    move: { newZip: "78701" }, tasks: [{ id: "a" }], meta: { onboarded: true, schemaVersion: 1 },
  });
  assert.equal("username" in out.profile, false);
  assert.equal(out.profile.createdAt, "2026-01-01");
  assert.equal(out.move.newZip, "78701");
  assert.deepEqual(out.tasks, [{ id: "a" }]);
  assert.equal(out.meta.onboarded, true);
});

test("importLegacy fetches, decrypts, and returns stripped state", async () => {
  const oldState = { profile: { username: "anirudh", createdAt: "x" },
    move: { newZip: "78701" }, tasks: [{ id: "usps-forwarding", status: "completed" }],
    meta: { onboarded: true, schemaVersion: 1 } };
  const blob = await encrypt("pw123456", oldState);
  const fakeFetch = async (url) => {
    assert.match(url, /anirudh\.enc\.json$/);
    return { ok: true, text: async () => JSON.stringify(blob) };
  };
  const out = await importLegacy("Anirudh", "pw123456", fakeFetch);
  assert.equal("username" in out.profile, false);
  assert.equal(out.tasks[0].status, "completed");
});

test("importLegacy throws import-failed on wrong password", async () => {
  const blob = await encrypt("right", { profile: {}, move: {}, tasks: [], meta: {} });
  const fakeFetch = async () => ({ ok: true, text: async () => JSON.stringify(blob) });
  await assert.rejects(() => importLegacy("anirudh", "wrong", fakeFetch), /import-failed/);
});

test("importLegacy throws import-failed on 404", async () => {
  const fakeFetch = async () => ({ ok: false, status: 404, text: async () => "" });
  await assert.rejects(() => importLegacy("ghost", "pw", fakeFetch), /import-failed/);
});
