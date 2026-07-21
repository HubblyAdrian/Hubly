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
  normalizeBusinessDNA,
  type HublyBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";
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
  assessCapabilityConfidence,
  type HublyCapabilityConfidence,
} from "./hubly_brain_confidence.ts";
import {
  executeCapability,
  persistBusinessDNA,
  persistBusinessMemory,
  type HublyCapabilityResult,
  type HublyExecutorContext,
} from "./hubly_brain_executors.ts";

export type HublyOrchestratorOpts = {
  plan: HublyExecutionPlan;
  memory?: HublyBusinessMemoryInput | null;
  /** Interpretive identity — passed to every capability; never merged into Memory */
  dna?: HublyBusinessDNAInput | null;
  businessId?: string | null;
  supabase?: SupabaseClient | null;
  persist?: boolean;
  maxRetries?: number;
  signal?: AbortSignal | null;
  onProgress?: HublyProgressListener;
  bus?: HublyProgressBus;
  recordHistory?: boolean;
  /** When true (default), low-confidence capabilities that shouldAsk are paused with questions */
  respectConfidence?: boolean;
};

export type HublyOrchestratorResult = {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  plan: HublyExecutionPlan;
  memory: HublyBusinessMemory;
  dna: HublyBusinessDNA;
  results: HublyCapabilityResult[];
  confidence: HublyCapabilityConfidence[];
  clarifyingQuestions: string[];
  progress: HublyProgressEvent[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  errors: string[];
  persistedMemory: boolean;
  persistedDna: boolean;
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
  let dna = normalizeBusinessDNA(opts.dna);
  const maxRetries = Math.max(0, opts.maxRetries ?? 1);
  const results: HublyCapabilityResult[] = [];
  const confidenceReports: HublyCapabilityConfidence[] = [];
  const clarifyingQuestions: string[] = [];
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
      dna,
      results,
      confidence: confidenceReports,
      clarifyingQuestions,
      progress: bus.history(),
      startedAt,
      completedAt,
      durationMs: Date.now() - t0,
      errors: [msg],
      persistedMemory: false,
      persistedDna: false,
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
        dna,
        results,
        confidence: confidenceReports,
        clarifyingQuestions,
        progress: bus.history(),
        startedAt,
        completedAt,
        durationMs: Date.now() - t0,
        errors: ["Cancelled"],
        persistedMemory: false,
        persistedDna: false,
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
          dna,
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
        const confidence = assessCapabilityConfidence(node.capability, { memory, dna });
        confidenceReports.push(confidence);
        for (const q of confidence.clarifyingQuestions) {
          if (!clarifyingQuestions.includes(q)) clarifyingQuestions.push(q);
        }
        bus.emit({
          capability: node.capability,
          state: "running",
          message: `${cap?.progressLabel || node.capability} (${confidence.confidence}% confidence)`,
          meta: { confidence },
        });

        if (!cap?.executable) {
          const skipResult: HublyCapabilityResult = {
            capability: node.capability,
            ok: false,
            skipped: true,
            detail: "Capability not executable yet — registered for future migration",
            memory,
            dna,
            confidence,
          };
          results.push(skipResult);
          done.add(node.capability);
          statusByCap.set(node.capability, "skipped");
          bus.emit({
            capability: node.capability,
            state: "completed",
            message: `Skipped (not executable yet): ${cap?.label || node.capability}`,
            meta: { confidence },
          });
          return;
        }

        // Low confidence → ask instead of guessing (especially pricing-heavy caps)
        if (
          opts.respectConfidence !== false &&
          confidence.shouldAsk &&
          (node.capability === "payments" || node.capability === "quotes" ||
            node.capability === "marketing")
        ) {
          results.push({
            capability: node.capability,
            ok: false,
            skipped: true,
            detail: `Needs input (${confidence.confidence}%): ${confidence.clarifyingQuestions[0] || confidence.reason}`,
            memory,
            dna,
            confidence,
          });
          done.add(node.capability);
          statusByCap.set(node.capability, "skipped");
          bus.emit({
            capability: node.capability,
            state: "waiting",
            message: confidence.clarifyingQuestions[0] || "Need more information",
            meta: { confidence, ask: true },
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
              meta: { confidence },
            });
            try {
              await sleep(150 * attempt, opts.signal);
            } catch {
              return;
            }
          }

          try {
            const ctx: HublyExecutorContext = {
              businessId: opts.businessId,
              memory,
              dna,
              supabase: opts.supabase,
              persist: false,
              runId: bus.runId,
              source: "runtime",
              confidence,
            };
            const result = await executeCapability(node.capability, ctx, node.why);
            memory = result.memory;
            dna = result.dna;
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
                meta: { confidence },
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
                meta: { confidence },
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
  let persistedDna = false;
  if (opts.persist !== false && opts.businessId && results.some((r) => r.ok)) {
    const writeMem = await persistBusinessMemory(opts.businessId, memory, {
      supabase: opts.supabase,
      source: "system",
    });
    persistedMemory = writeMem.ok;
    if (!writeMem.ok) errors.push(`Memory persist failed: ${writeMem.error || "unknown"}`);

    const writeDna = await persistBusinessDNA(opts.businessId, dna, {
      supabase: opts.supabase,
      source: dna.source || "system",
    });
    persistedDna = writeDna.ok;
    if (!writeDna.ok) errors.push(`DNA persist failed: ${writeDna.error || "unknown"}`);
  }

  const status: HublyOrchestratorResult["status"] =
    failed.size && !results.some((r) => r.ok)
      ? "failed"
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
    dna,
    results,
    confidence: confidenceReports,
    clarifyingQuestions,
    progress: bus.history(),
    startedAt,
    completedAt,
    durationMs,
    errors,
    persistedMemory,
    persistedDna,
    historyId,
  };
}

export const HublyOrchestrator = {
  orchestrate,
  createProgressBus,
};

export default HublyOrchestrator;
