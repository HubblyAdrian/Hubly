/**
 * Hubly Brain — AI Expert Framework + Capability Registry (Milestone 1)
 *
 * Experts are specialized minds Hubly Brain coordinates.
 * Customers never meet them — they only meet Hubly.
 *
 * Rules:
 * - Experts never call models directly (Brain / HublyAI.complete only).
 * - Experts never talk to each other — everything routes through Hubly Brain.
 * - Adding an expert = register() only. No orchestrator special cases.
 */

export type HublyExpertId =
  | "experience_director"
  | "research"
  | "strategy"
  | "creative_director"
  | "critic";

export type HublyExpertCapability = {
  /** What this expert can do (routing keywords / intents). */
  can: string[];
  /** Tools the expert may ask Brain to use (never call itself). */
  tools: string[];
  /** Memory surfaces it may read. */
  reads: Array<"business_memory" | "workspace_memory" | "conversation_memory" | "business_dna" | "blueprints">;
  /** Actions it may propose (Brain decides whether to apply). */
  actions: string[];
};

export type HublyExpertDefinition = {
  id: HublyExpertId;
  name: string;
  purpose: string;
  version: string;
  /** Capability Registry — Brain routes from this. */
  capability: HublyExpertCapability;
  inputs: string[];
  outputs: string[];
  requiredMemory: string[];
  failureBehavior: "skip" | "ask" | "fallback_local";
};

export type HublyExpertContext = {
  request: string;
  intent?: string | null;
  memory?: Record<string, unknown> | null;
  workspace?: Record<string, unknown> | null;
  conversation?: Record<string, unknown> | null;
  dna?: Record<string, unknown> | null;
  blueprintKnowledge?: Record<string, unknown> | null;
  priorOutputs?: HublyExpertOutput[];
};

export type HublyReasoningRecord = {
  reason: string;
  evidence: string[];
  confidence: number;
  expectedImpact?: string | null;
};

export type HublyExpertOutput = {
  expertId: HublyExpertId;
  ok: boolean;
  summary: string;
  payload?: Record<string, unknown> | null;
  reasoning: HublyReasoningRecord[];
  confidence: number;
  questions?: string[];
  error?: string | null;
};

export type HublyExpertHandler = (
  ctx: HublyExpertContext,
) => Promise<HublyExpertOutput> | HublyExpertOutput;

type RegistryEntry = {
  def: HublyExpertDefinition;
  handler: HublyExpertHandler;
};

const REGISTRY = new Map<HublyExpertId, RegistryEntry>();

export function registerExpert(def: HublyExpertDefinition, handler: HublyExpertHandler): void {
  REGISTRY.set(def.id, { def: { ...def, capability: { ...def.capability } }, handler });
}

export function getExpert(id: string): RegistryEntry | null {
  return REGISTRY.get(id as HublyExpertId) || null;
}

export function listExperts(): HublyExpertDefinition[] {
  return [...REGISTRY.values()].map((e) => ({
    ...e.def,
    capability: { ...e.def.capability, can: [...e.def.capability.can], tools: [...e.def.capability.tools], reads: [...e.def.capability.reads], actions: [...e.def.capability.actions] },
  }));
}

export function listExpertCapabilities(): Array<{ id: HublyExpertId; capability: HublyExpertCapability; purpose: string }> {
  return listExperts().map((e) => ({ id: e.id, capability: e.capability, purpose: e.purpose }));
}

/** Route helpers — Brain uses these to pick experts without hardcoding product UI. */
export function expertsForIntent(intent: string): HublyExpertId[] {
  const i = String(intent || "").toLowerCase();
  const hits: HublyExpertId[] = ["experience_director"];
  for (const e of listExperts()) {
    if (e.id === "experience_director") continue;
    if (e.capability.can.some((c) => i.includes(c.toLowerCase()) || c.toLowerCase().includes(i))) {
      hits.push(e.id);
    }
  }
  return hits;
}

export async function runExpert(id: HublyExpertId, ctx: HublyExpertContext): Promise<HublyExpertOutput> {
  const entry = getExpert(id);
  if (!entry) {
    return {
      expertId: id,
      ok: false,
      summary: "Expert not registered",
      reasoning: [],
      confidence: 0,
      error: "not_registered",
    };
  }
  try {
    return await entry.handler(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (entry.def.failureBehavior === "skip") {
      return {
        expertId: id,
        ok: false,
        summary: "Expert skipped after failure",
        reasoning: [{ reason: msg, evidence: [], confidence: 0 }],
        confidence: 0,
        error: msg,
      };
    }
    throw err;
  }
}

export const HublyExpertFramework = {
  register: registerExpert,
  get: getExpert,
  list: listExperts,
  listCapabilities: listExpertCapabilities,
  expertsForIntent,
  run: runExpert,
};
