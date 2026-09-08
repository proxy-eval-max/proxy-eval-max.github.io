import { test } from "node:test";
import assert from "node:assert/strict";
import * as db from "../js/db.js";

// Minimal stand-in for the Firestore SDK: records what a batch would have written.
function fakeDeps({ failCommit = null } = {}) {
  const commits = [];
  let n = 0;
  const deps = {
    db: { __db: true },
    commits,
    collection: (_db, ...path) => ({ kind: "collection", path }),
    doc: (parent, ...rest) => rest.length
      ? { kind: "doc", path: [...(parent.path || []), ...rest], id: rest.at(-1) }
      : { kind: "doc", path: [...parent.path, `auto${++n}`], id: `auto${n}` },
    serverTimestamp: () => "SERVER_TIME",
    deleteDoc: async ref => { commits.push([{ op: "delete", ref }]); },
    writeBatch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push({ op: "set", ref, data }),
        update: (ref, data) => ops.push({ op: "update", ref, data }),
        delete: ref => ops.push({ op: "delete", ref }),
        commit: async () => {
          if (failCommit) throw failCommit;
          commits.push(ops);
        },
      };
    },
    query: (c, ...mods) => ({ c, mods }),
    orderBy: (f, d) => ["orderBy", f, d],
    limit: n2 => ["limit", n2],
    onSnapshot: (q, onData, onErr) => { deps._sub = { q, onData, onErr }; return () => { deps._unsubbed = true; }; },
  };
  return deps;
}

const entry = { payer: "p1", cents: 4250, note: "Thai place", at: "2026-09-08", uid: "u1" };

test("addEntry writes the full record — amount included — to the backend", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await db.addEntry(deps, entry);

  const [ops] = deps.commits;
  const written = ops.find(o => o.ref.path.includes("entries")).data;
  assert.equal(written.cents, 4250);
  assert.equal(written.note, "Thai place");
  assert.equal(written.payer, "p1");
  assert.equal(written.at, "2026-09-08");
  assert.equal(written.by, "u1");
  assert.equal(written.createdAt, "SERVER_TIME");
});

test("addEntry bumps the caller's throttle meter in the same batch", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await db.addEntry(deps, entry);

  assert.equal(deps.commits.length, 1, "entry and meter must go up atomically");
  const [ops] = deps.commits;
  assert.equal(ops.length, 2);
  const meter = ops.find(o => o.ref.path.includes("meters"));
  assert.deepEqual(meter.ref.path, ["ledgers", "shared", "meters", "u1"]);
  assert.deepEqual(meter.data, { last: "SERVER_TIME" });
});

test("a second write inside the throttle window is refused locally", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await db.addEntry(deps, entry);
  await assert.rejects(() => db.addEntry(deps, entry), /too-fast/);
  assert.equal(deps.commits.length, 1);
});

test("a server-side permission-denied is reported as too-fast", async () => {
  db.__resetThrottle();
  const denied = Object.assign(new Error("nope"), { code: "permission-denied" });
  await assert.rejects(() => db.addEntry(fakeDeps({ failCommit: denied }), entry), /too-fast/);
});

test("a failed commit does not advance the local throttle", async () => {
  db.__resetThrottle();
  await assert.rejects(
    () => db.addEntry(fakeDeps({ failCommit: new Error("offline") }), entry), /save-failed/);
  const deps = fakeDeps();
  await db.addEntry(deps, entry); // retry must be allowed immediately
  assert.equal(deps.commits.length, 1);
});

test("addEntry validates before it touches the network", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await assert.rejects(() => db.addEntry(deps, { ...entry, uid: null }), /no-session/);
  await assert.rejects(() => db.addEntry(deps, { ...entry, cents: 0 }), /bad-entry/);
  await assert.rejects(() => db.addEntry(deps, { ...entry, cents: 12.5 }), /bad-entry/);
  await assert.rejects(() => db.addEntry(deps, { ...entry, payer: "" }), /bad-entry/);
  assert.equal(deps.commits.length, 0);
});

test("notes are collapsed and clipped to the length the rules allow", () => {
  assert.equal(db.sanitizeNote("  dinner   at   theirs \n"), "dinner at theirs");
  assert.equal(db.sanitizeNote("x".repeat(500)).length, db.MAX_NOTE);
  assert.equal(db.sanitizeNote(undefined), "");
});

const edit = { payer: "p2", note: "Thai place, split", at: "2026-09-07", uid: "u2" };
const patchOf = deps => deps.commits[0].find(o => o.op === "update").data;

test("updateEntry leaves the amount alone when none is given", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await db.updateEntry(deps, "e1", edit);

  const patch = patchOf(deps);
  assert.equal("cents" in patch, false, "a blank amount must not overwrite the stored one");
  assert.equal(patch.payer, "p2");
  assert.equal(patch.note, "Thai place, split");
  assert.equal(patch.at, "2026-09-07");
});

test("updateEntry overwrites the amount when one is given", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await db.updateEntry(deps, "e1", { ...edit, cents: 3199 });
  assert.equal(patchOf(deps).cents, 3199);
});

// The rules pin `by` and `createdAt` to their existing values, so the client must
// not send them at all — an edit records who touched it, it doesn't rewrite origin.
test("updateEntry never rewrites authorship or creation time", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await db.updateEntry(deps, "e1", edit);

  const patch = patchOf(deps);
  assert.equal("by" in patch, false);
  assert.equal("createdAt" in patch, false);
  assert.equal(patch.editedBy, "u2");
  assert.equal(patch.editedAt, "SERVER_TIME");
});

test("updateEntry targets the right document and bumps the meter too", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await db.updateEntry(deps, "e1", edit);

  const [ops] = deps.commits;
  assert.equal(deps.commits.length, 1);
  assert.deepEqual(ops.find(o => o.op === "update").ref.path,
    ["ledgers", "shared", "entries", "e1"]);
  assert.deepEqual(ops.find(o => o.op === "set").ref.path,
    ["ledgers", "shared", "meters", "u2"]);
});

test("updateEntry is throttled and validated like a create", async () => {
  db.__resetThrottle();
  const deps = fakeDeps();
  await assert.rejects(() => db.updateEntry(deps, "", edit), /bad-entry/);
  await assert.rejects(() => db.updateEntry(deps, "e1", { ...edit, at: "" }), /bad-entry/);
  await assert.rejects(() => db.updateEntry(deps, "e1", { ...edit, payer: "" }), /bad-entry/);
  await assert.rejects(() => db.updateEntry(deps, "e1", { ...edit, cents: 0 }), /bad-entry/);
  await assert.rejects(() => db.updateEntry(deps, "e1", { ...edit, cents: 1.5 }), /bad-entry/);
  await assert.rejects(() => db.updateEntry(deps, "e1", { ...edit, uid: null }), /no-session/);
  assert.equal(deps.commits.length, 0);

  await db.updateEntry(deps, "e1", edit);
  await assert.rejects(() => db.updateEntry(deps, "e1", edit), /too-fast/);
});

test("deleteAll chunks into batches under the Firestore limit", async () => {
  const deps = fakeDeps();
  await db.deleteAll(deps, Array.from({ length: 900 }, (_, i) => `e${i}`));
  assert.deepEqual(deps.commits.map(c => c.length), [400, 400, 100]);
});

test("subscribe orders newest-first, caps the read, and returns a teardown", () => {
  const deps = fakeDeps();
  const seen = [];
  const unsub = db.subscribe(deps, docs => seen.push(docs), () => {});
  assert.deepEqual(deps._sub.q.mods, [["orderBy", "at", "desc"], ["limit", db.PAGE_LIMIT]]);
  deps._sub.onData({ docs: [{ id: "a", data: () => ({ payer: "p2", cents: 1 }) }] });
  assert.deepEqual(seen, [[{ id: "a", payer: "p2", cents: 1 }]]);
  unsub();
  assert.equal(deps._unsubbed, true);
});
