#!/usr/bin/env node
/**
 * Milestone 3 — Hubly v3 Business OS gate
 *
 * Create mode builds. Operate mode runs the existing OS chassis.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else console.log(`  ✓ ${name}`);
}

console.log("\nMilestone 3 — Hubly v3 Business OS\n");

const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const constitution = fs.readFileSync(path.join(root, "docs/HUBLY_V3_BUSINESS_OS.md"), "utf8");

console.log("Constitution\n");
check("v3 constitution exists", /Two modes only/.test(constitution));
check("Create mode defined", /Mode 1 — Create/.test(constitution));
check("Operate mode defined", /Mode 2 — Operate/.test(constitution));
check("Chassis preserved", /Do \*\*not\*\* replace CRM/.test(constitution));

console.log("\nMode 1 — Create\n");
check("Welcome / Landing front door", /data-welcome-experience/.test(html));
check("Discovery conversation", /data-discovery-experience|is-step-talk/.test(html));
check("Creative Build live preview", /is-creative-preview|is-step-creative-build/.test(html));
check("Visual Reveal ready cards", /data-v3-reveal|is-reveal-ready-grid|Your business is ready/.test(html));
check("Reveal Continue to Workspace", /isRevealContinueToWorkspace|Continue to My Workspace/.test(html));
check("No report chrome on Reveal primary", !/id="is-reveal-confidence"|Overall Business Confidence/.test(html));
check("No Time Capsule on Reveal primary", !/id="is-reveal-capsule"|Business Time Capsule/.test(html));

console.log("\nMode 2 — Operate\n");
check("goDash opens Operate Home (dashboard chassis)", /function goDash\(\)[\s\S]{0,240}openOperateHome/.test(html));
check("openOperateHome mounts #p-app dashboard", /function openOperateHome[\s\S]{0,500}p-app/.test(html));
check("Website hero on Home", /dash-site-hero|id="dash-website-preview"/.test(html));
check("One recommendation slot", /dash-one-rec|Today's Recommendation/.test(html));
check("Ask Hubly on Home", /id="ai-question-input"|Ask Hubly/.test(html));
check("OS chassis views remain", /id="v-jobs"|id="v-customers"|id="v-editor"|id="v-calendar"/.test(html) || /id="v-jobs"/.test(html));

console.log("\nRouting\n");
check("preferM2ExperienceHome off by default (Operate = chassis)", /function preferM2ExperienceHome[\s\S]{0,350}return false/.test(html));
check("Post-save enters Operate", /isDelayedAccountCompleteSave[\s\S]{0,2800}openOperateHome/.test(html));

const passed = failures.length === 0;
const proof = `# Milestone 3 — Hubly v3 Business OS

**Status:** ${passed ? "PASS (wiring)" : "FAIL"}  
**Checked:** ${new Date().toISOString()}  
**Gate:** \`npm run check:m3-v3-os\`

> Hubly is a business operating system. AI builds. Hubly operates.

See \`docs/HUBLY_V3_BUSINESS_OS.md\`.
`;
fs.writeFileSync(path.join(root, "docs/MILESTONE3_V3_OS_PROOF.md"), proof);
fs.writeFileSync(
  path.join(root, "docs/MILESTONE3_V3_OS_PROOF.json"),
  JSON.stringify({ milestone: "3", title: "Hubly v3 Business OS", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);

console.log(passed ? "\nM3 v3 OS PASS\n" : "\nM3 v3 OS FAIL\n");
if (!passed) process.exit(1);
