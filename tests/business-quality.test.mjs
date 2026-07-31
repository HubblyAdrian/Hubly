import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const bqJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-business-quality.js"), "utf8");
const wqJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-website-quality.js"), "utf8");
const awJs = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.js"), "utf8");
const awCss = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.css"), "utf8");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

function load() {
  const sandbox = { window: {}, S: {}, globalThis: null };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(wqJs, sandbox);
  vm.runInNewContext(bqJs, sandbox);
  return sandbox;
}

test("HublyBusinessQuality exposes Brand System and Health", () => {
  const s = load();
  const B = s.HublyBusinessQuality;
  assert.equal(B.version, "1.0.0");
  assert.equal(typeof B.buildBrandSystem, "function");
  assert.equal(typeof B.sectionPlan, "function");
  assert.equal(typeof B.reviewCopy, "function");
  assert.equal(typeof B.imageDirection, "function");
  assert.equal(typeof B.trustPlan, "function");
  assert.equal(typeof B.launchReview, "function");
  assert.equal(typeof B.assessHealth, "function");
});

test("Candle company gets maker Brand System + story-first sections", () => {
  const s = load();
  const brand = s.HublyBusinessQuality.buildBrandSystem({
    industry: "Candles",
    businessName: "Glow Co",
    direction: "minimal",
    buyerIntent: "gift",
  });
  assert.equal(brand.model, "commerce");
  assert.ok(brand.personality);
  assert.ok(brand.voice.length > 20);
  assert.ok(brand.photographyDirection);
  assert.ok(brand.buttonStyle);
  assert.ok(brand.motionStyle);

  const plan = s.HublyBusinessQuality.sectionPlan({ industry: "Candles" });
  assert.equal(plan.sections[0].id, "hero");
  assert.ok(plan.sections.some((sec) => sec.id === "story" || sec.id === "products"));
  assert.match(plan.rationale, /say first/i);
});

test("Copy review rewrites generic AI filler", () => {
  const s = load();
  const out = s.HublyBusinessQuality.reviewCopy({
    heroSub: "Local — built with care",
    about: "We are passionate about quality service and synergy.",
    cta: "Learn more",
  }, { industry: "Candles" });
  assert.ok(out.changedCount >= 1);
  assert.match(out.message, /reviewed the copy/i);
  const live = { heroSub: "Local — built with care", about: "We are passionate about quality service and synergy." };
  out.apply(live);
  assert.notEqual(live.heroSub, "Local — built with care");
});

test("Image direction coaches lifestyle photo for makers", () => {
  const s = load();
  const img = s.HublyBusinessQuality.imageDirection({ industry: "handmade jewelry" }, {});
  assert.match(img.message, /lifestyle|photo|image/i);
  assert.equal(img.coach, true);
});

test("Business Health is honest about one review", () => {
  const s = load();
  const health = s.HublyBusinessQuality.assessHealth({
    reviewCount: 1,
    live: {
      heroTitle: "Glow",
      heroSub: "Nice candles",
      cta: "Shop",
      theme: "minimal",
      brandSystem: s.HublyBusinessQuality.buildBrandSystem({ industry: "Candles" }),
    },
    brandSystem: s.HublyBusinessQuality.buildBrandSystem({ industry: "Candles" }),
    industry: "Candles",
  });
  assert.ok(health.overall);
  assert.match(health.narrative, /trust|review/i);
  assert.ok(health.recommendations.length >= 1);
  assert.match(s.HublyBusinessQuality.healthHtml(health), /Business Health/);
});

test("Launch Review lists improvements before go-live", () => {
  const s = load();
  const review = s.HublyBusinessQuality.launchReview(
    { industry: "Candles", reviewCount: 0 },
    {
      heroTitle: "Glow",
      heroSub: "Taking shape…",
      cta: "Shop",
      ctaSecondary: "Call",
      nav: ["A", "B", "C", "D", "E", "F", "Shop"],
      theme: "minimal",
    }
  );
  assert.match(review.message, /reviewed everything/i);
  assert.ok(review.improvements.length >= 2);
  assert.equal(review.actions.map((a) => a.id).join(","), "improve,ignore,compare");
  assert.match(s.HublyBusinessQuality.launchReviewHtml(review), /Launch Review/);
});

test("enrichExperience applies Brand System + trust defaults", () => {
  const s = load();
  const experience = {
    live: {
      heroTitle: "Rinse Co",
      heroSub: "Local — built with care",
      cta: "Book",
      ctaSecondary: "Call now",
      theme: "minimal",
      nav: ["Services", "About", "Gallery", "Blog", "FAQ", "Contact", "Book"],
      chips: [],
    },
    industryKey: "pressure_washing",
    industryLabel: "Pressure Washing",
    chosenDirection: "minimal",
  };
  s.HublyBusinessQuality.enrichExperience(experience);
  assert.ok(experience.brandSystem);
  assert.ok(experience.sectionPlan);
  assert.ok(experience.health);
  assert.notEqual(experience.live.heroSub, "Local — built with care");
  assert.ok(experience.live.trustBadges && experience.live.trustBadges.length);
});

test("hubly.html loads Business Quality after Website Quality", () => {
  assert.match(html, /hubly-business-quality\.js\?v=bq-1/);
  const wq = html.indexOf("hubly-website-quality.js");
  const bq = html.indexOf("hubly-business-quality.js");
  const aw = html.indexOf("ai-workspace.js");
  assert.ok(wq > -1 && bq > wq && aw > bq);
  assert.match(html, /HublyBusinessQuality/);
  assert.match(html, /Launch Review|Brand System|Business Quality/);
  assert.match(html, /ai-workspace\.js\?v=aw-7/);
});

test("workspace wires Business Health + Brand System", () => {
  assert.match(awJs, /HublyBusinessQuality/);
  assert.match(awJs, /enrichExperience/);
  assert.match(awJs, /assessHealth/);
  assert.match(awJs, /version: '1\.6\.0'/);
  assert.match(awCss, /\.bq-health/);
  assert.match(awCss, /\.bq-brand/);
});
