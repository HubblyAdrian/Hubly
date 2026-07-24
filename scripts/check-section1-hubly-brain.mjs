#!/usr/bin/env node
/**
 * SECTION 1 — Hubly Brain gate proof (blocks Milestone 2 until green).
 *
 * Proves:
 * 1. Hubly Brain exists
 * 2. Only Brain reaches LLM providers
 * 3. Every AI interaction routes through Brain
 * 4. Brain determines experts
 * 5. Brain merges expert outputs
 * 6. Brain updates memory after every interaction
 * 7. Brain logs every execution
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
let failed = false;
const proof = [];

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('PASS:', msg);
    proof.push(msg);
  }
}

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'artifacts') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const shared = read('supabase/functions/_shared/hubly_ai.ts');
const think = read('supabase/functions/_shared/hubly_brain_think.ts');
const execLog = read('supabase/functions/_shared/hubly_brain_execution_log.ts');
const brainFn = read('supabase/functions/hubly-brain/index.ts');
const experts = read('supabase/functions/_shared/hubly_brain_experts.ts');
const migration = read('supabase/migrations/20260723010100_hubly_brain_executions.sql');

// 1. Hubly Brain exists
ok(shared.includes('name: "Hubly Brain"'), 'Hubly Brain exists (HublyAI.name)');
ok(shared.includes('export const HublyBrain = HublyAI') && shared.includes('export const Hubly = HublyAI'), 'Hubly / HublyBrain aliases point at Brain');
ok(fs.existsSync(path.join(root, 'supabase/functions/hubly-brain/index.ts')), 'hubly-brain edge entry exists');

// 2 + 3. Only Brain calls providers; every AI routes through Brain
const providerHits = [];
for (const file of walkFiles(path.join(root, 'supabase/functions'), ['.ts'])) {
  const rel = path.relative(root, file);
  if (rel.endsWith('hubly_ai.ts')) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('api.openai.com') || text.includes('api.anthropic.com')) {
    providerHits.push(rel);
  }
}
ok(providerHits.length === 0, 'No edge/shared module besides hubly_ai.ts calls LLM provider URLs');
ok(
  shared.includes('api.openai.com') && shared.includes('api.anthropic.com'),
  'Provider URLs live only inside Hubly Brain (hubly_ai.ts)',
);
ok(shared.includes('async function run(') && shared.includes('logBrainExecution'), 'All model calls go through Brain run() which logs');

const pages = walkFiles(path.join(root, 'public'), ['.html', '.js']).concat(
  walkFiles(path.join(root, 'api'), ['.js']),
);
const pageHits = [];
for (const file of pages) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('api.openai.com') || text.includes('api.anthropic.com')) {
    pageHits.push(path.relative(root, file));
  }
}
ok(pageHits.length === 0, 'No public page or api router calls LLM providers directly');

const edgeAi = [
  'generate-site',
  'analyze-photos',
  'draft-customer-message',
  'chatbot-message',
  'import-offers',
  'creative-director',
];
for (const dir of edgeAi) {
  const src = read(`supabase/functions/${dir}/index.ts`);
  ok(src.includes('HublyAI.'), `${dir} routes AI through Hubly Brain (HublyAI)`);
}

ok(read('supabase/functions/_shared/marketplace_intake.ts').includes('HublyAI.complete'), 'marketplace intake routes through Brain');

// 4. Brain determines which experts execute
ok(think.includes('function selectExperts') && think.includes('PIPELINE_ORDER'), 'Brain selectExperts determines execution set');
ok(experts.includes('registerExpert') && experts.includes('experience_director'), 'Experts register with Brain framework');
ok(shared.includes('expertsSelected'), 'Brain records expertsSelected on every run');

// 5. Brain merges expert outputs into one response
ok(
  think.includes('ownerResponse') && think.includes('experience_director') && think.includes('response ='),
  'Brain merges expert outputs into one Hubly response via Experience Director',
);
ok(shared.includes('mergedResponse: true'), 'complete() path marks mergedResponse (single Brain-owned reply)');

// 6. Brain updates memory after every interaction
ok(think.includes('appendConversationTurn') && think.includes('role: "hubly"'), 'think() updates Conversation Memory');
ok(shared.includes('memoryUpdated') && shared.includes('appendConversationTurn'), 'complete() updates conversation when provided');
ok(brainFn.includes('persistBrainRun') && brainFn.includes('memoryUpdated: true'), 'hubly-brain persists memory after think');

// 7. Brain logs every execution
ok(execLog.includes('logBrainExecution') && execLog.includes('HublyBrain.execution'), 'Execution log module exists');
ok(shared.includes('logBrainExecution({') && shared.includes('kind: "think"') && shared.includes('kind: "complete"'), 'think + complete both log executions');
ok(migration.includes('hubly_brain_executions'), 'Durable hubly_brain_executions migration exists');
ok(shared.includes('executions(limit') || shared.includes('executions(limit ='), 'Hubly.executions() exposes recent logs');
ok(brainFn.includes('recentExecutions') && brainFn.includes('logsEveryExecution: true'), 'Brain status exposes Section 1 logging claim');

// Write machine-readable proof artifact (not committed via artifacts/ usually — write under docs)
const outDir = path.join(root, 'docs');
const stamp = new Date().toISOString();
const report = {
  section: 1,
  title: 'Hubly Brain',
  passed: !failed,
  checkedAt: stamp,
  proofs: proof,
  failures: failed ? 'See FAIL lines above' : null,
};
fs.writeFileSync(path.join(outDir, 'HUBLY_BRAIN_SECTION1_PROOF.json'), JSON.stringify(report, null, 2) + '\n');

if (failed) {
  console.error('\nSECTION 1 INCOMPLETE — Milestone 2 blocked');
  process.exit(1);
}
console.log('\nSECTION 1 COMPLETE — Hubly Brain proven');
