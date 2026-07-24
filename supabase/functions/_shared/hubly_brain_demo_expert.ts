/**
 * Temporary Demo Expert — Section 3 proof only.
 * Registers / unregisters without modifying Hubly Brain.
 */
import {
  registerExpert,
  unregisterExpert,
  isExpertRegistered,
  type HublyExpertContext,
  type HublyExpertOutput,
} from "./hubly_brain_expert_framework.ts";

export const DEMO_EXPERT_ID = "demo_expert" as const;

export function demoExpertHandler(ctx: HublyExpertContext): HublyExpertOutput {
  return {
    expertId: DEMO_EXPERT_ID,
    ok: true,
    summary: `Demo Expert heard: ${String(ctx.request || "").slice(0, 120)}`,
    payload: { demo: true, intent: ctx.intent || null },
    reasoning: [{
      reason: "Demo Expert exists only to prove registry discovery and clean removal.",
      evidence: ["section_3"],
      confidence: 99,
      expectedImpact: "Prove extensibility without Brain changes",
    }],
    confidence: 99,
  };
}

export function registerDemoExpert(): void {
  registerExpert({
    id: DEMO_EXPERT_ID,
    name: "Demo Expert",
    version: "0.0.1-temp",
    purpose: "Temporary expert proving Section 3 extensibility.",
    responsibilities: ["Demonstrate self-registration", "Demonstrate clean unregister"],
    inputs: ["request"],
    outputs: ["demo"],
    requiredMemory: [],
    allowedTools: [],
    allowedActions: ["demo_ping"],
    capability: {
      can: ["demo", "extensibility"],
      tools: [],
      reads: ["business_memory"],
      actions: ["demo_ping"],
    },
    confidence: { baseline: 99, reportsReasoning: true },
    reasoning: { required: true, fields: ["reason", "evidence", "confidence", "expectedImpact"] },
    executionPriority: 15,
    failureBehavior: "skip",
    dependencies: [],
    intents: ["demo", "general", "build_business"],
  }, demoExpertHandler);
}

export function unregisterDemoExpert(): boolean {
  return unregisterExpert(DEMO_EXPERT_ID);
}

export function isDemoExpertRegistered(): boolean {
  return isExpertRegistered(DEMO_EXPERT_ID);
}
