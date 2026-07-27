#!/usr/bin/env node
/**
 * Gate — Rule #24 AI Landing + Hubly Session handoff / import pipeline
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

const sessionPath = path.join(root, "public/hubly-session.js");
const aliasPath = path.join(root, "public/landing-intent.js");
const sessionSrc = fs.readFileSync(sessionPath, "utf8");
const aliasSrc = fs.readFileSync(aliasPath, "utf8");
const home = fs.readFileSync(path.join(root, "public/platform-home.html"), "utf8");
const hubly = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const importApi = fs.readFileSync(path.join(root, "api/import-analyze.js"), "utf8");
const sessionDoc = fs.existsSync(path.join(root, "docs/HUBLY_SESSION.md"));
const arch = fs.existsSync(path.join(root, "docs/AI_LANDING_ARCHITECTURE.md"));
const rules = fs.readFileSync(path.join(root, "docs/operate/OPERATE_ENGINEERING_RULES.md"), "utf8");

ok(arch, "AI_LANDING_ARCHITECTURE.md exists");
ok(sessionDoc, "HUBLY_SESSION.md exists");
ok(/Rule #24/.test(rules), "Rule #24 in engineering rules");
ok(/Hubly Session/.test(rules), "Rule #24 references Hubly Session");
ok(home.includes('src="/hubly-session.js"'), "platform-home loads hubly-session.js");
ok(home.includes("I want to grow my business"), "grow-business phrasing");
ok(home.includes("I need to hire someone"), "hire-someone phrasing");
ok(home.includes('href="/marketplace"'), "Marketplace preserved");
ok(home.includes('href="/get-done"'), "Get Done preserved");
ok(home.includes('href="/signup"'), "Builder signup preserved");
ok(home.includes("hs="), "structured handoff query param on landing");
ok(home.includes("startImportPipeline"), "landing starts import pipeline");
ok(sessionSrc.includes("Reading services"), "import progress UX strings in Hubly Session");
ok(home.includes("importProgress") || home.includes("startImportPipeline"), "landing paints import progress");
ok(!/id="askCard"/.test(home), "Ask Hubly not demoted into conveyor");
ok(hubly.includes("consumeHublySessionForBuilder"), "Builder consumes Hubly Session");
ok(hubly.includes("toBuilderPayload"), "Builder uses structured payload");
ok(hubly.includes("applyKnownFacts"), "Discovery applies known session facts");
ok(hubly.includes("upgradeToAccount"), "account upgrade wired");
ok(importApi.includes("analyzeWebsite"), "import-analyze parses websites");
ok(sessionSrc.includes("SESSION_TTL_MS"), "session TTL defined");
ok(sessionSrc.includes("toBuilderPayload"), "toBuilderPayload exported");
ok(sessionSrc.includes("startImportPipeline"), "startImportPipeline exported");
ok(sessionSrc.includes("upgradeToAccount"), "upgradeToAccount exported");
ok(sessionSrc.includes("hubly_session"), "canonical hubly_session kind/key");
ok(!/Builder Session/.test(sessionSrc), "module does not brand as Builder Session");
ok(aliasSrc.includes("HublyLandingIntent"), "landing-intent alias retained");

const memoryStore = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
})();
const sandbox = {
  window: { localStorage: memoryStore },
  console,
  fetch: async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      partial: false,
      analysis: { businessName: "Shine Mobile", serviceCount: 3, imageCount: 8 },
    }),
  }),
  setTimeout: (fn) => { fn(); return 0; },
  localStorage: memoryStore,
};
vm.runInNewContext(sessionSrc, sandbox);
const Intent = sandbox.window.HublySession || sandbox.window.HublyLandingIntent;
ok(!!Intent, "HublySession exported");
ok(!!sandbox.window.HublyLandingIntent, "HublyLandingIntent alias exported");

const biz = Intent.understand(
  "I'm starting a mobile detailing company in Dallas called Shine Mobile",
  "business"
);
ok(biz.intent === "build_business", "routes business intent to builder");
ok(biz.industry === "Detailing", "detects detailing industry");
ok(/Dallas/i.test(biz.location), "detects Dallas location");
ok(biz.ready === true, "continue ready for rich business prompt");
const session = Intent.upsertSession(biz);
ok(session && session.kind === "hubly_session", "creates hubly_session");
ok(!!session.expiresAt, "session has expiresAt");
const route = Intent.routeUrl(biz, session);
ok(route.startsWith("/signup"), "business routes to /signup");
ok(/[?&]hs=/.test(route), "route includes hs session id");

const hire = Intent.understand("I need someone to ceramic coat my Tesla tomorrow", "help");
ok(hire.intent === "hire_pro", "routes hire intent to concierge");
ok(Intent.routeUrl(hire).startsWith("/get-done"), "hire routes to /get-done");

const ig = Intent.understand("Here's my Instagram https://instagram.com/shine.detail", "business");
ok(ig.imports.some((i) => i.type === "instagram"), "detects Instagram import");

const web = Intent.understand("My site is https://example.com/detailing", "business");
Intent.upsertSession(web);
const after = (await Intent.startImportPipeline()) || Intent.loadSession();
ok(after && after.imports && after.imports.website, "website import record exists");
ok(
  !!(after && after.imports && after.imports.website &&
    (after.imports.website.status === "ready" || after.imports.website.status === "partial")),
  "import pipeline advances website beyond detect-only"
);

const payload = Intent.toBuilderPayload(after);
ok(payload && payload.sessionId, "toBuilderPayload has sessionId");
ok(payload.conversation, "payload includes conversation");
ok("industry" in payload && "businessName" in payload && "location" in payload, "payload has core facts");
ok(payload.imports && "website" in payload.imports, "payload includes imports");
ok("memory" in payload, "payload includes future AI memory");

const upgraded = Intent.upgradeToAccount({ accountId: "acct_test", businessId: "biz_test" });
ok(upgraded.status === "upgraded", "upgradeToAccount sets upgraded status");
ok(upgraded.accountId === "acct_test", "upgrade stores accountId");

if (failed) process.exit(1);
console.log("OK landing intent / Hubly Session checks passed");
