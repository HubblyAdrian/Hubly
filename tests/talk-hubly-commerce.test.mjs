import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const landing = fs.readFileSync(path.join(root, "public/platform-home.html"), "utf8");
const html = fs.readFileSync(path.join(root, "public/hubly.html"), "utf8");
const consultantJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-consultant.js"), "utf8");
const runtimeJs = fs.readFileSync(path.join(root, "public/journey-os/commerce/runtime.js"), "utf8");
const typesJs = fs.readFileSync(path.join(root, "public/journey-os/commerce/types.js"), "utf8");
const storeJs = fs.readFileSync(path.join(root, "public/journey-os/store-commerce.js"), "utf8");
const genSite = fs.readFileSync(path.join(root, "supabase/functions/generate-site/index.ts"), "utf8");

test("landing sells Talk to Hubly with three starters", () => {
  assert.match(landing, /Talk to Hubly/);
  assert.match(landing, /What can I help you accomplish today\?/);
  assert.match(landing, /Build My Business/);
  assert.match(landing, /Grow My Business/);
  assert.match(landing, /Find Help/);
  assert.match(landing, /talk-starters/);
  assert.doesNotMatch(landing, /Continue Building/);
});

test("landing journeys lead to conversation outcomes", () => {
  assert.match(landing, /Talk once\./);
  assert.match(landing, /Get outcomes/);
  assert.match(landing, /Talk to Hubly →/);
  assert.match(landing, /Find Help →/);
});

test("HublyConsultant skips questionnaire when seed is rich", () => {
  const sandbox = {
    window: {},
    S: {},
    localStorage: { getItem() { return null; }, setItem() {} },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const tasteJs = fs.readFileSync(path.join(root, "public/journey-os/hubly-taste.js"), "utf8");
  vm.runInNewContext(tasteJs, sandbox);
  vm.runInNewContext(consultantJs, sandbox);
  const C = sandbox.HublyConsultant;
  assert.ok(C);
  assert.ok(sandbox.HublyTaste);
  assert.equal(C.version, "2.0.0");
  assert.deepEqual(C.pattern[0], "understand");
  assert.equal(typeof C.think, "function");
  assert.equal(
    C.shouldSkipQuestionnaire({
      seed: "I'm starting a pressure washing business in Dallas",
      facts: { industry: { value: "Pressure Washing", confidence: 92 } },
    }),
    true
  );
  assert.equal(
    C.shouldSkipQuestionnaire({ seed: "hi", facts: {} }),
    false
  );
  const rec = C.firstRecommendation({
    facts: {
      industry: { value: "Photography", confidence: 90 },
      goal: { value: "more_bookings", confidence: 88 },
    },
  });
  assert.ok(rec.confidence >= 80);
  assert.ok(String(rec.reasoning || rec.why || "").length > 20);
});

test("Commerce Runtime exposes shared capabilities", () => {
  const sandbox = { window: {}, S: {}, HublyCommerce: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(typesJs, sandbox);
  vm.runInNewContext(runtimeJs, sandbox);
  const R = sandbox.HublyCommerceRuntime;
  assert.ok(R);
  assert.equal(R.capabilities.products, true);
  assert.equal(R.capabilities.gift_cards, "architecture_ready");
  assert.equal(R.capabilities.digital_downloads, "architecture_ready");
  assert.equal(R.capabilities.print_sales, "architecture_ready");
  const htmlOut = R.workspaceHtml({ mode: "products" });
  assert.match(htmlOut, /Product editor/);
  assert.match(htmlOut, /Gift Cards/);
  assert.ok(sandbox.HublyCommerceTypes.PRODUCT_TYPES.includes("print"));
});

test("Store Operate UI surfaces Commerce capability tabs", () => {
  assert.match(storeJs, /\['services', 'Services'\]/);
  assert.match(storeJs, /\['categories', 'Categories'\]/);
  assert.match(storeJs, /\['gift_cards', 'Gift Cards'\]/);
  assert.match(storeJs, /Architecture ready/);
  assert.match(storeJs, /HublyCommerceRuntime/);
});

test("generate-site accepts inspiration uploads for OpenAI vision", () => {
  assert.match(genSite, /inspiration_image/);
  assert.match(genSite, /context_notes/);
  assert.match(genSite, /parseDataUrl/);
});

test("hubly.html wires consultant + commerce runtime + AI workspace", () => {
  assert.match(html, /hubly-consultant\.js\?v=consultant-3/);
  assert.match(html, /commerce\/runtime\.js\?v=commerce-2/);
  assert.match(html, /ai-workspace\.js\?v=aw-5/);
  assert.match(html, /hubly-taste\.js\?v=taste-1/);
  assert.match(html, /HublyConsultant\.shouldSkipQuestionnaire/);
  assert.match(html, /HublyConsultant\.buildFromContext/);
  assert.match(html, /HublyConsultant\.think/);
  assert.match(html, /MAX_CLARIFICATION_BEFORE_BUILD/);
});

test("architecture docs exist for consultant + commerce", () => {
  const consultant = fs.readFileSync(
    path.join(root, "docs/architecture/HUBLY_CONSULTANT_AI.md"),
    "utf8"
  );
  const commerce = fs.readFileSync(
    path.join(root, "docs/architecture/HUBLY_COMMERCE_CAPABILITY.md"),
    "utf8"
  );
  const landingDoc = fs.readFileSync(path.join(root, "docs/AI_LANDING_ARCHITECTURE.md"), "utf8");
  assert.match(consultant, /\*\*Understand\*\*/);
  assert.match(consultant, /\*\*Recommend\*\*/);
  assert.match(consultant, /\*\*Build\*\*/);
  assert.match(consultant, /\*\*Show\*\*/);
  assert.match(commerce, /presentation only/i);
  assert.match(landingDoc, /Talk to Hubly/);
  assert.match(landingDoc, /Stage 2/);
});
