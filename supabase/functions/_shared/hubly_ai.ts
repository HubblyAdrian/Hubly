/**
 * Hubly Brain / Hubly Runtime (export HublyAI / HublyBrain / Hubly)
 *
 * Not a chatbot. Not a completion wrapper.
 * Conversation → Understanding → Business Memory → Planner → Execution Plan
 * → Orchestrator → Executors → Hubly Platform
 *
 * Separation (critical):
 * - Understanding interprets language and intent (only layer that reads raw conversation).
 * - Memory stores structured facts and evolves over time (SSOT for every AI interaction).
 * - Planner reasons ONLY from structured Memory — decides WHAT (never HOW).
 * - Orchestrator decides HOW (DAG, parallel, retries, progress, cancel, history).
 * - Executors perform work (model never writes DB directly).
 *
 * Phases:
 *   7.0 — provider abstraction + skill surface + per-task models
 *   7.1 — Business Memory (SSOT)
 *   7.1b — Business Understanding separate from Memory
 *   7.2 — Capability Registry
 *   7.3 — Planner (memory-only)
 *   7.4 — Executors (Memory-safe)
 *   7.5 — Hubly Runtime (Orchestrator + Progress Bus + Execution History + buildBusiness)
 *   7.6 — Business DNA (identity) + Capability Confidence + Goals + Weekly Learning foundation
 *   Then migrate Website Builder onto the Runtime (not yet).
 *   After 7.6: freeze core layers — prove architecture by migrating capabilities.
 *
 * Permanent rule: Memory = facts ("what is true?"); DNA = identity ("what kind of business?").
 * Never combine them.
 *
 * Public API: Hubly.buildBusiness(prompt) — every future feature funnels here.
 * Never import this from the browser; secrets stay in Deno.env.
 * Milestone 1: Expert Framework + think() pipeline. Edge features migrate to HublyAI.complete — never call providers directly.
 */

import {
  businessMemoryKeys,
  formatBusinessMemory as formatMemoryPrompt,
  mergeBusinessMemory,
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
  HublyBusinessMemoryApi,
} from "./hubly_brain_memory.ts";
import {
  listSkills as listHublySkills,
  getSkill,
  type HublySkill,
  type HublySkillId,
} from "./hubly_brain_skills.ts";
import {
  listCapabilities as listHublyCapabilities,
  type HublyCapability,
  type HublyCapabilityId,
} from "./hubly_brain_capabilities.ts";
import {
  proposePlanFromMemory,
  proposeExecutionPlanFromMemory,
  executePlanStub,
  type HublyPlan,
  type HublyExecutionResult,
  HublyPlanner,
} from "./hubly_brain_planner.ts";
import {
  type HublyExecutionPlan,
} from "./hubly_brain_execution_plan.ts";
import {
  createProgressBus,
  type HublyProgressBus,
  type HublyProgressEvent,
  type HublyProgressListener,
} from "./hubly_brain_progress.ts";
import {
  orchestrate as runOrchestrator,
  type HublyOrchestratorResult,
  HublyOrchestrator,
} from "./hubly_brain_orchestrator.ts";
import {
  HublyExecutors,
} from "./hubly_brain_executors.ts";
import {
  evolveBusinessDNA,
  formatBusinessDNA as formatDnaPrompt,
  inferDNAFromConversation,
  inferDNAFromMemory,
  normalizeBusinessDNA,
  type HublyBusinessDNA,
  type HublyBusinessDNAInput,
  HublyBusinessDNAApi,
} from "./hubly_brain_dna.ts";
import {
  assessCapabilityConfidence,
  assessPlanConfidence,
  type HublyCapabilityConfidence,
  HublyConfidence,
} from "./hubly_brain_confidence.ts";
import {
  buildWeeklyLearningReport,
  HublyWeeklyLearning,
} from "./hubly_brain_weekly_learning.ts";
import {
  inferCustomerMemoryFromConversation,
  normalizeCustomerMemory,
  type HublyCustomerMemory,
  type HublyCustomerMemoryInput,
  HublyCustomerMemoryApi,
} from "./hubly_brain_customer_memory.ts";
import {
  customerProfileToMatchPreferences,
  inferCustomerProfileFromConversation,
  normalizeCustomerProfile,
  type HublyCustomerProfile,
  type HublyCustomerProfileInput,
  HublyCustomerProfileApi,
} from "./hubly_brain_customer_profile.ts";
import { scoreDnaFit, HublyCustomerMatch } from "./hubly_brain_customer_match.ts";
import { suggestDomains, suggestDomainsAsync, HublyDomain } from "./hubly_brain_domain.ts";
import { HublyBusinessLaunch } from "./hubly_brain_launch.ts";
import { resolveDomainProvider } from "./hubly_brain_launch.ts";
import { getPaymentsProvider, StripePaymentsProvider } from "./hubly_provider_payments.ts";
import { getCalendarProvider, GoogleCalendarProvider } from "./hubly_provider_calendar.ts";
import { createCloudflareDomainProvider } from "./hubly_provider_cloudflare.ts";
import { createPorkbunDomainProvider } from "./hubly_provider_porkbun.ts";
import { HublyProviders } from "./hubly_providers.ts";
import { buildLaunchTimeline, HublyTimeline } from "./hubly_brain_timeline.ts";
import { assessBusinessHealth, HublyBusinessHealthApi } from "./hubly_brain_health.ts";
import { buildBusinessIdentity, HublyIdentity } from "./hubly_brain_identity.ts";
import type { HublyIdentitySurface } from "./hubly_brain_identity.ts";
import type { HublyBusinessHealth } from "./hubly_brain_health.ts";
import type { HublyBusinessTimeline } from "./hubly_brain_timeline.ts";
import type { HublyDomainResult } from "./hubly_brain_domain.ts";
import {
  applyMaturityToDNA,
  inferMaturity,
  HublyMaturity,
  type HublyMaturityProfile,
} from "./hubly_brain_maturity.ts";
import {
  buildCreativeDirectorBrief,
  HublyCreativeDirector,
  type HublyCreativeDirectorBrief,
} from "./hubly_brain_creative_director.ts";
import {
  buildHublyDaily,
  HublyDaily,
  type HublyDailyBriefing,
} from "./hubly_brain_daily.ts";
import {
  understandConversation,
  applyUnderstandingToMemory,
  type HublyBusinessUnderstanding,
  type HublyConversationTurn,
  HublyUnderstanding,
} from "./hubly_brain_understanding.ts";
import {
  think as runThinkPipeline,
  brainStatus as thinkBrainStatus,
  HublyThink,
  type HublyThinkRequest,
  type HublyThinkResult,
} from "./hubly_brain_think.ts";
import { ensureExpertsRegistered, HublyExperts } from "./hubly_brain_experts.ts";
import { HublyExpertFramework, listExperts, listExpertCapabilities, discoverExperts, selectExpertsFromRegistry, unregisterExpert } from "./hubly_brain_expert_framework.ts";
import {
  HublyWorkspaceMemoryApi,
} from "./hubly_brain_workspace_memory.ts";
import {
  appendConversationTurn,
  HublyConversationMemoryApi,
  type HublyConversationMemory,
  type HublyConversationMemoryInput,
} from "./hubly_brain_conversation_memory.ts";
import {
  HublyConversationIntelligenceApi,
  type HublyConversationIntelligence,
  type HublyConversationIntelligenceInput,
} from "./hubly_brain_conversation_intelligence.ts";
import { HublyReasoning } from "./hubly_brain_reasoning.ts";
import { HublyDecisionEngine } from "./hubly_brain_decision.ts";
import {
  HublyRegistries,
  HublyToolRegistry,
  HublyKnowledgeRegistry,
} from "./hubly_brain_registries.ts";
import { HublyMissionControl } from "./hubly_brain_mission_control.ts";
import { HublyIdentitySystem, hublyIdentityPreamble } from "./hubly_brain_identity_system.ts";
import { HublyReliability } from "./hubly_brain_reliability.ts";
import { HublyPlatform } from "./hubly_brain_platform.ts";
import { HublyQuality } from "./hubly_brain_quality.ts";
import { HublyDocs } from "./hubly_brain_docs.ts";
import { HublyCertification } from "./hubly_brain_certification.ts";
import { HublyBuilderExpert } from "./hubly_brain_builder_expert.ts";
import { HublyChangePlanEngine } from "./hubly_brain_change_plan.ts";
import { HublyPreviewEngine } from "./hubly_brain_preview_engine.ts";
import { HublyCollaborationEngine } from "./hubly_brain_collaboration.ts";
import { HublyVersionEngine } from "./hubly_brain_version_engine.ts";
import { HublyBusinessBuilder } from "./hubly_brain_business_builder.ts";
import { HublyBookingIntelligence } from "./hubly_brain_booking_intelligence.ts";
import { HublyWorkspaceIntelligence } from "./hubly_brain_workspace_intelligence.ts";
import { HublyAutomationIntelligence } from "./hubly_brain_automation_intelligence.ts";
import { HublyMediaIntelligence } from "./hubly_brain_media_intelligence.ts";
import { HublyChatOs } from "./hubly_brain_chat_os.ts";
import { HublyBusinessDeployment } from "./hubly_brain_business_deployment.ts";
import { HublyPersonality } from "./hubly_brain_personality.ts";
import { HublyExperienceLayer } from "./hubly_brain_experience_layer.ts";
import { HublyConfidencePolicy } from "./hubly_brain_confidence_policy.ts";
import {
  logBrainExecution,
  listBrainExecutions,
  persistBrainExecution,
  HublyBrainExecutionLog,
} from "./hubly_brain_execution_log.ts";
import {
  reviewCustomerFacingText,
  listExperienceInterceptions,
  HublyExperienceDirector,
} from "./hubly_brain_experience_director.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type {
  HublyBusinessMemory,
  HublyBusinessMemoryInput,
  HublyBusinessDNA,
  HublyBusinessDNAInput,
  HublyCustomerMemory,
  HublyCustomerMemoryInput,
  HublyCustomerProfile,
  HublyCustomerProfileInput,
  HublySkill,
  HublySkillId,
  HublyPlan,
  HublyExecutionResult,
  HublyBusinessUnderstanding,
  HublyConversationTurn,
  HublyCapability,
  HublyCapabilityId,
  HublyExecutionPlan,
  HublyProgressEvent,
  HublyOrchestratorResult,
  HublyCapabilityConfidence,
  HublyIdentitySurface,
  HublyBusinessHealth,
  HublyBusinessTimeline,
  HublyDomainResult,
  HublyMaturityProfile,
  HublyCreativeDirectorBrief,
  HublyDailyBriefing,
};
export {
  HublyBusinessMemoryApi,
  HublyBusinessDNAApi,
  HublyCustomerMemoryApi,
  HublyCustomerProfileApi,
  HublyCustomerMatch,
  HublyDomain,
  HublyBusinessLaunch,
  HublyProviders,
  StripePaymentsProvider,
  GoogleCalendarProvider,
  HublyTimeline,
  HublyBusinessHealthApi,
  HublyIdentity,
  HublyMaturity,
  HublyCreativeDirector,
  HublyDaily,
  HublyPlanner,
  HublyUnderstanding,
  HublyOrchestrator,
  HublyExecutors,
  HublyConfidence,
  HublyWeeklyLearning,
  HublyThink,
  HublyExperts,
  HublyExpertFramework,
  HublyWorkspaceMemoryApi,
  HublyConversationMemoryApi,
  HublyConversationIntelligenceApi,
  HublyReasoning,
  HublyDecisionEngine,
  HublyRegistries,
  HublyToolRegistry,
  HublyKnowledgeRegistry,
  HublyMissionControl,
  HublyIdentitySystem,
  HublyReliability,
  HublyPlatform,
  HublyQuality,
  HublyDocs,
  HublyCertification,
  HublyBuilderExpert,
  HublyChangePlanEngine,
  HublyPreviewEngine,
  HublyCollaborationEngine,
  HublyVersionEngine,
  HublyBusinessBuilder,
  HublyBookingIntelligence,
  HublyWorkspaceIntelligence,
  HublyAutomationIntelligence,
  HublyMediaIntelligence,
  HublyChatOs,
  HublyBusinessDeployment,
  HublyPersonality,
  HublyExperienceLayer,
  HublyConfidencePolicy,
  HublyBrainExecutionLog,
  HublyExperienceDirector,
  listHublySkills as listSkills,
  listHublyCapabilities as listCapabilities,
  listExperts,
  listExpertCapabilities,
  discoverExperts,
  selectExpertsFromRegistry,
  unregisterExpert,
  listBrainExecutions,
  runThinkPipeline as think,
  getSkill,
  normalizeBusinessMemory,
  mergeBusinessMemory,
  normalizeBusinessDNA,
  evolveBusinessDNA,
  normalizeCustomerMemory,
  normalizeCustomerProfile,
  proposePlanFromMemory,
  proposeExecutionPlanFromMemory,
  understandConversation,
  runOrchestrator as orchestrate,
  createProgressBus,
  assessCapabilityConfidence,
  assessPlanConfidence,
  buildWeeklyLearningReport,
  scoreDnaFit,
  suggestDomains,
  suggestDomainsAsync,
  resolveDomainProvider,
  getPaymentsProvider,
  getCalendarProvider,
  createCloudflareDomainProvider,
  createPorkbunDomainProvider,
  assessBusinessHealth,
  buildBusinessIdentity,
  buildLaunchTimeline,
  inferMaturity,
  buildCreativeDirectorBrief,
  buildHublyDaily,
};

export type HublyAIProvider = "claude" | "openai";

/** Internal model routes — prefer skills + planner over picking these in product code. */
export type HublyAITask =
  | "chat"
  | "reason"
  | "website_builder"
  | "creative_director"
  | "business_coach"
  | "customer_concierge"
  | "customer_support"
  | "marketing"
  | "quote"
  | "photo_analysis"
  | "memory"
  | "lightweight"
  | "planner"
  | "document_generate"
  | "document_patch"
  | "storefront_build"
  | "lead_extract";

export type HublyTextPart = { type: "text"; text: string };
export type HublyImagePart = {
  type: "image";
  /** e.g. image/jpeg */
  mediaType: string;
  /** raw base64 (no data: prefix) */
  data: string;
};
/** Claude document block (PDF). Prefer images when possible. */
export type HublyDocumentPart = {
  type: "document";
  mediaType: string;
  data: string;
};
export type HublyContentPart = HublyTextPart | HublyImagePart | HublyDocumentPart;

export type HublyMessage = {
  role: "user" | "assistant" | "system";
  content: string | HublyContentPart[];
};

export type HublyAICallOpts = {
  /** Feature / edge function id for logs — e.g. creative-director */
  feature?: string;
  /** Named task — drives model + defaults. Prefer skills via plan(). */
  task?: HublyAITask;
  /** Override provider for this call. */
  provider?: HublyAIProvider;
  /** Override model for this call (per-task selection still preferred). */
  model?: string;
  system?: string;
  messages: HublyMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Prefer JSON-shaped replies when the provider supports it (OpenAI). */
  jsonMode?: boolean;
  /** OpenAI reasoning-tier models only. Directly bounds how many hidden
   *  reasoning tokens a call spends before it starts producing visible
   *  output — the actual latency lever for a reasoning model, distinct
   *  from maxTokens (which bounds reasoning + output combined, and doesn't
   *  by itself make the model reason less). Unset = provider default. */
  reasoningEffort?: "low" | "medium" | "high";
  /** Phase 7.1 — Business Memory (facts). Injected into system automatically. */
  memory?: HublyBusinessMemoryInput | null;
  /** Phase 7.6 — Business DNA (identity). Injected separately — never merged into Memory. */
  dna?: HublyBusinessDNAInput | null;
  /** Conversation Memory — Brain updates after every interaction when provided. */
  conversation?: HublyConversationMemoryInput | null;
  /** Optional business id for durable Brain execution + memory persistence. */
  businessId?: string | null;
  /** Phase 7.2 — requested skills (planning only until executors land). */
  skills?: HublySkillId[] | string[];
  /** @deprecated use skills */
  capabilities?: string[];
};

/** @deprecated Prefer HublyAICallOpts — kept for early complete() callers. */
export type HublyAICompleteOpts = HublyAICallOpts & { feature: string };

export type HublyAIResult = {
  text: string;
  provider: HublyAIProvider;
  model: string;
  task: HublyAITask;
  /** Echo of memory keys present (not full payload) for debugging. */
  memoryKeys?: string[];
  /** Section 1 — Brain execution id for this call. */
  executionId?: string;
  /** Experts Brain selected (empty = direct model completion). */
  expertsSelected?: string[];
  /** Conversation Memory after Brain updated it. */
  conversation?: HublyConversationMemory | null;
  memoryUpdated?: boolean;
  /** Real token usage from the provider response — the only honest basis
   *  for a cost figure. reasoningTokens is a subset of completionTokens
   *  (OpenAI bills reasoning tokens as output tokens), broken out
   *  separately because it's usually the dominant cost for a reasoning
   *  model and worth seeing on its own. */
  usage?: { promptTokens: number; completionTokens: number; reasoningTokens?: number };
  /** Provider finish reason — "stop"/"end_turn" is natural, "length"/"max_tokens"
   *  means the output was truncated at the token cap. A caller storing a document
   *  must reject a truncated one rather than persist a half-page as a success. */
  finishReason?: string;
};

/** @deprecated use HublySkillId */
export type HublyCapabilityId = HublySkillId;
/** @deprecated use HublySkill */
export type HublyCapability = HublySkill;

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
/** Primary reasoning model for business-building work. */
const DEFAULT_REASONING_MODEL = "gpt-5.5";
/** Reserved for future lightweight / high-volume tasks. */
const DEFAULT_LIGHTWEIGHT_MODEL = "gpt-5-mini";

type TaskRoute = {
  provider: HublyAIProvider;
  model: string;
  maxTokens: number;
  jsonMode?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
};

/**
 * Per-task model registry.
 * Business-building / reasoning tasks → GPT-5.5.
 * Lightweight reserved for future cheap/fast work — not the Hubly default.
 */
const TASK_ROUTES: Record<HublyAITask, TaskRoute> = {
  chat: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 1200 },
  reason: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 2200 },
  website_builder: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 3500, jsonMode: true },
  creative_director: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 1600, jsonMode: true },
  business_coach: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 2000 },
  customer_concierge: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 1400 },
  customer_support: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 1400 },
  marketing: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 2500 },
  quote: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 1800, jsonMode: true },
  photo_analysis: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 2000, jsonMode: true },
  memory: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 800 },
  lightweight: { provider: "openai", model: DEFAULT_LIGHTWEIGHT_MODEL, maxTokens: 600 },
  planner: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 2000, jsonMode: true },
  // DEFAULT_REASONING_MODEL is a reasoning-tier model — max_completion_tokens
  // covers hidden reasoning tokens AND the visible completion combined, not
  // just the output. Confirmed empirically: at 6000, a real page-generation
  // call spent the entire budget on reasoning and returned an EMPTY
  // completion (content: null) after ~66s — not a truncated-JSON failure,
  // a fully-consumed-budget one. 20000 leaves real headroom for both a
  // full page tree and the reasoning it takes to compose one. Patches are
  // a much smaller ask (a handful of ops against an existing tree), hence
  // the lower budget — worth the same scrutiny if patches start coming
  // back empty too.
  // reasoningEffort:"low" is the actual latency fix here, not maxTokens —
  // confirmed live that even in the background (EdgeRuntime.waitUntil,
  // itself capped at ~150s on the free tier, same ceiling as a foreground
  // request), a real generation call can still fail to finish. A page tree
  // in this format is closer to structured content generation than deep
  // logical reasoning, so a lower effort level should cost little in
  // quality while cutting the dominant cost (hidden reasoning tokens).
  document_generate: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 20000, jsonMode: true, reasoningEffort: "low" },
  // Storefront Builder AST generate/patch — reasoningEffort "low" so the reasoning model
  // spends its budget on the JSON output, not hidden reasoning (same lesson as document_generate).
  storefront_build: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 9000, jsonMode: true, reasoningEffort: "low" },
  document_patch: { provider: "openai", model: DEFAULT_REASONING_MODEL, maxTokens: 4000, jsonMode: true },
  // Small structured-extraction task (paste a text/DM, pull out name/phone/
  // email/service) — deliberately the lightweight tier, not the reasoning
  // model used for page generation. No reasoning effort: this isn't deep
  // reasoning, it's fast field extraction, and the real anti-hallucination
  // guarantee for phone/email is a post-response structural check against
  // the source text (see leadExtractFromText), not the model's discretion.
  // 800 not 500: gpt-5-mini (the lightweight tier) is itself a reasoning-
  // tier model — see hubly-intent-classify's own empirical note that 600
  // was the minimum reliable budget for a 3-field JSON response before
  // reasoning tokens ate a tight budget and left an empty completion. This
  // schema has 5 fields plus looksLikeLead/reason, so it gets more room.
  lead_extract: { provider: "openai", model: DEFAULT_LIGHTWEIGHT_MODEL, maxTokens: 800, jsonMode: true },
};

function env(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

function normalizeProvider(raw: string | null | undefined): HublyAIProvider | null {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "claude" || v === "anthropic") return "claude";
  if (v === "openai" || v === "gpt") return "openai";
  return null;
}

function normalizeTask(raw: string | null | undefined): HublyAITask | null {
  const v = String(raw || "").trim().toLowerCase().replace(/-/g, "_");
  if ((Object.keys(TASK_ROUTES) as string[]).includes(v)) return v as HublyAITask;
  return null;
}

/** Shared JSON scrape used after HublyAI calls. */
export function extractJson(rawText: string): string {
  const cleaned = String(rawText || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return cleaned;
  return cleaned.slice(start, end + 1);
}

/** Short voice reminder — Hubly Identity System (Section 13) is the source of truth. */
export function personalityPreamble(): string {
  return hublyIdentityPreamble();
}

function claudeFallbackModel(): string {
  return env("HUBLY_AI_CLAUDE_MODEL") || env("ANTHROPIC_MODEL") || DEFAULT_CLAUDE_MODEL;
}

function openaiReasoningModel(): string {
  return env("HUBLY_AI_REASONING_MODEL") || env("HUBLY_AI_OPENAI_MODEL") || env("OPENAI_MODEL") ||
    DEFAULT_REASONING_MODEL;
}

function openaiLightweightModel(): string {
  return env("HUBLY_AI_LIGHTWEIGHT_MODEL") || DEFAULT_LIGHTWEIGHT_MODEL;
}

/** Per-task model override env var, e.g. document_generate -> HUBLY_AI_MODEL_DOCUMENT_GENERATE.
 *  Lets a single task's model be swapped (for a benchmark, a rollout, a
 *  regression) without touching code or retargeting every other task that
 *  shares the same tier-level env var below. */
function taskModelEnvKey(task: HublyAITask): string {
  return `HUBLY_AI_MODEL_${task.toUpperCase()}`;
}

function resolveTaskRoute(task: HublyAITask): TaskRoute {
  const base = { ...TASK_ROUTES[task] };
  // Resolution order: per-task override > tier-level env override > hardcoded default.
  // Unset (the default today) resolves identically to before this existed —
  // this is additive plumbing, not a behavior change.
  const perTaskOverride = env(taskModelEnvKey(task));
  if (perTaskOverride) {
    base.model = perTaskOverride;
  } else if (base.provider === "openai") {
    // Tier is decided by what TASK_ROUTES actually configured this task to
    // use, not by hardcoding task name — checking task==='lightweight'
    // literally would silently upgrade every other lightweight-tier task
    // (e.g. lead_extract) to the expensive reasoning model the moment it
    // stopped being the only one.
    base.model = TASK_ROUTES[task].model === DEFAULT_LIGHTWEIGHT_MODEL
      ? openaiLightweightModel()
      : openaiReasoningModel();
  } else {
    base.model = claudeFallbackModel();
  }
  return base;
}

function memoryKeys(memory?: HublyBusinessMemoryInput | null): string[] {
  return businessMemoryKeys(memory);
}

/** Format Business Memory for system injection (Phase 7.1 SSOT). */
export function formatBusinessMemory(memory?: HublyBusinessMemoryInput | null): string {
  return formatMemoryPrompt(memory);
}

function composeSystem(opts: HublyAICallOpts): string | undefined {
  const parts: string[] = [];
  if (opts.system) parts.push(String(opts.system));
  // Inject Memory (facts) and DNA (identity) as separate labeled blocks — never combined.
  const mem = formatBusinessMemory(opts.memory);
  if (mem) parts.push(mem);
  const dnaBlock = formatDnaPrompt(opts.dna);
  if (dnaBlock) parts.push(dnaBlock);
  const skillList = opts.skills?.length ? opts.skills : opts.capabilities;
  if (skillList?.length) {
    parts.push(
      "REQUESTED SKILLS (plan / execute via Runtime; never write the database directly):\n" +
        skillList.map((c) => `- ${c}`).join("\n"),
    );
  }
  return parts.length ? parts.join("\n\n") : undefined;
}

function toClaudeContent(content: string | HublyContentPart[]): string | Record<string, unknown>[] {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "document") {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: part.mediaType || "application/pdf",
          data: part.data,
        },
      };
    }
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: part.mediaType || "image/jpeg",
        data: part.data,
      },
    };
  });
}

function toOpenAIContent(
  content: string | HublyContentPart[],
): string | Record<string, unknown>[] {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "document") {
      return {
        type: "text",
        text: `[Attached PDF document — ${part.mediaType || "application/pdf"}; ask the owner for a screenshot if text extraction is required.]`,
      };
    }
    const mediaType = part.mediaType || "image/jpeg";
    return {
      type: "image_url",
      image_url: { url: `data:${mediaType};base64,${part.data}` },
    };
  });
}

type InternalCall = HublyAICallOpts & {
  feature: string;
  task: HublyAITask;
  provider: HublyAIProvider;
  model: string;
};

async function callClaude(opts: InternalCall): Promise<HublyAIResult> {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new HublyAIConfigError(
      "claude",
      "AI isn't configured yet. Add an ANTHROPIC_API_KEY secret.",
    );
  }
  const messages = (opts.messages || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: toClaudeContent(m.content),
    }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature,
      system: composeSystem(opts) || undefined,
      messages: messages.length ? messages : [{ role: "user", content: "Hello" }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("HublyAI claude error", opts.feature, opts.task, res.status, errText);
    throw new HublyAIProviderError("claude", res.status, "Claude is temporarily unavailable.");
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n")
    .trim();

  return {
    text,
    provider: "claude",
    model: opts.model,
    task: opts.task,
    memoryKeys: memoryKeys(opts.memory),
  };
}

async function callOpenAI(opts: InternalCall): Promise<HublyAIResult> {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) {
    throw new HublyAIConfigError(
      "openai",
      "OpenAI isn't configured yet. Add an OPENAI_API_KEY secret.",
    );
  }
  const messages: Record<string, unknown>[] = [];
  const system = composeSystem(opts);
  if (system) messages.push({ role: "system", content: system });
  for (const m of opts.messages || []) {
    if (m.role === "system") {
      messages.push({ role: "system", content: typeof m.content === "string" ? m.content : "" });
      continue;
    }
    messages.push({
      role: m.role,
      content: toOpenAIContent(m.content),
    });
  }
  if (!messages.length) messages.push({ role: "user", content: "Hello" });

  const body: Record<string, unknown> = {
    model: opts.model,
    max_completion_tokens: opts.maxTokens ?? 700,
    messages,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;

  // RETRY THE RETRYABLE ONES.
  //
  // There was no retry here at all: a single 429 ended the whole turn, and the
  // person saw "temporarily unavailable" or, on a background build, nothing
  // whatsoever. On 2026-08-19 five consecutive requests came back 429 -- the
  // same failure that was being read as isolates being recycled, because both
  // present identically from the outside: no page, no error, no signal.
  //
  // Bounded and honest: three attempts, exponential backoff, and retry-after
  // respected when the provider sends one. 4xx other than 429 are NOT retried
  // -- a 401 from a rotated key or a 400 from a malformed request will fail the
  // same way three times and only delay the truth.
  const RETRYABLE = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 3;
  let res!: Response;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) break;

    lastStatus = res.status;
    lastBody = await res.text();
    console.error("HublyAI openai error", opts.feature, opts.task, res.status, `attempt ${attempt}/${MAX_ATTEMPTS}`, lastBody.slice(0, 400));

    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) break;

    // insufficient_quota is a 429 that will never succeed -- it is a billing
    // state, not congestion. Retrying it wastes a minute of somebody's time to
    // arrive at the same answer.
    if (res.status === 429 && /insufficient_quota|billing/i.test(lastBody)) break;

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 20_000)
      : Math.min(1000 * Math.pow(2, attempt - 1), 8000);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  if (!res.ok) {
    // The MESSAGE says which, because "temporarily unavailable" covering a
    // quota exhaustion, a rotated key and a real outage is how a fixable
    // problem stays unfixed. Still no provider body -- this reaches a person.
    const quota = lastStatus === 429 && /insufficient_quota|billing/i.test(lastBody);
    throw new HublyAIProviderError(
      "openai",
      lastStatus,
      quota
        ? "The OpenAI account has no quota left."
        : lastStatus === 429
        ? "OpenAI is rate-limiting us right now."
        : lastStatus === 401 || lastStatus === 403
        ? "The OpenAI credentials were rejected."
        : "OpenAI is temporarily unavailable.",
    );
  }

  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  // The finish reason. "length" means the output was cut off at the token cap —
  // a truncated answer, which a caller storing a document MUST be able to reject
  // rather than persist as if it were whole.
  const finishReason = String(data?.choices?.[0]?.finish_reason || "");
  const rawUsage = data?.usage;
  const usage = rawUsage
    ? {
      promptTokens: Number(rawUsage.prompt_tokens) || 0,
      completionTokens: Number(rawUsage.completion_tokens) || 0,
      reasoningTokens: Number(rawUsage.completion_tokens_details?.reasoning_tokens) || undefined,
    }
    : undefined;
  return {
    text,
    provider: "openai",
    model: opts.model,
    task: opts.task,
    memoryKeys: memoryKeys(opts.memory),
    usage,
    finishReason,
  };
}

export class HublyAIConfigError extends Error {
  provider: HublyAIProvider;
  constructor(provider: HublyAIProvider, message: string) {
    super(message);
    this.name = "HublyAIConfigError";
    this.provider = provider;
  }
}

export class HublyAIProviderError extends Error {
  provider: HublyAIProvider;
  status: number;
  constructor(provider: HublyAIProvider, status: number, message: string) {
    super(message);
    this.name = "HublyAIProviderError";
    this.provider = provider;
    this.status = status;
  }
}

function resolveInternal(opts: HublyAICallOpts, fallbackTask: HublyAITask): InternalCall {
  const task = normalizeTask(opts.task) || fallbackTask;
  const route = resolveTaskRoute(task);
  // Low-level complete() without task may still prefer Claude for unmigrated features
  // when HUBLY_AI_PROVIDER is unset and caller didn't set task — handled by callers.
  const provider = normalizeProvider(opts.provider) || route.provider;
  // route.model already carries the correct resolution (per-task override >
  // tier env > default) as long as opts.provider didn't override the
  // provider away from what route resolved for — recompute only in that
  // edge case, otherwise reuse route.model rather than duplicating its logic.
  const model = (opts.model || "").trim() ||
    (provider === route.provider
      ? route.model
      : provider === "openai"
      ? (TASK_ROUTES[task].model === DEFAULT_LIGHTWEIGHT_MODEL ? openaiLightweightModel() : openaiReasoningModel())
      : claudeFallbackModel());
  return {
    ...opts,
    feature: String(opts.feature || task),
    task,
    provider,
    model,
    maxTokens: opts.maxTokens ?? route.maxTokens,
    jsonMode: opts.jsonMode ?? route.jsonMode,
    reasoningEffort: opts.reasoningEffort ?? route.reasoningEffort,
  };
}

const CUSTOMER_FACING_TASKS: Set<HublyAITask> = new Set([
  "chat",
  "customer_support",
  "customer_concierge",
  "business_coach",
]);

/**
 * Which part of the product paid for this call.
 *
 * `feature` and `task` already exist, but neither answers "what did building a
 * page cost" without a lookup table in someone's head. Recording the phase makes
 * the cost question a group-by instead of an argument.
 */
function phaseFor(feature?: string, task?: string | null): string {
  const f = String(feature || "");
  const t = String(task || "");
  if (t === "document_generate" || f.includes("document-generate")) return "generation";
  if (t === "document_patch" || f.includes("document-patch")) return "edit";
  if (f.includes("record-extract")) return "extraction";
  if (t === "storefront_build" || f.includes("storefront")) return "storefront";
  if (f.includes("conversation")) return "conversation";
  if (f.includes("scratch-freeform")) return "freeform-experiment";
  return "other";
}

async function run(opts: InternalCall): Promise<HublyAIResult> {
  const started = Date.now();
  // Section 1: Brain alone decides experts. Direct complete = empty expert set until ED.
  const expertsSelected: string[] = [];
  let conversation = opts.conversation
    ? appendConversationTurn(opts.conversation, {
      role: "owner",
      text: lastUserText(opts.messages),
    })
    : null;

  try {
    console.log("HublyBrain.run", {
      feature: opts.feature,
      task: opts.task,
      provider: opts.provider,
      model: opts.model,
      memoryKeys: memoryKeys(opts.memory),
      expertsSelected,
    });
    let result = opts.provider === "openai" ? await callOpenAI(opts) : await callClaude(opts);

    // Section 2: every customer-facing freeform reply passes Experience Director.
    if (CUSTOMER_FACING_TASKS.has(opts.task) && !opts.jsonMode) {
      const ed = reviewCustomerFacingText(String(result.text || ""), {
        request: lastUserText(opts.messages),
        confidence: 80,
      });
      result = { ...result, text: ed.ownerResponse };
      expertsSelected.push("experience_director");
    }

    if (conversation) {
      conversation = appendConversationTurn(conversation, {
        role: "hubly",
        text: String(result.text || "").slice(0, 4000),
      });
    }

    const execution = logBrainExecution({
      kind: "complete",
      feature: opts.feature,
      task: opts.task,
      // Real provider-reported usage. It was parsed out of every response and
      // then thrown away, which is why "what does a page cost" had to be
      // reasoned about rather than read.
      usage: result.usage ?? null,
      phase: phaseFor(opts.feature, opts.task),
      expertsSelected,
      mergedResponse: true, // single Brain-owned response
      memoryUpdated: !!conversation || !!opts.memory,
      ok: true,
      latencyMs: Date.now() - started,
      provider: result.provider,
      model: result.model,
      businessId: opts.businessId || null,
    });
    persistBrainExecution(execution).catch(() => {});

    return {
      ...result,
      executionId: execution.id,
      expertsSelected,
      conversation,
      memoryUpdated: execution.memoryUpdated,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const execution = logBrainExecution({
      kind: "complete",
      feature: opts.feature,
      task: opts.task,
      phase: phaseFor(opts.feature, opts.task),
      expertsSelected,
      mergedResponse: false,
      memoryUpdated: false,
      ok: false,
      latencyMs: Date.now() - started,
      provider: opts.provider,
      model: opts.model,
      error: msg,
      businessId: opts.businessId || null,
    });
    persistBrainExecution(execution).catch(() => {});
    throw err;
  }
}

function lastUserText(messages: HublyMessage[] | undefined): string {
  if (!messages?.length) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content.slice(0, 2000);
    const text = (m.content || [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (text) return text.slice(0, 2000);
  }
  return "";
}

export const HublyAI = {
  /** Public product name for this layer. */
  name: "Hubly Brain" as const,

  /**
   * Provider default for low-level complete() when no task is given.
   * Remains Claude so unmigrated edge functions are not swapped by accident.
   * Skill methods use the per-task registry (GPT-5.5).
   */
  defaultProvider(): HublyAIProvider {
    return normalizeProvider(env("HUBLY_AI_PROVIDER")) || "claude";
  },

  /** Primary reasoning model for business-building tasks. */
  reasoningModel(): string {
    return openaiReasoningModel();
  },

  resolveProvider(override?: HublyAIProvider | string | null): HublyAIProvider {
    return normalizeProvider(override) || this.defaultProvider();
  },

  /** Resolve provider + model for a named task (extensible per-task selection). */
  resolveTask(task: HublyAITask | string): TaskRoute & { task: HublyAITask } {
    const t = normalizeTask(task) || "reason";
    return { task: t, ...resolveTaskRoute(t) };
  },

  models() {
    return {
      claude: claudeFallbackModel(),
      openaiReasoning: openaiReasoningModel(),
      openaiLightweight: openaiLightweightModel(),
      tasks: Object.fromEntries(
        (Object.keys(TASK_ROUTES) as HublyAITask[]).map((t) => [t, resolveTaskRoute(t)]),
      ),
    };
  },

  isConfigured(provider?: HublyAIProvider | string | null): boolean {
    const p = normalizeProvider(provider) || this.defaultProvider();
    if (p === "openai") return !!env("OPENAI_API_KEY");
    return !!env("ANTHROPIC_API_KEY");
  },

  status() {
    const skills = listHublySkills();
    const capabilities = listHublyCapabilities();
    const executableCaps = capabilities.filter((c) => c.executable);
    const openaiModel = this.reasoningModel();
    return {
      layer: "Hubly Runtime + Business DNA",
      vision: "Conversation → Understanding → Memory (facts) + DNA (identity) → Planner → Execution Plan → Orchestrator → Executors → Platform",
      defaultProvider: this.defaultProvider(),
      reasoningModel: openaiModel,
      models: this.models(),
      configured: {
        claude: !!env("ANTHROPIC_API_KEY"),
        openai: !!env("OPENAI_API_KEY"),
      },
      skills: skills.map((s) => ({ id: s.id, label: s.label, executable: s.executable })),
      capabilities: capabilities.map((c) => ({
        id: c.id,
        label: c.label,
        executable: c.executable,
        dependsOn: c.defaultDependsOn,
      })),
      foundationChecklist: {
        gpt55Connected: openaiModel === "gpt-5.5" || openaiModel.startsWith("gpt-5.5"),
        aiAbstractionLayer: true,
        businessMemorySsot: true,
        businessDna: true,
        conversationUnderstandingMemory: true,
        plannerSeparatedFromMemory: true,
        capabilityRegistryFoundation: skills.length > 0,
        hublyRuntime: true,
        orchestrator: true,
        progressBus: true,
        executionHistory: true,
        buildBusinessApi: true,
        capabilityConfidence: true,
        websiteRuntime: true,
        customerRuntime: true,
        domainCapability: true,
        businessIdentity: true,
        businessTimeline: true,
        businessHealth: true,
        businessMaturity: true,
        creativeDirector: true,
        hublyDaily: true,
        productionFirstProviders: true,
        businessLaunch: true,
        architectureFrozenAfterDna: true,
        // Milestone 1 — Hubly Brain Foundation
        hublyBrainThinkPipeline: true,
        expertFramework: true,
        aiCapabilityRegistry: true,
        experienceDirector: true,
        workspaceMemory: true,
        conversationMemory: true,
        reasoningEngine: true,
        confidencePolicy: true,
        brainConsole: true,
        section1OnlyBrainEntry: true,
        section1ExecutionLog: true,
        section1MemoryAfterEveryInteraction: true,
      },
      personality: "Hubly",
      experts: (() => {
        ensureExpertsRegistered();
        return listExperts().map((e) => ({ id: e.id, name: e.name, version: e.version }));
      })(),
      recentExecutions: listBrainExecutions(10),
      providers: {
        domain: ["cloudflare", "porkbun"],
        payments: ["stripe"],
        calendar: ["google_calendar"],
        rule: "Provider not configured — never simulate success",
      },
      phases: {
        "7.0": "DONE — provider abstraction + per-task models (GPT-5.5 for business-building)",
        "7.1": "DONE — Business Memory SSOT (facts)",
        "7.1b": "DONE — Understanding separate from Memory",
        "7.2": "DONE — Capability Registry",
        "7.3": "DONE — Planner (WHAT — reads Memory + DNA)",
        "7.4": "DONE foundation — Memory-safe executors",
        "7.5": "DONE foundation — Hubly Runtime",
        "7.6": "DONE foundation — Business DNA + Confidence + Goals + Weekly Learning foundation",
        "7.7": "DONE foundation — Website Runtime (Conversation → your business is live)",
        "7.8": "DONE foundation — Customer Runtime (AI concierge + DNA-fit matching)",
        "8": "IN PROGRESS — Prove the product (Build · Creative Director · Daily · Domain · Coach)",
      },
      jobsHublyPerforms: [
        "Build my business",
        "Get me customers",
        "Help me grow",
        "Run my business",
      ],
      separation: {
        understanding: "interprets language → Memory facts + DNA identity patches",
        memory: "factual SSOT — what is true?",
        dna: "interpretive identity — what kind of business is this? (never combine with Memory; evolves via Weekly Learning)",
        planner: "selects capabilities from Memory + DNA — never execution mechanics",
        orchestrator: "DAG, parallel, retries, confidence gates, progress, cancel, history",
        executors: "receive Memory + DNA separately; model never writes DB directly",
      },
      permanentRule: "Business Memory is factual. Business DNA is interpretive. Never combine them.",
      guidingPrinciple: "Hubly should make owning a business feel as simple as describing one.",
      partnerTest: "Does this make Hubly feel more like an AI business partner?",
      workReductionTest: "Does this reduce work for the business owner?",
      jobTest: "What job should Hubly do for the owner?",
      constitution: "docs/HUBLY_CONSTITUTION.md",
      publicApi: {
        business: "Hubly.buildBusiness(prompt)",
        customer: "Hubly.findPro(prompt)",
        daily: "Hubly.daily()",
      },
      magicalMoments: [
        "Hubly built my business",
        "Hubly got me my first customer",
        "Hubly helped me grow",
        "Hubly runs my business",
      ],
      executableCapabilities: executableCaps.map((c) => c.id),
      note: "Phase 8: prove the product. Hubly Daily is the homepage. Creative Director explains DNA. Jobs > features.",
    };
  },

  extractJson,
  personalityPreamble,
  formatBusinessMemory,
  formatBusinessDNA: formatDnaPrompt,

  /**
   * Business Understanding — interprets language.
   * Only layer allowed to read raw conversation.
   */
  understand(
    conversation: string | HublyConversationTurn[],
    priorMemory?: HublyBusinessMemoryInput | null,
  ): HublyBusinessUnderstanding {
    return understandConversation(conversation, priorMemory);
  },

  /**
   * Phase 7.1 / Section 5 — Business Memory SSOT (facts).
   * Experts suggest; only Hubly Brain commits (see HublyBusinessMemoryApi.commit).
   */
  memory(input?: HublyBusinessMemoryInput | null): HublyBusinessMemory {
    return normalizeBusinessMemory(input);
  },

  mergeMemory(
    base?: HublyBusinessMemoryInput | null,
    patch?: HublyBusinessMemoryInput | null,
  ): HublyBusinessMemory {
    return mergeBusinessMemory(base, patch);
  },

  /** Section 5 — Brain-owned memory API (commit / query / importance). */
  businessMemory: HublyBusinessMemoryApi,

  /** Section 6 — Brain-owned workspace preferences (how the owner likes to work). */
  workspaceMemory: HublyWorkspaceMemoryApi,

  /**
   * Phase 7.6 / Section 7 — Business DNA (identity + knowledge). Never merge into Memory.
   * Experts read DNA; Hubly Brain loads knowledge packs.
   */
  dna(input?: HublyBusinessDNAInput | null): HublyBusinessDNA {
    return normalizeBusinessDNA(input);
  },

  evolveDna(
    base?: HublyBusinessDNAInput | null,
    patch?: HublyBusinessDNAInput | null,
  ): HublyBusinessDNA {
    return evolveBusinessDNA(base, patch);
  },

  /** Section 7 — structured DNA knowledge API (evidenced, versioned, read-only for experts). */
  businessDna: HublyBusinessDNAApi,

  /** Phase 7.2 — skills Hubly can eventually execute (Capability Registry). */
  listSkills(): HublySkill[] {
    return listHublySkills();
  },

  /** Runtime capabilities (DAG nodes). */
  listRuntimeCapabilities(): HublyCapability[] {
    return listHublyCapabilities();
  },

  /** @deprecated prefer listSkills() / listRuntimeCapabilities() */
  listCapabilities(): HublySkill[] {
    return listHublySkills();
  },

  /**
   * Phase 7.3 / 7.6 — Planner.
   * Reads Memory (facts) + DNA (identity). Never raw conversation. Never HOW.
   */
  plan(
    memory?: HublyBusinessMemoryInput | null,
    dna?: HublyBusinessDNAInput | null,
  ): HublyPlan {
    return proposePlanFromMemory(normalizeBusinessMemory(memory), normalizeBusinessDNA(dna));
  },

  /** Phase 7.5 / 7.6 — Execution Plan (WHAT only). */
  executionPlan(
    memory?: HublyBusinessMemoryInput | null,
    dna?: HublyBusinessDNAInput | null,
  ): HublyExecutionPlan {
    return proposeExecutionPlanFromMemory(
      normalizeBusinessMemory(memory),
      normalizeBusinessDNA(dna),
    );
  },

  assessConfidence(
    capability: HublyCapabilityId,
    opts?: { memory?: HublyBusinessMemoryInput | null; dna?: HublyBusinessDNAInput | null },
  ): HublyCapabilityConfidence {
    return assessCapabilityConfidence(capability, opts);
  },

  /**
   * Full Brain turn without calling providers:
   * Conversation → Understanding → Memory + DNA → Plan.
   */
  ingest(
    conversation: string | HublyConversationTurn[],
    priorMemory?: HublyBusinessMemoryInput | null,
    priorDna?: HublyBusinessDNAInput | null,
  ): {
    understanding: HublyBusinessUnderstanding;
    memory: HublyBusinessMemory;
    dna: HublyBusinessDNA;
    plan: HublyPlan;
    executionPlan: HublyExecutionPlan;
    confidence: HublyCapabilityConfidence[];
  } {
    const understanding = understandConversation(conversation, priorMemory);
    const memory = applyUnderstandingToMemory(priorMemory, understanding);
    const text = typeof conversation === "string"
      ? conversation
      : conversation.map((t) => t.content || t.text || "").join("\n");
    const dna = evolveBusinessDNA(
      inferDNAFromMemory(memory, priorDna),
      inferDNAFromConversation(text, priorDna),
    );
    const plan = proposePlanFromMemory(memory, dna);
    const executionPlan = plan.executionPlan || proposeExecutionPlanFromMemory(memory, dna);
    const confidence = assessPlanConfidence(
      executionPlan.steps.map((s) => s.capability),
      { memory, dna },
    );
    return { understanding, memory, dna, plan, executionPlan, confidence };
  },

  /**
   * Phase 7.5 — Orchestrator entry.
   * Prefer buildBusiness() for the full pipeline.
   */
  async orchestrate(
    plan: HublyExecutionPlan | HublyPlan,
    ctx?: {
      memory?: HublyBusinessMemoryInput | null;
      dna?: HublyBusinessDNAInput | null;
      businessId?: string | null;
      ownerId?: string | null;
      supabase?: SupabaseClient | null;
      persist?: boolean;
      maxRetries?: number;
      signal?: AbortSignal | null;
      onProgress?: HublyProgressListener;
      bus?: HublyProgressBus;
      recordHistory?: boolean;
      respectConfidence?: boolean;
    },
  ): Promise<HublyOrchestratorResult> {
    const executionPlan: HublyExecutionPlan =
      "version" in plan && (plan as HublyExecutionPlan).version === 1
        ? plan as HublyExecutionPlan
        : ((plan as HublyPlan).executionPlan ||
          proposeExecutionPlanFromMemory(ctx?.memory, ctx?.dna));
    return runOrchestrator({
      plan: executionPlan,
      memory: ctx?.memory,
      dna: ctx?.dna,
      businessId: ctx?.businessId,
      ownerId: ctx?.ownerId,
      supabase: ctx?.supabase,
      persist: ctx?.persist,
      maxRetries: ctx?.maxRetries,
      signal: ctx?.signal,
      onProgress: ctx?.onProgress,
      bus: ctx?.bus,
      recordHistory: ctx?.recordHistory,
      respectConfidence: ctx?.respectConfidence,
    });
  },

  /**
   * @deprecated Prefer buildBusiness / orchestrate.
   */
  execute(plan: HublyPlan): HublyExecutionResult {
    return executePlanStub(plan);
  },

  /**
   * Public Runtime API — everything funnels through this pipeline.
   * Hubly.buildBusiness("I own Acme Home Cleaning.")
   * Builds Memory (facts) + DNA (identity), plans, orchestrates.
   * Ends with Business Identity + Timeline + Health — launching a company, not a wizard.
   */
  async buildBusiness(
    prompt: string,
    opts?: {
      businessId?: string | null;
      ownerId?: string | null;
      memory?: HublyBusinessMemoryInput | null;
      dna?: HublyBusinessDNAInput | null;
      supabase?: SupabaseClient | null;
      persist?: boolean;
      maxRetries?: number;
      signal?: AbortSignal | null;
      onProgress?: HublyProgressListener;
      recordHistory?: boolean;
      respectConfidence?: boolean;
    },
  ): Promise<{
    runId: string;
    prompt: string;
    understanding: HublyBusinessUnderstanding;
    memory: HublyBusinessMemory;
    dna: HublyBusinessDNA;
    executionPlan: HublyExecutionPlan;
    confidence: HublyCapabilityConfidence[];
    clarifyingQuestions: string[];
    orchestration: HublyOrchestratorResult;
    progress: HublyProgressEvent[];
    website?: { slug?: string | null; businessId?: string | null; published?: boolean };
    identity?: HublyIdentitySurface;
    timeline?: HublyBusinessTimeline;
    health?: HublyBusinessHealth;
    domain?: HublyDomainResult | null;
    maturity?: HublyMaturityProfile;
    creativeDirector?: HublyCreativeDirectorBrief;
    daily?: HublyDailyBriefing;
  }> {
    const bus = createProgressBus();
    if (opts?.onProgress) bus.subscribe(opts.onProgress);

    bus.emit({
      capability: null,
      state: "greeting",
      message: "👋 Nice to meet you.",
    });
    bus.emit({
      capability: null,
      state: "understanding",
      message: "Learning about your business…",
    });

    const understanding = understandConversation(prompt, opts?.memory);
    const memory = applyUnderstandingToMemory(opts?.memory, understanding);
    let dna = evolveBusinessDNA(
      inferDNAFromMemory(memory, opts?.dna),
      inferDNAFromConversation(prompt, opts?.dna),
    );
    const maturity = inferMaturity({ memory, dna });
    dna = applyMaturityToDNA(dna, maturity.stage);

    bus.emit({
      capability: null,
      state: "planning",
      message: "Planning what your business needs…",
    });

    const executionPlan = proposeExecutionPlanFromMemory(memory, dna);
    const confidence = assessPlanConfidence(
      executionPlan.steps.map((s) => s.capability),
      { memory, dna },
    );

    const orchestration = await runOrchestrator({
      plan: executionPlan,
      memory,
      dna,
      businessId: opts?.businessId,
      ownerId: opts?.ownerId,
      supabase: opts?.supabase,
      persist: opts?.persist,
      maxRetries: opts?.maxRetries,
      signal: opts?.signal,
      bus,
      recordHistory: opts?.recordHistory,
      respectConfidence: opts?.respectConfidence,
    });

    if (opts?.supabase && opts?.businessId && orchestration.historyId) {
      try {
        await opts.supabase
          .from("hubly_execution_runs")
          .update({ prompt })
          .eq("id", orchestration.historyId);
      } catch (_) {
        /* ignore */
      }
    }

    const websiteResult = orchestration.results.find((r) => r.capability === "website");
    const websiteEffects = (websiteResult?.effects || {}) as {
      slug?: string | null;
      businessId?: string | null;
      published?: boolean;
    };
    const domainEffects = (orchestration.results.find((r) => r.capability === "domain")?.effects ||
      {}) as { domain?: HublyDomainResult };
    const domain = domainEffects.domain ||
      (orchestration.memory.extras && typeof orchestration.memory.extras === "object"
        ? (orchestration.memory.extras as Record<string, unknown>).domain as HublyDomainResult | undefined
        : null) ||
      null;
    const marketplaceReady = orchestration.results.some((r) =>
      r.capability === "marketplace" && r.ok
    );
    const paymentsReady = orchestration.results.some((r) =>
      r.capability === "payments" && r.ok
    );

    const identity = buildBusinessIdentity({
      memory: orchestration.memory,
      dna: orchestration.dna,
      domain,
      websitePublished: !!websiteEffects.published || !!websiteEffects.slug,
      marketplaceReady,
      paymentsReady,
      maturity: { stage: maturity.stage, label: maturity.label },
    });
    const timeline = buildLaunchTimeline({
      businessId: websiteEffects.businessId || opts?.businessId || null,
      businessName: orchestration.memory.name,
      completed: orchestration.results.filter((r) => r.ok).map((r) => ({
        capability: r.capability,
        detail: r.detail,
      })),
      domainPreferred: domain?.preferred || null,
    });
    const health = assessBusinessHealth({
      memory: orchestration.memory,
      dna: orchestration.dna,
    });
    const creativeDirector = buildCreativeDirectorBrief({
      memory: orchestration.memory,
      dna: orchestration.dna,
      copy: {
        heroHeadline: orchestration.memory.currentWebsite?.headline || null,
        accentColor: orchestration.memory.currentWebsite?.accentColor || null,
        ctaText: orchestration.memory.currentWebsite?.ctaText || null,
      },
    });
    const daily = buildHublyDaily({
      memory: orchestration.memory,
      dna: orchestration.dna,
      health,
      maturity,
    });

    bus.emit({
      capability: null,
      state: "done",
      message: "🎉 Your business is live.",
      meta: { identityStatus: identity.status, health: health.overall },
    });

    const progress = bus.history();
    bus.clearListeners();

    return {
      runId: orchestration.runId,
      prompt,
      understanding,
      memory: orchestration.memory,
      dna: orchestration.dna,
      executionPlan,
      confidence: orchestration.confidence.length ? orchestration.confidence : confidence,
      clarifyingQuestions: orchestration.clarifyingQuestions,
      orchestration,
      progress,
      website: {
        slug: websiteEffects.slug || orchestration.memory.currentWebsite?.slug || null,
        businessId: websiteEffects.businessId || opts?.businessId || null,
        published: !!websiteEffects.published,
      },
      identity,
      timeline,
      health,
      domain,
      maturity,
      creativeDirector,
      daily,
    };
  },

  /**
   * Phase 8 — Hubly Daily (signature morning briefing).
   * Advice first. Not charts.
   */
  daily(opts?: {
    memory?: HublyBusinessMemoryInput | null;
    dna?: HublyBusinessDNAInput | null;
    ownerName?: string | null;
    stats?: {
      jobsToday?: number;
      newLeads?: number;
      reviewRequestsReady?: number;
      visitorsYesterday?: number;
    } | null;
  }): HublyDailyBriefing {
    const memory = normalizeBusinessMemory(opts?.memory);
    const dna = normalizeBusinessDNA(opts?.dna);
    const maturity = inferMaturity({ memory, dna });
    const health = assessBusinessHealth({ memory, dna });
    return buildHublyDaily({
      memory,
      dna,
      ownerName: opts?.ownerName,
      health,
      maturity,
      stats: opts?.stats,
    });
  },

  /**
   * Phase 7.8 — Customer Runtime entry (AI concierge).
   * Hubly.findPro("I need someone to pressure wash my driveway.")
   * Customer Memory (facts) + Customer Profile (identity) → DNA-fit ranking.
   */
  async findPro(
    prompt: string,
    opts?: {
      customerMemory?: HublyCustomerMemoryInput | null;
      customerProfile?: HublyCustomerProfileInput | null;
      city?: string | null;
      /** Marketplace Local Discovery — customer's ZIP, resolved to real coordinates downstream by the marketplace edge function. */
      zip?: string | null;
      supabase?: SupabaseClient | null;
      onProgress?: HublyProgressListener;
    },
  ): Promise<{
    runId: string;
    prompt: string;
    customerMemory: HublyCustomerMemory;
    customerProfile: HublyCustomerProfile;
    need: Record<string, unknown>;
    matches: unknown[];
    recommendations: unknown[];
    progress: HublyProgressEvent[];
    matchPayload?: unknown;
  }> {
    const bus = createProgressBus();
    if (opts?.onProgress) bus.subscribe(opts.onProgress);

    bus.emit({
      capability: null,
      state: "understanding",
      message: "Understanding your request…",
    });

    const customerMemory = inferCustomerMemoryFromConversation(prompt, opts?.customerMemory);
    if (opts?.city) customerMemory.city = opts.city;
    const customerProfile = inferCustomerProfileFromConversation(
      prompt,
      opts?.customerProfile,
      customerMemory,
    );

    bus.emit({
      capability: null,
      state: "memory",
      message: "Learning what you need…",
    });
    bus.emit({
      capability: null,
      state: "profile",
      message: "Understanding how you like to be served…",
    });
    bus.emit({
      capability: null,
      state: "planning",
      message: "Planning how to find the right pro…",
    });

    const prefs = customerProfileToMatchPreferences(customerProfile);
    const need = {
      service_text: prompt,
      service: customerMemory.job?.service || null,
      category: customerMemory.job?.category || null,
      city: customerMemory.city || opts?.city || null,
      zip: opts?.zip || null,
      when: customerMemory.job?.when || null,
      notes: customerMemory.job?.description || prompt,
      preferences: prefs,
    };

    let matchPayload: unknown = null;
    let recommendations: unknown[] = [];
    let matches: unknown[] = [];

    if (opts?.supabase) {
      bus.emit({
        capability: null,
        state: "executing",
        message: "Matching businesses to your needs…",
      });
      try {
        const { data, error } = await opts.supabase.functions.invoke("marketplace", {
          body: {
            action: "match",
            need,
            customer_profile: customerProfile,
            customer_memory: customerMemory,
          },
        });
        if (!error && data) {
          matchPayload = data;
          recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
          matches = Array.isArray(data.matches) ? data.matches : recommendations;
        }
      } catch (e) {
        console.warn("findPro match invoke", e);
      }
    }

    bus.emit({
      capability: null,
      state: "done",
      message: recommendations.length
        ? "Here are your best matches."
        : "Ready to match — connect providers to complete booking.",
    });

    bus.clearListeners();
    return {
      runId: bus.runId,
      prompt,
      customerMemory,
      customerProfile,
      need,
      matches,
      recommendations,
      progress: bus.history(),
      matchPayload,
    };
  },

  /** Alias — Customer Runtime journey entry */
  async buildCustomerJourney(
    prompt: string,
    opts?: {
      customerMemory?: HublyCustomerMemoryInput | null;
      customerProfile?: HublyCustomerProfileInput | null;
      city?: string | null;
      supabase?: SupabaseClient | null;
      onProgress?: HublyProgressListener;
    },
  ) {
    return this.findPro(prompt, opts);
  },

  /**
   * Section 1 — Hubly Brain think pipeline (primary AI entry for owner conversations).
   * Brain selects experts, merges outputs into one Hubly response, updates memory, logs execution.
   */
  async think(req: HublyThinkRequest & { businessId?: string | null }): Promise<HublyThinkResult> {
    ensureExpertsRegistered();
    const started = Date.now();
    try {
      const result = await runThinkPipeline(req);
      const execution = logBrainExecution({
        kind: "think",
        feature: "hubly-brain-think",
        task: "reason",
        intent: result.intent,
        expertsSelected: result.expertsRun || [],
        mergedResponse: true,
        memoryUpdated: true,
        confidence: result.confidence,
        ok: result.ok,
        latencyMs: Date.now() - started,
        businessId: req.businessId || null,
      });
      persistBrainExecution(execution).catch(() => {});
      return {
        ...result,
        console: result.console
          ? { ...result.console, latencyMs: result.console.latencyMs ?? Date.now() - started }
          : {
            intent: result.intent,
            expertsSelected: result.expertsRun,
            memoriesLoaded: ["business_memory", "business_dna", "workspace_memory", "conversation_memory"],
            latencyMs: Date.now() - started,
          },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const execution = logBrainExecution({
        kind: "think",
        feature: "hubly-brain-think",
        task: "reason",
        expertsSelected: [],
        mergedResponse: false,
        memoryUpdated: false,
        ok: false,
        latencyMs: Date.now() - started,
        error: msg,
        businessId: req.businessId || null,
      });
      persistBrainExecution(execution).catch(() => {});
      throw err;
    }
  },

  /** Registered experts + AI Capability Registry (never customer-facing). */
  experts() {
    return thinkBrainStatus();
  },

  /**
   * Low-level Brain model call. Prefer think() for multi-expert work.
   * Still Hubly Brain — the only code path allowed to reach providers.
   * Without `task`, defaults provider to Claude (safe for unmigrated callers).
   */
  async complete(opts: HublyAICompleteOpts): Promise<HublyAIResult> {
    const task = normalizeTask(opts.task) || "chat";
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    const next = { ...opts, memory };
    if (!opts.task && !opts.provider && !opts.model) {
      const provider = this.defaultProvider();
      const model = provider === "openai" ? openaiReasoningModel() : claudeFallbackModel();
      return run({
        ...next,
        feature: String(opts.feature || "complete"),
        task,
        provider,
        model,
        maxTokens: opts.maxTokens ?? 700,
      });
    }
    return run(resolveInternal(next, task));
  },

  /** Conversational turn with automatic Business Memory injection. */
  async chat(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(resolveInternal({ ...opts, memory, feature: opts.feature || "chat" }, "chat"));
  },

  /** Deep reasoning for plans, diagnoses, multi-step business decisions. */
  async reason(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(resolveInternal({ ...opts, memory, feature: opts.feature || "reason" }, "reason"));
  },

  /** Skill helper — Build Website (still generation-only until executor). */
  async generateWebsite(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(
      resolveInternal({
        ...opts,
        memory,
        feature: opts.feature || "buildWebsite",
        jsonMode: opts.jsonMode ?? true,
        skills: opts.skills || ["buildWebsite"],
      }, "website_builder"),
    );
  },

  async generateQuote(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(
      resolveInternal({
        ...opts,
        memory,
        feature: opts.feature || "generateQuote",
        jsonMode: opts.jsonMode ?? true,
        skills: opts.skills || ["generateQuote"],
      }, "quote"),
    );
  },

  async generateMarketing(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(resolveInternal({
      ...opts,
      memory,
      feature: opts.feature || "generateCampaign",
      skills: opts.skills || ["generateCampaign"],
    }, "marketing"));
  },

  async businessCoach(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(resolveInternal({
      ...opts,
      memory,
      feature: opts.feature || "coachBusiness",
      skills: opts.skills || ["coachBusiness"],
    }, "business_coach"));
  },

  async creativeDirector(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(
      resolveInternal({
        ...opts,
        memory,
        feature: opts.feature || "creative_director",
        jsonMode: opts.jsonMode ?? true,
        skills: opts.skills || ["updateWebsite"],
      }, "creative_director"),
    );
  },

  async customerSupport(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(resolveInternal({ ...opts, memory, feature: opts.feature || "customer_support" }, "customer_support"));
  },

  async customerConcierge(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(resolveInternal({ ...opts, memory, feature: opts.feature || "customer_concierge" }, "customer_concierge"));
  },

  async photoAnalysis(opts: HublyAICallOpts): Promise<HublyAIResult> {
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    return run(
      resolveInternal({
        ...opts,
        memory,
        feature: opts.feature || "analyzePhotos",
        jsonMode: opts.jsonMode ?? true,
        skills: opts.skills || ["analyzePhotos"],
      }, "photo_analysis"),
    );
  },

  expertCapabilities() {
    ensureExpertsRegistered();
    return listExpertCapabilities();
  },

  /** Section 1 — recent Brain executions (in-memory ring; Brain Console / status). */
  executions(limit = 50) {
    return listBrainExecutions(limit);
  },

  /** Section 2 — Experience Director interception log. */
  experienceInterceptions(limit = 40) {
    return listExperienceInterceptions(limit);
  },

  /** Section 2 — review freeform customer-facing text through Experience Director. */
  reviewForCustomer(text: string, opts?: { request?: string | null; confidence?: number | null }) {
    return reviewCustomerFacingText(text, opts);
  },
};

/** Preferred name — Hubly Brain / Runtime. HublyAI kept as alias for early imports. */
export const HublyBrain = HublyAI;
/** Public Runtime alias — Hubly.buildBusiness(prompt) */
export const Hubly = HublyAI;
export default HublyBrain;
