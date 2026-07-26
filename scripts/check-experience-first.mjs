#!/usr/bin/env node
/** Gate: Experience-First — customer-visible Create journey + living prototype. */
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

console.log("\nExperience First — Living Prototype\n");

const exp = fs.readFileSync(path.join(root, "docs/EXPERIENCE_FIRST.md"), "utf8");
const live = fs.readFileSync(path.join(root, "docs/LIVING_PROTOTYPE.md"), "utf8");
const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const disc = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/hubly_brain_discovery_conversation.ts"),
  "utf8",
);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

check(
  "EXPERIENCE_FIRST.md standard",
  /would I immediately notice/i.test(exp) && /I.?ll build this for you/i.test(exp),
);
check("Living prototype path documented", /Landing/.test(live) && /Reveal/.test(live) && /Hubly Home/.test(live));
check("npm script registered", pkg.scripts?.["check:experience-first"] === "node scripts/check-experience-first.mjs");

check("Live studio markup", /data-experience-live-studio="1"/.test(hubly) && /id="is-live-studio"/.test(hubly));
check("Live studio surfaces", /id="is-live-website"/.test(hubly) && /id="is-live-booking"/.test(hubly) && /id="is-live-packages"/.test(hubly));
check("isRenderLiveBuild wired", /function isRenderLiveBuild\(/.test(hubly) && /isRenderLiveBuild\(\)/.test(hubly));
check("Building while talking copy", /Hubly is building/.test(hubly));
check("Reveal moment copy", /I built your business/.test(hubly));
check("Clickable reveal surfaces", /data-experience-reveal="1"/.test(hubly) && /function isRevealOpenSurface\(/.test(hubly));
check("Discovery prompt: work first", /Work first/.test(disc) && /buildingActions/.test(disc));
check("Discovery prompt: not a wizard", /NOT a questionnaire|wizard/i.test(disc));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/EXPERIENCE_FIRST_PROOF.json"),
  JSON.stringify(
    {
      title: "Experience First — Living Prototype",
      passed,
      failures,
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log(passed ? "\nEXPERIENCE FIRST PASS\n" : "\nEXPERIENCE FIRST FAIL\n");
if (!passed) process.exit(1);
