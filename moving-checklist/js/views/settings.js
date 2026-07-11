import { el, clear } from "../ui.js";
import * as store from "../store.js";
import { mergeTasks } from "../rules.js";
import { importLegacy } from "../migration.js";

export function render(root, ctx) {
  clear(root);
  const st = ctx.state;

  // Move details (regenerate, preserving progress)
  const zip = el("input", { value: st.move.newZip || "", "aria-label": "New ZIP" });
  const date = el("input", { type: "date", value: st.move.moveDate || "", "aria-label": "Move date" });
  const regen = el("button", { class: "primary", type: "button", text: "Update & regenerate" });
  regen.onclick = async () => {
    st.move.newZip = zip.value; st.move.moveDate = date.value;
    st.tasks = mergeTasks(st.tasks || [], st.move);
    const ok = await ctx.save();
    if (ok) ctx.toast("Checklist updated.");
    ctx.navigate("#/");
  };

  // One-time import from the legacy password-based version
  const iUser = el("input", { "aria-label": "Old username" });
  const iPass = el("input", { type: "password", "aria-label": "Old password" });
  const iErr = el("p", { class: "error", role: "alert" });
  const importBtn = el("button", { type: "button", text: "Import my old checklist" });
  importBtn.onclick = async () => {
    iErr.textContent = "";
    if (!confirm("Importing will REPLACE your current checklist with the imported one. Continue?")) return;
    try {
      const state = await importLegacy(iUser.value, iPass.value);
      store.importState(state);
      const ok = await ctx.save();
      if (ok) { ctx.toast("Imported."); ctx.navigate("#/"); }
    } catch {
      iErr.textContent = "Could not import — check the username and password.";
    }
  };

  // Backup (plaintext JSON)
  const backup = el("button", { type: "button", text: "Download my data (JSON)" });
  backup.onclick = () => {
    const blob = new Blob([store.exportText()], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "moveaddress-data.json" });
    document.body.append(a); a.click(); a.remove();
  };

  // Delete
  const del = el("button", { type: "button", text: "Delete my data" });
  del.style.borderColor = "var(--danger)"; del.style.color = "var(--danger)";
  del.onclick = async () => {
    if (!confirm("Delete your checklist data from the database? This cannot be undone.")) return;
    try { await store.remove(); location.hash = ""; location.reload(); }
    catch { ctx.toast("Delete failed."); }
  };

  root.append(
    el("h1", { text: "Settings" }),
    el("section", { class: "card" }, [
      el("h2", { text: "Move details" }),
      el("label", { text: "New ZIP code" }), zip,
      el("label", { text: "Move date" }), date,
      el("p", { class: "muted", text: "Regenerating keeps your status, notes, and confirmation numbers on tasks that still apply." }),
      el("div", { class: "row" }, [regen]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Import old checklist" }),
      el("p", { class: "muted", text: "One-time import from the previous password-based version. This replaces your current data." }),
      el("label", { text: "Old username" }), iUser,
      el("label", { text: "Old password" }), iPass, iErr,
      el("div", { class: "row" }, [importBtn]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Your data" }),
      el("p", { class: "muted", text: "Your data is stored privately in your account — only you can read it." }),
      el("div", { class: "row" }, [backup]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Danger zone" }),
      el("div", { class: "row" }, [del]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Disclaimer" }),
      el("p", { class: "muted", text: "MoveAddress is informational and is not a law firm. Requirements can change and official agency instructions control. Immigration, tax, and legal guidance here is not legal advice — verify high-stakes requirements with official sources." }),
    ]),
  );
}
