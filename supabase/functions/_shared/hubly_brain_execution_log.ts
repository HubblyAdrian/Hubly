/**
 * Hubly Brain — Execution Log (Section 1)
 *
 * Every AI interaction that enters Hubly Brain is logged here.
 * Providers are never called outside Brain; this log proves each run.
 */

export type HublyBrainExecutionKind = "think" | "complete";

export type HublyBrainExecutionRecord = {
  id: string;
  at: string;
  kind: HublyBrainExecutionKind;
  /** Product / edge feature id */
  feature: string;
  task?: string | null;
  intent?: string | null;
  /** Experts Brain selected (empty = Brain chose direct model completion). */
  expertsSelected: string[];
  /** Whether Brain merged multi-expert output into one owner response. */
  mergedResponse: boolean;
  /** Whether conversation / business memory was updated for this run. */
  memoryUpdated: boolean;
  confidence?: number | null;
  ok: boolean;
  latencyMs: number;
  provider?: string | null;
  model?: string | null;
  error?: string | null;
  businessId?: string | null;
  runId?: string | null;
};

const MAX_LOG = 250;
const LOG: HublyBrainExecutionRecord[] = [];

function newId(): string {
  return `exec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function logBrainExecution(
  partial: Omit<HublyBrainExecutionRecord, "id" | "at"> & { id?: string; at?: string },
): HublyBrainExecutionRecord {
  const record: HublyBrainExecutionRecord = {
    id: partial.id || newId(),
    at: partial.at || new Date().toISOString(),
    kind: partial.kind,
    feature: partial.feature || "unknown",
    task: partial.task ?? null,
    intent: partial.intent ?? null,
    expertsSelected: [...(partial.expertsSelected || [])],
    mergedResponse: !!partial.mergedResponse,
    memoryUpdated: !!partial.memoryUpdated,
    confidence: partial.confidence ?? null,
    ok: partial.ok !== false,
    latencyMs: Math.max(0, Math.round(partial.latencyMs || 0)),
    provider: partial.provider ?? null,
    model: partial.model ?? null,
    error: partial.error ?? null,
    businessId: partial.businessId ?? null,
    runId: partial.runId ?? null,
  };
  LOG.push(record);
  while (LOG.length > MAX_LOG) LOG.shift();
  console.log("HublyBrain.execution", {
    id: record.id,
    kind: record.kind,
    feature: record.feature,
    expertsSelected: record.expertsSelected,
    memoryUpdated: record.memoryUpdated,
    ok: record.ok,
    latencyMs: record.latencyMs,
  });
  return record;
}

export function listBrainExecutions(limit = 50): HublyBrainExecutionRecord[] {
  const n = Math.max(1, Math.min(250, limit));
  return LOG.slice(-n).map((r) => ({ ...r, expertsSelected: [...r.expertsSelected] }));
}

export function clearBrainExecutionsForTests(): void {
  LOG.length = 0;
}

/** Best-effort durable write (service role). Never throws to callers. */
export async function persistBrainExecution(record: HublyBrainExecutionRecord): Promise<void> {
  try {
    const url = (Deno.env.get("SUPABASE_URL") || "").trim();
    const key = (
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEYS") ||
      ""
    ).trim();
    if (!url || !key) return;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(url, key);
    await supabase.from("hubly_brain_executions").insert({
      id: undefined,
      business_id: record.businessId || null,
      run_id: record.runId || record.id,
      kind: record.kind,
      feature: record.feature,
      task: record.task,
      intent: record.intent,
      experts_selected: record.expertsSelected,
      merged_response: record.mergedResponse,
      memory_updated: record.memoryUpdated,
      confidence: record.confidence,
      ok: record.ok,
      latency_ms: record.latencyMs,
      provider: record.provider,
      model: record.model,
      error: record.error,
      payload: { executionId: record.id, at: record.at },
    });
  } catch (err) {
    console.warn("HublyBrain.persistExecution skipped", err);
  }
}

export const HublyBrainExecutionLog = {
  log: logBrainExecution,
  list: listBrainExecutions,
  clearForTests: clearBrainExecutionsForTests,
  persist: persistBrainExecution,
};
