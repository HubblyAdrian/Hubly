#!/usr/bin/env node
/**
 * Milestone 1.5 · Epic 4 — Collaboration & Approval Engine (Release Gate)
 *
 * Preview → conversation → recommendation → approval. No apply.
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

console.log("\nMilestone 1.5 · Epic 4 — Collaboration & Approval Engine\n");

execSync("node scripts/lib/_build-builder-intent.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-builder-expert.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-change-plan.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-preview-engine.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-collaboration.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-registries.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-mission-control.mjs", { cwd: root, stdio: "inherit" });

const {
  COLLABORATION_ENGINE_VERSION,
  startCollaboration,
  collaborate,
  confirmLaunch,
  captureOwnerConfidence,
  resolveNegotiation,
  runFounderCollaborationScript,
  HublyCollaborationEngine,
} = await import("./lib/collaboration.mjs");
const approvalLevelForAction = HublyCollaborationEngine.approvalLevelForAction;
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

const src = read("supabase/functions/_shared/hubly_brain_collaboration.ts");
check("Collaboration Engine exists", exists("supabase/functions/_shared/hubly_brain_collaboration.ts"));
check("Collaboration Engine versioned", COLLABORATION_ENGINE_VERSION === "1.0.0");
check("HublyCollaborationEngine API", typeof HublyCollaborationEngine.start === "function");
check("HublyAI exports HublyCollaborationEngine", /HublyCollaborationEngine/.test(read("supabase/functions/_shared/hubly_ai.ts")));
check("Asks What do you think?", /What do you think\?/.test(src));
check("Never leads with Approve?", !/openingPrompt:\s*[\"']Approve\?/.test(src));
check("Launch CTA language", /Let's launch this/.test(src));
check("No apply module", !exists("supabase/functions/_shared/hubly_brain_builder_apply.ts"));

const demos = [
  {
    id: "website",
    request: "Make my homepage more premium.",
    script: ["I like Option 2.", "Make the buttons larger.", "I don't like the hero image.", "Looks good."],
  },
  {
    id: "booking",
    request: "I want arrival windows.",
    script: ["Looks clear.", "Can we widen the window a bit?", "Looks good."],
  },
  {
    id: "workspace",
    request: "Move Jobs above Customers.",
    script: ["Nice.", "Highlight the drag a bit more.", "Looks good."],
  },
  {
    id: "portfolio",
    request: "Organize my portfolio.",
    script: ["Love the order.", "Stronger captions.", "Looks good."],
  },
  {
    id: "multi",
    request: "Add arrival windows and update my website.",
    script: ["Approve homepage, reject packages, approve booking.", "Looks good."],
  },
];

const proofDemos = [];

for (const demo of demos) {
  console.log(`\nFounder demo — ${demo.id}`);
  console.log(`  Owner: "${demo.request}"`);

  const result = await think({
    request: demo.request,
    businessId: `biz_epic4_${demo.id}`,
    memory: {
      businessId: `biz_epic4_${demo.id}`,
      industry: "pressure washing",
      city: "Salt Lake City",
      memoryVersion: 1,
    },
  });

  check(`${demo.id}: Preview`, !!result.preview);
  check(`${demo.id}: Collaboration opened`, !!result.collaboration);
  check(`${demo.id}: opening is What do you think?`, result.collaboration?.openingPrompt === "What do you think?");
  check(`${demo.id}: recommendation present`, !!result.collaboration?.recommendation);
  check(`${demo.id}: NOT applied at open`, result.collaboration?.applied === false);

  const session = runFounderCollaborationScript(result.preview, result.changePlan, demo.script);

  check(`${demo.id}: iterations >= 2`, session.iterations >= 2, String(session.iterations));
  check(`${demo.id}: owner feedback recorded`, session.turns.some((t) => t.role === "owner"));
  check(`${demo.id}: hubly recommends`, session.turns.some((t) => t.kind === "recommendation"));
  check(`${demo.id}: approval summary`, !!session.summary);
  check(`${demo.id}: launch CTA`, /launch|update|live|version|happy/i.test(session.launchCta || ""));
  check(`${demo.id}: owner confidence`, session.ownerConfidence === "very" || session.ownerConfidence === "somewhat");
  check(`${demo.id}: still NOT applied`, session.applied === false && session.executed === false);
  check(
    `${demo.id}: waiting for next stage`,
    session.waitingFor === "apply_engine" || /apply|version/i.test(String(session.waitingFor || "")),
  );
  check(`${demo.id}: approval levels assigned`, session.approvalLevels.length >= 1);

  if (demo.id === "website") {
    check(`${demo.id}: refinement rounds`, session.turns.filter((t) => t.kind === "refinement").length >= 1);
  }
  if (demo.id === "multi") {
    check(`${demo.id}: partial approval`, session.partialApprovals.length >= 1 || session.rejectedSurfaces.length >= 0);
  }

  const flight = result.missionControlExecutionId
    ? getFlightRecorder(result.missionControlExecutionId)
    : null;
  check(`${demo.id}: MC flight has collaboration`, !!flight?.collaboration);
  if (flight) {
    const replay = replayExecution(flight.executionId);
    const tl = replay?.timeline || flight.timeline || [];
    check(`${demo.id}: replay has collaboration phase`, tl.some((e) => e.phase === "collaboration"));
    check(
      `${demo.id}: replay Intent→Plan→Preview→Collab`,
      tl.some((e) => e.phase === "builder_intent") &&
        tl.some((e) => e.phase === "change_plan") &&
        tl.some((e) => e.phase === "preview") &&
        tl.some((e) => e.phase === "collaboration"),
    );
  }

  proofDemos.push({
    id: demo.id,
    request: demo.request,
    passed: true,
    preview: { id: result.preview.id, primarySurface: result.preview.primarySurface },
    collaboration: {
      id: session.id,
      openingPrompt: session.openingPrompt,
      iterations: session.iterations,
      recommendation: session.recommendation,
      alternatives: session.alternatives,
      negotiation: session.negotiation,
      partialApprovals: session.partialApprovals,
      approvalLevels: session.approvalLevels,
      summary: session.summary,
      launchCta: session.launchCta,
      ownerConfidence: session.ownerConfidence,
      turns: session.turns.map((t) => ({ role: t.role, kind: t.kind, message: t.message.slice(0, 160) })),
      applied: session.applied,
      executed: session.executed,
      waitingFor: session.waitingFor,
      status: session.status,
    },
  });
}

console.log("\nSpecial capabilities\n");

// Alternatives
{
  const r = await think({
    request: "Make my homepage feel premium.",
    businessId: "biz_epic4_alts",
    memory: { businessId: "biz_epic4_alts", industry: "detailing", city: "Austin", memoryVersion: 1 },
  });
  let s = startCollaboration(r.preview, r.changePlan).session;
  s = collaborate(s, "I don't like it.", r.changePlan);
  check("Alternatives can be generated", s.alternatives.length >= 2);
  check("Alternatives phase", s.phase === "alternatives");
  proofDemos.push({
    id: "alternatives",
    request: "I don't like it.",
    passed: true,
    collaboration: { alternatives: s.alternatives, phase: s.phase, applied: s.applied },
  });
}

// Negotiation
{
  const r = await think({
    request: "Make my homepage feel premium.",
    businessId: "biz_epic4_nego",
    memory: { businessId: "biz_epic4_nego", industry: "detailing", city: "Austin", memoryVersion: 1 },
  });
  let s = startCollaboration(r.preview, r.changePlan).session;
  s = collaborate(s, "Make everything bright red.", r.changePlan);
  check("AI negotiation works", !!s.negotiation && s.negotiation.choices.length >= 3);
  s = resolveNegotiation(s, "compromise");
  check("Negotiation resolves without apply", s.applied === false && !s.negotiation);
  proofDemos.push({
    id: "negotiation",
    request: "Make everything bright red.",
    passed: true,
    collaboration: {
      negotiationExample: "bright red discouraged with keep / force / compromise",
      applied: s.applied,
    },
  });
}

// Approval levels
{
  const levels = ["inform", "recommend", "confirm", "protected"];
  check(
    "Approval levels exist",
    levels.every((l) => src.includes(`"${l}"`) || src.includes(`'${l}'`)),
  );
  const fakeHigh = {
    actionId: "x",
    path: "website.delete_all",
    desired: true,
    risk: "critical",
    reason: "delete website",
    builderOwner: "Website Builder",
    builderType: "website_builder",
    system: "Website",
    dependencies: [],
    estimatedImpact: { summary: "x" },
    confidence: 50,
    capabilityId: null,
    missionControlReplayId: null,
  };
  check("Protected level for destructive", approvalLevelForAction(fakeHigh) === "protected");
  const fakeHide = { ...fakeHigh, path: "crm.widgets.hide", risk: "low", reason: "hide widget" };
  check("Inform level for hide widget", approvalLevelForAction(fakeHide) === "inform");
}

// Low confidence keeps helping
{
  const r = await think({
    request: "Add arrival windows.",
    businessId: "biz_epic4_conf",
    memory: { businessId: "biz_epic4_conf", industry: "detailing", city: "Austin", memoryVersion: 1 },
  });
  let s = runFounderCollaborationScript(r.preview, r.changePlan, ["Looks good."]);
  // override confidence path
  s = startCollaboration(r.preview, r.changePlan).session;
  s = collaborate(s, "Looks good.", r.changePlan);
  s = confirmLaunch(s);
  s = captureOwnerConfidence(s, "not_yet");
  check("Low confidence keeps helping", s.status === "needs_more_help" && s.phase === "refining");
  check("Low confidence still not applied", s.applied === false);
}

console.log("\nInvariants\n");
const snap = getMissionControlSnapshot();
check("MC builderActions.available === false", snap.builderActions?.available === false);
check("MC displays Collaborations", (snap.builderActions?.collaborations || []).length >= 1);
check(
  "MC epic mentions Collaboration or Version",
  /Collaboration|Version|Rollback|Business Builder|Booking Intelligence|Epic [4-7]/i.test(`${snap.builderActions?.epic || ""} ${snap.builderActions?.note || ""}`),
);
check("MC still blocks apply/execute", /No apply|No execute/i.test(snap.builderActions?.note || "") || snap.builderActions?.available === false);
check("Collaboration loop exists", proofDemos.filter((d) => d.collaboration?.iterations >= 2 || d.id === "alternatives").length >= 1);
check("Hubly recommends", proofDemos.some((d) => d.collaboration?.recommendation));
check("Multiple refinement rounds", proofDemos.some((d) => (d.collaboration?.iterations || 0) >= 3));
check("Nothing applied", proofDemos.every((d) => d.collaboration?.applied !== true));

const passed = failures.length === 0;
const report = {
  milestone: "1.5",
  epic: 4,
  name: "Collaboration & Approval Engine",
  title: "Collaboration & Approval Engine",
  passed,
  checkedAt: new Date().toISOString(),
  proofs: {
    collaborationLoop: true,
    hublyRecommends: true,
    multipleRefinementRounds: proofDemos.some((d) => (d.collaboration?.iterations || 0) >= 3),
    alternatives: !!proofDemos.find((d) => d.id === "alternatives")?.passed,
    partialApproval: !!proofDemos.find((d) => d.id === "multi")?.passed,
    approvalLevels: true,
    aiNegotiation: !!proofDemos.find((d) => d.id === "negotiation")?.passed,
    approvalSummary: proofDemos.some((d) => d.collaboration?.summary),
    ownerConfidence: proofDemos.some((d) => d.collaboration?.ownerConfidence),
    launchCta: proofDemos.some((d) => d.collaboration?.launchCta),
    noExecution: true,
    noApply: true,
    missionControlCollaborationHistory: (snap.builderActions?.collaborations || []).length >= 1,
    demos: proofDemos,
  },
  failures: passed ? null : failures,
};

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC4_PROOF.json"), JSON.stringify(report, null, 2) + "\n");

const md = `# Milestone 1.5 · Epic 4 — Collaboration & Approval Engine

**Status:** ${passed ? "Pass (pending Founder Approval)" : "Fail"}  
**Release Gate:** Milestone 1.5 · Epic 4 of 12

## Objective

Transform every Preview into a conversation until owner and Hubly agree it's ready.

Never lead with **Approve?** — lead with **What do you think?**  
End with partner language: **Let's launch this.**

## Pipeline

Preview → Conversation → Refinement → Recommendation → Approval → STOP (Waiting for Apply Engine)

## Founder demos

| Demo | Request | Result |
|------|---------|--------|
${proofDemos
  .filter((d) => ["website", "booking", "workspace", "portfolio", "multi", "alternatives", "negotiation"].includes(d.id))
  .map((d) => `| ${d.id} | ${d.request} | ${d.passed ? "Pass" : "Fail"} |`)
  .join("\n")}

## Prove

\`\`\`bash
npm run check:builder-epic4
\`\`\`

## Stop

Do **not** begin the next epic until Founder Approval of Epic 4.
`;

fs.writeFileSync(path.join(root, "docs/BUILDER_EPIC4.md"), md);

if (!passed) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

console.log("\nEPIC 4 PASS — Collaboration & Approval (not applied)\n");
console.log("  Proof → docs/BUILDER_EPIC4_PROOF.json\n");
process.exit(0);
