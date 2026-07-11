import * as defaultCrypto from "./crypto.js";

let github = null;
let cryptoMod = defaultCrypto;
export function __setDeps(deps) {
  if (deps.github) github = deps.github;
  if (deps.crypto) cryptoMod = deps.crypto;
}

let mem = { state: null, username: null, password: null, sha: null };

export function emptyState(username) {
  return {
    profile: { username, createdAt: null },
    move: { oldZip: "", newZip: "", moveDate: "", moveType: "", housing: "",
      hasVehicle: false, utilitiesIncluded: false, voter: false, children: false,
      pets: false, benefits: false, immigration: "prefer_not", professionalLicenses: false,
      reminderPref: "browser" },
    tasks: [], meta: { onboarded: false, schemaVersion: 1 },
  };
}

export async function load(username, password, token) {
  const path = github.dataPath(username);
  const file = await github.getFile(path, token);
  if (!file) throw new Error("no-profile");
  const blob = JSON.parse(file.text);
  const state = await cryptoMod.decrypt(password, blob); // throws decrypt-failed
  mem = { state, username, password, sha: file.sha };
  return state;
}

export function getState() { return mem.state; }
export function setState(next) { mem.state = next; }
export function session() { return { username: mem.username, hasState: !!mem.state }; }
export function clear() { mem = { state: null, username: null, password: null, sha: null }; }

async function encryptCurrent() {
  const blob = await cryptoMod.encrypt(mem.password, mem.state);
  return JSON.stringify(
    { v: 1, username: mem.username, ...blob }, null, 2);
}

export async function exportBlobText() { return encryptCurrent(); }

export async function save(token) {
  const path = github.dataPath(mem.username);
  const text = await encryptCurrent();
  const res = await github.putFile(path, text, `Update ${mem.username} checklist`, mem.sha, token);
  mem.sha = res.sha;
  return true;
}

export async function remove(token) {
  const path = github.dataPath(mem.username);
  await github.deleteFile(path, `Delete ${mem.username} profile`, mem.sha, token);
  clear();
  return true;
}
