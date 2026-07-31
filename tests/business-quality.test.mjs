import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const bcJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-business-craftsmanship.js"), "utf8");
const wqJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-website-quality.js"), "utf8");
const tasteJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-taste.js"), "utf8");
const awJs = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.js"), "utf8");
const awCss = fs.readFileSync(path.join(root, "public/journey-os/ai-workspace.css"), "utf8");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");

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
  vm.runInNewContext(wqJs, sandbox);
  vm.runInNewContext(bcJs, sandbox);
  return sandbox;
}

test("Business Craftsmanship is the product name (Quality is alias)", () => {
  const s = load();
  assert.equal(s.HublyBusinessCraftsmanship.version, "2.0.0");
  assert.equal(s.HublyBusinessCraftsmanship.name, "Business Craftsmanship");
  assert.equal(s.HublyBusinessQuality, s.HublyBusinessCraftsmanship);
});

test("Business Story includes mission promise personality why different", () => {
  const s = load();
  const story = s.HublyBusinessCraftsmanship.discoverStory({
    industry: "Candles",
    businessName: "Glow Co",
    buyerIntent: "gift",
  });
  assert.ok(story.mission);
  assert.ok(story.promise);
  assert.ok(story.personality);
  assert.ok(story.whyCustomersChooseThem);
  assert.ok(story.whatMakesThemDifferent);
  assert.match(story.weaveNote, /storefront|emails|marketing/i);
});

test("Deeper Business Voice — not just Friendly/Luxury", () => {
  const s = load();
  const brand = s.HublyBusinessCraftsmanship.buildBrandSystem({
    industry: "Candles",
    buyerIntent: "gift",
  });
  assert.ok(
    ["Trusted Neighbor", "Craftsman", "Boutique", "Modern Expert", "Local Family Business", "Creative Studio", "Adventure Brand"]
      .includes(brand.voiceLabel)
  );
  assert.ok(brand.voiceTone.length > 20);
  assert.ok(brand.consistencyToken);
  assert.match(brand.inheritNote, /Consistency Engine|inherit/i);
});

test("Customer Journey Review critiques experience not just design", () => {
  const s = load();
  const journey = s.HublyBusinessCraftsmanship.journeyReview(
    { industry: "Candles" },
    { heroSub: "Taking shape…", cta: "Shop", ctaSecondary: "Call" }
  );
  assert.ok(journey.steps.length >= 4);
  assert.ok(journey.steps.some((st) => /understand/i.test(st.question)));
  assert.ok(journey.steps.some((st) => /trust/i.test(st.question)));
  assert.ok(journey.steps.some((st) => /buy|book/i.test(st.question)));
  assert.ok(journey.steps.some((st) => /afterward/i.test(st.question)));
  assert.ok(journey.weak.length >= 1);
});

test("Competitive Thinking is strategic consulting", () => {
  const s = load();
  const c = s.HublyBusinessCraftsmanship.competitiveThinking({ industry: "pressure washing" });
  assert.match(c.categoryDefault, /low prices/i);
  assert.match(c.recommendation, /quality and convenience/i);
  assert.equal(c.consulting, true);
});

test("Launch Confidence percent + what moves to 95%", () => {
  const s = load();
  const conf = s.HublyBusinessCraftsmanship.launchConfidence(
    { industry: "Candles", reviewCount: 0 },
    {
      heroSub: "Taking shape…",
      cta: "Shop",
      ctaSecondary: "Call",
      nav: ["A", "B", "C", "D", "E", "F", "Shop"],
      theme: "minimal",
    }
  );
  assert.ok(conf.percent >= 40 && conf.percent <= 99);
  assert.match(conf.label, /Launch Confidence/);
  assert.ok(conf.whatMovesTo95.length >= 1);
  assert.ok(conf.scores.journey != null);
});

test("Business Health leads with narrative not a score headline", () => {
  const s = load();
  const health = s.HublyBusinessCraftsmanship.assessHealth({
    reviewCount: 1,
    live: { heroTitle: "Glow", cta: "Shop", theme: "minimal" },
    brandSystem: s.HublyBusinessCraftsmanship.buildBrandSystem({ industry: "Candles" }),
    industry: "Candles",
  });
  assert.match(health.narrative, /trust|opportunity|healthy/i);
  const htmlOut = s.HublyBusinessCraftsmanship.healthHtml(health);
  assert.match(htmlOut, /bq-narrative/);
  assert.match(htmlOut, /See dimensions/);
  assert.doesNotMatch(htmlOut, /8\.2\/10/);
});

test("Pride Review + Golden Rule", () => {
  const s = load();
  const pride = s.HublyBusinessCraftsmanship.prideReview(
    { industry: "Candles" },
    { heroSub: "Clear offer", cta: "Shop", theme: "minimal", trustBadges: ["Guarantee"] }
  );
  assert.match(pride.question, /proud/i);
  assert.match(pride.ifHesitate, /even better/i);
  assert.ok(pride.goldenRule.questionAgency);
  assert.ok(pride.goldenRule.questionValue);
  assert.equal(pride.actions.map((a) => a.id).join(","), "proud,improve,compare");
});

test("Taste evolves traits — minimal fast simple bold storytelling", () => {
  const s = load();
  s.HublyTaste.rememberChoice("minimal", { style: "minimal", domain: "website" });
  s.HublyTaste.rememberChoice("simple", { domain: "website" });
  s.HublyTaste.rememberChoice("fast checkout", { domain: "commerce" });
  const traits = s.HublyTaste.preferredTraits();
  assert.ok(traits.some((t) => /minimal|simple|fast/.test(t)));
  assert.equal(s.HublyTaste.version, "1.2.0");
});

test("enrichExperience weaves story + competitive + confidence", () => {
  const s = load();
  const experience = {
    live: {
      heroTitle: "Glow Co",
      heroSub: "Local — built with care",
      cta: "Shop",
      ctaSecondary: "Call",
      theme: "minimal",
      nav: ["A", "B", "C", "D", "E", "F", "Shop"],
      chips: [],
    },
    industryKey: "maker",
    industryLabel: "Candles",
    chosenDirection: "minimal",
  };
  s.HublyBusinessCraftsmanship.enrichExperience(experience);
  assert.ok(experience.story.mission);
  assert.ok(experience.competitive.consulting);
  assert.ok(experience.confidence.percent);
  assert.ok(experience.journey.steps.length);
  assert.ok(experience.pride.question);
  assert.ok(experience.goldenRule);
  assert.notEqual(experience.live.heroSub, "Local — built with care");
});

test("hubly.html loads Craftsmanship module", () => {
  assert.match(html, /hubly-business-craftsmanship\.js\?v=bc-1/);
  assert.doesNotMatch(html, /hubly-business-quality\.js/);
  assert.match(html, /Business Craftsmanship|Launch Confidence|proud to put your name/i);
  assert.match(awJs, /HublyBusinessCraftsmanship|Craftsmanship next/);
  assert.match(awCss, /Business Craftsmanship/);
});
