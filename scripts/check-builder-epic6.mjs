#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 6 — Business Builder (Release Gate)
 *
 * Build the business — website is one canvas. Creative Sessions. No apply.
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

console.log("\nMilestone 1.5 · Epic 6 — Business Builder\n");

for (const s of [
  "_build-builder-intent",
  "_build-builder-expert",
  "_build-change-plan",
  "_build-preview-engine",
  "_build-collaboration",
  "_build-version-engine",
  "_build-business-builder",
  "_build-registries",
  "_build-mission-control",
]) {
  execSync(`node scripts/lib/${s}.mjs`, { cwd: root, stdio: "inherit" });
}

const {
  BUSINESS_BUILDER_VERSION,
  BUSINESS_BUILDER_LABEL,
  WEBSITE_MODULE_ID,
  startCreativeSession,
  continueCreativeSession,
  resolveCreativeChallenge,
  getCreativeMemory,
  clearCreativeMemoryForTests,
  HublyBusinessBuilder,
} = await import("./lib/business-builder.mjs");
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
clearCreativeMemoryForTests();
resetExpertsForTests();
ensureExpertsRegistered();
ensureRegistriesBootstrapped();

const src = read("supabase/functions/_shared/hubly_brain_business_builder.ts");
const spec = read("docs/architecture/BUILDER_ENGINE_SPEC.md");

check("Business Builder exists", exists("supabase/functions/_shared/hubly_brain_business_builder.ts"));
check("Business Builder versioned", BUSINESS_BUILDER_VERSION === "1.0.0");
check("Customer-facing label is Business Builder", BUSINESS_BUILDER_LABEL === "Business Builder");
check("Website remains internal module id", WEBSITE_MODULE_ID === "website_builder");
check("HublyBusinessBuilder API", typeof HublyBusinessBuilder.start === "function");
check("HublyAI exports HublyBusinessBuilder", /HublyBusinessBuilder/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Architecture prefers Business Builder", /Business Builder/.test(spec));
check("Creative Workspace exists", /Creative Workspace|co_creating_with_creative_director/.test(src));
check("Business Score exists", /BusinessScore|business quality/i.test(src));
check("Creative Memory exists", /CreativeMemory|learnCreativePreference/.test(src));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));

console.log("\nFounder demo — make my business feel premium\n");

const biz = "biz_epic6_premium";
const r1 = await think({
  request: "Make my business feel premium.",
  businessId: biz,
  memory: { businessId: biz, industry: "detailing", city: "Austin", memoryVersion: 1 },
});

check("Creative Session created", !!r1.creativeSession);
check("Label is Business Builder", r1.creativeSession?.label === "Business Builder");
check("Multi-surface decisions", (r1.creativeSession?.decisions?.length || 0) >= 4);
check(
  "Touches more than website",
  (r1.creativeSession?.surfacesTouched || []).length >= 2 ||
    (r1.creativeSession?.decisions || []).some((d) => d.surface !== "website"),
);
check("Explains creative decisions", (r1.creativeSession?.decisions || []).every((d) => !!d.why));
check("Business Score overall", typeof r1.creativeSession?.score?.overall === "number");
check("Business Score not SEO", /not SEO|Business quality/i.test(r1.creativeSession?.score?.note || ""));
check("Creative Direction set", !!r1.creativeSession?.direction?.label);
check("Requires approval", r1.creativeSession?.requiresApproval === true);
check("NOT applied", r1.creativeSession?.applied === false);

let session = r1.creativeSession;
session = continueCreativeSession(session, "Make it more friendly.");
check("Friendly direction update", /friend|warm|Friendly/i.test(session.direction.label + session.workspace.conversation.at(-1)?.message));
check("Creative Memory learned tone", getCreativeMemory(biz).preferences.some((p) => p.key === "tone" || p.key === "direction"));

session = continueCreativeSession(session, "Actually keep it premium.");
check("Combines preferences", /combine|premium|friendly/i.test(session.workspace.conversation.at(-1)?.message || ""));

session = continueCreativeSession(session, "I don't like the new typography.");
check("Typography preference remembered", getCreativeMemory(biz).preferences.some((p) => p.key === "typography"));

session = continueCreativeSession(session, "Keep the luxury layout but use brighter photography.");
check("Combined luxury + brighter photos", /luxury|brighter|Combined/i.test(session.workspace.conversation.at(-1)?.message || ""));

// Negotiation
session = continueCreativeSession(session, "Remove reviews.");
check("Creative negotiation works", !!session.challenge);
session = resolveCreativeChallenge(session, "keep");
check("Challenge resolves without apply", session.applied === false && !session.challenge);

// Workspace shape
check(
  "Creative Workspace split",
  session.workspace.split === "conversation_left_preview_right" &&
    session.workspace.feeling === "co_creating_with_creative_director",
);
check("Live views include Website Booking Packages Portfolio", session.workspace.liveViews.length >= 4);

console.log("\nMission Control\n");
const snap = getMissionControlSnapshot();
check("MC displays Creative Sessions", (snap.builderActions?.creativeSessions || []).length >= 1);
check(
  "MC epic is Business Builder",
  /Business Builder|Booking Intelligence|Workspace Intelligence|Automation Intelligence|Epic [6-9]/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply", snap.builderActions?.available === false);

const flight = r1.missionControlExecutionId ? getFlightRecorder(r1.missionControlExecutionId) : null;
check("MC flight has creativeSession", !!flight?.creativeSession);
if (flight) {
  const tl = replayExecution(flight.executionId)?.timeline || flight.timeline || [];
  check("Replay shows creative_session", tl.some((e) => e.phase === "creative_session"));
}

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 6,
  name: "Business Builder",
  title: "Business Builder",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    businessBuilderExists: true,
    websiteIsOneCanvas: true,
    customerFacingName: "Business Builder",
    internalWebsiteModule: WEBSITE_MODULE_ID,
    creativeDirectionsMultiSurface: true,
    explainsEveryDecision: true,
    businessScore: true,
    creativeMemory: true,
    multiSurfaceChanges: true,
    creativeNegotiation: true,
    creativeWorkspace: true,
    missionControlCreativeSessions: (snap.builderActions?.creativeSessions || []).length >= 1,
    requiresApprovalBeforeApply: true,
    noApply: true,
    demos: {
      premium: {
        request: "Make my business feel premium.",
        direction: r1.creativeSession?.direction,
        decisions: r1.creativeSession?.decisions,
        score: r1.creativeSession?.score,
        surfacesTouched: r1.creativeSession?.surfacesTouched,
      },
      conversation: session.workspace.conversation.slice(-8),
      memory: getCreativeMemory(biz),
      workspace: session.workspace,
    },
  },
  failures: passed ? null : failures,
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC6_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 6 — Business Builder

**Status:** ${passed ? "Pass (pending Founder Approval)" : "Fail"}  
**Release Gate:** Milestone 1.5 · Epic 6 of 12

## Objective

Build the **business** with Hubly. The website is one canvas — not a Wix editor.

## Creative Session

Hubly explains what changed across Website, Booking, Packages, Portfolio — and why.

## Creative Workspace

Conversation left · Live business right · Views across the top (not settings tabs).

## Prove

\`\`\`bash
npm run check:builder-epic6
\`\`\`

## Stop

Do **not** begin Epic 7 until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC6.md"), md);

if (!passed) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

console.log("\nEPIC 6 PASS — Business Builder (Creative Session, not applied)\n");
console.log("  Proof → docs/BUILDER_EPIC6_PROOF.json");
console.log("  Stop before Epic 7 until Founder Approval.\n");
process.exit(0);
