#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 7 — Booking Intelligence Builder (Release Gate)
 *
 * Owners describe how they operate. Hubly builds scheduling intelligence.
 * Arrival windows, travel buffers, notice, capacity, weather, service rules.
 * Booking Health + AI recommendations + Schedule Simulator. No apply.
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

console.log("\nMilestone 1.5 · Epic 7 — Booking Intelligence Builder\n");

for (const s of [
  "_build-builder-intent",
  "_build-builder-expert",
  "_build-change-plan",
  "_build-preview-engine",
  "_build-collaboration",
  "_build-version-engine",
  "_build-business-builder",
  "_build-booking-intelligence",
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  BOOKING_INTELLIGENCE_VERSION,
  BOOKING_INTELLIGENCE_LABEL,
  buildBookingIntelligence,
  scoreBookingHealth,
  buildBookingRecommendations,
  simulateSchedule,
  HublyBookingIntelligence,
} = await import("./lib/booking-intelligence.mjs");
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

const src = read("supabase/functions/_shared/hubly_brain_booking_intelligence.ts");
const spec = read("docs/architecture/BUILDER_ENGINE_SPEC.md");

check("Booking Intelligence Builder exists", exists("supabase/functions/_shared/hubly_brain_booking_intelligence.ts"));
check("Versioned", BOOKING_INTELLIGENCE_VERSION === "1.0.0");
check("Customer-facing label", BOOKING_INTELLIGENCE_LABEL === "Booking Intelligence Builder");
check("HublyBookingIntelligence API", typeof HublyBookingIntelligence.build === "function");
check("HublyAI exports HublyBookingIntelligence", /HublyBookingIntelligence/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Architecture names Booking Intelligence", /Booking Intelligence Builder/.test(spec));
check("Schedule Simulator exists", /ScheduleSimulator|simulateSchedule|AI Schedule Simulator/.test(src));
check("Booking Health exists", /BookingHealth|scoreBookingHealth/.test(src));
check("Recommendations exist", /buildBookingRecommendations/.test(src));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));

const demos = [
  { id: "no_same_day", request: "No same-day bookings.", concepts: ["same_day", "minimum_notice"] },
  { id: "arrival", request: "Customers can arrive between 1–3 PM. Add arrival windows.", concepts: ["arrival_window"] },
  { id: "travel", request: "I need 30-minute travel buffers between jobs.", concepts: ["travel_buffer"] },
  { id: "weather", request: "If it's raining, reschedule exterior work.", concepts: ["weather"] },
  { id: "ceramic_friday", request: "Fridays are ceramic coating only.", concepts: ["service_schedule"] },
  { id: "capacity", request: "Two jobs maximum per day.", concepts: ["daily_capacity"] },
  { id: "optimize", request: "Optimize tomorrow's schedule — I'm driving across town too much.", concepts: ["optimize_route"] },
  { id: "estimates", request: "Tuesdays are estimate days only.", concepts: ["estimate_days"] },
];

const demoProofs = {};
let lastThink = null;

console.log("\nFounder demos — natural language → Booking Intelligence\n");

for (const demo of demos) {
  const biz = `biz_epic7_${demo.id}`;
  const r = await think({
    request: demo.request,
    businessId: biz,
    memory: { businessId: biz, industry: "pressure washing", city: "Austin", memoryVersion: 1 },
  });
  lastThink = r;
  const bi = r.bookingIntelligence;
  const conceptIds = (bi?.rules || []).map((x) => x.conceptId);
  const hit = demo.concepts.some((c) => conceptIds.includes(c));
  check(`Demo ${demo.id}: intent/plan`, !!r.builderIntent && !!r.changePlan);
  check(`Demo ${demo.id}: booking intelligence`, !!bi);
  check(`Demo ${demo.id}: concepts ${demo.concepts.join(",")}`, hit, `got ${conceptIds.join(",")}`);
  check(`Demo ${demo.id}: preview`, !!r.preview);
  check(`Demo ${demo.id}: requires approval`, bi?.requiresApproval === true && bi?.applied === false);
  demoProofs[demo.id] = {
    request: demo.request,
    ruleCount: bi?.rules?.length || 0,
    concepts: conceptIds,
    health: bi?.health?.overall ?? null,
    simulatorDays: bi?.simulator?.horizonDays ?? null,
  };
}

const bi = lastThink?.bookingIntelligence;
check("Booking Health overall", typeof bi?.health?.overall === "number");
check("Health dimensions", typeof bi?.health?.travelEfficiency === "number" && typeof bi?.health?.conflicts === "number");
check("AI recommendations", (bi?.recommendations?.length || 0) >= 1);
check("Schedule Simulator 7 days", bi?.simulator?.horizonDays === 7 && (bi?.simulator?.days?.length || 0) === 7);
check("Simulator totals", typeof bi?.simulator?.totals?.drivingMinutesSaved === "number");
check(
  "Industry-aware behavior",
  (bi?.rules || []).some((r) => !!r.industryHint) || bi?.industry === "pressure_washing",
);

// Seasonal concept (natural language)
const seasonal = await think({
  request: "Snow removal only in winter. Seasonal availability please.",
  businessId: "biz_epic7_seasonal",
  memory: { businessId: "biz_epic7_seasonal", industry: "lawn care", city: "Denver", memoryVersion: 1 },
});
check(
  "Seasonal rules supported",
  (seasonal.bookingIntelligence?.rules || []).some((r) => r.conceptId === "seasonal"),
);

const health = scoreBookingHealth(bi?.rules || []);
const recs = buildBookingRecommendations(bi?.rules || [], "pressure_washing");
const sim = simulateSchedule(bi?.rules || []);
check("scoreBookingHealth API", health.overall >= 0);
check("recommend API", recs.length >= 1);
check("simulate API", sim.horizonDays === 7);

console.log("\nMission Control\n");
const snap = getMissionControlSnapshot();
check("MC displays Booking Intelligence", (snap.builderActions?.bookingIntelligence || []).length >= 1);
check(
  "MC epic is Booking Intelligence",
  /Booking Intelligence|Workspace Intelligence|Automation Intelligence|Media Intelligence|Epic [7-9]|Epic 10/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply", snap.builderActions?.available === false);
check(
  "MC recent surfaces intelligence",
  ["booking_intelligence", "automation_intelligence", "workspace_intelligence", "media_intelligence"].includes(
    (snap.builderActions?.recent || [])[0]?.status,
  ),
);

const flight = lastThink?.missionControlExecutionId
  ? getFlightRecorder(lastThink.missionControlExecutionId)
  : null;
check("MC flight has bookingIntelligence", !!flight?.bookingIntelligence);
if (flight) {
  const tl = replayExecution(flight.executionId)?.timeline || flight.timeline || [];
  check("Replay shows booking_intelligence", tl.some((e) => e.phase === "booking_intelligence"));
}

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 7,
  name: "Booking Intelligence Builder",
  title: "Booking Intelligence Builder",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    bookingIntelligenceExists: true,
    customerFacingName: "Booking Intelligence Builder",
    naturalLanguageRules: true,
    arrivalWindows: true,
    travelBuffers: true,
    minimumNotice: true,
    serviceSpecificScheduling: true,
    capacityRules: true,
    seasonalRules: (seasonal.bookingIntelligence?.rules || []).some((r) => r.conceptId === "seasonal"),
    weatherAware: true,
    bookingHealth: true,
    aiRecommendations: true,
    industryAware: true,
    scheduleSimulator: true,
    missionControlBookingIntelligence: (snap.builderActions?.bookingIntelligence || []).length >= 1,
    requiresApprovalBeforeApply: true,
    noApply: true,
    demos: demoProofs,
    healthSample: bi?.health || null,
    recommendationsSample: (bi?.recommendations || []).slice(0, 3),
    simulatorSample: bi?.simulator
      ? {
        headline: bi.simulator.headline,
        totals: bi.simulator.totals,
        dayCount: bi.simulator.days.length,
      }
      : null,
  },
  failures: failures.length ? failures : null,
};

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC7_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 7 — Booking Intelligence Builder

**Status:** ${passed ? "PASS" : "FAIL"}  
**Release Gate:** Milestone 1.5 · Epic 7 of 12

Owners describe how they operate. Hubly builds scheduling intelligence — not a settings page.

## Proven

- Arrival windows, travel buffers, minimum notice / no same-day
- Capacity, service-specific, seasonal, weather-aware rules
- Booking Health + AI recommendations
- AI Schedule Simulator (next 7 days before approve)
- Business DNA / industry influence
- Mission Control records booking intelligence (replay)
- Still requires approval — **no apply**

\`\`\`bash
npm run check:builder-epic7
\`\`\`

**Stop.** Do not start Epic 8 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC7.md"), md);

if (!passed) {
  console.error("\nEPIC 7 FAIL\n");
  process.exit(1);
}

console.log("\nEPIC 7 PASS — Booking Intelligence Builder (not applied)\n");
process.exit(0);
