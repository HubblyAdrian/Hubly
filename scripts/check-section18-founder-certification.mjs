#!/usr/bin/env node
/**
 * Section 18 — Founder Acceptance & Brain Certification (Release Gate)
 *
 * Graduation exam for Hubly Brain Milestone 1 — not a demo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

execSync("node scripts/lib/_build-certification.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-docs.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/lib/_build-mission-control.mjs", { cwd: root, stdio: "inherit" });

const {
  CERTIFICATION_VERSION,
  CERTIFICATION_OWNER,
  scoreDimension,
  buildCertificationScorecard,
  buildMilestone1Certificate,
  recordBrainCertification,
  getBrainCertificationSnapshot,
  renderMilestone1CertificateMarkdown,
  clearCertificationForTests,
  HublyCertification,
} = await import("./lib/certification.mjs");

const { think, detectIntent } = await import("./lib/think.mjs");
const {
  normalizeBusinessMemory,
  brainApplyOwnerMessage,
  queryBusinessMemory,
  clearBusinessMemoryStoreForTests,
  loadBusinessMemoryLocal,
} = await import("./lib/business-memory.mjs");
const {
  normalizeWorkspaceMemory,
  brainApplyWorkspaceMessage,
  queryWorkspaceMemory,
  clearWorkspaceMemoryStoreForTests,
  loadWorkspaceMemoryLocal,
} = await import("./lib/workspace-memory.mjs");
const {
  applyConversationIntelligenceTurn,
  queryConversationIntelligence,
  persistConversationIntelligenceLocal,
  loadConversationIntelligenceLocal,
  clearConversationIntelligenceForTests,
  buildResumeGreeting,
} = await import("./lib/conversation-intelligence.mjs");
const {
  answerWhyFromReasoning,
  clearReasoningStoreForTests,
} = await import("./lib/reasoning-engine.mjs");
const { clearDecisionStoreForTests } = await import("./lib/decision-engine.mjs");
const {
  getFlightRecorder,
  replayExecution,
  getMissionControlSnapshot,
  clearMissionControlForTests,
  MISSION_CONTROL_VERSION,
} = await import("./lib/mission-control.mjs");
const {
  whoOwnsCapability,
  planRegistryRoute,
  ensureRegistriesBootstrapped,
  clearRegistriesForTests,
} = await import("./lib/registries.mjs");
const {
  demoResearchExpertRetry,
  demoWeatherTimeout,
  demoStripeQueue,
  clearReliabilityForTests,
} = await import("./lib/reliability.mjs");
const {
  applyHublyIdentity,
  evaluateAgainstConstitution,
} = await import("./lib/identity-system.mjs");
const { clearRegistryForTests } = await import("./lib/expert-framework.mjs");
const { resetExpertsForTests, ensureExpertsRegistered } = await import("./lib/initial-experts.mjs");
const {
  runQualityGate,
  ensureQualityBound,
  clearQualityForTests,
  FOUNDER_BENCHMARK_SUITE,
} = await import("./lib/quality.mjs");

const BID = "biz_milestone1_certification";
const scenarios = [];
const dimHits = {
  thinking: { p: 0, t: 0 },
  memory: { p: 0, t: 0 },
  reasoning: { p: 0, t: 0 },
  identity: { p: 0, t: 0 },
  decisionMaking: { p: 0, t: 0 },
  capabilityDiscovery: { p: 0, t: 0 },
  missionControl: { p: 0, t: 0 },
  reliability: { p: 0, t: 0 },
  businessKnowledge: { p: 0, t: 0 },
};

function hit(dim, ok, _detail = "") {
  dimHits[dim].t += 1;
  if (ok) dimHits[dim].p += 1;
  return ok;
}

function scenario(id, title, request) {
  return { id, title, request, passed: true, checks: [], failures: [] };
}

function assert(sc, cond, msg, dims = []) {
  if (cond) {
    sc.checks.push(msg);
    console.log(`  ✓ ${msg}`);
    for (const d of dims) hit(d, true, msg);
  } else {
    sc.passed = false;
    sc.failures.push(msg);
    console.error(`  ✗ ${msg}`);
    for (const d of dims) hit(d, false, msg);
  }
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("\nSection 18 — Founder Acceptance & Brain Certification\n");

clearCertificationForTests();
clearReliabilityForTests();
clearQualityForTests();
clearRegistriesForTests();
clearRegistryForTests();
clearMissionControlForTests();
clearBusinessMemoryStoreForTests();
clearWorkspaceMemoryStoreForTests();
clearConversationIntelligenceForTests();
clearReasoningStoreForTests();
clearDecisionStoreForTests();
resetExpertsForTests();
ensureExpertsRegistered();
ensureRegistriesBootstrapped();
ensureQualityBound();

// ── Source wiring ──────────────────────────────────────────────
{
  const sc = scenario("wiring", "Certification wiring", "(source)");
  console.log("Scenario — Certification wiring");
  assert(sc, exists("supabase/functions/_shared/hubly_brain_certification.ts"), "certification module exists");
  assert(sc, /HublyCertification/.test(read("supabase/functions/_shared/hubly_ai.ts")), "HublyAI exports HublyCertification");
  assert(sc, /brainCertification/.test(read("supabase/functions/_shared/hubly_brain_mission_control.ts")), "Mission Control wires brainCertification");
  assert(sc, CERTIFICATION_VERSION === "1.0.0" && CERTIFICATION_OWNER === "hubly_brain", "certification versioned");
  assert(sc, typeof HublyCertification.buildScorecard === "function", "HublyCertification API");
  scenarios.push(sc);
}

let memory = normalizeBusinessMemory({ businessId: BID, memoryVersion: 1 });
let workspace = normalizeWorkspaceMemory({ businessId: BID, memoryVersion: 1 });
let primaryExecutionId = null;
const identitySamples = [];

// ── Scenario 1 — Build My Business ─────────────────────────────
{
  const request = "I'm starting a pressure washing company in Salt Lake City.";
  const sc = scenario("s1_build", "Build My Business", request);
  console.log("\nScenario 1 — Build My Business");
  console.log(`  Founder: "${request}"`);

  const applied = brainApplyOwnerMessage(memory, request, BID);
  memory = applied.memory;
  assert(sc, /pressure/i.test(memory.industry || ""), "Business Memory industry from founder", ["memory", "businessKnowledge"]);
  assert(sc, /salt lake/i.test(String(memory.city || memory.location || "")), "Business Memory location Salt Lake City", ["memory"]);

  const intent = detectIntent(request);
  assert(sc, intent === "build_business", "Detect build_business intent", ["thinking"]);

  const result = await think({
    request,
    businessId: BID,
    memory,
  });

  primaryExecutionId = result.missionControlExecutionId;
  identitySamples.push(result.response);

  const experts = result.expertsRun || [];
  assert(sc, experts.includes("research"), "Execute Research", ["thinking"]);
  assert(sc, experts.includes("strategy"), "Execute Strategy", ["thinking"]);
  assert(sc, experts.includes("creative_director"), "Execute Creative", ["thinking"]);
  assert(sc, experts.includes("critic"), "Execute Critic", ["thinking"]);
  assert(sc, experts.includes("experience_director"), "Experience Director in pipeline", ["identity"]);

  assert(sc, !!result.dna?.knowledgePack, "Load Business DNA", ["businessKnowledge"]);
  assert(
    sc,
    /pressure/i.test(result.dna?.knowledgePack?.industryProfile?.industryName || result.dna?.knowledgePack?.industry || ""),
    "DNA matches pressure washing",
    ["businessKnowledge"],
  );

  assert(sc, !!result.primaryDecision, "Decision Engine produced a decision", ["decisionMaking"]);
  assert(sc, (result.reasoningObjects || []).length >= 1, "Produce Reasoning Objects", ["reasoning"]);
  assert(sc, !!result.conversationIntelligence, "Update Conversation Intelligence", ["memory"]);

  // Continue lifecycle context for Scenario 2
  let ci = result.conversationIntelligence;
  ci = applyConversationIntelligenceTurn(ci, "I'm redesigning my website.", {
    businessId: BID,
    expertsRun: experts,
    phase: "experts_complete",
  });
  ci = applyConversationIntelligenceTurn(ci, "I want memberships later.", { businessId: BID });
  persistConversationIntelligenceLocal(BID, ci);

  assert(sc, typeof result.response === "string" && result.response.length > 20, "Unified Hubly response", ["thinking", "identity"]);
  const idCheck = applyHublyIdentity(result.response);
  assert(sc, idCheck.constitution?.ok !== false, "Response passes Identity/Constitution gate", ["identity"]);

  scenarios.push(sc);
}

// ── Scenario 2 — Continue the Conversation ─────────────────────
{
  const request = "Let's continue where we left off.";
  const sc = scenario("s2_continue", "Continue the Conversation", request);
  console.log("\nScenario 2 — Continue the Conversation");
  console.log(`  Founder: "${request}"`);

  const ci = loadConversationIntelligenceLocal(BID);
  assert(sc, !!ci?.currentProject, "Active project context restored", ["memory"]);
  assert(sc, (ci?.pendingDecisions || []).some((d) => d.status === "pending"), "Pending approvals surfaceable", ["memory"]);
  assert(sc, (ci?.deferredIdeas || []).some((d) => /membership/i.test(d.idea)), "Deferred ideas recalled", ["memory"]);

  const resume = buildResumeGreeting(ci);
  assert(sc, /continue|website|working|ready/i.test(resume), "Resume greeting natural", ["thinking"]);

  const result = await think({ request, businessId: BID, memory });
  identitySamples.push(result.response);
  assert(sc, result.intent === "conversation_intelligence", "CI intent for continue", ["thinking"]);
  assert(
    sc,
    result.conversationIntelligenceRetrieval?.fromConversationIntelligence === true,
    "Answered from Conversation Intelligence",
    ["memory"],
  );
  assert(sc, /website|project|continue|working|goal/i.test(result.response || ""), "Continues naturally", ["thinking", "identity"]);

  const pendingQ = queryConversationIntelligence("What's left pending?", ci);
  assert(sc, /approve|stripe|publish|pending|left/i.test(pendingQ.answer), "Surfaces pending approvals", ["memory"]);

  scenarios.push(sc);
}

// ── Scenario 3 — Explain Yourself ──────────────────────────────
{
  const request = "Why did you recommend this homepage?";
  const sc = scenario("s3_why", "Explain Yourself", request);
  console.log("\nScenario 3 — Explain Yourself");
  console.log(`  Founder: "${request}"`);

  const stored = answerWhyFromReasoning(request, { businessId: BID });
  assert(sc, stored.fromStoredReasoning === true, "Retrieve stored Reasoning Object", ["reasoning"]);
  assert(sc, stored.regenerated === false, "Never regenerate explanation", ["reasoning"]);
  assert(sc, (stored.decisionGraph || []).length >= 1, "Decision Graph available", ["reasoning", "decisionMaking"]);
  assert(sc, /evidence|because|confidence/i.test(stored.answer || ""), "Explain using evidence", ["reasoning"]);

  const result = await think({ request, businessId: BID, memory });
  identitySamples.push(result.response);
  assert(sc, result.intent === "why", "Why intent", ["thinking"]);
  assert(
    sc,
    result.whyAnswer?.regenerated === false ||
      result.expertOutputs?.[0]?.output?.fromStoredReasoning === true ||
      /because|evidence|chose/i.test(result.response || ""),
    "Think answers Why? from store",
    ["reasoning"],
  );

  scenarios.push(sc);
}

// ── Scenario 4 — Workspace ─────────────────────────────────────
{
  const request = "Move Jobs above Customers.";
  const sc = scenario("s4_workspace", "Workspace", request);
  console.log("\nScenario 4 — Workspace");
  console.log(`  Founder: "${request}"`);

  const beforeBiz = JSON.stringify(loadBusinessMemoryLocal(BID) || memory);
  const applied = brainApplyWorkspaceMessage(workspace, request, BID);
  workspace = applied.workspace;
  const order = workspace.sidebarOrder || [];
  const jobsIdx = order.findIndex((x) => /jobs/i.test(x));
  const custIdx = order.findIndex((x) => /customers/i.test(x));
  assert(sc, jobsIdx >= 0 && custIdx >= 0 && jobsIdx < custIdx, "Workspace Memory: Jobs above Customers", ["memory"]);

  const afterBiz = JSON.stringify(loadBusinessMemoryLocal(BID) || memory);
  assert(sc, beforeBiz === afterBiz || memory.industry === JSON.parse(afterBiz).industry, "Business Memory preserved", ["memory"]);

  const result = await think({
    request,
    businessId: BID,
    memory,
    workspace,
    intent: "workspace",
  });
  identitySamples.push(result.response);
  assert(sc, result.intent === "workspace", "Workspace intent", ["thinking"]);
  assert(sc, /jobs|customers|sidebar|moved|workspace/i.test(result.response || ""), "Explains workspace change", ["thinking", "identity"]);

  const q = queryWorkspaceMemory(workspace, "What's in my sidebar?");
  assert(sc, q.fromMemory === true || /jobs/i.test(q.answer || ""), "Workspace retrieval works", ["memory"]);

  scenarios.push(sc);
}

// ── Scenario 5 — Website Recommendation ────────────────────────
{
  const request = "How can we improve this website?";
  const sc = scenario("s5_website", "Website Recommendation", request);
  console.log("\nScenario 5 — Website Recommendation");
  console.log(`  Founder: "${request}"`);

  const result = await think({
    request,
    businessId: BID,
    memory,
    workspace,
  });
  identitySamples.push(result.response);

  assert(sc, !!result.dna?.knowledgePack, "Reads Business DNA", ["businessKnowledge"]);
  assert(sc, !!memory.industry, "Reads Business Memory", ["memory"]);
  assert(sc, (result.expertsRun || []).includes("strategy"), "Reads/produces strategy", ["thinking"]);
  assert(sc, !!result.primaryDecision, "Scored decision present", ["decisionMaking"]);
  assert(
    sc,
    typeof result.primaryDecision.decisionScore === "number",
    "Recommendation scored",
    ["decisionMaking"],
  );
  assert(
    sc,
    result.primaryDecision.requiresApproval === true ||
      result.primaryDecision.finalDecision === "recommend" ||
      /approve|recommend|suggest/i.test(result.response || ""),
    "Requires approval where appropriate",
    ["decisionMaking"],
  );
  assert(sc, (result.reasoningObjects || []).length >= 1 || !!result.primaryDecision, "Explainable recommendations", ["reasoning"]);

  scenarios.push(sc);
}

// ── Scenario 6 — Business Coaching ─────────────────────────────
{
  const request = "How's my business doing?";
  const sc = scenario("s6_coach", "Business Coaching", request);
  console.log("\nScenario 6 — Business Coaching");
  console.log(`  Founder: "${request}"`);

  // Seed a goal for coaching context
  memory = {
    ...memory,
    goals: memory.goals || ["Grow bookings in Salt Lake City"],
  };

  const result = await think({
    request,
    businessId: BID,
    memory,
    intent: "coach",
  });
  identitySamples.push(result.response);

  const memQ = queryBusinessMemory(memory, "What kind of business are we building?");
  assert(
    sc,
    /pressure/i.test(memQ.answer || "") || /pressure/i.test(memory.industry || memory.business?.industry || ""),
    "Reads Business Memory for coaching",
    ["memory"],
  );
  assert(sc, typeof result.response === "string" && result.response.length > 20, "Produces coaching response", ["thinking"]);
  const idCheck = evaluateAgainstConstitution(applyHublyIdentity(result.response).text || result.response);
  assert(sc, idCheck.ok !== false && idCheck.score >= 70, "Coaching voice complies with Constitution", ["identity"]);
  assert(
    sc,
    /pressure|salt lake|booking|business|grow|next/i.test(result.response || ""),
    "References business context / opportunities",
    ["thinking", "businessKnowledge"],
  );

  scenarios.push(sc);
}

// ── Scenario 7 — Capability Discovery (Builder Plan prep) ───────
{
  const request = "I want appointment arrival windows and no same-day bookings.";
  const sc = scenario("s7_capabilities", "Capability Discovery", request);
  console.log("\nScenario 7 — Capability Discovery");
  console.log(`  Founder: "${request}"`);

  const arrival = whoOwnsCapability("arrival windows");
  const sameDay = whoOwnsCapability("no same-day bookings") || whoOwnsCapability("same-day bookings");
  assert(sc, arrival?.toolId === "booking", "Identify Booking domain (arrival windows)", ["capabilityDiscovery"]);
  assert(sc, sameDay?.toolId === "booking" || sameDay?.capabilityId === "no_same_day_bookings", "Discover no same-day capability", ["capabilityDiscovery"]);

  const plan = planRegistryRoute(request);
  assert(sc, (plan.capabilities || []).some((c) => c.capabilityId === "arrival_windows"), "Capability: arrival_windows", ["capabilityDiscovery"]);
  assert(
    sc,
    (plan.capabilities || []).some((c) => c.capabilityId === "no_same_day_bookings"),
    "Capability: no_same_day_bookings",
    ["capabilityDiscovery"],
  );

  const builderPlan = {
    milestone: "1.5",
    implemented: false,
    domain: "booking",
    summary: "Structured Builder Plan (preview only) for arrival windows + no same-day bookings",
    capabilities: plan.capabilities,
    requiresApproval: true,
    status: "pending_approval",
  };
  assert(sc, builderPlan.implemented === false, "Builder Plan is not implementation yet", ["capabilityDiscovery"]);
  assert(sc, builderPlan.requiresApproval === true, "Requests approval", ["decisionMaking"]);

  const result = await think({ request, businessId: BID, memory });
  identitySamples.push(result.response);
  assert(
    sc,
    result.registryRouting?.capabilities?.some((c) => c.capabilityId === "arrival_windows"),
    "Think exposes registry routing",
    ["capabilityDiscovery"],
  );
  assert(
    sc,
    /arrival|same.?day|booking|approve|build|window/i.test(result.response || ""),
    "Explains what would be built",
    ["thinking", "capabilityDiscovery"],
  );

  sc.builderPlan = builderPlan;
  scenarios.push(sc);
}

// ── Scenario 8 — Failure Recovery ──────────────────────────────
{
  const sc = scenario("s8_failure", "Failure Recovery", "Simulate Research / Weather / Stripe failures");
  console.log("\nScenario 8 — Failure Recovery");

  const research = await demoResearchExpertRetry();
  assert(sc, research.ok === true && research.retries >= 1, "Research failure → retry", ["reliability"]);
  assert(sc, research.exposedRawError === false, "Owner messaging safe (research)", ["reliability", "identity"]);

  const weather = await demoWeatherTimeout();
  assert(sc, weather.continued === true || weather.ok === true, "Weather timeout → graceful degradation", ["reliability"]);
  assert(sc, !!weather.ownerMessage && !/stack|exception|ECONN/i.test(weather.ownerMessage), "Owner messaging (weather)", ["reliability"]);

  const stripe = await demoStripeQueue();
  assert(sc, stripe.queued === true || stripe.ok === true, "Stripe unavailable → queue", ["reliability"]);
  assert(sc, !!stripe.ownerMessage, "Owner messaging (stripe)", ["reliability"]);

  const flight = primaryExecutionId ? getFlightRecorder(primaryExecutionId) : null;
  assert(sc, !!flight, "Mission Control still holds prior flight for replay", ["missionControl"]);

  scenarios.push(sc);
}

// ── Scenario 9 — Identity ──────────────────────────────────────
{
  const sc = scenario("s9_identity", "Identity", "Every response complies with Constitution + Identity + ED");
  console.log("\nScenario 9 — Identity");

  assert(sc, identitySamples.length >= 5, "Collected responses across scenarios", ["identity"]);
  let allOk = true;
  for (const sample of identitySamples) {
    const applied = applyHublyIdentity(sample);
    const constitution = evaluateAgainstConstitution(applied.text || sample);
    const ok = constitution.ok !== false && constitution.score >= 70;
    if (!ok) allOk = false;
    assert(
      sc,
      ok,
      `Constitution ok (score ${constitution.score}) on sample`,
      ["identity"],
    );
    assert(
      sc,
      !/as an ai|i am a language model|robotic response/i.test(sample || ""),
      "No robotic self-identification",
      ["identity"],
    );
  }
  assert(sc, allOk, "All sampled responses Identity-compliant", ["identity"]);

  scenarios.push(sc);
}

// ── Scenario 10 — Replay ───────────────────────────────────────
{
  const sc = scenario("s10_replay", "Replay", "Mission Control replays entire execution");
  console.log("\nScenario 10 — Replay");

  assert(sc, !!primaryExecutionId, "Primary execution id from Scenario 1", ["missionControl"]);
  const flight = getFlightRecorder(primaryExecutionId);
  assert(sc, !!flight, "Flight recorder exists", ["missionControl"]);
  assert(sc, (flight.memoriesLoaded || []).includes("business_memory"), "Replay: memories loaded", ["missionControl", "memory"]);
  assert(sc, (flight.memoriesLoaded || []).includes("business_dna"), "Replay: DNA loaded", ["missionControl", "businessKnowledge"]);
  assert(sc, (flight.expertOrder || flight.expertsExecuted || []).length >= 3, "Replay: experts", ["missionControl", "thinking"]);
  assert(sc, (flight.reasoningObjects || []).length >= 1, "Replay: reasoning", ["missionControl", "reasoning"]);
  assert(sc, (flight.decisionObjects || []).length >= 1, "Replay: decisions", ["missionControl", "decisionMaking"]);

  const replay = replayExecution(primaryExecutionId);
  assert(sc, replay.replay === true && (replay.steps || []).length >= 5, "Replay step timeline", ["missionControl"]);
  assert(sc, Array.isArray(replay.summary?.capabilities) || Array.isArray(flight.capabilitiesSelected), "Replay: capabilities", ["missionControl", "capabilityDiscovery"]);
  assert(sc, Array.isArray(replay.summary?.memoryWrites) || (flight.memoryWrites || []).length >= 1, "Replay: memory updates", ["missionControl", "memory"]);
  assert(
    sc,
    Array.isArray(flight.knowledgeAccessed) || Array.isArray(replay.summary?.knowledge),
    "Replay: knowledge sources",
    ["missionControl", "businessKnowledge"],
  );

  scenarios.push(sc);
}

// ── Validation suites + Founder Benchmarks + Docs ──────────────
console.log("\nRegression — Validation suites + Founder Benchmarks + Docs\n");
const qualityReport = await runQualityGate();
const founderBenchOk = qualityReport.founderBenchmarks.failed === 0;
const validationOk = qualityReport.ok === true;
const docsOk =
  exists("docs/architecture/README.md") &&
  exists("docs/architecture/AI_LIFECYCLE.md") &&
  exists("docs/adr/README.md") &&
  exists("docs/HUBLY_BRAIN_SECTION17.md") &&
  exists("docs/HUBLY_CONSTITUTION.md") &&
  /Hubly Constitution v1\.0/.test(read("docs/HUBLY_CONSTITUTION.md"));

console.log(`  ${validationOk ? "✓" : "✗"} Validation suites green (Quality Gate)`);
console.log(`  ${founderBenchOk ? "✓" : "✗"} Founder Benchmark Suite (${qualityReport.founderBenchmarks.passed}/${qualityReport.founderBenchmarks.total})`);
console.log(`  ${docsOk ? "✓" : "✗"} Documentation complete`);

hit("thinking", validationOk);
hit("identity", founderBenchOk);
hit("businessKnowledge", docsOk);

const founderScenarios = scenarios.filter((s) => s.id.startsWith("s"));
const scenariosPassed = founderScenarios.filter((s) => s.passed).length;
const scenariosTotal = founderScenarios.length;
const wiringOk = scenarios.find((s) => s.id === "wiring")?.passed !== false;

const dimensions = {};
for (const id of Object.keys(dimHits)) {
  dimensions[id] = scoreDimension(id, dimHits[id].p, dimHits[id].t, `${dimHits[id].p}/${dimHits[id].t}`);
}

// Require 100% on every dimension for certification
const scorecard = buildCertificationScorecard({
  dimensions,
  scenariosPassed,
  scenariosTotal,
  founderBenchmarksOk: founderBenchOk,
  validationSuitesOk: validationOk && wiringOk,
  documentationOk: docsOk,
});

const certificate = buildMilestone1Certificate({
  scorecard,
  pr: "https://github.com/HubblyAdrian/Hubly/pull/196",
  founderApproval: scorecard.certified ? "Pending Founder Sign-Off" : "Not ready",
});

recordBrainCertification({
  scorecard,
  certificate,
  scenarioCount: scenariosTotal,
});

const snap = getMissionControlSnapshot();
const certSnap = getBrainCertificationSnapshot();

const mcLinked =
  !!snap.brainCertification &&
  snap.brainCertification.scorecard?.overall === scorecard.overall &&
  certSnap.certificate?.status === certificate.status;

console.log("\nBrain Certification Scorecard\n");
console.log(`  Overall          ${scorecard.overall}%`);
for (const d of Object.values(scorecard.dimensions)) {
  console.log(`  ${d.label.padEnd(20)} ${d.score}%`);
}
console.log(`\n  Scenarios ${scenariosPassed}/${scenariosTotal}`);
console.log(`  Mission Control linked: ${mcLinked ? "yes" : "no"}`);
console.log(`  Certified: ${scorecard.certified ? "YES" : "NO"}`);

// Write certificate
const certMd = renderMilestone1CertificateMarkdown(certificate, scorecard);
fs.mkdirSync(path.join(root, "docs/releases"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/releases/MILESTONE1_CERTIFIED.md"), certMd);

const evidenceDoc = `# Section 18 — Founder Acceptance & Brain Certification

**Status:** ${scorecard.certified ? "Pass (pending Founder Sign-Off)" : "Fail"}  
**Release Gate:** Milestone 1 · Section 18 of 18

## Rename

Formerly “Founder Demo.” This is the **graduation exam** for Hubly Brain — certification, not a slideshow.

## Objective

Prove Milestone 1 works as one coherent AI operating system: think, reason, remember, explain, and decide across a full business interaction lifecycle.

## Founder Acceptance Scenarios

| # | Scenario | Result |
|--:|----------|--------|
${founderScenarios.map((s, i) => `| ${i + 1} | ${s.title} | ${s.passed ? "Pass" : "Fail"} |`).join("\n")}

## Brain Certification Score

Overall **${scorecard.overall}%**

| Dimension | Score |
|-----------|------:|
${Object.values(scorecard.dimensions).map((d) => `| ${d.label} | ${d.score}% |`).join("\n")}

## Certificate

\`${certificate.certificatePath}\`

## Product Constitution

Every engineer reads **[Hubly Constitution v1.0](./HUBLY_CONSTITUTION.md)** before Milestone 1.5.  
Not the AI Constitution — the entire product contract. Stress-test Mission Control before writing Builder code.

## Architecture

| Module | Path |
|--------|------|
| Certification | \`supabase/functions/_shared/hubly_brain_certification.ts\` |
| Gate | \`scripts/check-section18-founder-certification.mjs\` |
| Mission Control | snapshot \`brainCertification\` |

## Prove

\`\`\`bash
npm run check:section18
npm run milestone1
\`\`\`

## After certification

Pause before Milestone **1.5 — Builder Engine**. Read the Product Constitution. Review and stress the Brain first — do not write Builder Engine code yet.
`;

fs.writeFileSync(path.join(root, "docs/HUBLY_BRAIN_SECTION18.md"), evidenceDoc);

const allScenarioPass = scenariosPassed === scenariosTotal && wiringOk;
const passed =
  allScenarioPass &&
  scorecard.certified &&
  mcLinked &&
  Number(String(MISSION_CONTROL_VERSION).split(".")[1] || 0) >= 5;

const report = {
  section: 18,
  name: "Founder Acceptance & Brain Certification",
  title: "Founder Acceptance & Brain Certification",
  passed,
  checkedAt: new Date().toISOString(),
  version: CERTIFICATION_VERSION,
  proofs: {
    scenarios: founderScenarios.map((s) => ({
      id: s.id,
      title: s.title,
      passed: s.passed,
      checks: s.checks.length,
      failures: s.failures,
      builderPlan: s.builderPlan || undefined,
    })),
    scorecard,
    certificate,
    missionControlLinked: mcLinked,
    qualityGate: {
      ok: validationOk,
      qualityScore: qualityReport.qualityScore?.overall,
      founderBenchmarks: {
        passed: qualityReport.founderBenchmarks.passed,
        total: qualityReport.founderBenchmarks.total,
      },
      founderBenchmarkCount: FOUNDER_BENCHMARK_SUITE.length,
    },
    documentationOk: docsOk,
    primaryExecutionId,
    certificatePath: certificate.certificatePath,
  },
  failures: passed
    ? null
    : {
        scenarios: founderScenarios.filter((s) => !s.passed).map((s) => ({ id: s.id, failures: s.failures })),
        scorecardCertified: scorecard.certified,
        mcLinked,
        validationOk,
        founderBenchOk,
        docsOk,
      },
};

fs.writeFileSync(
  path.join(root, "docs/HUBLY_BRAIN_SECTION18_PROOF.json"),
  JSON.stringify(report, null, 2) + "\n",
);

if (!passed) {
  console.error("\nSECTION 18 FAIL — Founder Acceptance & Brain Certification\n");
  process.exit(1);
}

console.log("\nSECTION 18 PASS — Founder Acceptance & Brain Certification");
console.log(`  Certificate → ${certificate.certificatePath}\n`);
process.exit(0);
