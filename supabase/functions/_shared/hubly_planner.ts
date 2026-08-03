// supabase/functions/_shared/hubly_planner.ts
//
// Hubly Planner — produces "Hubly Plan," the structured comparison of a
// business's current Business Understanding against Hubly Core. Deliberately
// NOT an LLM service. The conversation AI already does the one reasoning
// step this platform needs (turning free text into structured Business
// Understanding); the planner only compares already-structured facts against
// the Capability Registry. Deterministic, cheap, and fully testable without
// any model credentials.
//
// Responsibilities:
// - Consume Business Understanding.
// - Compare it against Hubly Core (the Capability Registry — only
//   capabilities that actually exist there are ever evaluated; nothing
//   aspirational is invented here).
// - Produce a structured plan.
// - Never invoke a capability. Never call an LLM. Never duplicate reasoning
//   the conversation AI already performed.
//
// What's deliberately NOT in the public contract: no `registryReady` flag,
// no notion of "is this implemented yet." Whether a capability exists in the
// registry is why it's evaluated at all — a business never sees an
// engineering-readiness signal, only a plan about their business. As more
// capabilities are added to the registry (built on demand, per the standing
// rule), the plan's coverage grows automatically — nothing here needs to
// change for that to happen.
//
// Turning this into a numbered, verb-phrased "Today's Priorities" list is a
// presentation concern, not this module's job — that's Experience 2.

import { HUBLY_CAPABILITY_REGISTRY } from "./hubly_capability_registry.ts";
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
  return {
    capability,
    status: "recommend",
    priority: "normal",
    reason: `Nothing has come up about this yet — Hubly can offer it.`,
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
  const items: PlanItem[] = HUBLY_CAPABILITY_REGISTRY.map((cap) => {
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
