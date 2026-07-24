/** Node mirror of hubly_brain_reliability.ts — Section 14 (esbuild). */


// supabase/functions/_shared/hubly_brain_reliability.ts
var RELIABILITY_VERSION = "1.0.0";
var RELIABILITY_OWNER = "hubly_brain";
var DEFAULT_TIMEOUTS = {
  expert: 8e3,
  tool: 5e3,
  weather: 3e3,
  stripe: 5e3,
  calendar: 5e3,
  memory: 2e3,
  dna: 2e3,
  ai: 2e4,
  decision: 3e3,
  builder: 15e3
};
var DEFAULT_RETRY_POLICY = {
  maxRetries: 1,
  baseDelayMs: 40,
  maxDelayMs: 400,
  retryOnTimeout: true
};
var CIRCUIT_FAILURE_THRESHOLD = 3;
var CIRCUIT_COOLDOWN_MS = 15e3;
var COST_PER_1K = {
  input: 3e-3,
  output: 0.015
};
var metrics = [];
var costs = [];
var audits = [];
var circuits = /* @__PURE__ */ new Map();
var memoryCache = /* @__PURE__ */ new Map();
var dnaCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 6e4;
var MAX_METRICS = 2e3;
var MAX_COSTS = 1e3;
var MAX_AUDITS = 1e3;
var queue = [];
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function ownerSafeError(err, fallback) {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const low = raw.toLowerCase();
  if (/stripe|payment intent|api_key/i.test(low)) {
    return fallback || "I couldn't reach payments just now \u2014 I queued that and will retry.";
  }
  if (/calendar|google/i.test(low)) {
    return fallback || "Calendar didn't respond in time \u2014 I'll continue and we can sync again shortly.";
  }
  if (/weather/i.test(low)) {
    return fallback || "Weather data is unavailable right now \u2014 I'll continue without it.";
  }
  if (/timeout|etimedout|aborterror/i.test(raw)) {
    return fallback || "That took longer than expected \u2014 I'll keep going with what I have.";
  }
  if (/openai|anthropic|rate limit|429|500|econnrefused|stack|at\s+\S+\.(ts|js):/i.test(raw)) {
    return fallback || "I hit a snag on that step \u2014 I'll continue with a safe approach.";
  }
  if (/at\s+\S+\.(ts|js):\d+|\/workspace\/|\/supabase\//i.test(raw)) {
    return fallback || "Something went wrong on my side \u2014 I'm continuing safely.";
  }
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 160);
  return cleaned || fallback || "I'll continue with a safe default.";
}
function estimateTokens(text) {
  const s = String(text || "");
  return Math.max(1, Math.ceil(s.length / 4));
}
function estimateCostUsd(inputTokens, outputTokens) {
  const cost = Math.max(0, inputTokens) / 1e3 * COST_PER_1K.input + Math.max(0, outputTokens) / 1e3 * COST_PER_1K.output;
  return Math.round(cost * 1e6) / 1e6;
}
function pushMetric(sample) {
  metrics.push(sample);
  while (metrics.length > MAX_METRICS) metrics.shift();
}
function recordMetric(kind, name, ms, ok = true, meta, businessId) {
  const sample = {
    at: nowIso(),
    kind,
    name,
    ms: Math.max(0, Math.round(ms)),
    ok,
    businessId: businessId ?? null,
    meta
  };
  pushMetric(sample);
  return sample;
}
function recordAiCost(opts) {
  const inputTokens = opts.inputTokens ?? estimateTokens(opts.prompt || "");
  const outputTokens = opts.outputTokens ?? estimateTokens(opts.completion || "");
  const rec = {
    at: nowIso(),
    requestId: opts.requestId || `cost_${Date.now().toString(36)}`,
    expertId: opts.expertId,
    model: opts.model || "hubly_brain",
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: opts.reusedReasoning ? 0 : estimateCostUsd(inputTokens, outputTokens),
    reusedReasoning: !!opts.reusedReasoning
  };
  costs.push(rec);
  while (costs.length > MAX_COSTS) costs.shift();
  return rec;
}
function auditAiAction(opts) {
  const entry = {
    at: nowIso(),
    action: opts.action,
    actor: opts.actor || RELIABILITY_OWNER,
    businessId: opts.businessId ?? null,
    resource: opts.resource,
    allowed: !!opts.allowed,
    detail: opts.detail || ""
  };
  audits.push(entry);
  while (audits.length > MAX_AUDITS) audits.shift();
  return entry;
}
function getCircuitInternal(provider) {
  let c = circuits.get(provider);
  if (!c) {
    c = {
      failures: 0,
      successes: 0,
      state: "closed",
      openedAt: null,
      lastFailureAt: null,
      lastError: null
    };
    circuits.set(provider, c);
  }
  if (c.state === "open" && c.openedAt && Date.now() - c.openedAt >= CIRCUIT_COOLDOWN_MS) {
    c.state = "half_open";
  }
  return c;
}
function circuitAllow(provider) {
  const c = getCircuitInternal(String(provider));
  if (c.state === "open") return false;
  return true;
}
function circuitSuccess(provider) {
  const c = getCircuitInternal(String(provider));
  c.successes += 1;
  c.failures = 0;
  c.state = "closed";
  c.openedAt = null;
  c.lastError = null;
}
function circuitFailure(provider, err) {
  const c = getCircuitInternal(String(provider));
  c.failures += 1;
  c.lastFailureAt = Date.now();
  c.lastError = ownerSafeError(err, "provider failure");
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD || c.state === "half_open") {
    c.state = "open";
    c.openedAt = Date.now();
  }
}
function getCircuitSnapshot(provider) {
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
      lastError: c.lastError
    };
  });
}
async function withTimeout(work, timeoutMs, label = "operation") {
  const ms = Math.max(1, timeoutMs);
  const promise = typeof work === "function" ? work() : work;
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function withRetry(fn, policy = DEFAULT_RETRY_POLICY, opts) {
  const label = opts?.label || "operation";
  const provider = opts?.provider || "hubly_brain";
  let lastErr = null;
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    if (!circuitAllow(provider)) {
      throw new Error(`${provider} circuit open \u2014 degrading`);
    }
    try {
      const value = await fn(attempt);
      circuitSuccess(provider);
      return { value, attempts: attempt + 1, retries: attempt };
    } catch (err) {
      lastErr = err;
      circuitFailure(provider, err);
      const isTimeout = /timed out/i.test(String(err?.message || err));
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
function safeDefaultsFor(provider) {
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
function gracefulDegrade(provider, err, opts) {
  const internalReason = String(err?.message || err || "unknown");
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
      status: "queued"
    });
    queued = true;
    recordMetric("queued", String(provider), 0, true, { action: opts?.queueAction });
  }
  auditAiAction({
    action: "graceful_degrade",
    businessId: opts?.businessId,
    resource: String(provider),
    allowed: true,
    detail: ownerMessage
  });
  return {
    continue: true,
    queued,
    provider: String(provider),
    ownerMessage,
    internalReason: internalReason.slice(0, 240),
    safeDefaults: safeDefaultsFor(provider)
  };
}
function listQueuedWork() {
  return queue.map((q) => ({ ...q }));
}
function cacheMemoryGet(businessId) {
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
  return hit.value;
}
function cacheMemorySet(businessId, value) {
  const key = String(businessId || "");
  if (!key) return;
  memoryCache.set(key, { value, at: Date.now(), businessId: key });
}
function cacheDnaGet(businessId) {
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
  return hit.value;
}
function cacheDnaSet(businessId, value) {
  const key = String(businessId || "");
  if (!key) return;
  dnaCache.set(key, { value, at: Date.now(), businessId: key });
}
async function runExpertsParallel(tasks) {
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
          `expert:${t.expertId}`
        );
        const ms = Date.now() - started;
        recordMetric("expert_execution", t.expertId, ms, true);
        return { ok: true, value, expertId: t.expertId, ms };
      } catch (err) {
        const ms = Date.now() - started;
        recordMetric("expert_execution", t.expertId, ms, false, { error: ownerSafeError(err) });
        return {
          ok: false,
          expertId: t.expertId,
          ms,
          error: ownerSafeError(err),
          value: {
            expertId: t.expertId,
            ms,
            ok: false,
            status: "failed",
            summary: ownerSafeError(err)
          }
        };
      }
    })
  );
  const wallMs = Date.now() - t0;
  const results = settled.map((s) => s.value);
  const slowestMs = Math.max(0, ...settled.map((s) => s.ms));
  return { results, parallel: true, wallMs, slowestMs };
}
function avg(nums) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
function p95(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}
function kindStats(kind) {
  const rows = metrics.filter((m) => m.kind === kind);
  const ms = rows.map((r) => r.ms);
  return { avg: avg(ms), p95: p95(ms), samples: rows.length };
}
function getObservabilityDashboard() {
  const retries = metrics.filter((m) => m.kind === "retry").length;
  const failures = metrics.filter((m) => m.kind === "failure" || m.kind === "expert_execution" && !m.ok).length;
  const cacheHits = metrics.filter((m) => m.kind === "cache_hit").length;
  const cacheMiss = metrics.filter((m) => m.kind === "cache_miss").length;
  const ops = Math.max(1, metrics.filter(
    (m) => ["expert_execution", "tool_latency", "ai_latency", "failure", "retry"].includes(m.kind)
  ).length);
  return {
    aiLatencyMs: kindStats("ai_latency"),
    toolLatencyMs: kindStats("tool_latency"),
    expertExecutionMs: kindStats("expert_execution"),
    memoryLoadMs: kindStats("memory_load"),
    decisionTimeMs: kindStats("decision_time"),
    builderExecutionMs: kindStats("builder_execution"),
    failureRate: clampPct(failures / ops * 100),
    retryRate: clampPct(retries / ops * 100),
    cacheHitRate: clampPct(cacheHits / Math.max(1, cacheHits + cacheMiss) * 100),
    samples: metrics.length
  };
}
function getCostReport() {
  const totalTokens = costs.reduce((a, c) => a + c.totalTokens, 0);
  const totalCost = costs.reduce((a, c) => a + c.estimatedCostUsd, 0);
  const byExpert = /* @__PURE__ */ new Map();
  for (const c of costs) {
    const cur = byExpert.get(c.expertId) || {
      expertId: c.expertId,
      tokens: 0,
      costUsd: 0,
      calls: 0,
      reused: 0
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
    estimatedCostUsd: Math.round(totalCost * 1e6) / 1e6,
    avgCostPerRequest: costs.length ? Math.round(totalCost / costs.length * 1e6) / 1e6 : 0,
    mostExpensiveExperts: expensive.slice(0, 5),
    reuseOpportunity: expensive.filter((e) => e.reused === 0 && e.calls >= 1).map((e) => e.expertId),
    recent: costs.slice(-10).map((c) => ({ ...c }))
  };
}
function listAuditLog(limit = 50) {
  return audits.slice(-Math.max(1, limit)).map((a) => ({ ...a }));
}
function assertMemoryIsolation(businessIdA, businessIdB) {
  const a = String(businessIdA || "");
  const b = String(businessIdB || "");
  if (!a || !b || a === b) {
    return { ok: false, detail: "Distinct business ids required" };
  }
  cacheMemorySet(a, { secret: `mem_${a}`, businessId: a });
  cacheMemorySet(b, { secret: `mem_${b}`, businessId: b });
  const gotA = cacheMemoryGet(a);
  const gotB = cacheMemoryGet(b);
  const ok = !!gotA && !!gotB && gotA.businessId === a && gotB.businessId === b && gotA.secret !== gotB.secret && !String(gotA.secret).includes(b) && !String(gotB.secret).includes(a);
  auditAiAction({
    action: "memory_isolation_check",
    businessId: a,
    resource: "business_memory",
    allowed: ok,
    detail: ok ? "isolated" : "leak_detected"
  });
  return { ok, detail: ok ? "Memory caches are isolated per businessId" : "Isolation failed" };
}
var EXPERT_TOOL_PERMISSIONS = {
  research: ["weather", "knowledge"],
  strategy: ["booking", "website"],
  creative_director: ["website", "brand"],
  critic: [],
  experience_director: [],
  builder: ["website", "booking", "packages"]
};
function assertExpertPermission(expertId, toolId) {
  const allowed = EXPERT_TOOL_PERMISSIONS[expertId];
  if (!allowed) {
    auditAiAction({
      action: "expert_permission",
      resource: `${expertId}\u2192${toolId}`,
      allowed: false,
      detail: "unknown_expert_denied"
    });
    return { ok: false, detail: `Expert ${expertId} is not permitted (unknown)` };
  }
  const ok = allowed.includes(toolId) || allowed.length === 0 && toolId === "";
  const permitted = allowed.length === 0 ? false : allowed.includes(toolId);
  auditAiAction({
    action: "expert_permission",
    resource: `${expertId}\u2192${toolId}`,
    allowed: permitted,
    detail: permitted ? "allowed" : "denied"
  });
  return {
    ok: permitted,
    detail: permitted ? `${expertId} may use ${toolId}` : `${expertId} cannot use ${toolId}`
  };
}
function assertToolPermission(toolId, capabilityId, access) {
  if (toolId === "weather" && access === "write") {
    auditAiAction({
      action: "tool_permission",
      resource: `${toolId}:${capabilityId}`,
      allowed: false,
      detail: "write_denied"
    });
    return { ok: false, detail: "Weather is read-only" };
  }
  auditAiAction({
    action: "tool_permission",
    resource: `${toolId}:${capabilityId}`,
    allowed: true,
    detail: access
  });
  return { ok: true, detail: `${toolId}/${capabilityId} ${access} allowed` };
}
function assertCapabilityAccess(businessId, capabilityId, opts) {
  const owner = opts?.ownerBusinessId ?? businessId;
  const ok = String(businessId) === String(owner) && !!capabilityId;
  auditAiAction({
    action: "capability_access",
    businessId,
    resource: capabilityId,
    allowed: ok,
    detail: ok ? "same_business" : "cross_business_denied"
  });
  return {
    ok,
    detail: ok ? "Capability access granted for owning business" : "Cross-business capability access denied"
  };
}
function computeTrustScore(opts) {
  const obs = getObservabilityDashboard();
  const circuitRows = getCircuitSnapshot();
  const openCircuits = circuitRows.filter((c) => c.state === "open").length;
  const providerHealth = circuitRows.length ? clampPct(100 - openCircuits / circuitRows.length * 100) : 96;
  const expertRows = metrics.filter((m) => m.kind === "expert_execution");
  const expertOk = expertRows.filter((m) => m.ok).length;
  const expertSuccess = expertRows.length ? clampPct(expertOk / expertRows.length * 100) : 99;
  const aiReliability = clampPct(
    opts?.aiHealthOkRate != null ? opts.aiHealthOkRate : 100 - obs.failureRate * 0.6
  );
  const memAudits = audits.filter((a) => a.action === "memory_isolation_check");
  const memoryIntegrity = memAudits.length ? clampPct(memAudits.filter((a) => a.allowed).length / memAudits.length * 100) : 100;
  const decisionQuality = clampPct(opts?.avgDecisionScore ?? 97);
  const latencyPenalty = Math.min(25, Math.round((obs.expertExecutionMs.avg || 0) / 200));
  const performance = clampPct(95 - latencyPenalty + Math.min(5, Math.round(obs.cacheHitRate / 20)));
  const dimensions = {
    aiReliability,
    memoryIntegrity,
    decisionQuality,
    performance,
    expertSuccess,
    providerHealth
  };
  const values = Object.values(dimensions);
  const overall = clampPct(values.reduce((a, b) => a + b, 0) / values.length);
  return {
    overall,
    dimensions,
    checkedAt: nowIso(),
    note: "Engineering Trust Score \u2014 Mission Control only. Not shown to customers."
  };
}
function getReliabilityManifest() {
  return {
    version: RELIABILITY_VERSION,
    owner: RELIABILITY_OWNER,
    name: "Performance, Reliability & Resilience",
    timeouts: { ...DEFAULT_TIMEOUTS },
    retryPolicy: { ...DEFAULT_RETRY_POLICY },
    circuitBreaker: {
      failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
      cooldownMs: CIRCUIT_COOLDOWN_MS
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
      "mission_control_metrics"
    ]
  };
}
async function demoResearchExpertRetry() {
  let attempts = 0;
  const { value, retries } = await withRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("OpenAI timeout stack at research.ts:12");
      return { summary: "Research recovered after retry" };
    },
    { ...DEFAULT_RETRY_POLICY, maxRetries: 1, baseDelayMs: 5 },
    { label: "research", provider: "openai" }
  );
  recordMetric("expert_execution", "research", 45, true, { demo: "retry" });
  recordAiCost({
    expertId: "research",
    prompt: "research pressure washing",
    completion: value.summary
  });
  const ownerMessage = ownerSafeError("OpenAI timeout stack at research.ts:12");
  return {
    ok: true,
    retries,
    ownerMessage,
    exposedRawError: /stack at research/i.test(ownerMessage)
  };
}
async function demoWeatherTimeout() {
  try {
    await withTimeout(
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        return "sunny";
      },
      20,
      "weather"
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
      safeDefaults: deg.safeDefaults
    };
  }
}
async function demoStripeQueue() {
  circuitFailure("stripe", new Error("Stripe API 503"));
  circuitFailure("stripe", new Error("Stripe API 503"));
  circuitFailure("stripe", new Error("Stripe API 503"));
  const deg = gracefulDegrade("stripe", new Error("Stripe lookup failed: api_key sk_test_xxx"), {
    queueAction: "refresh_stripe_balance",
    businessId: "biz_demo_stripe"
  });
  recordMetric("tool_latency", "stripe", 120, false);
  return {
    ok: deg.queued && deg.continue,
    queued: deg.queued,
    ownerMessage: deg.ownerMessage,
    queueSize: listQueuedWork().length
  };
}
async function demoParallelExperts() {
  const tasks = [
    {
      expertId: "research",
      timeoutMs: 500,
      run: async () => {
        await new Promise((r) => setTimeout(r, 60));
        return { expertId: "research", ms: 60, summary: "research ok" };
      }
    },
    {
      expertId: "strategy",
      timeoutMs: 500,
      run: async () => {
        await new Promise((r) => setTimeout(r, 120));
        return { expertId: "strategy", ms: 120, summary: "strategy ok" };
      }
    },
    {
      expertId: "creative_director",
      timeoutMs: 500,
      run: async () => {
        await new Promise((r) => setTimeout(r, 40));
        return { expertId: "creative_director", ms: 40, summary: "creative ok" };
      }
    }
  ];
  const { results, wallMs, slowestMs } = await runExpertsParallel(tasks);
  const serialEstimate = 60 + 120 + 40;
  return {
    ok: results.length === 3 && results.every((r) => r.expertId),
    wallMs,
    slowestMs,
    order: results.map((r) => r.expertId),
    parallelFasterThanSerial: wallMs < serialEstimate - 20
  };
}
function clearReliabilityForTests() {
  metrics.length = 0;
  costs.length = 0;
  audits.length = 0;
  circuits.clear();
  memoryCache.clear();
  dnaCache.clear();
  queue.length = 0;
}
var HublyReliability = {
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
    parallelExperts: demoParallelExperts
  },
  clearForTests: clearReliabilityForTests
};
var hubly_brain_reliability_default = HublyReliability;
export {
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUTS,
  HublyReliability,
  RELIABILITY_OWNER,
  RELIABILITY_VERSION,
  assertCapabilityAccess,
  assertExpertPermission,
  assertMemoryIsolation,
  assertToolPermission,
  auditAiAction,
  cacheDnaGet,
  cacheDnaSet,
  cacheMemoryGet,
  cacheMemorySet,
  circuitAllow,
  circuitFailure,
  circuitSuccess,
  clearReliabilityForTests,
  computeTrustScore,
  hubly_brain_reliability_default as default,
  demoParallelExperts,
  demoResearchExpertRetry,
  demoStripeQueue,
  demoWeatherTimeout,
  estimateCostUsd,
  estimateTokens,
  getCircuitSnapshot,
  getCostReport,
  getObservabilityDashboard,
  getReliabilityManifest,
  gracefulDegrade,
  listAuditLog,
  listQueuedWork,
  ownerSafeError,
  recordAiCost,
  recordMetric,
  runExpertsParallel,
  safeDefaultsFor,
  withRetry,
  withTimeout
};
