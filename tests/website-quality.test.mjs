import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const qualityJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-website-quality.js"), "utf8");
const tasteJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-taste.js"), "utf8");
const consultantJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-consultant.js"), "utf8");
const awJs = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.js"), "utf8");
const awCss = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.css"), "utf8");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

function loadQuality() {
  const sandbox = { window: {}, S: {}, globalThis: null };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(qualityJs, sandbox);
  return sandbox;
}

function loadTaste() {
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

test("HublyWebsiteQuality scores launch dimensions", () => {
  const s = loadQuality();
  const Q = s.HublyWebsiteQuality;
  assert.equal(Q.version, "1.0.0");
  const report = Q.score({
    theme: "minimal",
    cta: "Book",
    ctaSecondary: "Call",
    nav: ["Services", "About", "Gallery", "Blog", "FAQ", "Contact", "Book"],
    heroSub: "Local — built with care",
  });
  assert.ok(report.scores.design);
  assert.ok(report.scores.trust);
  assert.ok(report.scores.mobile);
  assert.ok(report.scores.conversion);
  assert.ok(report.scores.brand);
  assert.ok(report.scores.speed);
  assert.ok(report.findings.length >= 1);
  assert.ok(report.weakest);
});

test("Self Review offers Improve Ignore Compare", () => {
  const s = loadQuality();
  const review = s.HublyWebsiteQuality.selfReview({
    theme: "minimal",
    ctaSecondary: "Shop",
    nav: ["A", "B", "C", "D", "E", "F", "Book"],
    heroSub: "Taking shape…",
  });
  assert.match(review.message, /Before we move on/i);
  assert.equal(review.actions.map((a) => a.id).join(","), "improve,ignore,compare");
  const htmlOut = s.HublyWebsiteQuality.reviewHtml(review);
  assert.match(htmlOut, /Self Review/);
  assert.match(htmlOut, /data-wq-act="improve"/);
  assert.match(htmlOut, /Trust|Conversion|Design/);
});

test("Improve raises trust after trust_strip", () => {
  const s = loadQuality();
  const live = {
    theme: "minimal",
    heroTitle: "Sparkle Co",
    heroSub: "Taking shape…",
    cta: "Shop",
    ctaSecondary: "Call",
    nav: ["Services", "About", "Gallery", "Blog", "FAQ", "Contact", "Book"],
  };
  const before = s.HublyWebsiteQuality.score(live);
  s.HublyWebsiteQuality.applyImprovement(live, "trust_strip", { biz: "Sparkle Co" });
  s.HublyWebsiteQuality.applyImprovement(live, "one_cta", { biz: "Sparkle Co" });
  const after = s.HublyWebsiteQuality.score(live);
  assert.ok(after.scores.trust > before.scores.trust);
  assert.ok(after.scores.conversion >= before.scores.conversion);
  assert.ok(live.reviews && live.reviews.length);
  assert.ok(!live.ctaSecondary);
});

test("siteHtml renders premium hierarchy", () => {
  const s = loadQuality();
  const htmlOut = s.HublyWebsiteQuality.siteHtml({
    heroTitle: "Rinse Co",
    heroSub: "Clear offer. Real proof.",
    cta: "Get a quote",
    theme: "minimal",
    packages: [{ name: "Essentials", sub: "Start" }],
    trustBadges: ["Licensed"],
    reviews: [{ quote: "Incredible.", who: "Sam" }],
  }, { biz: "Rinse Co" });
  assert.match(htmlOut, /data-wq-site/);
  assert.match(htmlOut, /Get a quote/);
  assert.match(htmlOut, /Licensed/);
  assert.match(htmlOut, /Incredible/);
});

test("Taste asks gift vs self for handmade jewelry instead of fake certainty", () => {
  const s = loadTaste();
  const card = s.HublyTaste.forCommerce({
    text: "I sell handmade jewelry.",
    business: { offer: "product", industry: "Retail", channels: "both" },
  });
  assert.equal(card.ok, false);
  assert.equal(card.needClarify, true);
  assert.match(card.ask, /gifts|themselves/i);
});

test("Consultant jewelry flow clarifies before recommending", () => {
  const s = loadTaste();
  const C = s.HublyConsultant;
  C.think("I sell handmade jewelry.");
  const mid = C.think("Both — online and local markets");
  assert.ok(mid.replies.map((r) => r.text).join(" ").match(/gifts|themselves|enough information/i));
  const done = C.think("Mostly gifts");
  assert.ok(done.recommendation);
  assert.equal(done.recommendation.ok !== false, true);
  assert.ok(done.recommendation.why || done.recommendation.reasoning);
  assert.match(done.replies.map((r) => r.text).join(" "), /recommend/i);
});

test("hubly.html loads Website Quality between Taste and Consultant", () => {
  assert.match(html, /hubly-website-quality\.js\?v=wq-1/);
  assert.match(html, /hubly-taste\.js\?v=taste-2/);
  const tasteIdx = html.indexOf("hubly-taste.js");
  const wqIdx = html.indexOf("hubly-website-quality.js");
  const consIdx = html.indexOf("hubly-consultant.js");
  assert.ok(tasteIdx > -1 && wqIdx > tasteIdx && consIdx > wqIdx);
  assert.match(html, /HublyWebsiteQuality/);
  assert.match(html, /Self Review/);
});

test("workspace wires Self Review loop", () => {
  assert.match(awJs, /HublyWebsiteQuality/);
  assert.match(awJs, /runSelfReview/);
  assert.match(awJs, /handleQualityAction/);
  assert.match(awJs, /version: '1\.5\.0'/);
  assert.match(awCss, /\.wq-review/);
  assert.match(awCss, /\.wq-site/);
});
