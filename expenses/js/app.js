import * as auth from "./auth.js";
import * as db from "./db.js";
import { authDeps, dbDeps, appCheckEnabled } from "./firebase.js";
import { isConfigured } from "./firebase-config.js";
import { el, clear, qs } from "./ui.js";
import { MEMBERS, memberByEmail, nameOf } from "./members.js";
import { verdict, activity, parseAmount, todayIso } from "./ledger.js";

const main = () => qs("#main");

let me = null;      // the signed-in member, once their email hash matches
let entries = [];   // live mirror of the ledger
let unsub = null;   // snapshot listener teardown
let busy = false;   // one write in flight at a time

function toast(msg) {
  const t = qs("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2800);
}

// ---- views -----------------------------------------------------------------

function mountGate() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const err = el("p", { class: "error", role: "alert" });
  const btn = el("button", { class: "primary", type: "button", text: "Sign in with Google" });
  btn.onclick = async () => {
    err.textContent = "";
    btn.disabled = true;
    try { await auth.signInWithGoogle(authDeps); }
    catch (e) {
      err.textContent = e.message === "popup-blocked" ? "Popup blocked — allow popups and try again."
        : e.message === "popup-closed" ? "Sign-in cancelled." : "Sign-in failed. Try again.";
    } finally { btn.disabled = false; }
  };
  root.append(
    el("h1", { text: "Whose Turn" }),
    el("p", { class: "muted", text: "Log what each of you spends. It won't tell you the numbers — just who's up next." }),
    err,
    el("section", { class: "card" }, [
      el("h2", { text: "Sign in" }),
      el("p", { class: "muted", text: "This ledger is for two people. Everyone else gets shown the door." }),
      el("div", { class: "row" }, [btn]),
    ]),
  );
}

function mountDenied() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const out = el("button", { type: "button", text: "Sign in as someone else" });
  out.onclick = () => auth.logout(authDeps);
  root.append(
    el("h1", { text: "Not your ledger" }),
    el("section", { class: "card" }, [
      el("p", { text: "That account isn't one of the two this tracker belongs to." }),
      el("p", { class: "muted", text: "Nothing was loaded — the database refuses this account too, not just this page." }),
      el("div", { class: "row" }, [out]),
    ]),
  );
}

function renderTopbar() {
  qs("#topbar").hidden = false;
  qs("#who").textContent = `Signed in as ${me.name}`;
  qs("#logout-btn").onclick = () => auth.logout(authDeps);
}

// Built once. The form is deliberately *not* rebuilt on every snapshot — the other
// person logging a coffee shouldn't wipe the note you're halfway through typing.
function mount() {
  renderTopbar();
  const root = main(); clear(root);
  root.append(
    el("div", { id: "verdict-slot" }),
    addCard(),
    el("div", { id: "history-slot" }),
  );
  if (!appCheckEnabled) root.append(el("p", { class: "muted small",
    text: "App Check is off — see expenses/README.md before sharing this URL around." }));
  refresh();
}

function refresh() {
  const v = qs("#verdict-slot"), h = qs("#history-slot");
  if (!v || !h) return;
  clear(v); v.append(verdictCard());
  clear(h); h.append(historyCard());
}

// The whole product, really: a name and a vibe. No totals, no balance, no arrows
// pointing at a number you could back out with one known receipt.
function verdictCard() {
  const v = verdict(entries);
  const card = el("section", { class: `card verdict tilt-${v.tilt}` });
  card.append(
    el("p", { class: "eyebrow", text: v.tilt === "empty" ? "Getting started" : "Next one's on" }),
    el("h1", { class: "headline", text: v.headline }),
    el("p", { class: "muted", text: v.detail }),
  );
  if (v.tilt !== "empty") card.append(tiltMeter(v.tilt));
  return card;
}

const TILT_STEPS = ["even", "slight", "clear", "wide"];
function tiltMeter(tilt) {
  const at = TILT_STEPS.indexOf(tilt);
  const meter = el("div", { class: "meter", role: "img",
    "aria-label": `Imbalance: ${tilt === "even" ? "level" : tilt}` });
  TILT_STEPS.forEach((_, i) => meter.append(el("span", { class: i <= at ? "on" : "" })));
  return meter;
}

function addCard() {
  const err = el("p", { class: "error", role: "alert" });
  const payer = el("select", { id: "f-payer", name: "payer" },
    MEMBERS.map(m => el("option", { value: m.id, selected: m.id === me.id }, [m.name])));
  const amount = el("input", { id: "f-amount", name: "amount", type: "text",
    inputmode: "decimal", autocomplete: "off", placeholder: "0.00",
    "aria-describedby": "amount-help" });
  const note = el("input", { id: "f-note", name: "note", type: "text",
    autocomplete: "off", maxlength: String(db.MAX_NOTE),
    placeholder: "Groceries, that Thai place, cab home…" });
  const when = el("input", { id: "f-when", name: "when", type: "date",
    value: todayIso(), max: todayIso() });
  const submit = el("button", { class: "primary", type: "submit", text: "Log it" });

  const form = el("form", { class: "card", novalidate: true }, [
    el("h2", { text: "Add an expense" }),
    err,
    el("div", { class: "grid" }, [
      el("div", {}, [el("label", { for: "f-payer", text: "Who paid" }), payer]),
      el("div", {}, [el("label", { for: "f-amount", text: "How much" }), amount,
        el("p", { id: "amount-help", class: "muted small",
          text: "Stored, never shown back to you." })]),
    ]),
    el("label", { for: "f-note", text: "What was it for" }),
    note,
    el("label", { for: "f-when", text: "When" }),
    when,
    el("div", { class: "row", style: "margin-top:14px" }, [submit]),
  ]);

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    err.textContent = "";
    const cents = parseAmount(amount.value);
    if (cents === null) { err.textContent = "Enter an amount greater than zero."; amount.focus(); return; }
    const at = when.value || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) { err.textContent = "Pick a valid date."; return; }
    if (busy) return;

    busy = true; submit.disabled = true; submit.textContent = "Saving…";
    try {
      await db.addEntry(dbDeps, { payer: payer.value, cents, note: note.value, at,
        uid: auth.currentUser(authDeps).uid });
      // Wipe the amount immediately — the number is the one thing this page is
      // supposed to forget.
      amount.value = ""; note.value = ""; when.value = todayIso();
      toast(`Logged for ${nameOf(payer.value)}.`);
      amount.focus();
    } catch (e) {
      err.textContent = e.message === "too-fast"
        ? "Easy — one entry every couple of seconds."
        : "Couldn't save that. Check your connection and try again.";
    } finally {
      busy = false; submit.disabled = false; submit.textContent = "Log it";
    }
  };
  return form;
}

function historyCard() {
  const rows = activity(entries, 30);
  const card = el("section", { class: "card" }, [
    el("h2", { text: "What we've been spending on" }),
  ]);
  if (!rows.length) {
    card.append(el("p", { class: "muted", text: "Nothing yet." }));
    return card;
  }
  card.append(el("ul", { class: "entries" }, rows.map(rowItem)));
  if (entries.length > rows.length)
    card.append(el("p", { class: "muted small",
      text: `Showing the ${rows.length} most recent of ${entries.length}.` }));

  const settle = el("button", { type: "button", class: "danger", text: "We settled up — clear it" });
  settle.onclick = async () => {
    if (!confirm(`Delete all ${entries.length} entries? Do this only after you've actually squared up — it can't be undone.`)) return;
    settle.disabled = true;
    try { await db.deleteAll(dbDeps, entries.map(e => e.id)); toast("Cleared. Fresh start."); }
    catch { toast("Couldn't clear everything — try again."); }
    finally { settle.disabled = false; }
  };
  card.append(el("div", { class: "row", style: "margin-top:14px" }, [settle]));
  return card;
}

function rowItem(r) {
  const del = el("button", { type: "button", class: "link", text: "Remove",
    "aria-label": `Remove ${r.note || "entry"} paid by ${r.payerName}` });
  del.onclick = async () => {
    if (!confirm("Remove this entry?")) return;
    del.disabled = true;
    try { await db.deleteEntry(dbDeps, r.id); }
    catch { toast("Couldn't remove that."); del.disabled = false; }
  };
  return el("li", {}, [
    el("div", { class: "entry-main" }, [
      el("span", { class: "note", text: r.note || "(no note)" }),
      el("span", { class: "muted small", text: `${r.payerName} · ${r.at}` }),
    ]),
    el("span", { class: "hidden-amount", title: "Amounts are stored but never shown", text: "•••" }),
    del,
  ]);
}

// ---- boot ------------------------------------------------------------------

function teardown() {
  if (unsub) { unsub(); unsub = null; }
  entries = []; me = null;
}

async function onUser(user) {
  teardown();
  if (!user) { mountGate(); return; }

  // Client-side gate. Cosmetic — the Firestore rules make the same check, and
  // they're the ones that count.
  me = await memberByEmail(user.email);
  if (!me) { mountDenied(); return; }

  main().innerHTML = "<h1>Whose Turn</h1><p class=\"muted\">Loading…</p>";
  let mounted = false;
  unsub = db.subscribe(dbDeps,
    docs => {
      entries = docs.map(d => ({ ...d, createdMs: d.createdAt?.toMillis?.() || 0 }));
      if (mounted) { refresh(); return; }
      mounted = true; mount();
    },
    () => {
      mounted = false; // a recovered snapshot should rebuild, not silently no-op
      main().innerHTML = "<h1>Could not load the ledger</h1>"
        + "<p>Check your connection and reload.</p>";
    });
}

window.addEventListener("DOMContentLoaded", () => {
  if (!isConfigured()) {
    main().innerHTML = "<h1>Setup needed</h1><p>Firebase is not configured. "
      + "Set the project's web config in <code>moving-checklist/js/firebase-config.js</code>.</p>";
    return;
  }
  main().innerHTML = "<h1>Whose Turn</h1><p class=\"muted\">Loading…</p>";
  auth.onAuth(authDeps, onUser);
});
