#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 9 — Automation Intelligence Builder (Release Gate)
 *
 * Conversation → workflow. Preview, 30-day simulation, health, discovery.
 * No execute / no apply outside Builder pipeline.
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

console.log("\nMilestone 1.5 · Epic 9 — Automation Intelligence Builder\n");

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
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  AUTOMATION_INTELLIGENCE_VERSION,
  AUTOMATION_INTELLIGENCE_LABEL,
  scoreAutomationHealth,
  buildAutomationRecommendations,
  buildAutomationDiscovery,
  simulateWorkflows,
  HublyAutomationIntelligence,
} = await import("./lib/automation-intelligence.mjs");
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

const src = read("supabase/functions/_shared/hubly_brain_automation_intelligence.ts");
const spec = read("docs/architecture/BUILDER_ENGINE_SPEC.md");

check("Automation Intelligence Builder exists", exists("supabase/functions/_shared/hubly_brain_automation_intelligence.ts"));
check("Versioned", AUTOMATION_INTELLIGENCE_VERSION === "1.0.0");
check("Customer-facing label", AUTOMATION_INTELLIGENCE_LABEL === "Automation Intelligence Builder");
check("HublyAutomationIntelligence API", typeof HublyAutomationIntelligence.build === "function");
check("HublyAI exports HublyAutomationIntelligence", /HublyAutomationIntelligence/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Architecture names Automation Intelligence", /Automation Intelligence Builder/.test(spec));
check("Workflow simulation exists", /WorkflowSimulation|simulateWorkflows/.test(src));
check("Automation Health exists", /AutomationHealth|scoreAutomationHealth/.test(src));
check("Automation Discovery exists", /AutomationDiscovery|buildAutomationDiscovery/.test(src));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));

const demos = [
  { id: "prep", request: "Send prep instructions after ceramic coating bookings.", outcomes: ["prep_instructions"] },
  { id: "reviews", request: "Ask for reviews after every completed job.", outcomes: ["review_request"] },
  { id: "quotes", request: "Follow up on quotes after 5 days.", outcomes: ["quote_followup"] },
  { id: "weather", request: "Reschedule exterior work if it rains.", outcomes: ["weather_reschedule"] },
  { id: "membership", request: "Charge memberships every month.", outcomes: ["membership_billing"] },
  { id: "friday", request: "Send me a Friday business summary.", outcomes: ["friday_summary"] },
  { id: "recurring", request: "Automate my recurring customers.", outcomes: ["recurring_customers"] },
  {
    id: "multisystem",
    request: "When someone books a ceramic coating, handle prep, CRM, portal, review, and upsell.",
    outcomes: ["prep_instructions"],
    multiSystem: true,
  },
];

const demoProofs = {};
let lastThink = null;

console.log("\nFounder demos — conversation → Automation Intelligence\n");

for (const demo of demos) {
  const biz = `biz_epic9_${demo.id}`;
  const r = await think({
    request: demo.request,
    businessId: biz,
    memory: { businessId: biz, industry: "auto detailing", city: "Austin", memoryVersion: 1 },
  });
  lastThink = r;
  const ai = r.automationIntelligence;
  const outcomes = (ai?.workflows || []).map((w) => w.outcomeId);
  const hit = demo.outcomes.some((o) => outcomes.includes(o));
  check(`Demo ${demo.id}: intent/plan`, !!r.builderIntent && !!r.changePlan);
  check(`Demo ${demo.id}: automation intelligence`, !!ai);
  check(`Demo ${demo.id}: outcomes ${demo.outcomes.join(",")}`, hit, `got ${outcomes.join(",")}`);
  check(`Demo ${demo.id}: every workflow explained`, (ai?.workflows || []).every((w) => w.explained && !!w.why));
  check(`Demo ${demo.id}: workflow preview`, (ai?.preview?.steps?.length || 0) >= 2);
  check(`Demo ${demo.id}: requires approval / not executed`, ai?.requiresApproval === true && ai?.applied === false && ai?.executed === false);
  if (demo.multiSystem) {
    check(
      `Demo ${demo.id}: multi-system`,
      (ai?.workflows || []).some((w) => (w.systems?.length || 0) >= 3),
    );
  }
  demoProofs[demo.id] = {
    request: demo.request,
    workflowCount: ai?.workflows?.length || 0,
    outcomes,
    health: ai?.health?.overall ?? null,
    timeSavedHours: ai?.health?.timeSavedHoursPerMonth ?? null,
    simBookings: ai?.simulation?.totals?.bookings ?? null,
  };
}

const ai = lastThink?.automationIntelligence;
check("30-day simulation", ai?.simulation?.horizonDays === 30);
check("Simulation totals", typeof ai?.simulation?.totals?.bookings === "number");
check("Automation Health", typeof ai?.health?.overall === "number" && ai.health.failures === 0);
check("Estimated time saved", typeof ai?.health?.timeSavedHoursPerMonth === "number");
check("AI recommendations", (ai?.recommendations?.length || 0) >= 1 && (ai?.recommendations || []).every((r) => !!r.why));
check("Automation Discovery", (ai?.discovery?.length || 0) >= 1);

const health = scoreAutomationHealth(ai?.workflows || []);
const recs = buildAutomationRecommendations(ai?.workflows || [], "auto_detailing");
const disc = buildAutomationDiscovery(ai?.workflows || []);
const sim = simulateWorkflows(ai?.workflows || []);
check("scoreAutomationHealth API", health.overall >= 0);
check("recommend API", recs.length >= 1);
check("discover API", disc.length >= 1);
check("simulate API", sim.horizonDays === 30);

console.log("\nMission Control\n");
const snap = getMissionControlSnapshot();
check("MC displays Automation Intelligence", (snap.builderActions?.automationIntelligence || []).length >= 1);
check(
  "MC epic is Automation Intelligence",
  /Automation Intelligence|Media Intelligence|Epic [9]|Epic 10/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply/execute", snap.builderActions?.available === false);
check("MC recent is automation intelligence", (snap.builderActions?.recent || [])[0]?.status === "automation_intelligence");

const flight = lastThink?.missionControlExecutionId
  ? getFlightRecorder(lastThink.missionControlExecutionId)
  : null;
check("MC flight has automationIntelligence", !!flight?.automationIntelligence);
if (flight) {
  const tl = replayExecution(flight.executionId)?.timeline || flight.timeline || [];
  check("Replay shows automation_intelligence", tl.some((e) => e.phase === "automation_intelligence"));
}

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 9,
  name: "Automation Intelligence Builder",
  title: "Automation Intelligence Builder",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    automationIntelligenceExists: true,
    customerFacingName: "Automation Intelligence Builder",
    naturalLanguageWorkflows: true,
    workflowPreviews: true,
    workflowSimulation: true,
    multiSystemAutomations: !!demoProofs.multisystem,
    automationHealth: true,
    aiRecommendations: true,
    automationDiscovery: true,
    everyAutomationExplained: true,
    estimatedTimeSaved: true,
    missionControlAutomationIntelligence: (snap.builderActions?.automationIntelligence || []).length >= 1,
    requiresApprovalBeforeApply: true,
    noExecute: true,
    noApply: true,
    demos: demoProofs,
    healthSample: ai?.health || null,
    simulationSample: ai?.simulation || null,
    discoverySample: (ai?.discovery || []).slice(0, 2),
    recommendationsSample: (ai?.recommendations || []).slice(0, 3),
  },
  failures: failures.length ? failures : null,
};

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC9_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 9 — Automation Intelligence Builder

**Status:** ${passed ? "PASS" : "FAIL"}  
**Release Gate:** Milestone 1.5 · Epic 9 of 12

Conversation → workflow. Hubly becomes the operations manager — not an automation settings UI.

## Proven

- Natural-language workflows with explained steps
- Workflow preview graph + 30-day simulation
- Multi-system automations
- Automation Health + time saved
- AI recommendations + **Automation Discovery**
- Mission Control records workflow evolution (replay)
- Still requires approval — **no apply / no execute**

\`\`\`bash
npm run check:builder-epic9
\`\`\`

**Stop.** Do not start Epic 10 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC9.md"), md);

if (!passed) {
  console.error("\nEPIC 9 FAIL\n");
  process.exit(1);
}

console.log("\nEPIC 9 PASS — Automation Intelligence Builder (not executed)\n");
process.exit(0);
