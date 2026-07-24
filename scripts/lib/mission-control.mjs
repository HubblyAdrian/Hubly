/** Node mirror of hubly_brain_mission_control.ts — Section 12 + 14 (esbuild). */


// scripts/lib/reliability.mjs
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
var metrics = [];
var costs = [];
var audits = [];
var circuits = /* @__PURE__ */ new Map();
var queue = [];
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
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
function listQueuedWork() {
  return queue.map((q) => ({ ...q }));
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

// scripts/lib/expert-framework.mjs
var REGISTRY = /* @__PURE__ */ new Map();
function cloneDef(def) {
  return {
    ...def,
    responsibilities: [...def.responsibilities || []],
    inputs: [...def.inputs],
    outputs: [...def.outputs],
    requiredMemory: [...def.requiredMemory],
    allowedTools: [...def.allowedTools || def.capability.tools || []],
    allowedActions: [...def.allowedActions || def.capability.actions || []],
    capability: {
      can: [...def.capability.can],
      tools: [...def.capability.tools],
      reads: [...def.capability.reads],
      actions: [...def.capability.actions]
    },
    confidence: { ...def.confidence },
    reasoning: { ...def.reasoning, fields: [...def.reasoning.fields] },
    dependencies: [...def.dependencies || []],
    intents: def.intents ? [...def.intents] : null
  };
}
function listExperts() {
  return [...REGISTRY.values()].map((e) => cloneDef(e.def)).sort((a, b) => a.executionPriority - b.executionPriority || a.id.localeCompare(b.id));
}

// scripts/lib/registries.mjs
var TOOLS = /* @__PURE__ */ new Map();
var CAP_INDEX = /* @__PURE__ */ new Map();
var KNOWLEDGE = /* @__PURE__ */ new Map();
var BOOTSTRAPPED = false;
function cloneTool(t) {
  return {
    ...t,
    responsibilities: [...t.responsibilities],
    capabilities: t.capabilities.map((c) => ({ ...c, aliases: [...c.aliases] })),
    experts: t.experts ? [...t.experts] : []
  };
}
function cloneKnowledge(k) {
  return { ...k, domains: [...k.domains], aliases: [...k.aliases] };
}
function indexTool(tool) {
  for (const cap of tool.capabilities) {
    CAP_INDEX.set(cap.id, { toolId: tool.id, capabilityId: cap.id });
    for (const a of cap.aliases) {
      CAP_INDEX.set(normalizeKey(a), { toolId: tool.id, capabilityId: cap.id });
    }
  }
}
function normalizeKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function registerTool(def) {
  if (!def?.id) throw new Error("Tool registration requires id");
  if (!def.capabilities?.length) throw new Error(`Tool ${def.id} requires capabilities`);
  const normalized = {
    id: String(def.id),
    name: String(def.name || def.id),
    version: String(def.version || "1.0.0"),
    purpose: String(def.purpose || ""),
    responsibilities: [...def.responsibilities || []],
    capabilities: def.capabilities.map((c) => ({
      id: String(c.id),
      label: String(c.label || c.id),
      aliases: [...c.aliases || [], c.label, c.id].map(String)
    })),
    experts: def.experts ? [...def.experts] : [],
    category: def.category || "general"
  };
  TOOLS.set(normalized.id, normalized);
  indexTool(normalized);
  return cloneTool(normalized);
}
function listTools() {
  return [...TOOLS.values()].map(cloneTool);
}
function registerKnowledgeSource(def) {
  if (!def?.id) throw new Error("Knowledge source requires id");
  const normalized = {
    id: String(def.id),
    name: String(def.name || def.id),
    purpose: String(def.purpose || ""),
    source: String(def.source || def.name || def.id),
    access: def.access === "read" || def.access === "write" ? def.access : "read_write",
    domains: [...def.domains || []],
    aliases: [...def.aliases || [], def.name, def.id].map(String)
  };
  KNOWLEDGE.set(normalized.id, normalized);
  return cloneKnowledge(normalized);
}
function listKnowledgeSources() {
  return [...KNOWLEDGE.values()].map(cloneKnowledge);
}
function bootstrapDefaultRegistries() {
  if (BOOTSTRAPPED && TOOLS.size > 0 && KNOWLEDGE.size > 0) return;
  BOOTSTRAPPED = true;
  registerTool({
    id: "website_builder",
    name: "Website Builder",
    version: "1.0.0",
    purpose: "Own website structure, content, and publish actions",
    responsibilities: [
      "Update homepage layout and copy",
      "Change theme colors",
      "Add and remove sections",
      "Update hero",
      "Publish the live site"
    ],
    experts: ["creative_director", "strategy"],
    category: "builder",
    capabilities: [
      { id: "update_homepage", label: "Update Homepage", aliases: ["homepage", "rewrite homepage"] },
      { id: "change_colors", label: "Change Colors", aliases: ["colors", "theme colors"] },
      { id: "add_sections", label: "Add Sections", aliases: ["add section"] },
      { id: "remove_sections", label: "Remove Sections", aliases: ["remove section"] },
      { id: "update_hero", label: "Update Hero", aliases: ["hero", "hero image"] },
      { id: "publish_website", label: "Publish", aliases: ["publish", "go live", "publish website"] }
    ]
  });
  registerTool({
    id: "booking",
    name: "Booking",
    version: "1.0.0",
    purpose: "Own booking rules, availability, and calendar sync",
    responsibilities: [
      "Configure arrival windows",
      "Enforce booking rules",
      "Manage availability",
      "Sync calendars"
    ],
    experts: ["strategy"],
    category: "builder",
    capabilities: [
      { id: "arrival_windows", label: "Arrival Windows", aliases: ["arrival window", "arrival windows", "time windows"] },
      { id: "no_same_day_bookings", label: "No Same-Day Bookings", aliases: ["same-day", "same day bookings"] },
      { id: "booking_rules", label: "Booking Rules", aliases: ["booking rule"] },
      { id: "booking_availability", label: "Availability", aliases: ["booking availability"] },
      { id: "calendar_sync", label: "Calendar Sync", aliases: ["google calendar", "calendar sync"] }
    ]
  });
  registerTool({
    id: "crm",
    name: "CRM",
    version: "1.0.0",
    purpose: "Own customers, jobs, and CRM communications",
    responsibilities: [
      "Create and update jobs",
      "Update and merge customers",
      "Send email",
      "Archive customers"
    ],
    category: "builder",
    capabilities: [
      { id: "create_job", label: "Create Job", aliases: ["create job", "new job"] },
      { id: "update_customer", label: "Update Customer", aliases: ["update customer"] },
      { id: "send_email", label: "Send Email", aliases: ["email customer", "send email"] },
      { id: "merge_customers", label: "Merge Customers", aliases: ["merge customers"] },
      { id: "archive_customer", label: "Archive Customer", aliases: ["archive customer"] },
      { id: "reschedule_jobs", label: "Reschedule Jobs", aliases: ["reschedule", "reschedule jobs"] },
      { id: "send_text", label: "Send Text", aliases: ["text customers", "sms", "text the customers"] }
    ]
  });
  registerTool({
    id: "marketplace",
    name: "Marketplace",
    version: "1.0.0",
    purpose: "Own marketplace listing settings",
    responsibilities: ["Radius", "Pricing", "Availability", "Categories"],
    category: "builder",
    capabilities: [
      { id: "marketplace_radius", label: "Radius", aliases: ["service radius", "radius"] },
      { id: "marketplace_pricing", label: "Pricing", aliases: ["marketplace pricing"] },
      { id: "marketplace_availability", label: "Availability", aliases: ["marketplace availability"] },
      { id: "marketplace_categories", label: "Categories", aliases: ["marketplace categories"] }
    ]
  });
  registerTool({
    id: "automation",
    name: "Automation",
    version: "1.0.0",
    purpose: "Own workflows and automated reminders",
    responsibilities: [
      "Create / pause / delete workflows",
      "Send automated email and reminders"
    ],
    category: "builder",
    capabilities: [
      { id: "create_workflow", label: "Create Workflow", aliases: ["create workflow"] },
      { id: "delete_workflow", label: "Delete Workflow", aliases: ["delete workflow"] },
      { id: "pause_workflow", label: "Pause Workflow", aliases: ["pause workflow"] },
      { id: "automation_send_email", label: "Send Email", aliases: ["automation email"] },
      { id: "send_reminder", label: "Send Reminder", aliases: ["send reminder", "reminder"] }
    ]
  });
  registerTool({
    id: "portfolio_builder",
    name: "Portfolio Builder",
    version: "1.0.0",
    purpose: "Own portfolio galleries and photo placement",
    responsibilities: ["Upload portfolio photos", "Organize gallery"],
    category: "builder",
    capabilities: [
      { id: "upload_photos", label: "Upload Photos", aliases: ["upload photos", "portfolio photos"] },
      { id: "manage_gallery", label: "Manage Gallery", aliases: ["gallery"] }
    ]
  });
  registerTool({
    id: "image_processor",
    name: "Image Processor",
    version: "1.0.0",
    purpose: "Process and optimize images before publish",
    responsibilities: ["Process images", "Optimize photos"],
    category: "builder",
    capabilities: [
      { id: "process_images", label: "Process Images", aliases: ["process images", "image processor"] },
      { id: "optimize_photos", label: "Optimize Photos", aliases: ["optimize photos"] }
    ]
  });
  registerKnowledgeSource({
    id: "weather",
    name: "Weather",
    purpose: "Forecast and conditions for scheduling decisions",
    source: "Weather Provider",
    access: "read",
    domains: ["weather", "forecast", "rain"],
    aliases: ["weather", "forecast", "rain"]
  });
  registerKnowledgeSource({
    id: "stripe",
    name: "Stripe",
    purpose: "Payments and payouts",
    source: "Payments",
    access: "read_write",
    domains: ["payments", "stripe", "invoices"],
    aliases: ["stripe", "payments"]
  });
  registerKnowledgeSource({
    id: "business_memory",
    name: "Business Memory",
    purpose: "Permanent facts about this business",
    source: "Hubly Brain",
    access: "read_write",
    domains: ["business", "customers", "jobs"],
    aliases: ["business memory", "memory"]
  });
  registerKnowledgeSource({
    id: "workspace_memory",
    name: "Workspace Memory",
    purpose: "How the owner likes to work",
    source: "Hubly Brain",
    access: "read_write",
    domains: ["workspace", "sidebar", "dashboard"],
    aliases: ["workspace memory", "workspace"]
  });
  registerKnowledgeSource({
    id: "business_dna",
    name: "Business DNA",
    purpose: "Industry knowledge packs (read-only for experts)",
    source: "Hubly Brain",
    access: "read",
    domains: ["dna", "industry", "blueprints"],
    aliases: ["business dna", "dna"]
  });
  registerKnowledgeSource({
    id: "marketplace_knowledge",
    name: "Marketplace",
    purpose: "Marketplace listing and demand data",
    source: "Marketplace",
    access: "read_write",
    domains: ["marketplace"],
    aliases: ["marketplace"]
  });
  registerKnowledgeSource({
    id: "website_knowledge",
    name: "Website",
    purpose: "Live website content and structure",
    source: "Website",
    access: "read_write",
    domains: ["website", "homepage"],
    aliases: ["website", "site"]
  });
  registerKnowledgeSource({
    id: "crm_knowledge",
    name: "CRM",
    purpose: "Customers, jobs, and communications",
    source: "CRM",
    access: "read_write",
    domains: ["crm", "customers", "jobs"],
    aliases: ["crm", "customers", "jobs"]
  });
  registerKnowledgeSource({
    id: "conversation_intelligence",
    name: "Conversation Intelligence",
    purpose: "What we are currently working on",
    source: "Hubly Brain",
    access: "read_write",
    domains: ["conversation", "projects", "commitments"],
    aliases: ["conversation intelligence", "working memory"]
  });
}
function ensureRegistriesBootstrapped() {
  bootstrapDefaultRegistries();
}

// supabase/functions/_shared/hubly_brain_mission_control.ts
var MISSION_CONTROL_VERSION = "1.1.0";
var MISSION_CONTROL_OWNER = "hubly_brain";
var FLIGHTS = /* @__PURE__ */ new Map();
var FLIGHT_ORDER = [];
var MAX_FLIGHTS = 200;
var expertAgg = /* @__PURE__ */ new Map();
var lastLiveActivity = {
  hubly_brain: "idle",
  research: "idle",
  strategy: "idle",
  creative_director: "idle",
  critic: "idle",
  decision: "idle",
  builder: "pending_approval"
};
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function cloneFlight(f) {
  return JSON.parse(JSON.stringify(f));
}
function recordFlightRecorder(opts) {
  const startedAt = opts.startedAt || new Date(Date.now() - (opts.latencyMs || 0)).toISOString();
  const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  const startMs = Date.parse(startedAt) || Date.now();
  const experts = opts.expertsExecuted || [];
  const timeline = [];
  let t = 0;
  const push = (phase, detail, meta, dt = 0) => {
    t += dt;
    timeline.push({
      at: new Date(startMs + t).toISOString(),
      t,
      phase,
      detail,
      meta
    });
  };
  push("request", `Owner: ${String(opts.request || "").slice(0, 200)}`, { intent: opts.intent }, 0);
  push("hubly_brain", "Thinking\u2026", { status: "thinking" }, 20);
  for (const m of opts.memoriesLoaded || []) {
    push("memory_loaded", `Loaded ${m}`, { memory: m }, 30);
  }
  if ((opts.dnaFactsUsed || []).length) {
    push("business_dna", `Business DNA loaded (${opts.dnaFactsUsed.length} facts)`, {
      facts: opts.dnaFactsUsed
    }, 40);
  }
  for (const ex of experts) {
    const status = ex.status === "failed" ? "failed" : "finished";
    push(ex.expertId, `${ex.expertId}: ${status}`, {
      confidence: ex.confidence,
      ms: ex.ms,
      summary: ex.summary
    }, Math.max(10, Math.min(ex.ms || 50, 200)));
  }
  for (const r of opts.reasoningObjects || []) {
    push("reasoning", `Reasoning Object: ${r.decisionKey}`, {
      reasoningId: r.reasoningId,
      decision: r.decision,
      confidence: r.confidence
    }, 15);
  }
  for (const d of opts.decisionObjects || []) {
    push("decision", `Decision: ${d.finalDecision} (${d.decisionScore}%)`, {
      decisionId: d.decisionId,
      recommendation: d.recommendation,
      requiresApproval: d.requiresApproval
    }, 15);
  }
  for (const c of opts.capabilitiesSelected || []) {
    push("capability", `${c.label} \u2192 ${c.toolId}`, c, 10);
  }
  for (const k of opts.knowledgeAccessed || []) {
    push("knowledge", `Knowledge: ${k.name} (${k.access})`, k, 10);
  }
  for (const w of opts.memoryWrites || []) {
    push("memory_write", `Wrote ${w.system}: ${w.summary}`, w, 10);
  }
  push("response", `Final response ready`, {
    preview: String(opts.finalResponse || "").slice(0, 160)
  }, 20);
  const liveActivity = {
    hubly_brain: "finished",
    research: experts.some((e) => e.expertId === "research") ? experts.find((e) => e.expertId === "research").status === "failed" ? "failed" : "finished" : "idle",
    strategy: experts.some((e) => e.expertId === "strategy") ? "finished" : "idle",
    creative: experts.some((e) => e.expertId === "creative_director") ? "running" : "idle",
    critic: experts.some((e) => e.expertId === "critic") ? "waiting" : "idle",
    decision: opts.decisionAction || "idle",
    builder: opts.decisionAction === "recommend" || opts.decisionAction === "proceed" ? "pending_approval" : "idle"
  };
  if (experts.some((e) => e.expertId === "creative_director")) liveActivity.creative = "finished";
  if (experts.some((e) => e.expertId === "critic")) liveActivity.critic = "finished";
  lastLiveActivity = { ...liveActivity };
  const flight = {
    executionId: opts.executionId || newId("flt"),
    request: String(opts.request || ""),
    intent: String(opts.intent || "general"),
    businessId: opts.businessId ?? null,
    startedAt,
    finishedAt,
    latencyMs: Math.max(0, Math.round(opts.latencyMs || 0)),
    ok: opts.ok !== false,
    memoriesLoaded: [...opts.memoriesLoaded || []],
    dnaFactsUsed: [...opts.dnaFactsUsed || []],
    expertsExecuted: experts.map((e) => ({ ...e })),
    expertOrder: experts.map((e) => e.expertId),
    reasoningObjects: [...opts.reasoningObjects || []],
    decisionObjects: [...opts.decisionObjects || []],
    capabilitiesSelected: [...opts.capabilitiesSelected || []],
    knowledgeAccessed: [...opts.knowledgeAccessed || []],
    finalResponse: String(opts.finalResponse || ""),
    memoryWrites: [...opts.memoryWrites || []],
    timeline,
    liveActivity,
    confidence: opts.confidence ?? null,
    decisionScore: opts.decisionScore ?? null,
    decisionAction: opts.decisionAction ?? null
  };
  FLIGHTS.set(flight.executionId, flight);
  FLIGHT_ORDER.push(flight.executionId);
  while (FLIGHT_ORDER.length > MAX_FLIGHTS) {
    const old = FLIGHT_ORDER.shift();
    if (old) FLIGHTS.delete(old);
  }
  for (const ex of experts) {
    const cur = expertAgg.get(ex.expertId) || {
      name: ex.expertId,
      runs: 0,
      successes: 0,
      failures: 0,
      latencySum: 0,
      confidenceSum: 0,
      decisionScoreSum: 0,
      decisionScoreN: 0
    };
    cur.runs += 1;
    if (ex.status === "failed") cur.failures += 1;
    else cur.successes += 1;
    cur.latencySum += ex.ms || 0;
    cur.confidenceSum += ex.confidence || 0;
    if (typeof opts.decisionScore === "number") {
      cur.decisionScoreSum += opts.decisionScore;
      cur.decisionScoreN += 1;
    }
    expertAgg.set(ex.expertId, cur);
  }
  return cloneFlight(flight);
}
function getFlightRecorder(executionId) {
  const f = FLIGHTS.get(String(executionId));
  return f ? cloneFlight(f) : null;
}
function listFlightRecorders(limit = 50) {
  const n = Math.max(1, Math.min(MAX_FLIGHTS, limit));
  return FLIGHT_ORDER.slice(-n).map((id) => cloneFlight(FLIGHTS.get(id))).filter(Boolean);
}
function replayExecution(executionId) {
  const flight = getFlightRecorder(executionId);
  if (!flight) {
    return { executionId, replay: true, steps: [], flight: null, summary: null };
  }
  return {
    executionId: flight.executionId,
    replay: true,
    steps: flight.timeline.map((e) => ({ ...e, meta: e.meta ? { ...e.meta } : void 0 })),
    flight,
    summary: {
      request: flight.request,
      memoriesLoaded: [...flight.memoriesLoaded],
      dnaFactsUsed: [...flight.dnaFactsUsed],
      expertOrder: [...flight.expertOrder],
      reasoningCount: flight.reasoningObjects.length,
      decisionCount: flight.decisionObjects.length,
      capabilities: flight.capabilitiesSelected.map((c) => `${c.label}\u2192${c.toolId}`),
      knowledge: flight.knowledgeAccessed.map((k) => k.name),
      finalResponse: flight.finalResponse,
      memoryWrites: flight.memoryWrites.map((w) => `${w.system}: ${w.summary}`)
    }
  };
}
function computeAiHealth() {
  const flights = listFlightRecorders(MAX_FLIGHTS);
  const n = flights.length || 1;
  const ok = flights.filter((f) => f.ok).length;
  const latency = flights.reduce((a, f) => a + f.latencyMs, 0);
  const conf = flights.filter((f) => typeof f.confidence === "number");
  const scores = flights.filter((f) => typeof f.decisionScore === "number");
  return {
    executions: flights.length,
    okRate: flights.length ? Math.round(ok / flights.length * 100) : 100,
    avgLatencyMs: flights.length ? Math.round(latency / flights.length) : 0,
    avgConfidence: conf.length ? Math.round(conf.reduce((a, f) => a + (f.confidence || 0), 0) / conf.length) : 0,
    avgDecisionScore: scores.length ? Math.round(scores.reduce((a, f) => a + (f.decisionScore || 0), 0) / scores.length) : null,
    errors: flights.length - ok,
    providerStatus: getCircuitSnapshot().some((c) => c.state === "open") ? "degraded" : "ready",
    reasoningObjectsRecorded: flights.reduce((a, f) => a + f.reasoningObjects.length, 0),
    decisionObjectsRecorded: flights.reduce((a, f) => a + f.decisionObjects.length, 0)
  };
}
function getExpertActivity() {
  const registered = listExperts();
  const ids = /* @__PURE__ */ new Set([...expertAgg.keys(), ...registered.map((e) => e.id)]);
  return [...ids].map((id) => {
    const a = expertAgg.get(id);
    const def = registered.find((e) => e.id === id);
    if (!a) {
      return {
        expertId: id,
        name: def?.name || id,
        runs: 0,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
        avgConfidence: 0,
        failureRate: 0,
        successRate: 0,
        avgDecisionScore: null
      };
    }
    return {
      expertId: id,
      name: def?.name || a.name,
      runs: a.runs,
      successes: a.successes,
      failures: a.failures,
      avgLatencyMs: a.runs ? Math.round(a.latencySum / a.runs) : 0,
      avgConfidence: a.runs ? Math.round(a.confidenceSum / a.runs) : 0,
      failureRate: a.runs ? Math.round(a.failures / a.runs * 100) : 0,
      successRate: a.runs ? Math.round(a.successes / a.runs * 100) : 0,
      avgDecisionScore: a.decisionScoreN ? Math.round(a.decisionScoreSum / a.decisionScoreN) : null
    };
  });
}
function getMissionControlSnapshot() {
  ensureRegistriesBootstrapped();
  const flights = listFlightRecorders(20);
  const latest = flights.length ? flights[flights.length - 1] : null;
  const decisionGraph = {
    nodes: [
      { key: "homepage", label: "Homepage" },
      { key: "booking", label: "Booking" },
      { key: "packages", label: "Packages" },
      { key: "website", label: "Website" },
      { key: "growth", label: "Growth" },
      { key: "automation", label: "Automation" }
    ],
    edges: [
      { from: "homepage", to: "booking" },
      { from: "booking", to: "packages" },
      { from: "packages", to: "website" },
      { from: "website", to: "growth" },
      { from: "growth", to: "automation" }
    ]
  };
  if (latest?.reasoningObjects?.length) {
    const nodes = latest.reasoningObjects.map((r) => ({
      key: r.decisionKey,
      label: r.decision.slice(0, 48)
    }));
    if (nodes.length) {
      decisionGraph.nodes = nodes;
      decisionGraph.edges = nodes.slice(0, -1).map((n, i) => ({
        from: n.key,
        to: nodes[i + 1].key
      }));
    }
  }
  return {
    version: MISSION_CONTROL_VERSION,
    title: "Hubly Mission Control",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    liveAiActivity: { ...lastLiveActivity },
    expertActivity: getExpertActivity(),
    businessMemory: {
      inspectable: true,
      note: "Inspect / compare / restore Business Memory versions (Brain-owned)."
    },
    workspaceMemory: {
      inspectable: true,
      note: "Inspect / replay / compare Workspace Memory preferences."
    },
    conversationIntelligence: {
      inspectable: true,
      note: "Active conversations, projects, threads, deferred ideas, promises."
    },
    decisionGraph,
    builderActions: {
      milestone: "1.5",
      available: false,
      note: "Builder Engine (Milestone 1.5) \u2014 preview / applied / rejected / rollback.",
      recent: []
    },
    capabilityRegistry: listTools().map((t) => ({
      toolId: t.id,
      name: t.name,
      capabilityCount: t.capabilities.length
    })),
    knowledgeRegistry: listKnowledgeSources().map((k) => ({
      id: k.id,
      name: k.name,
      access: k.access === "read" ? "Read Only" : "Read + Write"
    })),
    brainTimeline: latest?.timeline || [],
    aiHealth: computeAiHealth(),
    recentExecutions: flights.slice(-10).reverse().map((f) => ({
      executionId: f.executionId,
      request: f.request.slice(0, 120),
      at: f.finishedAt,
      ok: f.ok,
      latencyMs: f.latencyMs
    })),
    replayAvailable: true,
    performance: getObservabilityDashboard(),
    costAwareness: getCostReport(),
    reliability: {
      circuits: getCircuitSnapshot(),
      queuedWork: listQueuedWork(),
      manifest: getReliabilityManifest()
    },
    trustScore: computeTrustScore({
      aiHealthOkRate: computeAiHealth().okRate,
      avgDecisionScore: computeAiHealth().avgDecisionScore,
      avgLatencyMs: computeAiHealth().avgLatencyMs
    })
  };
}
function clearMissionControlForTests() {
  FLIGHTS.clear();
  FLIGHT_ORDER.length = 0;
  expertAgg.clear();
  lastLiveActivity = {
    hubly_brain: "idle",
    research: "idle",
    strategy: "idle",
    creative_director: "idle",
    critic: "idle",
    decision: "idle",
    builder: "pending_approval"
  };
}
var HublyMissionControl = {
  version: MISSION_CONTROL_VERSION,
  owner: MISSION_CONTROL_OWNER,
  record: recordFlightRecorder,
  getFlight: getFlightRecorder,
  listFlights: listFlightRecorders,
  replay: replayExecution,
  snapshot: getMissionControlSnapshot,
  expertActivity: getExpertActivity,
  trustScore: computeTrustScore,
  performance: getObservabilityDashboard,
  costAwareness: getCostReport,
  clearForTests: clearMissionControlForTests
};
var hubly_brain_mission_control_default = HublyMissionControl;
export {
  HublyMissionControl,
  MISSION_CONTROL_OWNER,
  MISSION_CONTROL_VERSION,
  clearMissionControlForTests,
  hubly_brain_mission_control_default as default,
  getExpertActivity,
  getFlightRecorder,
  getMissionControlSnapshot,
  listFlightRecorders,
  recordFlightRecorder,
  replayExecution
};
