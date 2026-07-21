/**
 * Hubly Runtime — Orchestrator (Phase 7.5)
 *
 * Planner decides WHAT. Orchestrator decides HOW:
 *   dependency resolution · execution ordering · retries · rollback
 *   parallel execution · progress streaming · cancellation · history
 *
 * Execution is a DAG. Capabilities = nodes. Dependencies = edges.
 * Future capabilities register themselves — no special cases here.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import {
  getCapability,
  type HublyCapabilityId,
} from "./hubly_brain_capabilities.ts";
import {
  buildExecutionGraph,
  findExecutionCycle,
  normalizeExecutionPlan,
  type HublyExecutionPlan,
} from "./hubly_brain_execution_plan.ts";
import {
  createProgressBus,
  type HublyProgressBus,
  type HublyProgressEvent,
  type HublyProgressListener,
} from "./hubly_brain_progress.ts";
import {
  executeCapability,
  persistBusinessMemory,
  type HublyCapabilityResult,
  type HublyExecutorContext,
} from "./hubly_brain_executors.ts";

export type HublyOrchestratorOpts = {
  plan: HublyExecutionPlan;
  memory?: HublyBusinessMemoryInput | null;
  businessId?: string | null;
  supabase?: SupabaseClient | null;
  persist?: boolean;
  /** Max retries per capability (default 1 = one retry). */
  maxRetries?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal | null;
  onProgress?: HublyProgressListener;
  /** Reuse an existing bus / run id */
  bus?: HublyProgressBus;
  /** Persist execution history row when businessId set */
  recordHistory?: boolean;
};

export type HublyOrchestratorResult = {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  plan: HublyExecutionPlan;
  memory: HublyBusinessMemory;
  results: HublyCapabilityResult[];
  progress: HublyProgressEvent[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  errors: string[];
  persistedMemory: boolean;
  historyId?: string | null;
};

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function recordExecutionHistory(
  opts: {
    supabase?: SupabaseClient | null;
    businessId?: string | null;
    runId: string;
    prompt?: string | null;
    status: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    memory: HublyBusinessMemory;
    plan: HublyExecutionPlan;
    results: HublyCapabilityResult[];
    progress: HublyProgressEvent[];
    errors: string[];
  },
): Promise<string | null> {
  if (!opts.supabase || !opts.businessId) return null;
  const { data, error } = await opts.supabase.from("hubly_execution_runs").upsert(
    {
      id: opts.runId,
      business_id: opts.businessId,
      prompt: opts.prompt || null,
      status: opts.status,
      started_at: opts.startedAt,
      completed_at: opts.completedAt,
      duration_ms: opts.durationMs,
      memory_snapshot: opts.memory,
      execution_plan: opts.plan,
      executor_results: opts.results.map((r) => ({
        capability: r.capability,
        ok: r.ok,
        skipped: r.skipped || false,
        detail: r.detail,
        effects: r.effects || null,
      })),
      progress_events: opts.progress,
      errors: opts.errors.length ? opts.errors : null,
    },
    { onConflict: "id" },
  ).select("id").maybeSingle();
  if (error) {
    console.warn("hubly_execution_runs persist", error.message);
    return null;
  }
  return data?.id || opts.runId;
}

/**
 * Run an Execution Plan through the Orchestrator.
 * Independent capabilities execute in parallel; dependents wait on the DAG.
 */
export async function orchestrate(
  opts: HublyOrchestratorOpts,
): Promise<HublyOrchestratorResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const bus = opts.bus || createProgressBus();
  if (opts.onProgress) bus.subscribe(opts.onProgress);

  const plan = normalizeExecutionPlan(opts.plan);
  let memory = normalizeBusinessMemory(opts.memory);
  const maxRetries = Math.max(0, opts.maxRetries ?? 1);
  const results: HublyCapabilityResult[] = [];
  const errors: string[] = [];
  const rollbacks: Array<() => Promise<void> | void> = [];
  const done = new Set<HublyCapabilityId>();
  const failed = new Set<HublyCapabilityId>();
  const statusByCap = new Map<HublyCapabilityId, "completed" | "failed" | "skipped">();
  const waitingAnnounced = new Set<HublyCapabilityId>();

  const graph = buildExecutionGraph(plan);
  const cycle = findExecutionCycle(graph);
  if (cycle) {
    const msg = `Execution graph cycle: ${cycle.join(" → ")}`;
    bus.emit({ capability: null, state: "failed", message: msg, error: msg });
    const completedAt = new Date().toISOString();
    return {
      runId: bus.runId,
      status: "failed",
      plan,
      memory,
      results,
      progress: bus.history(),
      startedAt,
      completedAt,
      durationMs: Date.now() - t0,
      errors: [msg],
      persistedMemory: false,
    };
  }

  // Queue all nodes
  for (const node of graph.nodes) {
    const cap = getCapability(node.capability);
    bus.emit({
      capability: node.capability,
      state: "queued",
      message: cap?.progressLabel || `${node.capability} queued`,
    });
  }

  bus.emit({ capability: null, state: "executing", message: "Executing…" });

  const remaining = new Map(graph.nodes.map((n) => [n.capability, n]));

  const isCancelled = () => !!opts.signal?.aborted;

  while (remaining.size > 0) {
    if (isCancelled()) {
      for (const cap of remaining.keys()) {
        bus.emit({
          capability: cap,
          state: "cancelled",
          message: "Cancelled",
        });
      }
      // Best-effort rollback in reverse
      for (const rb of [...rollbacks].reverse()) {
        try {
          await rb();
        } catch (e) {
          console.warn("rollback failed", e);
        }
      }
      const completedAt = new Date().toISOString();
      const historyId = opts.recordHistory !== false
        ? await recordExecutionHistory({
          supabase: opts.supabase,
          businessId: opts.businessId,
          runId: bus.runId,
          status: "cancelled",
          startedAt,
          completedAt,
          durationMs: Date.now() - t0,
          memory,
          plan,
          results,
          progress: bus.history(),
          errors: ["Cancelled"],
        })
        : null;
      return {
        runId: bus.runId,
        status: "cancelled",
        plan,
        memory,
        results,
        progress: bus.history(),
        startedAt,
        completedAt,
        durationMs: Date.now() - t0,
        errors: ["Cancelled"],
        persistedMemory: false,
        historyId,
      };
    }

    const ready: typeof graph.nodes = [];
    for (const node of remaining.values()) {
      const unmet = node.dependsOn.filter((d) => {
        if (!graph.nodes.some((n) => n.capability === d)) return false;
        return !done.has(d);
      });
      const blockedByFail = node.dependsOn.some((d) => failed.has(d));
      if (blockedByFail) {
        bus.emit({
          capability: node.capability,
          state: "failed",
          message: "Blocked by failed dependency",
          error: "dependency_failed",
        });
        results.push({
          capability: node.capability,
          ok: false,
          skipped: true,
          detail: "Blocked by failed dependency",
          memory,
        });
        failed.add(node.capability);
        statusByCap.set(node.capability, "failed");
        remaining.delete(node.capability);
        continue;
      }
      if (unmet.length === 0) {
        ready.push(node);
      } else if (!waitingAnnounced.has(node.capability)) {
        waitingAnnounced.add(node.capability);
        bus.emit({
          capability: node.capability,
          state: "waiting",
          message: `Waiting on ${unmet.join(", ")}`,
          meta: { waitingOn: unmet },
        });
      }
    }

    // Sort ready by priority (lower = earlier)
    ready.sort((a, b) => a.priority - b.priority);

    if (!ready.length) {
      // Deadlock safety — shouldn't happen without cycles
      const stuck = [...remaining.keys()];
      const msg = `No ready capabilities; stuck: ${stuck.join(", ")}`;
      errors.push(msg);
      for (const cap of stuck) {
        bus.emit({ capability: cap, state: "failed", message: msg, error: msg });
        failed.add(cap);
        remaining.delete(cap);
      }
      break;
    }

    // Parallel wave
    await Promise.all(
      ready.map(async (node) => {
        remaining.delete(node.capability);
        const cap = getCapability(node.capability);
        if (!cap?.executable) {
          const skipResult: HublyCapabilityResult = {
            capability: node.capability,
            ok: false,
            skipped: true,
            detail: "Capability not executable yet — registered for future migration",
            memory,
          };
          results.push(skipResult);
          done.add(node.capability);
          statusByCap.set(node.capability, "skipped");
          bus.emit({
            capability: node.capability,
            state: "completed",
            message: `Skipped (not executable yet): ${cap?.label || node.capability}`,
          });
          return;
        }

        let attempt = 0;
        let lastErr: string | null = null;
        while (attempt <= maxRetries) {
          if (isCancelled()) return;
          attempt++;
          if (attempt > 1) {
            bus.emit({
              capability: node.capability,
              state: "retrying",
              message: `Retrying ${cap.progressLabel}`,
              attempt,
            });
            try {
              await sleep(150 * attempt, opts.signal);
            } catch {
              return;
            }
          } else {
            bus.emit({
              capability: node.capability,
              state: "running",
              message: cap.progressLabel,
              attempt,
            });
          }

          try {
            const ctx: HublyExecutorContext = {
              businessId: opts.businessId,
              memory,
              supabase: opts.supabase,
              persist: false, // orchestrator persists once at end
              runId: bus.runId,
              source: "runtime",
            };
            const result = await executeCapability(node.capability, ctx, node.why);
            memory = result.memory;
            results.push(result);
            if (result.rollback) rollbacks.push(result.rollback);

            if (result.ok) {
              done.add(node.capability);
              statusByCap.set(node.capability, "completed");
              bus.emit({
                capability: node.capability,
                state: "completed",
                message: result.detail || cap.progressLabel,
                attempt,
              });
              return;
            }

            lastErr = result.detail;
            if (result.skipped) {
              done.add(node.capability);
              statusByCap.set(node.capability, "skipped");
              bus.emit({
                capability: node.capability,
                state: "completed",
                message: result.detail,
                attempt,
              });
              return;
            }
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "Executor error";
          }
        }

        failed.add(node.capability);
        statusByCap.set(node.capability, "failed");
        errors.push(`${node.capability}: ${lastErr || "failed"}`);
        bus.emit({
          capability: node.capability,
          state: "failed",
          message: lastErr || "Failed",
          error: lastErr || "failed",
          attempt: maxRetries + 1,
        });
      }),
    );
  }

  let persistedMemory = false;
  if (opts.persist !== false && opts.businessId && results.some((r) => r.ok)) {
    const write = await persistBusinessMemory(opts.businessId, memory, {
      supabase: opts.supabase,
      source: "system",
    });
    persistedMemory = write.ok;
    if (!write.ok) errors.push(`Memory persist failed: ${write.error || "unknown"}`);
  }

  const status: HublyOrchestratorResult["status"] =
    failed.size && !results.some((r) => r.ok)
      ? "failed"
      : failed.size
      ? "completed" // partial
      : "completed";

  bus.emit({
    capability: null,
    state: status === "failed" ? "failed" : "done",
    message: status === "failed" ? "Failed." : "Done.",
  });

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;

  const historyId = opts.recordHistory !== false
    ? await recordExecutionHistory({
      supabase: opts.supabase,
      businessId: opts.businessId,
      runId: bus.runId,
      status: status === "completed" ? "completed" : "failed",
      startedAt,
      completedAt,
      durationMs,
      memory,
      plan,
      results,
      progress: bus.history(),
      errors,
    })
    : null;

  bus.clearListeners();

  return {
    runId: bus.runId,
    status,
    plan,
    memory,
    results,
    progress: bus.history(),
    startedAt,
    completedAt,
    durationMs,
    errors,
    persistedMemory,
    historyId,
  };
}

export const HublyOrchestrator = {
  orchestrate,
  createProgressBus,
};

export default HublyOrchestrator;
