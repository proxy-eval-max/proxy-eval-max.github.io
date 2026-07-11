// Firebase Auth (Google) wrappers. Firebase primitives arrive via `deps`
// ({ auth, provider, signInWithPopup, signOut, onAuthStateChanged }) so the wiring
// seam is testable without the SDK.
export async function signInWithGoogle(deps) {
  try {
    const res = await deps.signInWithPopup(deps.auth, deps.provider);
    return res.user;
  } catch (e) {
    const code = e && e.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request")
      throw new Error("popup-closed");
    if (code === "auth/popup-blocked") throw new Error("popup-blocked");
    throw new Error("signin-failed");
  }
}

export function logout(deps) { return deps.signOut(deps.auth); }
export function onAuth(deps, cb) { return deps.onAuthStateChanged(deps.auth, cb); }
export function currentUser(deps) { return deps.auth.currentUser; }
