import * as auth from "./auth.js";
import * as db from "./db.js";
import { authDeps, dbDeps, appCheckEnabled } from "./firebase.js";
import { isConfigured } from "./firebase-config.js";
import { el, clear, qs } from "./ui.js";
import { MEMBERS, memberByEmail } from "./members.js";
import { nameOf, unsealNames, forgetNames } from "./names.js";
import { verdict, activity, parseAmount, plateSplit, shortDate, todayIso } from "./ledger.js";

const main = () => qs("#main");

// History renders a page at a time. All the loaded entries still count towards the
// verdict — this only bounds how many rows are drawn.
const ROWS_PER_PAGE = 30;

let me = null;       // the signed-in member, once their email hash matches
let entries = [];    // live mirror of the ledger
let unsub = null;    // snapshot listener teardown
let busy = false;    // one write in flight at a time
let editingId = null;
let editDraft = null; // survives a snapshot arriving mid-edit
let removingId = null; // row waiting on its inline "remove?" confirm
let settling = false;  // settle-up confirm panel is open
let shownLimit = ROWS_PER_PAGE;

function toast(msg) {
  const t = qs("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2800);
}

// ---- shared bits -----------------------------------------------------------

// Two radios wearing each partner's colour. Better than a <select> for a binary
// choice, and it reinforces the colour coding used on the plate and in history.
function payerPicker(prefix, selected) {
  const group = el("div", { class: "picker", role: "radiogroup",
    "aria-label": "Who paid" });
  for (const m of MEMBERS) {
    const id = `${prefix}-${m.id}`;
    group.append(
      el("input", { type: "radio", id, name: `${prefix}-payer`, value: m.id,
        checked: m.id === selected }),
      el("label", { for: id, text: nameOf(m.id) }),
    );
  }
  return group;
}
const pickedPayer = (scope, prefix) =>
  qs(`input[name="${prefix}-payer"]:checked`, scope)?.value || null;

function sectionHead(label) {
  return el("div", { class: "section-head" }, [el("p", { class: "eyebrow", text: label })]);
}

// ---- the turn plate --------------------------------------------------------

function turnPlate() {
  const v = verdict(entries);
  const wrap = el("div");

  if (v.tilt === "empty") {
    wrap.append(el("div", { class: "plate-empty" }, [
      el("p", { class: "eyebrow", text: "nothing logged" }),
      el("p", { class: "name", text: "Add the first expense" }),
    ]));
  } else if (!v.payer) {
    wrap.append(el("div", { class: "plate plate-level" },
      MEMBERS.map(m => panel(m.id, "level"))));
  } else {
    const plate = el("div", { class: "plate" }, [
      panel(v.payer, "pays next", "panel-next"),
      panel(v.ahead, "is ahead", "panel-ahead"),
    ]);
    plate.style.setProperty("--split", plateSplit(v.tilt));
    wrap.append(plate);
  }

  wrap.append(el("p", { class: "verdict-note", text: v.detail }));
  return wrap;
}

function panel(who, eyebrow, extra = "") {
  return el("div", { class: `panel ${extra}`.trim(), "data-who": who }, [
    el("p", { class: "eyebrow", text: eyebrow }),
    el("p", { class: "name", text: nameOf(who) }),
  ]);
}

// ---- add form (built once, never re-rendered under you) --------------------

function addSection() {
  const err = el("p", { class: "error", role: "alert" });
  const picker = payerPicker("add", me.id);
  const amount = el("input", { class: "input input-amount", id: "add-amount",
    type: "text", inputmode: "decimal", autocomplete: "off", placeholder: "0.00" });
  const note = el("input", { class: "input", id: "add-note", type: "text",
    autocomplete: "off", maxlength: String(db.MAX_NOTE),
    placeholder: "Thai place, cab home, weekly shop…" });
  const when = el("input", { class: "input input-date", id: "add-when",
    type: "date", value: todayIso(), max: todayIso() });
  const submit = el("button", { class: "btn btn-primary", type: "submit", text: "Log it" });

  const form = el("form", { class: "section", novalidate: true }, [
    sectionHead("log an expense"),
    err,
    el("div", { class: "field" }, [
      el("p", { class: "eyebrow", text: "who paid" }), picker]),
    el("div", { class: "field field-row" }, [
      el("div", {}, [
        el("label", { class: "eyebrow", for: "add-amount", text: "how much" }),
        amount,
        el("p", { class: "hint", text: "stored, never shown back" })]),
      el("div", {}, [
        el("label", { class: "eyebrow", for: "add-when", text: "when" }), when]),
    ]),
    el("div", { class: "field" }, [
      el("label", { class: "eyebrow", for: "add-note", text: "what for" }), note]),
    el("div", { class: "actions" }, [submit]),
  ]);

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    err.textContent = "";
    const payer = pickedPayer(form, "add");
    const cents = parseAmount(amount.value);
    if (!payer) { err.textContent = "Pick who paid."; return; }
    if (cents === null) {
      err.textContent = "Enter an amount greater than zero."; amount.focus(); return;
    }
    const at = when.value || todayIso();
    if (busy) return;

    busy = true; submit.disabled = true; submit.textContent = "Saving…";
    try {
      await db.addEntry(dbDeps, { payer, cents, note: note.value, at,
        uid: auth.currentUser(authDeps).uid });
      // Wipe the amount at once — the number is the one thing this page forgets.
      amount.value = ""; note.value = ""; when.value = todayIso();
      toast(`Logged for ${nameOf(payer)}.`);
      amount.focus();
    } catch (e) {
      err.textContent = writeError(e);
    } finally {
      busy = false; submit.disabled = false; submit.textContent = "Log it";
    }
  };
  return form;
}

function writeError(e) {
  return e.message === "too-fast" ? "One entry every couple of seconds. Try again in a moment."
    : e.message === "no-session" ? "You've been signed out. Reload and sign in again."
    : "That didn't save. Check your connection and try again.";
}

// ---- history ---------------------------------------------------------------

function historySection() {
  const rows = activity(entries, shownLimit);
  const section = el("section", { class: "section" }, [sectionHead("history")]);
  if (!rows.length) {
    section.append(el("p", { class: "hint", text: "nothing here yet" }));
    return section;
  }

  // Stated once, in the open. This used to be a title tooltip on the dots, which
  // touch and keyboard users never saw at all.
  section.append(el("p", { class: "section-note",
    text: "amounts are stored, never shown" }));

  section.append(el("ul", { class: "entries" },
    rows.map(r => r.id === editingId ? editRow(r) : entryRow(r))));

  if (entries.length > rows.length) {
    const more = el("button", { class: "btn btn-ghost btn-sm", type: "button",
      text: `Show ${Math.min(ROWS_PER_PAGE, entries.length - rows.length)} more` });
    more.onclick = () => { shownLimit += ROWS_PER_PAGE; refresh(); };
    section.append(el("div", { class: "actions" }, [more]));
  }

  section.append(settleControl());
  return section;
}

// Clearing the ledger is irreversible, so it gets a real panel rather than a
// browser dialog. `settling` lives outside the render, so the other person's
// write landing mid-decision doesn't dismiss the question.
function settleControl() {
  if (!settling) {
    const open = el("button", { class: "btn btn-danger btn-sm", type: "button",
      text: "We settled up — clear it" });
    open.onclick = () => { settling = true; refresh(); };
    return el("div", { class: "actions" }, [open]);
  }

  const go = el("button", { class: "btn btn-danger btn-sm", type: "button",
    text: `Yes, delete all ${entries.length}` });
  const cancel = el("button", { class: "btn btn-ghost btn-sm", type: "button",
    text: "Keep them" });
  cancel.onclick = () => { settling = false; refresh(); };
  go.onclick = async () => {
    go.disabled = true; cancel.disabled = true; go.textContent = "Clearing…";
    try {
      await db.deleteAll(dbDeps, entries.map(e => e.id));
      settling = false; shownLimit = ROWS_PER_PAGE;
      toast("Cleared.");
    } catch {
      toast("Couldn't clear everything.");
      go.disabled = false; cancel.disabled = false;
    }
  };

  return el("div", { class: "confirm-panel" }, [
    el("p", { class: "eyebrow", text: "this can't be undone" }),
    el("p", { text: "Every entry goes, for both of you. Do this once you've "
      + "actually squared up — the ledger starts over from level." }),
    el("div", { class: "actions" }, [go, cancel]),
  ]);
}

function entryRow(r) {
  return el("li", { class: "entry", "data-who": r.payer }, [
    el("div", { class: "entry-body" }, [
      // Clamped to two lines in CSS; the title carries the rest for anyone who
      // wrote a paragraph about a sandwich.
      el("span", { class: r.note ? "entry-note" : "entry-note entry-note-empty",
        title: r.note || "", text: r.note || "no note" }),
      el("span", { class: "entry-meta" }, [
        el("span", { class: "who", text: r.payerName.toLowerCase() }),
        ` · ${shortDate(r.at)}${r.edited ? " · edited" : ""}`,
      ]),
    ]),
    el("span", { class: "redacted", "aria-label": "amount hidden", text: "•••" }),
    rowTools(r),
  ]);
}

// Two-step removal in place of window.confirm: the row asks, and only the second
// tap deletes. `removingId` sits outside the render so a live snapshot can't
// answer the question for you.
function rowTools(r) {
  if (removingId === r.id) {
    const yes = el("button", { class: "btn-quiet is-yes", type: "button", text: "yes",
      "aria-label": `Confirm removing ${r.note || "entry"}` });
    const no = el("button", { class: "btn-quiet", type: "button", text: "no" });
    no.onclick = () => { removingId = null; refresh(); };
    yes.onclick = async () => {
      yes.disabled = true; no.disabled = true;
      try { await db.deleteEntry(dbDeps, r.id); removingId = null; }
      catch {
        toast("Couldn't remove that.");
        yes.disabled = false; no.disabled = false;
      }
    };
    return el("div", { class: "entry-tools confirm-inline" }, [
      el("span", { class: "q", text: "remove?" }), yes, no]);
  }

  const edit = el("button", { class: "btn-quiet", type: "button", text: "edit",
    "aria-label": `Edit ${r.note || "entry"}` });
  edit.onclick = () => { editingId = r.id; editDraft = null; removingId = null; refresh(); };

  const remove = el("button", { class: "btn-quiet", type: "button", text: "remove",
    "aria-label": `Remove ${r.note || "entry"}` });
  remove.onclick = () => { removingId = r.id; editingId = null; refresh(); };

  return el("div", { class: "entry-tools" }, [edit, remove]);
}

// Editing without breaking the premise: note, date and payer prefill normally, but
// the amount field starts blank. Leave it blank and the stored amount is untouched;
// type a new one and it's overwritten. You never get shown the old number.
function editRow(r) {
  const d = editDraft || { payer: r.payer, note: r.note, at: r.at, amount: "" };
  const err = el("p", { class: "error", role: "alert" });

  const picker = payerPicker("edit", d.payer);
  const amount = el("input", { class: "input input-amount", id: "edit-amount",
    type: "text", inputmode: "decimal", autocomplete: "off",
    placeholder: "leave blank to keep", value: d.amount });
  const note = el("input", { class: "input", id: "edit-note", type: "text",
    autocomplete: "off", maxlength: String(db.MAX_NOTE), value: d.note,
    placeholder: "what was it for" });
  const when = el("input", { class: "input input-date", id: "edit-when",
    type: "date", value: d.at, max: todayIso() });

  const save = el("button", { class: "btn btn-primary btn-sm", type: "submit",
    text: "Save changes" });
  const cancel = el("button", { class: "btn btn-ghost btn-sm", type: "button",
    text: "Cancel" });
  cancel.onclick = () => { editingId = null; editDraft = null; refresh(); };

  const form = el("form", { class: "edit", novalidate: true }, [
    err,
    el("div", { class: "field" }, [
      el("p", { class: "eyebrow", text: "who paid" }), picker]),
    el("div", { class: "field field-row" }, [
      el("div", {}, [
        el("label", { class: "eyebrow", for: "edit-amount", text: "new amount" }),
        amount,
        el("p", { class: "hint", text: "blank keeps the current one" })]),
      el("div", {}, [
        el("label", { class: "eyebrow", for: "edit-when", text: "when" }), when]),
    ]),
    el("div", { class: "field" }, [
      el("label", { class: "eyebrow", for: "edit-note", text: "what for" }), note]),
    el("div", { class: "actions" }, [save, cancel]),
  ]);

  // Keep what's typed if the other person's write lands mid-edit.
  form.addEventListener("input", () => {
    editDraft = { payer: pickedPayer(form, "edit") || d.payer, note: note.value,
      at: when.value, amount: amount.value };
  });

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    err.textContent = "";
    const payer = pickedPayer(form, "edit");
    const at = when.value;
    if (!payer) { err.textContent = "Pick who paid."; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) { err.textContent = "Pick a valid date."; return; }

    // Blank means "keep the stored amount"; anything else has to parse.
    let cents;
    if (amount.value.trim()) {
      cents = parseAmount(amount.value);
      if (cents === null) {
        err.textContent = "That amount doesn't look right. Clear it to keep the current one.";
        amount.focus(); return;
      }
    }
    if (busy) return;

    busy = true; save.disabled = true; save.textContent = "Saving…";
    try {
      await db.updateEntry(dbDeps, r.id, { payer, cents, note: note.value, at,
        uid: auth.currentUser(authDeps).uid });
      editingId = null; editDraft = null;
      toast("Entry updated.");
      refresh();
    } catch (e) {
      err.textContent = writeError(e);
      busy = false; save.disabled = false; save.textContent = "Save changes";
      return;
    }
    busy = false;
  };

  return el("li", {}, [form]);
}

// ---- gate & refusal --------------------------------------------------------

function mountGate() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const err = el("p", { class: "error", role: "alert" });
  const btn = el("button", { class: "btn btn-primary", type: "button",
    text: "Sign in with Google" });
  btn.onclick = async () => {
    err.textContent = ""; btn.disabled = true;
    try { await auth.signInWithGoogle(authDeps); }
    catch (e) {
      err.textContent = e.message === "popup-blocked"
          ? "Your browser blocked the popup. Allow popups for this site and try again."
        : e.message === "popup-closed" ? "Sign-in cancelled."
        : "Sign-in didn't go through. Try again.";
      btn.disabled = false;
    }
  };
  root.append(el("div", { class: "gate" }, [
    // No names before sign-in — a stranger who lands here shouldn't learn whose
    // ledger this is. The names appear once you're through the gate.
    el("p", { class: "eyebrow", text: "private ledger" }),
    el("h1", { class: "gate-title", text: "Whose turn" }),
    el("p", { class: "gate-lede",
      text: "Log what each of you spends. It won't tell you the numbers — only who's up next." }),
    err,
    btn,
    el("p", { class: "gate-note", text: "two accounts. everyone else bounces." }),
  ]));
}

function mountDenied() {
  qs("#topbar").hidden = true;
  const root = main(); clear(root);
  const out = el("button", { class: "btn", type: "button", text: "Try another account" });
  out.onclick = () => auth.logout(authDeps);
  root.append(el("div", { class: "gate" }, [
    el("p", { class: "eyebrow", text: "no entry" }),
    el("h1", { class: "gate-title", text: "Not your ledger" }),
    el("p", { class: "gate-lede",
      text: "This tracker belongs to two people, and that account isn't one of them." }),
    out,
    el("p", { class: "gate-note",
      text: "nothing loaded. the database refuses this account too, not just this page." }),
  ]));
}

// ---- shell -----------------------------------------------------------------

function mount() {
  qs("#topbar").hidden = false;
  qs("#who").textContent = nameOf(me.id).toLowerCase();
  qs("#logout-btn").onclick = () => auth.logout(authDeps);

  const root = main(); clear(root);
  root.append(
    el("div", { id: "plate-slot" }),
    addSection(),
    el("div", { id: "history-slot" }),
  );
  if (!appCheckEnabled) root.append(el("p", { class: "footnote",
    text: "app check is off — see expenses/README.md before sharing this url." }));
  refresh();
}

function refresh() {
  const p = qs("#plate-slot"), h = qs("#history-slot");
  if (!p || !h) return;
  clear(p); p.append(turnPlate());
  clear(h); h.append(historySection());
}

function teardown() {
  if (unsub) { unsub(); unsub = null; }
  entries = []; me = null; editingId = null; editDraft = null;
  forgetNames(); // signing out should also drop the names from memory
}

async function onUser(user) {
  teardown();
  if (!user) { mountGate(); return; }

  // Client-side gate. Cosmetic — the Firestore rules make the same check, and
  // they're the ones that count.
  me = await memberByEmail(user.email);
  if (!me) { mountDenied(); return; }

  main().innerHTML = "<p class=\"eyebrow\">loading</p>";
  // Unlock the display names with the signed-in address. If the sealed file is
  // missing or won't open, nameOf() keeps returning placeholders and the page
  // works anyway — this is personalisation, not a second gate.
  await unsealNames(user.email);
  let mounted = false;
  unsub = db.subscribe(dbDeps,
    docs => {
      entries = docs.map(d => ({ ...d, createdMs: d.createdAt?.toMillis?.() || 0 }));
      if (mounted) { refresh(); return; }
      mounted = true; mount();
    },
    () => {
      mounted = false; // a recovered snapshot should rebuild, not silently no-op
      main().innerHTML = "<h1 class=\"gate-title\">Can't reach the ledger</h1>"
        + "<p class=\"gate-lede\">Check your connection and reload.</p>";
    });
}

window.addEventListener("DOMContentLoaded", () => {
  if (!isConfigured()) {
    main().innerHTML = "<h1 class=\"gate-title\">Setup needed</h1>"
      + "<p class=\"gate-lede\">Firebase isn't configured. Set this app's web config "
      + "in <code>expenses/js/firebase-config.js</code>.</p>";
    return;
  }
  main().innerHTML = "<p class=\"eyebrow\">loading</p>";
  auth.onAuth(authDeps, onUser);
});
