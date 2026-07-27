#!/usr/bin/env node
/**
 * Gate — Hubly AI Business Builder Module 3 Research architecture docs
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

ok(fs.existsSync(path.join(root, "docs/builder/RESEARCH_ARCHITECTURE.md")), "RESEARCH_ARCHITECTURE.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/RESEARCH_CHECKLIST.md")), "RESEARCH_CHECKLIST.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/RESEARCH_MAT.md")), "RESEARCH_MAT.md exists");

const arch = read("docs/builder/RESEARCH_ARCHITECTURE.md");
ok(/Research the business before building/i.test(arch), "purpose statement present");
ok(/not a loading screen|AI employee/i.test(arch), "anti-spinner UX principle");
ok(/Research Profile/i.test(arch), "Research Profile output defined");
ok(/Owner Profile/i.test(arch), "Owner Profile is an input");
ok(/Business Profile/i.test(arch), "Business Profile is an input");
ok(/Nothing should stop the Builder/i.test(arch), "non-blocking failure rule");
ok(/confidence/i.test(arch), "confidence on findings");
ok(/Parallel/i.test(arch), "parallel research");
ok(/Website Analysis/i.test(arch), "website analysis task");
ok(/Competitor/i.test(arch), "competitor discovery");
ok(/Pricing Intelligence/i.test(arch), "pricing intelligence");

const checklist = read("docs/builder/RESEARCH_CHECKLIST.md");
ok(/Live timeline/i.test(checklist), "live timeline on checklist");
ok(/Zero duplicate analysis/i.test(checklist), "no duplicate analysis");

const mat = read("docs/builder/RESEARCH_MAT.md");
ok(/No blocking failures/i.test(mat), "MAT non-blocking");
ok(/Research Profile produced/i.test(mat), "MAT Research Profile acceptance");
ok(/Owner Profile/i.test(mat), "MAT Owner Profile input");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/RESEARCH_ARCHITECTURE/.test(rules), "Research architecture registered in engineering rules");

if (failed) process.exit(1);
console.log("OK research architecture checks passed");
