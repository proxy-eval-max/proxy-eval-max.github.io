// Per-user Firestore document access. All Firebase primitives arrive via `deps`
// ({ db, doc, getDoc, setDoc, deleteDoc }) so this module is testable without the SDK.
export async function loadUserState(deps, uid) {
  const snap = await deps.getDoc(deps.doc(deps.db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserState(deps, uid, state) {
  await deps.setDoc(deps.doc(deps.db, "users", uid), state);
  return true;
}

export async function deleteUserState(deps, uid) {
  await deps.deleteDoc(deps.doc(deps.db, "users", uid));
  return true;
}
