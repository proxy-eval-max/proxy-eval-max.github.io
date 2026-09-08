// Firestore access for the shared ledger. Every Firebase primitive arrives via
// `deps` (see firebase.js → dbDeps) so this module is testable without the SDK.
//
// Storage shape — the backend keeps the *whole* record, amount included:
//   ledgers/shared/entries/{id}  { payer, cents, note, at, by, createdAt }
//   ledgers/shared/meters/{uid}  { last }        ← write throttle, see firestore.rules
//
// Only the UI is coy about the numbers. If you ever want the real totals, they
// are right there in the Firebase console.
export const LEDGER_ID = "shared";
export const MAX_NOTE = 140;
export const PAGE_LIMIT = 500;
const THROTTLE_MS = 2000; // must match the window in firestore.rules

const entriesPath = () => ["ledgers", LEDGER_ID, "entries"];
const meterRef = (deps, uid) => deps.doc(deps.db, "ledgers", LEDGER_ID, "meters", uid);

let lastWriteAt = 0;
export function __resetThrottle() { lastWriteAt = 0; } // tests only

export function sanitizeNote(note) {
  return String(note ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
}

/**
 * Commit a write together with the caller's throttle meter, in one batch. The rules
 * refuse the entry unless the meter lands in the same commit, and refuse the meter
 * if it moved less than THROTTLE_MS ago. One committed write per user per two
 * seconds, enforced server-side rather than trusted to the browser.
 */
async function commitWithMeter(deps, uid, apply) {
  if (!uid) throw new Error("no-session");
  if (Date.now() - lastWriteAt < THROTTLE_MS) throw new Error("too-fast");

  const batch = deps.writeBatch(deps.db);
  const result = apply(batch);
  batch.set(meterRef(deps, uid), { last: deps.serverTimestamp() });

  try {
    await batch.commit();
  } catch (e) {
    if (e && e.code === "permission-denied") throw new Error("too-fast");
    throw new Error("save-failed");
  }
  lastWriteAt = Date.now();
  return result;
}

// async so that validation failures arrive as rejections like everything else —
// a promise-returning function that sometimes throws synchronously is a trap.
export async function addEntry(deps, { payer, cents, note, at, uid }) {
  if (!payer || !Number.isInteger(cents) || cents <= 0) throw new Error("bad-entry");
  return commitWithMeter(deps, uid, batch => {
    const ref = deps.doc(deps.collection(deps.db, ...entriesPath()));
    batch.set(ref, {
      payer, cents, note: sanitizeNote(note), at,
      by: uid, createdAt: deps.serverTimestamp(),
    });
    return ref.id;
  });
}

/**
 * Correct an existing entry. Either partner may fix either partner's entry.
 *
 * `cents` is optional: leave it out and the stored amount is untouched. That is the
 * whole reason edit works at all without breaking the premise — the edit form can
 * offer you a blank amount field rather than prefilling the old number on screen.
 *
 * `by` and `createdAt` are never sent, so the rules' pin-to-previous check passes
 * and an edit can't rewrite who logged it or when.
 */
export async function updateEntry(deps, id, { payer, cents, note, at, uid }) {
  if (!id) throw new Error("bad-entry");
  if (!payer || !at) throw new Error("bad-entry");
  if (cents !== undefined && (!Number.isInteger(cents) || cents <= 0))
    throw new Error("bad-entry");

  return commitWithMeter(deps, uid, batch => {
    const patch = {
      payer, note: sanitizeNote(note), at,
      editedAt: deps.serverTimestamp(), editedBy: uid,
    };
    if (cents !== undefined) patch.cents = cents;
    batch.update(deps.doc(deps.db, ...entriesPath(), id), patch);
    return id;
  });
}

export async function deleteEntry(deps, id) {
  await deps.deleteDoc(deps.doc(deps.db, ...entriesPath(), id));
}

// Clearing the slate after you've actually settled up in real life.
export async function deleteAll(deps, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = deps.writeBatch(deps.db);
    for (const id of ids.slice(i, i + 400))
      batch.delete(deps.doc(deps.db, ...entriesPath(), id));
    await batch.commit();
  }
}

// Live feed, so whoever logs something first shows up on the other's screen.
export function subscribe(deps, onData, onError) {
  const q = deps.query(
    deps.collection(deps.db, ...entriesPath()),
    deps.orderBy("at", "desc"),
    deps.limit(PAGE_LIMIT),
  );
  return deps.onSnapshot(q,
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => onError(err));
}
