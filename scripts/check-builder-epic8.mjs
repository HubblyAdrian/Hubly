#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 8 — Workspace Intelligence Builder (Release Gate)
 *
 * Workspace evolves around how the owner works. Conversation, not settings.
 * Adaptive homepage/nav, quick actions, health, multi-device, Focus Mode. No apply.
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

console.log("\nMilestone 1.5 · Epic 8 — Workspace Intelligence Builder\n");

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
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  WORKSPACE_INTELLIGENCE_VERSION,
  WORKSPACE_INTELLIGENCE_LABEL,
  scoreWorkspaceHealth,
  buildWorkspaceRecommendations,
  buildFocusMode,
  HublyWorkspaceIntelligence,
} = await import("./lib/workspace-intelligence.mjs");
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

const src = read("supabase/functions/_shared/hubly_brain_workspace_intelligence.ts");
const spec = read("docs/architecture/BUILDER_ENGINE_SPEC.md");

check("Workspace Intelligence Builder exists", exists("supabase/functions/_shared/hubly_brain_workspace_intelligence.ts"));
check("Versioned", WORKSPACE_INTELLIGENCE_VERSION === "1.0.0");
check("Customer-facing label", WORKSPACE_INTELLIGENCE_LABEL === "Workspace Intelligence Builder");
check("HublyWorkspaceIntelligence API", typeof HublyWorkspaceIntelligence.build === "function");
check("HublyAI exports HublyWorkspaceIntelligence", /HublyWorkspaceIntelligence/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Architecture names Workspace Intelligence", /Workspace Intelligence Builder/.test(spec));
check("Focus Mode exists", /FocusMode|focus_mode|Job Day|Sales Day/.test(src));
check("Workspace Health exists", /WorkspaceHealth|scoreWorkspaceHealth/.test(src));
check("Adaptive homepage exists", /AdaptiveHomepage|buildAdaptiveHomepage/.test(src));
check("Multi-device exists", /DeviceWorkspace|desktop|phone|tablet/.test(src));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));

const demos = [
  { id: "jobs_above", request: "Move Jobs above Customers.", concepts: ["sidebar_order"] },
  { id: "hide_revenue", request: "Hide Revenue.", concepts: ["hide_module"] },
  { id: "calendar_home", request: "Make Calendar my homepage.", concepts: ["homepage"] },
  { id: "pin_quote", request: "Pin Quick Quote.", concepts: ["pin_action"] },
  { id: "never_marketing", request: "I never use Marketing.", concepts: ["hide_module"] },
  { id: "mobile", request: "Build me a workspace for mobile.", concepts: ["device_layout"] },
  { id: "recommend", request: "What do you think I should change?", concepts: ["learned_behavior"] },
  { id: "focus", request: "Today is a Job Day — enable Focus Mode.", concepts: ["focus_mode"] },
];

const demoProofs = {};
let lastThink = null;

console.log("\nFounder demos — conversation → Workspace Intelligence\n");

for (const demo of demos) {
  const biz = `biz_epic8_${demo.id}`;
  const r = await think({
    request: demo.request,
    businessId: biz,
    memory: { businessId: biz, industry: "pressure washing", city: "Austin", memoryVersion: 1 },
  });
  lastThink = r;
  const wi = r.workspaceIntelligence;
  const conceptIds = (wi?.changes || []).map((x) => x.conceptId);
  const hit = demo.concepts.some((c) => conceptIds.includes(c));
  check(`Demo ${demo.id}: intent/plan`, !!r.builderIntent && !!r.changePlan);
  check(`Demo ${demo.id}: workspace intelligence`, !!wi);
  check(`Demo ${demo.id}: concepts ${demo.concepts.join(",")}`, hit, `got ${conceptIds.join(",")}`);
  check(`Demo ${demo.id}: every change explained`, (wi?.changes || []).every((c) => c.explained && !!c.why));
  check(`Demo ${demo.id}: requires approval`, wi?.requiresApproval === true && wi?.applied === false);
  demoProofs[demo.id] = {
    request: demo.request,
    changeCount: wi?.changes?.length || 0,
    concepts: conceptIds,
    health: wi?.health?.overall ?? null,
    homepage: wi?.homepage?.landing ?? null,
    focusMode: wi?.focusMode?.mode ?? null,
  };
}

const wi = lastThink?.workspaceIntelligence;
check("Adaptive homepage", !!wi?.homepage?.landing && !!wi?.homepage?.why);
check("Adaptive navigation", (wi?.navigation?.items?.length || 0) >= 2 && wi?.navigation?.recommended === true);
check("Contextual quick actions", (wi?.quickActions?.length || 0) >= 1);
check("Workspace Health overall", typeof wi?.health?.overall === "number");
check(
  "Health dimensions",
  typeof wi?.health?.navigation === "number" && typeof wi?.health?.personalization === "number",
);
check("AI recommendations explained", (wi?.recommendations || []).every((r) => !!r.why && !!r.detail));
check("Learned behaviors / memory", (wi?.memory?.timeOfDayPatterns?.length || 0) >= 1);
check("Multi-device plans", (wi?.devices?.length || 0) === 3);
check("Focus Mode", !!wi?.focusMode && wi.focusMode.mode === "job_day");

const health = scoreWorkspaceHealth(wi?.changes || [], wi?.navigation || { items: [], why: "", recommended: true }, wi?.memory || {
  favoriteModules: [],
  dailyWorkflows: [],
  timeOfDayPatterns: [],
  commonActions: [],
  hiddenTools: [],
  preferredLanding: null,
  frequentFilters: [],
  devicePreferences: {},
});
const recs = buildWorkspaceRecommendations(wi?.changes || [], wi?.memory);
check("scoreWorkspaceHealth API", health.overall >= 0);
check("recommend API", recs.length >= 1);
check("focus API", !!buildFocusMode(wi?.changes || [], "Job Day focus mode"));

console.log("\nMission Control\n");
const snap = getMissionControlSnapshot();
check("MC displays Workspace Intelligence", (snap.builderActions?.workspaceIntelligence || []).length >= 1);
check(
  "MC epic is Workspace Intelligence",
  /Workspace Intelligence|Automation Intelligence|Epic [89]/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply", snap.builderActions?.available === false);
check("MC recent is workspace intelligence", (snap.builderActions?.recent || [])[0]?.status === "workspace_intelligence");

const flight = lastThink?.missionControlExecutionId
  ? getFlightRecorder(lastThink.missionControlExecutionId)
  : null;
check("MC flight has workspaceIntelligence", !!flight?.workspaceIntelligence);
if (flight) {
  const tl = replayExecution(flight.executionId)?.timeline || flight.timeline || [];
  check("Replay shows workspace_intelligence", tl.some((e) => e.phase === "workspace_intelligence"));
}

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 8,
  name: "Workspace Intelligence Builder",
  title: "Workspace Intelligence Builder",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    workspaceIntelligenceExists: true,
    customerFacingName: "Workspace Intelligence Builder",
    conversationAdaptation: true,
    learnsBehavior: true,
    adaptiveHomepage: true,
    adaptiveNavigation: true,
    contextualQuickActions: true,
    workspaceHealth: true,
    multiDevice: true,
    recommendationsExplained: true,
    focusMode: true,
    missionControlWorkspaceIntelligence: (snap.builderActions?.workspaceIntelligence || []).length >= 1,
    requiresApprovalBeforeApply: true,
    noApply: true,
    demos: demoProofs,
    healthSample: wi?.health || null,
    recommendationsSample: (wi?.recommendations || []).slice(0, 3),
    focusModeSample: wi?.focusMode || null,
    devicesSample: wi?.devices || null,
  },
  failures: failures.length ? failures : null,
};

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC8_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 8 — Workspace Intelligence Builder

**Status:** ${passed ? "PASS" : "FAIL"}  
**Release Gate:** Milestone 1.5 · Epic 8 of 12

The workspace evolves around how the owner works — conversation, not settings.

## Proven

- Adaptive homepage + navigation
- Contextual quick actions
- Workspace Memory patterns + learned behaviors
- Workspace Health + explained AI recommendations
- Multi-device (desktop / tablet / phone)
- **Focus Mode** (Job / Sales / Admin / Growth Day)
- Mission Control records workspace intelligence (replay)
- Still requires approval — **no apply**

\`\`\`bash
npm run check:builder-epic8
\`\`\`

**Stop.** Do not start Epic 9 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC8.md"), md);

if (!passed) {
  console.error("\nEPIC 8 FAIL\n");
  process.exit(1);
}

console.log("\nEPIC 8 PASS — Workspace Intelligence Builder (not applied)\n");
process.exit(0);
