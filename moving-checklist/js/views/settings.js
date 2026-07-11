import { el, clear } from "../ui.js";
import * as auth from "../auth.js";
import * as store from "../store.js";
import { mergeTasks } from "../rules.js";

export function render(root, ctx) {
  clear(root);
  const st = ctx.state;

  // Token
  const tokIn = el("input", { type: "password", value: auth.getToken() || "", "aria-label": "GitHub token" });
  const saveTok = el("button", { class: "primary", type: "button", text: "Save token" });
  saveTok.onclick = () => { auth.setToken(tokIn.value.trim()); ctx.toast("Token saved."); };
  const clearTok = el("button", { type: "button", text: "Remove token" });
  clearTok.onclick = () => { auth.clearToken(); tokIn.value = ""; ctx.toast("Token removed."); };

  // Move details (regenerate preserving progress)
  const zip = el("input", { value: st.move.newZip || "", "aria-label": "New ZIP" });
  const date = el("input", { type: "date", value: st.move.moveDate || "", "aria-label": "Move date" });
  const regen = el("button", { class: "primary", type: "button", text: "Update & regenerate" });
  regen.onclick = async () => {
    st.move.newZip = zip.value; st.move.moveDate = date.value;
    st.tasks = mergeTasks(st.tasks || [], st.move);
    await ctx.save(); ctx.toast("Checklist updated."); ctx.navigate("#/");
  };

  // Backup
  const backup = el("button", { type: "button", text: "Download encrypted backup" });
  backup.onclick = async () => {
    const text = await store.exportBlobText();
    const blob = new Blob([text], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob),
      download: `${store.session().username}.enc.json` });
    document.body.append(a); a.click(); a.remove();
  };

  // Delete
  const del = el("button", { type: "button", text: "Delete this profile" });
  del.style.borderColor = "var(--danger)"; del.style.color = "var(--danger)";
  del.onclick = async () => {
    if (!confirm("Delete this profile and its encrypted data from the repo? This cannot be undone.")) return;
    const token = auth.getToken();
    if (!token) { ctx.toast("A token is required to delete."); return; }
    try { await store.remove(token); location.hash = ""; location.reload(); }
    catch { ctx.toast("Delete failed."); }
  };

  root.append(
    el("h1", { text: "Settings" }),
    el("section", { class: "card" }, [
      el("h2", { text: "GitHub token" }),
      el("p", { class: "muted", html: "Fine-grained token, this repo only, Contents: read &amp; write. Stored in this browser; sent only to api.github.com. If your device is compromised the token can leak." }),
      tokIn, el("div", { class: "row" }, [saveTok, clearTok]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Move details" }),
      el("label", { text: "New ZIP code" }), zip,
      el("label", { text: "Move date" }), date,
      el("p", { class: "muted", text: "Regenerating keeps your status, notes, and confirmation numbers on tasks that still apply." }),
      el("div", { class: "row" }, [regen]),
    ]),
    el("section", { class: "card" }, [
      el("h2", { text: "Your data" }),
      el("p", { class: "muted", text: "Your data is encrypted with your password. The backup file is encrypted too." }),
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
