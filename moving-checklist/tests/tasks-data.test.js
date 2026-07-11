import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, CATEGORIES } from "../js/tasks-data.js";

const PRIORITIES = ["Legally required","Financially important",
  "Prevents service interruption","Recommended","Optional"];

test("templates are well-formed with unique ids", () => {
  assert.ok(TEMPLATES.length >= 15);
  const ids = new Set();
  for (const t of TEMPLATES) {
    assert.match(t.id, /^[a-z0-9-]+$/, `bad id ${t.id}`);
    assert.ok(!ids.has(t.id), `dup id ${t.id}`); ids.add(t.id);
    for (const f of ["title","category","description","reason","priority",
      "timing","officialUrl","agency","method","estTime","verifiedOn","deadlineNote","requiredInfo"]) {
      assert.ok(t[f] != null && t[f] !== "", `${t.id} missing ${f}`);
    }
    assert.ok(PRIORITIES.includes(t.priority), `${t.id} bad priority`);
    assert.ok(["before","after","any"].includes(t.timing));
    assert.ok(Number.isInteger(t.offsetDays));
    assert.ok(Array.isArray(t.steps) && t.steps.length > 0);
    assert.ok(CATEGORIES.includes(t.category), `${t.id} category not listed`);
    assert.equal(typeof t.applies, "function");
    assert.match(t.officialUrl, /^https:\/\//);
  }
});

test("USPS mail forwarding applies to everyone", () => {
  const usps = TEMPLATES.find(t => t.id === "usps-forwarding");
  assert.ok(usps);
  assert.equal(usps.applies({}), true);
});
