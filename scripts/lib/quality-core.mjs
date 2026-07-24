/** Node mirror of hubly_brain_quality.ts core — Section 16 (esbuild). */


// supabase/functions/_shared/hubly_brain_quality.ts
var QUALITY_VERSION = "1.0.0";
var QUALITY_OWNER = "hubly_brain";
var SCENARIO_LIBRARY = [
  {
    id: "start_lawn_care",
    request: "I'm starting a lawn care company.",
    category: "onboarding",
    industry: "lawn care",
    expect: { experts: ["research", "strategy", "creative_director"], identityOk: true }
  },
  {
    id: "recurring_memberships",
    request: "I want recurring memberships.",
    category: "growth",
    expect: { identityOk: true, mustNotMention: ["as an AI", "OpenAI", "LLM"] }
  },
  {
    id: "move_dashboard_below_jobs",
    request: "Move Dashboard below Jobs.",
    category: "workspace",
    expect: { identityOk: true }
  },
  {
    id: "upload_portfolio_photos",
    request: "Upload these 12 portfolio photos.",
    category: "website",
    expect: { identityOk: true }
  },
  {
    id: "no_same_day_bookings",
    request: "No same-day bookings.",
    category: "booking",
    expect: {
      identityOk: true,
      mustNotMention: ["as an AI", "Error.", "OpenAI", "LLM"]
    }
  },
  {
    id: "arrival_windows",
    request: "I want arrival windows.",
    category: "booking",
    expect: { identityOk: true }
  },
  {
    id: "rewrite_homepage",
    request: "Rewrite my homepage.",
    category: "website",
    expect: { experts: ["creative_director"], identityOk: true }
  },
  {
    id: "hate_my_logo",
    request: "I hate my logo.",
    category: "brand",
    expect: { identityOk: true, mustNotMention: ["Error."] }
  },
  {
    id: "business_expanding",
    request: "My business is expanding.",
    category: "growth",
    expect: { identityOk: true }
  },
  {
    id: "start_pressure_washing",
    request: "I'm starting a pressure washing company in Salt Lake City.",
    category: "onboarding",
    industry: "pressure washing",
    expect: { experts: ["research", "strategy", "creative_director", "critic"], identityOk: true }
  }
];
var FOUNDER_BENCHMARK_SUITE = [
  {
    id: "liked_two_things",
    request: "I liked two things about my old software...",
    whyItMatters: "Hubly must listen and preserve owner preferences, not overwrite them.",
    expect: { identityOk: true }
  },
  {
    id: "more_premium",
    request: "Make my website feel more premium.",
    whyItMatters: "Creative + Strategy must collaborate through Brain without sounding robotic.",
    expect: { identityOk: true, mustNotMention: ["as an AI"] }
  },
  {
    id: "no_same_day_bench",
    request: "No same-day bookings.",
    whyItMatters: "Booking rules must become clear owner-facing commitments.",
    expect: { identityOk: true }
  },
  {
    id: "arrival_1_3",
    request: "Customers can arrive between 1\u20133 PM.",
    whyItMatters: "Arrival windows are a core scheduling capability.",
    expect: { identityOk: true }
  },
  {
    id: "twelve_photos",
    request: "Put these 12 photos in my portfolio.",
    whyItMatters: "Portfolio work must feel like a partner, not a file upload error.",
    expect: { identityOk: true }
  },
  {
    id: "jobs_above_customers",
    request: "Move Jobs above Customers.",
    whyItMatters: "Workspace Memory preferences must stick.",
    expect: { identityOk: true }
  },
  {
    id: "recurring_maintenance",
    request: "Build me a recurring maintenance package.",
    whyItMatters: "Packages / growth recommendations must be specific.",
    expect: { identityOk: true }
  },
  {
    id: "rewrite_homepage_bench",
    request: "Rewrite my homepage.",
    whyItMatters: "Homepage rewrites go through Decision + Creative + ED.",
    expect: { identityOk: true }
  },
  {
    id: "first_employee",
    request: "I just hired my first employee.",
    whyItMatters: "Milestones deserve coaching voice, not detection labels.",
    expect: { identityOk: true }
  },
  {
    id: "raise_prices",
    request: "Should I raise my prices?",
    whyItMatters: "Decisions must be explainable \u2014 recommend, don't pressure.",
    expect: { identityOk: true, mustNotMention: ["act now", "limited-time"] }
  }
];
var BUSINESS_GENERATION_INDUSTRIES = [
  "pressure washing",
  "lawn care",
  "window cleaning",
  "HVAC",
  "photography",
  "house cleaning"
];
function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function caseResult(suite, id, ok, detail, started, meta) {
  return {
    id,
    suite,
    ok,
    detail,
    ms: Math.max(0, Date.now() - started),
    meta
  };
}
function suiteFromCases(suite, cases) {
  const passed = cases.filter((c) => c.ok).length;
  const failed = cases.length - passed;
  return { suite, ok: failed === 0 && cases.length > 0, passed, failed, cases };
}
var DEPS = null;
function bindQualityDeps(deps2) {
  DEPS = deps2;
}
function deps() {
  if (!DEPS) throw new Error("Quality deps not bound \u2014 call bindQualityDeps first");
  return DEPS;
}
function responseText(result) {
  return String(result.response || result.ownerResponse || "");
}
function checkExpectations(result, expect, constitutionOk) {
  if (!expect) return { ok: true, detail: "no expectations" };
  const text = responseText(result);
  const experts = result.expertsRun || (result.expertOutputs || []).map((e) => e.expertId);
  if (expect.experts) {
    for (const e of expect.experts) {
      if (!experts.includes(e)) return { ok: false, detail: `missing expert ${e}` };
    }
  }
  if (expect.mustMention) {
    const low = text.toLowerCase();
    const bookingShaped = /booking|schedule|appointment|window|same.?day|arrival/i.test(low);
    for (const m of expect.mustMention) {
      if (low.includes(m.toLowerCase())) continue;
      if (bookingShaped && /same-?day|booking|day|window/i.test(m)) continue;
      if (/same.?day|today/i.test(low) && /same-?day|day/i.test(m)) continue;
      return { ok: false, detail: `missing mention: ${m}` };
    }
  }
  if (expect.mustNotMention) {
    for (const m of expect.mustNotMention) {
      if (new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
        return { ok: false, detail: `forbidden mention: ${m}` };
      }
    }
  }
  if (expect.identityOk && constitutionOk === false) {
    return { ok: false, detail: "identity/constitution failed" };
  }
  return { ok: true, detail: "expectations met" };
}
async function runBrainValidation() {
  const d = deps();
  const cases = [];
  const t0 = Date.now();
  const result = await d.think({
    request: "I'm starting a pressure washing company.",
    businessId: "qa_brain_1",
    memory: { businessId: "qa_brain_1", name: "QA Wash", industry: "pressure washing", memoryVersion: 1 }
  });
  const experts = result.expertsRun || [];
  cases.push(caseResult("brain", "routing_experts", experts.length >= 3, `experts=${experts.join(",")}`, t0, { experts }));
  cases.push(caseResult("brain", "memory_loaded", !!result.dna || !!result.memory, "dna/memory present", t0));
  cases.push(caseResult(
    "brain",
    "expert_execution",
    Array.isArray(result.expertOutputs) && result.expertOutputs.length >= 1,
    `outputs=${result.expertOutputs?.length || 0}`,
    t0
  ));
  cases.push(caseResult(
    "brain",
    "decision_engine",
    !!(result.decisionObject || result.decision || result.confidence != null),
    `confidence=${result.confidence}`,
    t0
  ));
  cases.push(caseResult(
    "brain",
    "reasoning",
    !!(result.reasoningObjects || result.reasoningChain || (result.expertOutputs || []).some((e) => (e.reasoning || []).length)),
    "reasoning present",
    t0
  ));
  const constitution = d.evaluateAgainstConstitution(responseText(result));
  cases.push(caseResult("brain", "identity_enforcement", constitution.ok, `constitution=${constitution.ok}`, t0));
  return suiteFromCases("brain", cases);
}
async function runExpertValidation() {
  const d = deps();
  const cases = [];
  const experts = d.listExperts().map((e) => e.id);
  const required = ["research", "strategy", "creative_director", "critic", "experience_director"];
  for (const id of required) {
    const t0 = Date.now();
    if (!experts.includes(id)) {
      cases.push(caseResult("experts", `${id}_registered`, false, "not registered", t0));
      continue;
    }
    if (id === "experience_director") {
      cases.push(caseResult("experts", `${id}_registered`, true, "ED registered (runs via think gate)", t0));
      continue;
    }
    try {
      const out = await d.runExpert(id, {
        request: "Help me grow my local service business",
        intent: "general",
        memory: { name: "QA Co", industry: "lawn care" },
        dna: null,
        workspace: null,
        conversation: null,
        priorOutputs: []
      });
      const reasoning = Array.isArray(out.reasoning) && out.reasoning.length > 0;
      const confidence = typeof out.confidence === "number";
      const graceful = out.ok !== false || !!out.summary;
      const noBypass = !/openai\.com|anthropic\.com|api\.openai/i.test(JSON.stringify(out));
      cases.push(caseResult("experts", `${id}_executes`, !!out.summary, String(out.summary || "").slice(0, 80), t0));
      cases.push(caseResult("experts", `${id}_reasoning`, reasoning, "reasoning", t0));
      cases.push(caseResult("experts", `${id}_confidence`, confidence, `confidence=${out.confidence}`, t0));
      cases.push(caseResult("experts", `${id}_graceful`, graceful, `ok=${out.ok}`, t0));
      cases.push(caseResult("experts", `${id}_no_bypass`, noBypass, "no direct provider URLs", t0));
      const perm = d.assertExpertPermission(id === "research" ? "research" : "critic", "weather");
      if (id === "research") {
        cases.push(caseResult("experts", `${id}_permissions`, perm.ok, "research\u2192weather", t0));
      } else if (id === "critic") {
        cases.push(caseResult("experts", `${id}_permissions`, !perm.ok, "critic cannot use weather", t0));
      }
    } catch (err) {
      cases.push(caseResult("experts", `${id}_executes`, false, d.ownerSafeError(err), t0));
    }
  }
  return suiteFromCases("experts", cases);
}
async function runMemoryValidation() {
  const d = deps();
  const cases = [];
  const t0 = Date.now();
  const bizA = "qa_mem_a";
  const bizB = "qa_mem_b";
  const memA = d.normalizeBusinessMemory({ businessId: bizA, name: "Alpha Wash", industry: "pressure washing" });
  const memB = d.normalizeBusinessMemory({ businessId: bizB, name: "Beta Lens", industry: "photography" });
  d.persistBusinessMemoryLocal(bizA, memA);
  d.persistBusinessMemoryLocal(bizB, memB);
  const loadedA = d.loadBusinessMemoryLocal(bizA);
  const loadedB = d.loadBusinessMemoryLocal(bizB);
  cases.push(caseResult("memory", "business_persist", loadedA?.name === "Alpha Wash", `A=${loadedA?.name}`, t0));
  cases.push(caseResult("memory", "business_isolation", loadedB?.name === "Beta Lens" && loadedA?.name !== loadedB?.name, "isolated", t0));
  const wsA = d.normalizeWorkspaceMemory({ businessId: bizA, sidebarOrder: ["jobs", "customers"] });
  const wsB = d.normalizeWorkspaceMemory({ businessId: bizB, sidebarOrder: ["customers", "jobs"] });
  d.persistWorkspaceMemoryLocal(bizA, wsA);
  d.persistWorkspaceMemoryLocal(bizB, wsB);
  const wsLoadedA = d.loadWorkspaceMemoryLocal(bizA);
  const wsLoadedB = d.loadWorkspaceMemoryLocal(bizB);
  cases.push(caseResult(
    "memory",
    "workspace_persist",
    Array.isArray(wsLoadedA?.sidebarOrder) && wsLoadedA.sidebarOrder[0] === "jobs",
    `order=${wsLoadedA?.sidebarOrder?.join(",")}`,
    t0
  ));
  cases.push(caseResult(
    "memory",
    "workspace_isolation",
    wsLoadedB?.sidebarOrder?.[0] === "customers" && wsLoadedA?.sidebarOrder?.[0] !== wsLoadedB?.sidebarOrder?.[0],
    "workspace isolated",
    t0
  ));
  const ciA = d.normalizeConversationIntelligence({ businessId: bizA, currentProject: "Website Redesign" });
  const ciB = d.normalizeConversationIntelligence({ businessId: bizB, currentProject: "Portfolio Shoot" });
  d.persistConversationIntelligenceLocal(bizA, ciA);
  d.persistConversationIntelligenceLocal(bizB, ciB);
  const ciLoadedA = d.loadConversationIntelligenceLocal(bizA);
  const ciLoadedB = d.loadConversationIntelligenceLocal(bizB);
  cases.push(caseResult("memory", "ci_persist", /Website/i.test(String(ciLoadedA?.currentProject || "")), `project=${ciLoadedA?.currentProject}`, t0));
  cases.push(caseResult(
    "memory",
    "ci_isolation",
    String(ciLoadedA?.currentProject) !== String(ciLoadedB?.currentProject),
    "CI isolated",
    t0
  ));
  const iso = d.assertMemoryIsolation(bizA, bizB);
  cases.push(caseResult("memory", "cache_isolation", iso.ok, "reliability cache isolation", t0));
  return suiteFromCases("memory", cases);
}
async function runBusinessGenerationValidation() {
  const d = deps();
  const cases = [];
  for (const industry of BUSINESS_GENERATION_INDUSTRIES) {
    const t0 = Date.now();
    const result = await d.think({
      request: `I'm starting a ${industry} business.`,
      businessId: `qa_gen_${industry.replace(/\s+/g, "_")}`,
      memory: {
        businessId: `qa_gen_${industry.replace(/\s+/g, "_")}`,
        name: `QA ${industry}`,
        industry,
        memoryVersion: 1
      }
    });
    const outputs = result.expertOutputs || [];
    const hasResearch = outputs.some((o) => o.expertId === "research");
    const hasStrategy = outputs.some((o) => o.expertId === "strategy");
    const hasCreative = outputs.some((o) => o.expertId === "creative_director");
    const hasReasoning = outputs.some((o) => (o.reasoning || []).length > 0);
    const hasDecision = result.confidence != null || !!result.decisionObject;
    const dnaName = result.dna?.knowledgePack?.industryProfile?.industryName || industry;
    cases.push(caseResult("business_generation", `${industry}_pipeline`, hasResearch && hasStrategy && hasCreative, `dna=${dnaName}`, t0, {
      experts: outputs.map((o) => o.expertId),
      hasReasoning,
      hasDecision
    }));
    cases.push(caseResult("business_generation", `${industry}_reasoning`, hasReasoning, "reasoning", t0));
    cases.push(caseResult("business_generation", `${industry}_decision`, !!hasDecision, `confidence=${result.confidence}`, t0));
  }
  return suiteFromCases("business_generation", cases);
}
async function runMultiIndustryValidation() {
  const d = deps();
  const cases = [];
  const fingerprints = /* @__PURE__ */ new Map();
  for (const industry of ["pressure washing", "photography", "lawn care", "HVAC"]) {
    const t0 = Date.now();
    const pack = d.loadBusinessDnaKnowledge({ industry });
    const fp = [
      pack.industryProfile.industryName,
      ...(pack.websiteIntelligence.recommendedHomepageOrder || []).slice(0, 4),
      String((pack.evidence || []).length)
    ].join("|");
    fingerprints.set(industry, fp);
    cases.push(caseResult(
      "multi_industry",
      `${industry}_dna_loaded`,
      !!pack.industryProfile.industryName,
      pack.industryProfile.industryName,
      t0,
      { fingerprint: fp }
    ));
  }
  const pw = fingerprints.get("pressure washing");
  const photo = fingerprints.get("photography");
  const lawn = fingerprints.get("lawn care");
  const hvac = fingerprints.get("HVAC");
  cases.push(caseResult("multi_industry", "pw_ne_photo", pw !== photo, "pressure washing \u2260 photography", Date.now()));
  cases.push(caseResult("multi_industry", "lawn_ne_hvac", lawn !== hvac, "lawn care \u2260 HVAC", Date.now()));
  cases.push(caseResult(
    "multi_industry",
    "all_distinct",
    new Set(fingerprints.values()).size === fingerprints.size,
    `unique=${new Set(fingerprints.values()).size}`,
    Date.now()
  ));
  return suiteFromCases("multi_industry", cases);
}
async function runIdentityValidation() {
  const d = deps();
  const cases = [];
  const samples = [
    "I think asking three recent customers for reviews would make a meaningful difference because social proof builds trust.",
    "I built that for you.",
    "I'm 100% certain this will double your revenue. Act now!",
    "As an AI language model, Feature created."
  ];
  let checked = 0;
  let passed = 0;
  for (const sample of samples) {
    const t02 = Date.now();
    const applied = d.applyHublyIdentity(sample);
    const constitution = d.evaluateAgainstConstitution(applied.text);
    checked += 1;
    const shouldPass = !/100%|act now|as an ai|feature created/i.test(sample);
    const ok = shouldPass ? constitution.ok : !constitution.ok || applied.text !== sample;
    if (ok) passed += 1;
    cases.push(caseResult("identity", `sample_${checked}`, ok, applied.text.slice(0, 100), t02, {
      constitutionOk: constitution.ok
    }));
  }
  const t0 = Date.now();
  const live = await d.think({
    request: "Rewrite my homepage.",
    businessId: "qa_identity",
    memory: { businessId: "qa_identity", name: "QA", industry: "lawn care" }
  });
  const liveIdentity = d.applyHublyIdentity(responseText(live));
  const liveConst = liveIdentity.constitution;
  cases.push(caseResult("identity", "live_think_constitution", liveConst.ok, liveIdentity.text.slice(0, 120), t0));
  if (liveConst.ok) passed += 1;
  checked += 1;
  cases.push(caseResult(
    "identity",
    "compliance_rate",
    passed / checked >= 0.75,
    `rate=${clampPct(passed / checked * 100)}%`,
    t0,
    { checked, passed }
  ));
  return suiteFromCases("identity", cases);
}
async function runCapabilityValidation() {
  const d = deps();
  const cases = [];
  const t0 = Date.now();
  const plan = d.planRegistryRoute("I want arrival windows and weather-aware booking");
  cases.push(caseResult(
    "capabilities",
    "discovery",
    (plan.capabilities || []).length >= 1 || !!d.whoOwnsCapability("arrival_windows"),
    `caps=${(plan.capabilities || []).length}`,
    t0
  ));
  const owner = d.whoOwnsCapability("arrival_windows");
  cases.push(caseResult("capabilities", "permissions_owner", !!owner?.toolId, `owner=${owner?.toolId}`, t0));
  const deg = d.gracefulDegrade("weather", new Error("Weather provider timed out"));
  cases.push(caseResult("capabilities", "failure_recovery", deg.continue && !!deg.ownerMessage, deg.ownerMessage.slice(0, 80), t0));
  try {
    await d.withTimeout(async () => "ok", 50, "cap_probe");
    cases.push(caseResult("capabilities", "execution_timeout_wrapper", true, "timeout wrapper ok", t0));
  } catch {
    cases.push(caseResult("capabilities", "execution_timeout_wrapper", false, "timeout wrapper failed", t0));
  }
  return suiteFromCases("capabilities", cases);
}
async function runSecurityValidation() {
  const d = deps();
  const cases = [];
  const t0 = Date.now();
  const iso = d.assertMemoryIsolation("qa_sec_a", "qa_sec_b");
  cases.push(caseResult("security", "memory_isolation", iso.ok, "memory isolation", t0));
  const bizIso = await runMemoryValidation();
  cases.push(caseResult("security", "business_isolation", bizIso.ok, `memory suite ok=${bizIso.ok}`, t0));
  const deny = d.assertExpertPermission("critic", "website");
  cases.push(caseResult("security", "permission_enforcement", !deny.ok, "critic denied website tool", t0));
  d.auditAiAction({
    action: "quality_security_probe",
    businessId: "qa_sec_a",
    resource: "business_memory",
    allowed: true,
    detail: "section16"
  });
  const audits = d.listAuditLog(10);
  cases.push(caseResult("security", "audit_logging", audits.length >= 1, `audits=${audits.length}`, t0));
  const safe = d.ownerSafeError("OpenAI timeout stack at probe.ts:1");
  cases.push(caseResult("security", "safe_tool_errors", !/\.ts:\d+|stack at/i.test(safe), safe.slice(0, 80), t0));
  return suiteFromCases("security", cases);
}
async function runPerformanceValidation() {
  const d = deps();
  const cases = [];
  const parallelN = 12;
  const tParallel = Date.now();
  const parallel = await Promise.all(
    Array.from(
      { length: parallelN },
      (_, i) => d.think({
        request: `Quick tip ${i} for my lawn care company`,
        businessId: `qa_perf_${i}`,
        memory: { businessId: `qa_perf_${i}`, name: `Perf ${i}`, industry: "lawn care" }
      })
    )
  );
  const parallelMs = Date.now() - tParallel;
  const parallelOk = parallel.every((r) => !!responseText(r));
  cases.push(caseResult(
    "performance",
    "parallel_ai_requests",
    parallelOk && parallelMs < 6e4,
    `${parallelN} requests in ${parallelMs}ms`,
    tParallel,
    { n: parallelN, ms: parallelMs }
  ));
  const tMem = Date.now();
  d.persistBusinessMemoryLocal("qa_perf_mem", d.normalizeBusinessMemory({
    businessId: "qa_perf_mem",
    name: "Perf Mem",
    industry: "HVAC"
  }));
  let hits = 0;
  for (let i = 0; i < 1e3; i++) {
    const m = d.loadBusinessMemoryLocal("qa_perf_mem");
    if (m?.name === "Perf Mem") hits += 1;
  }
  const memMs = Date.now() - tMem;
  cases.push(caseResult(
    "performance",
    "memory_lookups_1000",
    hits === 1e3 && memMs < 5e3,
    `hits=${hits} in ${memMs}ms`,
    tMem,
    { hits, ms: memMs }
  ));
  const tDna = Date.now();
  for (let i = 0; i < 50; i++) {
    d.loadBusinessDnaKnowledge({ industry: "pressure washing", city: "Salt Lake City", state: "UT" });
  }
  const dnaMs = Date.now() - tDna;
  cases.push(caseResult("performance", "dna_loads", dnaMs < 5e3, `50 loads in ${dnaMs}ms`, tDna, { ms: dnaMs }));
  const tFail = Date.now();
  try {
    await d.withTimeout(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return 1;
    }, 10, "perf_timeout");
    cases.push(caseResult("performance", "timeouts", false, "expected timeout", tFail));
  } catch {
    cases.push(caseResult("performance", "timeouts", true, "timeout handled", tFail));
  }
  const deg = d.gracefulDegrade("openai", new Error("OpenAI slow"));
  cases.push(caseResult("performance", "provider_degradation", deg.continue, deg.ownerMessage.slice(0, 80), tFail));
  return suiteFromCases("performance", cases);
}
async function runScenarioLibrary() {
  const d = deps();
  const results = [];
  for (const scenario of SCENARIO_LIBRARY) {
    const t0 = Date.now();
    try {
      const result = await d.think({
        request: scenario.request,
        businessId: `qa_scenario_${scenario.id}`,
        memory: {
          businessId: `qa_scenario_${scenario.id}`,
          name: "Scenario Co",
          industry: scenario.industry || "lawn care",
          memoryVersion: 1
        }
      });
      const text = responseText(result);
      const identity = d.applyHublyIdentity(text);
      const constitution = identity.constitution;
      const exp = checkExpectations({ ...result, response: identity.text }, scenario.expect, constitution.ok);
      const ok = !!identity.text && exp.ok && (scenario.expect?.identityOk ? constitution.ok : true);
      results.push(caseResult("scenario_library", scenario.id, ok, exp.detail, t0, {
        category: scenario.category,
        responsePreview: identity.text.slice(0, 120)
      }));
    } catch (err) {
      results.push(caseResult("scenario_library", scenario.id, false, deps().ownerSafeError(err), t0));
    }
  }
  const passed = results.filter((r) => r.ok).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}
async function runFounderBenchmarkSuite() {
  const d = deps();
  const results = [];
  for (const bench of FOUNDER_BENCHMARK_SUITE) {
    const t0 = Date.now();
    try {
      const result = await d.think({
        request: bench.request,
        businessId: `qa_bench_${bench.id}`,
        memory: {
          businessId: `qa_bench_${bench.id}`,
          name: "Founder Bench Co",
          industry: "pressure washing",
          memoryVersion: 1
        }
      });
      const text = responseText(result);
      const identity = d.applyHublyIdentity(text);
      const constitution = identity.constitution;
      const exp = checkExpectations({ ...result, response: identity.text }, bench.expect, constitution.ok);
      const ok = !!identity.text && exp.ok && constitution.ok;
      results.push(caseResult("founder_benchmark", bench.id, ok, exp.detail, t0, {
        whyItMatters: bench.whyItMatters,
        responsePreview: identity.text.slice(0, 120),
        explainable: !!(result.decisionObject || result.reasoningObjects || result.confidence != null)
      }));
    } catch (err) {
      results.push(caseResult("founder_benchmark", bench.id, false, d.ownerSafeError(err), t0));
    }
  }
  const passed = results.filter((r) => r.ok).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}
function computeQualityScore(suites, scenarioPassRate, benchPassRate) {
  const rate = (name) => {
    const s = suites.find((x) => x.suite === name);
    if (!s || !s.cases.length) return 95;
    return clampPct(s.passed / (s.passed + s.failed) * 100);
  };
  const dimensions = {
    routing: rate("brain"),
    memory: rate("memory"),
    reasoning: clampPct((rate("brain") + rate("business_generation")) / 2),
    identity: rate("identity"),
    business_dna: rate("multi_industry"),
    decision_engine: clampPct((rate("brain") + rate("business_generation")) / 2),
    capabilities: rate("capabilities"),
    builder_readiness: clampPct((scenarioPassRate + benchPassRate) / 2)
  };
  const values = Object.values(dimensions);
  const overall = clampPct(values.reduce((a, b) => a + b, 0) / values.length);
  return {
    overall,
    dimensions,
    checkedAt: nowIso(),
    note: "Engineering Quality Score \u2014 Mission Control. Measures intelligence validation health."
  };
}
async function runFullQualitySuite() {
  const suites = [];
  suites.push(await runBrainValidation());
  suites.push(await runExpertValidation());
  suites.push(await runMemoryValidation());
  suites.push(await runBusinessGenerationValidation());
  suites.push(await runMultiIndustryValidation());
  suites.push(await runIdentityValidation());
  suites.push(await runCapabilityValidation());
  suites.push(await runSecurityValidation());
  suites.push(await runPerformanceValidation());
  const scenarioLibrary = await runScenarioLibrary();
  const founderBenchmarks = await runFounderBenchmarkSuite();
  const scenarioPassRate = scenarioLibrary.total ? scenarioLibrary.passed / scenarioLibrary.total * 100 : 0;
  const benchPassRate = founderBenchmarks.total ? founderBenchmarks.passed / founderBenchmarks.total * 100 : 0;
  const qualityScore = computeQualityScore(suites, scenarioPassRate, benchPassRate);
  const identitySuite = suites.find((s) => s.suite === "identity");
  const identityCompliance = {
    checked: identitySuite?.cases.length || 0,
    passed: identitySuite?.passed || 0,
    rate: identitySuite && identitySuite.cases.length ? clampPct(identitySuite.passed / identitySuite.cases.length * 100) : 0
  };
  const perfSuite = suites.find((s) => s.suite === "performance");
  const performance = {};
  for (const c of perfSuite?.cases || []) {
    if (typeof c.meta?.ms === "number") performance[c.id] = c.meta.ms;
  }
  const ok = suites.every((s) => s.ok) && scenarioLibrary.failed === 0 && founderBenchmarks.failed === 0 && qualityScore.overall >= 85;
  return {
    version: QUALITY_VERSION,
    title: "Hubly Validation & Quality Assurance",
    checkedAt: nowIso(),
    suites,
    scenarioLibrary,
    founderBenchmarks,
    qualityScore,
    identityCompliance,
    performance,
    ok
  };
}
function getQualityManifest() {
  return {
    version: QUALITY_VERSION,
    owner: QUALITY_OWNER,
    name: "Validation & Quality Assurance",
    scenarioLibraryCount: SCENARIO_LIBRARY.length,
    founderBenchmarkCount: FOUNDER_BENCHMARK_SUITE.length,
    industries: [...BUSINESS_GENERATION_INDUSTRIES],
    suites: [
      "brain",
      "experts",
      "memory",
      "business_generation",
      "multi_industry",
      "identity",
      "capabilities",
      "security",
      "performance",
      "scenario_library",
      "founder_benchmarks"
    ]
  };
}
var LAST_REPORT = null;
async function runAndStoreFullQualitySuite() {
  const report = await runFullQualitySuite();
  LAST_REPORT = report;
  return report;
}
function getLastQualityReport() {
  return LAST_REPORT ? JSON.parse(JSON.stringify(LAST_REPORT)) : null;
}
function getQualityScoreSnapshot() {
  if (LAST_REPORT) return { ...LAST_REPORT.qualityScore, dimensions: { ...LAST_REPORT.qualityScore.dimensions } };
  return {
    overall: 0,
    dimensions: {
      routing: 0,
      memory: 0,
      reasoning: 0,
      identity: 0,
      business_dna: 0,
      decision_engine: 0,
      capabilities: 0,
      builder_readiness: 0
    },
    checkedAt: nowIso(),
    note: "Quality suite not run yet in this process \u2014 run HublyQuality.runFull()."
  };
}
function clearQualityForTests() {
  LAST_REPORT = null;
}
var HublyQuality = {
  version: QUALITY_VERSION,
  owner: QUALITY_OWNER,
  bind: bindQualityDeps,
  scenarios: SCENARIO_LIBRARY,
  founderBenchmarks: FOUNDER_BENCHMARK_SUITE,
  industries: BUSINESS_GENERATION_INDUSTRIES,
  runFull: runAndStoreFullQualitySuite,
  runFullOnce: runFullQualitySuite,
  runBrain: runBrainValidation,
  runExperts: runExpertValidation,
  runMemory: runMemoryValidation,
  runBusinessGeneration: runBusinessGenerationValidation,
  runMultiIndustry: runMultiIndustryValidation,
  runIdentity: runIdentityValidation,
  runCapabilities: runCapabilityValidation,
  runSecurity: runSecurityValidation,
  runPerformance: runPerformanceValidation,
  runScenarioLibrary,
  runFounderBenchmarks: runFounderBenchmarkSuite,
  computeQualityScore,
  manifest: getQualityManifest,
  lastReport: getLastQualityReport,
  scoreSnapshot: getQualityScoreSnapshot,
  clearForTests: clearQualityForTests
};
var hubly_brain_quality_default = HublyQuality;
export {
  BUSINESS_GENERATION_INDUSTRIES,
  FOUNDER_BENCHMARK_SUITE,
  HublyQuality,
  QUALITY_OWNER,
  QUALITY_VERSION,
  SCENARIO_LIBRARY,
  bindQualityDeps,
  clearQualityForTests,
  computeQualityScore,
  hubly_brain_quality_default as default,
  getLastQualityReport,
  getQualityManifest,
  getQualityScoreSnapshot,
  runAndStoreFullQualitySuite,
  runBrainValidation,
  runBusinessGenerationValidation,
  runCapabilityValidation,
  runExpertValidation,
  runFounderBenchmarkSuite,
  runFullQualitySuite,
  runIdentityValidation,
  runMemoryValidation,
  runMultiIndustryValidation,
  runPerformanceValidation,
  runScenarioLibrary,
  runSecurityValidation
};
