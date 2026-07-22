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
 * Production provider: OpenAI only (GPT-5.5). Anthropic is not on the production path.
 * Emergency only: HUBLY_AI_ALLOW_CLAUDE=1 re-enables Claude for explicit provider=claude.
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
  listHublySkills as listSkills,
  listHublyCapabilities as listCapabilities,
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
  | "planner";

export type HublyTextPart = { type: "text"; text: string };
export type HublyImagePart = {
  type: "image";
  /** e.g. image/jpeg */
  mediaType: string;
  /** raw base64 (no data: prefix) */
  data: string;
};
export type HublyContentPart = HublyTextPart | HublyImagePart;

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
  /** Phase 7.1 — Business Memory (facts). Injected into system automatically. */
  memory?: HublyBusinessMemoryInput | null;
  /** Phase 7.6 — Business DNA (identity). Injected separately — never merged into Memory. */
  dna?: HublyBusinessDNAInput | null;
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

/** Short voice reminder — capabilities still own richer system prompts. */
export function personalityPreamble(): string {
  return [
    "You are Hubly AI — the operating intelligence for service businesses.",
    "Adapt to the owner's business; never force them into a fixed industry list.",
    "Prefer concrete action over generic advice. Never say you are an AI model.",
  ].join(" ");
}

function claudeAllowed(): boolean {
  return env("HUBLY_AI_ALLOW_CLAUDE") === "1" || env("HUBLY_AI_ALLOW_CLAUDE").toLowerCase() === "true";
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

function resolveTaskRoute(task: HublyAITask): TaskRoute {
  const base = { ...TASK_ROUTES[task] };
  // Env can retarget the primary reasoning model without editing every task.
  if (base.provider === "openai") {
    if (task === "lightweight") base.model = openaiLightweightModel();
    else base.model = openaiReasoningModel();
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
    max_tokens: opts.maxTokens ?? 700,
    messages,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("HublyAI openai error", opts.feature, opts.task, res.status, errText);
    throw new HublyAIProviderError("openai", res.status, "OpenAI is temporarily unavailable.");
  }

  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  return {
    text,
    provider: "openai",
    model: opts.model,
    task: opts.task,
    memoryKeys: memoryKeys(opts.memory),
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
  // Production path is OpenAI. Claude only when explicitly allowed + requested.
  let provider = normalizeProvider(opts.provider) || route.provider || "openai";
  if (provider === "claude" && !claudeAllowed()) {
    console.warn("HublyAI: Claude requested but not on production path — using OpenAI", {
      feature: opts.feature,
      task,
    });
    provider = "openai";
  }
  const model = (opts.model || "").trim() ||
    (provider === "openai"
      ? (task === "lightweight" ? openaiLightweightModel() : openaiReasoningModel())
      : claudeFallbackModel());
  return {
    ...opts,
    feature: String(opts.feature || task),
    task,
    provider,
    model,
    maxTokens: opts.maxTokens ?? route.maxTokens,
    jsonMode: opts.jsonMode ?? route.jsonMode,
  };
}

async function run(opts: InternalCall): Promise<HublyAIResult> {
  console.log("HublyAI.run", {
    feature: opts.feature,
    task: opts.task,
    provider: opts.provider,
    model: opts.model,
    memoryKeys: memoryKeys(opts.memory),
  });
  if (opts.provider === "openai") return callOpenAI(opts);
  if (opts.provider === "claude" && claudeAllowed()) return callClaude(opts);
  // Never silently call Anthropic in production.
  return callOpenAI({ ...opts, provider: "openai", model: openaiReasoningModel() });
}

export const HublyAI = {
  /** Public product name for this layer. */
  name: "Hubly Brain" as const,

  /**
   * Production default provider — OpenAI (GPT-5.5).
   * Override only via HUBLY_AI_PROVIDER=openai (or emergency Claude with ALLOW flag).
   */
  defaultProvider(): HublyAIProvider {
    const fromEnv = normalizeProvider(env("HUBLY_AI_PROVIDER"));
    if (fromEnv === "claude" && !claudeAllowed()) return "openai";
    return fromEnv || "openai";
  },

  /** Primary reasoning model for business-building tasks. */
  reasoningModel(): string {
    return openaiReasoningModel();
  },

  resolveProvider(override?: HublyAIProvider | string | null): HublyAIProvider {
    const p = normalizeProvider(override) || this.defaultProvider();
    if (p === "claude" && !claudeAllowed()) return "openai";
    return p;
  },

  /** Resolve provider + model for a named task (extensible per-task selection). */
  resolveTask(task: HublyAITask | string): TaskRoute & { task: HublyAITask } {
    const t = normalizeTask(task) || "reason";
    return { task: t, ...resolveTaskRoute(t) };
  },

  models() {
    return {
      production: "openai",
      openaiReasoning: openaiReasoningModel(),
      openaiLightweight: openaiLightweightModel(),
      claudeEmergencyOnly: claudeAllowed() ? claudeFallbackModel() : null,
      anthropicOnProductionPath: false,
      tasks: Object.fromEntries(
        (Object.keys(TASK_ROUTES) as HublyAITask[]).map((t) => [t, resolveTaskRoute(t)]),
      ),
    };
  },

  isConfigured(provider?: HublyAIProvider | string | null): boolean {
    // Production readiness = OpenAI. Claude alone does not count as configured.
    if (!provider || String(provider).trim() === "") {
      return !!env("OPENAI_API_KEY");
    }
    const p = normalizeProvider(provider);
    if (p === "openai") return !!env("OPENAI_API_KEY");
    if (p === "claude") return claudeAllowed() && !!env("ANTHROPIC_API_KEY");
    return !!env("OPENAI_API_KEY");
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
      anthropicOnProductionPath: false,
      models: this.models(),
      configured: {
        openai: !!env("OPENAI_API_KEY"),
        claudeEmergency: claudeAllowed() && !!env("ANTHROPIC_API_KEY"),
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
        openaiOnlyProduction: true,
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
      },
      providers: {
        domain: ["cloudflare", "porkbun"],
        payments: ["stripe"],
        calendar: ["google_calendar"],
        model: ["openai"],
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
      note: "Phase 8: prove the product. Hubly Daily is the homepage. Creative Director explains DNA. Jobs > features. Production AI = OpenAI only.",
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
   * Phase 7.1 — Business Memory SSOT (facts).
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

  /**
   * Phase 7.6 — Business DNA (identity). Never merge into Memory.
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
      paymentsWaiting?: number;
      followUpsWaiting?: number;
      outcomes?: import("./hubly_brain_health.ts").HublyHealthOutcomes | null;
    } | null;
  }): HublyDailyBriefing {
    const memory = normalizeBusinessMemory(opts?.memory);
    const dna = normalizeBusinessDNA(opts?.dna);
    const maturity = inferMaturity({ memory, dna });
    const outcomes = opts?.stats?.outcomes || null;
    const health = assessBusinessHealth({ memory, dna, outcomes });
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
   * Low-level provider call. Prefer skills via plan() + skill methods.
   * Production default: OpenAI. Anthropic is not on the production path.
   */
  async complete(opts: HublyAICompleteOpts): Promise<HublyAIResult> {
    const task = normalizeTask(opts.task) || "chat";
    const memory = opts.memory ? normalizeBusinessMemory(opts.memory) : opts.memory;
    const next = { ...opts, memory };
    if (!opts.task && !opts.provider && !opts.model) {
      const provider = this.defaultProvider(); // openai
      const model = openaiReasoningModel();
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
};

/** Preferred name — Hubly Brain / Runtime. HublyAI kept as alias for early imports. */
export const HublyBrain = HublyAI;
/** Public Runtime alias — Hubly.buildBusiness(prompt) */
export const Hubly = HublyAI;
export default HublyBrain;
