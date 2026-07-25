#!/usr/bin/env node
/** Gate: Hubly OS is locked — one OS, AI personalizes experience. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else console.log(`  ✓ ${name}`);
}

console.log("\nHubly OS — Locked\n");

const os = fs.readFileSync(path.join(root, "docs/HUBLY_OS.md"), "utf8");
const constitution = fs.readFileSync(path.join(root, "docs/HUBLY_CONSTITUTION.md"), "utf8");
const adr = fs.readFileSync(path.join(root, "docs/adr/0006-one-os-ai-personalizes-experience.md"), "utf8");
const docsTs = fs.readFileSync(path.join(root, "supabase/functions/_shared/hubly_brain_docs.ts"), "utf8");

check("HUBLY_OS.md exists", /One operating system/.test(os));
check("Locked OS module list", /Dashboard/.test(os) && /Jobs & Calendar/.test(os) && /Customers/.test(os) && /Marketplace/.test(os));
check("Forbids industry CRMs", /Do \*\*not\*\* create different CRMs/i.test(os));
check("Forbids industry nav", /industry-specific navigation/i.test(os));
check("AI personalizes above OS", /What AI personalizes/i.test(os) && /Website/.test(os) && /Booking flow/.test(os));
check("Competitive story", /Jobber|Housecall|GoHighLevel/i.test(os));
check("Constitution principle 9", /One OS — AI personalizes/i.test(constitution));
check("ADR 0006 accepted", /Status:\*\* Accepted/.test(adr) && /One OS/.test(adr));
check("Docs catalog registers OS lock", /HUBLY_OS_LOCK/.test(docsTs) && /docs\/HUBLY_OS\.md/.test(docsTs));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/HUBLY_OS_LOCK_PROOF.json"),
  JSON.stringify({ title: "Hubly OS Locked", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nHUBLY OS LOCK PASS\n" : "\nHUBLY OS LOCK FAIL\n");
if (!passed) process.exit(1);
