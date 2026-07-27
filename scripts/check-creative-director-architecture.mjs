#!/usr/bin/env node
/**
 * Gate — Rule #26 lock + Business Vision + Module 4 Creative Director architecture
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

ok(fs.existsSync(path.join(root, "docs/builder/BUSINESS_VISION.md")), "BUSINESS_VISION.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/CREATIVE_DIRECTOR_ARCHITECTURE.md")), "CREATIVE_DIRECTOR_ARCHITECTURE.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/CREATIVE_DIRECTOR_CHECKLIST.md")), "CREATIVE_DIRECTOR_CHECKLIST.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/CREATIVE_DIRECTOR_MAT.md")), "CREATIVE_DIRECTOR_MAT.md exists");

const vision = read("docs/builder/BUSINESS_VISION.md");
ok(/Long-term goals/i.test(vision), "Vision: long-term goals");
ok(/Ideal customers/i.test(vision), "Vision: ideal customers");
ok(/Desired positioning/i.test(vision), "Vision: desired positioning");
ok(/Growth timeline/i.test(vision), "Vision: growth timeline");
ok(/Success metrics/i.test(vision), "Vision: success metrics");
ok(/Expansion plans/i.test(vision), "Vision: expansion plans");
ok(/destination/i.test(vision), "Vision framed as destination");
ok(/Rule #27/.test(vision), "Rule #27 on Vision doc");
ok(/does not replace|complements/i.test(vision), "Vision complements profiles");

const cd = read("docs/builder/CREATIVE_DIRECTOR_ARCHITECTURE.md");
ok(/not\s*\*{0,2}\s*a website generator|This is \*\*not\*\* a website generator/i.test(cd), "not a website generator");
ok(/Creative Blueprint/i.test(cd), "Creative Blueprint output");
ok(/Business Vision/i.test(cd), "Vision is an input");
ok(/Research Profile/i.test(cd), "Research Profile is an input");
ok(/Business DNA/i.test(cd), "Business DNA is an input");
ok(/Ask Why|WHY/i.test(cd), "explanations required");
ok(/Compare/i.test(cd), "compare mode");
ok(/present the business/i.test(cd), "signature reveal");
ok(/Live preview/i.test(cd), "live preview");
ok(/Page Blueprint/i.test(cd), "page blueprint not HTML-only");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/Rule #26/.test(rules) && /Locked|canonical/i.test(rules), "Rule #26 locked/canonical in engineering rules");
ok(/Rule #27/.test(rules), "Rule #27 in engineering rules");
ok(/Locked/i.test(read("docs/builder/BUSINESS_VISION.md")), "Business Vision doc locked");
ok(/canonical output|Creative Blueprint/i.test(read("docs/builder/CREATIVE_DIRECTOR_ARCHITECTURE.md")), "Creative Blueprint canonical on M4");
ok(/CREATIVE_DIRECTOR_ARCHITECTURE/.test(rules), "Creative Director registered");
ok(/BUSINESS_VISION/.test(rules), "Business Vision registered");
ok(/No Builder module may|do not bypass or duplicate/i.test(rules), "no bypass/duplicate rule");

const memory = read("docs/HUBLY_MEMORY.md");
ok(/Business Vision/i.test(memory), "Vision in Hubly Memory");
ok(/canonical for all future Builder/i.test(memory), "DNA canonical for all Builder modules");

const milestone = read("docs/builder/README.md");
ok(/Business Vision/i.test(milestone), "Vision on milestone board");
ok(/Creative Director/i.test(milestone), "Module 4 on milestone board");
ok(/No Builder module may bypass/i.test(milestone), "bypass ban on milestone");

const mat = read("docs/builder/CREATIVE_DIRECTOR_MAT.md");
ok(/Business Vision consumed/i.test(mat), "MAT Vision input");
ok(/Signature reveal/i.test(mat), "MAT reveal");

if (failed) process.exit(1);
console.log("OK Rule #26 lock / Business Vision / Creative Director architecture checks passed");
