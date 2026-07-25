#!/usr/bin/env node
/** Gate: Quiet & Competent — no stage play. */
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

console.log("\nQuiet & Competent\n");

const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/QUIET_COMPETENT.md"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

check("QUIET_COMPETENT.md", /stage-play|North Star/i.test(doc) && /Hubly Workspace/.test(doc));
check("npm script", pkg.scripts?.["check:quiet-competent"] === "node scripts/check-quiet-competent.mjs");
check("Hubly Workspace (not Team cast)", /data-hubly-workspace/.test(hubly) && /Hubly Workspace/.test(hubly));
check("No fake specialist roster in Create studio", !/is-hubly-team-list/.test(hubly) && !/data-role="creative"/.test(hubly) && !/Booking Specialist/.test(hubly));
check("thoughtThenResult pairing", /thoughtThenResult/.test(hubly));
check("No random THOUGHTS roulette", !/Math\.floor\(Math\.random\(\)\*HUBLY_HOLY_SHIT\.THOUGHTS/.test(hubly));
check("Recent Work", /data-recent-work/.test(hubly) && /Recent Work/.test(hubly));
check("Honest empty state", /No new improvements since your last visit/.test(hubly));
check("View Keep Undo", /todaysWorkView/.test(hubly) && />Keep</.test(hubly) && /todaysWorkUndo/.test(hubly));
check("Discover opportunities", /data-hubly-discover/.test(hubly) && /renderDashDiscover/.test(hubly));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/QUIET_COMPETENT_PROOF.json"),
  JSON.stringify({ title: "Quiet & Competent", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nQUIET COMPETENT PASS\n" : "\nQUIET COMPETENT FAIL\n");
if (!passed) process.exit(1);
