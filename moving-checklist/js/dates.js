// All dates are "YYYY-MM-DD" strings, treated as UTC calendar days.
function toUTC(iso) { const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d); }
function fromUTC(ms) { return new Date(ms).toISOString().slice(0, 10); }
const DAY = 86400000;

export function addDays(iso, n) { return fromUTC(toUTC(iso) + n * DAY); }
export function recommendedDate(moveDate, offsetDays) { return addDays(moveDate, offsetDays); }
export function daysBetween(fromIso, toIso) { return Math.round((toUTC(toIso) - toUTC(fromIso)) / DAY); }
export function bucket(recommendedIso, todayIso) {
  const d = daysBetween(todayIso, recommendedIso);
  if (d < 0) return "overdue";
  if (d <= 7) return "due_soon";
  return "upcoming";
}
export function todayIso() { return new Date().toISOString().slice(0, 10); }
