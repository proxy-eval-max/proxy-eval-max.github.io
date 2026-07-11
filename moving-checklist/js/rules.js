import { TEMPLATES, CATEGORIES } from "./tasks-data.js";
import { recommendedDate } from "./dates.js";

function orderByCategory(tasks) {
  return tasks.slice().sort((a, b) => {
    const ca = CATEGORIES.indexOf(templateOf(a.templateId).category);
    const cb = CATEGORIES.indexOf(templateOf(b.templateId).category);
    return ca - cb;
  });
}
export function templateOf(id) { return TEMPLATES.find(t => t.id === id); }

export function generateTasks(move) {
  const chosen = TEMPLATES.filter(t => {
    try { return t.applies(move) === true; } catch { return false; }
  });
  const tasks = chosen.map(t => ({
    id: t.id, templateId: t.id, status: "not_started", reason: t.reason,
    recommendedDate: move.moveDate ? recommendedDate(move.moveDate, t.offsetDays) : null,
    deadlineNote: t.deadlineNote, confirmationNumber: "", notes: "", updatedAt: null,
  }));
  return orderByCategory(tasks);
}

export function mergeTasks(oldTasks, move) {
  const fresh = generateTasks(move);
  const prev = new Map(oldTasks.map(t => [t.id, t]));
  for (const t of fresh) {
    const p = prev.get(t.id);
    if (p) {
      t.status = p.status; t.confirmationNumber = p.confirmationNumber;
      t.notes = p.notes; t.updatedAt = p.updatedAt;
    }
  }
  return fresh;
}
