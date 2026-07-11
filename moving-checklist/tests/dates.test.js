import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, recommendedDate, daysBetween, bucket } from "../js/dates.js";

test("addDays handles month boundaries", () => {
  assert.equal(addDays("2026-01-30", 3), "2026-02-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("recommendedDate applies offset from move date", () => {
  assert.equal(recommendedDate("2026-08-01", -14), "2026-07-18");
  assert.equal(recommendedDate("2026-08-01", 10), "2026-08-11");
});

test("daysBetween counts calendar days", () => {
  assert.equal(daysBetween("2026-07-11", "2026-07-18"), 7);
  assert.equal(daysBetween("2026-07-18", "2026-07-11"), -7);
});

test("bucket classifies relative to today", () => {
  assert.equal(bucket("2026-07-01", "2026-07-11"), "overdue");
  assert.equal(bucket("2026-07-15", "2026-07-11"), "due_soon");
  assert.equal(bucket("2026-08-30", "2026-07-11"), "upcoming");
});
