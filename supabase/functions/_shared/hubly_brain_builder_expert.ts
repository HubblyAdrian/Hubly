/**
 * Milestone 1.5 · Epic 1 — Builder Expert
 *
 * Understands building requests → Builder Intent.
 * Does not apply changes, generate Change Plans, preview, or rollback.
 */

import {
  registerExpert,
  isExpertRegistered,
  type HublyExpertContext,
  type HublyExpertOutput,
} from "./hubly_brain_expert_framework.ts";
import {
  createBuilderIntent,
  isBuilderRequest,
  type BuilderIntent,
} from "./hubly_brain_builder_intent.ts";
import {
  ensureRegistriesBootstrapped,
  planRegistryRoute,
} from "./hubly_brain_registries.ts";

export const BUILDER_EXPERT_ID = "builder" as const;
export const BUILDER_EXPERT_VERSION = "1.0.0" as const;

export function builderExpertHandler(ctx: HublyExpertContext): HublyExpertOutput {
  ensureRegistriesBootstrapped();
  const request = String(ctx.request || "");
  const route = planRegistryRoute(request);

  const intent: BuilderIntent = createBuilderIntent(request, {
    memory: (ctx.memory || null) as Record<string, unknown> | null,
    workspace: (ctx.workspace || null) as Record<string, unknown> | null,
    conversationIntelligence: (ctx.conversation || null) as Record<string, unknown> | null,
    dna: (ctx.dna || null) as Record<string, unknown> | null,
    registryCapabilities: (route.capabilities || []).map((c) => ({
      toolId: c.toolId,
      toolName: c.toolName,
      capabilityId: c.capabilityId,
      capabilityLabel: c.capabilityLabel,
      score: c.score,
    })),
  });

  const systems = intent.affectedSystems.join(", ");
  const caps = intent.requiredCapabilities
    .map((c) => c.capabilityLabel)
    .slice(0, 4)
    .join(", ");

  const summary =
    `I understand you want: ${intent.ownerGoal} ` +
    `(${intent.intentCategory}). Affected: ${systems}. ` +
    `Capabilities: ${caps || "to be confirmed"}. ` +
    `No changes applied — Change Plan comes next.`;

  return {
    expertId: BUILDER_EXPERT_ID,
    expertName: "Builder Expert",
    ok: true,
    status: "ok",
    summary,
    output: {
      type: "Builder Intent",
      builderIntent: intent,
      applied: false,
      changePlanGenerated: false,
    },
    payload: {
      type: "Builder Intent",
      builderIntent: intent,
      applied: false,
      changePlanGenerated: false,
    },
    reasoning: intent.reasoning.map((r) => ({
      reason: r.reason,
      evidence: r.evidence,
      confidence: r.confidence,
      expectedImpact: "Clear Builder Intent for a future Change Plan (Epic 2+) — nothing applied now.",
    })),
    confidence: intent.confidence,
    questions: [],
  };
}

export function ensureBuilderExpertRegistered(): void {
  if (isExpertRegistered(BUILDER_EXPERT_ID)) return;

  registerExpert({
    id: BUILDER_EXPERT_ID,
    name: "Builder Expert",
    version: BUILDER_EXPERT_VERSION,
    purpose:
      "Understand what the owner wants to build — produce a Builder Intent only. Never apply changes.",
    responsibilities: [
      "Classify build requests",
      "Identify affected systems",
      "Map required capabilities via Capability Registry",
      "Estimate risk and confidence with explanation",
      "Produce one Builder Intent (including multi-system)",
      "Never write memory, UI, or Change Plans",
    ],
    capability: {
      can: [
        "builder",
        "build",
        "website",
        "homepage",
        "premium",
        "booking",
        "same-day",
        "arrival",
        "workspace",
        "sidebar",
        "portfolio",
        "photos",
        "automation",
        "workflow",
        "crm",
        "package",
        "marketplace",
      ],
      tools: [
        "website_builder",
        "booking",
        "crm",
        "workspace_builder",
        "portfolio_builder",
        "packages_builder",
        "automation",
        "marketplace",
        "image_processor",
      ],
      reads: ["business_memory", "workspace_memory", "conversation_memory", "business_dna"],
      actions: ["propose_builder_intent"],
    },
    allowedTools: [
      "website_builder",
      "booking",
      "crm",
      "workspace_builder",
      "portfolio_builder",
      "packages_builder",
      "automation",
      "marketplace",
      "image_processor",
    ],
    allowedActions: ["propose_builder_intent"],
    inputs: ["request", "memory", "workspace", "conversation", "dna", "registryRouting"],
    outputs: ["Builder Intent", "confidenceExplanation", "reasoning", "confidence"],
    requiredMemory: ["business_memory", "workspace_memory", "conversation_intelligence", "business_dna"],
    confidence: { baseline: 88, reportsReasoning: true },
    reasoning: { required: true, fields: ["reason", "evidence", "confidence", "expectedImpact"] },
    /** After Critic (40), before Experience Director (100). */
    executionPriority: 50,
    failureBehavior: "ask",
    dependencies: [],
    intents: [
      "build_business",
      "builder",
      "website",
      "workspace",
      "coach",
      "general",
    ],
  }, builderExpertHandler);
}

export function extractBuilderIntentFromOutput(out: HublyExpertOutput | null | undefined): BuilderIntent | null {
  if (!out) return null;
  const payload = (out.output || out.payload || {}) as {
    type?: string;
    builderIntent?: BuilderIntent;
  };
  if (payload.type === "Builder Intent" && payload.builderIntent) {
    return payload.builderIntent;
  }
  return null;
}

export {
  isBuilderRequest,
  createBuilderIntent,
  type BuilderIntent,
  type BuilderConfidenceExplanation,
  type BuilderIntentCategory,
};

export const HublyBuilderExpert = {
  id: BUILDER_EXPERT_ID,
  version: BUILDER_EXPERT_VERSION,
  ensureRegistered: ensureBuilderExpertRegistered,
  handler: builderExpertHandler,
  createIntent: createBuilderIntent,
  isBuilderRequest,
  extract: extractBuilderIntentFromOutput,
};
