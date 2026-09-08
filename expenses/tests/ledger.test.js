import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, totals, netBalance, verdict, activity, plateSplit, shortDate }
  from "../js/ledger.js";

const e = (payer, cents, extra = {}) => ({ payer, cents, ...extra });

test("parseAmount accepts money-ish input and returns cents", () => {
  assert.equal(parseAmount("42"), 4200);
  assert.equal(parseAmount("42.50"), 4250);
  assert.equal(parseAmount("$1,250.99"), 125099);
  assert.equal(parseAmount(" 7.05 "), 705);
  assert.equal(parseAmount(3.3), 330);
});

test("parseAmount rejects junk, zero, and negatives", () => {
  for (const bad of ["", "  ", "abc", "0", "-5", "1e9", "1.2.3", null, undefined, NaN])
    assert.equal(parseAmount(bad), null, `expected null for ${JSON.stringify(bad)}`);
});

test("totals ignore unknown payers and bad amounts", () => {
  const t = totals([e("anirudh", 1000), e("pallavi", 400), e("someone", 900), e("anirudh", -5)]);
  assert.deepEqual(t, { anirudh: 1000, pallavi: 400 });
  assert.equal(netBalance([e("anirudh", 1000), e("pallavi", 400)]), 600);
});

test("verdict names whoever has paid less", () => {
  const v = verdict([e("anirudh", 5000), e("pallavi", 1000)]);
  assert.equal(v.payer, "pallavi");
  assert.equal(v.headline, "Pallavi pays next");

  const w = verdict([e("pallavi", 5000), e("anirudh", 1000)]);
  assert.equal(w.payer, "anirudh");
  assert.equal(w.headline, "Anirudh pays next");
});

test("verdict handles the empty and dead-even cases", () => {
  assert.equal(verdict([]).tilt, "empty");
  assert.equal(verdict([]).payer, null);
  const even = verdict([e("anirudh", 2500), e("pallavi", 2500)]);
  assert.equal(even.payer, null);
  assert.equal(even.tilt, "even");
});

test("tilt buckets widen as the gap grows", () => {
  // gap / total spend: 4%, 20%, 50%, 100%
  assert.equal(verdict([e("anirudh", 5200), e("pallavi", 4800)]).tilt, "even");
  assert.equal(verdict([e("anirudh", 6000), e("pallavi", 4000)]).tilt, "slight");
  assert.equal(verdict([e("anirudh", 7500), e("pallavi", 2500)]).tilt, "clear");
  assert.equal(verdict([e("anirudh", 9000)]).tilt, "wide");
});

// The entire premise of the page: it must never hand a number to the view layer.
test("verdict leaks no amounts", () => {
  const v = verdict([e("anirudh", 133742), e("pallavi", 999)]);
  assert.deepEqual(Object.keys(v).sort(),
    ["ahead", "aheadName", "count", "detail", "headline", "payer", "payerName", "tilt"]);
  const text = `${v.headline} ${v.detail}`;
  assert.equal(/\d/.test(text), false, `found a digit in "${text}"`);
  assert.equal(typeof v.count, "number"); // a count of entries is not an amount
});

test("verdict names both sides so the plate can label them", () => {
  const v = verdict([e("anirudh", 9000), e("pallavi", 1000)]);
  assert.equal(v.payerName, "Pallavi");
  assert.equal(v.aheadName, "Anirudh");
  assert.notEqual(v.payer, v.ahead);
});

// The plate's split is a drawing of the tilt bucket, so it must carry exactly the
// same four steps — no finer resolution sneaking a number back onto the screen.
test("plateSplit exposes only the four tilt buckets", () => {
  assert.deepEqual(["even", "slight", "clear", "wide"].map(plateSplit), [50, 58, 66, 74]);
  assert.equal(plateSplit("empty"), 50);
  assert.equal(plateSplit("nonsense"), 50);
});

test("shortDate formats for the mono caption and passes junk through", () => {
  assert.equal(shortDate("2026-09-08"), "08 sep");
  assert.equal(shortDate("2026-01-31"), "31 jan");
  assert.equal(shortDate("2026-12-01"), "01 dec");
  assert.equal(shortDate("not a date"), "not a date");
  assert.equal(shortDate(""), "");
});

test("activity drops amounts and sorts newest first", () => {
  const rows = activity([
    e("anirudh", 500, { id: "a", at: "2026-09-01", note: "Coffee" }),
    e("pallavi", 900, { id: "b", at: "2026-09-05", note: "Groceries" }),
    e("anirudh", 100, { id: "c", at: "2026-09-05", note: "Late one", createdMs: 99 }),
  ]);
  assert.deepEqual(rows.map(r => r.id), ["c", "b", "a"]);
  assert.equal(rows[0].payerName, "Anirudh");
  assert.equal(rows[0].note, "Late one");
  for (const r of rows) assert.equal("cents" in r, false);
});

test("activity flags edited entries", () => {
  const rows = activity([
    e("anirudh", 500, { id: "a", at: "2026-09-01", editedAt: { seconds: 1 } }),
    e("pallavi", 500, { id: "b", at: "2026-08-01" }),
  ]);
  assert.equal(rows.find(r => r.id === "a").edited, true);
  assert.equal(rows.find(r => r.id === "b").edited, false);
});

test("activity respects the limit and survives missing notes", () => {
  const rows = activity([e("anirudh", 1, { id: "x", at: "2026-01-01" })], 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].note, "");
});
