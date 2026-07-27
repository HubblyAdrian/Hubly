#!/usr/bin/env node
/**
 * Gate — Rule #29 lock + Module 7 AI Launch Coach architecture
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

ok(fs.existsSync(path.join(root, "docs/builder/LAUNCH_COACH_ARCHITECTURE.md")), "LAUNCH_COACH_ARCHITECTURE.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/LAUNCH_COACH_CHECKLIST.md")), "LAUNCH_COACH_CHECKLIST.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/LAUNCH_COACH_MAT.md")), "LAUNCH_COACH_MAT.md exists");

const coach = read("docs/builder/LAUNCH_COACH_ARCHITECTURE.md");
ok(/If you were launching this business tomorrow/i.test(coach), "coach purpose question");
ok(/never block launch/i.test(coach), "never block launch");
ok(/Creative Review/.test(coach) && /Launch Coach/.test(coach), "distinct from Creative Review");
ok(/Apply All/i.test(coach), "Apply All control");
ok(/Launch Anyway/i.test(coach), "Launch Anyway control");
ok(/Ask the Coach|Ask Coach/i.test(coach), "Ask Coach");
ok(/launched more than a website|launched a business/i.test(coach), "ceremony copy");
ok(/Enter Hubly/i.test(coach), "Enter Hubly transition");
ok(/Welcome to Hubly/i.test(coach), "first Home greeting");
ok(/Morning Brief/i.test(coach), "Morning Brief handoff");
ok(/Business Health/i.test(coach), "Business Health score");
ok(/90 Days|Next 90/i.test(coach), "forecast window");

const milestone = read("docs/builder/README.md");
ok(/Rule #29/i.test(milestone) && /frozen|Locked|Architecture complete/i.test(milestone), "Rule #29 locked/frozen on milestone");
ok(/AI Launch Coach/i.test(milestone), "Module 7 on milestone");
ok(/Launch → Hubly Operating System|ends at Launch|Operate OS/i.test(milestone), "Builder ends at OS");
ok(/bypass|No Builder module may be reordered/i.test(milestone), "no pipeline bypass / reorder");
ok(/Module 2/i.test(milestone) && /Next|Discovery/i.test(milestone), "Module 2 next Development");
ok(/BUILDER_MASTER_WORKFLOW/i.test(milestone), "master workflow on milestone");

const act = read("docs/builder/ACTIVATION_ARCHITECTURE.md");
ok(/Architecture locked|🔒/.test(act), "Activation architecture locked");
ok(/Launch Coach/i.test(act), "Activation hands off to Launch Coach");
ok(/canonical activation/i.test(act), "canonical activation stage");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/Rule #29/.test(rules) && /Locked/i.test(rules), "Rule #29 locked in engineering rules");
ok(/LAUNCH_COACH_ARCHITECTURE/.test(rules), "Launch Coach registered");
ok(/AI Business Agency/i.test(rules), "Agency canonical in rules");

const mat = read("docs/builder/LAUNCH_COACH_MAT.md");
ok(/Morning Brief/i.test(mat), "MAT Morning Brief handoff");
ok(/Distinct from Creative Review/i.test(mat), "MAT distinct from Creative Review");
ok(/Enter Hubly/i.test(mat), "MAT Enter Hubly");

if (failed) process.exit(1);
console.log("OK Rule #29 lock / Launch Coach architecture checks passed");
