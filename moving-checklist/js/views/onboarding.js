import { el, clear } from "../ui.js";
import { mergeTasks } from "../rules.js";

const FIELDS = [
  ["oldZip", "Current ZIP code", "text"],
  ["newZip", "New ZIP code", "text"],
  ["moveDate", "Move date", "date"],
];
const SELECTS = [
  ["moveType", "Type of move", [["within_city","Within the same city"],
    ["within_state","Within the same state"],["across_states","To another state"]]],
  ["housing", "Do you rent or own?", [["rent","Rent"],["own","Own"]]],
  ["immigration", "Citizenship / immigration status",
    [["citizen","U.S. citizen"],["permanent_resident","Permanent resident"],
     ["visa_holder","Visa holder"],["prefer_not","Prefer not to say"]]],
  ["reminderPref", "Reminder preference", [["browser","Browser/in-app"],["email","Email (shown in-app only)"]]],
];
const BOOLS = [
  ["hasVehicle", "Do you own or lease a vehicle?"],
  ["utilitiesIncluded", "Are utilities included in your rent?"],
  ["voter", "Are you registered to vote?"],
  ["children", "Do you have children in school or daycare?"],
  ["pets", "Do you have pets?"],
  ["benefits", "Do you receive government benefits?"],
  ["professionalLicenses", "Do you hold professional licenses?"],
];

export function render(root, ctx) {
  clear(root);
  const m = ctx.state.move;
  const inputs = {};
  const form = el("form", { class: "card" });
  form.append(el("h1", { text: "Tell us about your move" }),
    el("p", { class: "muted", text: "ZIP codes and move type are enough — no street address or ID numbers needed." }));

  for (const [key, label, type] of FIELDS) {
    const i = el("input", { id: `ob-${key}`, type, value: m[key] || "" });
    inputs[key] = () => i.value;
    form.append(el("label", { text: label, for: `ob-${key}` }), i);
  }
  for (const [key, label, opts] of SELECTS) {
    const s = el("select", { id: `ob-${key}` },
      opts.map(([v, t]) => el("option", { value: v, text: t, selected: m[key] === v })));
    inputs[key] = () => s.value;
    form.append(el("label", { text: label, for: `ob-${key}` }), s);
  }
  for (const [key, label] of BOOLS) {
    const s = el("select", { id: `ob-${key}` }, [
      el("option", { value: "no", text: "No", selected: !m[key] }),
      el("option", { value: "yes", text: "Yes", selected: !!m[key] }),
    ]);
    inputs[key] = () => s.value === "yes";
    form.append(el("label", { text: label, for: `ob-${key}` }), s);
  }

  const submit = el("button", { class: "primary", type: "submit", text: "Generate my checklist" });
  form.append(el("div", { class: "row" }, [submit]));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    for (const key of Object.keys(inputs)) ctx.state.move[key] = inputs[key]();
    ctx.state.meta.onboarded = true;
    ctx.state.tasks = mergeTasks(ctx.state.tasks || [], ctx.state.move);
    await ctx.save();
    ctx.navigate("#/");
  });
  root.append(form);
}
