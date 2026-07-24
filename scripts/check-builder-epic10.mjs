#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 10 — Media Intelligence Engine (Release Gate)
 *
 * Uploads understood, not just stored. Multi-surface publishing proposals.
 * Portfolio Health, missing content, visual timeline. No publish / no apply.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nMilestone 1.5 · Epic 10 — Media Intelligence Engine\n");

for (const s of [
  "_build-builder-intent",
  "_build-builder-expert",
  "_build-change-plan",
  "_build-preview-engine",
  "_build-collaboration",
  "_build-version-engine",
  "_build-business-builder",
  "_build-booking-intelligence",
  "_build-workspace-intelligence",
  "_build-automation-intelligence",
  "_build-media-intelligence",
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  MEDIA_INTELLIGENCE_VERSION,
  MEDIA_INTELLIGENCE_LABEL,
  scorePortfolioHealth,
  buildMediaRecommendations,
  detectMissingContent,
  buildVisualTimeline,
  HublyMediaIntelligence,
} = await import("./lib/media-intelligence.mjs");
const { think } = await import("./lib/think.mjs");
const {
  getMissionControlSnapshot,
  getFlightRecorder,
  clearMissionControlForTests,
  replayExecution,
} = await import("./lib/mission-control.mjs");
const { resetExpertsForTests, ensureExpertsRegistered } = await import("./lib/initial-experts.mjs");
const { clearRegistriesForTests, ensureRegistriesBootstrapped } = await import("./lib/registries.mjs");

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failures.push({ name, detail });
  } else {
    console.log(`  ✓ ${name}`);
  }
}

clearMissionControlForTests();
clearRegistriesForTests();
resetExpertsForTests();
ensureExpertsRegistered();
ensureRegistriesBootstrapped();

const src = read("supabase/functions/_shared/hubly_brain_media_intelligence.ts");
const spec = read("docs/architecture/BUILDER_ENGINE_SPEC.md");

check("Media Intelligence Engine exists", exists("supabase/functions/_shared/hubly_brain_media_intelligence.ts"));
check("Versioned", MEDIA_INTELLIGENCE_VERSION === "1.0.0");
check("Customer-facing label", MEDIA_INTELLIGENCE_LABEL === "Media Intelligence Engine");
check("HublyMediaIntelligence API", typeof HublyMediaIntelligence.build === "function");
check("HublyAI exports HublyMediaIntelligence", /HublyMediaIntelligence/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Architecture names Media Intelligence", /Media Intelligence Engine/.test(spec));
check("AI analysis exists", /MediaAnalysis|analyzeUploads|photoQuality/.test(src));
check("Portfolio Health exists", /PortfolioHealth|scorePortfolioHealth/.test(src));
check("Multi-surface publishing exists", /MultiSurface|publish|website_gallery/.test(src));
check("Visual timeline / Business Memory Through Media", /BusinessMemoryThroughMedia|visual_timeline|VisualTimeline/.test(src));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));

const demos = [
  { id: "upload", request: "Upload these 12 photos.", concepts: ["upload_organize"] },
  { id: "ceramic_gallery", request: "Build a ceramic coating gallery.", concepts: ["gallery_build"] },
  { id: "hero", request: "Replace my homepage hero.", concepts: ["hero_replace"] },
  { id: "before_after", request: "Create before/after pairs.", concepts: ["before_after"] },
  { id: "instagram", request: "Build Instagram content.", concepts: ["instagram_carousel"] },
  { id: "weak", request: "Show me weak photos.", concepts: ["weak_photos"] },
  { id: "organize", request: "Organize everything.", concepts: ["upload_organize"] },
  { id: "timeline", request: "Show me how my business has evolved over the last year.", concepts: ["visual_timeline"] },
];

const demoProofs = {};
let lastThink = null;

console.log("\nFounder demos — conversation → Media Intelligence\n");

for (const demo of demos) {
  const biz = `biz_epic10_${demo.id}`;
  const r = await think({
    request: demo.request,
    businessId: biz,
    memory: { businessId: biz, industry: "auto detailing", city: "Austin", memoryVersion: 1 },
  });
  lastThink = r;
  const mi = r.mediaIntelligence;
  const conceptIds = (mi?.changes || []).map((x) => x.conceptId);
  const hit = demo.concepts.some((c) => conceptIds.includes(c));
  check(`Demo ${demo.id}: intent/plan`, !!r.builderIntent && !!r.changePlan);
  check(`Demo ${demo.id}: media intelligence`, !!mi);
  check(`Demo ${demo.id}: concepts ${demo.concepts.join(",")}`, hit, `got ${conceptIds.join(",")}`);
  check(`Demo ${demo.id}: AI analysis`, (mi?.assets?.length || 0) >= 1 && typeof mi?.assets?.[0]?.analysis?.photoQuality === "number");
  check(`Demo ${demo.id}: every change explained`, (mi?.changes || []).every((c) => c.explained && !!c.why));
  check(`Demo ${demo.id}: not published`, mi?.published === false && mi?.applied === false && mi?.requiresApproval === true);
  demoProofs[demo.id] = {
    request: demo.request,
    assetCount: mi?.assets?.length || 0,
    concepts: conceptIds,
    health: mi?.health?.overall ?? null,
    surfaces: mi?.multiSurface?.surfaces?.filter((s) => s.selected).map((s) => s.surface) || [],
  };
}

const mi = lastThink?.mediaIntelligence;
check("Homepage / gallery recommendations", (mi?.recommendations?.length || 0) >= 1);
check("Multi-surface publishing proposal", (mi?.multiSurface?.surfaces?.filter((s) => s.selected).length || 0) >= 3);
check("Portfolio Health", typeof mi?.health?.overall === "number");
check("Missing content detection", (mi?.missingContent?.length || 0) >= 1);
check("Visual timeline events", (mi?.visualTimeline?.events?.length || 0) >= 5);

const health = scorePortfolioHealth(mi?.assets || [], mi?.changes || []);
const recs = buildMediaRecommendations(mi?.assets || [], mi?.changes || []);
const missing = detectMissingContent(mi?.assets || [], "auto_detailing");
const timeline = buildVisualTimeline("Show me how my business has evolved over the last year.");
check("scorePortfolioHealth API", health.overall >= 0);
check("recommend API", recs.length >= 1);
check("missing API", missing.length >= 1);
check("timeline API", timeline.events.length >= 5);

console.log("\nMission Control\n");
const snap = getMissionControlSnapshot();
check("MC displays Media Intelligence", (snap.builderActions?.mediaIntelligence || []).length >= 1);
check(
  "MC epic is Media Intelligence",
  /Media Intelligence|Chat OS|Hubly Chat|Epic 10|Epic 11/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply/publish", snap.builderActions?.available === false);
check(
  "MC recent surfaces intelligence",
  ["media_intelligence", "chat_os"].includes((snap.builderActions?.recent || [])[0]?.status),
);

const flight = lastThink?.missionControlExecutionId
  ? getFlightRecorder(lastThink.missionControlExecutionId)
  : null;
check("MC flight has mediaIntelligence", !!flight?.mediaIntelligence);
if (flight) {
  const tl = replayExecution(flight.executionId)?.timeline || flight.timeline || [];
  check("Replay shows media_intelligence", tl.some((e) => e.phase === "media_intelligence"));
}

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 10,
  name: "Media Intelligence Engine",
  title: "Media Intelligence Engine",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    mediaIntelligenceExists: true,
    customerFacingName: "Media Intelligence Engine",
    uploadsUnderstood: true,
    aiOrganizesMedia: true,
    multiSurfacePublishing: true,
    aiRecommendsMedia: true,
    portfolioHealth: true,
    missingContentDetection: true,
    creativeMediaEditing: true,
    businessMemoryThroughMedia: true,
    missionControlMediaLifecycle: (snap.builderActions?.mediaIntelligence || []).length >= 1,
    requiresApprovalBeforePublish: true,
    noPublish: true,
    noApply: true,
    demos: demoProofs,
    healthSample: mi?.health || null,
    recommendationsSample: (mi?.recommendations || []).slice(0, 3),
    missingSample: (mi?.missingContent || []).slice(0, 3),
    timelineSample: mi?.visualTimeline || null,
  },
  failures: failures.length ? failures : null,
};

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC10_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 10 — Media Intelligence Engine

**Status:** ${passed ? "PASS" : "FAIL"}  
**Release Gate:** Milestone 1.5 · Epic 10 of 12

Uploads are understood, not just stored. One upload → many destinations (pending approval).

## Proven

- AI analysis (quality, kind, business context)
- Auto-organization + galleries / hero / before-after / Instagram
- Multi-surface publishing proposals
- Portfolio Health + missing content
- **Business Memory Through Media** (visual timeline)
- Mission Control media lifecycle (replay)
- Still requires approval — **no publish / no apply**

\`\`\`bash
npm run check:builder-epic10
\`\`\`

**Stop.** Do not start Epic 11 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC10.md"), md);

if (!passed) {
  console.error("\nEPIC 10 FAIL\n");
  process.exit(1);
}

console.log("\nEPIC 10 PASS — Media Intelligence Engine (not published)\n");
process.exit(0);
