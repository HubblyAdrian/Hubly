// ============================================================================
// CHANGED BUT NEVER EXECUTED — API key migration, 2026-08-19
//
// WHAT CHANGED
//   Supabase key resolution was moved to _shared/supabase_admin.ts
//   (createAdminClient / createUserClient / requireSecretKey / adminHeaders).
//   That helper THROWS on a missing key instead of continuing with "", reads
//   the plural SUPABASE_PUBLISHABLE_KEYS the platform actually injects, and
//   never sends a non-JWT sb_secret_ key as a Bearer token.
//
// THIS FILE WAS NOT RUN.
//   persistBrainExecution is best-effort and swallows its own errors by design, so a broken key would look identical to success from outside.
//
// TO PROVE IT
//   Run a hubly-brain request, then confirm a NEW row appears in hubly_brain_executions with a fresh created_at.
//
// A file that looks migrated and was never verified is worse than one that
// obviously still reads legacy vars: the second is greppable, the first looks
// done. Delete this banner only when the check above has actually been run.
// ============================================================================

// Key resolution goes through supabase_admin.ts: THROWS on a missing key rather
// than continuing with "", and never sends a non-JWT sb_secret_ key as a Bearer
// token (PostgREST rejects those as "Invalid JWT").
import { createAdminClient } from "./supabase_admin.ts";
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
    // Was `!== false`: an execution that never set `ok` was logged as a SUCCESS,
    // so diagnostics could not tell "it worked" from "nobody said". Assert, never assume.
    ok: partial.ok === true,
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
    if (!url) return;
    // createAdminClient() throws on a missing key. This function is documented
    // as never throwing to callers, and the whole body is inside a try/catch --
    // so a missing key is now a logged exception rather than a silent no-op.
    const supabase = createAdminClient();
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
