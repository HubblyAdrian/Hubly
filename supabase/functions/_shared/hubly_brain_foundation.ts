/**
 * Hubly Brain — Foundation (permanent, do not collapse)
 *
 * These rules are the architectural constitution of Hubly Brain.
 * New AI features must extend this pipeline — never flatten layers together.
 *
 * Conversation
 *     ↓
 * Understanding      (interprets language only)
 *     ↓
 * Business Memory    (single source of truth)
 *     ↓
 * Planner            (reasons only from Memory; never executes)
 *     ↓
 * Capability Registry
 *     ↓
 * Executors          (perform work; AI never writes DB directly)
 *     ↓
 * Hubly Platform
 */

/** Permanent rules — do not weaken or collapse. */
export const HUBLY_BRAIN_RULES = [
  {
    id: 1,
    rule: "Understanding interprets language only.",
    detail: "Only Understanding may read raw conversation. It emits structured intent and memory facts.",
  },
  {
    id: 2,
    rule: "Business Memory is the single source of truth.",
    detail: "Every AI interaction receives structured Memory. Features must not rebuild prompts from ad-hoc state.",
  },
  {
    id: 3,
    rule: "Planner reasons only from Memory.",
    detail: "Planner inputs are structured Memory fields only — never raw user utterances.",
  },
  {
    id: 4,
    rule: "Planner never executes work.",
    detail: "Planner selects capabilities and returns a plan. Execution is a separate phase.",
  },
  {
    id: 5,
    rule: "Capabilities describe what Hubly can do.",
    detail: "Skills/capabilities are the registry of business actions (website, CRM, quotes, …).",
  },
  {
    id: 6,
    rule: "Executors perform the work.",
    detail: "Only executors mutate product surfaces. Models propose; executors apply.",
  },
  {
    id: 7,
    rule: "AI never directly modifies the database.",
    detail: "No LLM output may write Postgres/Supabase rows directly. Always go through an executor.",
  },
  {
    id: 8,
    rule: "Every business change should flow through a capability.",
    detail: "Create customer, publish site, send invoice, etc. are capabilities — not free-form side effects.",
  },
  {
    id: 9,
    rule: "Design capabilities to be reversible where practical.",
    detail: "Prefer undo/compensate paths (draft→publish, soft-delete, versioned site changes).",
  },
  {
    id: 10,
    rule: "The Brain should be observable.",
    detail: "Inspect Understanding, Memory, Planner decisions, selected capabilities, and execution results.",
  },
] as const;

export type HublyBrainRule = (typeof HUBLY_BRAIN_RULES)[number];

export const HUBLY_BRAIN_PIPELINE = [
  "conversation",
  "understanding",
  "business_memory",
  "planner",
  "capability_registry",
  "executors",
  "hubly_platform",
] as const;

export type HublyBrainPipelineStage = (typeof HUBLY_BRAIN_PIPELINE)[number];

/**
 * Observable Brain turn — Rule 10.
 * Persist or log this for debugging; never discard silently in Brain entrypoints.
 */
export type HublyBrainTrace = {
  id: string;
  at: string;
  pipeline: typeof HUBLY_BRAIN_PIPELINE;
  rulesVersion: "foundation-1";
  conversationSummary?: string | null;
  understanding: unknown | null;
  memory: unknown | null;
  memoryKeys: string[];
  plan: unknown | null;
  selectedCapabilities: string[];
  execution: unknown | null;
  notes?: string[];
};

export function createBrainTraceId(): string {
  return `brain_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function foundationStatus() {
  return {
    name: "Hubly Brain",
    rulesVersion: "foundation-1" as const,
    pipeline: [...HUBLY_BRAIN_PIPELINE],
    rules: HUBLY_BRAIN_RULES.map((r) => ({ id: r.id, rule: r.rule })),
    doNotCollapse: true,
  };
}

export default {
  rules: HUBLY_BRAIN_RULES,
  pipeline: HUBLY_BRAIN_PIPELINE,
  foundationStatus,
  createBrainTraceId,
};
