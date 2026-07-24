/**
 * Hubly Brain — Hubly Mission Control (Milestone 1 · Section 12)
 *
 * AI Headquarters — not just debugging.
 *
 * Surfaces:
 *   Live AI Activity · Expert Activity · Business / Workspace Memory ·
 *   Conversation Intelligence · Decision Graph · Builder Actions (1.5) ·
 *   Capability Registry · Knowledge Registry · Brain Timeline · AI Health
 *
 * AI Replay (flight recorder): for any execution, replay the full path —
 * request → memories → DNA → experts → reasoning → decisions →
 * capabilities → knowledge → response → memory writes.
 */

import { listExperts } from "./hubly_brain_expert_framework.ts";
import { listTools, listKnowledgeSources, ensureRegistriesBootstrapped } from "./hubly_brain_registries.ts";
import {
  getObservabilityDashboard,
  getCostReport,
  computeTrustScore,
  getCircuitSnapshot,
  listQueuedWork,
  getReliabilityManifest,
  type HublyTrustScore,
  type ObservabilityDashboard,
} from "./hubly_brain_reliability.ts";
import { getPlatformInventory } from "./hubly_brain_platform.ts";
import {
  getQualityScoreSnapshot,
  getLastQualityReport,
  getQualityManifest,
  type QualityScore,
} from "./hubly_brain_quality.ts";
import {
  getHublyDocumentationCatalog,
  type HublyDocumentationCatalog,
} from "./hubly_brain_docs.ts";
import {
  getBrainCertificationSnapshot,
  type BrainCertificationSnapshot,
} from "./hubly_brain_certification.ts";

export const MISSION_CONTROL_VERSION = "1.5.0" as const;
export const MISSION_CONTROL_OWNER = "hubly_brain" as const;

export type HublyLiveExpertStatus =
  | "idle"
  | "thinking"
  | "running"
  | "finished"
  | "waiting"
  | "failed"
  | "pending_approval";

export type HublyFlightEvent = {
  at: string;
  t: number; // ms from start
  phase: string;
  detail: string;
  meta?: Record<string, unknown>;
};

export type HublyFlightRecorder = {
  executionId: string;
  request: string;
  intent: string;
  businessId: string | null;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  ok: boolean;
  /** Memories loaded for this run */
  memoriesLoaded: string[];
  /** Business DNA fact ids / claims used */
  dnaFactsUsed: string[];
  /** Experts in order with outcomes */
  expertsExecuted: Array<{
    expertId: string;
    status: string;
    confidence: number;
    ms: number;
    summary: string;
  }>;
  expertOrder: string[];
  /** Reasoning Object ids + keys */
  reasoningObjects: Array<{
    reasoningId: string;
    decisionKey: string;
    decision: string;
    confidence: number;
  }>;
  /** Decision Object summaries */
  decisionObjects: Array<{
    decisionId: string;
    recommendation: string;
    finalDecision: string;
    decisionScore: number;
    requiresApproval: boolean;
  }>;
  capabilitiesSelected: Array<{ toolId: string; capabilityId: string; label: string }>;
  knowledgeAccessed: Array<{ knowledgeId: string; name: string; access: string }>;
  finalResponse: string;
  memoryWrites: Array<{ system: string; summary: string }>;
  timeline: HublyFlightEvent[];
  liveActivity: Record<string, HublyLiveExpertStatus | string>;
  confidence: number | null;
  decisionScore: number | null;
  decisionAction: string | null;
  /** Milestone 1.5 · Epic 1 — Builder Intent summary (no apply). */
  builderIntent: {
    intentId: string;
    category: string;
    label: string;
    goal: string;
    affectedSystems: string[];
    capabilities: string[];
    risk: string;
    confidence: number;
    confidenceExplanation: string;
    requiresChangePlan: boolean;
  applied: false;
  changePlanGenerated: false;
  } | null;
  /** Milestone 1.5 · Epic 2 — Change Plan summary (not executed). */
  changePlan: {
    id: string;
    intentId: string;
    title: string;
    builderType: string;
    affectedSystems: string[];
    actionCount: number;
    actions: Array<{ path: string; builderOwner: string; risk: string }>;
    risk: string;
    confidence: number;
    requiresApproval: boolean;
    validationOk: boolean;
    estimatedImpact: string;
    applied: false;
    executed: false;
    previewGenerated: boolean;
  } | null;
  /** Milestone 1.5 · Epic 3 — Preview summary (not applied). */
  preview: {
    id: string;
    changePlanId: string;
    intentId: string;
    title: string;
    headline: string;
    primarySurface: string;
    optionCount: number;
    versionCount: number;
    currentVersion: number;
    lifecycle: string;
    progressiveComplete: boolean;
    stageCount: number;
    compareModes: string[];
    applied: false;
    executed: false;
    published: false;
    mutatedLiveState: false;
    waitingFor: string;
  } | null;
  /** Milestone 1.5 · Epic 4 — Collaboration & Approval summary (not applied). */
  collaboration: {
    id: string;
    previewId: string;
    changePlanId: string;
    phase: string;
    openingPrompt: string;
    iterations: number;
    recommendationLabel: string | null;
    recommendationConfidence: number | null;
    alternativeCount: number;
    hasNegotiation: boolean;
    partialApprovalCount: number;
    hasSummary: boolean;
    launchCta: string | null;
    ownerConfidence: string | null;
    status: string;
    applied: false;
    executed: false;
    waitingFor: string;
  } | null;
  /** Milestone 1.5 · Epic 5 — Business Version summary (not applied / not rolled back). */
  businessVersion: {
    id: string;
    label: string;
    status: string;
    changePlanId: string | null;
    surfaces: string[];
    changeCount: number;
    parentVersionId: string | null;
    rollbackAvailable: true;
    applied: false;
    rollbackExecuted: false;
  } | null;
  /** Milestone 1.5 · Epic 6 — Creative Session (Business Builder; not applied). */
  creativeSession: {
    id: string;
    label: string;
    direction: string;
    decisionCount: number;
    surfacesTouched: string[];
    businessScoreOverall: number;
    preferenceCount: number;
    hasChallenge: boolean;
    requiresApproval: true;
    applied: false;
    executed: false;
    waitingFor: string;
  } | null;
  /** Milestone 1.5 · Epic 7 — Booking Intelligence (not applied). */
  bookingIntelligence: {
    id: string;
    label: string;
    ruleCount: number;
    concepts: string[];
    healthOverall: number;
    recommendationCount: number;
    simulatorHorizonDays: number;
    industry: string | null;
    requiresApproval: true;
    applied: false;
    executed: false;
    waitingFor: string;
  } | null;
  /** Milestone 1.5 · Epic 8 — Workspace Intelligence (not applied). */
  workspaceIntelligence: {
    id: string;
    label: string;
    changeCount: number;
    concepts: string[];
    healthOverall: number;
    recommendationCount: number;
    homepage: string;
    focusMode: string | null;
    deviceCount: number;
    requiresApproval: true;
    applied: false;
    executed: false;
    waitingFor: string;
  } | null;
  /** Milestone 1.5 · Epic 9 — Automation Intelligence (not applied / not executed). */
  automationIntelligence: {
    id: string;
    label: string;
    workflowCount: number;
    outcomes: string[];
    healthOverall: number;
    timeSavedHoursPerMonth: number;
    recommendationCount: number;
    discoveryCount: number;
    simulationHorizonDays: number;
    requiresApproval: true;
    applied: false;
    executed: false;
    waitingFor: string;
  } | null;
};

export type HublyExpertActivityStats = {
  expertId: string;
  name: string;
  runs: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  avgConfidence: number;
  failureRate: number;
  successRate: number;
  avgDecisionScore: number | null;
};

export type HublyAiHealth = {
  executions: number;
  okRate: number;
  avgLatencyMs: number;
  avgConfidence: number;
  avgDecisionScore: number | null;
  errors: number;
  providerStatus: "ready" | "degraded" | "unknown";
  reasoningObjectsRecorded: number;
  decisionObjectsRecorded: number;
};

export type HublyMissionControlSnapshot = {
  version: typeof MISSION_CONTROL_VERSION;
  title: "Hubly Mission Control";
  checkedAt: string;
  liveAiActivity: Record<string, string>;
  expertActivity: HublyExpertActivityStats[];
  businessMemory: { inspectable: true; note: string };
  workspaceMemory: { inspectable: true; note: string };
  conversationIntelligence: { inspectable: true; note: string };
  decisionGraph: { nodes: Array<{ key: string; label: string }>; edges: Array<{ from: string; to: string }> };
  builderActions: {
    milestone: "1.5";
    /** Apply still locked until later epics. */
    available: false;
    epic: string;
    note: string;
    recent: Array<{
      id: string;
      status: string;
      summary: string;
      category?: string;
      risk?: string;
      confidence?: number;
      affectedSystems?: string[];
      capabilities?: string[];
      confidenceExplanation?: string;
      changePlanId?: string;
    }>;
    /** Latest Builder Intents (Epic 1). */
    intents: Array<NonNullable<HublyFlightRecorder["builderIntent"]>>;
    /** Latest Change Plans (Epic 2). */
    changePlans: Array<NonNullable<HublyFlightRecorder["changePlan"]>>;
    /** Latest Previews (Epic 3). */
    previews: Array<NonNullable<HublyFlightRecorder["preview"]>>;
    /** Latest Collaboration sessions (Epic 4). */
    collaborations: Array<NonNullable<HublyFlightRecorder["collaboration"]>>;
    /** Latest Business Versions (Epic 5). */
    versions: Array<NonNullable<HublyFlightRecorder["businessVersion"]>>;
    versionHistoryNote: string;
    /** Latest Creative Sessions (Epic 6 — Business Builder). */
    creativeSessions: Array<NonNullable<HublyFlightRecorder["creativeSession"]>>;
    /** Latest Booking Intelligence plans (Epic 7). */
    bookingIntelligence: Array<NonNullable<HublyFlightRecorder["bookingIntelligence"]>>;
    /** Latest Workspace Intelligence plans (Epic 8). */
    workspaceIntelligence: Array<NonNullable<HublyFlightRecorder["workspaceIntelligence"]>>;
    /** Latest Automation Intelligence plans (Epic 9). */
    automationIntelligence: Array<NonNullable<HublyFlightRecorder["automationIntelligence"]>>;
  };
  capabilityRegistry: Array<{ toolId: string; name: string; capabilityCount: number }>;
  knowledgeRegistry: Array<{ id: string; name: string; access: string }>;
  brainTimeline: HublyFlightEvent[];
  aiHealth: HublyAiHealth;
  recentExecutions: Array<{ executionId: string; request: string; at: string; ok: boolean; latencyMs: number }>;
  replayAvailable: true;
  /** Section 14 — Performance, Reliability & Resilience */
  performance: ObservabilityDashboard;
  costAwareness: ReturnType<typeof getCostReport>;
  reliability: {
    circuits: ReturnType<typeof getCircuitSnapshot>;
    queuedWork: ReturnType<typeof listQueuedWork>;
    manifest: ReturnType<typeof getReliabilityManifest>;
  };
  /** Engineering Trust Score (not customer-facing). */
  trustScore: HublyTrustScore;
  /** Section 15 — live Feature Manifest inventory (platform extensibility). */
  platformInventory: ReturnType<typeof getPlatformInventory>;
  /** Section 16 — Validation & Quality Assurance score (engineering). */
  qualityAssurance: {
    score: QualityScore;
    lastRunAt: string | null;
    ok: boolean | null;
    scenarioPassRate: number | null;
    founderBenchmarkPassRate: number | null;
    identityComplianceRate: number | null;
    manifest: ReturnType<typeof getQualityManifest>;
  };
  /** Section 17 — Architecture Documentation & Developer Experience (versioned). */
  documentation: HublyDocumentationCatalog;
  /** Section 18 — Founder Acceptance & Brain Certification. */
  brainCertification: BrainCertificationSnapshot;
};

const FLIGHTS = new Map<string, HublyFlightRecorder>();
const FLIGHT_ORDER: string[] = [];
const MAX_FLIGHTS = 200;

const expertAgg = new Map<string, {
  name: string;
  runs: number;
  successes: number;
  failures: number;
  latencySum: number;
  confidenceSum: number;
  decisionScoreSum: number;
  decisionScoreN: number;
}>();

let lastLiveActivity: Record<string, string> = {
  hubly_brain: "idle",
  research: "idle",
  strategy: "idle",
  creative_director: "idle",
  critic: "idle",
  decision: "idle",
  builder: "pending_approval",
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneFlight(f: HublyFlightRecorder): HublyFlightRecorder {
  return JSON.parse(JSON.stringify(f)) as HublyFlightRecorder;
}

export type RecordFlightOpts = {
  request: string;
  intent: string;
  businessId?: string | null;
  startedAt?: string;
  latencyMs: number;
  ok?: boolean;
  memoriesLoaded?: string[];
  dnaFactsUsed?: string[];
  expertsExecuted?: HublyFlightRecorder["expertsExecuted"];
  reasoningObjects?: HublyFlightRecorder["reasoningObjects"];
  decisionObjects?: HublyFlightRecorder["decisionObjects"];
  capabilitiesSelected?: HublyFlightRecorder["capabilitiesSelected"];
  knowledgeAccessed?: HublyFlightRecorder["knowledgeAccessed"];
  finalResponse?: string;
  memoryWrites?: HublyFlightRecorder["memoryWrites"];
  confidence?: number | null;
  decisionScore?: number | null;
  decisionAction?: string | null;
  executionId?: string;
  builderIntent?: HublyFlightRecorder["builderIntent"];
  changePlan?: HublyFlightRecorder["changePlan"];
  preview?: HublyFlightRecorder["preview"];
  collaboration?: HublyFlightRecorder["collaboration"];
  businessVersion?: HublyFlightRecorder["businessVersion"];
  creativeSession?: HublyFlightRecorder["creativeSession"];
  bookingIntelligence?: HublyFlightRecorder["bookingIntelligence"];
  workspaceIntelligence?: HublyFlightRecorder["workspaceIntelligence"];
  automationIntelligence?: HublyFlightRecorder["automationIntelligence"];
};

/**
 * Record a full flight-recorder snapshot for Mission Control Replay.
 */
export function recordFlightRecorder(opts: RecordFlightOpts): HublyFlightRecorder {
  const startedAt = opts.startedAt || new Date(Date.now() - (opts.latencyMs || 0)).toISOString();
  const finishedAt = new Date().toISOString();
  const startMs = Date.parse(startedAt) || Date.now();
  const experts = opts.expertsExecuted || [];
  const timeline: HublyFlightEvent[] = [];
  let t = 0;

  const push = (phase: string, detail: string, meta?: Record<string, unknown>, dt = 0) => {
    t += dt;
    timeline.push({
      at: new Date(startMs + t).toISOString(),
      t,
      phase,
      detail,
      meta,
    });
  };

  push("request", `Owner: ${String(opts.request || "").slice(0, 200)}`, { intent: opts.intent }, 0);
  push("hubly_brain", "Thinking…", { status: "thinking" }, 20);

  for (const m of opts.memoriesLoaded || []) {
    push("memory_loaded", `Loaded ${m}`, { memory: m }, 30);
  }
  if ((opts.dnaFactsUsed || []).length) {
    push("business_dna", `Business DNA loaded (${opts.dnaFactsUsed!.length} facts)`, {
      facts: opts.dnaFactsUsed,
    }, 40);
  }

  for (const ex of experts) {
    const status = ex.status === "failed" ? "failed" : "finished";
    push(ex.expertId, `${ex.expertId}: ${status}`, {
      confidence: ex.confidence,
      ms: ex.ms,
      summary: ex.summary,
    }, Math.max(10, Math.min(ex.ms || 50, 200)));
  }

  for (const r of opts.reasoningObjects || []) {
    push("reasoning", `Reasoning Object: ${r.decisionKey}`, {
      reasoningId: r.reasoningId,
      decision: r.decision,
      confidence: r.confidence,
    }, 15);
  }

  for (const d of opts.decisionObjects || []) {
    push("decision", `Decision: ${d.finalDecision} (${d.decisionScore}%)`, {
      decisionId: d.decisionId,
      recommendation: d.recommendation,
      requiresApproval: d.requiresApproval,
    }, 15);
  }

  for (const c of opts.capabilitiesSelected || []) {
    push("capability", `${c.label} → ${c.toolId}`, c, 10);
  }
  for (const k of opts.knowledgeAccessed || []) {
    push("knowledge", `Knowledge: ${k.name} (${k.access})`, k, 10);
  }

  if (opts.builderIntent) {
    push("builder_intent", `Builder Intent: ${opts.builderIntent.label}`, {
      ...opts.builderIntent,
    }, 15);
  }

  if (opts.changePlan) {
    push("change_plan", `Change Plan: ${opts.changePlan.title}`, {
      ...opts.changePlan,
    }, 15);
  }

  if (opts.preview) {
    push("preview", `Preview: ${opts.preview.headline} (${opts.preview.title})`, {
      ...opts.preview,
    }, 15);
  }

  if (opts.collaboration) {
    push("collaboration", `Collaboration: ${opts.collaboration.openingPrompt}`, {
      ...opts.collaboration,
    }, 12);
    if (opts.collaboration.recommendationLabel) {
      push("recommendation", `Recommend: ${opts.collaboration.recommendationLabel}`, {
        confidence: opts.collaboration.recommendationConfidence,
      }, 8);
    }
    if (opts.collaboration.iterations > 0) {
      push("refinement", `Iterations: ${opts.collaboration.iterations}`, {
        iterations: opts.collaboration.iterations,
      }, 5);
    }
    if (opts.collaboration.hasSummary) {
      push("approval_summary", `Launch CTA: ${opts.collaboration.launchCta || "Let's launch this."}`, {
        launchCta: opts.collaboration.launchCta,
        ownerConfidence: opts.collaboration.ownerConfidence,
      }, 8);
    }
  }

  if (opts.businessVersion) {
    push("version_created", `Business Version ${opts.businessVersion.label}`, {
      ...opts.businessVersion,
    }, 12);
  }

  if (opts.creativeSession) {
    push("creative_session", `Business Builder: ${opts.creativeSession.direction}`, {
      ...opts.creativeSession,
    }, 12);
  }

  if (opts.bookingIntelligence) {
    push(
      "booking_intelligence",
      `Booking Intelligence: ${opts.bookingIntelligence.ruleCount} rule(s) · health ${opts.bookingIntelligence.healthOverall}`,
      {
        ...opts.bookingIntelligence,
      },
      12,
    );
  }

  if (opts.workspaceIntelligence) {
    push(
      "workspace_intelligence",
      `Workspace Intelligence: ${opts.workspaceIntelligence.changeCount} change(s) · health ${opts.workspaceIntelligence.healthOverall}`,
      {
        ...opts.workspaceIntelligence,
      },
      12,
    );
  }

  if (opts.automationIntelligence) {
    push(
      "automation_intelligence",
      `Automation Intelligence: ${opts.automationIntelligence.workflowCount} workflow(s) · health ${opts.automationIntelligence.healthOverall}`,
      {
        ...opts.automationIntelligence,
      },
      12,
    );
  }

  for (const w of opts.memoryWrites || []) {
    push("memory_write", `Wrote ${w.system}: ${w.summary}`, w, 10);
  }

  push("response", `Final response ready`, {
    preview: String(opts.finalResponse || "").slice(0, 160),
  }, 20);

  const liveActivity: Record<string, HublyLiveExpertStatus | string> = {
    hubly_brain: "finished",
    research: experts.some((e) => e.expertId === "research")
      ? (experts.find((e) => e.expertId === "research")!.status === "failed" ? "failed" : "finished")
      : "idle",
    strategy: experts.some((e) => e.expertId === "strategy") ? "finished" : "idle",
    creative: experts.some((e) => e.expertId === "creative_director") ? "running" : "idle",
    critic: experts.some((e) => e.expertId === "critic") ? "waiting" : "idle",
    decision: opts.decisionAction || "idle",
    builder: experts.some((e) => e.expertId === "builder")
      ? "finished"
      : (opts.decisionAction === "recommend" || opts.decisionAction === "proceed"
        ? "pending_approval"
        : "idle"),
  };
  // Normalize creative/critic after pipeline complete
  if (experts.some((e) => e.expertId === "creative_director")) liveActivity.creative = "finished";
  if (experts.some((e) => e.expertId === "critic")) liveActivity.critic = "finished";

  lastLiveActivity = { ...liveActivity };

  const flight: HublyFlightRecorder = {
    executionId: opts.executionId || newId("flt"),
    request: String(opts.request || ""),
    intent: String(opts.intent || "general"),
    businessId: opts.businessId ?? null,
    startedAt,
    finishedAt,
    latencyMs: Math.max(0, Math.round(opts.latencyMs || 0)),
    ok: opts.ok !== false,
    memoriesLoaded: [...(opts.memoriesLoaded || [])],
    dnaFactsUsed: [...(opts.dnaFactsUsed || [])],
    expertsExecuted: experts.map((e) => ({ ...e })),
    expertOrder: experts.map((e) => e.expertId),
    reasoningObjects: [...(opts.reasoningObjects || [])],
    decisionObjects: [...(opts.decisionObjects || [])],
    capabilitiesSelected: [...(opts.capabilitiesSelected || [])],
    knowledgeAccessed: [...(opts.knowledgeAccessed || [])],
    finalResponse: String(opts.finalResponse || ""),
    memoryWrites: [...(opts.memoryWrites || [])],
    timeline,
    liveActivity,
    confidence: opts.confidence ?? null,
    decisionScore: opts.decisionScore ?? null,
    decisionAction: opts.decisionAction ?? null,
    builderIntent: opts.builderIntent ? { ...opts.builderIntent } : null,
    changePlan: opts.changePlan ? { ...opts.changePlan } : null,
    preview: opts.preview ? { ...opts.preview } : null,
    collaboration: opts.collaboration ? { ...opts.collaboration } : null,
    businessVersion: opts.businessVersion ? { ...opts.businessVersion } : null,
    creativeSession: opts.creativeSession ? { ...opts.creativeSession } : null,
    bookingIntelligence: opts.bookingIntelligence ? { ...opts.bookingIntelligence } : null,
    workspaceIntelligence: opts.workspaceIntelligence ? { ...opts.workspaceIntelligence } : null,
    automationIntelligence: opts.automationIntelligence ? { ...opts.automationIntelligence } : null,
  };

  FLIGHTS.set(flight.executionId, flight);
  FLIGHT_ORDER.push(flight.executionId);
  while (FLIGHT_ORDER.length > MAX_FLIGHTS) {
    const old = FLIGHT_ORDER.shift();
    if (old) FLIGHTS.delete(old);
  }

  // Aggregate expert stats
  for (const ex of experts) {
    const cur = expertAgg.get(ex.expertId) || {
      name: ex.expertId,
      runs: 0,
      successes: 0,
      failures: 0,
      latencySum: 0,
      confidenceSum: 0,
      decisionScoreSum: 0,
      decisionScoreN: 0,
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

export function getFlightRecorder(executionId: string): HublyFlightRecorder | null {
  const f = FLIGHTS.get(String(executionId));
  return f ? cloneFlight(f) : null;
}

export function listFlightRecorders(limit = 50): HublyFlightRecorder[] {
  const n = Math.max(1, Math.min(MAX_FLIGHTS, limit));
  return FLIGHT_ORDER.slice(-n).map((id) => cloneFlight(FLIGHTS.get(id)!)).filter(Boolean);
}

/**
 * AI Replay — watch the entire process unfold for one execution.
 */
export function replayExecution(executionId: string): {
  executionId: string;
  replay: true;
  steps: HublyFlightEvent[];
  flight: HublyFlightRecorder | null;
  summary: {
    request: string;
    memoriesLoaded: string[];
    dnaFactsUsed: string[];
    expertOrder: string[];
    reasoningCount: number;
    decisionCount: number;
    capabilities: string[];
    knowledge: string[];
    finalResponse: string;
    memoryWrites: string[];
  } | null;
} {
  const flight = getFlightRecorder(executionId);
  if (!flight) {
    return { executionId, replay: true, steps: [], flight: null, summary: null };
  }
  return {
    executionId: flight.executionId,
    replay: true,
    steps: flight.timeline.map((e) => ({ ...e, meta: e.meta ? { ...e.meta } : undefined })),
    flight,
    summary: {
      request: flight.request,
      memoriesLoaded: [...flight.memoriesLoaded],
      dnaFactsUsed: [...flight.dnaFactsUsed],
      expertOrder: [...flight.expertOrder],
      reasoningCount: flight.reasoningObjects.length,
      decisionCount: flight.decisionObjects.length,
      capabilities: flight.capabilitiesSelected.map((c) => `${c.label}→${c.toolId}`),
      knowledge: flight.knowledgeAccessed.map((k) => k.name),
      finalResponse: flight.finalResponse,
      memoryWrites: flight.memoryWrites.map((w) => `${w.system}: ${w.summary}`),
    },
  };
}

function computeAiHealth(): HublyAiHealth {
  const flights = listFlightRecorders(MAX_FLIGHTS);
  const n = flights.length || 1;
  const ok = flights.filter((f) => f.ok).length;
  const latency = flights.reduce((a, f) => a + f.latencyMs, 0);
  const conf = flights.filter((f) => typeof f.confidence === "number");
  const scores = flights.filter((f) => typeof f.decisionScore === "number");
  return {
    executions: flights.length,
    okRate: flights.length ? Math.round((ok / flights.length) * 100) : 100,
    avgLatencyMs: flights.length ? Math.round(latency / flights.length) : 0,
    avgConfidence: conf.length
      ? Math.round(conf.reduce((a, f) => a + (f.confidence || 0), 0) / conf.length)
      : 0,
    avgDecisionScore: scores.length
      ? Math.round(scores.reduce((a, f) => a + (f.decisionScore || 0), 0) / scores.length)
      : null,
    errors: flights.length - ok,
    providerStatus: getCircuitSnapshot().some((c) => c.state === "open") ? "degraded" : "ready",
    reasoningObjectsRecorded: flights.reduce((a, f) => a + f.reasoningObjects.length, 0),
    decisionObjectsRecorded: flights.reduce((a, f) => a + f.decisionObjects.length, 0),
  };
}

export function getExpertActivity(): HublyExpertActivityStats[] {
  const registered = listExperts();
  const ids = new Set([...expertAgg.keys(), ...registered.map((e) => e.id)]);
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
        avgDecisionScore: null,
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
      failureRate: a.runs ? Math.round((a.failures / a.runs) * 100) : 0,
      successRate: a.runs ? Math.round((a.successes / a.runs) * 100) : 0,
      avgDecisionScore: a.decisionScoreN
        ? Math.round(a.decisionScoreSum / a.decisionScoreN)
        : null,
    };
  });
}

/**
 * Full Mission Control headquarters snapshot.
 */
export function getMissionControlSnapshot(): HublyMissionControlSnapshot {
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
      { key: "automation", label: "Automation" },
    ],
    edges: [
      { from: "homepage", to: "booking" },
      { from: "booking", to: "packages" },
      { from: "packages", to: "website" },
      { from: "website", to: "growth" },
      { from: "growth", to: "automation" },
    ],
  };

  // Enrich graph from latest reasoning if present
  if (latest?.reasoningObjects?.length) {
    const nodes = latest.reasoningObjects.map((r) => ({
      key: r.decisionKey,
      label: r.decision.slice(0, 48),
    }));
    if (nodes.length) {
      decisionGraph.nodes = nodes;
      decisionGraph.edges = nodes.slice(0, -1).map((n, i) => ({
        from: n.key,
        to: nodes[i + 1].key,
      }));
    }
  }

  return {
    version: MISSION_CONTROL_VERSION,
    title: "Hubly Mission Control",
    checkedAt: new Date().toISOString(),
    liveAiActivity: { ...lastLiveActivity },
    expertActivity: getExpertActivity(),
    businessMemory: {
      inspectable: true,
      note: "Inspect / compare / restore Business Memory versions (Brain-owned).",
    },
    workspaceMemory: {
      inspectable: true,
      note: "Inspect / replay / compare Workspace Memory preferences.",
    },
    conversationIntelligence: {
      inspectable: true,
      note: "Active conversations, projects, threads, deferred ideas, promises.",
    },
    decisionGraph,
    builderActions: (() => {
      const intents = flights
        .map((f) => f.builderIntent)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const changePlans = flights
        .map((f) => f.changePlan)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const previews = flights
        .map((f) => f.preview)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const collaborations = flights
        .map((f) => f.collaboration)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const versions = flights
        .map((f) => f.businessVersion)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const creativeSessions = flights
        .map((f) => f.creativeSession)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const bookingIntelligencePlans = flights
        .map((f) => f.bookingIntelligence)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const workspaceIntelligencePlans = flights
        .map((f) => f.workspaceIntelligence)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      const automationIntelligencePlans = flights
        .map((f) => f.automationIntelligence)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .slice(-10)
        .reverse();
      return {
        milestone: "1.5" as const,
        available: false as const,
        epic: "9 — Automation Intelligence Builder",
        note: "Epic 9 — Automation Intelligence Builder. Conversation → workflow. Simulation + Discovery. Waiting for Approval/Apply. No apply. No execute.",
        recent: automationIntelligencePlans.length
          ? automationIntelligencePlans.map((a) => ({
            id: a.id,
            status: "automation_intelligence",
            summary: `${a.label}: ${a.workflowCount} workflow(s) · health ${a.healthOverall} · ~${a.timeSavedHoursPerMonth}h/mo`,
          }))
          : workspaceIntelligencePlans.length
          ? workspaceIntelligencePlans.map((w) => ({
            id: w.id,
            status: "workspace_intelligence",
            summary: `${w.label}: ${w.changeCount} change(s) · health ${w.healthOverall} · home ${w.homepage}`,
          }))
          : bookingIntelligencePlans.length
          ? bookingIntelligencePlans.map((b) => ({
            id: b.id,
            status: "booking_intelligence",
            summary: `${b.label}: ${b.ruleCount} rule(s) · health ${b.healthOverall} · sim ${b.simulatorHorizonDays}d`,
          }))
          : creativeSessions.length
          ? creativeSessions.map((c) => ({
            id: c.id,
            status: "creative_session",
            summary: `${c.label}: ${c.direction} · score ${c.businessScoreOverall} · ${c.decisionCount} decisions`,
          }))
          : versions.length
          ? versions.map((v) => ({
            id: v.id,
            status: v.status,
            summary: `${v.label} · ${v.changeCount} change(s) · rollback available`,
            changePlanId: v.changePlanId || undefined,
          }))
          : collaborations.length
          ? collaborations.map((c) => ({
            id: c.id,
            status: c.status,
            summary: `${c.openingPrompt} · ${c.iterations} iteration(s)${c.launchCta ? ` · ${c.launchCta}` : ""}`,
            changePlanId: c.changePlanId,
          }))
          : previews.length
          ? previews.map((p) => ({
            id: p.id,
            status: "preview_ready",
            summary: `${p.headline} · ${p.title} (v${p.currentVersion})`,
            risk: undefined,
            confidence: undefined,
            affectedSystems: undefined,
            changePlanId: p.changePlanId,
          }))
          : changePlans.length
          ? changePlans.map((p) => ({
            id: p.id,
            status: "change_plan_draft",
            summary: `${p.title} (${p.actionCount} actions)`,
            risk: p.risk,
            confidence: p.confidence,
            affectedSystems: p.affectedSystems,
            changePlanId: p.id,
          }))
          : intents.map((i) => ({
            id: i.intentId,
            status: "intent_only",
            summary: `${i.label}: ${i.goal}`,
            category: i.category,
            risk: i.risk,
            confidence: i.confidence,
            affectedSystems: i.affectedSystems,
            capabilities: i.capabilities,
            confidenceExplanation: i.confidenceExplanation,
          })),
        intents,
        changePlans,
        previews,
        collaborations,
        versions,
        versionHistoryNote: "Current → History → Diff → Rollback availability → AI restore suggestions. Try it — you can always go back.",
        creativeSessions,
        bookingIntelligence: bookingIntelligencePlans,
        workspaceIntelligence: workspaceIntelligencePlans,
        automationIntelligence: automationIntelligencePlans,
      };
    })(),
    capabilityRegistry: listTools().map((t) => ({
      toolId: t.id,
      name: t.name,
      capabilityCount: t.capabilities.length,
    })),
    knowledgeRegistry: listKnowledgeSources().map((k) => ({
      id: k.id,
      name: k.name,
      access: k.access === "read" ? "Read Only" : "Read + Write",
    })),
    brainTimeline: latest?.timeline || [],
    aiHealth: computeAiHealth(),
    recentExecutions: flights.slice(-10).reverse().map((f) => ({
      executionId: f.executionId,
      request: f.request.slice(0, 120),
      at: f.finishedAt,
      ok: f.ok,
      latencyMs: f.latencyMs,
    })),
    replayAvailable: true,
    performance: getObservabilityDashboard(),
    costAwareness: getCostReport(),
    reliability: {
      circuits: getCircuitSnapshot(),
      queuedWork: listQueuedWork(),
      manifest: getReliabilityManifest(),
    },
    trustScore: computeTrustScore({
      aiHealthOkRate: computeAiHealth().okRate,
      avgDecisionScore: computeAiHealth().avgDecisionScore,
      avgLatencyMs: computeAiHealth().avgLatencyMs,
    }),
    platformInventory: getPlatformInventory(),
    qualityAssurance: (() => {
      const last = getLastQualityReport();
      const score = getQualityScoreSnapshot();
      return {
        score,
        lastRunAt: last?.checkedAt || null,
        ok: last ? last.ok : null,
        scenarioPassRate: last
          ? Math.round((last.scenarioLibrary.passed / Math.max(1, last.scenarioLibrary.total)) * 100)
          : null,
        founderBenchmarkPassRate: last
          ? Math.round((last.founderBenchmarks.passed / Math.max(1, last.founderBenchmarks.total)) * 100)
          : null,
        identityComplianceRate: last?.identityCompliance.rate ?? null,
        manifest: getQualityManifest(),
      };
    })(),
    documentation: getHublyDocumentationCatalog(),
    brainCertification: getBrainCertificationSnapshot(),
  };
}

export function clearMissionControlForTests(): void {
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
    builder: "pending_approval",
  };
}

export const HublyMissionControl = {
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
  clearForTests: clearMissionControlForTests,
};

export default HublyMissionControl;
