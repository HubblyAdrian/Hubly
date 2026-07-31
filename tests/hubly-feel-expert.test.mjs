import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const consultantJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-consultant.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const awJs = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.js"), "utf8");
const awCss = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.css"), "utf8");

function loadConsultant() {
  const store = {};
  const sandbox = {
    window: {},
    S: {},
    localStorage: {
      getItem(k) { return store[k] ?? null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const taste = fs.readFileSync(path.join(root, "public/journey-os/hubly-taste.js"), "utf8");
  vm.runInNewContext(taste, sandbox);
  vm.runInNewContext(consultantJs, sandbox);
  return sandbox;
}

test("expert success is measured by progress not question count", () => {
  assert.match(consultantJs, /meaningful progress after each interaction/);
  assert.match(consultantJs, /not by how many questions/);
});

test("Example 1 — candle business gets unlocking channel question then directions", () => {
  const s = loadConsultant();
  const C = s.HublyConsultant;
  const t1 = C.think("I want to build a candle company.");
  assert.ok(t1.replies.length >= 2);
  const blob = t1.replies.map((r) => r.text).join(" ");
  assert.match(blob, /online|markets|both/i);
  assert.doesNotMatch(blob, /What city are you in/i);
  assert.doesNotMatch(blob, /What industry/i);
  assert.ok(t1.recommendation);
  assert.ok(t1.recommendation.confidence >= 80);
  assert.ok(t1.recommendation.reasoning);

  const t2 = C.think("Both — online and local markets");
  assert.ok(t2.showProgress || (t2.actions || []).some((a) => a.type === "set_surface"));
  assert.equal(t2.recommendation.surface, "directions");
  assert.match(t2.replies.map((r) => r.text).join(" "), /three storefront directions/i);
  assert.match(t2.recommendation.reasoning, /./);
});

test("Example 2 — photography asks bookings vs prints then builds", () => {
  const s = loadConsultant();
  const C = s.HublyConsultant;
  const t1 = C.think("I want to sell my photography.");
  assert.match(t1.replies.map((r) => r.text).join(" "), /booking|print|both/i);
  const t2 = C.think("Both bookings and prints");
  assert.ok(t2.pride || t2.showProgress);
  assert.ok((t2.actions || []).some((a) => a.type === "set_surface" && a.surface === "website"));
  assert.ok(t2.recommendation.reasoning);
});

test("Example 3 — Airbnb cleaning becomes Marketplace with smart follow-up", () => {
  const s = loadConsultant();
  const C = s.HublyConsultant;
  const t1 = C.think("I need someone to clean my Airbnb.");
  assert.equal(C.ensure().memory.intent, "find_help");
  assert.ok(t1.replies.length);
  assert.match(t1.replies.map((r) => r.text).join(" "), /when|recurring|where|conversation/i);
  assert.ok((t1.actions || []).some((a) => a.project === "marketplace" || a.surface === "marketplace"));
});

test("Example 4 — existing website URL imports and shows progress", () => {
  const s = loadConsultant();
  const C = s.HublyConsultant;
  const t1 = C.think("I already have a website https://example.com");
  assert.ok(t1.showProgress);
  assert.match(t1.replies.map((r) => r.text).join(" "), /import|reading|workspace/i);
  assert.ok((t1.actions || []).some((a) => a.type === "set_surface"));
});

test("conversation memory welcome back after finished work", () => {
  const s = loadConsultant();
  const C = s.HublyConsultant;
  C.markFinished("Storefront");
  C.setFocus("catalog", "Creating Products");
  const wb = C.welcomeBack();
  assert.ok(wb);
  assert.match(wb.text, /Welcome back/i);
  assert.match(wb.text, /storefront|product/i);
});

test("intent can switch to find_help mid conversation", () => {
  const s = loadConsultant();
  const C = s.HublyConsultant;
  C.think("I'm building a candle company");
  const t2 = C.think("Actually I need someone to photograph my products");
  assert.equal(C.ensure().memory.intent, "find_help");
  assert.match(t2.replies.map((r) => r.text).join(" "), /Marketplace|pivoting|pro/i);
});

test("recommendations never omit why + confidence label", () => {
  const s = loadConsultant();
  const C = s.HublyConsultant;
  const t = C.think("I'm starting a pressure washing business in Dallas");
  assert.ok(t.recommendation);
  assert.ok(String(t.recommendation.reasoning).length > 20);
  assert.ok(t.recommendation.confidenceLabel);
  assert.doesNotMatch(t.replies.map((r) => r.text).join(" "), /Anything else\?/i);
});

test("hubly wires expert think path and choice chips", () => {
  assert.match(html, /HublyConsultant\.think/);
  assert.match(html, /isTalkSetChips/);
  assert.match(html, /isTalkExpertChip/);
  assert.match(html, /hubly-consultant\.js\?v=consultant-3/);
  assert.match(html, /ai-workspace\.js\?v=aw-5/);
  assert.match(html, /hubly-taste\.js\?v=taste-1/);
});

test("workspace has pride celebration + emotion motion", () => {
  assert.match(awJs, /celebrate/);
  assert.match(awJs, /You built this/);
  assert.match(awCss, /aw-pride/);
  assert.match(awCss, /is-celebrate/);
  assert.match(awJs, /version: '1\.4\.0'/);
});
