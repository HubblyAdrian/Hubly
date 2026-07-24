/**
 * Hubly Brain — Performance, Reliability & Resilience (Milestone 1 · Section 14)
 *
 * Not just speed. Trustworthiness.
 *
 * Reliability · Performance · Resilience · Observability · Cost Awareness ·
 * Security boundaries · Hubly Trust Score (engineering).
 *
 * The owner should never wonder: "Will Hubly work?"
 * And never see raw system errors.
 */

export const RELIABILITY_VERSION = "1.0.0" as const;
export const RELIABILITY_OWNER = "hubly_brain" as const;

export type HublyProviderId =
  | "openai"
  | "anthropic"
  | "stripe"
  | "google_calendar"
  | "weather"
  | "hubly_brain"
  | "tool"
  | "memory"
  | "dna"
  | "decision"
  | "builder"
  | "expert";

export type RetryPolicy = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOnTimeout: boolean;
};

export type CircuitState = "closed" | "open" | "half_open";

export type CircuitBreakerSnapshot = {
  provider: HublyProviderId | string;
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

export type ObservabilitySample = {
  at: string;
  kind:
    | "ai_latency"
    | "tool_latency"
    | "expert_execution"
    | "memory_load"
    | "dna_load"
    | "decision_time"
    | "builder_execution"
    | "retry"
    | "failure"
    | "cache_hit"
    | "cache_miss"
    | "queued";
  name: string;
  ms: number;
  ok: boolean;
  businessId?: string | null;
  meta?: Record<string, unknown>;
};

export type CostRecord = {
  at: string;
  requestId: string;
  expertId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Approximate USD */
  estimatedCostUsd: number;
  reusedReasoning: boolean;
};

export type AuditEntry = {
  at: string;
  action: string;
  actor: string;
  businessId: string | null;
  resource: string;
  allowed: boolean;
  detail: string;
};

export type DegradationResult = {
  continue: boolean;
  queued: boolean;
  provider: string;
  ownerMessage: string;
  internalReason: string;
  safeDefaults: Record<string, unknown>;
};

export type TrustScoreDimensions = {
  aiReliability: number;
  memoryIntegrity: number;
  decisionQuality: number;
  performance: number;
  expertSuccess: number;
  providerHealth: number;
};

export type HublyTrustScore = {
  overall: number;
  dimensions: TrustScoreDimensions;
  checkedAt: string;
  note: string;
};

export type ObservabilityDashboard = {
  aiLatencyMs: { avg: number; p95: number; samples: number };
  toolLatencyMs: { avg: number; p95: number; samples: number };
  expertExecutionMs: { avg: number; p95: number; samples: number };
  memoryLoadMs: { avg: number; p95: number; samples: number };
  decisionTimeMs: { avg: number; p95: number; samples: number };
  builderExecutionMs: { avg: number; p95: number; samples: number };
  failureRate: number;
  retryRate: number;
  cacheHitRate: number;
  samples: number;
};

/** Default timeouts (ms) — every expert / tool call is bounded. */
export const DEFAULT_TIMEOUTS = {
  expert: 8_000,
  tool: 5_000,
  weather: 3_000,
  stripe: 5_000,
  calendar: 5_000,
  memory: 2_000,
  dna: 2_000,
  ai: 20_000,
  decision: 3_000,
  builder: 15_000,
} as const;

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 1,
  baseDelayMs: 40,
  maxDelayMs: 400,
  retryOnTimeout: true,
};

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 15_000;

/** Rough $/1K tokens — planning estimates, not billing. */
const COST_PER_1K = {
  input: 0.003,
  output: 0.015,
} as const;

const metrics: ObservabilitySample[] = [];
const costs: CostRecord[] = [];
const audits: AuditEntry[] = [];
const circuits = new Map<string, {
  failures: number;
  successes: number;
  state: CircuitState;
  openedAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
}>();

type CacheEntry<T> = { value: T; at: number; businessId: string };
const memoryCache = new Map<string, CacheEntry<unknown>>();
const dnaCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60_000;
const MAX_METRICS = 2_000;
const MAX_COSTS = 1_000;
const MAX_AUDITS = 1_000;

const queue: Array<{
  id: string;
  at: string;
  provider: string;
  action: string;
  businessId: string | null;
  ownerMessage: string;
  status: "queued" | "retrying" | "done" | "failed";
}> = [];

function nowIso(): string {
  return new Date().toISOString();
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Strip stack traces / provider internals from owner-facing text. */
export function ownerSafeError(err: unknown, fallback?: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const low = raw.toLowerCase();
  // Provider-specific messages first (even when the failure is a timeout).
  if (/stripe|payment intent|api_key/i.test(low)) {
    return fallback || "I couldn't reach payments just now — I queued that and will retry.";
  }
  if (/calendar|google/i.test(low)) {
    return fallback || "Calendar didn't respond in time — I'll continue and we can sync again shortly.";
  }
  if (/weather/i.test(low)) {
    return fallback || "Weather data is unavailable right now — I'll continue without it.";
  }
  if (/timeout|etimedout|aborterror/i.test(raw)) {
    return fallback || "That took longer than expected — I'll keep going with what I have.";
  }
  if (/openai|anthropic|rate limit|429|500|econnrefused|stack|at\s+\S+\.(ts|js):/i.test(raw)) {
    return fallback || "I hit a snag on that step — I'll continue with a safe approach.";
  }
  // Never leak stacks / paths
  if (/at\s+\S+\.(ts|js):\d+|\/workspace\/|\/supabase\//i.test(raw)) {
    return fallback || "Something went wrong on my side — I'm continuing safely.";
  }
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 160);
  return cleaned || fallback || "I'll continue with a safe default.";
}

export function estimateTokens(text: string): number {
  const s = String(text || "");
  // ~4 chars/token heuristic
  return Math.max(1, Math.ceil(s.length / 4));
}

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const cost =
    (Math.max(0, inputTokens) / 1000) * COST_PER_1K.input +
    (Math.max(0, outputTokens) / 1000) * COST_PER_1K.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

function pushMetric(sample: ObservabilitySample): void {
  metrics.push(sample);
  while (metrics.length > MAX_METRICS) metrics.shift();
}

export function recordMetric(
  kind: ObservabilitySample["kind"],
  name: string,
  ms: number,
  ok = true,
  meta?: Record<string, unknown>,
  businessId?: string | null,
): ObservabilitySample {
  const sample: ObservabilitySample = {
    at: nowIso(),
    kind,
    name,
    ms: Math.max(0, Math.round(ms)),
    ok,
    businessId: businessId ?? null,
    meta,
  };
  pushMetric(sample);
  return sample;
}

export function recordAiCost(opts: {
  requestId?: string;
  expertId: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  prompt?: string;
  completion?: string;
  reusedReasoning?: boolean;
}): CostRecord {
  const inputTokens = opts.inputTokens ?? estimateTokens(opts.prompt || "");
  const outputTokens = opts.outputTokens ?? estimateTokens(opts.completion || "");
  const rec: CostRecord = {
    at: nowIso(),
    requestId: opts.requestId || `cost_${Date.now().toString(36)}`,
    expertId: opts.expertId,
    model: opts.model || "hubly_brain",
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: opts.reusedReasoning ? 0 : estimateCostUsd(inputTokens, outputTokens),
    reusedReasoning: !!opts.reusedReasoning,
  };
  costs.push(rec);
  while (costs.length > MAX_COSTS) costs.shift();
  return rec;
}

export function auditAiAction(opts: {
  action: string;
  actor?: string;
  businessId?: string | null;
  resource: string;
  allowed: boolean;
  detail?: string;
}): AuditEntry {
  const entry: AuditEntry = {
    at: nowIso(),
    action: opts.action,
    actor: opts.actor || RELIABILITY_OWNER,
    businessId: opts.businessId ?? null,
    resource: opts.resource,
    allowed: !!opts.allowed,
    detail: opts.detail || "",
  };
  audits.push(entry);
  while (audits.length > MAX_AUDITS) audits.shift();
  return entry;
}

function getCircuitInternal(provider: string) {
  let c = circuits.get(provider);
  if (!c) {
    c = {
      failures: 0,
      successes: 0,
      state: "closed",
      openedAt: null,
      lastFailureAt: null,
      lastError: null,
    };
    circuits.set(provider, c);
  }
  // Cooldown → half_open
  if (c.state === "open" && c.openedAt && Date.now() - c.openedAt >= CIRCUIT_COOLDOWN_MS) {
    c.state = "half_open";
  }
  return c;
}

export function circuitAllow(provider: HublyProviderId | string): boolean {
  const c = getCircuitInternal(String(provider));
  if (c.state === "open") return false;
  return true;
}

export function circuitSuccess(provider: HublyProviderId | string): void {
  const c = getCircuitInternal(String(provider));
  c.successes += 1;
  c.failures = 0;
  c.state = "closed";
  c.openedAt = null;
  c.lastError = null;
}

export function circuitFailure(provider: HublyProviderId | string, err?: unknown): void {
  const c = getCircuitInternal(String(provider));
  c.failures += 1;
  c.lastFailureAt = Date.now();
  c.lastError = ownerSafeError(err, "provider failure");
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD || c.state === "half_open") {
    c.state = "open";
    c.openedAt = Date.now();
  }
}

export function getCircuitSnapshot(provider?: string): CircuitBreakerSnapshot[] {
  const ids = provider ? [provider] : [...circuits.keys()];
  return ids.map((id) => {
    const c = getCircuitInternal(id);
    return {
      provider: id,
      state: c.state,
      failures: c.failures,
      successes: c.successes,
      openedAt: c.openedAt ? new Date(c.openedAt).toISOString() : null,
      lastFailureAt: c.lastFailureAt ? new Date(c.lastFailureAt).toISOString() : null,
      lastError: c.lastError,
    };
  });
}

export async function withTimeout<T>(
  work: Promise<T> | (() => Promise<T>),
  timeoutMs: number,
  label = "operation",
): Promise<T> {
  const ms = Math.max(1, timeoutMs);
  const promise = typeof work === "function" ? work() : work;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  opts?: { label?: string; provider?: string; onRetry?: (attempt: number, err: unknown) => void },
): Promise<{ value: T; attempts: number; retries: number }> {
  const label = opts?.label || "operation";
  const provider = opts?.provider || "hubly_brain";
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    if (!circuitAllow(provider)) {
      throw new Error(`${provider} circuit open — degrading`);
    }
    try {
      const value = await fn(attempt);
      circuitSuccess(provider);
      return { value, attempts: attempt + 1, retries: attempt };
    } catch (err) {
      lastErr = err;
      circuitFailure(provider, err);
      const isTimeout = /timed out/i.test(String((err as Error)?.message || err));
      const canRetry = attempt < policy.maxRetries && (!isTimeout || policy.retryOnTimeout);
      recordMetric("retry", label, 0, false, { attempt, error: ownerSafeError(err) });
      opts?.onRetry?.(attempt, err);
      if (!canRetry) break;
      const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  recordMetric("failure", label, 0, false, { error: ownerSafeError(lastErr) });
  throw lastErr instanceof Error ? lastErr : new Error(ownerSafeError(lastErr));
}

/** Safe defaults when a provider is unavailable. */
export function safeDefaultsFor(provider: HublyProviderId | string): Record<string, unknown> {
  switch (String(provider)) {
    case "weather":
      return { weatherAvailable: false, suggestion: "continue_without_weather" };
    case "stripe":
      return { paymentsAvailable: false, queued: true };
    case "google_calendar":
      return { calendarAvailable: false, syncLater: true };
    case "openai":
    case "anthropic":
      return { modelAvailable: false, useCachedReasoning: true };
    default:
      return { degraded: true };
  }
}

export function gracefulDegrade(
  provider: HublyProviderId | string,
  err: unknown,
  opts?: { queueAction?: string; businessId?: string | null },
): DegradationResult {
  const internalReason = String((err as Error)?.message || err || "unknown");
  const ownerMessage = ownerSafeError(err);
  const shouldQueue = /stripe|payment|calendar/i.test(String(provider)) || !!opts?.queueAction;
  let queued = false;
  if (shouldQueue) {
    queue.push({
      id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      at: nowIso(),
      provider: String(provider),
      action: opts?.queueAction || "retry_later",
      businessId: opts?.businessId ?? null,
      ownerMessage,
      status: "queued",
    });
    queued = true;
    recordMetric("queued", String(provider), 0, true, { action: opts?.queueAction });
  }
  auditAiAction({
    action: "graceful_degrade",
    businessId: opts?.businessId,
    resource: String(provider),
    allowed: true,
    detail: ownerMessage,
  });
  return {
    continue: true,
    queued,
    provider: String(provider),
    ownerMessage,
    internalReason: internalReason.slice(0, 240),
    safeDefaults: safeDefaultsFor(provider),
  };
}

export function listQueuedWork() {
  return queue.map((q) => ({ ...q }));
}

/** Memory / DNA caches — keyed by businessId (isolation). */
export function cacheMemoryGet<T = unknown>(businessId: string): T | null {
  const key = String(businessId || "");
  const hit = memoryCache.get(key);
  if (!hit) {
    recordMetric("cache_miss", "business_memory", 0, true, { businessId: key });
    return null;
  }
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    memoryCache.delete(key);
    recordMetric("cache_miss", "business_memory", 0, true, { businessId: key, reason: "ttl" });
    return null;
  }
  recordMetric("cache_hit", "business_memory", 0, true, { businessId: key });
  return hit.value as T;
}

export function cacheMemorySet(businessId: string, value: unknown): void {
  const key = String(businessId || "");
  if (!key) return;
  memoryCache.set(key, { value, at: Date.now(), businessId: key });
}

export function cacheDnaGet<T = unknown>(businessId: string): T | null {
  const key = String(businessId || "");
  const hit = dnaCache.get(key);
  if (!hit) {
    recordMetric("cache_miss", "business_dna", 0, true, { businessId: key });
    return null;
  }
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    dnaCache.delete(key);
    recordMetric("cache_miss", "business_dna", 0, true, { businessId: key, reason: "ttl" });
    return null;
  }
  recordMetric("cache_hit", "business_dna", 0, true, { businessId: key });
  return hit.value as T;
}

export function cacheDnaSet(businessId: string, value: unknown): void {
  const key = String(businessId || "");
  if (!key) return;
  dnaCache.set(key, { value, at: Date.now(), businessId: key });
}

/**
 * Run independent experts in parallel; assemble results in declared order.
 * Experience Director must never run inside a parallel wave (always last / serial).
 */
export async function runExpertsParallel<T extends { expertId: string; ms?: number }>(
  tasks: Array<{ expertId: string; run: () => Promise<T>; timeoutMs?: number }>,
): Promise<{ results: T[]; parallel: true; wallMs: number; slowestMs: number }> {
  if (tasks.some((t) => t.expertId === "experience_director")) {
    throw new Error("Experience Director must not run in parallel waves");
  }
  const t0 = Date.now();
  const settled = await Promise.all(
    tasks.map(async (t) => {
      const started = Date.now();
      try {
        const value = await withTimeout(
          t.run(),
          t.timeoutMs ?? DEFAULT_TIMEOUTS.expert,
          `expert:${t.expertId}`,
        );
        const ms = Date.now() - started;
        recordMetric("expert_execution", t.expertId, ms, true);
        return { ok: true as const, value, expertId: t.expertId, ms };
      } catch (err) {
        const ms = Date.now() - started;
        recordMetric("expert_execution", t.expertId, ms, false, { error: ownerSafeError(err) });
        return {
          ok: false as const,
          expertId: t.expertId,
          ms,
          error: ownerSafeError(err),
          value: {
            expertId: t.expertId,
            ms,
            ok: false,
            status: "failed",
            summary: ownerSafeError(err),
          } as unknown as T,
        };
      }
    }),
  );
  const wallMs = Date.now() - t0;
  const results = settled.map((s) => s.value);
  const slowestMs = Math.max(0, ...settled.map((s) => s.ms));
  return { results, parallel: true, wallMs, slowestMs };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function p95(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}

function kindStats(kind: ObservabilitySample["kind"]) {
  const rows = metrics.filter((m) => m.kind === kind);
  const ms = rows.map((r) => r.ms);
  return { avg: avg(ms), p95: p95(ms), samples: rows.length };
}

export function getObservabilityDashboard(): ObservabilityDashboard {
  const retries = metrics.filter((m) => m.kind === "retry").length;
  const failures = metrics.filter((m) => m.kind === "failure" || (m.kind === "expert_execution" && !m.ok)).length;
  const cacheHits = metrics.filter((m) => m.kind === "cache_hit").length;
  const cacheMiss = metrics.filter((m) => m.kind === "cache_miss").length;
  const ops = Math.max(1, metrics.filter((m) =>
    ["expert_execution", "tool_latency", "ai_latency", "failure", "retry"].includes(m.kind),
  ).length);
  return {
    aiLatencyMs: kindStats("ai_latency"),
    toolLatencyMs: kindStats("tool_latency"),
    expertExecutionMs: kindStats("expert_execution"),
    memoryLoadMs: kindStats("memory_load"),
    decisionTimeMs: kindStats("decision_time"),
    builderExecutionMs: kindStats("builder_execution"),
    failureRate: clampPct((failures / ops) * 100),
    retryRate: clampPct((retries / ops) * 100),
    cacheHitRate: clampPct((cacheHits / Math.max(1, cacheHits + cacheMiss)) * 100),
    samples: metrics.length,
  };
}

export function getCostReport() {
  const totalTokens = costs.reduce((a, c) => a + c.totalTokens, 0);
  const totalCost = costs.reduce((a, c) => a + c.estimatedCostUsd, 0);
  const byExpert = new Map<string, { expertId: string; tokens: number; costUsd: number; calls: number; reused: number }>();
  for (const c of costs) {
    const cur = byExpert.get(c.expertId) || {
      expertId: c.expertId,
      tokens: 0,
      costUsd: 0,
      calls: 0,
      reused: 0,
    };
    cur.tokens += c.totalTokens;
    cur.costUsd += c.estimatedCostUsd;
    cur.calls += 1;
    if (c.reusedReasoning) cur.reused += 1;
    byExpert.set(c.expertId, cur);
  }
  const expensive = [...byExpert.values()].sort((a, b) => b.costUsd - a.costUsd);
  return {
    requests: costs.length,
    totalTokens,
    estimatedCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
    avgCostPerRequest: costs.length ? Math.round((totalCost / costs.length) * 1_000_000) / 1_000_000 : 0,
    mostExpensiveExperts: expensive.slice(0, 5),
    reuseOpportunity: expensive.filter((e) => e.reused === 0 && e.calls >= 1).map((e) => e.expertId),
    recent: costs.slice(-10).map((c) => ({ ...c })),
  };
}

export function listAuditLog(limit = 50): AuditEntry[] {
  return audits.slice(-Math.max(1, limit)).map((a) => ({ ...a }));
}

/** Security — memory isolation between businesses. */
export function assertMemoryIsolation(businessIdA: string, businessIdB: string): {
  ok: boolean;
  detail: string;
} {
  const a = String(businessIdA || "");
  const b = String(businessIdB || "");
  if (!a || !b || a === b) {
    return { ok: false, detail: "Distinct business ids required" };
  }
  cacheMemorySet(a, { secret: `mem_${a}`, businessId: a });
  cacheMemorySet(b, { secret: `mem_${b}`, businessId: b });
  const gotA = cacheMemoryGet<{ secret: string; businessId: string }>(a);
  const gotB = cacheMemoryGet<{ secret: string; businessId: string }>(b);
  const ok =
    !!gotA &&
    !!gotB &&
    gotA.businessId === a &&
    gotB.businessId === b &&
    gotA.secret !== gotB.secret &&
    !String(gotA.secret).includes(b) &&
    !String(gotB.secret).includes(a);
  auditAiAction({
    action: "memory_isolation_check",
    businessId: a,
    resource: "business_memory",
    allowed: ok,
    detail: ok ? "isolated" : "leak_detected",
  });
  return { ok, detail: ok ? "Memory caches are isolated per businessId" : "Isolation failed" };
}

const EXPERT_TOOL_PERMISSIONS: Record<string, string[]> = {
  research: ["weather", "knowledge"],
  strategy: ["booking", "website"],
  creative_director: ["website", "brand"],
  critic: [],
  experience_director: [],
  builder: ["website", "booking", "packages"],
};

export function assertExpertPermission(expertId: string, toolId: string): {
  ok: boolean;
  detail: string;
} {
  const allowed = EXPERT_TOOL_PERMISSIONS[expertId];
  // Unknown experts: deny by default (capability access control)
  if (!allowed) {
    auditAiAction({
      action: "expert_permission",
      resource: `${expertId}→${toolId}`,
      allowed: false,
      detail: "unknown_expert_denied",
    });
    return { ok: false, detail: `Expert ${expertId} is not permitted (unknown)` };
  }
  const ok = allowed.includes(toolId) || allowed.length === 0 && toolId === "";
  // critic / ED have empty allow-list → no tool writes
  const permitted = allowed.length === 0 ? false : allowed.includes(toolId);
  auditAiAction({
    action: "expert_permission",
    resource: `${expertId}→${toolId}`,
    allowed: permitted,
    detail: permitted ? "allowed" : "denied",
  });
  return {
    ok: permitted,
    detail: permitted
      ? `${expertId} may use ${toolId}`
      : `${expertId} cannot use ${toolId}`,
  };
}

export function assertToolPermission(toolId: string, capabilityId: string, access: "read" | "write"): {
  ok: boolean;
  detail: string;
} {
  // Knowledge-style tools: weather is read-only
  if (toolId === "weather" && access === "write") {
    auditAiAction({
      action: "tool_permission",
      resource: `${toolId}:${capabilityId}`,
      allowed: false,
      detail: "write_denied",
    });
    return { ok: false, detail: "Weather is read-only" };
  }
  auditAiAction({
    action: "tool_permission",
    resource: `${toolId}:${capabilityId}`,
    allowed: true,
    detail: access,
  });
  return { ok: true, detail: `${toolId}/${capabilityId} ${access} allowed` };
}

export function assertCapabilityAccess(
  businessId: string,
  capabilityId: string,
  opts?: { ownerBusinessId?: string },
): { ok: boolean; detail: string } {
  const owner = opts?.ownerBusinessId ?? businessId;
  const ok = String(businessId) === String(owner) && !!capabilityId;
  auditAiAction({
    action: "capability_access",
    businessId,
    resource: capabilityId,
    allowed: ok,
    detail: ok ? "same_business" : "cross_business_denied",
  });
  return {
    ok,
    detail: ok
      ? "Capability access granted for owning business"
      : "Cross-business capability access denied",
  };
}

/**
 * Hubly Trust Score — engineering signal for Mission Control (not customer-facing).
 */
export function computeTrustScore(opts?: {
  aiHealthOkRate?: number | null;
  avgDecisionScore?: number | null;
  avgLatencyMs?: number | null;
}): HublyTrustScore {
  const obs = getObservabilityDashboard();
  const circuitRows = getCircuitSnapshot();
  const openCircuits = circuitRows.filter((c) => c.state === "open").length;
  const providerHealth = circuitRows.length
    ? clampPct(100 - (openCircuits / circuitRows.length) * 100)
    : 96;

  const expertRows = metrics.filter((m) => m.kind === "expert_execution");
  const expertOk = expertRows.filter((m) => m.ok).length;
  const expertSuccess = expertRows.length
    ? clampPct((expertOk / expertRows.length) * 100)
    : 99;

  const aiReliability = clampPct(
    opts?.aiHealthOkRate != null
      ? opts.aiHealthOkRate
      : 100 - obs.failureRate * 0.6,
  );

  const memAudits = audits.filter((a) => a.action === "memory_isolation_check");
  const memoryIntegrity = memAudits.length
    ? clampPct((memAudits.filter((a) => a.allowed).length / memAudits.length) * 100)
    : 100;

  const decisionQuality = clampPct(opts?.avgDecisionScore ?? 97);

  // Performance: reward low latency (<2s avg expert) and cache hits
  const latencyPenalty = Math.min(25, Math.round((obs.expertExecutionMs.avg || 0) / 200));
  const performance = clampPct(95 - latencyPenalty + Math.min(5, Math.round(obs.cacheHitRate / 20)));

  const dimensions: TrustScoreDimensions = {
    aiReliability,
    memoryIntegrity,
    decisionQuality,
    performance,
    expertSuccess,
    providerHealth,
  };

  const values = Object.values(dimensions);
  const overall = clampPct(values.reduce((a, b) => a + b, 0) / values.length);

  return {
    overall,
    dimensions,
    checkedAt: nowIso(),
    note: "Engineering Trust Score — Mission Control only. Not shown to customers.",
  };
}

export function getReliabilityManifest() {
  return {
    version: RELIABILITY_VERSION,
    owner: RELIABILITY_OWNER,
    name: "Performance, Reliability & Resilience",
    timeouts: { ...DEFAULT_TIMEOUTS },
    retryPolicy: { ...DEFAULT_RETRY_POLICY },
    circuitBreaker: {
      failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
    },
    features: [
      "retry_logic",
      "timeouts",
      "circuit_breakers",
      "graceful_degradation",
      "provider_failover_ready",
      "safe_defaults",
      "parallel_experts",
      "memory_caching",
      "dna_caching",
      "latency_tracking",
      "cost_awareness",
      "security_boundaries",
      "trust_score",
      "mission_control_metrics",
    ],
  };
}

/* ─── Demonstration scenarios (Release Gate proofs) ─── */

export async function demoResearchExpertRetry(): Promise<{
  ok: boolean;
  retries: number;
  ownerMessage: string;
  exposedRawError: boolean;
}> {
  let attempts = 0;
  const { value, retries } = await withRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("OpenAI timeout stack at research.ts:12");
      return { summary: "Research recovered after retry" };
    },
    { ...DEFAULT_RETRY_POLICY, maxRetries: 1, baseDelayMs: 5 },
    { label: "research", provider: "openai" },
  );
  recordMetric("expert_execution", "research", 45, true, { demo: "retry" });
  recordAiCost({
    expertId: "research",
    prompt: "research pressure washing",
    completion: value.summary,
  });
  const ownerMessage = ownerSafeError("OpenAI timeout stack at research.ts:12");
  return {
    ok: true,
    retries,
    ownerMessage,
    exposedRawError: /stack at research/i.test(ownerMessage),
  };
}

export async function demoWeatherTimeout(): Promise<{
  ok: boolean;
  continued: boolean;
  ownerMessage: string;
  safeDefaults: Record<string, unknown>;
}> {
  try {
    await withTimeout(
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        return "sunny";
      },
      20,
      "weather",
    );
    return { ok: false, continued: false, ownerMessage: "", safeDefaults: {} };
  } catch (err) {
    circuitFailure("weather", err);
    const deg = gracefulDegrade("weather", err);
    recordMetric("tool_latency", "weather", 20, false, { timeout: true });
    return {
      ok: true,
      continued: deg.continue,
      ownerMessage: deg.ownerMessage,
      safeDefaults: deg.safeDefaults,
    };
  }
}

export async function demoStripeQueue(): Promise<{
  ok: boolean;
  queued: boolean;
  ownerMessage: string;
  queueSize: number;
}> {
  circuitFailure("stripe", new Error("Stripe API 503"));
  circuitFailure("stripe", new Error("Stripe API 503"));
  circuitFailure("stripe", new Error("Stripe API 503"));
  const deg = gracefulDegrade("stripe", new Error("Stripe lookup failed: api_key sk_test_xxx"), {
    queueAction: "refresh_stripe_balance",
    businessId: "biz_demo_stripe",
  });
  recordMetric("tool_latency", "stripe", 120, false);
  return {
    ok: deg.queued && deg.continue,
    queued: deg.queued,
    ownerMessage: deg.ownerMessage,
    queueSize: listQueuedWork().length,
  };
}

export async function demoParallelExperts(): Promise<{
  ok: boolean;
  wallMs: number;
  slowestMs: number;
  order: string[];
  parallelFasterThanSerial: boolean;
}> {
  const tasks = [
    {
      expertId: "research",
      timeoutMs: 500,
      run: async () => {
        await new Promise((r) => setTimeout(r, 60));
        return { expertId: "research", ms: 60, summary: "research ok" };
      },
    },
    {
      expertId: "strategy",
      timeoutMs: 500,
      run: async () => {
        await new Promise((r) => setTimeout(r, 120));
        return { expertId: "strategy", ms: 120, summary: "strategy ok" };
      },
    },
    {
      expertId: "creative_director",
      timeoutMs: 500,
      run: async () => {
        await new Promise((r) => setTimeout(r, 40));
        return { expertId: "creative_director", ms: 40, summary: "creative ok" };
      },
    },
  ];
  const { results, wallMs, slowestMs } = await runExpertsParallel(tasks);
  const serialEstimate = 60 + 120 + 40;
  return {
    ok: results.length === 3 && results.every((r) => r.expertId),
    wallMs,
    slowestMs,
    order: results.map((r) => r.expertId),
    parallelFasterThanSerial: wallMs < serialEstimate - 20,
  };
}

export function clearReliabilityForTests(): void {
  metrics.length = 0;
  costs.length = 0;
  audits.length = 0;
  circuits.clear();
  memoryCache.clear();
  dnaCache.clear();
  queue.length = 0;
}

export const HublyReliability = {
  version: RELIABILITY_VERSION,
  owner: RELIABILITY_OWNER,
  timeouts: DEFAULT_TIMEOUTS,
  retryPolicy: DEFAULT_RETRY_POLICY,
  ownerSafeError,
  withTimeout,
  withRetry,
  circuitAllow,
  circuitSuccess,
  circuitFailure,
  getCircuitSnapshot,
  gracefulDegrade,
  safeDefaultsFor,
  listQueuedWork,
  cacheMemoryGet,
  cacheMemorySet,
  cacheDnaGet,
  cacheDnaSet,
  runExpertsParallel,
  recordMetric,
  recordAiCost,
  estimateTokens,
  estimateCostUsd,
  getObservabilityDashboard,
  getCostReport,
  auditAiAction,
  listAuditLog,
  assertMemoryIsolation,
  assertExpertPermission,
  assertToolPermission,
  assertCapabilityAccess,
  computeTrustScore,
  manifest: getReliabilityManifest,
  demos: {
    researchRetry: demoResearchExpertRetry,
    weatherTimeout: demoWeatherTimeout,
    stripeQueue: demoStripeQueue,
    parallelExperts: demoParallelExperts,
  },
  clearForTests: clearReliabilityForTests,
};

export default HublyReliability;
