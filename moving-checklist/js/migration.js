// One-time import of a legacy password-encrypted profile from the old git-backed store.
import { decrypt } from "./crypto.js";

const OWNER = "proxy-eval-max";
const REPO = "proxy-eval-max.github.io";

export function toImportState(oldState) {
  const src = oldState || {};
  const profile = { ...(src.profile || {}) };
  delete profile.username;
  return {
    profile,
    move: src.move || {},
    tasks: src.tasks || [],
    meta: src.meta || { onboarded: true, schemaVersion: 1 },
  };
}

export async function importLegacy(username, password, fetchImpl = fetch) {
  const uname = (username || "").trim().toLowerCase();
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/moving-checklist/data/${uname}.enc.json`;
  let res;
  try { res = await fetchImpl(url); } catch { throw new Error("import-failed"); }
  if (!res.ok) throw new Error("import-failed");
  let blob;
  try { blob = JSON.parse(await res.text()); } catch { throw new Error("import-failed"); }
  let state;
  try { state = await decrypt(password, blob); } catch { throw new Error("import-failed"); }
  return toImportState(state);
}
