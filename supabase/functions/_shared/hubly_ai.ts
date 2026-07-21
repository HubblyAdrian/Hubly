/**
 * HublyAI — Hubly's intelligence layer (not a chatbot wrapper).
 *
 * Long-term shape:
 *   Feature → HublyAI → Business Memory → Capability Planner → Provider (OpenAI / Claude)
 *
 * Phases:
 *   7.0 (this file) — provider abstraction + capability surface + per-task models
 *   7.1 — Business Memory (every call receives business/services/brand/CRM/…)
 *   7.2 — Capability Registry (createCustomer, createQuote, updateWebsite, …)
 *   7.3 — Migrate features one-by-one (Website Builder → Creative Director → …)
 *
 * Rules:
 * - Do not swap Claude out of existing edge functions until each feature migrates.
 * - Prefer capability methods (reason, generateWebsite, …) over raw complete().
 * - Models are selected per task — never hardcode one global model for all of Hubly.
 * - Never import this from the browser; secrets stay in Deno.env.
 */

export type HublyAIProvider = "claude" | "openai";

/** Named capabilities / tasks HublyAI can perform. */
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
  | "lightweight";

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

/**
 * Phase 7.1 shape — Business Memory attached to every intelligent call.
 * Fields are optional until features wire real data; HublyAI must tolerate partial memory.
 */
export type HublyBusinessMemory = {
  business?: Record<string, unknown> | null;
  services?: unknown[] | null;
  employees?: unknown[] | null;
  goals?: unknown[] | string | null;
  brandVoice?: string | Record<string, unknown> | null;
  website?: Record<string, unknown> | null;
  crm?: Record<string, unknown> | null;
  customers?: unknown[] | null;
  calendar?: Record<string, unknown> | null;
  /** Free-form extras (pricing rules, locales, etc.) */
  extras?: Record<string, unknown> | null;
};

export type HublyAICallOpts = {
  /** Feature / edge function id for logs — e.g. creative-director */
  feature?: string;
  /** Named task — drives model + defaults. */
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
  /** Phase 7.1 — business context. Injected into system when present. */
  memory?: HublyBusinessMemory | null;
  /** Phase 7.2 — requested tools / capabilities (planning only until wired). */
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

/** Phase 7.2 — capability registry entries (stubs until executors land). */
export type HublyCapabilityId =
  | "createCustomer"
  | "createQuote"
  | "createWebsite"
  | "updateWebsite"
  | "sendInvoice"
  | "addService"
  | "publishWebsite"
  | "scheduleJob"
  | "draftMarketing"
  | "analyzePhotos";

export type HublyCapability = {
  id: HublyCapabilityId;
  description: string;
  /** When false, planner may propose but must not execute. */
  executable: boolean;
};

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
};

const CAPABILITY_REGISTRY: HublyCapability[] = [
  { id: "createCustomer", description: "Create or update a CRM customer", executable: false },
  { id: "createQuote", description: "Draft a quote / estimate for a job", executable: false },
  { id: "createWebsite", description: "Generate a new Instant Site draft", executable: false },
  { id: "updateWebsite", description: "Apply website copy/layout/brand changes", executable: false },
  { id: "sendInvoice", description: "Send an invoice or payment request", executable: false },
  { id: "addService", description: "Add a service / package to the catalog", executable: false },
  { id: "publishWebsite", description: "Publish the live Instant Site", executable: false },
  { id: "scheduleJob", description: "Schedule or reschedule a job", executable: false },
  { id: "draftMarketing", description: "Draft marketing copy or campaigns", executable: false },
  { id: "analyzePhotos", description: "Analyze owner photos for galleries/copy", executable: false },
];

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

function memoryKeys(memory?: HublyBusinessMemory | null): string[] {
  if (!memory || typeof memory !== "object") return [];
  return Object.keys(memory).filter((k) => {
    const v = (memory as Record<string, unknown>)[k];
    return v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
}

/** Format Business Memory for system injection (Phase 7.1). */
export function formatBusinessMemory(memory?: HublyBusinessMemory | null): string {
  const keys = memoryKeys(memory);
  if (!keys.length) return "";
  return [
    "BUSINESS MEMORY (use this before answering; do not invent missing facts):",
    JSON.stringify(memory, null, 2),
  ].join("\n");
}

function composeSystem(opts: HublyAICallOpts): string | undefined {
  const parts: string[] = [];
  if (opts.system) parts.push(String(opts.system));
  const mem = formatBusinessMemory(opts.memory);
  if (mem) parts.push(mem);
  if (opts.capabilities?.length) {
    parts.push(
      "REQUESTED CAPABILITIES (Phase 7.2 — plan only unless executable):\n" +
        opts.capabilities.map((c) => `- ${c}`).join("\n"),
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
  /**
   * Provider default for low-level complete() when no task is given.
   * Remains Claude so unmigrated edge functions are not swapped by accident.
   * Capability methods (reason, generateWebsite, …) use the per-task registry (GPT-5.5).
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
    return {
      layer: "HublyAI",
      vision: "AI platform that generates SaaS — not SaaS with a chatbot",
      defaultProvider: this.defaultProvider(),
      reasoningModel: this.reasoningModel(),
      models: this.models(),
      configured: {
        claude: !!env("ANTHROPIC_API_KEY"),
        openai: !!env("OPENAI_API_KEY"),
      },
      phases: {
        "7.0": "capability surface + per-task models (current)",
        "7.1": "Business Memory",
        "7.2": "Capability Registry / tool calling",
        "7.3": "Migrate features one-by-one (do not swap Claude globally)",
      },
      note: "Existing edge functions still call Claude directly until migrated to HublyAI capabilities.",
    };
  },

  extractJson,
  personalityPreamble,
  formatBusinessMemory,

  /** Phase 7.1 — assemble / pass-through business memory (no DB yet). */
  memory(input?: HublyBusinessMemory | null): HublyBusinessMemory {
    return input && typeof input === "object" ? { ...input } : {};
  },

  /** Phase 7.2 — list capabilities Hubly can eventually execute. */
  listCapabilities(): HublyCapability[] {
    return CAPABILITY_REGISTRY.map((c) => ({ ...c }));
  },

  /**
   * Low-level provider call. Prefer capability methods.
   * Without `task`, defaults provider to Claude (safe for unmigrated callers).
   */
  async complete(opts: HublyAICompleteOpts): Promise<HublyAIResult> {
    const task = normalizeTask(opts.task) || "chat";
    if (!opts.task && !opts.provider && !opts.model) {
      // Preserve migration safety: raw complete() stays Claude unless opted in.
      const provider = this.defaultProvider();
      const model = provider === "openai" ? openaiReasoningModel() : claudeFallbackModel();
      return run({
        ...opts,
        feature: String(opts.feature || "complete"),
        task,
        provider,
        model,
        maxTokens: opts.maxTokens ?? 700,
      });
    }
    return run(resolveInternal(opts, task));
  },

  /** Conversational turn with optional Business Memory. */
  async chat(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(resolveInternal({ ...opts, feature: opts.feature || "chat" }, "chat"));
  },

  /** Deep reasoning for plans, diagnoses, multi-step business decisions. */
  async reason(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(resolveInternal({ ...opts, feature: opts.feature || "reason" }, "reason"));
  },

  async generateWebsite(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(
      resolveInternal({ ...opts, feature: opts.feature || "website_builder", jsonMode: opts.jsonMode ?? true }, "website_builder"),
    );
  },

  async generateQuote(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(
      resolveInternal({ ...opts, feature: opts.feature || "quote", jsonMode: opts.jsonMode ?? true }, "quote"),
    );
  },

  async generateMarketing(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(resolveInternal({ ...opts, feature: opts.feature || "marketing" }, "marketing"));
  },

  async businessCoach(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(resolveInternal({ ...opts, feature: opts.feature || "business_coach" }, "business_coach"));
  },

  async creativeDirector(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(
      resolveInternal({ ...opts, feature: opts.feature || "creative_director", jsonMode: opts.jsonMode ?? true }, "creative_director"),
    );
  },

  async customerSupport(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(resolveInternal({ ...opts, feature: opts.feature || "customer_support" }, "customer_support"));
  },

  /** Marketplace / customer concierge (get-done style). */
  async customerConcierge(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(resolveInternal({ ...opts, feature: opts.feature || "customer_concierge" }, "customer_concierge"));
  },

  async photoAnalysis(opts: HublyAICallOpts): Promise<HublyAIResult> {
    return run(
      resolveInternal({ ...opts, feature: opts.feature || "photo_analysis", jsonMode: opts.jsonMode ?? true }, "photo_analysis"),
    );
  },
};

export default HublyAI;
