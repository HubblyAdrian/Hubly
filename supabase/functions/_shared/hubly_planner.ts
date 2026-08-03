// supabase/functions/_shared/hubly_planner.ts
//
// Hubly Planner — produces "Hubly Plan," the structured comparison of a
// business's current Business Understanding against Hubly Core DEFINITION
// (_shared/hubly_core_definition.ts) — the product-level list of what Hubly
// capabilities are, not the Capability Registry's list of what's actually
// executable today. Deliberately NOT an LLM service: the conversation AI
// already does the one reasoning step this platform needs (turning free
// text into structured Business Understanding); the planner only compares
// already-structured facts against a static product definition. Fully
// deterministic and testable without any model credentials.
//
// This file has NO dependency on the Capability Registry, on purpose. What
// Hubly product decides a business needs and what engineering has actually
// shipped are two different conversations, per Apple's iPhone-feature vs.
// iOS-ship-date framing: the planner can honestly say a business needs
// Analytics whether or not Analytics has a single line of backend code yet.
// Cross-referencing a plan against what's actually executable — if that's
// ever needed — is a separate, later concern, not this module's job.
//
// Responsibilities:
// - Consume Business Understanding.
// - Compare it against Hubly Core Definition — every defined capability
//   gets evaluated, not just implemented ones.
// - Produce a structured plan.
// - Never invoke a capability. Never call an LLM. Never duplicate reasoning
//   the conversation AI already performed. Never reference the Capability
//   Registry.
//
// What's deliberately NOT in the public contract: no notion of "is this
// implemented yet." A business never sees an engineering-readiness signal,
// only a plan about their business.
//
// Turning this into a numbered, verb-phrased "Today's Priorities" list is a
// presentation concern, not this module's job — that's Experience 2.

import { HUBLY_CORE_DEFINITION } from "./hubly_core_definition.ts";
import type { BusinessUnderstandingPatch } from "./hubly_business_understanding.ts";

export type PlanItemStatus = "already_exists" | "external_tool_in_use" | "recommend";

export type PlanItem = {
  capability: string;
  status: PlanItemStatus;
  /** Only meaningful when status === "recommend". */
  priority?: "high" | "normal" | "low";
  /** Only meaningful when status === "external_tool_in_use" — a fact the business stated, never a claim Hubly is connected to it. */
  externalTool?: string;
  reason: string;
};

export type IndustryWorkspaceSuggestion = {
  name: string | null;
  reason: string;
};

export type HublyPlan = {
  items: PlanItem[];
  industryWorkspace: IndustryWorkspaceSuggestion;
};

type UnderstandingField = { status?: string; current_system?: string };

/** Default rule for any capability without a custom one: check the matching Understanding field, generically. Exported for direct testing. */
export function genericDetermine(capability: string, understanding: BusinessUnderstandingPatch): PlanItem {
  const field = (understanding as Record<string, unknown>)[capability] as UnderstandingField | undefined;

  if (field?.status === "found") {
    return {
      capability,
      status: "already_exists",
      reason: `The business already has this — Hubly read it directly.`,
    };
  }
  if (field?.current_system) {
    // A mentioned tool is a fact, never a claim of an active Hubly connection.
    return {
      capability,
      status: "external_tool_in_use",
      externalTool: field.current_system,
      reason: `The business said they currently use ${field.current_system} for this.`,
    };
  }
  const def = HUBLY_CORE_DEFINITION.find((c) => c.name === capability);
  return {
    capability,
    status: "recommend",
    priority: "normal",
    reason: def ? `Not set up yet. ${def.customerValue}` : `Nothing has come up about this yet.`,
  };
}

type CapabilityRule = {
  capability: string;
  determine: (understanding: BusinessUnderstandingPatch) => PlanItem;
};

// Specific growth phrases, not loose substrings — "customer service" must
// never match just because it contains "custom". Each pattern requires a
// growth-shaped phrase, not a single word.
const GROWTH_GOAL_PATTERN =
  /\b(more|new|get(ting)?|find(ing)?|attract(ing)?)\s+(customers?|clients?|leads?|business)\b|\bgenerate\s+leads?\b|\bgrow(ing)?\s+(the\s+)?business\b|\bincrease\s+(revenue|sales)\b|\bfill\s+(my|the|our)?\s*calendar\b|\bbook\s+more\b/i;

// Extensible rule table — one entry per capability that needs more than the
// generic check. Add new entries here as real signal for them exists in
// Business Understanding; never branch on capability name inside a shared
// loop (see buildHublyPlan below, which stays capability-agnostic).
// Exported for direct testing.
export const CAPABILITY_RULES: CapabilityRule[] = [
  {
    capability: "marketing",
    determine: (understanding) => {
      const goals = Array.isArray(understanding.goals) ? understanding.goals : [];
      const growthGoal = goals.find((g) => GROWTH_GOAL_PATTERN.test(g));
      if (growthGoal) {
        return {
          capability: "marketing",
          status: "recommend",
          priority: "high",
          reason: `The business's stated goal ("${growthGoal}") points directly at marketing.`,
        };
      }
      return genericDetermine("marketing", understanding);
    },
  },
];

export function buildHublyPlan(understanding: BusinessUnderstandingPatch): HublyPlan {
  const items: PlanItem[] = HUBLY_CORE_DEFINITION.map((cap) => {
    const rule = CAPABILITY_RULES.find((r) => r.capability === cap.name);
    return rule ? rule.determine(understanding) : genericDetermine(cap.name, understanding);
  });

  return {
    items,
    industryWorkspace: {
      name: null,
      reason: "No Industry Workspaces exist to attach to yet.",
    },
  };
}
