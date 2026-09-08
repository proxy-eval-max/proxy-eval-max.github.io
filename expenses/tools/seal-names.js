#!/usr/bin/env node
// Write data/names.enc.json — the two display names, sealed so that only the two
// email addresses can open them.
//
//   node tools/seal-names.js
//
// It prompts, so the names and addresses stay out of your shell history, out of
// the repo and out of any diff. Run it yourself; nobody else needs to see the
// input. Re-run it any time to change a name.
//
// The payload is the same for both records — {"p1":"…","p2":"…"} — encrypted
// twice, once under each address, so whoever signs in can render both names.
import { createInterface } from "node:readline/promises";
import { writeFile, mkdir } from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { seal } from "../js/secret.js";
import { MEMBERS, hashEmail, normalizeEmail } from "../js/members.js";

const out = new URL("../data/names.enc.json", import.meta.url);
const rl = createInterface({ input: stdin, output: stdout });

const ask = async (q) => (await rl.question(q)).trim();

const people = [];
for (const m of MEMBERS) {
  console.log(`\n— ${m.id} —`);
  const name = await ask("display name (first name is plenty): ");
  const email = normalizeEmail(await ask("google account email: "));
  if (!name || !email) { console.error("Both are required."); process.exit(1); }
  // Catch a typo now rather than as a mystery "Not your ledger" later: the
  // address has to hash to the digest this slot is allowlisted under.
  if (await hashEmail(email) !== m.emailHash) {
    console.error(`\nThat address doesn't match the digest for ${m.id} in members.js.`
      + `\nEither it's a typo, or the allowlist needs updating (tools/hash-email.js).`);
    process.exit(1);
  }
  people.push({ id: m.id, name, email });
}
rl.close();

const payload = JSON.stringify(Object.fromEntries(people.map(p => [p.id, p.name])));
const records = [];
for (const p of people) records.push(await seal(payload, p.email));

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(out, JSON.stringify({ v: 1, records }, null, 2) + "\n");

console.log(`\nSealed ${people.length} records → expenses/data/names.enc.json`);
console.log("No names or addresses are in that file. Safe to commit.");
