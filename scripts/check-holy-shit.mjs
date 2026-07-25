#!/usr/bin/env node
/** Gate: Holy Shit Sprint — visible AI moments + alive Home. */
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

console.log("\nHoly Shit Sprint\n");

const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/HOLY_SHIT_SPRINT.md"), "utf8");
const disc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/hubly_brain_discovery_conversation.ts"),
  "utf8",
);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

check("HOLY_SHIT_SPRINT.md", /silent video test|no audio/i.test(doc) && /While you were away/i.test(doc));
check("npm script", pkg.scripts?.["check:holy-shit"] === "node scripts/check-holy-shit.mjs");
check("Moment engine", /HUBLY_HOLY_SHIT/.test(hubly) && /playOpeningSequence/.test(hubly));
check("Moment 1 copy", /I'll build your business/.test(hubly) || /I.?ll build your business/.test(hubly));
check("Moment 2 insight", /I found something/.test(hubly) && /is-rewriting/.test(hubly));
check("Logo + packages surfaces", /id="is-live-logo"/.test(hubly) && /data-holy-shit-studio/.test(hubly));
check("Reveal ready", /Your business is ready/.test(hubly));
check("Alive Home away block", /data-holy-shit-away/.test(hubly) && /dash-away/.test(hubly));
check("AI Activity Feed", /data-ai-activity-feed/.test(hubly) && /renderAiActivityFeed/.test(hubly));
check("Prompt: holy shit / assumptions", /holy shit/i.test(disc) && /Prefer assumptions/.test(disc));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/HOLY_SHIT_SPRINT_PROOF.json"),
  JSON.stringify({ title: "Holy Shit Sprint", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nHOLY SHIT PASS\n" : "\nHOLY SHIT FAIL\n");
if (!passed) process.exit(1);
