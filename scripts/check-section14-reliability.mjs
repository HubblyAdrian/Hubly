#!/usr/bin/env node
/**
 * Section 14 — Performance, Reliability & Resilience (Release Gate)
 *
 * Trustworthiness under real-world conditions — not just speed.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RELIABILITY_VERSION,
  RELIABILITY_OWNER,
  DEFAULT_TIMEOUTS,
  DEFAULT_RETRY_POLICY,
  HublyReliability,
  clearReliabilityForTests,
  ownerSafeError,
  withTimeout,
  withRetry,
  circuitAllow,
  circuitFailure,
  circuitSuccess,
  getCircuitSnapshot,
  gracefulDegrade,
  cacheMemoryGet,
  cacheMemorySet,
  cacheDnaSet,
  cacheDnaGet,
  recordMetric,
  recordAiCost,
  getObservabilityDashboard,
  getCostReport,
  assertMemoryIsolation,
  assertExpertPermission,
  assertToolPermission,
  assertCapabilityAccess,
  listAuditLog,
  computeTrustScore,
  getReliabilityManifest,
  demoResearchExpertRetry,
  demoWeatherTimeout,
  demoStripeQueue,
  demoParallelExperts,
} from "./lib/reliability.mjs";

import {
  clearMissionControlForTests,
  getMissionControlSnapshot,
  MISSION_CONTROL_VERSION,
} from "./lib/mission-control.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failures.push({ name, error: e.message });
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

clearReliabilityForTests();
clearMissionControlForTests();

console.log("\nSection 14 — Performance, Reliability & Resilience\n");

await check("module identity + manifest", () => {
  assert.equal(RELIABILITY_VERSION, "1.0.0");
  assert.equal(RELIABILITY_OWNER, "hubly_brain");
  const m = getReliabilityManifest();
  assert.equal(m.name, "Performance, Reliability & Resilience");
  for (const f of [
    "retry_logic",
    "timeouts",
    "circuit_breakers",
    "graceful_degradation",
    "parallel_experts",
    "memory_caching",
    "dna_caching",
    "latency_tracking",
    "cost_awareness",
    "security_boundaries",
    "trust_score",
  ]) {
    assert.ok(m.features.includes(f), f);
  }
  assert.ok(DEFAULT_TIMEOUTS.expert > 0);
  assert.ok(DEFAULT_RETRY_POLICY.maxRetries >= 1);
});

await check("timeouts are enforced", async () => {
  let hit = false;
  try {
    await withTimeout(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return 1;
    }, 15, "probe");
  } catch (e) {
    hit = /timed out/i.test(e.message);
  }
  assert.ok(hit);
});

await check("retry policies recover after transient failure", async () => {
  let n = 0;
  const { value, retries } = await withRetry(
    async () => {
      n += 1;
      if (n === 1) throw new Error("transient");
      return "ok";
    },
    { maxRetries: 1, baseDelayMs: 5, maxDelayMs: 20, retryOnTimeout: true },
    { label: "probe_retry", provider: "hubly_brain" },
  );
  assert.equal(value, "ok");
  assert.equal(retries, 1);
});

await check("circuit breaker opens after repeated failures", () => {
  clearReliabilityForTests();
  assert.equal(circuitAllow("openai"), true);
  circuitFailure("openai", new Error("slow"));
  circuitFailure("openai", new Error("slow"));
  circuitFailure("openai", new Error("slow"));
  assert.equal(circuitAllow("openai"), false);
  const snap = getCircuitSnapshot("openai")[0];
  assert.equal(snap.state, "open");
  circuitSuccess("openai"); // reset path for later demos
});

await check("owner never sees raw system errors", () => {
  const a = ownerSafeError("OpenAI timeout stack at probe.ts:1");
  assert.ok(!/stack at probe/i.test(a));
  assert.ok(!/\.ts:\d+/.test(a));
  const b = ownerSafeError("Stripe lookup failed: api_key sk_test_xxx");
  assert.ok(!/sk_test/i.test(b));
  const c = ownerSafeError("Weather provider ETIMEDOUT");
  assert.match(c, /weather|continue/i);
});

await check("Demo: Research Expert fails → retry / degrade gracefully", async () => {
  clearReliabilityForTests();
  const d = await demoResearchExpertRetry();
  assert.equal(d.ok, true);
  assert.ok(d.retries >= 1);
  assert.equal(d.exposedRawError, false);
});

await check("Demo: Weather provider times out → explain and continue", async () => {
  const d = await demoWeatherTimeout();
  assert.equal(d.ok, true);
  assert.equal(d.continued, true);
  assert.ok(d.ownerMessage.length > 10);
  assert.equal(d.safeDefaults.weatherAvailable, false);
});

await check("Demo: Stripe lookup fails → queue + inform owner", async () => {
  const d = await demoStripeQueue();
  assert.equal(d.ok, true);
  assert.equal(d.queued, true);
  assert.ok(d.queueSize >= 1);
  assert.ok(!/sk_test/i.test(d.ownerMessage));
});

await check("Demo: parallel experts — slow expert does not block assembly", async () => {
  const d = await demoParallelExperts();
  assert.equal(d.ok, true);
  assert.equal(d.order.length, 3);
  assert.ok(d.parallelFasterThanSerial, `wall=${d.wallMs} slowest=${d.slowestMs}`);
});

await check("memory + DNA caching with isolation", () => {
  clearReliabilityForTests();
  cacheMemorySet("biz_a", { name: "A" });
  cacheMemorySet("biz_b", { name: "B" });
  assert.equal(cacheMemoryGet("biz_a").name, "A");
  assert.equal(cacheMemoryGet("biz_b").name, "B");
  cacheDnaSet("biz_a", { industry: "pressure washing" });
  assert.equal(cacheDnaGet("biz_a").industry, "pressure washing");
  assert.equal(cacheDnaGet("biz_b"), null);
  const iso = assertMemoryIsolation("biz_a", "biz_b");
  assert.equal(iso.ok, true);
});

await check("observability metrics recorded", () => {
  recordMetric("ai_latency", "complete", 120, true);
  recordMetric("tool_latency", "booking", 40, true);
  recordMetric("memory_load", "business_memory", 12, true);
  recordMetric("decision_time", "decide", 18, true);
  recordMetric("builder_execution", "builder", 0, true, { milestone: "1.5" });
  const dash = getObservabilityDashboard();
  assert.ok(dash.samples >= 5);
  assert.ok(dash.aiLatencyMs.samples >= 1);
  assert.ok(typeof dash.failureRate === "number");
  assert.ok(typeof dash.retryRate === "number");
});

await check("cost awareness — tokens + expensive experts + reuse", () => {
  recordAiCost({
    expertId: "research",
    prompt: "a".repeat(400),
    completion: "b".repeat(200),
    model: "gpt-test",
  });
  recordAiCost({
    expertId: "strategy",
    prompt: "short",
    completion: "ok",
    reusedReasoning: true,
  });
  const cost = getCostReport();
  assert.ok(cost.totalTokens > 0);
  assert.ok(cost.estimatedCostUsd >= 0);
  assert.ok(cost.mostExpensiveExperts.length >= 1);
  assert.ok(cost.mostExpensiveExperts.some((e) => e.expertId === "research"));
});

await check("security boundaries + audit log", () => {
  const e1 = assertExpertPermission("research", "weather");
  assert.equal(e1.ok, true);
  const e2 = assertExpertPermission("critic", "website");
  assert.equal(e2.ok, false);
  const t1 = assertToolPermission("weather", "forecast", "write");
  assert.equal(t1.ok, false);
  const c1 = assertCapabilityAccess("biz_1", "arrival_windows", { ownerBusinessId: "biz_1" });
  assert.equal(c1.ok, true);
  const c2 = assertCapabilityAccess("biz_hacker", "arrival_windows", { ownerBusinessId: "biz_1" });
  assert.equal(c2.ok, false);
  const audits = listAuditLog(20);
  assert.ok(audits.length >= 3);
});

await check("Hubly Trust Score for engineering", () => {
  const trust = computeTrustScore({
    aiHealthOkRate: 99,
    avgDecisionScore: 97,
    avgLatencyMs: 200,
  });
  assert.ok(trust.overall >= 80 && trust.overall <= 100);
  assert.ok(trust.dimensions.aiReliability >= 80);
  assert.ok(trust.dimensions.memoryIntegrity >= 80);
  assert.ok(trust.dimensions.decisionQuality >= 80);
  assert.ok(trust.dimensions.performance >= 70);
  assert.ok(trust.dimensions.expertSuccess >= 70);
  assert.ok(trust.dimensions.providerHealth >= 70);
  assert.match(trust.note, /not shown to customers/i);
});

await check("Mission Control displays performance + trust + cost", () => {
  // Seed a few metrics so snapshot is non-empty
  recordMetric("ai_latency", "think", 90, true);
  recordAiCost({ expertId: "creative_director", prompt: "site", completion: "built" });
  const snap = getMissionControlSnapshot();
  assert.ok(snap.performance);
  assert.ok(typeof snap.performance.aiLatencyMs.avg === "number");
  assert.ok(snap.costAwareness);
  assert.ok(typeof snap.costAwareness.estimatedCostUsd === "number");
  assert.ok(snap.reliability?.manifest?.features?.includes("trust_score"));
  assert.ok(snap.trustScore);
  assert.ok(snap.trustScore.overall >= 0);
  assert.ok(snap.trustScore.dimensions.expertSuccess >= 0);
  assert.ok(Number(MISSION_CONTROL_VERSION.split(".")[0]) >= 1);
});

await check("graceful degradation continues with safe defaults", () => {
  const g = gracefulDegrade("google_calendar", new Error("Google Calendar 500"), {
    queueAction: "resync_calendar",
    businessId: "biz_cal",
  });
  assert.equal(g.continue, true);
  assert.equal(g.queued, true);
  assert.equal(g.safeDefaults.calendarAvailable, false);
});

await check("source wiring — Brain sole gate + ED timeouts + docs", () => {
  for (const rel of [
    "supabase/functions/_shared/hubly_brain_reliability.ts",
    "scripts/lib/reliability.mjs",
    "docs/HUBLY_BRAIN_SECTION14.md",
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
  const relSrc = read("supabase/functions/_shared/hubly_brain_reliability.ts");
  assert.match(relSrc, /computeTrustScore/);
  assert.match(relSrc, /withRetry/);
  assert.match(relSrc, /circuitFailure/);
  assert.match(relSrc, /runExpertsParallel/);
  const ef = read("supabase/functions/_shared/hubly_brain_expert_framework.ts");
  assert.match(ef, /withTimeout/);
  assert.match(ef, /DEFAULT_TIMEOUTS\.expert/);
  const mc = read("supabase/functions/_shared/hubly_brain_mission_control.ts");
  assert.match(mc, /trustScore/);
  assert.match(mc, /getObservabilityDashboard/);
  assert.match(mc, /getCostReport/);
  const ai = read("supabase/functions/_shared/hubly_ai.ts");
  assert.match(ai, /HublyReliability/);
  assert.equal(typeof HublyReliability.computeTrustScore, "function");
});

if (failures.length) {
  console.error(`\nFAILED ${failures.length} check(s)\n`);
  process.exit(1);
}

const trust = computeTrustScore({
  aiHealthOkRate: 99,
  avgDecisionScore: 97,
});
const obs = getObservabilityDashboard();
const cost = getCostReport();

const proof = {
  section: 14,
  name: "Performance, Reliability & Resilience",
  title: "Performance, Reliability & Resilience",
  status: "pass",
  passed: true,
  provenAt: new Date().toISOString(),
  summary:
    "Hubly is dependable under real-world conditions: retries, timeouts, circuit breakers, graceful degradation, parallel experts, memory/DNA caching, latency + cost observability, security boundaries, and an engineering Trust Score in Mission Control. Owners never see raw system errors.",
  proofs: {
    timeouts: DEFAULT_TIMEOUTS,
    retryPolicy: DEFAULT_RETRY_POLICY,
    demos: {
      researchRetry: await demoResearchExpertRetry(),
      weatherTimeout: await demoWeatherTimeout(),
      stripeQueue: await demoStripeQueue(),
      parallelExperts: await demoParallelExperts(),
    },
    observability: obs,
    costAwareness: {
      totalTokens: cost.totalTokens,
      estimatedCostUsd: cost.estimatedCostUsd,
      mostExpensiveExperts: cost.mostExpensiveExperts.slice(0, 3),
    },
    trustScore: trust,
    security: {
      memoryIsolation: assertMemoryIsolation("biz_sec_a", "biz_sec_b"),
      expertPermissionDenied: assertExpertPermission("critic", "website"),
      toolWriteDenied: assertToolPermission("weather", "forecast", "write"),
      auditEntries: listAuditLog(5).length,
    },
    missionControl: {
      surfaces: ["performance", "costAwareness", "reliability", "trustScore"],
      version: MISSION_CONTROL_VERSION,
    },
    hublyAiExportsReliability: true,
  },
};

fs.writeFileSync(
  path.join(root, "docs/HUBLY_BRAIN_SECTION14_PROOF.json"),
  JSON.stringify(proof, null, 2) + "\n",
);
console.log("\nWrote docs/HUBLY_BRAIN_SECTION14_PROOF.json");
console.log("Section 14 PASS\n");
process.exit(0);
