/** Node mirror of hubly_brain_builder_expert.ts — Milestone 1.5 Epic 1 (esbuild). */


// supabase/functions/_shared/hubly_brain_builder_expert.ts
import {
  registerExpert,
  isExpertRegistered
} from "./expert-framework.mjs";
import {
  createBuilderIntent,
  isBuilderRequest
} from "./builder-intent.mjs";
import {
  ensureRegistriesBootstrapped,
  planRegistryRoute
} from "./registries.mjs";
var BUILDER_EXPERT_ID = "builder";
var BUILDER_EXPERT_VERSION = "1.0.0";
function builderExpertHandler(ctx) {
  ensureRegistriesBootstrapped();
  const request = String(ctx.request || "");
  const route = planRegistryRoute(request);
  const intent = createBuilderIntent(request, {
    memory: ctx.memory || null,
    workspace: ctx.workspace || null,
    conversationIntelligence: ctx.conversation || null,
    dna: ctx.dna || null,
    registryCapabilities: (route.capabilities || []).map((c) => ({
      toolId: c.toolId,
      toolName: c.toolName,
      capabilityId: c.capabilityId,
      capabilityLabel: c.capabilityLabel,
      score: c.score
    }))
  });
  const systems = intent.affectedSystems.join(", ");
  const caps = intent.requiredCapabilities.map((c) => c.capabilityLabel).slice(0, 4).join(", ");
  const summary = `I understand you want: ${intent.ownerGoal} (${intent.intentCategory}). Affected: ${systems}. Capabilities: ${caps || "to be confirmed"}. No changes applied \u2014 Change Plan comes next.`;
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
      changePlanGenerated: false
    },
    payload: {
      type: "Builder Intent",
      builderIntent: intent,
      applied: false,
      changePlanGenerated: false
    },
    reasoning: intent.reasoning.map((r) => ({
      reason: r.reason,
      evidence: r.evidence,
      confidence: r.confidence,
      expectedImpact: "Clear Builder Intent for a future Change Plan (Epic 2+) \u2014 nothing applied now."
    })),
    confidence: intent.confidence,
    questions: []
  };
}
function ensureBuilderExpertRegistered() {
  if (isExpertRegistered(BUILDER_EXPERT_ID)) return;
  registerExpert({
    id: BUILDER_EXPERT_ID,
    name: "Builder Expert",
    version: BUILDER_EXPERT_VERSION,
    purpose: "Understand what the owner wants to build \u2014 produce a Builder Intent only. Never apply changes.",
    responsibilities: [
      "Classify build requests",
      "Identify affected systems",
      "Map required capabilities via Capability Registry",
      "Estimate risk and confidence with explanation",
      "Produce one Builder Intent (including multi-system)",
      "Never write memory, UI, or Change Plans"
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
        "marketplace"
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
        "image_processor"
      ],
      reads: ["business_memory", "workspace_memory", "conversation_memory", "business_dna"],
      actions: ["propose_builder_intent"]
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
      "image_processor"
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
      "general"
    ]
  }, builderExpertHandler);
}
function extractBuilderIntentFromOutput(out) {
  if (!out) return null;
  const payload = out.output || out.payload || {};
  if (payload.type === "Builder Intent" && payload.builderIntent) {
    return payload.builderIntent;
  }
  return null;
}
var HublyBuilderExpert = {
  id: BUILDER_EXPERT_ID,
  version: BUILDER_EXPERT_VERSION,
  ensureRegistered: ensureBuilderExpertRegistered,
  handler: builderExpertHandler,
  createIntent: createBuilderIntent,
  isBuilderRequest,
  extract: extractBuilderIntentFromOutput
};
export {
  BUILDER_EXPERT_ID,
  BUILDER_EXPERT_VERSION,
  HublyBuilderExpert,
  builderExpertHandler,
  createBuilderIntent,
  ensureBuilderExpertRegistered,
  extractBuilderIntentFromOutput,
  isBuilderRequest
};
