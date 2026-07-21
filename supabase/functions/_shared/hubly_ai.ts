/**
 * HublyAI — centralized AI layer for Hubly edge functions.
 *
 * Goal: every AI feature eventually calls HublyAI instead of Anthropic/OpenAI directly.
 * This is a refactor path, not a provider swap.
 *
 * - Default provider remains Claude so existing features keep working unchanged.
 * - OpenAI is connected and available for per-feature migration via `provider: "openai"`.
 * - Never import this from the browser; secrets stay in Deno.env.
 *
 * Migration (one feature at a time):
 *   1. Replace raw `fetch("https://api.anthropic.com/...")` with `HublyAI.complete(...)`.
 *   2. Keep default provider (claude) until that feature is ready to switch.
 *   3. Pass `provider: "openai"` (or set HUBLY_AI_PROVIDER) when migrating that feature.
 */

export type HublyAIProvider = "claude" | "openai";

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

export type HublyAICompleteOpts = {
  /** Feature id for logs — e.g. creative-director, marketplace-intake */
  feature: string;
  /** Override provider for this call. Omit to use default (claude unless env says otherwise). */
  provider?: HublyAIProvider;
  system?: string;
  messages: HublyMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Prefer JSON-shaped replies when the provider supports it (OpenAI). */
  jsonMode?: boolean;
};

export type HublyAIResult = {
  text: string;
  provider: HublyAIProvider;
  model: string;
};

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function env(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

function normalizeProvider(raw: string | null | undefined): HublyAIProvider | null {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "claude" || v === "anthropic") return "claude";
  if (v === "openai" || v === "gpt") return "openai";
  return null;
}

/** Shared JSON scrape used by feature functions after HublyAI.complete. */
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

/** Short voice reminder — features still own their full system prompts. */
export function personalityPreamble(): string {
  return [
    "You are Hubly AI — a warm, direct consultant for service businesses.",
    "Adapt to the owner's business; never force them into a fixed industry list.",
    "Never say you are an AI model. Be concrete and brief.",
  ].join(" ");
}

function claudeModel(): string {
  return env("HUBLY_AI_CLAUDE_MODEL") || env("ANTHROPIC_MODEL") || DEFAULT_CLAUDE_MODEL;
}

function openaiModel(): string {
  return env("HUBLY_AI_OPENAI_MODEL") || env("OPENAI_MODEL") || DEFAULT_OPENAI_MODEL;
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

async function completeClaude(opts: HublyAICompleteOpts): Promise<HublyAIResult> {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new HublyAIConfigError(
      "claude",
      "AI isn't configured yet. Add an ANTHROPIC_API_KEY secret.",
    );
  }
  const model = claudeModel();
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
      model,
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature,
      system: opts.system || undefined,
      messages: messages.length ? messages : [{ role: "user", content: "Hello" }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("HublyAI claude error", opts.feature, res.status, errText);
    throw new HublyAIProviderError("claude", res.status, "Claude is temporarily unavailable.");
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n")
    .trim();

  return { text, provider: "claude", model };
}

async function completeOpenAI(opts: HublyAICompleteOpts): Promise<HublyAIResult> {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) {
    throw new HublyAIConfigError(
      "openai",
      "OpenAI isn't configured yet. Add an OPENAI_API_KEY secret.",
    );
  }
  const model = openaiModel();
  const messages: Record<string, unknown>[] = [];
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }
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
  if (!messages.length) {
    messages.push({ role: "user", content: "Hello" });
  }

  const body: Record<string, unknown> = {
    model,
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
    console.error("HublyAI openai error", opts.feature, res.status, errText);
    throw new HublyAIProviderError("openai", res.status, "OpenAI is temporarily unavailable.");
  }

  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  return { text, provider: "openai", model };
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

export const HublyAI = {
  /** Default remains Claude until a feature or env opts into OpenAI. */
  defaultProvider(): HublyAIProvider {
    return normalizeProvider(env("HUBLY_AI_PROVIDER")) || "claude";
  },

  resolveProvider(override?: HublyAIProvider | string | null): HublyAIProvider {
    return normalizeProvider(override) || this.defaultProvider();
  },

  models() {
    return { claude: claudeModel(), openai: openaiModel() };
  },

  isConfigured(provider?: HublyAIProvider | string | null): boolean {
    const p = this.resolveProvider(provider);
    if (p === "openai") return !!env("OPENAI_API_KEY");
    return !!env("ANTHROPIC_API_KEY");
  },

  /** Which providers have API keys present (does not call the network). */
  status() {
    return {
      defaultProvider: this.defaultProvider(),
      models: this.models(),
      configured: {
        claude: !!env("ANTHROPIC_API_KEY"),
        openai: !!env("OPENAI_API_KEY"),
      },
      note: "Features still call Claude directly until migrated to HublyAI.complete.",
    };
  },

  extractJson,

  personalityPreamble,

  /**
   * Single entry for LLM completions. Features should migrate to this
   * instead of calling Anthropic or OpenAI APIs directly.
   */
  async complete(opts: HublyAICompleteOpts): Promise<HublyAIResult> {
    const provider = this.resolveProvider(opts.provider);
    const feature = String(opts.feature || "unknown");
    console.log("HublyAI.complete", { feature, provider, model: provider === "openai" ? openaiModel() : claudeModel() });
    if (provider === "openai") return completeOpenAI({ ...opts, feature });
    return completeClaude({ ...opts, feature });
  },
};

export default HublyAI;
