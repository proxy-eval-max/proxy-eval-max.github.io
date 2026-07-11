import { el, clear } from "../ui.js";
import { todayIso, daysBetween, bucket } from "../dates.js";
import { templateOf } from "../rules.js";
import { CATEGORIES } from "../tasks-data.js";

const DONE = new Set(["completed", "not_applicable", "skipped"]);

export function render(root, ctx) {
  clear(root);
  const st = ctx.state, tasks = st.tasks || [];
  const today = todayIso();
  const total = tasks.length;
  const done = tasks.filter(t => DONE.has(t.status)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const active = tasks.filter(t => !DONE.has(t.status));
  const overdue = active.filter(t => t.recommendedDate && bucket(t.recommendedDate, today) === "overdue");
  const dueSoon = active.filter(t => t.recommendedDate && bucket(t.recommendedDate, today) === "due_soon");
  const before = active.filter(t => templateOf(t.templateId)?.timing === "before");
  const after = active.filter(t => templateOf(t.templateId)?.timing === "after");

  const header = el("div", { class: "row" });
  const ring = el("div", { class: "ring" }, [el("span", { text: `${pct}%` })]);
  ring.style.setProperty("--p", pct);
  let countdown = "Set your move date in onboarding";
  if (st.move.moveDate) {
    const d = daysBetween(today, st.move.moveDate);
    countdown = d >= 0 ? `${d} days until your move` : `${-d} days since your move`;
  }
  header.append(ring, el("div", {}, [
    el("h1", { text: countdown }),
    el("p", { class: "muted", text: `${done} of ${total} tasks complete` }),
  ]));

  const alerts = el("section", { class: "card" }, [
    el("h2", { text: "At a glance" }),
    el("div", { class: "row" }, [
      stat(overdue.length, "Overdue"), stat(dueSoon.length, "Due this week"),
      stat(before.length, "Before move"), stat(after.length, "After move"),
    ]),
  ]);

  const next = active
    .filter(t => t.recommendedDate)
    .sort((a, b) => a.recommendedDate.localeCompare(b.recommendedDate))
    .slice(0, 3);
  const nextCard = el("section", { class: "card" }, [
    el("h2", { text: "Next recommended tasks" }),
    next.length ? el("ul", { class: "tasklist" }, next.map(t => taskLink(t, ctx)))
      : el("p", { class: "muted", text: "Nothing scheduled — you're all caught up." }),
  ]);

  const byCat = CATEGORIES.map(cat => {
    const inCat = tasks.filter(t => templateOf(t.templateId)?.category === cat);
    if (!inCat.length) return null;
    const d = inCat.filter(t => DONE.has(t.status)).length;
    return el("li", {}, [`${cat}: ${d}/${inCat.length}`]);
  }).filter(Boolean);
  const catCard = el("section", { class: "card" }, [
    el("h2", { text: "Category progress" }), el("ul", {}, byCat),
  ]);

  root.append(header, alerts, nextCard, catCard);
}

function stat(n, label) {
  return el("div", { class: "card", style: "flex:1;min-width:120px;text-align:center" },
    [el("div", { style: "font-size:28px;font-weight:700", text: String(n) }),
     el("div", { class: "muted", text: label })]);
}
function taskLink(t, ctx) {
  const tpl = templateOf(t.templateId);
  const a = el("a", { href: `#/task/${t.id}`, text: tpl?.title || t.id });
  return el("li", {}, [a, el("div", { class: "muted", text: t.recommendedDate ? `Recommended by ${t.recommendedDate}` : "" })]);
}
