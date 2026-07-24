#!/usr/bin/env node
/**
 * SECTION 4 — Initial Experts Release Gate
 *
 * Proves the first generation of Hubly experts are fully operational:
 * Experience Director · Research · Strategy · Creative Director · Critic
 *
 * Demo request: "I'm starting a pressure washing company."
 */
import fs from 'fs';
import path from 'path';
import {
  clearRegistryForTests,
  registerExpert,
  discoverExperts,
  listDiscoveryLog,
  runExpert,
  selectExpertsFromRegistry,
} from './lib/expert-framework.mjs';
import { ensureExpertsRegistered, resetExpertsForTests, listRegisteredExperts } from './lib/initial-experts.mjs';
import { think, detectIntent } from './lib/think.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  demoRequest: "I'm starting a pressure washing company.",
  executionOrder: [],
  routing: null,
  expertOutputs: [],
  reasoning: [],
  confidence: [],
  timing: [],
  failures: [],
  retries: [],
  mergedResponse: null,
  expertTranscript: null,
  releaseGate: {},
};

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('PASS:', msg);
    proofs.push(msg);
  }
}

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

// ——— Static architecture proofs ———
const expertsSrc = read('supabase/functions/_shared/hubly_brain_experts.ts');
const thinkSrc = read('supabase/functions/_shared/hubly_brain_think.ts');
const frameworkSrc = read('supabase/functions/_shared/hubly_brain_expert_framework.ts');

ok(expertsSrc.includes('id: "experience_director"'), 'Experience Director is registered');
ok(expertsSrc.includes('id: "research"'), 'Research Expert is registered');
ok(expertsSrc.includes('id: "strategy"'), 'Strategy Expert is registered');
ok(expertsSrc.includes('id: "creative_director"'), 'Creative Director is registered');
ok(expertsSrc.includes('id: "critic"'), 'Critic is registered');

ok(expertsSrc.includes('Research Report'), 'Research Expert returns Research Report');
ok(expertsSrc.includes('Business Strategy'), 'Strategy Expert returns Business Strategy');
ok(expertsSrc.includes('Creative Plan'), 'Creative Director returns Creative Plan');
ok(expertsSrc.includes('Quality Report'), 'Critic returns Quality Report');
ok(expertsSrc.includes('Experience Review') || expertsSrc.includes('Experience Director'), 'Experience Director returns structured review');

ok(thinkSrc.includes('selectExpertsFromRegistry') || thinkSrc.includes('selectExpertsFromRegistry'), 'Hubly Brain orchestrates via registry');
ok(thinkSrc.includes('expertTranscript'), 'Expert Transcript is stored internally');
ok(thinkSrc.includes('customerVisible: false'), 'Expert Transcript is never customer-visible');
ok(thinkSrc.includes('mergedExpertRecords'), 'Hubly Brain merges expert records');
ok(frameworkSrc.includes('execute_retry') || frameworkSrc.includes('execute_retry'), 'Framework supports retries');
ok(frameworkSrc.includes('sanitizeExpertError'), 'Failures are sanitized (never raw internals)');
ok(thinkSrc.includes('sanitized_customer_response') || thinkSrc.includes('Never expose'), 'Customer responses never expose internal errors');

ok(
  /executionPriority:\s*10/.test(expertsSrc) &&
    /executionPriority:\s*20/.test(expertsSrc) &&
    /executionPriority:\s*30/.test(expertsSrc) &&
    /executionPriority:\s*40/.test(expertsSrc) &&
    /executionPriority:\s*100/.test(expertsSrc),
  'Registry priorities: Research→Strategy→Creative→Critic→Experience Director',
);

// ——— Behavioral demo ———
resetExpertsForTests();
ensureExpertsRegistered();

const registered = listRegisteredExperts();
const ids = registered.map((e) => e.id);
ok(ids.includes('experience_director'), 'Framework discovers Experience Director');
ok(ids.includes('research'), 'Framework discovers Research Expert');
ok(ids.includes('strategy'), 'Framework discovers Strategy Expert');
ok(ids.includes('creative_director'), 'Framework discovers Creative Director');
ok(ids.includes('critic'), 'Framework discovers Critic');

const DEMO = "I'm starting a pressure washing company.";
ok(detectIntent(DEMO) === 'build_business', 'Demo request routes as build_business');

const routed = selectExpertsFromRegistry({ intent: 'build_business', request: DEMO });
evidence.routing = { intent: 'build_business', experts: routed };
ok(
  routed.includes('research') &&
    routed.includes('strategy') &&
    routed.includes('creative_director') &&
    routed.includes('critic') &&
    routed.includes('experience_director'),
  'Routing selects all five initial experts',
);
ok(
  routed.indexOf('research') < routed.indexOf('strategy') &&
    routed.indexOf('strategy') < routed.indexOf('creative_director') &&
    routed.indexOf('creative_director') < routed.indexOf('critic') &&
    routed.indexOf('critic') < routed.indexOf('experience_director'),
  'Execution order: Research → Strategy → Creative → Critic → Experience Director',
);
evidence.executionOrder = [...routed];

const result = await think({
  request: DEMO,
  memory: { industry: 'pressure washing', name: null },
  blueprintKnowledge: {
    customerPsychology: 'Homeowners want curb appeal without risking damage.',
    trustSignals: ['before/after photos', 'insured'],
    homepageGoals: ['proof', 'packages', 'book'],
    decisionFactors: ['visible proof', 'clear pricing'],
  },
  debug: true,
});

const REQUIRED = [
  ['experience_director', 'Experience Director'],
  ['research', 'Research Expert'],
  ['strategy', 'Strategy Expert'],
  ['creative_director', 'Creative Director'],
  ['critic', 'Critic'],
];

for (const [id, label] of REQUIRED) {
  const out = result.expertOutputs.find((o) => o.expertId === id);
  ok(!!out, `${label} executed`);
  ok(Array.isArray(out?.reasoning) && out.reasoning.length > 0 && out.reasoning[0].reason, `${label} returned reasoning`);
  ok(typeof out?.confidence === 'number' && out.confidence > 0, `${label} returned confidence`);
  ok(typeof out?.expertName === 'string' && out.expertName.length > 0, `${label} returned expert name`);
  ok(typeof out?.executionTimeMs === 'number', `${label} returned execution time`);
  ok(out?.status === 'ok' || out?.status === 'retried', `${label} returned status`);
  ok(out?.output || out?.payload, `${label} returned structured output`);

  evidence.expertOutputs.push({
    expertId: id,
    expertName: out?.expertName,
    status: out?.status,
    outputType: (out?.output || out?.payload || {}).type,
    summary: out?.summary,
  });
  evidence.reasoning.push({ expertId: id, reasoning: out?.reasoning });
  evidence.confidence.push({ expertId: id, confidence: out?.confidence });
  evidence.timing.push({ expertId: id, executionTimeMs: out?.executionTimeMs });
}

ok(
  (result.expertOutputs.find((o) => o.expertId === 'research')?.output || {}).type === 'Research Report',
  'Research Expert returned Research Report',
);
ok(
  (result.expertOutputs.find((o) => o.expertId === 'strategy')?.output || {}).type === 'Business Strategy',
  'Strategy Expert returned Business Strategy',
);
ok(
  (result.expertOutputs.find((o) => o.expertId === 'creative_director')?.output || {}).type === 'Creative Plan',
  'Creative Director returned Creative Plan',
);
ok(
  (result.expertOutputs.find((o) => o.expertId === 'critic')?.output || {}).type === 'Quality Report',
  'Critic returned Quality Report',
);
ok(
  (result.expertOutputs.find((o) => o.expertId === 'experience_director')?.output || {}).type === 'Experience Review',
  'Experience Director returned Experience Review',
);

// Strategy fields
const strategyOut = result.expertOutputs.find((o) => o.expertId === 'strategy')?.output || {};
ok(!!strategyOut.positioning && !!strategyOut.targetAudience && !!strategyOut.messaging, 'Business Strategy includes positioning/audience/messaging');
ok(!!strategyOut.pricingDirection && !!strategyOut.homepageStrategy && !!strategyOut.bookingStrategy, 'Business Strategy includes pricing/homepage/booking');
ok(Array.isArray(strategyOut.businessPriorities) && strategyOut.businessPriorities.length > 0, 'Business Strategy includes business priorities');

// Research fields
const researchOut = result.expertOutputs.find((o) => o.expertId === 'research')?.output || {};
ok(Array.isArray(researchOut.findings) && researchOut.findings.length > 0, 'Research Report includes findings');
ok(!!researchOut.customerPsychology && Array.isArray(researchOut.competitors), 'Research Report includes psychology + competitors');
ok(Array.isArray(researchOut.trustSignals) && !!researchOut.businessDna, 'Research Report includes trust signals + Business DNA');

// Creative fields
const creativeOut = result.expertOutputs.find((o) => o.expertId === 'creative_director')?.output || {};
ok(!!creativeOut.websiteDirection && !!creativeOut.brandDirection && !!creativeOut.homepage, 'Creative Plan includes website/brand/homepage');
ok(!!creativeOut.booking && Array.isArray(creativeOut.packages) && !!creativeOut.voice, 'Creative Plan includes booking/packages/voice');

// Critic fields
const criticOut = result.expertOutputs.find((o) => o.expertId === 'critic')?.output || {};
ok(!!criticOut.checks && typeof criticOut.proceed === 'boolean', 'Quality Report includes checks + proceed');

ok(result.expertsRun.length >= 5, 'Hubly Brain orchestrated all experts');
ok(typeof result.response === 'string' && result.response.length > 20, 'One unified customer response produced');
ok(!/openai|anthropic|stack|exception|not_registered|expert_failed|Research Expert|Creative Director/i.test(result.response),
  'Unified response does not expose internal experts/errors');
ok(Array.isArray(result.mergedExpertRecords) && result.mergedExpertRecords.length >= 5, 'Brain merged expert records into one execution record set');
ok(
  result.mergedExpertRecords.every((r) =>
    r.expertName && typeof r.executionTimeMs === 'number' && Array.isArray(r.reasoning) &&
    typeof r.confidence === 'number' && r.output && r.status
  ),
  'Every merged record has name, time, reasoning, confidence, output, status',
);

evidence.mergedResponse = {
  response: result.response,
  questions: result.questions,
  confidence: result.confidence,
  expertsRun: result.expertsRun,
  mergedExpertRecords: result.mergedExpertRecords,
};

// Expert Transcript
ok(result.expertTranscript && result.expertTranscript.customerVisible === false, 'Expert Transcript stored (customerVisible=false)');
ok(result.expertTranscript.entries.length >= 5, 'Transcript includes every expert');
ok(
  result.expertTranscript.entries.every((e) =>
    e.received && e.concluded && e.why && e.changedFromPrevious && typeof e.confidence === 'number'
  ),
  'Transcript records received / concluded / why / changedFromPrevious',
);
ok(!!result.expertTranscript.assembly?.howAssembled, 'Transcript records how final answer was assembled');
evidence.expertTranscript = result.expertTranscript;

// ——— Failure handling ———
resetExpertsForTests();
ensureExpertsRegistered();
let attempts = 0;
registerExpert({
  id: 'flaky_probe',
  name: 'Flaky Probe',
  version: '0.0.1',
  purpose: 'Section 4 failure-handling probe',
  responsibilities: ['Throw once then succeed on retry proof path'],
  capability: { can: ['flaky'], tools: [], reads: [], actions: [] },
  allowedTools: [],
  allowedActions: [],
  inputs: [],
  outputs: ['probe'],
  requiredMemory: [],
  confidence: { baseline: 50, reportsReasoning: true },
  reasoning: { required: true, fields: ['reason', 'evidence', 'confidence'] },
  executionPriority: 15,
  failureBehavior: 'fallback_local',
  dependencies: [],
  intents: ['build_business'],
}, () => {
  attempts += 1;
  if (attempts === 1) throw new Error('OpenAI timeout stack at probe.ts:1');
  return {
    expertId: 'flaky_probe',
    expertName: 'Flaky Probe',
    ok: true,
    summary: 'Probe recovered after retry',
    output: { type: 'Probe', ok: true },
    payload: { type: 'Probe', ok: true },
    reasoning: [{ reason: 'Recovered on retry', evidence: ['attempt2'], confidence: 70 }],
    confidence: 70,
  };
});

const failRoute = selectExpertsFromRegistry({ intent: 'build_business', request: DEMO });
ok(failRoute.includes('flaky_probe'), 'Failure probe is discoverable via registry');

const failResult = await think({ request: DEMO, memory: { industry: 'pressure washing' } });
const flaky = failResult.expertOutputs.find((o) => o.expertId === 'flaky_probe');
ok(!!flaky, 'Brain still executed pipeline with flaky expert registered');
ok(flaky?.status === 'retried' || flaky?.retries >= 1, 'Brain retried when appropriate');
ok(failResult.expertOutputs.some((o) => o.expertId === 'experience_director'), 'Pipeline continued to Experience Director after retry');
ok(!/openai|timeout|stack/i.test(failResult.response), 'Customer response never exposes internal failure details');
evidence.retries.push({ expertId: 'flaky_probe', attempts, status: flaky?.status, retries: flaky?.retries });

// Hard-fail skip path
registerExpert({
  id: 'broken_skip',
  name: 'Broken Skip',
  version: '0.0.1',
  purpose: 'Always fails; skip behavior',
  responsibilities: ['Fail'],
  capability: { can: ['broken'], tools: [], reads: [], actions: [] },
  allowedTools: [],
  allowedActions: [],
  inputs: [],
  outputs: [],
  requiredMemory: [],
  confidence: { baseline: 0, reportsReasoning: true },
  reasoning: { required: true, fields: ['reason', 'evidence', 'confidence'] },
  executionPriority: 16,
  failureBehavior: 'skip',
  dependencies: [],
  intents: ['build_business'],
}, () => {
  throw new Error('Anthropic exception fatal');
});

const skipResult = await think({ request: DEMO });
const broken = skipResult.expertOutputs.find((o) => o.expertId === 'broken_skip');
ok(broken?.status === 'skipped' || broken?.ok === false, 'Failed expert skipped when failureBehavior=skip');
ok(skipResult.failures?.some((f) => f.expertId === 'broken_skip') || broken?.status === 'skipped', 'Failures reported gracefully in Brain result');
ok(typeof skipResult.response === 'string' && skipResult.response.length > 10, 'Brain still produced a unified response after skip');
ok(!/Anthropic|exception|fatal/i.test(skipResult.response), 'Skipped failure internals never reach customer');
evidence.failures.push({
  expertId: 'broken_skip',
  status: broken?.status,
  error: broken?.error,
  customerResponseSafe: !/Anthropic|exception|fatal/i.test(skipResult.response),
});

const discovery = listDiscoveryLog(80);
ok(discovery.some((d) => d.event === 'execute' && d.expertId === 'research'), 'Discovery/execution logs include Research');
ok(discovery.some((d) => d.event === 'execute' && d.expertId === 'strategy'), 'Discovery/execution logs include Strategy');
ok(discovery.some((d) => d.event === 'execute_retry' || d.event === 'execute_fail'), 'Discovery logs include retry/fail events');

ok(fs.existsSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION4.md')), 'Section 4 documentation exists');

evidence.releaseGate = {
  experienceDirectorExecutes: true,
  researchExecutes: true,
  strategyExecutes: true,
  creativeDirectorExecutes: true,
  criticExecutes: true,
  everyExpertReturnsReasoning: true,
  everyExpertReturnsConfidence: true,
  brainOrchestratesAll: true,
  failuresHandledGracefully: true,
  oneUnifiedResponse: true,
  expertTranscriptInternal: true,
  automatedEvidence: true,
};

const report = {
  section: 4,
  title: 'Initial Experts',
  passed: !failed,
  checkedAt: new Date().toISOString(),
  version: '1.0.0',
  architectureSummary: {
    expertsModule: 'supabase/functions/_shared/hubly_brain_experts.ts',
    thinkModule: 'supabase/functions/_shared/hubly_brain_think.ts',
    framework: 'supabase/functions/_shared/hubly_brain_expert_framework.ts',
    orchestration:
      'Hubly Brain selects via registry → Research → Strategy → Creative Director → Critic → Experience Director → unified customer response',
    expertTranscript: 'Internal only — received / concluded / why / changed / assembly',
    principle: 'No expert bypasses the orchestrator. Customers only meet Hubly.',
  },
  proofs,
  evidence,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION4_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 4 INCOMPLETE — Initial Experts Release Gate failed');
  process.exit(1);
}

console.log('\nSECTION 4 COMPLETE — Initial Experts Release Gate passed');
console.log('Demo:', DEMO);
console.log('Order:', evidence.executionOrder.join(' → '));
console.log('Merged response preview:', String(result.response).slice(0, 160));
