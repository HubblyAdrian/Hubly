/**
 * Hubly Core — Intent Engine
 *
 * The missing layer above Connected Apps:
 *
 *   Ask Hubly
 *     → Intent          (Promote Project)
 *     → Planner         (required capabilities)
 *     → Resolver        (Connected Apps by capability)
 *     → Event Bus
 *     → Execution
 *
 * AI / Ask Hubly / Coach speak only:
 *   Intent → Capabilities → Execute
 *
 * They never name Canva, Meta, Google, Adobe, etc.
 * Provider binding happens inside Resolver + Execution only.
 */

import {
  type ConnectedAppCapability,
} from "./hubly_connected_apps.ts";
import {
  describePlanForAi,
  planAction,
  type ActionIntent,
  type ActionPlan,
  type CapabilityNeed,
} from "./hubly_action_engine.ts";
import { emit, type HublyBusinessEventType } from "./hubly_event_bus.ts";

export type HublyIntentId = ActionIntent;

export type HublyIntentDef = {
  id: HublyIntentId;
  /** Owner-facing intent label — what AI says it will do. */
  label: string;
  /** One-line description without vendor names. */
  description: string;
  /** Utterance patterns (simple keyword groups). */
  patterns: RegExp[];
  /** Event emitted when this intent is recognized / queued. */
  event?: HublyBusinessEventType;
};

/**
 * Canonical Hubly intents. Extend here — not by hardcoding vendors in Ask Hubly.
 */
export const HUBLY_INTENTS: HublyIntentDef[] = [
  {
    id: "promote_project",
    label: "Promote Project",
    description: "Create marketing assets and publish them across available channels.",
    patterns: [
      /\bpromote\b.*\b(project|gallery|shoot|wedding|session)\b/i,
      /\b(market|advertise|announce)\b.*\b(project|gallery|shoot|wedding)\b/i,
      /\bshare\b.*\b(project|gallery|photos?|sneak\s*peek)\b/i,
    ],
    event: "ai.action.proposed",
  },
  {
    id: "create_marketing_graphic",
    label: "Create Marketing Graphic",
    description: "Produce a marketing graphic from project assets and brand.",
    patterns: [
      /\b(create|make|design)\b.*\b(graphic|flyer|carousel|post|story|thank\s*you|gift\s*card)\b/i,
      /\bmarketing\s+(graphic|asset|creative)\b/i,
    ],
    event: "creative.asset_planned",
  },
  {
    id: "publish_social",
    label: "Publish Social",
    description: "Publish or schedule social content.",
    patterns: [
      /\b(publish|post|schedule)\b.*\b(instagram|facebook|social|tiktok|pinterest)\b/i,
      /\bpost\s+(this|it)\b/i,
    ],
  },
  {
    id: "request_review",
    label: "Request Review",
    description: "Ask the customer for a review.",
    patterns: [
      /\b(request|ask|send)\b.*\breview\b/i,
      /\breview\s+request\b/i,
    ],
  },
  {
    id: "notify_customer",
    label: "Notify Customer",
    description: "Message the customer by email or SMS.",
    patterns: [
      /\b(email|text|sms|notify|message)\b.*\b(customer|client)\b/i,
      /\btell\s+(the\s+)?(customer|client)\b/i,
    ],
  },
  {
    id: "sync_storage",
    label: "Sync Storage",
    description: "Sync project files with connected storage.",
    patterns: [
      /\bsync\b.*\b(files?|photos?|storage|drive|dropbox)\b/i,
      /\b(upload|backup)\b.*\b(files?|photos?)\b/i,
    ],
  },
  {
    id: "edit_photos",
    label: "Edit Photos",
    description: "Continue photo editing and sync edited assets.",
    patterns: [
      /\b(edit|retouch|cull)\b.*\bphotos?\b/i,
      /\blightroom\b/i,
      /\braw\s+edit/i,
    ],
  },
  {
    id: "update_website",
    label: "Update Website",
    description: "Update the business website or local listing.",
    patterns: [
      /\b(update|refresh)\b.*\b(website|site|listing|gbp|google\s+business)\b/i,
      /\bfeature\b.*\b(on\s+)?(website|homepage)\b/i,
    ],
  },
];

export type RecognizedIntent = {
  intent: HublyIntentDef;
  /** Confidence 0–1 from pattern match strength (Stage 1 heuristic). */
  confidence: number;
  sourceText?: string;
};

export type IntentAiView = {
  /** Intent label only — never a vendor. */
  intent: string;
  /** Required + optional capability labels. */
  capabilities: string[];
  required: string[];
  optional: string[];
  /** Owner-facing prompt: Intent → Capabilities → Execute. */
  prompt: string;
};

export type IntentPipelineResult = {
  recognized: RecognizedIntent;
  plan: ActionPlan;
  ai: IntentAiView;
  /** Internal resolve bindings — not for AI prompts. */
  execution: {
    steps: { capability: string; label: string; status: string; providerId?: string }[];
    ready: boolean;
  };
};

export function getIntent(id: HublyIntentId): HublyIntentDef | null {
  return HUBLY_INTENTS.find((i) => i.id === id) || null;
}

export function listIntents(): HublyIntentDef[] {
  return HUBLY_INTENTS.slice();
}

/**
 * Recognize owner utterance → Intent.
 * Returns null when no Hubly Intent matches (Ask Hubly falls through to other handlers).
 */
export function recognizeIntent(text: string): RecognizedIntent | null {
  const q = String(text || "").trim();
  if (!q) return null;
  for (const intent of HUBLY_INTENTS) {
    for (const re of intent.patterns) {
      if (re.test(q)) {
        return { intent, confidence: 0.85, sourceText: q };
      }
    }
  }
  return null;
}

/** AI-safe view of an intent + planned capabilities — zero vendor names. */
export function describeIntentForAi(
  intentId: HublyIntentId,
  plan?: ActionPlan,
): IntentAiView {
  const def = getIntent(intentId);
  const label = def?.label || intentId;
  const built = plan || planAction({
    intent: intentId,
    businessId: "",
  });
  const aiPlan = describePlanForAi(built);
  const required = built.needs.filter((n) => n.required).map((n) => n.label);
  const optional = built.needs.filter((n) => !n.required).map((n) => n.label);
  const prompt =
    `Intent: ${label}.\n` +
    `Capabilities needed: ${aiPlan.need.join(", ")}.\n` +
    (aiPlan.missing.length
      ? `Missing: ${aiPlan.missing.join(", ")}. Connect apps that provide these capabilities, then Execute.`
      : `Ready to Execute.`);
  return {
    intent: label,
    capabilities: aiPlan.need,
    required,
    optional,
    prompt,
  };
}

/**
 * Full pipeline:
 *   Intent → Planner (capabilities) → Resolver (Connected Apps) → Event Bus signal
 *
 * AI surfaces use `ai` only. Executors use `execution` / `plan.steps`.
 */
export async function runIntentPipeline(input: {
  intentId?: HublyIntentId;
  text?: string;
  businessId: string;
  projectId?: string;
  emitEvent?: boolean;
}): Promise<IntentPipelineResult | null> {
  let recognized: RecognizedIntent | null = null;
  if (input.intentId) {
    const def = getIntent(input.intentId);
    if (!def) return null;
    recognized = { intent: def, confidence: 1, sourceText: input.text };
  } else if (input.text) {
    recognized = recognizeIntent(input.text);
  }
  if (!recognized) return null;

  const plan = planAction({
    intent: recognized.intent.id,
    businessId: input.businessId,
    projectId: input.projectId,
  });
  const ai = describeIntentForAi(recognized.intent.id, plan);

  if (input.emitEvent !== false) {
    await emit("ai.action.proposed", {
      businessId: input.businessId,
      payload: {
        intent: recognized.intent.id,
        intentLabel: recognized.intent.label,
        capabilities: ai.capabilities,
        projectId: input.projectId || null,
      },
      capabilities: plan.needs.map((n: CapabilityNeed) => n.capability),
    });
  }

  const ready = plan.steps
    .filter((_, i) => plan.needs[i]?.required)
    .every((s) => s.status === "ready");

  return {
    recognized,
    plan,
    ai,
    execution: {
      steps: plan.steps.map((s) => ({
        capability: s.capability,
        label: s.label,
        status: s.status,
        providerId: s.providerId,
      })),
      ready,
    },
  };
}

/**
 * Execute a prepared intent plan: emit execution event.
 * Vendor calls stay inside Connected App providers — this layer only signals.
 */
export async function executeIntent(input: {
  businessId: string;
  projectId?: string;
  pipeline: IntentPipelineResult;
}): Promise<{ ok: boolean; message: string }> {
  const { pipeline } = input;
  await emit("ai.action.executed", {
    businessId: input.businessId,
    payload: {
      intent: pipeline.recognized.intent.id,
      intentLabel: pipeline.recognized.intent.label,
      capabilities: pipeline.ai.capabilities,
      projectId: input.projectId || null,
      ready: pipeline.execution.ready,
    },
    capabilities: pipeline.plan.needs.map((n) => n.capability),
  });

  if (!pipeline.execution.ready) {
    return {
      ok: false,
      message: pipeline.ai.prompt,
    };
  }
  return {
    ok: true,
    message:
      `Intent: ${pipeline.ai.intent}. Executing capabilities: ${pipeline.ai.capabilities.join(", ")}.`,
  };
}

export const HublyIntentEngine = {
  listIntents,
  getIntent,
  recognizeIntent,
  describeIntentForAi,
  runIntentPipeline,
  executeIntent,
  HUBLY_INTENTS,
};
