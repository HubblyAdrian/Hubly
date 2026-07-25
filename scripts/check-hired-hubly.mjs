#!/usr/bin/env node
/** Gate: Hired Hubly — team, thinking, Today's Work. */
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

console.log("\nHired Hubly\n");

const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/HIRED_HUBLY.md"), "utf8");
const disc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/hubly_brain_discovery_conversation.ts"),
  "utf8",
);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

check("HIRED_HUBLY.md", /hiring Hubly|Today.s Work/i.test(doc) && /I already did/i.test(doc));
check("npm script", pkg.scripts?.["check:hired-hubly"] === "node scripts/check-hired-hubly.mjs");
check("Hubly Team markup", /data-hired-team/.test(hubly) && /Creative Director/.test(hubly) && /CRM Specialist/.test(hubly));
check("Hubly Is Thinking", /data-hubly-thinking/.test(hubly) && /Comparing several homepage layouts/.test(hubly));
check("Agency hire copy", /Give us a few minutes/.test(hubly));
check("I already did", /I already moved|I already did|alreadyDid/.test(hubly));
check("Today's Work surface", /data-todays-work/.test(hubly) && /Today.s Work/.test(hubly));
check("View Accept Undo", /todaysWorkView/.test(hubly) && /todaysWorkAccept/.test(hubly) && /todaysWorkUndo/.test(hubly));
check("Work commit reason", /Reason:/.test(hubly) || /reason:/.test(hubly));
check("Prompt: hired / I already did", /HIRED Hubly|hired Hubly/i.test(disc) && /I already did/i.test(disc));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/HIRED_HUBLY_PROOF.json"),
  JSON.stringify({ title: "Hired Hubly", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nHIRED HUBLY PASS\n" : "\nHIRED HUBLY FAIL\n");
if (!passed) process.exit(1);
