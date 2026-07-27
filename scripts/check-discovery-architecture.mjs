#!/usr/bin/env node
/**
 * Gate — Hubly AI Business Builder Module 2 architecture docs + Landing lock + Hubly Memory
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

ok(fs.existsSync(path.join(root, "docs/HUBLY_MEMORY.md")), "HUBLY_MEMORY.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/README.md")), "builder milestone README exists");
ok(fs.existsSync(path.join(root, "docs/builder/DISCOVERY_ARCHITECTURE.md")), "DISCOVERY_ARCHITECTURE.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/DISCOVERY_CHECKLIST.md")), "DISCOVERY_CHECKLIST.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/DISCOVERY_MAT.md")), "DISCOVERY_MAT.md exists");

const memory = read("docs/HUBLY_MEMORY.md");
ok(/Temporary Memory/i.test(memory), "Temporary Memory defined");
ok(/Permanent Memory/i.test(memory), "Permanent Memory defined");
ok(/Conversation Memory/i.test(memory), "Conversation Memory defined");
ok(/30 days/i.test(memory), "Temporary Memory TTL 30 days");
ok(/Never expires/i.test(memory), "Permanent Memory never expires");
ok(/Hubly Session/i.test(memory), "Temporary Memory maps to Hubly Session");
ok(/Ask Hubly/i.test(memory), "Conversation Memory maps to Ask Hubly");

const arch = read("docs/builder/DISCOVERY_ARCHITECTURE.md");
ok(/Business DNA/i.test(arch), "Business DNA in Discovery architecture");
ok(/never re-ask|Nothing already known|Never ask something already known/i.test(arch), "never re-ask known facts");
ok(/90%/.test(arch), "completion threshold ≥ 90%");
ok(/Max \*\*2\*\* questions|Max 2 questions/i.test(arch), "max 2 questions");
ok(/split|Left:|Conversation.*DNA/i.test(arch), "split conversation + DNA layout");
ok(/Marketplace/i.test(arch), "Marketplace preserved note");

const land = read("docs/AI_LANDING_ARCHITECTURE.md");
ok(/🔒|Locked/i.test(land), "AI Landing architecture marked locked");
const landCheck = read("docs/AI_LANDING_CHECKLIST.md");
ok(/🔒 Locked/i.test(landCheck), "AI Landing checklist locked");
ok(/Do not redesign Landing/i.test(landCheck), "Landing redesign freeze stated");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/Rule #25/.test(rules), "Rule #25 Hubly Memory in engineering rules");
ok(/DISCOVERY_ARCHITECTURE/.test(rules), "Discovery architecture gate registered");

const milestone = read("docs/builder/README.md");
ok(/AI Landing Experience/.test(milestone) && /🔒/.test(milestone), "milestone shows Landing locked");
ok(/AI Discovery/.test(milestone), "milestone lists AI Discovery");

const mat = read("docs/builder/DISCOVERY_MAT.md");
ok(/No duplicate questions/i.test(mat), "MAT covers no duplicate questions");
ok(/Business DNA reaches completion/i.test(mat), "MAT covers DNA completion");

if (failed) process.exit(1);
console.log("OK discovery architecture / Hubly Memory / Landing lock checks passed");
