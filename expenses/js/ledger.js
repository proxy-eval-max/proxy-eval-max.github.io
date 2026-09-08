// Pure ledger logic. No DOM, no Firebase — everything here is testable in node.
//
// The whole point of this page: you feed it what each of you spent, and it tells
// you *who pays next* without ever telling you the balance. So the only function
// the UI is allowed to call is `verdict()`, and `verdict()` returns nothing but
// names and qualitative words. `totals()` / `netBalance()` exist for the maths
// and the tests; keep them out of the views.
import { MEMBER_IDS, nameOf, otherThan } from "./members.js";

const MAX_AMOUNT = 1_000_000_000;

// Accepts "42", "42.50", "$42.50", "1,250" — returns cents, or null if unusable.
export function parseAmount(input) {
  if (typeof input === "number") return Number.isFinite(input) ? toCents(input) : null;
  const cleaned = String(input ?? "").replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return toCents(n);
}

function toCents(n) { return n > 0 && n <= MAX_AMOUNT ? Math.round(n * 100) : null; }

export function totals(entries = []) {
  const out = Object.fromEntries(MEMBER_IDS.map(id => [id, 0]));
  for (const e of entries) {
    if (!e || !(e.payer in out)) continue;
    const cents = Number(e.cents);
    if (Number.isFinite(cents) && cents > 0) out[e.payer] += cents;
  }
  return out;
}

// Positive = the first member has paid more than the second.
export function netBalance(entries = []) {
  const t = totals(entries);
  return t[MEMBER_IDS[0]] - t[MEMBER_IDS[1]];
}

// How lopsided things are, as a fraction of everything spent so far. Bucketed
// into words on purpose — a percentage plus one known receipt would give away
// the real numbers.
const TILTS = [
  { upTo: 0.08, tilt: "even" },
  { upTo: 0.25, tilt: "slight" },
  { upTo: 0.60, tilt: "clear" },
  { upTo: Infinity, tilt: "wide" },
];

const DETAIL = {
  even: (behind, ahead) => `You two are running about level — ${behind} is a hair behind ${ahead}, so it's their shout.`,
  slight: (behind, ahead) => `${ahead} is a little ahead. Nothing dramatic, but the next one is ${behind}'s.`,
  clear: (behind, ahead) => `${ahead} has been carrying noticeably more lately. ${behind} should pick up the next few.`,
  wide: (behind, ahead) => `${ahead} is well out in front. ${behind} has some catching up to do.`,
};

/**
 * The only thing the UI shows. Returns names and adjectives — never a number.
 * @returns {{payer: string|null, payerName: string|null, tilt: string,
 *            headline: string, detail: string, count: number}}
 */
export function verdict(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const count = list.length;
  if (!count) {
    return { payer: null, payerName: null, tilt: "empty", count,
      headline: "Nothing logged yet",
      detail: "Add what each of you has spent and this will start calling it." };
  }

  const net = netBalance(list);
  if (net === 0) {
    return { payer: null, payerName: null, tilt: "even", count,
      headline: "Dead even",
      detail: "Neither of you owes the other a thing. Whoever's closest to the card." };
  }

  const payer = net > 0 ? MEMBER_IDS[1] : MEMBER_IDS[0];
  const ahead = otherThan(payer);
  const t = totals(list);
  const spent = t[MEMBER_IDS[0]] + t[MEMBER_IDS[1]];
  const share = spent ? Math.abs(net) / spent : 0;
  const tilt = TILTS.find(b => share < b.upTo).tilt;

  return { payer, payerName: nameOf(payer), tilt, count,
    headline: `${nameOf(payer)} pays next`,
    detail: DETAIL[tilt](nameOf(payer), nameOf(ahead)) };
}

// Feed for the activity list: who, when, and what it was for — with the amount
// deliberately dropped before it can reach the DOM. Newest first; same-day entries
// fall back to when they were logged.
export function activity(entries = [], limit = 20) {
  return [...entries]
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))
      || (b.createdMs || 0) - (a.createdMs || 0))
    .slice(0, limit)
    .map(e => ({ id: e.id, payer: e.payer, payerName: nameOf(e.payer),
      note: e.note || "", at: e.at || "" }));
}

export function todayIso() { return new Date().toISOString().slice(0, 10); }
