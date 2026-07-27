#!/usr/bin/env node
/**
 * Gate — Rule #28 lock + AI Business Agency + Module 6 Business Activation architecture
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

ok(fs.existsSync(path.join(root, "docs/builder/ACTIVATION_ARCHITECTURE.md")), "ACTIVATION_ARCHITECTURE.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/ACTIVATION_CHECKLIST.md")), "ACTIVATION_CHECKLIST.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/ACTIVATION_MAT.md")), "ACTIVATION_MAT.md exists");

const review = read("docs/builder/CREATIVE_REVIEW.md");
ok(/🔒|Locked/i.test(review), "Creative Review marked locked");
ok(/must be reviewed before presentation/i.test(review), "review before presentation");
ok(/No UI implementation may bypass/i.test(review), "no UI bypass stated");

const reveal = read("docs/builder/REVEAL_ARCHITECTURE.md");
ok(/Architecture locked|🔒/.test(reveal), "Reveal architecture locked");
ok(/canonical completion/i.test(reveal), "Reveal is design-phase completion");
ok(/Business Activation/i.test(reveal), "Activation follows Reveal");
ok(/Save My Business/i.test(reveal), "Save My Business account point");

const act = read("docs/builder/ACTIVATION_ARCHITECTURE.md");
ok(/Business Activation/i.test(act), "named Business Activation");
ok(/not.*Business Setup|not “Business Setup”|not \"Business Setup\"/i.test(act), "not Business Setup");
ok(/Architecture locked|🔒/.test(act) || /canonical activation/i.test(act), "Activation architecture locked or canonical");
ok(/Launch Coach/i.test(act) || /LAUNCH_COACH/i.test(read("docs/builder/README.md")), "Launch Coach in Agency path");
ok(/mission control/i.test(act), "mission control principle");
ok(/Fuel your business with online payments/i.test(act), "Stripe why-language");
ok(/Protect your schedule from double bookings/i.test(act), "Calendar why-language");
ok(/Stay informed the moment customers need you/i.test(act), "Notifications why-language");
ok(/Never block launch/i.test(act), "never block launch");
ok(/Launch My Business/i.test(act), "Launch CTA");
ok(/Home Dashboard|Operating System/i.test(act), "Dashboard transition");
ok(/AI Project Manager/i.test(act), "Project Manager role");

const milestone = read("docs/builder/README.md");
ok(/AI Business Agency/i.test(milestone), "Agency product name");
ok(/Business Activation/i.test(milestone), "Module 6 on milestone");
ok(/No UI implementation may bypass|No Builder .* may bypass|no module may bypass/i.test(milestone), "pipeline bypass ban");
ok(/Save My Business/i.test(milestone), "Save My Business on milestone");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/Rule #28/.test(rules) && /Locked/i.test(rules), "Rule #28 locked in engineering rules");
ok(/Rule #29/.test(rules), "Rule #29 Agency + Activation");
ok(/ACTIVATION_ARCHITECTURE/.test(rules), "Activation registered");
ok(/AI Business Agency/i.test(rules), "Agency named in rules");

const mat = read("docs/builder/ACTIVATION_MAT.md");
ok(/Never block|do not block|Optional gaps do not block/i.test(mat), "MAT non-blocking launch");
ok(/Business Activation \(not Setup\)/i.test(mat) || /not Setup/i.test(mat), "MAT framing Activation");

if (failed) process.exit(1);
console.log("OK Rule #28 lock / Agency / Activation architecture checks passed");
