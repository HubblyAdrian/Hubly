#!/usr/bin/env node
/**
 * Gate — Rule #27 lock + Creative Review (#28) + Module 5 Reveal architecture
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

ok(fs.existsSync(path.join(root, "docs/builder/CREATIVE_REVIEW.md")), "CREATIVE_REVIEW.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/REVEAL_ARCHITECTURE.md")), "REVEAL_ARCHITECTURE.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/REVEAL_CHECKLIST.md")), "REVEAL_CHECKLIST.md exists");
ok(fs.existsSync(path.join(root, "docs/builder/REVEAL_MAT.md")), "REVEAL_MAT.md exists");

const vision = read("docs/builder/BUSINESS_VISION.md");
ok(/🔒|Locked/i.test(vision), "Business Vision marked locked");
ok(/must build toward/i.test(vision), "build toward Vision stated");

const review = read("docs/builder/CREATIVE_REVIEW.md");
ok(/Rule #28/.test(review), "Rule #28 on Creative Review");
ok(/Brand Consistency/i.test(review), "Brand Consistency score");
ok(/Customer Trust/i.test(review), "Customer Trust score");
ok(/Conversion/i.test(review), "Conversion score");
ok(/SEO Readiness/i.test(review), "SEO Readiness score");
ok(/Revenue Potential/i.test(review), "Revenue Potential score");
ok(/reviewed the business I created/i.test(review), "director summary copy");
ok(/Creative Blueprint → Creative Review → Business Reveal/s.test(review) || /Creative Review/.test(review), "pipeline to Reveal");

const reveal = read("docs/builder/REVEAL_ARCHITECTURE.md");
ok(/present the business we've created together/i.test(reveal), "signature present line");
ok(/Save My Business/i.test(reveal), "Save My Business CTA");
ok(/first edit|first meaningful edit/i.test(reveal), "save on first edit");
ok(/Continue with Google/i.test(reveal), "Google continue option");
ok(/Creative Review/i.test(reveal), "Creative Review stage in Reveal");
ok(/not.*Create Account|Not “Create Account”|Not \"Create Account\"/i.test(reveal), "not Create Account framing");
ok(/Brand Reveal/i.test(reveal), "Brand Reveal stage");
ok(/Website Preview/i.test(reveal), "Website Preview stage");

const cd = read("docs/builder/CREATIVE_DIRECTOR_ARCHITECTURE.md");
ok(/Architecture locked|🔒/.test(cd), "Creative Director architecture locked");
ok(/canonical output/i.test(cd), "Creative Blueprint canonical output");
ok(/Rule #28|Creative Review/i.test(cd), "Creative Review required in M4");

const rules = read("docs/operate/OPERATE_ENGINEERING_RULES.md");
ok(/Rule #27/.test(rules) && /Locked/i.test(rules), "Rule #27 locked in engineering rules");
ok(/Rule #28/.test(rules), "Rule #28 in engineering rules");
ok(/REVEAL_ARCHITECTURE/.test(rules), "Reveal architecture registered");
ok(/CREATIVE_REVIEW/.test(rules), "Creative Review registered");
ok(/No UI implementation may change these architecture documents/i.test(rules), "UI may not change architecture docs");

const milestone = read("docs/builder/README.md");
ok(/Business Reveal/i.test(milestone), "Module 5 on milestone");
ok(/Creative Review/i.test(milestone), "Creative Review on milestone");
ok(/Rule #27/.test(milestone), "Rule #27 on milestone");

const mat = read("docs/builder/REVEAL_MAT.md");
ok(/First edit triggers lightweight save/i.test(mat), "MAT first-edit save");
ok(/Creative Review scores/i.test(mat), "MAT Creative Review");

if (failed) process.exit(1);
console.log("OK Rule #27 lock / Creative Review / Reveal architecture checks passed");
