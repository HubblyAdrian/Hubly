#!/usr/bin/env node
/**
 * Gate — Hubly AI Business Builder Module 2 architecture lock + Rule #26 profiles
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
ok(/Business Profile/i.test(memory), "Business Profile in Hubly Memory");
ok(/Owner Profile/i.test(memory), "Owner Profile in Hubly Memory");
ok(/30 days/i.test(memory), "Temporary Memory TTL 30 days");
ok(/Never expires/i.test(memory), "Permanent Memory never expires");

const arch = read("docs/builder/DISCOVERY_ARCHITECTURE.md");
ok(/Architecture locked|🔒/.test(arch), "Discovery architecture marked locked");
ok(/Business Profile/i.test(arch), "Business Profile in Discovery architecture");
ok(/Owner Profile/i.test(arch), "Owner Profile in Discovery architecture");
ok(/Business DNA/i.test(arch), "Business DNA as combination");
ok(/Rule #26/.test(arch), "Rule #26 referenced");
ok(/never re-ask|Nothing already known|Never ask something already known/i.test(arch), "never re-ask known facts");
ok(/90%/.test(arch), "completion threshold ≥ 90%");
ok(/Max \*\*2\*\* questions|Max 2 questions/i.test(arch), "max 2 questions");
ok(/No UI or code change may alter|without reopening/i.test(arch), "architecture freeze rule stated");
ok(/Marketplace/i.test(arch), "Marketplace preserved note");

const land = read("docs/AI_LANDING_ARCHITECTURE.md");
ok(/🔒|Locked/i.test(land), "AI Landing architecture marked locked");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/Rule #25/.test(rules), "Rule #25 Hubly Memory in engineering rules");
ok(/Rule #26/.test(rules), "Rule #26 Business + Owner Profile in engineering rules");
ok(/DISCOVERY_ARCHITECTURE/.test(rules), "Discovery architecture gate registered");

const checklist = read("docs/builder/DISCOVERY_CHECKLIST.md");
ok(/Architecture locked/i.test(checklist), "Discovery checklist architecture locked");
ok(/Owner Profile/i.test(checklist), "Owner Profile on checklist");

const mat = read("docs/builder/DISCOVERY_MAT.md");
ok(/Owner Profile/i.test(mat), "MAT covers Owner Profile");
ok(/Business DNA reaches|DNA ≥ 90%|≥ 90%/i.test(mat), "MAT covers DNA completion");

const milestone = read("docs/builder/README.md");
ok(/Architecture locked/i.test(milestone), "milestone shows Discovery architecture locked");
ok(/AI Research Engine/i.test(milestone), "milestone lists AI Research Engine");

if (failed) process.exit(1);
console.log("OK discovery architecture lock / Rule #26 checks passed");
