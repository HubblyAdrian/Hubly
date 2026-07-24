/**
 * Hubly Brain — Think pipeline (Milestone 1 · Sections 4–5)
 *
 * Orchestration (registry priorities — Experience Director last as CX gate):
 * Research → Strategy → Creative Director → Critic → Experience Director → Hubly Brain → Customer
 *
 * Section 5 — Hubly Brain owns Business Memory:
 * experts may suggest; Brain commits; retrieval answers come from Memory, not chat logs.
 */

import { ensureExpertsRegistered } from "./hubly_brain_experts.ts";
import {
  listExpertCapabilities,
  listExperts,
  runExpert,
  selectExpertsFromRegistry,
  discoverExperts,
  sanitizeExpertError,
  type HublyExpertId,
  type HublyExpertOutput,
  type HublyExpertStatus,
} from "./hubly_brain_expert_framework.ts";
import {
  normalizeBusinessMemory,
  extractMemorySuggestionsFromRequest,
  commitMemoryUpdates,
  commitStrategyVersion,
  commitAiHistoryEntry,
  queryBusinessMemory,
  isMemoryRetrievalQuestion,
  persistBusinessMemoryLocal,
  loadBusinessMemoryLocal,
  type HublyBusinessMemoryInput,
  type HublyMemoryChange,
  BUSINESS_MEMORY_OWNER,
} from "./hubly_brain_memory.ts";
import {
  normalizeBusinessDNA,
  loadAndAttachDnaKnowledge,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";
import {
  appendConversationTurn,
  normalizeConversationMemory,
  type HublyConversationMemoryInput,
} from "./hubly_brain_conversation_memory.ts";
import {
  normalizeWorkspaceMemory,
  extractWorkspaceSuggestionsFromRequest,
  commitWorkspaceUpdates,
  queryWorkspaceMemory,
  isWorkspaceRetrievalQuestion,
  persistWorkspaceMemoryLocal,
  loadWorkspaceMemoryLocal,
  WORKSPACE_MEMORY_OWNER,
  type HublyWorkspaceMemoryInput,
  type HublyWorkspaceChange,
} from "./hubly_brain_workspace_memory.ts";
import {
  makeDecision,
  isWhyQuestion,
  answerWhyFromReasoning,
  recordBuildBusinessReasoningChain,
  type HublyDecisionRecord,
  type HublyReasoningObject,
} from "./hubly_brain_reasoning.ts";
import { confidenceBand, type HublyConfidenceBand } from "./hubly_brain_confidence_policy.ts";
import { applyExperienceDirector } from "./hubly_brain_experience_director.ts";

export type HublyThinkIntent =
  | "build_business"
  | "website"
  | "workspace"
  | "research"
  | "coach"
  | "weather"
  | "memory"
  | "why"
  | "general";

export type HublyThinkRequest = {
  request: string;
  intent?: HublyThinkIntent | string | null;
  memory?: HublyBusinessMemoryInput | null;
  dna?: HublyBusinessDNAInput | null;
  workspace?: HublyWorkspaceMemoryInput | null;
  conversation?: HublyConversationMemoryInput | null;
  blueprintKnowledge?: Record<string, unknown> | null;
  /** Force expert set (Brain still runs Experience Director last). */
  experts?: HublyExpertId[] | null;
  /** When set, Brain loads/persists Business Memory for this business. */
  businessId?: string | null;
  debug?: boolean;
};

/** Section 4 — structured per-expert record Brain merges. */
export type HublyMergedExpertRecord = {
  expertName: string;
  expertId: string;
  executionTimeMs: number;
  reasoning: HublyExpertOutput["reasoning"];
  confidence: number;
  output: Record<string, unknown> | null;
  status: HublyExpertStatus;
  retries: number;
};

/**
 * Section 4 improvement — Expert Transcript (internal only).
 * Customers never see this.
 */
export type HublyExpertTranscriptEntry = {
  expertId: string;
  expertName: string;
  received: {
    request: string;
    intent: string;
    priorExpertIds: string[];
    memorySurfaces: string[];
  };
  concluded: string;
  why: string;
  changedFromPrevious: string;
  confidence: number;
  status: HublyExpertStatus;
  executionTimeMs: number;
  outputType: string;
  retries: number;
};

export type HublyExpertTranscript = {
  customerVisible: false;
  entries: HublyExpertTranscriptEntry[];
  assembly: {
    expertsInOrder: string[];
    finalResponseSource: "experience_director" | "hubly_brain_fallback";
    mergedFrom: string[];
    howAssembled: string;
  };
};

export type HublyThinkResult = {
  ok: boolean;
  intent: string;
  response: string;
  questions: string[];
  celebrate: boolean;
  confidence: number;
  confidenceBand: HublyConfidenceBand;
  expertsRun: HublyExpertId[];
  expertOutputs: HublyExpertOutput[];
  /** Section 4 — unified per-expert execution records. */
  mergedExpertRecords: HublyMergedExpertRecord[];
  /** Section 4 — internal Expert Transcript. */
  expertTranscript: HublyExpertTranscript;
  failures: Array<{ expertId: string; status: HublyExpertStatus; error: string | null; retries: number }>;
  decisions: HublyDecisionRecord[];
  /** Section 8 — structured Reasoning Objects + Decision Graph. */
  reasoningObjects: HublyReasoningObject[];
  whyAnswer?: ReturnType<typeof answerWhyFromReasoning> | null;
  memory: ReturnType<typeof normalizeBusinessMemory>;
  /** Section 5 — changelog entries committed this turn (Brain-owned). */
  memoryChanges: HublyMemoryChange[];
  memoryCommittedBy: typeof BUSINESS_MEMORY_OWNER;
  memoryRetrieval?: ReturnType<typeof queryBusinessMemory> | null;
  dna: ReturnType<typeof normalizeBusinessDNA>;
  workspace: ReturnType<typeof normalizeWorkspaceMemory>;
  /** Section 6 — workspace preference commits (Brain-owned). */
  workspaceChanges: HublyWorkspaceChange[];
  workspaceCommittedBy: typeof WORKSPACE_MEMORY_OWNER;
  workspaceRetrieval?: ReturnType<typeof queryWorkspaceMemory> | null;
  conversation: ReturnType<typeof normalizeConversationMemory>;
  timeline: Array<{ expertId: string; ms: number; confidence: number; summary: string }>;
  experienceDirector?: {
    reviewedBy: "experience_director";
    actions: string[];
    questionsShown: number;
    questionsDelayed: number;
    celebrate: boolean;
    hideDetails: boolean;
  };
  console?: {
    intent: string;
    expertsSelected: HublyExpertId[];
    memoriesLoaded: string[];
    latencyMs: number;
  };
};

export function detectIntent(request: string, explicit?: string | null): string {
  if (explicit) return String(explicit);
  const r = String(request || "").toLowerCase();
  if (isWhyQuestion(r)) return "why";
  if (isWorkspaceRetrievalQuestion(r)) return "workspace";
  if (isMemoryRetrievalQuestion(r)) return "memory";
  if (/weather|forecast|temperature/.test(r)) return "weather";
  if (
    /move |sidebar|dashboard|pin |hide |workspace|jobs above|put .+ above|favorite |favourite |star the|land on|start on/
      .test(r)
  ) {
    return "workspace";
  }
  if (
    /website|homepage|luxury|premium|layout|brand|build me|build my|start(?:ing)?\s+(?:a\s+)?(?:new\s+)?(?:business|company)|pressure\s*wash|new company/
      .test(r)
  ) {
    return "build_business";
  }
  if (/research|competitor|industry/.test(r)) return "research";
  if (/coach|grow|booking|revenue/.test(r)) return "coach";
  return "general";
}

/**
 * Section 3 — routing uses the Expert Framework registry only.
 * No hardcoded expert name lists / PIPELINE_ORDER in Hubly Brain.
 */
export function selectExperts(intent: string, request: string, forced?: HublyExpertId[] | null): HublyExpertId[] {
  return selectExpertsFromRegistry({ intent, request, forced });
}

function toMergedRecord(out: HublyExpertOutput): HublyMergedExpertRecord {
  return {
    expertName: out.expertName || out.expertId,
    expertId: out.expertId,
    executionTimeMs: out.executionTimeMs ?? 0,
    reasoning: out.reasoning || [],
    confidence: out.confidence ?? 0,
    output: (out.output || out.payload || null) as Record<string, unknown> | null,
    status: out.status || (out.ok ? "ok" : "failed"),
    retries: out.retries ?? 0,
  };
}

function outputTypeOf(out: HublyExpertOutput): string {
  const o = (out.output || out.payload || {}) as { type?: string };
  return o.type || out.expertId;
}

function buildTranscriptEntry(
  out: HublyExpertOutput,
  idx: number,
  ordered: HublyExpertId[],
  req: HublyThinkRequest,
  intent: string,
  prior: HublyExpertOutput[],
): HublyExpertTranscriptEntry {
  const prev = prior[idx - 1];
  const why = out.reasoning?.[0]?.reason || out.summary || "No reasoning recorded";
  let changedFromPrevious = "First expert in this run — established the baseline.";
  if (prev) {
    const prevType = outputTypeOf(prev);
    const thisType = outputTypeOf(out);
    changedFromPrevious =
      `${prev.expertName || prev.expertId} produced ${prevType}; ` +
      `${out.expertName || out.expertId} advanced that into ${thisType} ` +
      `(confidence ${prev.confidence} → ${out.confidence}).`;
  }
  return {
    expertId: out.expertId,
    expertName: out.expertName || out.expertId,
    received: {
      request: String(req.request || ""),
      intent,
      priorExpertIds: prior.slice(0, idx).map((p) => p.expertId),
      memorySurfaces: [
        req.memory ? "business_memory" : "",
        req.dna ? "business_dna" : "",
        req.workspace ? "workspace_memory" : "",
        req.conversation ? "conversation_memory" : "",
        req.blueprintKnowledge ? "blueprints" : "",
      ].filter(Boolean),
    },
    concluded: out.summary,
    why,
    changedFromPrevious,
    confidence: out.confidence,
    status: out.status || (out.ok ? "ok" : "failed"),
    executionTimeMs: out.executionTimeMs ?? 0,
    outputType: outputTypeOf(out),
    retries: out.retries ?? 0,
  };
}

export async function think(req: HublyThinkRequest): Promise<HublyThinkResult> {
  const started = Date.now();
  ensureExpertsRegistered();
  discoverExperts();

  const intent = detectIntent(req.request, req.intent);
  const businessId = req.businessId ? String(req.businessId) : null;
  const seeded = businessId ? loadBusinessMemoryLocal(businessId) : null;
  let memory = normalizeBusinessMemory(seeded || req.memory);
  let memoryChanges: HublyMemoryChange[] = [];

  // Section 5 — Brain extracts owner facts and commits (experts never write).
  const extracted = extractMemorySuggestionsFromRequest(String(req.request || ""), memory);
  if (extracted.length) {
    const committed = commitMemoryUpdates(memory, extracted, {
      summary: `Owner message: ${String(req.request || "").slice(0, 120)}`,
    });
    memory = committed.memory;
    memoryChanges = committed.changes;
  }

  // Section 7 — Hubly Brain loads Business DNA knowledge for experts to read (never modify).
  let dna = normalizeBusinessDNA(req.dna);
  if (!dna.knowledgePack) {
    const cityFromMem = memory.city || memory.business?.serviceArea;
    const cityStr = typeof cityFromMem === "string" ? cityFromMem : null;
    dna = loadAndAttachDnaKnowledge(dna, {
      request: String(req.request || ""),
      industry: memory.industry || memory.business?.industry || null,
      city: cityStr,
    });
  }

  const seededWs = businessId ? loadWorkspaceMemoryLocal(businessId) : null;
  let workspace = normalizeWorkspaceMemory(seededWs || req.workspace);
  let workspaceChanges: HublyWorkspaceChange[] = [];

  // Section 6 — Brain extracts workspace preferences and commits (experts never write).
  const wsExtracted = extractWorkspaceSuggestionsFromRequest(String(req.request || ""), workspace);
  if (wsExtracted.length) {
    const wsCommitted = commitWorkspaceUpdates(workspace, wsExtracted, {
      summary: `Owner workspace: ${String(req.request || "").slice(0, 120)}`,
    });
    workspace = wsCommitted.workspace;
    workspaceChanges = wsCommitted.changes;
  }

  let conversation = normalizeConversationMemory(req.conversation);
  conversation = appendConversationTurn(conversation, {
    role: "owner",
    text: String(req.request || "").trim(),
    at: new Date().toISOString(),
  });

  // Section 8 — answer "Why?" from stored Reasoning Objects (never regenerate).
  if (intent === "why" || isWhyQuestion(String(req.request || ""))) {
    const why = answerWhyFromReasoning(String(req.request || ""), { businessId });
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse: why.answer,
      proposedQuestions: [],
      confidence: why.confidence,
      criticOk: true,
    });
    conversation = appendConversationTurn(conversation, { role: "hubly", text: ed.ownerResponse });
    if (businessId) {
      persistBusinessMemoryLocal(businessId, memory);
      persistWorkspaceMemoryLocal(businessId, workspace);
    }
    const edRecord: HublyExpertOutput = {
      expertId: "experience_director",
      expertName: "Experience Director",
      ok: true,
      status: "ok",
      executionTimeMs: Date.now() - started,
      retries: 0,
      summary: ed.ownerResponse,
      output: { type: "Experience Review", ownerResponse: ed.ownerResponse, fromStoredReasoning: true },
      payload: { type: "Experience Review", ownerResponse: ed.ownerResponse, fromStoredReasoning: true },
      reasoning: [{
        reason: "Answered Why? from stored Reasoning Object — not regenerated.",
        evidence: why.reasoning ? [why.reasoning.reasoningId, why.reasoning.decisionKey] : [],
        confidence: why.confidence,
      }],
      confidence: ed.confidence,
      questions: ed.questions,
    };
    return {
      ok: true,
      intent: "why",
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: ed.celebrate,
      confidence: ed.confidence,
      confidenceBand: confidenceBand(ed.confidence),
      expertsRun: ["experience_director"],
      expertOutputs: [edRecord],
      mergedExpertRecords: [toMergedRecord(edRecord)],
      expertTranscript: {
        customerVisible: false,
        entries: [buildTranscriptEntry(edRecord, 0, ["experience_director"], req, "why", [])],
        assembly: {
          expertsInOrder: ["experience_director"],
          finalResponseSource: "experience_director",
          mergedFrom: ["experience_director", "reasoning_engine"],
          howAssembled: "Hubly Brain retrieved stored Reasoning Object(s) and Experience Director phrased the answer.",
        },
      },
      failures: [],
      decisions: [
        makeDecision({
          domain: "reasoning",
          decision: "why_retrieval",
          reason: "Retrieved stored reasoning for Why? question",
          evidence: why.decisionGraph.map((c) => c.reasoningId),
          confidence: why.confidence,
          expertId: "hubly_brain",
          decisionKey: "why_retrieval",
          expectedOutcome: "clearer_positioning",
        }),
      ],
      reasoningObjects: why.reasoning ? [why.reasoning, ...why.history.filter((h) => h.reasoningId !== why.reasoning?.reasoningId)] : [],
      whyAnswer: why,
      memory,
      memoryChanges,
      memoryCommittedBy: BUSINESS_MEMORY_OWNER,
      memoryRetrieval: null,
      dna,
      workspace,
      workspaceChanges,
      workspaceCommittedBy: WORKSPACE_MEMORY_OWNER,
      workspaceRetrieval: null,
      conversation,
      timeline: [{
        expertId: "experience_director",
        ms: Date.now() - started,
        confidence: ed.confidence,
        summary: ed.ownerResponse,
      }],
      experienceDirector: {
        reviewedBy: "experience_director",
        actions: [...ed.actions, "answered_from_stored_reasoning"],
        questionsShown: ed.questions.length,
        questionsDelayed: ed.delayed.extraQuestions.length,
        celebrate: ed.celebrate,
        hideDetails: ed.hideDetails,
      },
      console: req.debug
        ? {
          intent: "why",
          expertsSelected: ["experience_director"],
          memoriesLoaded: ["reasoning_engine"],
          latencyMs: Date.now() - started,
        }
        : undefined,
    };
  }

  // Section 6 — answer workspace questions from Workspace Memory (not chat, not Business Memory).
  if (isWorkspaceRetrievalQuestion(String(req.request || ""))) {
    const retrieval = queryWorkspaceMemory(workspace, String(req.request || ""));
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse: retrieval.answer,
      proposedQuestions: [],
      confidence: retrieval.confidence,
      criticOk: true,
    });
    conversation = appendConversationTurn(conversation, { role: "hubly", text: ed.ownerResponse });
    if (businessId) {
      persistBusinessMemoryLocal(businessId, memory);
      persistWorkspaceMemoryLocal(businessId, workspace);
    }
    const edRecord: HublyExpertOutput = {
      expertId: "experience_director",
      expertName: "Experience Director",
      ok: true,
      status: "ok",
      executionTimeMs: Date.now() - started,
      retries: 0,
      summary: ed.ownerResponse,
      output: { type: "Experience Review", ownerResponse: ed.ownerResponse, fromWorkspaceMemory: true },
      payload: { type: "Experience Review", ownerResponse: ed.ownerResponse, fromWorkspaceMemory: true },
      reasoning: [{
        reason: "Answered from Workspace Memory (how the owner likes to work).",
        evidence: retrieval.paths,
        confidence: retrieval.confidence,
      }],
      confidence: ed.confidence,
      questions: ed.questions,
    };
    return {
      ok: true,
      intent: "workspace",
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: ed.celebrate,
      confidence: ed.confidence,
      confidenceBand: confidenceBand(ed.confidence),
      expertsRun: ["experience_director"],
      expertOutputs: [edRecord],
      mergedExpertRecords: [toMergedRecord(edRecord)],
      expertTranscript: {
        customerVisible: false,
        entries: [buildTranscriptEntry(edRecord, 0, ["experience_director"], req, "workspace", [])],
        assembly: {
          expertsInOrder: ["experience_director"],
          finalResponseSource: "experience_director",
          mergedFrom: ["experience_director", "workspace_memory"],
          howAssembled: "Hubly Brain queried Workspace Memory and Experience Director phrased the answer.",
        },
      },
      failures: [],
      decisions: [
        makeDecision({
          domain: "workspace_memory",
          decision: "workspace_retrieval",
          reason: "Retrieved answer from Workspace Memory SSOT",
          evidence: retrieval.paths,
          confidence: retrieval.confidence,
          expertId: WORKSPACE_MEMORY_OWNER,
        }),
      ],
      reasoningObjects: [],
      whyAnswer: null,
      memory,
      memoryChanges,
      memoryCommittedBy: BUSINESS_MEMORY_OWNER,
      memoryRetrieval: null,
      dna,
      workspace,
      workspaceChanges,
      workspaceCommittedBy: WORKSPACE_MEMORY_OWNER,
      workspaceRetrieval: retrieval,
      conversation,
      timeline: [{
        expertId: "experience_director",
        ms: Date.now() - started,
        confidence: ed.confidence,
        summary: ed.ownerResponse,
      }],
      experienceDirector: {
        reviewedBy: "experience_director",
        actions: [...ed.actions, "answered_from_workspace_memory"],
        questionsShown: ed.questions.length,
        questionsDelayed: ed.delayed.extraQuestions.length,
        celebrate: ed.celebrate,
        hideDetails: ed.hideDetails,
      },
      console: req.debug
        ? {
          intent: "workspace",
          expertsSelected: ["experience_director"],
          memoriesLoaded: ["workspace_memory"],
          latencyMs: Date.now() - started,
        }
        : undefined,
    };
  }

  // Section 5 — answer memory questions from Business Memory, not chat logs.
  if (intent === "memory" || isMemoryRetrievalQuestion(String(req.request || ""))) {
    const retrieval = queryBusinessMemory(memory, String(req.request || ""));
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse: retrieval.answer,
      proposedQuestions: [],
      confidence: retrieval.confidence,
      criticOk: true,
    });
    conversation = appendConversationTurn(conversation, { role: "hubly", text: ed.ownerResponse });
    if (businessId) {
      persistBusinessMemoryLocal(businessId, memory);
      persistWorkspaceMemoryLocal(businessId, workspace);
    }
    const edRecord: HublyExpertOutput = {
      expertId: "experience_director",
      expertName: "Experience Director",
      ok: true,
      status: "ok",
      executionTimeMs: Date.now() - started,
      retries: 0,
      summary: ed.ownerResponse,
      output: { type: "Experience Review", ownerResponse: ed.ownerResponse, fromMemory: true },
      payload: { type: "Experience Review", ownerResponse: ed.ownerResponse, fromMemory: true },
      reasoning: [{
        reason: "Answered from Business Memory (not chat history).",
        evidence: retrieval.paths,
        confidence: retrieval.confidence,
      }],
      confidence: ed.confidence,
      questions: ed.questions,
    };
    return {
      ok: true,
      intent: "memory",
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: ed.celebrate,
      confidence: ed.confidence,
      confidenceBand: confidenceBand(ed.confidence),
      expertsRun: ["experience_director"],
      expertOutputs: [edRecord],
      mergedExpertRecords: [toMergedRecord(edRecord)],
      expertTranscript: {
        customerVisible: false,
        entries: [buildTranscriptEntry(edRecord, 0, ["experience_director"], req, "memory", [])],
        assembly: {
          expertsInOrder: ["experience_director"],
          finalResponseSource: "experience_director",
          mergedFrom: ["experience_director", "business_memory"],
          howAssembled: "Hubly Brain queried Business Memory and Experience Director phrased the answer.",
        },
      },
      failures: [],
      decisions: [
        makeDecision({
          domain: "business_memory",
          decision: "memory_retrieval",
          reason: "Retrieved answer from Business Memory SSOT",
          evidence: retrieval.paths,
          confidence: retrieval.confidence,
          expertId: BUSINESS_MEMORY_OWNER,
        }),
      ],
      reasoningObjects: [],
      whyAnswer: null,
      memory,
      memoryChanges,
      memoryCommittedBy: BUSINESS_MEMORY_OWNER,
      memoryRetrieval: retrieval,
      dna,
      workspace,
      workspaceChanges,
      workspaceCommittedBy: WORKSPACE_MEMORY_OWNER,
      workspaceRetrieval: null,
      conversation,
      timeline: [{
        expertId: "experience_director",
        ms: Date.now() - started,
        confidence: ed.confidence,
        summary: ed.ownerResponse,
      }],
      experienceDirector: {
        reviewedBy: "experience_director",
        actions: [...ed.actions, "answered_from_business_memory"],
        questionsShown: ed.questions.length,
        questionsDelayed: ed.delayed.extraQuestions.length,
        celebrate: ed.celebrate,
        hideDetails: ed.hideDetails,
      },
      console: req.debug
        ? {
          intent: "memory",
          expertsSelected: ["experience_director"],
          memoriesLoaded: ["business_memory"],
          latencyMs: Date.now() - started,
        }
        : undefined,
    };
  }

  const ordered = selectExperts(intent, String(req.request || ""), req.experts);
  if (!ordered.includes("experience_director")) {
    throw new Error("Section 2 invariant violated: Experience Director not selected by registry");
  }

  const expertOutputs: HublyExpertOutput[] = [];
  const timeline: HublyThinkResult["timeline"] = [];
  const decisions: HublyDecisionRecord[] = [];
  const failures: HublyThinkResult["failures"] = [];

  const domainExperts = ordered.filter((id) => id !== "experience_director");
  if ((intent === "weather" || intent === "workspace") && domainExperts.length === 0) {
    const wsSummary = workspaceChanges.length
      ? queryWorkspaceMemory(workspace, "What does my workspace look like?").answer
      : "I can rearrange your workspace from preferences — tell me exactly what to move, hide, or pin.";
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse: intent === "weather"
        ? "I can check the weather for your service area once location services are connected — for now, tell me your city and I'll keep it in Business Memory."
        : (workspaceChanges.length
          ? `Done — I updated how you like to work. ${wsSummary}`
          : wsSummary),
      proposedQuestions: intent === "weather" && !memory.city ? ["What city should I use for weather?"] : [],
      confidence: intent === "weather" ? 90 : 92,
      criticOk: true,
    });
    conversation = appendConversationTurn(conversation, { role: "hubly", text: ed.ownerResponse });
    if (businessId) {
      persistBusinessMemoryLocal(businessId, memory);
      persistWorkspaceMemoryLocal(businessId, workspace);
    }
    const edRecord: HublyExpertOutput = {
      expertId: "experience_director",
      expertName: "Experience Director",
      ok: true,
      status: "ok",
      executionTimeMs: Date.now() - started,
      retries: 0,
      summary: ed.ownerResponse,
      output: { type: "Experience Review", ownerResponse: ed.ownerResponse, actions: ed.actions },
      payload: { type: "Experience Review", ownerResponse: ed.ownerResponse, actions: ed.actions },
      reasoning: [{
        reason: "Registry selected Experience Director only for this fast-path intent.",
        evidence: [intent],
        confidence: ed.confidence,
      }],
      confidence: ed.confidence,
      questions: ed.questions,
    };
    const transcript: HublyExpertTranscript = {
      customerVisible: false,
      entries: [buildTranscriptEntry(edRecord, 0, ordered, req, intent, [])],
      assembly: {
        expertsInOrder: ordered,
        finalResponseSource: "experience_director",
        mergedFrom: ["experience_director"],
        howAssembled: "Fast-path: Experience Director alone produced the customer response.",
      },
    };
    return {
      ok: true,
      intent,
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: ed.celebrate,
      confidence: ed.confidence,
      confidenceBand: confidenceBand(ed.confidence),
      expertsRun: ordered,
      expertOutputs: [edRecord],
      mergedExpertRecords: [toMergedRecord(edRecord)],
      expertTranscript: transcript,
      failures: [],
      decisions: [
        makeDecision({
          domain: "routing",
          decision: intent === "weather" ? "weather_tool" : "workspace_preferences",
          reason: "Registry selected Experience Director only — domain experts not required for this intent.",
          evidence: [intent, `registry:${ordered.join(",")}`, ...ed.actions],
          confidence: intent === "weather" ? 95 : 92,
          expertId: "experience_director",
        }),
      ],
      reasoningObjects: [],
      whyAnswer: null,
      memory,
      memoryChanges,
      memoryCommittedBy: BUSINESS_MEMORY_OWNER,
      memoryRetrieval: null,
      dna,
      workspace,
      workspaceChanges,
      workspaceCommittedBy: WORKSPACE_MEMORY_OWNER,
      workspaceRetrieval: null,
      conversation,
      timeline: [{ expertId: "experience_director", ms: Date.now() - started, confidence: ed.confidence, summary: ed.ownerResponse }],
      experienceDirector: {
        reviewedBy: "experience_director",
        actions: ed.actions,
        questionsShown: ed.questions.length,
        questionsDelayed: ed.delayed.extraQuestions.length,
        celebrate: ed.celebrate,
        hideDetails: ed.hideDetails,
      },
      console: req.debug
        ? {
          intent,
          expertsSelected: ordered,
          memoriesLoaded: intent === "weather"
            ? ["business_memory", "conversation_memory"]
            : ["workspace_memory", "conversation_memory"],
          latencyMs: Date.now() - started,
        }
        : undefined,
    };
  }

  for (const expertId of ordered) {
    const priorSnapshot = [...expertOutputs];
    const out = await runExpert(expertId, {
      request: req.request,
      intent,
      memory: memory as unknown as Record<string, unknown>,
      dna: dna as unknown as Record<string, unknown>,
      workspace: workspace as unknown as Record<string, unknown>,
      conversation: conversation as unknown as Record<string, unknown>,
      blueprintKnowledge: req.blueprintKnowledge || null,
      priorOutputs: priorSnapshot,
    });
    expertOutputs.push(out);
    timeline.push({
      expertId,
      ms: out.executionTimeMs ?? 0,
      confidence: out.confidence,
      summary: out.summary,
    });
    if (out.status === "failed" || out.status === "skipped" || out.ok === false) {
      failures.push({
        expertId,
        status: out.status || "failed",
        error: out.error ? sanitizeExpertError(out.error) : null,
        retries: out.retries ?? 0,
      });
    }
    out.reasoning.forEach((r) => {
      decisions.push(makeDecision({
        domain: expertId,
        decision: expertId,
        reason: r.reason,
        evidence: r.evidence,
        confidence: r.confidence,
        expectedImpact: r.expectedImpact,
        expertId,
      }));
    });

    // Critic may request regeneration — Brain re-runs Creative Director once when asked.
    if (expertId === "critic") {
      const report = (out.output || out.payload || {}) as { requestRegeneration?: boolean; rejected?: boolean };
      if (report.requestRegeneration && ordered.includes("creative_director")) {
        const regen = await runExpert("creative_director", {
          request: req.request,
          intent,
          memory: memory as unknown as Record<string, unknown>,
          dna: dna as unknown as Record<string, unknown>,
          workspace: workspace as unknown as Record<string, unknown>,
          conversation: conversation as unknown as Record<string, unknown>,
          blueprintKnowledge: req.blueprintKnowledge || null,
          priorOutputs: expertOutputs.filter((o) => o.expertId !== "creative_director" && o.expertId !== "critic"),
        });
        regen.retries = (regen.retries || 0) + 1;
        regen.status = regen.ok ? "retried" : regen.status;
        const idx = expertOutputs.findIndex((o) => o.expertId === "creative_director");
        if (idx >= 0) expertOutputs[idx] = regen;
        else expertOutputs.push(regen);
        timeline.push({
          expertId: "creative_director",
          ms: regen.executionTimeMs ?? 0,
          confidence: regen.confidence,
          summary: `regenerated: ${regen.summary}`,
        });
      }
    }
  }

  // Section 5 — Brain commits strategy suggestions from Strategy Expert (experts never write).
  const strategyOut = expertOutputs.find((o) => o.expertId === "strategy");
  const strategyPayload = (strategyOut?.output || strategyOut?.payload || {}) as {
    positioning?: string;
    homepageStrategy?: string;
    pricingDirection?: string;
    bookingStrategy?: string;
    messaging?: string;
  };
  if (strategyPayload.positioning || strategyPayload.homepageStrategy) {
    const stratCommit = commitStrategyVersion(memory, {
      positioning: strategyPayload.positioning,
      homepageStrategy: strategyPayload.homepageStrategy,
      pricingStrategy: strategyPayload.pricingDirection,
      bookingStrategy: strategyPayload.bookingStrategy,
      growthStrategy: strategyPayload.messaging,
      reason: strategyOut?.reasoning?.[0]?.reason || "Strategy Expert recommendation",
      expertId: "strategy",
      confidence: strategyOut?.confidence ?? 80,
    });
    memory = stratCommit.memory;
    memoryChanges = [...memoryChanges, ...stratCommit.changes];
  }

  const critic = expertOutputs.find((o) => o.expertId === "critic");
  if (critic) {
    const quality = (critic.output || critic.payload || {}) as { proceed?: boolean; rejected?: boolean };
    const aiCommit = commitAiHistoryEntry(memory, {
      recommendation: strategyPayload.positioning || strategyOut?.summary || "Expert pipeline recommendation",
      status: quality.rejected ? "rejected" : quality.proceed === false ? "recommended" : "approved",
      reasoning: critic.reasoning?.[0]?.reason || critic.summary,
      confidence: critic.confidence,
      expertId: "critic",
    });
    memory = aiCommit.memory;
    memoryChanges = [...memoryChanges, ...aiCommit.changes];
  }

  const experience = expertOutputs.find((o) => o.expertId === "experience_director");
  if (!experience) {
    throw new Error("Section 2 invariant violated: Experience Director did not review this response");
  }
  const payload = (experience?.output || experience?.payload || {}) as {
    ownerResponse?: string;
    questions?: string[];
    celebrate?: boolean;
    actions?: string[];
    delayed?: { extraQuestions?: string[] };
  };
  const confidence = clampAvg(expertOutputs.map((o) => o.confidence));
  const band = confidenceBand(confidence);
  let response = payload.ownerResponse || experience?.summary || "I'm thinking about your business.";
  let questions = (payload.questions || experience?.questions || []).slice(0, 3);
  let edActions = [...(payload.actions || ["reviewed"])];

  // Never expose internal failure details to customers
  if (/openai|anthropic|stack|exception|not_registered|expert_failed/i.test(response)) {
    const safe = applyExperienceDirector({
      request: req.request,
      draftResponse: "I'm putting together a clear next step for your business.",
      proposedQuestions: questions,
      confidence: Math.max(60, confidence),
      criticOk: true,
    });
    response = safe.ownerResponse;
    questions = safe.questions;
    edActions = [...edActions, ...safe.actions, "sanitized_customer_response"];
  }

  if (band === "ask" && !questions.length) {
    questions = ["What matters most right now — more bookings, or a more premium feel?"];
  }
  if (band === "research_more") {
    const edMore = applyExperienceDirector({
      request: req.request,
      draftResponse: "I want to research a bit more before I commit.",
      proposedQuestions: questions.length
        ? questions
        : ["Tell me who you mainly serve."],
      confidence,
      criticOk: false,
    });
    response = edMore.ownerResponse;
    questions = edMore.questions;
    edActions = [...edActions, ...edMore.actions, "research_more_gate"];
  }

  conversation = appendConversationTurn(conversation, { role: "hubly", text: response });
  if (businessId) {
    persistBusinessMemoryLocal(businessId, memory);
    persistWorkspaceMemoryLocal(businessId, workspace);
  }

  // Section 8 — persist structured Reasoning Objects + Decision Graph for build flows.
  let reasoningObjects: HublyReasoningObject[] = [];
  if (intent === "build_business" || /pressure\s*wash|starting a|homepage|booking|pricing/i.test(String(req.request || ""))) {
    reasoningObjects = recordBuildBusinessReasoningChain({
      request: String(req.request || ""),
      businessId,
      businessVersion: memory.memoryVersion,
      workspaceVersion: workspace.memoryVersion,
      dnaVersion: dna.knowledgePack?.knowledgeVersion ?? dna.version,
      industry: memory.industry || memory.business?.industry || dna.knowledgePack?.industryProfile?.industryName || null,
      experts: ordered,
    });
    // Also map expert decisions into the graph tip for this turn
    for (const d of decisions) {
      if (d.reasoningId) {
        const found = reasoningObjects.find((r) => r.reasoningId === d.reasoningId);
        if (found) continue;
      }
    }
  }

  const transcriptEntries = expertOutputs.map((out, idx) =>
    buildTranscriptEntry(out, idx, ordered, req, intent, expertOutputs)
  );
  const expertTranscript: HublyExpertTranscript = {
    customerVisible: false,
    entries: transcriptEntries,
    assembly: {
      expertsInOrder: ordered,
      finalResponseSource: "experience_director",
      mergedFrom: expertOutputs.map((o) => o.expertId),
      howAssembled:
        "Hubly Brain ran registry-selected experts in priority order, collected structured outputs " +
        "(Research Report → Business Strategy → Creative Plan → Quality Report → Experience Review), " +
        "then Experience Director produced the single customer-facing response.",
    },
  };

  return {
    ok: critic ? critic.ok !== false : true,
    intent,
    response,
    questions,
    celebrate: !!payload.celebrate,
    confidence,
    confidenceBand: band,
    expertsRun: ordered,
    expertOutputs,
    mergedExpertRecords: expertOutputs.map(toMergedRecord),
    expertTranscript,
    failures,
    decisions,
    reasoningObjects,
    whyAnswer: null,
    memory,
    memoryChanges,
    memoryCommittedBy: BUSINESS_MEMORY_OWNER,
    memoryRetrieval: null,
    dna,
    workspace,
    workspaceChanges,
    workspaceCommittedBy: WORKSPACE_MEMORY_OWNER,
    workspaceRetrieval: null,
    conversation,
    timeline,
    experienceDirector: {
      reviewedBy: "experience_director",
      actions: edActions,
      questionsShown: questions.length,
      questionsDelayed: (payload.delayed?.extraQuestions || []).length,
      celebrate: !!payload.celebrate,
      hideDetails: true,
    },
    console: req.debug
      ? {
        intent,
        expertsSelected: ordered,
        memoriesLoaded: [
          "business_memory",
          "business_dna",
          "workspace_memory",
          "conversation_memory",
          req.blueprintKnowledge ? "blueprints" : "",
        ].filter(Boolean),
        latencyMs: Date.now() - started,
      }
      : undefined,
  };
}

function clampAvg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.max(0, Math.min(100, Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)));
}

export function brainStatus() {
  ensureExpertsRegistered();
  const experts = discoverExperts();
  return {
    personality: "Hubly",
    experts,
    capabilityRegistry: listExpertCapabilities(),
    /** Derived from registry priorities — never a hardcoded Brain list. */
    pipeline: experts.map((e) => e.id),
    routing: "selectExpertsFromRegistry",
  };
}

export const HublyThink = {
  think,
  detectIntent,
  selectExperts,
  status: brainStatus,
};
