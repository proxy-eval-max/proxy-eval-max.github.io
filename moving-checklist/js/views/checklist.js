import { el, clear } from "../ui.js";
import { todayIso, bucket } from "../dates.js";
import { templateOf } from "../rules.js";

const DONE = new Set(["completed", "not_applicable", "skipped"]);
const PRIORITY_ORDER = ["Legally required","Financially important",
  "Prevents service interruption","Recommended","Optional"];
const STATUS_LABEL = { not_started:"Not started", in_progress:"In progress",
  submitted:"Submitted", waiting:"Waiting for confirmation", completed:"Completed",
  not_applicable:"Not applicable", skipped:"Skipped" };

let state = { filter: "all", sort: "recommended" };

export function render(root, ctx) {
  clear(root);
  const today = todayIso();
  const all = ctx.state.tasks || [];

  const filterSel = select("Filter", state.filter, [
    ["all","All"],["due_soon","Due this week"],["overdue","Overdue"],
    ["before","Before move"],["after","After move"],["completed","Completed"],
    ["optional","Optional"]], v => { state.filter = v; render(root, ctx); });
  const sortSel = select("Sort", state.sort, [
    ["recommended","Recommended date"],["deadline","Deadline note"],["priority","Priority"],
    ["category","Category"],["time","Estimated time"]], v => { state.sort = v; render(root, ctx); });

  let list = all.filter(t => passesFilter(t, today));
  list = sortTasks(list);

  const ul = el("ul", { class: "tasklist" }, list.length
    ? list.map(t => row(t))
    : [el("li", { class: "muted", text: "No tasks match this filter." })]);

  root.append(
    el("h1", { text: "Your checklist" }),
    el("div", { class: "controls card" }, [filterSel, sortSel]),
    ul);
}

function passesFilter(t, today) {
  const tpl = templateOf(t.templateId);
  switch (state.filter) {
    case "all": return true;
    case "completed": return DONE.has(t.status);
    case "optional": return tpl?.priority === "Optional";
    case "before": return tpl?.timing === "before";
    case "after": return tpl?.timing === "after";
    case "due_soon": return t.recommendedDate && bucket(t.recommendedDate, today) === "due_soon" && !DONE.has(t.status);
    case "overdue": return t.recommendedDate && bucket(t.recommendedDate, today) === "overdue" && !DONE.has(t.status);
    default: return true;
  }
}
function sortTasks(list) {
  const by = state.sort, tpl = (t) => templateOf(t.templateId) || {};
  const cmp = {
    recommended: (a, b) => (a.recommendedDate || "9999").localeCompare(b.recommendedDate || "9999"),
    deadline: (a, b) => (tpl(a).deadlineNote || "").localeCompare(tpl(b).deadlineNote || ""),
    priority: (a, b) => PRIORITY_ORDER.indexOf(tpl(a).priority) - PRIORITY_ORDER.indexOf(tpl(b).priority),
    category: (a, b) => (tpl(a).category || "").localeCompare(tpl(b).category || ""),
    time: (a, b) => (tpl(a).estTime || "").localeCompare(tpl(b).estTime || ""),
  }[by];
  const doneRank = (t) => (DONE.has(t.status) ? 1 : 0);
  return list.slice().sort((a, b) => (doneRank(a) - doneRank(b)) || cmp(a, b));
}
function row(t) {
  const tpl = templateOf(t.templateId) || {};
  const cls = "badge " + (tpl.priority || "").toLowerCase().replace(/\s+/g, "-");
  return el("li", DONE.has(t.status) ? { class: "done" } : {}, [
    el("div", { class: "row" }, [
      el("a", { href: `#/task/${t.id}`, text: tpl.title || t.id }),
      el("span", { class: cls, text: tpl.priority || "" }),
    ]),
    el("div", { class: "muted", text:
      `${STATUS_LABEL[t.status] || t.status}${t.recommendedDate ? " · by " + t.recommendedDate : ""} · ${tpl.category || ""}` }),
  ]);
}
function select(label, value, opts, onChange) {
  const s = el("select", { "aria-label": label },
    opts.map(([v, t]) => el("option", { value: v, text: t, selected: v === value })));
  s.addEventListener("change", () => onChange(s.value));
  return el("label", { text: label, style: "margin:0" }, [s]);
}
