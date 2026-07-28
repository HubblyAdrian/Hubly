/**
 * Hubly Core — Action Engine (Planner + Resolver)
 *
 * Sits under the Intent Engine:
 *
 *   Ask Hubly → Intent → Planner → Resolver → Connected Apps → Event Bus → Execution
 *
 * This module owns Planner (intent → required capabilities) and Resolver
 * (capability → Connected App). AI-facing copy stays in Intent Engine —
 * never hardcode vendor names in prompts.
 */

import {
  getConnectedApp,
  listConnectedAppsByCapability,
  type ConnectedAppCapability,
  type ConnectedAppProvider,
} from "./hubly_connected_apps.ts";
import { providerOk, type HublyProviderResult } from "./hubly_providers.ts";

export type ActionIntent =
  | "promote_project"
  | "create_marketing_graphic"
  | "publish_social"
  | "request_review"
  | "notify_customer"
  | "sync_storage"
  | "edit_photos"
  | "update_website"
  | "custom";

export type CapabilityNeed = {
  capability: ConnectedAppCapability;
  /** Product-facing label AI may show — never a vendor name. */
  label: string;
  required?: boolean;
};

export type ActionWorkflowStep = {
  id: string;
  /** Capability this step needs — UI/AI speak this language. */
  capability: ConnectedAppCapability;
  label: string;
  status: "planned" | "ready" | "blocked" | "not_configured";
  /** Bound at resolve time only — optional; AI prompts should omit this. */
  providerId?: string;
  providerName?: string;
  message?: string;
};

export type ActionPlan = {
  intent: ActionIntent;
  businessId: string;
  projectId?: string;
  /** What Hubly needs — capability language for AI. */
  needs: CapabilityNeed[];
  steps: ActionWorkflowStep[];
  /** Human summary without vendor lock-in. */
  summary: string;
};

const INTENT_NEEDS: Record<Exclude<ActionIntent, "custom">, CapabilityNeed[]> = {
  promote_project: [
    { capability: "creative", label: "Marketing Graphics", required: true },
    { capability: "publishing", label: "Social Publishing", required: true },
    { capability: "messaging", label: "Email / SMS", required: false },
    { capability: "scheduling", label: "Schedule posts", required: false },
  ],
  create_marketing_graphic: [
    { capability: "creative", label: "Marketing Graphics", required: true },
    { capability: "templates", label: "Templates", required: false },
  ],
  publish_social: [
    { capability: "publishing", label: "Social Publishing", required: true },
    { capability: "scheduling", label: "Schedule posts", required: false },
  ],
  request_review: [
    { capability: "reviews", label: "Reviews", required: true },
    { capability: "messaging", label: "Email / SMS", required: false },
  ],
  notify_customer: [
    { capability: "messaging", label: "Email / SMS", required: true },
  ],
  sync_storage: [
    { capability: "storage", label: "File Storage", required: true },
    { capability: "assets_import", label: "Import assets", required: false },
  ],
  edit_photos: [
    { capability: "editing", label: "Photo Editing", required: true },
    { capability: "assets_export", label: "Export edited photos", required: false },
  ],
  update_website: [
    { capability: "publishing", label: "Website / listing updates", required: true },
  ],
};

function pickProvider(
  capability: ConnectedAppCapability,
  preferConfigured = true,
): ConnectedAppProvider | null {
  const apps = listConnectedAppsByCapability(capability);
  if (!apps.length) return null;
  if (preferConfigured) {
    const ready = apps.find((a) => a.isConfigured());
    if (ready) return ready;
  }
  return apps[0] || null;
}

/**
 * Resolve which Connected App should fulfill a capability.
 * Call sites must not hardcode "canva" / "meta" — use this.
 */
export function resolveProviderForCapability(
  capability: ConnectedAppCapability,
  opts?: { preferredProviderId?: string },
): ConnectedAppProvider | null {
  if (opts?.preferredProviderId) {
    const preferred = getConnectedApp(opts.preferredProviderId);
    if (preferred && preferred.capabilities().includes(capability)) {
      return preferred;
    }
  }
  return pickProvider(capability);
}

export function needsForIntent(
  intent: ActionIntent,
  customNeeds?: CapabilityNeed[],
): CapabilityNeed[] {
  if (intent === "custom") return customNeeds || [];
  return INTENT_NEEDS[intent].map((n) => ({ ...n }));
}

/**
 * Build a capability-first workflow. Steps list capability labels;
 * provider binding is internal for executors — AI copy should use `needs`.
 */
export function planAction(input: {
  intent: ActionIntent;
  businessId: string;
  projectId?: string;
  customNeeds?: CapabilityNeed[];
  preferredProviderId?: string;
}): ActionPlan {
  const needs = needsForIntent(input.intent, input.customNeeds);
  const steps: ActionWorkflowStep[] = needs.map((need, i) => {
    const provider = resolveProviderForCapability(need.capability, {
      preferredProviderId: input.preferredProviderId,
    });
    if (!provider) {
      return {
        id: `step_${i}_${need.capability}`,
        capability: need.capability,
        label: need.label,
        status: "blocked",
        message: `No Connected App declares “${need.label}”. Install one from the Apps Marketplace.`,
      };
    }
    if (!provider.isConfigured()) {
      return {
        id: `step_${i}_${need.capability}`,
        capability: need.capability,
        label: need.label,
        status: "not_configured",
        providerId: provider.id,
        providerName: provider.name,
        message: `Connect an app with “${need.label}” to continue.`,
      };
    }
    return {
      id: `step_${i}_${need.capability}`,
      capability: need.capability,
      label: need.label,
      status: "ready",
      providerId: provider.id,
      providerName: provider.name,
    };
  });

  const requiredBlocked = steps.filter(
    (s, idx) => needs[idx]?.required && (s.status === "blocked" || s.status === "not_configured"),
  );
  const summary = requiredBlocked.length
    ? `Need: ${needs.filter((n) => n.required).map((n) => n.label).join(", ")}. Connect apps that provide these capabilities.`
    : `Ready: ${needs.map((n) => n.label).join(" → ")}.`;

  return {
    intent: input.intent,
    businessId: input.businessId,
    projectId: input.projectId,
    needs,
    steps,
    summary,
  };
}

/**
 * AI-facing description — capability language only (no vendor names).
 */
export function describePlanForAi(plan: ActionPlan): {
  need: string[];
  available: string[];
  missing: string[];
  prompt: string;
} {
  const need = plan.needs.map((n) => n.label);
  const available = plan.steps
    .filter((s) => s.status === "ready" || s.status === "planned")
    .map((s) => s.label);
  const missing = plan.steps
    .filter((s) => s.status === "blocked" || s.status === "not_configured")
    .map((s) => s.label);
  const prompt =
    `Need: ${need.join(", ")}.` +
    (missing.length ? ` Missing capabilities: ${missing.join(", ")}.` : " All required capabilities are available.");
  return { need, available, missing, prompt };
}

export async function planActionResult(
  input: Parameters<typeof planAction>[0],
): Promise<HublyProviderResult<ActionPlan>> {
  const plan = planAction(input);
  return providerOk("action_engine", plan, plan.summary);
}

export const HublyActionEngine = {
  planAction,
  planActionResult,
  needsForIntent,
  resolveProviderForCapability,
  describePlanForAi,
  INTENT_NEEDS,
};
