import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tasteJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-taste.js"), "utf8");
const consultantJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-consultant.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const awJs = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.js"), "utf8");
const awCss = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.css"), "utf8");

function load() {
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
  vm.runInNewContext(tasteJs, sandbox);
  vm.runInNewContext(consultantJs, sandbox);
  return sandbox;
}

test("HublyTaste is a reusable recommendation engine", () => {
  const s = load();
  const T = s.HublyTaste;
  assert.equal(T.version, "1.1.0");
  assert.equal(typeof T.make, "function");
  assert.equal(typeof T.understand, "function");
  assert.equal(typeof T.forWebsite, "function");
  assert.equal(typeof T.forCommerce, "function");
  assert.equal(typeof T.forMarketplace, "function");
  assert.equal(typeof T.consultPushback, "function");
});

test("Understand infers commerce story from handmade candles", () => {
  const s = load();
  const u = s.HublyTaste.understand({ text: "I sell handmade candles.", business: { offer: "product", industry: "Candles" } });
  assert.equal(u.model, "commerce");
  assert.ok(u.inferences.some((i) => /story/i.test(i)));
  assert.ok(u.inferences.some((i) => /photo|mobile/i.test(i)));
});

test("Recommendation includes why, tradeoffs, alternatives, confidence stars", () => {
  const s = load();
  const card = s.HublyTaste.forCommerce(
    { business: { industry: "Candles", channels: "both", offer: "product", buyerIntent: "gift" }, text: "both gifts" },
    { evidence: ["stated_channels", "buyer_intent_gift"] }
  );
  assert.equal(card.ok, true);
  assert.ok(card.why.length > 20);
  assert.ok(card.tradeoffs.length >= 1);
  assert.ok(card.alternatives.length >= 1);
  assert.match(card.stars, /★/);
  assert.match(card.confidenceLabel, /Strong|Worth|Possible/);
  assert.ok(card.evidence.length >= 1);
});

test("Never invent — ask when evidence is missing", () => {
  const s = load();
  const card = s.HublyTaste.make({
    choice: "Mystery layout",
    why: "",
    confidence: 90,
    allowWithoutEvidence: false,
  });
  assert.equal(card.ok, false);
  assert.equal(card.needClarify, true);
  assert.ok(card.ask);
});

test("Consultative pushback never says No", () => {
  const s = load();
  const pb = s.HublyTaste.consultPushback("I want twenty menu items in my navigation");
  assert.equal(pb.pushback, true);
  assert.match(pb.message, /I can absolutely/i);
  assert.doesNotMatch(pb.message, /\bNo\b/);
  assert.ok(pb.recommendation.why);
  assert.ok(pb.recommendation.alternatives.length >= 1);

  const neon = s.HublyTaste.consultPushback("I want neon green text");
  assert.equal(neon.pushback, true);
  assert.match(neon.message, /I can build that/i);
});

test("Taste learns preferred style from choices", () => {
  const s = load();
  s.HublyTaste.rememberChoice("minimal", { style: "minimal", domain: "website" });
  s.HublyTaste.rememberChoice("minimal", { style: "minimal", domain: "commerce" });
  assert.equal(s.HublyTaste.preferredStyle(), "minimal");
});

test("cardHtml renders Recommended + Why + Tradeoffs + Compare", () => {
  const s = load();
  const card = s.HublyTaste.make({
    choice: "Artisan",
    confidence: 94,
    why: "Handmade products sell better when customers understand the story.",
    tradeoffs: [
      { label: "Tradeoff", text: "Slightly slower checkout." },
      { label: "Gain", text: "Stronger emotional connection." },
    ],
    alternatives: [{ id: "minimal", label: "Minimal", when: "If customers already know your brand" }],
    evidence: ["stated_offer"],
    allowWithoutEvidence: true,
  });
  const htmlOut = s.HublyTaste.cardHtml(card);
  assert.match(htmlOut, /Recommended/);
  assert.match(htmlOut, /Why/);
  assert.match(htmlOut, /Tradeoffs/);
  assert.match(htmlOut, /Compare/);
  assert.match(htmlOut, /Minimal/);
});

test("Consultant uses Taste for commerce recommendations", () => {
  const s = load();
  const C = s.HublyConsultant;
  C.think("I want to build a candle company.");
  C.think("Both — online and local markets");
  const t2 = C.think("Mostly gifts");
  assert.ok(t2.recommendation);
  assert.ok(t2.recommendation.why || t2.recommendation.reasoning);
  assert.ok(t2.recommendation.tradeoffs);
  assert.match(t2.replies.map((r) => r.text).join(" "), /recommend/i);
});

test("hubly.html loads Taste before Consultant", () => {
  assert.match(html, /hubly-taste\.js\?v=taste-2/);
  assert.match(html, /hubly-consultant\.js\?v=consultant-4/);
  assert.match(html, /ai-workspace\.js\?v=aw-7/);
  const tasteIdx = html.indexOf("hubly-taste.js");
  const consIdx = html.indexOf("hubly-consultant.js");
  assert.ok(tasteIdx > -1 && consIdx > tasteIdx);
});

test("workspace renders Taste cards and compare hooks", () => {
  assert.match(awJs, /HublyTaste\.cardHtml/);
  assert.match(awJs, /data-aw-compare/);
  assert.match(awJs, /rememberChoice/);
  assert.match(awCss, /aw-taste-card/);
  assert.match(awJs, /version: '1\.6\.0'/);
});
