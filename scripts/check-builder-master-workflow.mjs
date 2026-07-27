#!/usr/bin/env node
/**
 * Gate — Builder Master Workflow + Agency architecture freeze
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

ok(fs.existsSync(path.join(root, "docs/builder/BUILDER_MASTER_WORKFLOW.md")), "BUILDER_MASTER_WORKFLOW.md exists");

const wf = read("docs/builder/BUILDER_MASTER_WORKFLOW.md");
ok(/Visitor arrives/i.test(wf), "starts at visitor arrives");
ok(/Hubly Session created/i.test(wf), "Session created step");
ok(/Business DNA created/i.test(wf), "DNA step");
ok(/Research Profile created/i.test(wf), "Research step");
ok(/Business Vision created/i.test(wf), "Vision step");
ok(/Creative Blueprint created/i.test(wf), "Blueprint step");
ok(/Creative Review/i.test(wf), "Creative Review step");
ok(/Business Reveal/i.test(wf), "Reveal step");
ok(/Save My Business/i.test(wf), "Save My Business step");
ok(/Business Activation/i.test(wf), "Activation step");
ok(/AI Launch Coach/i.test(wf), "Launch Coach step");
ok(/First Morning Brief/i.test(wf), "Morning Brief step");
ok(/Inputs/i.test(wf) && /Outputs/i.test(wf), "inputs/outputs documented");
ok(/APIs/i.test(wf), "APIs documented");
ok(/Events/i.test(wf), "Events documented");
ok(/Failure/i.test(wf), "Failure handling documented");
ok(/frozen|Freeze/i.test(wf), "workflow frozen");
ok(/Do not build modules out of order|Development order/i.test(wf), "sequential development");
ok(/Stop creating new architecture/i.test(wf), "stop new architecture");
ok(/Module 2 Discovery/i.test(wf), "Module 2 next");

const milestone = read("docs/builder/README.md");
ok(/Architecture complete|frozen/i.test(milestone), "milestone architecture frozen");
ok(/BUILDER_MASTER_WORKFLOW/i.test(milestone), "master workflow linked");
ok(/Stop creating new architecture/i.test(milestone), "stop new arch on milestone");
ok(/Module 2/i.test(milestone) && /Next/i.test(milestone), "Module 2 next on milestone");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/BUILDER_MASTER_WORKFLOW/.test(rules), "master workflow in engineering rules");
ok(/Stop creating new architecture/i.test(rules), "stop new arch in rules");
ok(/Module 2 AI Discovery/i.test(rules), "Module 2 next in rules");

if (failed) process.exit(1);
console.log("OK Builder Master Workflow / architecture freeze checks passed");
