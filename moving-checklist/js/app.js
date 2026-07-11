import * as auth from "./auth.js";
import * as store from "./store.js";
import { authDeps, fsDeps } from "./firebase.js";
import { isConfigured } from "./firebase-config.js";
import { el, clear, qs } from "./ui.js";
import * as onboarding from "./views/onboarding.js";
import * as dashboard from "./views/dashboard.js";
import * as checklist from "./views/checklist.js";
import * as taskDetail from "./views/task-detail.js";
import * as settings from "./views/settings.js";

const main = () => qs("#main");

export function toast(msg) {
  const t = qs("#toast"); t.textContent = msg; t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 2500);
}

async function save() {
  try { await store.save(); toast("Saved."); return true; }
  catch { toast("Save failed — check your connection."); return false; }
}

function ctx() { return { state: store.getState(), save, navigate, toast }; }

const ROUTES = { onboarding, checklist, settings };

export function navigate(route) {
  if (route && location.hash !== route) { location.hash = route; return; }
  render();
}

function render() {
  const st = store.getState();
  if (!st) { mountGate(); return; }
  renderTopbar();
  const hash = location.hash.replace(/^#\//, "");
  const root = main(); clear(root); root.focus();
  if (!st.meta.onboarded && hash !== "onboarding") { location.hash = "#/onboarding"; return; }
  if (hash.startsWith("task/")) return taskDetail.render(root, ctx(), hash.slice(5));
  const view = ROUTES[hash] || dashboard;
  markActive(hash || "dashboard");
  view.render(root, ctx());
}

function markActive(name) {
  for (const a of document.querySelectorAll("#nav a"))
    a.classList.toggle("active", a.dataset.route === name);
}

function renderTopbar() {
  const bar = qs("#topbar"); bar.hidden = false;
  const nav = qs("#nav"); clear(nav);
  for (const [route, href, label] of [["dashboard", "#/", "Dashboard"],
    ["checklist", "#/checklist", "Checklist"], ["settings", "#/settings", "Settings"]])
    nav.append(el("a", { href, "data-route": route, text: label }));
  const u = auth.currentUser(authDeps);
  qs("#who").textContent = u ? (u.displayName || u.email || "") : "";
  qs("#logout-btn").onclick = () => auth.logout(authDeps); // onAuth fires → gate
}

export function mountGate() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const err = el("p", { class: "error", role: "alert" });
  const btn = el("button", { class: "primary", type: "button", text: "Sign in with Google" });
  btn.onclick = async () => {
    err.textContent = "";
    try { await auth.signInWithGoogle(authDeps); }
    catch (e) {
      err.textContent = e.message === "popup-blocked" ? "Popup blocked — allow popups and try again."
        : e.message === "popup-closed" ? "Sign-in cancelled." : "Sign-in failed. Try again.";
    }
  };
  root.append(
    el("h1", { text: "MoveAddress" }),
    el("p", { class: "muted", text: "Your personalized moving address-change checklist." }),
    err,
    el("section", { class: "card" }, [
      el("h2", { text: "Sign in" }),
      el("p", { class: "muted", text: "Sign in with your Google account to create or open your checklist." }),
      el("div", { class: "row" }, [btn]),
    ]),
    el("p", { class: "muted", html: "Informational only — not legal advice. Official agency instructions control. Verify high-stakes requirements (immigration, taxes, licensing) with official sources." }),
  );
}

async function onUser(user) {
  if (!user) { store.clear(); location.hash = ""; mountGate(); return; }
  try {
    const data = await store.load(user.uid);
    if (!data) store.startFresh(user.uid);
  } catch {
    main().innerHTML = "<h1>Could not load your data</h1><p>Check your connection and reload.</p>";
    return;
  }
  if (!location.hash) location.hash = "#/";
  render();
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (!isConfigured()) {
    main().innerHTML = "<h1>Setup needed</h1><p>Firebase is not configured. Set your project's web config in <code>js/firebase-config.js</code>.</p>";
    return;
  }
  store.configure(fsDeps);
  main().innerHTML = "<h1>MoveAddress</h1><p class=\"muted\">Loading…</p>";
  auth.onAuth(authDeps, onUser);
});
