#!/usr/bin/env node
/**
 * Craft checks for Hubly Brain (Business Memory Phase 7.1).
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const memory = fs.readFileSync('supabase/functions/_shared/hubly_brain_memory.ts', 'utf8');
const skills = fs.readFileSync('supabase/functions/_shared/hubly_brain_skills.ts', 'utf8');
const planner = fs.readFileSync('supabase/functions/_shared/hubly_brain_planner.ts', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(shared.includes('Hubly Brain'), 'Hubly Brain naming');
ok(shared.includes('export const HublyBrain'), 'HublyBrain export');
ok(shared.includes('export const HublyAI'), 'HublyAI alias export');
ok(memory.includes('HublyBusinessMemory'), 'Business Memory type');
ok(memory.includes('normalizeBusinessMemory'), 'normalizeBusinessMemory');
ok(memory.includes('formatBusinessMemory'), 'formatBusinessMemory');
ok(memory.includes('name?:') && memory.includes('industry?:') && memory.includes('services?:'), 'core memory fields');
ok(memory.includes('currentWebsite') && memory.includes('connectedAccounts'), 'website + connected accounts');
ok(memory.includes('previousConversations'), 'conversation memory field');
ok(skills.includes('buildWebsite') && skills.includes('createCrm') && skills.includes('generateQuote'), 'core skills');
ok(skills.includes('coachBusiness') && skills.includes('understandBusiness'), 'coach + understand skills');
ok(planner.includes('proposePlanFromText'), 'planner stub');
ok(planner.includes('executePlanStub'), 'executor stub');
ok(shared.includes('async plan(') || shared.includes('plan(goal'), 'Brain.plan');
ok(shared.includes('execute('), 'Brain.execute');
ok(shared.includes('gpt-5.5'), 'GPT-5.5 reasoning model');
ok(!shared.includes('gpt-4.1-mini'), 'must not default to gpt-4.1-mini');
ok(shared.includes('7.1') && shared.includes('7.2') && shared.includes('7.3') && shared.includes('7.4'), 'phases 7.1–7.4');
ok(statusFn.includes('HublyBrain'), 'status uses HublyBrain');
ok(client.includes('buildBusinessMemory'), 'client Business Memory builder');
ok(client.includes('HublyBrain'), 'client HublyBrain alias');
ok(/Conversation → Business Understanding → Business Memory → Planner/i.test(shared) ||
  shared.includes('Business Memory → Planner'), 'pipeline documented');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still on Claude (no feature migration yet)');

if (failed) process.exit(1);
console.log('OK Hubly Brain Business Memory checks passed');
