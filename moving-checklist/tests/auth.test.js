import { test } from "node:test";
import assert from "node:assert/strict";
import { signInWithGoogle, logout, onAuth, currentUser } from "../js/auth.js";

function fakeDeps(overrides = {}) {
  const calls = { signIn: 0, signOut: 0, onAuth: 0 };
  const deps = {
    calls,
    auth: { currentUser: overrides.currentUser ?? null },
    provider: { name: "google" },
    signInWithPopup: async (auth, provider) => {
      calls.signIn++; assert.equal(provider.name, "google");
      if (overrides.signInError) throw overrides.signInError;
      return { user: { uid: "u1", displayName: "Rwik" } };
    },
    signOut: async () => { calls.signOut++; },
    onAuthStateChanged: (auth, cb) => { calls.onAuth++; calls.cb = cb; return () => { calls.unsub = true; }; },
  };
  return deps;
}

test("signInWithGoogle returns the user on success", async () => {
  const deps = fakeDeps();
  const user = await signInWithGoogle(deps);
  assert.equal(user.uid, "u1");
  assert.equal(deps.calls.signIn, 1);
});

test("signInWithGoogle maps popup-closed", async () => {
  const deps = fakeDeps({ signInError: { code: "auth/popup-closed-by-user" } });
  await assert.rejects(() => signInWithGoogle(deps), /popup-closed/);
});

test("signInWithGoogle maps popup-blocked", async () => {
  const deps = fakeDeps({ signInError: { code: "auth/popup-blocked" } });
  await assert.rejects(() => signInWithGoogle(deps), /popup-blocked/);
});

test("signInWithGoogle maps unknown errors to signin-failed", async () => {
  const deps = fakeDeps({ signInError: { code: "auth/network-request-failed" } });
  await assert.rejects(() => signInWithGoogle(deps), /signin-failed/);
});

test("onAuth registers the callback and logout calls signOut", async () => {
  const deps = fakeDeps();
  const cb = () => {};
  const unsub = onAuth(deps, cb);
  assert.equal(deps.calls.onAuth, 1);
  assert.equal(deps.calls.cb, cb);
  unsub(); assert.equal(deps.calls.unsub, true);
  await logout(deps);
  assert.equal(deps.calls.signOut, 1);
});

test("currentUser reads auth.currentUser", () => {
  const deps = fakeDeps({ currentUser: { uid: "u9" } });
  assert.equal(currentUser(deps).uid, "u9");
});
