/**
 * Hubly Runtime — Execution Plan (Phase 7.5)
 *
 * Planner returns WHAT to build (capabilities + dependencies).
 * Orchestrator owns HOW (ordering, parallel, retries).
 *
 * Example:
 * {
 *   steps: [
 *     { capability: "branding", priority: 1 },
 *     { capability: "website", dependsOn: ["branding"] },
 *     { capability: "booking" },
 *     { capability: "crm" },
 *     { capability: "payments", dependsOn: ["crm"] }
 *   ]
 * }
 */

import {
  getCapability,
  type HublyCapabilityId,
} from "./hubly_brain_capabilities.ts";

export type HublyExecutionPlanStep = {
  /** Stable step id within the plan */
  id: string;
  capability: HublyCapabilityId;
  priority?: number;
  dependsOn?: HublyCapabilityId[];
  why?: string;
};

export type HublyExecutionPlan = {
  version: 1;
  goal: string;
  steps: HublyExecutionPlanStep[];
  /** Confirms planner input was memory-only */
  source: "business_memory";
};

/** DAG node for Orchestrator scheduling. */
export type HublyExecutionGraphNode = {
  id: string;
  capability: HublyCapabilityId;
  priority: number;
  dependsOn: HublyCapabilityId[];
  why?: string;
};

export type HublyExecutionGraph = {
  nodes: HublyExecutionGraphNode[];
  /** capability → dependents */
  edges: Record<string, HublyCapabilityId[]>;
};

export function normalizeExecutionPlan(
  plan: HublyExecutionPlan | null | undefined,
): HublyExecutionPlan {
  const steps = Array.isArray(plan?.steps) ? plan!.steps : [];
  const normalized: HublyExecutionPlanStep[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const raw = steps[i];
    if (!raw || typeof raw !== "object") continue;
    const capability = String(raw.capability || "") as HublyCapabilityId;
    if (!getCapability(capability)) continue;
    if (seen.has(capability)) continue;
    seen.add(capability);
    const cap = getCapability(capability)!;
    const dependsOn = Array.isArray(raw.dependsOn)
      ? (raw.dependsOn.map(String).filter(Boolean) as HublyCapabilityId[])
      : [...cap.defaultDependsOn];
    normalized.push({
      id: String(raw.id || capability),
      capability,
      priority: typeof raw.priority === "number" ? raw.priority : i + 1,
      dependsOn,
      why: raw.why ? String(raw.why) : undefined,
    });
  }

  return {
    version: 1,
    goal: String(plan?.goal || "Build this business"),
    steps: normalized,
    source: "business_memory",
  };
}

/** Build an execution DAG from a plan. Capabilities = nodes; dependsOn = edges. */
export function buildExecutionGraph(plan: HublyExecutionPlan): HublyExecutionGraph {
  const normalized = normalizeExecutionPlan(plan);
  const nodes: HublyExecutionGraphNode[] = normalized.steps.map((s) => ({
    id: s.id,
    capability: s.capability,
    priority: s.priority ?? 100,
    dependsOn: [...(s.dependsOn || [])],
    why: s.why,
  }));

  const edges: Record<string, HublyCapabilityId[]> = {};
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (!edges[dep]) edges[dep] = [];
      if (!edges[dep].includes(node.capability)) edges[dep].push(node.capability);
    }
  }

  return { nodes, edges };
}

/** Detect cycles — returns list of capability ids in a cycle, or null. */
export function findExecutionCycle(graph: HublyExecutionGraph): HublyCapabilityId[] | null {
  const caps = new Set(graph.nodes.map((n) => n.capability));
  const deps = new Map(graph.nodes.map((n) => [n.capability, n.dependsOn.filter((d) => caps.has(d))]));
  const visiting = new Set<HublyCapabilityId>();
  const visited = new Set<HublyCapabilityId>();
  const stack: HublyCapabilityId[] = [];

  function dfs(c: HublyCapabilityId): HublyCapabilityId[] | null {
    if (visiting.has(c)) {
      const idx = stack.indexOf(c);
      return stack.slice(idx);
    }
    if (visited.has(c)) return null;
    visiting.add(c);
    stack.push(c);
    for (const d of deps.get(c) || []) {
      const cycle = dfs(d);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(c);
    visited.add(c);
    return null;
  }

  for (const c of caps) {
    const cycle = dfs(c);
    if (cycle) return cycle;
  }
  return null;
}

export const HublyExecutionPlanApi = {
  normalize: normalizeExecutionPlan,
  buildGraph: buildExecutionGraph,
  findCycle: findExecutionCycle,
};

export default HublyExecutionPlanApi;
