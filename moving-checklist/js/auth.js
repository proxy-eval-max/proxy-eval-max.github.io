import * as defaultStore from "./store.js";
import * as defaultCrypto from "./crypto.js";

let store = defaultStore, github = null, cryptoMod = defaultCrypto;
export function __setDeps(d) {
  if (d.store) store = d.store; if (d.github) github = d.github; if (d.crypto) cryptoMod = d.crypto;
}

const TOKEN_KEY = "mc.gh.token";
const hasLS = typeof localStorage !== "undefined";
export function getToken() { return hasLS ? localStorage.getItem(TOKEN_KEY) : null; }
export function setToken(t) { if (hasLS) localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { if (hasLS) localStorage.removeItem(TOKEN_KEY); }

export function normalizeUsername(raw) { return (raw || "").trim().toLowerCase(); }
export function validUsername(u) { return /^[a-z0-9_-]{1,32}$/.test(u); }

export async function login(usernameRaw, password, token) {
  const username = normalizeUsername(usernameRaw);
  if (!validUsername(username)) throw new Error("bad-credentials");
  try {
    return await store.load(username, password, token);
  } catch (e) {
    if (e.message === "no-profile" || e.message === "decrypt-failed")
      throw new Error("bad-credentials");
    throw e;
  }
}

export async function createProfile(usernameRaw, password, token) {
  const username = normalizeUsername(usernameRaw);
  if (!validUsername(username)) throw new Error("invalid-username");
  if (!password || password.length < 8) throw new Error("weak-password");
  if (!token) throw new Error("no-token");
  const path = github.dataPath(username);
  const existing = await github.getFile(path, token);
  if (existing) throw new Error("exists");
  const state = store.emptyState(username);
  state.profile.createdAt = new Date().toISOString();
  const blob = await cryptoMod.encrypt(password, state);
  const text = JSON.stringify({ v: 1, username, ...blob }, null, 2);
  await github.putFile(path, text, `Create ${username} profile`, null, token);
  return store.load(username, password, token);
}

export function logout() { store.clear(); }
