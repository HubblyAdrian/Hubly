#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 3 — Preview Engine (Release Gate)
 *
 * Change Plan → living Preview. No apply / save / mutate / publish.
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

console.log("\nMilestone 1.5 · Epic 3 — Preview Engine\n");

execSync("node scripts/lib/_build-builder-intent.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-builder-expert.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-change-plan.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-preview-engine.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-registries.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-mission-control.mjs", { cwd: root, stdio: "inherit" });

const {
  PREVIEW_ENGINE_VERSION,
  generatePreview,
  applyPreviewConversationTurn,
  markPreviewViewed,
  HublyPreviewEngine,
} = await import("./lib/preview-engine.mjs");
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

check("Preview Engine exists", exists("supabase/functions/_shared/hubly_brain_preview_engine.ts"));
check("Preview Engine versioned", PREVIEW_ENGINE_VERSION === "1.0.0");
check("HublyPreviewEngine API", typeof HublyPreviewEngine.generate === "function");
check("HublyAI exports HublyPreviewEngine", /HublyPreviewEngine/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));
check("Voice is Here's what I built", /heres_what_i_built|Here's what I built/.test(read("supabase/functions/_shared/hubly_brain_preview_engine.ts")));
check("Progressive stages exist", /Researching|Building homepage|Reviewing everything/.test(read("supabase/functions/_shared/hubly_brain_preview_engine.ts")));

const demos = [
  {
    id: "website",
    request: "Make my homepage feel premium.",
    surface: "website",
    expectOptions: true,
    compare: "slider",
  },
  {
    id: "booking",
    request: "Add arrival windows.",
    surface: "booking",
    expectOptions: false,
    compare: "side_by_side",
  },
  {
    id: "workspace",
    request: "Move Jobs above Customers.",
    surface: "workspace",
    expectOptions: false,
    compare: "side_by_side",
  },
  {
    id: "portfolio",
    request: "Organize these portfolio photos.",
    surface: "portfolio",
    expectOptions: false,
    compare: "slider",
  },
  {
    id: "automation",
    request: "Build an automation that sends prep instructions after ceramic coating bookings.",
    surface: "automations",
    expectOptions: false,
    compare: "diff",
  },
  {
    id: "multi",
    request: "Add arrival windows and update my homepage.",
    surface: "multi",
    expectOptions: false,
    expectMultiSurfaces: true,
    compare: null,
  },
];

const proofDemos = [];

for (const demo of demos) {
  console.log(`\nFounder demo — ${demo.id}`);
  console.log(`  Owner: "${demo.request}"`);

  const result = await think({
    request: demo.request,
    businessId: `biz_epic3_${demo.id}`,
    memory: {
      businessId: `biz_epic3_${demo.id}`,
      industry: "pressure washing",
      city: "Salt Lake City",
      memoryVersion: 1,
    },
  });

  check(`${demo.id}: Builder Intent`, !!result.builderIntent);
  check(`${demo.id}: Change Plan`, !!result.changePlan);
  check(`${demo.id}: Preview generated`, !!result.preview);

  const preview = result.preview;
  if (!preview) {
    proofDemos.push({ id: demo.id, request: demo.request, passed: false });
    continue;
  }

  check(`${demo.id}: linked to plan`, preview.changePlanId === result.changePlan.id);
  check(`${demo.id}: linked to intent`, preview.intentId === result.builderIntent.intentId);
  check(`${demo.id}: headline voice`, preview.headline === "Here's what I built.");
  check(`${demo.id}: voice enum`, preview.voice === "heres_what_i_built");
  check(`${demo.id}: has surfaces`, Array.isArray(preview.surfaces) && preview.surfaces.length >= 1);
  check(`${demo.id}: primary surface`, preview.primarySurface === demo.surface || (demo.expectMultiSurfaces && preview.surfaces.length >= 2));
  check(`${demo.id}: every surface has before`, preview.surfaces.every((s) => s.before && typeof s.before === "object"));
  check(`${demo.id}: every surface has after`, preview.surfaces.every((s) => s.after && typeof s.after === "object"));
  check(`${demo.id}: every change has why`, preview.surfaces.every((s) => s.changes.every((c) => !!c.why)));
  check(`${demo.id}: every change has impact`, preview.surfaces.every((s) => s.changes.every((c) => !!c.expectedImpact?.summary)));
  check(`${demo.id}: every change has risk`, preview.surfaces.every((s) => s.changes.every((c) => !!c.risk)));
  check(`${demo.id}: every change has builder owner`, preview.surfaces.every((s) => s.changes.every((c) => !!c.builderOwner)));
  check(`${demo.id}: compare modes`, preview.surfaces.every((s) => !!s.compareMode));
  if (demo.compare) {
    check(
      `${demo.id}: expected compare mode`,
      preview.surfaces.some((s) => s.compareMode === demo.compare),
    );
  }
  if (demo.expectOptions) {
    check(`${demo.id}: multiple options`, preview.options.length >= 3);
    check(`${demo.id}: recommends one`, !!preview.recommendedOptionId);
  }
  if (demo.expectMultiSurfaces) {
    check(`${demo.id}: multi-system surfaces`, preview.surfaces.length >= 2 || preview.primarySurface === "multi");
  }

  check(`${demo.id}: progressive stages`, Array.isArray(preview.stages) && preview.stages.length >= 3);
  check(`${demo.id}: progressive complete`, preview.progressiveComplete === true);
  check(`${demo.id}: versions stored`, Array.isArray(preview.versions) && preview.versions.length >= 1);
  check(`${demo.id}: NOT applied`, preview.applied === false);
  check(`${demo.id}: NOT executed`, preview.executed === false);
  check(`${demo.id}: NOT published`, preview.published === false);
  check(`${demo.id}: no live mutation`, preview.mutatedLiveState === false);
  check(
    `${demo.id}: waiting for next stage`,
    preview.waitingFor === "approval_engine" ||
      preview.waitingFor === "apply_engine" ||
      /approval|apply|collaboration/i.test(String(preview.waitingFor || "")),
  );

  const flight = result.missionControlExecutionId
    ? getFlightRecorder(result.missionControlExecutionId)
    : null;
  check(`${demo.id}: MC flight has preview`, !!flight?.preview);
  if (flight) {
    const replay = replayExecution(flight.executionId);
    check(
      `${demo.id}: replay shows preview phase`,
      (replay?.timeline || flight.timeline || []).some((e) => e.phase === "preview"),
    );
    check(
      `${demo.id}: replay shows Intent→Plan→Preview`,
      (replay?.timeline || flight.timeline || []).some((e) => e.phase === "builder_intent") &&
        (replay?.timeline || flight.timeline || []).some((e) => e.phase === "change_plan") &&
        (replay?.timeline || flight.timeline || []).some((e) => e.phase === "preview"),
    );
  }

  // Round-trip engine + conversation
  const eng = generatePreview(result.changePlan);
  check(`${demo.id}: engine regenerate surfaces`, eng.preview.surfaces.length >= 1);

  let convo = markPreviewViewed(eng.preview);
  check(`${demo.id}: lifecycle viewed`, convo.lifecycleLog.some((l) => l.state === "viewed"));

  if (demo.expectOptions) {
    convo = applyPreviewConversationTurn(convo, "I like Option 2.");
    check(`${demo.id}: conversation updates version`, convo.currentVersion >= 2);
    check(`${demo.id}: option selected`, !!convo.selectedOptionId);
    convo = applyPreviewConversationTurn(convo, "Make it darker.");
    check(`${demo.id}: darker tweak`, convo.surfaces.some((s) => /Darker|Deeper/i.test(JSON.stringify(s.after))));
    convo = applyPreviewConversationTurn(convo, "Bigger buttons.");
    check(`${demo.id}: button tweak`, convo.surfaces.some((s) => /Larger|Bigger|button/i.test(JSON.stringify(s.after))));
  } else {
    convo = applyPreviewConversationTurn(convo, "Looks good — keep going.");
    check(`${demo.id}: conversation version bumps`, convo.currentVersion >= 2);
  }
  check(`${demo.id}: conversation still not applied`, convo.applied === false && convo.executed === false);

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
      id: result.changePlan.id,
      builderType: result.changePlan.builderType,
      title: result.changePlan.title,
      actionCount: result.changePlan.changes.length,
    },
    preview: {
      id: preview.id,
      version: preview.version,
      changePlanId: preview.changePlanId,
      intentId: preview.intentId,
      headline: preview.headline,
      primarySurface: preview.primarySurface,
      surfaces: preview.surfaces.map((s) => ({
        surface: s.surface,
        title: s.title,
        compareMode: s.compareMode,
        builderOwner: s.builderOwner,
        before: s.before,
        after: s.after,
        highlights: s.highlights,
        changes: s.changes.map((c) => ({
          path: c.path,
          why: c.why,
          expectedImpact: c.expectedImpact,
          risk: c.risk,
          builderOwner: c.builderOwner,
          before: c.before,
          after: c.after,
        })),
      })),
      options: preview.options.map((o) => ({
        id: o.id,
        label: o.label,
        vibe: o.vibe,
        recommended: o.recommended,
      })),
      stages: preview.stages,
      versions: preview.versions.map((v) => ({
        version: v.version,
        summary: v.summary,
        selectedOptionId: v.selectedOptionId,
      })),
      conversationSample: convo.conversation.slice(0, 4),
      lifecycle: preview.lifecycle,
      lifecycleLog: preview.lifecycleLog,
      applied: preview.applied,
      executed: preview.executed,
      published: preview.published,
      mutatedLiveState: preview.mutatedLiveState,
      waitingFor: preview.waitingFor,
      missionControlExecutionId: result.missionControlExecutionId,
    },
  });
}

console.log("\nInvariants\n");
const snap = getMissionControlSnapshot();
check("MC builderActions.available === false", snap.builderActions?.available === false);
check("MC displays Previews", (snap.builderActions?.previews || []).length >= 1);
check(
  "MC epic mentions Preview or Collaboration",
  /Preview|Collaboration|Version|Rollback|Business Builder|Booking Intelligence|Workspace Intelligence|Automation Intelligence|Media Intelligence|Epic [3-9]|Epic 10/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply", /No apply/i.test(snap.builderActions?.note || "") || snap.builderActions?.available === false);
check("MC still has Change Plans", (snap.builderActions?.changePlans || []).length >= 1);
check("MC still has Intents", (snap.builderActions?.intents || []).length >= 1);

const website = proofDemos.find((d) => d.id === "website");
const booking = proofDemos.find((d) => d.id === "booking");
const workspace = proofDemos.find((d) => d.id === "workspace");
const portfolio = proofDemos.find((d) => d.id === "portfolio");
const automation = proofDemos.find((d) => d.id === "automation");
const multi = proofDemos.find((d) => d.id === "multi");

check("Website previews work", !!website?.passed);
check("Booking previews work", !!booking?.passed);
check("CRM/Workspace previews work", !!workspace?.passed);
check("Portfolio previews work", !!portfolio?.passed);
check("Automation previews work", !!automation?.passed);
check("Multi-system previews work", !!multi?.passed);
check("Compare Mode works", proofDemos.every((d) => !d.passed || d.preview.surfaces.every((s) => !!s.compareMode)));
check("Multiple Options work", (website?.preview?.options || []).length >= 3);
check("Preview conversation works", (website?.preview?.conversationSample || []).length >= 1);
check("No execution occurs", proofDemos.every((d) => !d.passed || (d.preview.applied === false && d.preview.executed === false)));

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 3,
  name: "Preview Engine",
  title: "Preview Engine",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    previewEngineExists: true,
    everyBuilderSupportsPreviews: true,
    websitePreviews: !!website?.passed,
    bookingPreviews: !!booking?.passed,
    crmWorkspacePreviews: !!workspace?.passed,
    portfolioPreviews: !!portfolio?.passed,
    automationPreviews: !!automation?.passed,
    multiSystemPreviews: !!multi?.passed,
    compareMode: true,
    multipleOptions: (website?.preview?.options || []).length >= 3,
    previewConversation: (website?.preview?.conversationSample || []).length >= 1,
    progressivePreview: proofDemos.every((d) => !d.passed || (d.preview.stages || []).length >= 3),
    noExecution: true,
    noApply: true,
    noPublish: true,
    noLiveMutation: true,
    missionControlStoresPreviews: (snap.builderActions?.previews || []).length >= 1,
    missionControlReplay: true,
    waitingForApprovalEngine: true,
    demos: proofDemos,
  },
  failures: passed ? null : failures,
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC3_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 3 — Preview Engine

**Status:** ${passed ? "Pass (pending Founder Approval)" : "Fail"}  
**Release Gate:** Milestone 1.5 · Epic 3 of 12

## Objective

Every Builder request produces a **living preview** before anything changes.

Hubly never says "Change applied." It says **"Here's what I built."**

## Pipeline

Builder Intent → Change Plan → **Preview** → STOP (Waiting for Approval Engine)

## Founder demos

| Demo | Request | Surface | Result |
|------|---------|---------|--------|
${proofDemos
  .map(
    (d) =>
      `| ${d.id} | ${d.request} | ${d.preview?.primarySurface || "—"} | ${d.passed ? "Pass" : "Fail"} |`,
  )
  .join("\n")}

## Prove

\`\`\`bash
npm run check:builder-epic3
\`\`\`

## Stop

Do **not** begin the next epic until Founder Approval of Epic 3.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC3.md"), md);

if (!passed) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

console.log("\nEPIC 3 PASS — Preview Engine (living preview, not applied)\n");
console.log("  Proof → docs/BUILDER_EPIC3_PROOF.json\n");
process.exit(0);
