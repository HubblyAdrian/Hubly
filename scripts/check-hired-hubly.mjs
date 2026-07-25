#!/usr/bin/env node
/** Gate: Hired Hubly — hire energy (refined: one system, not cast). */
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

check("HIRED_HUBLY.md", /hiring Hubly|I already did/i.test(doc));
check("npm script", pkg.scripts?.["check:hired-hubly"] === "node scripts/check-hired-hubly.mjs");
check("Hire energy / workspace", /data-hubly-workspace/.test(hubly) || /data-hired-team/.test(hubly));
check("Hubly Is Thinking", /data-hubly-thinking/.test(hubly));
check("Agency hire copy", /Give me a few minutes|Give us a few minutes/.test(hubly));
check("I already did", /I already moved|I already did|alreadyDid/.test(hubly));
check("Recent Work surface", /data-recent-work/.test(hubly) || /data-todays-work/.test(hubly));
check("View Keep Undo", /todaysWorkView/.test(hubly) && /todaysWorkAccept/.test(hubly) && /todaysWorkUndo/.test(hubly));
check("Work commit reason", /Reason:/.test(hubly) || /reason:/.test(hubly));
check("Prompt: hired / I already did", /HIRED Hubly|hired Hubly|one intelligent Hubly/i.test(disc) && /I already did/i.test(disc));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/HIRED_HUBLY_PROOF.json"),
  JSON.stringify({ title: "Hired Hubly", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nHIRED HUBLY PASS\n" : "\nHIRED HUBLY FAIL\n");
if (!passed) process.exit(1);
