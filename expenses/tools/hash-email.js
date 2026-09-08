#!/usr/bin/env node
// Print the salted SHA-256 of an email so it can be pasted into js/members.js and
// firestore.rules. Nothing here writes the address to disk.
//
//   node tools/hash-email.js someone@example.com
import { MEMBERS_SALT, sha256Hex } from "../js/hash.js";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("usage: node tools/hash-email.js <email>");
  process.exit(1);
}
console.log(await sha256Hex(MEMBERS_SALT + email));
