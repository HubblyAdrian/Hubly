#!/usr/bin/env node
/** Gate: Delight Sprint — polish, output over process. */
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

console.log("\nDelight Sprint\n");

const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/DELIGHT_SPRINT.md"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

check("DELIGHT_SPRINT.md principle", /output is always more important than the process/i.test(doc));
check("npm script", pkg.scripts?.["check:delight"] === "node scripts/check-delight.mjs");
check("Create website hero", /data-create-hero="website"/.test(hubly) && /data-delight-create/.test(hubly));
check("Website never disappears", /Website never disappears during Create/.test(hubly));
check("Milestone celebrations", /function celebrate\(/.test(hubly) && /Your logo is in/.test(hubly));
check("Home delight layout", /data-delight-home/.test(hubly) && /data-home-hero="website"/.test(hubly));
check("Home asks dock hidden", /dash-ask-dock\{display:none\}/.test(hubly) || /#v-dashboard\[data-v3-operate-home="1"\] \.dash-ask-dock\{display:none\}/.test(hubly));
check("Short Create copy", /What do you do\?/.test(hubly) && /build your website while we talk/.test(hubly));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/DELIGHT_SPRINT_PROOF.json"),
  JSON.stringify({ title: "Delight Sprint", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nDELIGHT PASS\n" : "\nDELIGHT FAIL\n");
if (!passed) process.exit(1);
