import { el, clear } from "../ui.js";
import { templateOf } from "../rules.js";

const STATUSES = [["not_started","Not started"],["in_progress","In progress"],
  ["submitted","Submitted"],["waiting","Waiting for confirmation"],
  ["completed","Completed"],["not_applicable","Not applicable"],["skipped","Skipped"]];

export function render(root, ctx, taskId) {
  clear(root);
  const task = (ctx.state.tasks || []).find(t => t.id === taskId);
  const tpl = task && templateOf(task.templateId);
  if (!task || !tpl) { root.append(el("p", { class: "error", text: "Task not found." }),
    el("a", { href: "#/checklist", text: "Back to checklist" })); return; }

  const badge = el("span", { class: "badge " + tpl.priority.toLowerCase().replace(/\s+/g, "-"), text: tpl.priority });
  const statusSel = el("select", { id: "td-status", "aria-label": "Status" },
    STATUSES.map(([v, t]) => el("option", { value: v, text: t, selected: task.status === v })));
  const conf = el("input", { id: "td-conf", value: task.confirmationNumber || "", "aria-label": "Confirmation number" });
  const notes = el("textarea", { id: "td-notes", rows: "4", "aria-label": "Private notes" });
  notes.value = task.notes || "";

  const saveBtn = el("button", { class: "primary", type: "button", text: "Save task" });
  saveBtn.onclick = async () => {
    task.status = statusSel.value;
    task.confirmationNumber = conf.value;
    task.notes = notes.value;
    task.updatedAt = new Date().toISOString();
    await ctx.save();
  };

  const official = el("a", { href: tpl.officialUrl, target: "_blank", rel: "noopener noreferrer",
    class: "", text: `Open official ${tpl.agency} website ↗` });
  const copyBtn = el("button", { type: "button", text: "Copy new ZIP" });
  copyBtn.onclick = () => { navigator.clipboard?.writeText(ctx.state.move.newZip || ""); ctx.toast("Copied new ZIP."); };

  root.append(
    el("a", { href: "#/checklist", class: "muted", text: "← Back to checklist" }),
    el("div", { class: "row" }, [el("h1", { text: tpl.title }), badge]),
    el("p", {}, [task.reason || tpl.reason]),
    el("section", { class: "card" }, [
      el("h2", { text: "Why this matters" }), el("p", { text: tpl.description }),
      el("h3", { text: "Timing" }),
      el("ul", {}, [
        el("li", { text: `Recommended by: ${task.recommendedDate || "set a move date"}` }),
        el("li", { text: `Deadline: ${tpl.deadlineNote}` }),
        el("li", { text: `Estimated time: ${tpl.estTime}` }),
        el("li", { text: `Method: ${tpl.method}` }),
      ]),
    ]),
    el("section", { class: "card" }, [
      el("h3", { text: "Prepare" }),
      el("ul", {}, (tpl.requiredInfo || []).map(x => el("li", { text: x }))),
      el("h3", { text: "Steps" }),
      el("ol", {}, (tpl.steps || []).map(x => el("li", { text: x }))),
      el("p", { class: "muted", html: "External link is the <strong>official</strong> government/provider site." }),
      el("div", { class: "row" }, [el("button", { class: "primary", type: "button",
        onClick: () => window.open(tpl.officialUrl, "_blank", "noopener") }, ["Go to official website"]), copyBtn]),
    ]),
    el("section", { class: "card" }, [
      el("h3", { text: "Track progress" }),
      el("label", { text: "Status", for: "td-status" }), statusSel,
      el("label", { text: "Confirmation number", for: "td-conf" }), conf,
      el("label", { text: "Private notes", for: "td-notes" }), notes,
      el("div", { class: "row" }, [saveBtn]),
    ]),
    el("p", { class: "muted", text: `Guidance last verified ${tpl.verifiedOn}. Informational only, not legal advice.` }),
  );
}
