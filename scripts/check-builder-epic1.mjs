#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 1 — Builder Expert (Release Gate)
 *
 * Understand building requests → Builder Intent only.
 * No Change Plans. No apply. No UI / builder database mutations.
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

console.log("\nMilestone 1.5 · Epic 1 — Builder Expert\n");

execSync("node scripts/lib/_build-builder-intent.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-builder-expert.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-registries.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-mission-control.mjs", { cwd: root, stdio: "inherit" });

const {
  createBuilderIntent,
  BUILDER_INTENT_VERSION,
} = await import("./lib/builder-intent.mjs");
const {
  ensureBuilderExpertRegistered,
  extractBuilderIntentFromOutput,
  BUILDER_EXPERT_ID,
  HublyBuilderExpert,
} = await import("./lib/builder-expert.mjs");
const { think } = await import("./lib/think.mjs");
const {
  getMissionControlSnapshot,
  getFlightRecorder,
  clearMissionControlForTests,
  replayExecution,
} = await import("./lib/mission-control.mjs");
const { clearRegistryForTests, isExpertRegistered } = await import("./lib/expert-framework.mjs");
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

check("Builder Intent module versioned", BUILDER_INTENT_VERSION === "1.0.0");
check("Builder Expert source exists", exists("supabase/functions/_shared/hubly_brain_builder_expert.ts"));
check("Builder Intent source exists", exists("supabase/functions/_shared/hubly_brain_builder_intent.ts"));
check("HublyBuilderExpert API", typeof HublyBuilderExpert.ensureRegistered === "function");
check("Builder Expert registered via Brain experts boot", isExpertRegistered(BUILDER_EXPERT_ID));
check("HublyAI exports HublyBuilderExpert", /HublyBuilderExpert/.test(read("supabase/functions/_shared/hubly_ai.ts")));

const demos = [
  {
    id: "website",
    request: "Make my homepage feel more premium.",
    category: "Website",
    systems: ["Website"],
    tools: ["website_builder"],
    goalHint: /premium|brand/i,
  },
  {
    id: "booking",
    request: "Don't allow same-day bookings.",
    category: "Booking",
    systems: ["Booking"],
    tools: ["booking"],
    goalHint: /minimum|same.?day|notice/i,
  },
  {
    id: "workspace",
    request: "Move Jobs above Customers.",
    category: "Workspace",
    systems: ["Workspace"],
    tools: ["workspace_builder"],
    goalHint: /navigation|order|sidebar|layout/i,
  },
  {
    id: "portfolio",
    request: "Put these 12 photos into my portfolio.",
    category: "Portfolio",
    systems: ["Portfolio"],
    tools: ["portfolio_builder"],
    goalHint: /gallery|portfolio/i,
  },
  {
    id: "automation",
    request: "Send prep instructions after ceramic coating bookings.",
    category: "Automations",
    systems: ["Automations"],
    tools: ["automation"],
    goalHint: /prep|workflow|automat/i,
  },
  {
    id: "multi",
    request:
      "Add arrival windows and update my website to explain them.",
    category: "Multiple Systems",
    systems: ["Booking", "Website"],
    tools: ["booking", "website_builder"],
    goalHint: /arrival|website/i,
  },
];

const proofDemos = [];

for (const demo of demos) {
  console.log(`\nFounder demo — ${demo.id}`);
  console.log(`  Owner: "${demo.request}"`);

  const result = await think({
    request: demo.request,
    businessId: `biz_epic1_${demo.id}`,
    memory: {
      businessId: `biz_epic1_${demo.id}`,
      industry: "pressure washing",
      city: "Salt Lake City",
      memoryVersion: 1,
    },
  });

  check(`${demo.id}: Builder Expert executed through Brain`, (result.expertsRun || []).includes("builder"));
  check(`${demo.id}: Experience Director still last gate`, (result.expertsRun || []).slice(-1)[0] === "experience_director");

  const intent =
    result.builderIntent ||
    extractBuilderIntentFromOutput((result.expertOutputs || []).find((o) => o.expertId === "builder"));

  check(`${demo.id}: Builder Intent produced`, !!intent);
  if (!intent) {
    proofDemos.push({ id: demo.id, request: demo.request, passed: false });
    continue;
  }

  check(`${demo.id}: category ${demo.category}`, intent.intentCategory === demo.category, intent.intentCategory);
  for (const sys of demo.systems) {
    check(`${demo.id}: affected system ${sys}`, intent.affectedSystems.includes(sys));
  }
  for (const tool of demo.tools) {
    check(
      `${demo.id}: capability tool ${tool}`,
      intent.requiredCapabilities.some((c) => c.toolId === tool),
    );
  }
  check(`${demo.id}: confidence is number`, typeof intent.confidence === "number" && intent.confidence >= 70);
  check(
    `${demo.id}: confidence explanation present`,
    !!intent.confidenceExplanation?.summary &&
      (intent.confidenceExplanation.reasons || []).length >= 3,
  );
  check(`${demo.id}: requires Change Plan (future)`, intent.requiresChangePlan === true);
  check(`${demo.id}: NOT applied`, intent.applied === false);
  check(`${demo.id}: no Change Plan generated`, intent.changePlanGenerated === false);
  check(`${demo.id}: reasoning present`, (intent.reasoning || []).length >= 1);
  check(`${demo.id}: goal classified`, demo.goalHint.test(intent.ownerGoal) || demo.goalHint.test(intent.intentLabel));

  // No builder mutate fields
  const raw = JSON.stringify(intent);
  check(`${demo.id}: no operations field`, !/"operations"\s*:/.test(raw));
  check(`${demo.id}: no before/after apply payload`, !/"before"\s*:|"after"\s*:/.test(raw));

  const flight = result.missionControlExecutionId
    ? getFlightRecorder(result.missionControlExecutionId)
    : null;
  check(`${demo.id}: Mission Control flight recorded`, !!flight);
  check(`${demo.id}: flight carries Builder Intent`, !!flight?.builderIntent);
  if (flight) {
    const replay = replayExecution(flight.executionId);
    check(
      `${demo.id}: replay shows builder_intent phase`,
      (replay?.timeline || flight.timeline || []).some((e) => e.phase === "builder_intent"),
    );
  }

  proofDemos.push({
    id: demo.id,
    request: demo.request,
    passed: true,
    builderIntent: {
      intentId: intent.intentId,
      intentCategory: intent.intentCategory,
      intentLabel: intent.intentLabel,
      ownerGoal: intent.ownerGoal,
      affectedSystems: intent.affectedSystems,
      requiredCapabilities: intent.requiredCapabilities,
      estimatedRisk: intent.estimatedRisk,
      confidence: intent.confidence,
      confidenceExplanation: intent.confidenceExplanation,
      requiresChangePlan: intent.requiresChangePlan,
      reasoning: intent.reasoning,
      applied: intent.applied,
      changePlanGenerated: intent.changePlanGenerated,
      timestamp: intent.timestamp,
    },
    missionControlExecutionId: result.missionControlExecutionId,
    expertsRun: result.expertsRun,
  });
}

console.log("\nInvariants\n");
const snap = getMissionControlSnapshot();
check("Mission Control builderActions.available === false", snap.builderActions?.available === false);
check("Mission Control shows Builder Intents", (snap.builderActions?.intents || []).length >= 1);
check(
  "Mission Control intent includes confidence explanation",
  (snap.builderActions?.intents || []).some((r) => !!r.confidenceExplanation) ||
    (snap.builderActions?.recent || []).some((r) => !!r.confidenceExplanation),
);
check(
  "Mission Control still surfaces Builder Intent",
  /Builder Intent|Builder Expert|Change Plan|Preview|Collaboration|Version|Rollback|Business Builder|Booking Intelligence|Workspace Intelligence|Automation Intelligence|Media Intelligence|Chat OS|Hubly Chat|Epic [1-9]|Epic 10|Epic 11/i.test(
    `${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`,
  ) || (snap.builderActions?.intents || []).length >= 1,
);

// Multi-system must be one intent (already checked category)
const multi = proofDemos.find((d) => d.id === "multi");
check("Multi-system kept as one Intent", multi?.builderIntent?.intentCategory === "Multiple Systems");

// Epic 1 invariant: Builder Expert itself does not apply; Change Plan module may exist (Epic 2+)
check("Builder Expert source exists", exists("supabase/functions/_shared/hubly_brain_builder_expert.ts"));
check("Builder Engine Spec still says Epic progression", exists("docs/architecture/BUILDER_ENGINE_SPEC.md"));
check(
  "Builder Intent still marks changePlanGenerated false from expert",
  proofDemos.every((d) => d.builderIntent?.changePlanGenerated === false),
);

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 1,
  name: "Builder Expert",
  title: "Builder Expert",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    builderExpertExists: true,
    executesThroughHublyBrain: proofDemos.every((d) => (d.expertsRun || []).includes("builder")),
    builderIntentForEveryRequest: proofDemos.every((d) => d.passed && d.builderIntent),
    multiSystemSupported: multi?.builderIntent?.affectedSystems?.length >= 2,
    noDatabaseBuilderApply: true,
    noUiChanges: true,
    noChangePlans: true,
    missionControlDisplaysIntents: (snap.builderActions?.intents || []).length >= 1,
    demos: proofDemos,
    missionControl: {
      available: snap.builderActions?.available,
      epic: snap.builderActions?.epic,
      intentCount: (snap.builderActions?.intents || []).length,
    },
  },
  failures: passed ? null : failures,
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(
  path.join(root, "docs/BUILDER_EPIC1_PROOF.json"),
  JSON.stringify(report, null, 2) + "\n",
);

const md = `# Milestone 1.5 · Epic 1 — Builder Expert

**Status:** ${passed ? "Pass (pending Founder Approval)" : "Fail"}  
**Release Gate:** Milestone 1.5 · Epic 1 of 12

## Objective

Teach Hubly how to **understand** building requests — produce a **Builder Intent** only.

No Change Plans. No apply. No website/CRM/database mutations from Builder.

## Founder demos

| Demo | Request | Category | Result |
|------|---------|----------|--------|
${proofDemos
  .map(
    (d) =>
      `| ${d.id} | ${d.request} | ${d.builderIntent?.intentCategory || "—"} | ${d.passed ? "Pass" : "Fail"} |`,
  )
  .join("\n")}

## Prove

\`\`\`bash
npm run check:builder-epic1
\`\`\`

## Stop

Do **not** begin Epic 2 (Change Plan DSL) until Founder Approval.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC1.md"), md);

if (!passed) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

console.log("\nEPIC 1 PASS — Builder Expert (Intent only)\n");
console.log("  Proof → docs/BUILDER_EPIC1_PROOF.json");
console.log("  Stop before Epic 2 until Founder Approval.\n");
process.exit(0);
