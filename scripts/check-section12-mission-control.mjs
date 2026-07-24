#!/usr/bin/env node
/**
 * SECTION 12 — Hubly Mission Control Release Gate
 *
 * AI Headquarters + AI Replay (flight recorder) — not a simple debug console.
 */
import fs from 'fs';
import path from 'path';
import {
  MISSION_CONTROL_VERSION,
  MISSION_CONTROL_OWNER,
  clearMissionControlForTests,
  getMissionControlSnapshot,
  replayExecution,
} from './lib/mission-control.mjs';
import { clearRegistryForTests } from './lib/expert-framework.mjs';
import { resetExpertsForTests, ensureExpertsRegistered } from './lib/initial-experts.mjs';
import { clearRegistriesForTests, ensureRegistriesBootstrapped } from './lib/registries.mjs';
import { think } from './lib/think.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  snapshot: null,
  liveAiActivity: null,
  expertActivity: null,
  decisionGraph: null,
  builderActions: null,
  capabilityRegistry: null,
  knowledgeRegistry: null,
  brainTimeline: null,
  aiHealth: null,
  replay: null,
  thinkFlight: null,
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

clearMissionControlForTests();
clearRegistriesForTests();
clearRegistryForTests();
resetExpertsForTests();
ensureExpertsRegistered();
ensureRegistriesBootstrapped();

const mcSrc = read('supabase/functions/_shared/hubly_brain_mission_control.ts');
const thinkSrc = read('supabase/functions/_shared/hubly_brain_think.ts');
const aiSrc = read('supabase/functions/_shared/hubly_ai.ts');
const htmlSrc = fs.existsSync(path.join(root, 'public/brain-console.html'))
  ? read('public/brain-console.html')
  : '';

ok(mcSrc.includes('MISSION_CONTROL_VERSION'), 'Hubly Mission Control module exists');
ok(mcSrc.includes('recordFlightRecorder') && mcSrc.includes('replayExecution'), 'AI Replay / flight recorder exists');
ok(mcSrc.includes('getMissionControlSnapshot'), 'Mission Control snapshot API exists');
ok(mcSrc.includes('liveAiActivity') || mcSrc.includes('liveActivity'), 'Live AI Activity modeled');
ok(mcSrc.includes('expertActivity') || mcSrc.includes('getExpertActivity'), 'Expert Activity modeled');
ok(mcSrc.includes('decisionGraph'), 'Decision Graph surface exists');
ok(mcSrc.includes('builderActions') && mcSrc.includes('1.5'), 'Builder Actions placeholder for Milestone 1.5');
ok(mcSrc.includes('capabilityRegistry') && mcSrc.includes('knowledgeRegistry'), 'Registries surfaced in Mission Control');
ok(mcSrc.includes('aiHealth') || mcSrc.includes('computeAiHealth'), 'AI Health modeled');
ok(thinkSrc.includes('recordFlightRecorder'), 'Think records Mission Control flights');
ok(aiSrc.includes('HublyMissionControl'), 'HublyAI exposes Mission Control');
ok(MISSION_CONTROL_OWNER === 'hubly_brain', 'Mission Control owned by Hubly Brain');
ok(MISSION_CONTROL_VERSION === '1.0.0', 'Mission Control versioned');

// End-to-end think → flight → replay
const result = await think({
  request: "I'm redesigning my website and I want arrival windows.",
  businessId: 'biz_section12',
  memory: {
    businessId: 'biz_section12',
    name: 'Mission Control Demo',
    industry: 'pressure washing',
    memoryVersion: 1,
  },
});

ok(!!result.missionControlExecutionId, 'Think returns Mission Control execution id');
ok(!!result.flightRecorder, 'Think attaches flight recorder snapshot');
ok(result.flightRecorder.memoriesLoaded.includes('business_memory'), 'Flight records memories loaded');
ok(result.flightRecorder.memoriesLoaded.includes('business_dna'), 'Flight records Business DNA loaded');
ok(result.flightRecorder.expertOrder.length >= 3, 'Flight records expert execution order');
ok(result.flightRecorder.reasoningObjects.length >= 1, 'Flight records Reasoning Objects');
ok(result.flightRecorder.decisionObjects.length >= 1, 'Flight records Decision Objects');
ok(
  result.flightRecorder.capabilitiesSelected.some((c) => c.capabilityId === 'arrival_windows'),
  'Flight records selected capabilities (arrival windows)',
);
ok(!!result.flightRecorder.finalResponse, 'Flight records final response');
ok(result.flightRecorder.memoryWrites.length >= 1, 'Flight records memory writes');
ok(result.flightRecorder.timeline.length >= 5, 'Flight timeline has multiple phases');
evidence.thinkFlight = {
  executionId: result.missionControlExecutionId,
  memoriesLoaded: result.flightRecorder.memoriesLoaded,
  expertOrder: result.flightRecorder.expertOrder,
  reasoningCount: result.flightRecorder.reasoningObjects.length,
  decisionCount: result.flightRecorder.decisionObjects.length,
  capabilities: result.flightRecorder.capabilitiesSelected,
  knowledge: result.flightRecorder.knowledgeAccessed,
  timelinePhases: result.flightRecorder.timeline.map((e) => e.phase),
  liveActivity: result.flightRecorder.liveActivity,
};

const replay = replayExecution(result.missionControlExecutionId);
ok(replay.replay === true, 'Replay Execution API available');
ok(replay.steps.length >= 5, 'Replay shows step-by-step timeline');
ok(replay.summary?.request?.includes('redesigning') || /website|arrival/i.test(replay.summary?.request || ''), 'Replay includes original request');
ok(Array.isArray(replay.summary?.memoriesLoaded), 'Replay includes memories loaded');
ok(Array.isArray(replay.summary?.expertOrder), 'Replay includes expert order');
ok(typeof replay.summary?.reasoningCount === 'number', 'Replay includes reasoning count');
ok(typeof replay.summary?.decisionCount === 'number', 'Replay includes decision count');
ok(Array.isArray(replay.summary?.capabilities), 'Replay includes capabilities selected');
ok(typeof replay.summary?.finalResponse === 'string', 'Replay includes final response');
ok(Array.isArray(replay.summary?.memoryWrites), 'Replay includes memory writes');
evidence.replay = {
  executionId: replay.executionId,
  stepCount: replay.steps.length,
  summary: replay.summary,
  steps: replay.steps.slice(0, 12),
};

const snap = getMissionControlSnapshot();
ok(snap.title === 'Hubly Mission Control', 'Snapshot titled Hubly Mission Control (not Admin/Dashboard)');
ok(snap.replayAvailable === true, 'Snapshot advertises Replay');
ok(!!snap.liveAiActivity && Object.keys(snap.liveAiActivity).length >= 4, 'Live AI Activity present');
ok(Array.isArray(snap.expertActivity) && snap.expertActivity.length >= 1, 'Expert Activity present');
ok(snap.businessMemory?.inspectable && snap.workspaceMemory?.inspectable, 'Memory surfaces inspectable');
ok(snap.conversationIntelligence?.inspectable, 'Conversation Intelligence surface present');
ok(snap.decisionGraph?.nodes?.length >= 2 && snap.decisionGraph?.edges?.length >= 1, 'Decision Graph present');
ok(snap.builderActions?.milestone === '1.5' && snap.builderActions?.available === false, 'Builder Actions reserved for Milestone 1.5');
ok(snap.capabilityRegistry?.length >= 5, 'Capability Registry listed in Mission Control');
ok(snap.knowledgeRegistry?.length >= 5, 'Knowledge Registry listed in Mission Control');
ok(Array.isArray(snap.brainTimeline), 'Brain Timeline present');
ok(typeof snap.aiHealth?.avgLatencyMs === 'number' && typeof snap.aiHealth?.okRate === 'number', 'AI Health metrics present');
ok(snap.recentExecutions?.length >= 1, 'Recent executions listed');

evidence.snapshot = {
  title: snap.title,
  version: snap.version,
  replayAvailable: snap.replayAvailable,
};
evidence.liveAiActivity = snap.liveAiActivity;
evidence.expertActivity = snap.expertActivity;
evidence.decisionGraph = snap.decisionGraph;
evidence.builderActions = snap.builderActions;
evidence.capabilityRegistry = snap.capabilityRegistry;
evidence.knowledgeRegistry = snap.knowledgeRegistry;
evidence.brainTimeline = snap.brainTimeline.slice(0, 15);
evidence.aiHealth = snap.aiHealth;

// UI surface (optional upgrade of legacy console page)
if (htmlSrc) {
  ok(/Mission Control|Brain Console/i.test(htmlSrc), 'Internal Mission Control / console HTML surface exists');
}

evidence.releaseGate = {
  missionControlExists: true,
  liveAiActivity: !!snap.liveAiActivity,
  expertActivity: snap.expertActivity.length >= 1,
  memorySurfaces: true,
  conversationIntelligence: true,
  decisionGraph: snap.decisionGraph.nodes.length >= 2,
  builderActionsPlaceholder: snap.builderActions.milestone === '1.5',
  capabilityRegistry: snap.capabilityRegistry.length >= 5,
  knowledgeRegistry: snap.knowledgeRegistry.length >= 5,
  brainTimeline: Array.isArray(snap.brainTimeline),
  aiHealth: typeof snap.aiHealth.okRate === 'number',
  aiReplay: replay.steps.length >= 5 && !!replay.summary,
  flightRecorderFromThink: !!result.missionControlExecutionId,
  automatedEvidence: true,
};

ok(Object.values(evidence.releaseGate).every(Boolean), 'All Section 12 release-gate claims proven');

const report = {
  section: 12,
  title: 'Hubly Mission Control',
  passed: !failed,
  version: MISSION_CONTROL_VERSION,
  owner: MISSION_CONTROL_OWNER,
  checkedAt: new Date().toISOString(),
  proofs,
  evidence,
  failures: failed ? 'One or more Section 12 checks failed — see console.' : null,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION12_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 12 INCOMPLETE — Hubly Mission Control');
  process.exit(1);
}

console.log('\nSECTION 12 PASS — Hubly Mission Control');
console.log('Evidence:', path.join(root, 'docs/HUBLY_BRAIN_SECTION12_PROOF.json'));
process.exit(0);
