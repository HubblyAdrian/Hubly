/**
 * Hubly Brain — Think pipeline (Milestone 1)
 *
 * Conversation → Research → Strategy → Creative → Critic → Experience Director → Response
 *
 * Hubly Brain is the only coordinator. Experts never call each other.
 */

import { ensureExpertsRegistered } from "./hubly_brain_experts.ts";
import {
  listExpertCapabilities,
  listExperts,
  runExpert,
  type HublyExpertId,
  type HublyExpertOutput,
} from "./hubly_brain_expert_framework.ts";
import { normalizeBusinessMemory, type HublyBusinessMemoryInput } from "./hubly_brain_memory.ts";
import { normalizeBusinessDNA, type HublyBusinessDNAInput } from "./hubly_brain_dna.ts";
import {
  appendConversationTurn,
  normalizeConversationMemory,
  type HublyConversationMemoryInput,
} from "./hubly_brain_conversation_memory.ts";
import {
  normalizeWorkspaceMemory,
  type HublyWorkspaceMemoryInput,
} from "./hubly_brain_workspace_memory.ts";
import { makeDecision, type HublyDecisionRecord } from "./hubly_brain_reasoning.ts";
import { confidenceBand, type HublyConfidenceBand } from "./hubly_brain_confidence_policy.ts";
import { applyExperienceDirector } from "./hubly_brain_experience_director.ts";

export type HublyThinkIntent =
  | "build_business"
  | "website"
  | "workspace"
  | "research"
  | "coach"
  | "weather"
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
  debug?: boolean;
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
  decisions: HublyDecisionRecord[];
  memory: ReturnType<typeof normalizeBusinessMemory>;
  dna: ReturnType<typeof normalizeBusinessDNA>;
  workspace: ReturnType<typeof normalizeWorkspaceMemory>;
  conversation: ReturnType<typeof normalizeConversationMemory>;
  timeline: Array<{ expertId: string; ms: number; confidence: number; summary: string }>;
  /** Section 2 — Experience Director review evidence. */
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

function detectIntent(request: string, explicit?: string | null): string {
  if (explicit) return String(explicit);
  const r = String(request || "").toLowerCase();
  if (/weather|forecast|temperature/.test(r)) return "weather";
  if (/move |sidebar|dashboard|pin |hide |workspace|jobs above|customers/.test(r)) return "workspace";
  if (/website|homepage|luxury|premium|layout|brand|build me|build my/.test(r)) return "build_business";
  if (/research|competitor|industry/.test(r)) return "research";
  if (/coach|grow|booking|revenue/.test(r)) return "coach";
  return "general";
}

function selectExperts(intent: string, forced?: HublyExpertId[] | null): HublyExpertId[] {
  if (forced?.length) {
    const set = new Set<HublyExpertId>(forced);
    set.add("experience_director");
    return [...set];
  }
  if (intent === "weather") return ["experience_director"];
  if (intent === "workspace") return ["experience_director"];
  if (intent === "research") return ["research", "critic", "experience_director"];
  // Default build / website / coach — full think pipeline
  return ["research", "strategy", "creative_director", "critic", "experience_director"];
}

/** Pipeline order is fixed for think — Brain enforces sequence. */
const PIPELINE_ORDER: HublyExpertId[] = [
  "research",
  "strategy",
  "creative_director",
  "critic",
  "experience_director",
];

export async function think(req: HublyThinkRequest): Promise<HublyThinkResult> {
  const started = Date.now();
  ensureExpertsRegistered();

  const intent = detectIntent(req.request, req.intent);
  const memory = normalizeBusinessMemory(req.memory);
  const dna = normalizeBusinessDNA(req.dna);
  const workspace = normalizeWorkspaceMemory(req.workspace);
  let conversation = normalizeConversationMemory(req.conversation);
  conversation = appendConversationTurn(conversation, {
    role: "owner",
    text: String(req.request || "").trim(),
    at: new Date().toISOString(),
  });

  const selected = selectExperts(intent, req.experts);
  // Section 2 invariant: Experience Director always runs last on customer-facing think.
  if (!selected.includes("experience_director")) selected.push("experience_director");
  const ordered = PIPELINE_ORDER.filter((id) => selected.includes(id));
  // Include any forced experts not in default pipeline (except ED — always last)
  selected.forEach((id) => {
    if (id === "experience_director") return;
    if (!ordered.includes(id)) ordered.push(id);
  });
  if (ordered[ordered.length - 1] !== "experience_director") {
    const without = ordered.filter((id) => id !== "experience_director");
    without.push("experience_director");
    ordered.length = 0;
    ordered.push(...without);
  }

  const expertOutputs: HublyExpertOutput[] = [];
  const timeline: HublyThinkResult["timeline"] = [];
  const decisions: HublyDecisionRecord[] = [];

  // Fast paths still MUST pass Experience Director (Section 2).
  if (intent === "weather") {
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse:
        "I can check the weather for your service area once location services are connected — for now, tell me your city and I'll keep it in Business Memory.",
      proposedQuestions: memory.city ? [] : ["What city should I use for weather?"],
      confidence: 90,
      criticOk: true,
    });
    conversation = appendConversationTurn(conversation, { role: "hubly", text: ed.ownerResponse });
    return {
      ok: true,
      intent,
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: ed.celebrate,
      confidence: ed.confidence,
      confidenceBand: confidenceBand(ed.confidence),
      expertsRun: ["experience_director"],
      expertOutputs: [],
      decisions: [
        makeDecision({
          domain: "routing",
          decision: "weather_tool",
          reason: "Weather requests skip Creative Director and Research — Experience Director still reviews the reply.",
          evidence: [intent, ...ed.actions],
          confidence: 95,
          expertId: "experience_director",
        }),
      ],
      memory,
      dna,
      workspace,
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
          expertsSelected: ["experience_director"],
          memoriesLoaded: ["business_memory", "conversation_memory"],
          latencyMs: Date.now() - started,
        }
        : undefined,
    };
  }

  if (intent === "workspace") {
    const ed = applyExperienceDirector({
      request: req.request,
      draftResponse:
        "I can rearrange your workspace from preferences — tell me exactly what to move, hide, or pin.",
      proposedQuestions: [],
      confidence: 92,
      criticOk: true,
    });
    conversation = appendConversationTurn(conversation, { role: "hubly", text: ed.ownerResponse });
    return {
      ok: true,
      intent,
      response: ed.ownerResponse,
      questions: ed.questions,
      celebrate: ed.celebrate,
      confidence: ed.confidence,
      confidenceBand: confidenceBand(ed.confidence),
      expertsRun: ["experience_director"],
      expertOutputs: [],
      decisions: [
        makeDecision({
          domain: "workspace",
          decision: "workspace_preferences",
          reason: "Workspace changes update Workspace Memory only — Experience Director still reviews the reply.",
          evidence: [String(req.request), ...ed.actions],
          confidence: 92,
          expertId: "experience_director",
        }),
      ],
      memory,
      dna,
      workspace,
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
          expertsSelected: ["experience_director"],
          memoriesLoaded: ["workspace_memory", "conversation_memory"],
          latencyMs: Date.now() - started,
        }
        : undefined,
    };
  }

  for (const expertId of ordered) {
    const t0 = Date.now();
    const out = await runExpert(expertId, {
      request: req.request,
      intent,
      memory: memory as unknown as Record<string, unknown>,
      dna: dna as unknown as Record<string, unknown>,
      workspace: workspace as unknown as Record<string, unknown>,
      conversation: conversation as unknown as Record<string, unknown>,
      blueprintKnowledge: req.blueprintKnowledge || null,
      priorOutputs: expertOutputs,
    });
    expertOutputs.push(out);
    timeline.push({
      expertId,
      ms: Date.now() - t0,
      confidence: out.confidence,
      summary: out.summary,
    });
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
  }

  const experience = expertOutputs.find((o) => o.expertId === "experience_director");
  if (!experience) {
    throw new Error("Section 2 invariant violated: Experience Director did not review this response");
  }
  const critic = expertOutputs.find((o) => o.expertId === "critic");
  const payload = (experience?.payload || {}) as {
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
    decisions,
    memory,
    dna,
    workspace,
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
  return {
    personality: "Hubly",
    experts: listExperts(),
    capabilityRegistry: listExpertCapabilities(),
    pipeline: PIPELINE_ORDER,
  };
}

export const HublyThink = {
  think,
  detectIntent,
  selectExperts,
  status: brainStatus,
};
