#!/usr/bin/env node
/**
 * Gate — Rule #24 AI Landing Intent Router
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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

const intentSrc = fs.readFileSync(path.join(root, "public/landing-intent.js"), "utf8");
const home = fs.readFileSync(path.join(root, "public/platform-home.html"), "utf8");
const arch = fs.existsSync(path.join(root, "docs/AI_LANDING_ARCHITECTURE.md"));
const rules = fs.readFileSync(path.join(root, "docs/operate/OPERATE_ENGINEERING_RULES.md"), "utf8");

ok(arch, "AI_LANDING_ARCHITECTURE.md exists");
ok(/Rule #24/.test(rules), "Rule #24 in engineering rules");
ok(home.includes('src="/landing-intent.js"'), "platform-home loads landing-intent.js");
ok(home.includes("I want to grow my business"), "grow-business phrasing");
ok(home.includes("I need to hire someone"), "hire-someone phrasing");
ok(home.includes('href="/marketplace"'), "Marketplace preserved");
ok(home.includes('href="/get-done"'), "Get Done preserved");
ok(home.includes('href="/signup"'), "Builder signup preserved");
ok(!/id="askCard"/.test(home), "Ask Hubly not demoted into conveyor");

const sandbox = { window: {}, console };
vm.runInNewContext(intentSrc, sandbox);
const Intent = sandbox.window.HublyLandingIntent || sandbox.HublyLandingIntent;
ok(!!Intent, "HublyLandingIntent exported");

const biz = Intent.understand("I'm starting a mobile detailing company in Dallas called Shine Mobile", "business");
ok(biz.intent === "build_business", "routes business intent to builder");
ok(biz.industry === "Detailing", "detects detailing industry");
ok(/Dallas/i.test(biz.location), "detects Dallas location");
ok(biz.ready === true, "continue ready for rich business prompt");
ok(Intent.routeUrl(biz).startsWith("/signup"), "business routes to /signup");

const hire = Intent.understand("I need someone to ceramic coat my Tesla tomorrow", "help");
ok(hire.intent === "hire_pro", "routes hire intent to concierge");
ok(Intent.routeUrl(hire).startsWith("/get-done"), "hire routes to /get-done");

const ig = Intent.understand("Here's my Instagram https://instagram.com/shine.detail", "business");
ok(ig.imports.some((i) => i.type === "instagram"), "detects Instagram import");

if (failed) process.exit(1);
console.log("OK landing intent checks passed");
