#!/usr/bin/env node
/** Gate: CEO Demo Mode — /demo starts the customer journey without login. */
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

console.log("\nCEO Demo Mode\n");

const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const router = fs.readFileSync(path.join(root, "api/router.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

check("npm script", pkg.scripts?.["check:ceo-demo"] === "node scripts/check-ceo-demo.mjs");
check("routes mapped", /'\/demo':'p-ceo-demo'/.test(hubly) && /'\/experience':'p-ceo-demo'/.test(hubly));
check("isCeoDemoPath helper", /function isCeoDemoPath\(/.test(hubly));
check("startCeoDemoMode", /async function startCeoDemoMode\(/.test(hubly));
check("default fitness seed", /I'm an independent fitness trainer/.test(hubly));
check("checkSession boots demo", /if\(isCeoDemoPath\(\)\)/.test(hubly) && /startCeoDemoMode\(\)/.test(hubly));
check("skip claim wall", /if\(S\._ceoDemo\)/.test(hubly) && /isRevealContinueToWorkspace/.test(hubly));
check("demo chrome + restart", /id="ceo-demo-bar"/.test(hubly) && /function restartCeoDemo\(/.test(hubly));
check("keep /demo URL on Home", /ceoDemo:true/.test(hubly) && /#home/.test(hubly));
check("boot flash includes demo paths", /'\/demo':1/.test(hubly) && /'\/experience':1/.test(hubly));
check("router serves hubly for demo", /CEO Demo Mode \(\/demo, \/experience\)/.test(router));
check("no login required comment", /no login/.test(hubly));

const passed = failures.length === 0;
fs.writeFileSync(
  path.join(root, "docs/CEO_DEMO_PROOF.json"),
  JSON.stringify({ title: "CEO Demo Mode", passed, failures, checkedAt: new Date().toISOString() }, null, 2) + "\n",
);
console.log(passed ? "\nCEO DEMO PASS\n" : "\nCEO DEMO FAIL\n");
if (!passed) process.exit(1);
