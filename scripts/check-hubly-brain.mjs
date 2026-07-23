#!/usr/bin/env node
/**
 * Milestone 1 — Hubly Brain Foundation structural checklist.
 * No network. Fails if experts, think pipeline, or direct provider calls regress.
 */
import fs from 'fs';
import path from 'path';

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('OK:', msg);
  }
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

const root = process.cwd();
const shared = read(path.join(root, 'supabase/functions/_shared/hubly_ai.ts'));
const framework = read(path.join(root, 'supabase/functions/_shared/hubly_brain_expert_framework.ts'));
const experts = read(path.join(root, 'supabase/functions/_shared/hubly_brain_experts.ts'));
const think = read(path.join(root, 'supabase/functions/_shared/hubly_brain_think.ts'));
const dna = read(path.join(root, 'supabase/functions/_shared/hubly_brain_dna.ts'));
const workspace = read(path.join(root, 'supabase/functions/_shared/hubly_brain_workspace_memory.ts'));
const convo = read(path.join(root, 'supabase/functions/_shared/hubly_brain_conversation_memory.ts'));
const reasoning = read(path.join(root, 'supabase/functions/_shared/hubly_brain_reasoning.ts'));
const confidence = read(path.join(root, 'supabase/functions/_shared/hubly_brain_confidence_policy.ts'));
const brainFn = read(path.join(root, 'supabase/functions/hubly-brain/index.ts'));
const consoleHtml = read(path.join(root, 'public/brain-console.html'));
const migration = read(path.join(root, 'supabase/migrations/20260723010000_hubly_brain_milestone1_memory.sql'));
const docs = read(path.join(root, 'docs/HUBLY_BRAIN.md'));
const client = read(path.join(root, 'public/hubly.html'));
const config = read(path.join(root, 'supabase/config.toml'));
const router = read(path.join(root, 'api/router.js'));

ok(framework.includes('registerExpert') && framework.includes('capability'), 'Expert Framework + capability shape');
ok(framework.includes('can:') || framework.includes('can:'), 'Capability Registry can[]');
ok(framework.includes('tools') && framework.includes('reads') && framework.includes('actions'), 'Capability Registry tools/reads/actions');

for (const id of ['experience_director', 'research', 'strategy', 'creative_director', 'critic']) {
  ok(experts.includes(`id: "${id}"`), `expert registered: ${id}`);
}

ok(think.includes('export async function think') && think.includes('Experience Director'), 'think pipeline');
ok(think.includes('confidenceBand') && think.includes('PIPELINE_ORDER'), 'confidence + ordered pipeline');
ok(shared.includes('async think(') && shared.includes('experts()'), 'HublyAI.think / experts');
ok(shared.includes('hublyBrainThinkPipeline') && shared.includes('aiCapabilityRegistry'), 'status checklist flags');
ok(dna.includes('customerPsychology') && dna.includes('commonObjections'), 'DNA knowledge expansion');
ok(workspace.includes('sidebarOrder') && convo.includes('pendingTasks'), 'workspace + conversation memory');
ok(reasoning.includes('makeDecision') && confidence.includes('research_more'), 'reasoning + confidence policy');
ok(brainFn.includes('Hubly.think') && brainFn.includes('persistBrainRun'), 'hubly-brain entry + persist');
ok(config.includes('[functions.hubly-brain]'), 'config.toml hubly-brain');
ok(consoleHtml.includes('Brain Console') && consoleHtml.includes('hubly-brain'), 'Brain Console UI');
ok(router.includes('/brain-console'), 'router serves Brain Console');
ok(client.includes('async think(') && client.includes('hubly-brain'), 'client Hubly.think facade');
ok(docs.includes('AI Capability Registry') && docs.includes('Definition of Done'), 'docs/HUBLY_BRAIN.md');
ok(migration.includes('workspace_memories') && migration.includes('hubly_reasoning_events'), 'memory migration');

const edgeDirs = [
  'generate-site',
  'analyze-photos',
  'draft-customer-message',
  'chatbot-message',
  'import-offers',
  'creative-director',
];
for (const dir of edgeDirs) {
  const src = read(path.join(root, `supabase/functions/${dir}/index.ts`));
  ok(src.includes('HublyAI'), `${dir} uses HublyAI`);
  ok(!src.includes('api.anthropic.com') && !src.includes('api.openai.com'), `${dir} has no direct provider URL`);
}

const marketplaceIntake = read(path.join(root, 'supabase/functions/_shared/marketplace_intake.ts'));
ok(marketplaceIntake.includes('HublyAI.complete'), 'marketplace intake uses HublyAI');
ok(!marketplaceIntake.includes('api.anthropic.com'), 'marketplace intake has no direct Anthropic URL');

if (failed) process.exit(1);
console.log('\nHubly Brain Milestone 1 checklist passed');
