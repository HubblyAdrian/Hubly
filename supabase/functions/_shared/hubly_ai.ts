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
 *   Then migrate Website Builder onto the Runtime (not yet).
 *
 * Public API: Hubly.buildBusiness(prompt) — every future feature funnels here.
 * Never import this from the browser; secrets stay in Deno.env.
 * Do not swap Claude out of existing edge functions until each feature migrates.
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
  listCapabilities,
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
};
export {
  HublyBusinessMemoryApi,
  HublyPlanner,
  HublyUnderstanding,
  HublyOrchestrator,
  HublyExecutors,
  listHublySkills as listSkills,
  listCapabilities,
  getSkill,
  normalizeBusinessMemory,
  mergeBusinessMemory,
  proposePlanFromMemory,
  proposeExecutionPlanFromMemory,
  understandConversation,
  runOrchestrator as orchestrate,
  createProgressBus,
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
  /** Phase 7.1 — Business Memory. Injected into system automatically. */
  memory?: HublyBusinessMemoryInput | null;
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
  // Always normalize + inject Business Memory when present.
  const mem = formatBusinessMemory(opts.memory);
  if (mem) parts.push(mem);
  const skillList = opts.skills?.length ? opts.skills : opts.capabilities;
  if (skillList?.length) {
    parts.push(
      "REQUESTED SKILLS (Phase 7.2 — plan only unless executable; never write the database directly):\n" +
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
  // Low-level complete() without task may still prefer Claude for unmigrated features
  // when HUBLY_AI_PROVIDER is unset and caller didn't set task — handled by callers.
  const provider = normalizeProvider(opts.provider) || route.provider;
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
  return callClaude(opts);
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
    const capabilities = listCapabilities();
    const executableCaps = capabilities.filter((c) => c.executable);
    const openaiModel = this.reasoningModel();
    return {
      layer: "Hubly Runtime",
      vision: "Build me my business — Conversation → Understanding → Memory → Planner → Execution Plan → Orchestrator → Executors → Platform",
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
        conversationUnderstandingMemory: true,
        plannerSeparatedFromMemory: true,
        capabilityRegistryFoundation: skills.length > 0,
        hublyRuntime: true,
        orchestrator: true,
        progressBus: true,
        executionHistory: true,
        buildBusinessApi: true,
      },
      phases: {
        "7.0": "DONE — provider abstraction + per-task models (GPT-5.5 for business-building)",
        "7.1": "DONE — Business Memory SSOT (+ business_memories table)",
        "7.1b": "DONE — Understanding separate from Memory",
        "7.2": "DONE — Capability Registry (skills + Runtime capabilities)",
        "7.3": "DONE — Planner memory-only (WHAT only — Execution Plan)",
        "7.4": "DONE foundation — Memory-safe executors (Website Builder not migrated)",
        "7.5": "DONE foundation — Hubly Runtime (Orchestrator, Progress Bus, history, buildBusiness)",
        next: "Business DNA → then migrate Website Builder onto Runtime",
      },
      separation: {
        understanding: "interprets language → structured intent + memory facts",
        memory: "stores structured facts; SSOT for every AI interaction",
        planner: "selects capabilities + dependsOn from Memory only — never execution mechanics",
        orchestrator: "DAG, parallel, retries, rollback, progress, cancel, history",
        executors: "perform work via Memory/platform APIs; model never writes DB directly",
      },
      publicApi: "Hubly.buildBusiness(prompt)",
      executableCapabilities: executableCaps.map((c) => c.id),
      note: "Runtime foundation locked. Website Builder still on Claude until migrated. Do not bypass buildBusiness for new features.",
    };
  },

  extractJson,
  personalityPreamble,
  formatBusinessMemory,

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
   * Phase 7.1 — Business Memory SSOT.
   * Normalize / merge structured memory. Every Brain call should receive this.
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

  /** Phase 7.2 — skills Hubly can eventually execute (Capability Registry). */
  listSkills(): HublySkill[] {
    return listHublySkills();
  },

  /** @deprecated prefer listSkills() */
  listCapabilities(): HublySkill[] {
    return listHublySkills();
  },

  /**
   * Phase 7.3 — Planner.
   * Reasons ONLY from structured Business Memory. Never pass raw conversation.
   * Returns legacy HublyPlan with embedded executionPlan.
   */
  plan(memory?: HublyBusinessMemoryInput | null): HublyPlan {
    return proposePlanFromMemory(normalizeBusinessMemory(memory));
  },

  /** Phase 7.5 — Execution Plan (WHAT only). */
  executionPlan(memory?: HublyBusinessMemoryInput | null): HublyExecutionPlan {
    return proposeExecutionPlanFromMemory(normalizeBusinessMemory(memory));
  },

  /**
   * Full Brain turn without calling providers:
   * Conversation → Understanding → Memory → Plan (memory-only).
   */
  ingest(
    conversation: string | HublyConversationTurn[],
    priorMemory?: HublyBusinessMemoryInput | null,
  ): {
    understanding: HublyBusinessUnderstanding;
    memory: HublyBusinessMemory;
    plan: HublyPlan;
    executionPlan: HublyExecutionPlan;
  } {
    const understanding = understandConversation(conversation, priorMemory);
    const memory = applyUnderstandingToMemory(priorMemory, understanding);
    const plan = proposePlanFromMemory(memory);
    const executionPlan = plan.executionPlan || proposeExecutionPlanFromMemory(memory);
    return { understanding, memory, plan, executionPlan };
  },

  /**
   * Phase 7.5 — Orchestrator entry.
   * Prefer buildBusiness() for the full pipeline.
   */
  async orchestrate(
    plan: HublyExecutionPlan | HublyPlan,
    ctx?: {
      memory?: HublyBusinessMemoryInput | null;
      businessId?: string | null;
      supabase?: SupabaseClient | null;
      persist?: boolean;
      maxRetries?: number;
      signal?: AbortSignal | null;
      onProgress?: HublyProgressListener;
      bus?: HublyProgressBus;
      recordHistory?: boolean;
    },
  ): Promise<HublyOrchestratorResult> {
    const executionPlan: HublyExecutionPlan =
      "version" in plan && (plan as HublyExecutionPlan).version === 1
        ? plan as HublyExecutionPlan
        : ((plan as HublyPlan).executionPlan ||
          proposeExecutionPlanFromMemory(ctx?.memory));
    return runOrchestrator({
      plan: executionPlan,
      memory: ctx?.memory,
      businessId: ctx?.businessId,
      supabase: ctx?.supabase,
      persist: ctx?.persist,
      maxRetries: ctx?.maxRetries,
      signal: ctx?.signal,
      onProgress: ctx?.onProgress,
      bus: ctx?.bus,
      recordHistory: ctx?.recordHistory,
    });
  },

  /**
   * @deprecated Prefer buildBusiness / orchestrate.
   * Sync stub for legacy callers.
   */
  execute(plan: HublyPlan): HublyExecutionResult {
    return executePlanStub(plan);
  },

  listCapabilities(): HublyCapability[] {
    return listCapabilities();
  },

  /**
   * Public Runtime API — everything funnels through this pipeline.
   *
   * Hubly.buildBusiness("I own Austin Home Cleaning.")
   *
   * Live progress: Understanding… → Planning… → Creating Brand… → … → Done.
   * Does NOT migrate Website Builder — website step writes Memory scaffold only.
   */
  async buildBusiness(
    prompt: string,
    opts?: {
      businessId?: string | null;
      memory?: HublyBusinessMemoryInput | null;
      supabase?: SupabaseClient | null;
      persist?: boolean;
      maxRetries?: number;
      signal?: AbortSignal | null;
      onProgress?: HublyProgressListener;
      recordHistory?: boolean;
    },
  ): Promise<{
    runId: string;
    prompt: string;
    understanding: HublyBusinessUnderstanding;
    memory: HublyBusinessMemory;
    executionPlan: HublyExecutionPlan;
    orchestration: HublyOrchestratorResult;
    progress: HublyProgressEvent[];
  }> {
    const bus = createProgressBus();
    if (opts?.onProgress) bus.subscribe(opts.onProgress);

    bus.emit({
      capability: null,
      state: "understanding",
      message: "Understanding…",
    });

    const understanding = understandConversation(prompt, opts?.memory);
    const memory = applyUnderstandingToMemory(opts?.memory, understanding);

    bus.emit({
      capability: null,
      state: "planning",
      message: "Planning…",
    });

    const executionPlan = proposeExecutionPlanFromMemory(memory);

    const orchestration = await runOrchestrator({
      plan: executionPlan,
      memory,
      businessId: opts?.businessId,
      supabase: opts?.supabase,
      persist: opts?.persist,
      maxRetries: opts?.maxRetries,
      signal: opts?.signal,
      bus,
      recordHistory: opts?.recordHistory,
    });

    // Stamp prompt onto history if we have a row (best-effort update)
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

    return {
      runId: orchestration.runId,
      prompt,
      understanding,
      memory: orchestration.memory,
      executionPlan,
      orchestration,
      progress: orchestration.progress,
    };
  },

  /**
   * Low-level provider call. Prefer skills via plan() + skill methods.
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
};

/** Preferred name — Hubly Brain / Runtime. HublyAI kept as alias for early imports. */
export const HublyBrain = HublyAI;
/** Public Runtime alias — Hubly.buildBusiness(prompt) */
export const Hubly = HublyAI;
export default HublyBrain;
