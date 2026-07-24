/** Node mirror of hubly_brain_mission_control.ts — Sections 12/14/15/16/17 (esbuild). */


// supabase/functions/_shared/hubly_brain_mission_control.ts
import { listExperts } from "./expert-framework.mjs";
import { listTools, listKnowledgeSources, ensureRegistriesBootstrapped } from "./registries.mjs";
import {
  getObservabilityDashboard,
  getCostReport,
  computeTrustScore,
  getCircuitSnapshot,
  listQueuedWork,
  getReliabilityManifest
} from "./reliability.mjs";
import { getPlatformInventory } from "./platform.mjs";
import {
  getQualityScoreSnapshot,
  getLastQualityReport,
  getQualityManifest
} from "./quality-core.mjs";
import {
  getHublyDocumentationCatalog
} from "./docs.mjs";
import {
  getBrainCertificationSnapshot
} from "./certification.mjs";
var MISSION_CONTROL_VERSION = "1.5.0";
var MISSION_CONTROL_OWNER = "hubly_brain";
var FLIGHTS = /* @__PURE__ */ new Map();
var FLIGHT_ORDER = [];
var MAX_FLIGHTS = 200;
var expertAgg = /* @__PURE__ */ new Map();
var lastLiveActivity = {
  hubly_brain: "idle",
  research: "idle",
  strategy: "idle",
  creative_director: "idle",
  critic: "idle",
  decision: "idle",
  builder: "pending_approval"
};
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function cloneFlight(f) {
  return JSON.parse(JSON.stringify(f));
}
function recordFlightRecorder(opts) {
  const startedAt = opts.startedAt || new Date(Date.now() - (opts.latencyMs || 0)).toISOString();
  const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  const startMs = Date.parse(startedAt) || Date.now();
  const experts = opts.expertsExecuted || [];
  const timeline = [];
  let t = 0;
  const push = (phase, detail, meta, dt = 0) => {
    t += dt;
    timeline.push({
      at: new Date(startMs + t).toISOString(),
      t,
      phase,
      detail,
      meta
    });
  };
  push("request", `Owner: ${String(opts.request || "").slice(0, 200)}`, { intent: opts.intent }, 0);
  push("hubly_brain", "Thinking\u2026", { status: "thinking" }, 20);
  for (const m of opts.memoriesLoaded || []) {
    push("memory_loaded", `Loaded ${m}`, { memory: m }, 30);
  }
  if ((opts.dnaFactsUsed || []).length) {
    push("business_dna", `Business DNA loaded (${opts.dnaFactsUsed.length} facts)`, {
      facts: opts.dnaFactsUsed
    }, 40);
  }
  for (const ex of experts) {
    const status = ex.status === "failed" ? "failed" : "finished";
    push(ex.expertId, `${ex.expertId}: ${status}`, {
      confidence: ex.confidence,
      ms: ex.ms,
      summary: ex.summary
    }, Math.max(10, Math.min(ex.ms || 50, 200)));
  }
  for (const r of opts.reasoningObjects || []) {
    push("reasoning", `Reasoning Object: ${r.decisionKey}`, {
      reasoningId: r.reasoningId,
      decision: r.decision,
      confidence: r.confidence
    }, 15);
  }
  for (const d of opts.decisionObjects || []) {
    push("decision", `Decision: ${d.finalDecision} (${d.decisionScore}%)`, {
      decisionId: d.decisionId,
      recommendation: d.recommendation,
      requiresApproval: d.requiresApproval
    }, 15);
  }
  for (const c of opts.capabilitiesSelected || []) {
    push("capability", `${c.label} \u2192 ${c.toolId}`, c, 10);
  }
  for (const k of opts.knowledgeAccessed || []) {
    push("knowledge", `Knowledge: ${k.name} (${k.access})`, k, 10);
  }
  if (opts.builderIntent) {
    push("builder_intent", `Builder Intent: ${opts.builderIntent.label}`, {
      ...opts.builderIntent
    }, 15);
  }
  if (opts.changePlan) {
    push("change_plan", `Change Plan: ${opts.changePlan.title}`, {
      ...opts.changePlan
    }, 15);
  }
  if (opts.preview) {
    push("preview", `Preview: ${opts.preview.headline} (${opts.preview.title})`, {
      ...opts.preview
    }, 15);
  }
  if (opts.collaboration) {
    push("collaboration", `Collaboration: ${opts.collaboration.openingPrompt}`, {
      ...opts.collaboration
    }, 12);
    if (opts.collaboration.recommendationLabel) {
      push("recommendation", `Recommend: ${opts.collaboration.recommendationLabel}`, {
        confidence: opts.collaboration.recommendationConfidence
      }, 8);
    }
    if (opts.collaboration.iterations > 0) {
      push("refinement", `Iterations: ${opts.collaboration.iterations}`, {
        iterations: opts.collaboration.iterations
      }, 5);
    }
    if (opts.collaboration.hasSummary) {
      push("approval_summary", `Launch CTA: ${opts.collaboration.launchCta || "Let's launch this."}`, {
        launchCta: opts.collaboration.launchCta,
        ownerConfidence: opts.collaboration.ownerConfidence
      }, 8);
    }
  }
  if (opts.businessVersion) {
    push("version_created", `Business Version ${opts.businessVersion.label}`, {
      ...opts.businessVersion
    }, 12);
  }
  for (const w of opts.memoryWrites || []) {
    push("memory_write", `Wrote ${w.system}: ${w.summary}`, w, 10);
  }
  push("response", `Final response ready`, {
    preview: String(opts.finalResponse || "").slice(0, 160)
  }, 20);
  const liveActivity = {
    hubly_brain: "finished",
    research: experts.some((e) => e.expertId === "research") ? experts.find((e) => e.expertId === "research").status === "failed" ? "failed" : "finished" : "idle",
    strategy: experts.some((e) => e.expertId === "strategy") ? "finished" : "idle",
    creative: experts.some((e) => e.expertId === "creative_director") ? "running" : "idle",
    critic: experts.some((e) => e.expertId === "critic") ? "waiting" : "idle",
    decision: opts.decisionAction || "idle",
    builder: experts.some((e) => e.expertId === "builder") ? "finished" : opts.decisionAction === "recommend" || opts.decisionAction === "proceed" ? "pending_approval" : "idle"
  };
  if (experts.some((e) => e.expertId === "creative_director")) liveActivity.creative = "finished";
  if (experts.some((e) => e.expertId === "critic")) liveActivity.critic = "finished";
  lastLiveActivity = { ...liveActivity };
  const flight = {
    executionId: opts.executionId || newId("flt"),
    request: String(opts.request || ""),
    intent: String(opts.intent || "general"),
    businessId: opts.businessId ?? null,
    startedAt,
    finishedAt,
    latencyMs: Math.max(0, Math.round(opts.latencyMs || 0)),
    ok: opts.ok !== false,
    memoriesLoaded: [...opts.memoriesLoaded || []],
    dnaFactsUsed: [...opts.dnaFactsUsed || []],
    expertsExecuted: experts.map((e) => ({ ...e })),
    expertOrder: experts.map((e) => e.expertId),
    reasoningObjects: [...opts.reasoningObjects || []],
    decisionObjects: [...opts.decisionObjects || []],
    capabilitiesSelected: [...opts.capabilitiesSelected || []],
    knowledgeAccessed: [...opts.knowledgeAccessed || []],
    finalResponse: String(opts.finalResponse || ""),
    memoryWrites: [...opts.memoryWrites || []],
    timeline,
    liveActivity,
    confidence: opts.confidence ?? null,
    decisionScore: opts.decisionScore ?? null,
    decisionAction: opts.decisionAction ?? null,
    builderIntent: opts.builderIntent ? { ...opts.builderIntent } : null,
    changePlan: opts.changePlan ? { ...opts.changePlan } : null,
    preview: opts.preview ? { ...opts.preview } : null,
    collaboration: opts.collaboration ? { ...opts.collaboration } : null,
    businessVersion: opts.businessVersion ? { ...opts.businessVersion } : null
  };
  FLIGHTS.set(flight.executionId, flight);
  FLIGHT_ORDER.push(flight.executionId);
  while (FLIGHT_ORDER.length > MAX_FLIGHTS) {
    const old = FLIGHT_ORDER.shift();
    if (old) FLIGHTS.delete(old);
  }
  for (const ex of experts) {
    const cur = expertAgg.get(ex.expertId) || {
      name: ex.expertId,
      runs: 0,
      successes: 0,
      failures: 0,
      latencySum: 0,
      confidenceSum: 0,
      decisionScoreSum: 0,
      decisionScoreN: 0
    };
    cur.runs += 1;
    if (ex.status === "failed") cur.failures += 1;
    else cur.successes += 1;
    cur.latencySum += ex.ms || 0;
    cur.confidenceSum += ex.confidence || 0;
    if (typeof opts.decisionScore === "number") {
      cur.decisionScoreSum += opts.decisionScore;
      cur.decisionScoreN += 1;
    }
    expertAgg.set(ex.expertId, cur);
  }
  return cloneFlight(flight);
}
function getFlightRecorder(executionId) {
  const f = FLIGHTS.get(String(executionId));
  return f ? cloneFlight(f) : null;
}
function listFlightRecorders(limit = 50) {
  const n = Math.max(1, Math.min(MAX_FLIGHTS, limit));
  return FLIGHT_ORDER.slice(-n).map((id) => cloneFlight(FLIGHTS.get(id))).filter(Boolean);
}
function replayExecution(executionId) {
  const flight = getFlightRecorder(executionId);
  if (!flight) {
    return { executionId, replay: true, steps: [], flight: null, summary: null };
  }
  return {
    executionId: flight.executionId,
    replay: true,
    steps: flight.timeline.map((e) => ({ ...e, meta: e.meta ? { ...e.meta } : void 0 })),
    flight,
    summary: {
      request: flight.request,
      memoriesLoaded: [...flight.memoriesLoaded],
      dnaFactsUsed: [...flight.dnaFactsUsed],
      expertOrder: [...flight.expertOrder],
      reasoningCount: flight.reasoningObjects.length,
      decisionCount: flight.decisionObjects.length,
      capabilities: flight.capabilitiesSelected.map((c) => `${c.label}\u2192${c.toolId}`),
      knowledge: flight.knowledgeAccessed.map((k) => k.name),
      finalResponse: flight.finalResponse,
      memoryWrites: flight.memoryWrites.map((w) => `${w.system}: ${w.summary}`)
    }
  };
}
function computeAiHealth() {
  const flights = listFlightRecorders(MAX_FLIGHTS);
  const n = flights.length || 1;
  const ok = flights.filter((f) => f.ok).length;
  const latency = flights.reduce((a, f) => a + f.latencyMs, 0);
  const conf = flights.filter((f) => typeof f.confidence === "number");
  const scores = flights.filter((f) => typeof f.decisionScore === "number");
  return {
    executions: flights.length,
    okRate: flights.length ? Math.round(ok / flights.length * 100) : 100,
    avgLatencyMs: flights.length ? Math.round(latency / flights.length) : 0,
    avgConfidence: conf.length ? Math.round(conf.reduce((a, f) => a + (f.confidence || 0), 0) / conf.length) : 0,
    avgDecisionScore: scores.length ? Math.round(scores.reduce((a, f) => a + (f.decisionScore || 0), 0) / scores.length) : null,
    errors: flights.length - ok,
    providerStatus: getCircuitSnapshot().some((c) => c.state === "open") ? "degraded" : "ready",
    reasoningObjectsRecorded: flights.reduce((a, f) => a + f.reasoningObjects.length, 0),
    decisionObjectsRecorded: flights.reduce((a, f) => a + f.decisionObjects.length, 0)
  };
}
function getExpertActivity() {
  const registered = listExperts();
  const ids = /* @__PURE__ */ new Set([...expertAgg.keys(), ...registered.map((e) => e.id)]);
  return [...ids].map((id) => {
    const a = expertAgg.get(id);
    const def = registered.find((e) => e.id === id);
    if (!a) {
      return {
        expertId: id,
        name: def?.name || id,
        runs: 0,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
        avgConfidence: 0,
        failureRate: 0,
        successRate: 0,
        avgDecisionScore: null
      };
    }
    return {
      expertId: id,
      name: def?.name || a.name,
      runs: a.runs,
      successes: a.successes,
      failures: a.failures,
      avgLatencyMs: a.runs ? Math.round(a.latencySum / a.runs) : 0,
      avgConfidence: a.runs ? Math.round(a.confidenceSum / a.runs) : 0,
      failureRate: a.runs ? Math.round(a.failures / a.runs * 100) : 0,
      successRate: a.runs ? Math.round(a.successes / a.runs * 100) : 0,
      avgDecisionScore: a.decisionScoreN ? Math.round(a.decisionScoreSum / a.decisionScoreN) : null
    };
  });
}
function getMissionControlSnapshot() {
  ensureRegistriesBootstrapped();
  const flights = listFlightRecorders(20);
  const latest = flights.length ? flights[flights.length - 1] : null;
  const decisionGraph = {
    nodes: [
      { key: "homepage", label: "Homepage" },
      { key: "booking", label: "Booking" },
      { key: "packages", label: "Packages" },
      { key: "website", label: "Website" },
      { key: "growth", label: "Growth" },
      { key: "automation", label: "Automation" }
    ],
    edges: [
      { from: "homepage", to: "booking" },
      { from: "booking", to: "packages" },
      { from: "packages", to: "website" },
      { from: "website", to: "growth" },
      { from: "growth", to: "automation" }
    ]
  };
  if (latest?.reasoningObjects?.length) {
    const nodes = latest.reasoningObjects.map((r) => ({
      key: r.decisionKey,
      label: r.decision.slice(0, 48)
    }));
    if (nodes.length) {
      decisionGraph.nodes = nodes;
      decisionGraph.edges = nodes.slice(0, -1).map((n, i) => ({
        from: n.key,
        to: nodes[i + 1].key
      }));
    }
  }
  return {
    version: MISSION_CONTROL_VERSION,
    title: "Hubly Mission Control",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    liveAiActivity: { ...lastLiveActivity },
    expertActivity: getExpertActivity(),
    businessMemory: {
      inspectable: true,
      note: "Inspect / compare / restore Business Memory versions (Brain-owned)."
    },
    workspaceMemory: {
      inspectable: true,
      note: "Inspect / replay / compare Workspace Memory preferences."
    },
    conversationIntelligence: {
      inspectable: true,
      note: "Active conversations, projects, threads, deferred ideas, promises."
    },
    decisionGraph,
    builderActions: (() => {
      const intents = flights.map((f) => f.builderIntent).filter((x) => !!x).slice(-10).reverse();
      const changePlans = flights.map((f) => f.changePlan).filter((x) => !!x).slice(-10).reverse();
      const previews = flights.map((f) => f.preview).filter((x) => !!x).slice(-10).reverse();
      const collaborations = flights.map((f) => f.collaboration).filter((x) => !!x).slice(-10).reverse();
      const versions = flights.map((f) => f.businessVersion).filter((x) => !!x).slice(-10).reverse();
      return {
        milestone: "1.5",
        available: false,
        epic: "5 \u2014 Version & Rollback",
        note: "Epic 5 \u2014 Versions + rollback plans. Business Timeline. Waiting for Apply Engine. No execute.",
        recent: versions.length ? versions.map((v) => ({
          id: v.id,
          status: v.status,
          summary: `${v.label} \xB7 ${v.changeCount} change(s) \xB7 rollback available`,
          changePlanId: v.changePlanId || void 0
        })) : collaborations.length ? collaborations.map((c) => ({
          id: c.id,
          status: c.status,
          summary: `${c.openingPrompt} \xB7 ${c.iterations} iteration(s)${c.launchCta ? ` \xB7 ${c.launchCta}` : ""}`,
          changePlanId: c.changePlanId
        })) : previews.length ? previews.map((p) => ({
          id: p.id,
          status: "preview_ready",
          summary: `${p.headline} \xB7 ${p.title} (v${p.currentVersion})`,
          risk: void 0,
          confidence: void 0,
          affectedSystems: void 0,
          changePlanId: p.changePlanId
        })) : changePlans.length ? changePlans.map((p) => ({
          id: p.id,
          status: "change_plan_draft",
          summary: `${p.title} (${p.actionCount} actions)`,
          risk: p.risk,
          confidence: p.confidence,
          affectedSystems: p.affectedSystems,
          changePlanId: p.id
        })) : intents.map((i) => ({
          id: i.intentId,
          status: "intent_only",
          summary: `${i.label}: ${i.goal}`,
          category: i.category,
          risk: i.risk,
          confidence: i.confidence,
          affectedSystems: i.affectedSystems,
          capabilities: i.capabilities,
          confidenceExplanation: i.confidenceExplanation
        })),
        intents,
        changePlans,
        previews,
        collaborations,
        versions,
        versionHistoryNote: "Current \u2192 History \u2192 Diff \u2192 Rollback availability \u2192 AI restore suggestions. Try it \u2014 you can always go back."
      };
    })(),
    capabilityRegistry: listTools().map((t) => ({
      toolId: t.id,
      name: t.name,
      capabilityCount: t.capabilities.length
    })),
    knowledgeRegistry: listKnowledgeSources().map((k) => ({
      id: k.id,
      name: k.name,
      access: k.access === "read" ? "Read Only" : "Read + Write"
    })),
    brainTimeline: latest?.timeline || [],
    aiHealth: computeAiHealth(),
    recentExecutions: flights.slice(-10).reverse().map((f) => ({
      executionId: f.executionId,
      request: f.request.slice(0, 120),
      at: f.finishedAt,
      ok: f.ok,
      latencyMs: f.latencyMs
    })),
    replayAvailable: true,
    performance: getObservabilityDashboard(),
    costAwareness: getCostReport(),
    reliability: {
      circuits: getCircuitSnapshot(),
      queuedWork: listQueuedWork(),
      manifest: getReliabilityManifest()
    },
    trustScore: computeTrustScore({
      aiHealthOkRate: computeAiHealth().okRate,
      avgDecisionScore: computeAiHealth().avgDecisionScore,
      avgLatencyMs: computeAiHealth().avgLatencyMs
    }),
    platformInventory: getPlatformInventory(),
    qualityAssurance: (() => {
      const last = getLastQualityReport();
      const score = getQualityScoreSnapshot();
      return {
        score,
        lastRunAt: last?.checkedAt || null,
        ok: last ? last.ok : null,
        scenarioPassRate: last ? Math.round(last.scenarioLibrary.passed / Math.max(1, last.scenarioLibrary.total) * 100) : null,
        founderBenchmarkPassRate: last ? Math.round(last.founderBenchmarks.passed / Math.max(1, last.founderBenchmarks.total) * 100) : null,
        identityComplianceRate: last?.identityCompliance.rate ?? null,
        manifest: getQualityManifest()
      };
    })(),
    documentation: getHublyDocumentationCatalog(),
    brainCertification: getBrainCertificationSnapshot()
  };
}
function clearMissionControlForTests() {
  FLIGHTS.clear();
  FLIGHT_ORDER.length = 0;
  expertAgg.clear();
  lastLiveActivity = {
    hubly_brain: "idle",
    research: "idle",
    strategy: "idle",
    creative_director: "idle",
    critic: "idle",
    decision: "idle",
    builder: "pending_approval"
  };
}
var HublyMissionControl = {
  version: MISSION_CONTROL_VERSION,
  owner: MISSION_CONTROL_OWNER,
  record: recordFlightRecorder,
  getFlight: getFlightRecorder,
  listFlights: listFlightRecorders,
  replay: replayExecution,
  snapshot: getMissionControlSnapshot,
  expertActivity: getExpertActivity,
  trustScore: computeTrustScore,
  performance: getObservabilityDashboard,
  costAwareness: getCostReport,
  platformInventory: getPlatformInventory,
  qualityScore: getQualityScoreSnapshot,
  documentation: getHublyDocumentationCatalog,
  brainCertification: getBrainCertificationSnapshot,
  clearForTests: clearMissionControlForTests
};
var hubly_brain_mission_control_default = HublyMissionControl;
export {
  HublyMissionControl,
  MISSION_CONTROL_OWNER,
  MISSION_CONTROL_VERSION,
  clearMissionControlForTests,
  hubly_brain_mission_control_default as default,
  getExpertActivity,
  getFlightRecorder,
  getMissionControlSnapshot,
  listFlightRecorders,
  recordFlightRecorder,
  replayExecution
};
