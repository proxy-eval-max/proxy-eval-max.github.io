import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTasks, mergeTasks } from "../js/rules.js";

const base = { newZip: "78701", moveDate: "2026-08-01", moveType: "within_state",
  housing: "rent", hasVehicle: false, utilitiesIncluded: false, voter: false,
  children: false, pets: false, benefits: false, immigration: "citizen",
  professionalLicenses: false };

test("within-Texas + vehicle yields TX DL and registration + toll + auto insurance", () => {
  const ids = generateTasks({ ...base, hasVehicle: true }).map(t => t.id);
  for (const id of ["tx-dl-address","tx-vehicle-registration","toll-account","auto-insurance-garaging"])
    assert.ok(ids.includes(id), `missing ${id}`);
});

test("permanent resident adds USCIS task", () => {
  const ids = generateTasks({ ...base, immigration: "permanent_resident" }).map(t => t.id);
  assert.ok(ids.includes("uscis-address"));
});

test("rent + utilities included drops electricity/water, adds landlord-confirm, keeps internet", () => {
  const ids = generateTasks({ ...base, utilitiesIncluded: true }).map(t => t.id);
  assert.ok(!ids.includes("electricity-transfer"));
  assert.ok(!ids.includes("water-transfer"));
  assert.ok(ids.includes("confirm-utilities-landlord"));
  assert.ok(ids.includes("internet-transfer"));
});

test("moving to another state adds new-state DL and registration", () => {
  const ids = generateTasks({ ...base, moveType: "across_states", hasVehicle: true }).map(t => t.id);
  assert.ok(ids.includes("new-state-dl"));
  assert.ok(ids.includes("new-state-vehicle-registration"));
  assert.ok(!ids.includes("tx-dl-address"));
});

test("recommendedDate is computed from move date and offset", () => {
  const usps = generateTasks(base).find(t => t.id === "usps-forwarding");
  assert.equal(usps.recommendedDate, "2026-07-18"); // -14 from 2026-08-01
});

test("mergeTasks preserves status/notes for retained tasks", () => {
  const first = generateTasks(base);
  const usps = first.find(t => t.id === "usps-forwarding");
  usps.status = "completed"; usps.notes = "done"; usps.confirmationNumber = "ABC";
  const merged = mergeTasks(first, base);
  const m = merged.find(t => t.id === "usps-forwarding");
  assert.equal(m.status, "completed");
  assert.equal(m.notes, "done");
  assert.equal(m.confirmationNumber, "ABC");
});
