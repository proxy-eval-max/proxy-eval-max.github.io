import * as auth from "./auth.js";
import * as store from "./store.js";
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
  const token = auth.getToken();
  if (!token) { toast("Add a GitHub token in Settings to save."); return false; }
  try { await store.save(token); toast("Saved."); return true; }
  catch (e) {
    if (e.message === "conflict") toast("Remote copy changed — reload from Settings.");
    else if (e.message === "auth") toast("Token rejected — re-enter it in Settings.");
    else toast("Save failed.");
    return false;
  }
}

function ctx() {
  return { state: store.getState(), save, navigate, toast, token: auth.getToken() };
}

const ROUTES = {
  "onboarding": onboarding, "checklist": checklist, "settings": settings,
};

export function navigate(route) {
  if (route && location.hash !== route) { location.hash = route; return; }
  render();
}

function render() {
  const st = store.getState();
  if (!st) { mountAuthGate(); return; }
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
  const links = [["dashboard","#/","Dashboard"],["checklist","#/checklist","Checklist"],
    ["settings","#/settings","Settings"]];
  for (const [route, href, label] of links) {
    const a = el("a", { href, "data-route": route, text: label });
    nav.append(a);
  }
  qs("#who").textContent = store.session().username || "";
  qs("#logout-btn").onclick = () => { auth.logout(); location.hash = ""; renderTopbar(); mountAuthGate(); qs("#topbar").hidden = true; };
}

export function mountAuthGate() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const err = el("p", { class: "error", role: "alert" });
  const token = auth.getToken() || "";

  const uLogin = el("input", { id: "li-user", autocomplete: "username", "aria-label": "Username" });
  const pLogin = el("input", { id: "li-pass", type: "password", autocomplete: "current-password", "aria-label": "Password" });
  const loginBtn = el("button", { class: "primary", type: "button", text: "Log in" });
  loginBtn.onclick = async () => {
    err.textContent = "";
    try { await auth.login(uLogin.value, pLogin.value, auth.getToken()); location.hash = ""; render(); }
    catch (e) { err.textContent = e.message === "bad-credentials"
      ? "Incorrect username or password." : "Could not reach GitHub. Try again."; }
  };

  const uNew = el("input", { id: "cp-user", "aria-label": "New username" });
  const pNew = el("input", { id: "cp-pass", type: "password", "aria-label": "New password (min 8)" });
  const pNew2 = el("input", { id: "cp-pass2", type: "password", "aria-label": "Confirm password" });
  const tokIn = el("input", { id: "cp-token", type: "password", value: token, "aria-label": "GitHub token" });
  const createBtn = el("button", { class: "primary", type: "button", text: "Create profile" });
  createBtn.onclick = async () => {
    err.textContent = "";
    if (pNew.value !== pNew2.value) { err.textContent = "Passwords do not match."; return; }
    if (tokIn.value) auth.setToken(tokIn.value.trim());
    try {
      await auth.createProfile(uNew.value, pNew.value, auth.getToken());
      location.hash = "#/onboarding"; render();
    } catch (e) {
      const map = { "no-token": "A GitHub token is required to create a profile.",
        "exists": "That profile already exists — try logging in.",
        "weak-password": "Password must be at least 8 characters.",
        "invalid-username": "Username may use a-z, 0-9, _ and - only." };
      err.textContent = map[e.message] || "Could not create profile.";
    }
  };

  root.append(
    el("h1", { text: "MoveAddress" }),
    el("p", { class: "muted", text: "Your personalized moving address-change checklist." }),
    err,
    el("section", { class: "card" }, [
      el("h2", { text: "Log in" }),
      el("label", { text: "Username", for: "li-user" }), uLogin,
      el("label", { text: "Password", for: "li-pass" }), pLogin,
      el("div", { class: "row" }, [loginBtn]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Create a profile" }),
      el("label", { text: "Username", for: "cp-user" }), uNew,
      el("label", { text: "Password (min 8 characters)", for: "cp-pass" }), pNew,
      el("label", { text: "Confirm password", for: "cp-pass2" }), pNew2,
      el("label", { text: "GitHub token (needed to save; stored in this browser)", for: "cp-token" }), tokIn,
      el("p", { class: "muted", html: "Use a fine-grained token scoped to this repo with Contents: read &amp; write." }),
      el("div", { class: "row" }, [createBtn]),
    ]),
    el("p", { class: "muted", html: "Informational only — not legal advice. Official agency instructions control. Verify high-stakes requirements (immigration, taxes, licensing) with official sources." }),
  );
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    main().innerHTML = "<h1>Unsupported</h1><p>This app needs a modern browser over HTTPS (Web Crypto).</p>";
    return;
  }
  mountAuthGate();
});
