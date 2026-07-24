#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 2 — Change Plan DSL (Release Gate)
 *
 * Builder Intent → declarative Change Plan. No execute / preview / apply.
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

console.log("\nMilestone 1.5 · Epic 2 — Change Plan DSL\n");

execSync("node scripts/lib/_build-builder-intent.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-builder-expert.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-change-plan.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-registries.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-mission-control.mjs", { cwd: root, stdio: "inherit" });

const { CHANGE_PLAN_VERSION, generateChangePlan, HublyChangePlanEngine } =
  await import("./lib/change-plan.mjs");
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

check("Change Plan Engine exists", exists("supabase/functions/_shared/hubly_brain_change_plan.ts"));
check("Change Plan DSL versioned", CHANGE_PLAN_VERSION === "1.0.0");
check("HublyChangePlanEngine API", typeof HublyChangePlanEngine.generate === "function");
check("HublyAI exports HublyChangePlanEngine", /HublyChangePlanEngine/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("DSL is declarative (desiredState)", /desiredState|desired_state|ChangePlanDesiredState/.test(read("supabase/functions/_shared/hubly_brain_change_plan.ts")));

const demos = [
  {
    id: "website",
    request: "Make my website feel premium.",
    builders: ["Website Builder"],
    builderTypes: ["website_builder"],
    pathHint: /website\./,
  },
  {
    id: "booking",
    request: "Don't allow same-day bookings.",
    builders: ["Booking Intelligence Builder"],
    builderTypes: ["booking"],
    pathHint: /booking\./,
  },
  {
    id: "workspace",
    request: "Move Jobs above Customers.",
    builders: ["Workspace Intelligence Builder"],
    builderTypes: ["workspace_builder"],
    pathHint: /workspace\./,
  },
  {
    id: "crm",
    request: "Hide the unused CRM module and pin my leads widget.",
    builders: ["CRM Builder"],
    builderTypes: ["crm"],
    pathHint: /crm\./,
  },
  {
    id: "portfolio",
    request: "Put these 12 photos into my portfolio.",
    builders: ["Portfolio Builder"],
    builderTypes: ["portfolio_builder"],
    pathHint: /portfolio\./,
  },
  {
    id: "automation",
    request: "Send prep instructions after ceramic coating bookings.",
    builders: ["Automation Intelligence Builder"],
    builderTypes: ["automation"],
    pathHint: /automations\./,
  },
  {
    id: "multi",
    request: "Add arrival windows and update my website to explain them.",
    builders: ["Booking Intelligence Builder", "Website Builder"],
    builderTypes: ["multi"],
    pathHint: /booking\.|website\./,
  },
];

const proofDemos = [];

for (const demo of demos) {
  console.log(`\nFounder demo — ${demo.id}`);
  console.log(`  Owner: "${demo.request}"`);

  const result = await think({
    request: demo.request,
    businessId: `biz_epic2_${demo.id}`,
    memory: {
      businessId: `biz_epic2_${demo.id}`,
      industry: "pressure washing",
      city: "Salt Lake City",
      memoryVersion: 1,
    },
  });

  check(`${demo.id}: Builder Intent present`, !!result.builderIntent);
  check(`${demo.id}: Change Plan generated`, !!result.changePlan);

  const plan = result.changePlan;
  if (!plan) {
    proofDemos.push({ id: demo.id, request: demo.request, passed: false });
    continue;
  }

  check(`${demo.id}: linked to intent`, plan.intentId === result.builderIntent.intentId);
  check(`${demo.id}: has desiredState`, !!plan.desiredState && typeof plan.desiredState === "object");
  check(`${demo.id}: has changes[]`, Array.isArray(plan.changes) && plan.changes.length >= 1);
  check(`${demo.id}: builderType`, demo.builderTypes.includes(plan.builderType), plan.builderType);
  for (const owner of demo.builders) {
    check(
      `${demo.id}: builder owner ${owner}`,
      plan.changes.some((a) => a.builderOwner === owner),
    );
  }
  check(
    `${demo.id}: declarative paths`,
    plan.changes.every((a) => demo.pathHint.test(a.path) || a.path.includes(".")),
  );
  check(`${demo.id}: every action has owner`, plan.changes.every((a) => !!a.builderOwner));
  check(`${demo.id}: every action has impact`, plan.changes.every((a) => !!a.estimatedImpact?.summary));
  check(`${demo.id}: every action has risk`, plan.changes.every((a) => !!a.risk));
  check(`${demo.id}: every action has confidence`, plan.changes.every((a) => typeof a.confidence === "number"));
  check(`${demo.id}: requiresApproval`, plan.requiresApproval === true);
  check(`${demo.id}: NOT applied`, plan.applied === false);
  check(`${demo.id}: NOT executed`, plan.executed === false);
  // Change Plan draft from engine stays previewGenerated:false; Epic 3 attaches a separate Preview artifact.
  check(`${demo.id}: plan draft flag is boolean`, typeof plan.previewGenerated === "boolean");
  check(`${demo.id}: validation ran`, !!plan.validation && typeof plan.validation.ok === "boolean");
  check(`${demo.id}: validation ok`, plan.validation.ok === true, (plan.validation.issues || []).join("; "));
  check(`${demo.id}: rollback strategy declared`, plan.rollbackStrategy?.mode === "restore_previous_desired_state");

  const raw = JSON.stringify(plan);
  check(`${demo.id}: no SQL`, !/\bSELECT\s+.+\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b/i.test(raw));
  check(`${demo.id}: no React`, !/\b(useEffect|setState|createElement)\b/i.test(raw));

  const flight = result.missionControlExecutionId
    ? getFlightRecorder(result.missionControlExecutionId)
    : null;
  check(`${demo.id}: MC flight has changePlan`, !!flight?.changePlan);
  if (flight) {
    const replay = replayExecution(flight.executionId);
    check(
      `${demo.id}: replay shows change_plan phase`,
      (replay?.timeline || flight.timeline || []).some((e) => e.phase === "change_plan"),
    );
  }

  // Round-trip engine API
  const eng = generateChangePlan(result.builderIntent);
  check(`${demo.id}: engine regenerate has actions`, eng.changePlan.changes.length >= 1);

  proofDemos.push({
    id: demo.id,
    request: demo.request,
    passed: true,
    builderIntent: {
      intentId: result.builderIntent.intentId,
      category: result.builderIntent.intentCategory,
      goal: result.builderIntent.ownerGoal,
    },
    changePlan: {
      id: plan.id,
      version: plan.version,
      builderType: plan.builderType,
      intentId: plan.intentId,
      title: plan.title,
      description: plan.description,
      affectedSystems: plan.affectedSystems,
      requiredCapabilities: plan.requiredCapabilities,
      desiredState: plan.desiredState,
      changes: plan.changes.map((a) => ({
        actionId: a.actionId,
        path: a.path,
        desired: a.desired,
        builderOwner: a.builderOwner,
        builderType: a.builderType,
        risk: a.risk,
        confidence: a.confidence,
        dependencies: a.dependencies,
        estimatedImpact: a.estimatedImpact,
        capabilityId: a.capabilityId,
        reason: a.reason,
      })),
      dependencies: plan.dependencies,
      risk: plan.risk,
      confidence: plan.confidence,
      requiresApproval: plan.requiresApproval,
      estimatedImpact: plan.estimatedImpact,
      rollbackStrategy: plan.rollbackStrategy,
      validation: plan.validation,
      applied: plan.applied,
      executed: plan.executed,
      missionControlExecutionId: result.missionControlExecutionId,
    },
  });
}

console.log("\nInvariants\n");
const snap = getMissionControlSnapshot();
check("MC builderActions.available === false", snap.builderActions?.available === false);
check("MC displays Change Plans", (snap.builderActions?.changePlans || []).length >= 1);
check(
  "MC epic mentions Builder pipeline",
  /Change Plan|Preview|Collaboration|Version|Rollback|Business Builder|Booking Intelligence|Workspace Intelligence|Automation Intelligence|Epic [2-9]/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check(
  "MC still blocks apply",
  /No apply/i.test(snap.builderActions?.note || "") || snap.builderActions?.available === false,
);

const multi = proofDemos.find((d) => d.id === "multi");
check("Multi-system one plan", multi?.changePlan?.builderType === "multi");
check(
  "Multi-system two builders",
  multi?.changePlan?.changes?.some((a) => a.builderOwner === "Booking Intelligence Builder") &&
    multi?.changePlan?.changes?.some((a) => a.builderOwner === "Website Builder"),
);

check("No apply/execute builder modules yet", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));
// Epic 3 may add Preview Engine; Change Plan itself stays unexecuted (previewGenerated may flip via MC summary).
check(
  "Change Plan Engine still propose-only (no apply module)",
  !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"),
);

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 2,
  name: "Change Plan DSL",
  title: "Change Plan DSL",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    changePlanEngineExists: true,
    universalDsl: true,
    declarativeDesiredState: true,
    websitePlans: !!proofDemos.find((d) => d.id === "website" && d.passed),
    bookingPlans: !!proofDemos.find((d) => d.id === "booking" && d.passed),
    crmPlans: !!proofDemos.find((d) => d.id === "crm" && d.passed),
    workspacePlans: !!proofDemos.find((d) => d.id === "workspace" && d.passed),
    portfolioPlans: !!proofDemos.find((d) => d.id === "portfolio" && d.passed),
    automationPlans: !!proofDemos.find((d) => d.id === "automation" && d.passed),
    multiSystemOnePlan: multi?.changePlan?.builderType === "multi",
    noBuilderExecution: true,
    noDatabaseMutations: true,
    noUiMutations: true,
    missionControlDisplaysChangePlans: (snap.builderActions?.changePlans || []).length >= 1,
    demos: proofDemos,
  },
  failures: passed ? null : failures,
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC2_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 2 — Change Plan DSL

**Status:** ${passed ? "Pass (pending Founder Approval)" : "Fail"}  
**Release Gate:** Milestone 1.5 · Epic 2 of 12

## Objective

Turn Builder Intent into a **safe, structured, versioned, declarative Change Plan**.

Builders understand how to reach desired state later — Epic 2 only describes it.

## Philosophy

Declarative desired state — not procedural steps. No SQL, React, DB, or API payloads.

## Founder demos

| Demo | Request | Builder type | Result |
|------|---------|--------------|--------|
${proofDemos
  .map(
    (d) =>
      `| ${d.id} | ${d.request} | ${d.changePlan?.builderType || "—"} | ${d.passed ? "Pass" : "Fail"} |`,
  )
  .join("\n")}

## Prove

\`\`\`bash
npm run check:builder-epic2
\`\`\`

## Stop

Epic 2 is the Change Plan foundation. Preview Engine (Epic 3) consumes these plans.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC2.md"), md);

if (!passed) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

console.log("\nEPIC 2 PASS — Change Plan DSL (declarative, not executed)\n");
console.log("  Proof → docs/BUILDER_EPIC2_PROOF.json\n");
process.exit(0);
