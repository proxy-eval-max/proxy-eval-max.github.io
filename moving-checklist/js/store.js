import * as defaultFs from "./firestore.js";

let fs = defaultFs;
let fsDeps = null; // set at boot via configure(), or in tests via __setDeps

export function configure(deps) { fsDeps = deps; }
export function __setDeps(d) { if (d.fs) fs = d.fs; if (d.fsDeps !== undefined) fsDeps = d.fsDeps; }

let mem = { state: null, uid: null };

export function emptyState() {
  return {
    profile: { createdAt: null },
    move: { oldZip: "", newZip: "", moveDate: "", moveType: "", housing: "",
      hasVehicle: false, utilitiesIncluded: false, voter: false, children: false,
      pets: false, benefits: false, immigration: "prefer_not", professionalLicenses: false,
      reminderPref: "browser" },
    tasks: [], meta: { onboarded: false, schemaVersion: 1 },
  };
}

export async function load(uid) {
  const data = await fs.loadUserState(fsDeps, uid);
  mem = { state: data, uid };
  return data; // null if new user
}
export function startFresh(uid) { mem = { state: emptyState(), uid }; return mem.state; }
export function getState() { return mem.state; }
export function setState(next) { mem.state = next; }
export function importState(state) { mem.state = state; }
export function session() { return { uid: mem.uid, hasState: !!mem.state }; }
export function clear() { mem = { state: null, uid: null }; }

export async function save() {
  if (!mem.uid || !mem.state) throw new Error("no-session");
  await fs.saveUserState(fsDeps, mem.uid, mem.state);
  return true;
}
export async function remove() {
  if (!mem.uid) throw new Error("no-session");
  await fs.deleteUserState(fsDeps, mem.uid);
  clear();
  return true;
}
export function exportText() { return JSON.stringify(mem.state, null, 2); }
