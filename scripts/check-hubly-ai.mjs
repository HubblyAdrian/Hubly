#!/usr/bin/env node
/**
 * Craft checks — Hubly Brain foundation rules must stay intact.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const foundation = fs.readFileSync('supabase/functions/_shared/hubly_brain_foundation.ts', 'utf8');
const memory = fs.readFileSync('supabase/functions/_shared/hubly_brain_memory.ts', 'utf8');
const understanding = fs.readFileSync('supabase/functions/_shared/hubly_brain_understanding.ts', 'utf8');
const skills = fs.readFileSync('supabase/functions/_shared/hubly_brain_skills.ts', 'utf8');
const planner = fs.readFileSync('supabase/functions/_shared/hubly_brain_planner.ts', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const notes = fs.readFileSync('PROJECT_NOTES.md', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(foundation.includes('HUBLY_BRAIN_RULES'), 'foundation rules export');
ok(foundation.includes('HUBLY_BRAIN_PIPELINE'), 'foundation pipeline');
ok(foundation.includes('HublyBrainTrace') || foundation.includes('HublyBrainTrace'), 'observability trace type');
for (const needle of [
  'Understanding interprets language only',
  'Business Memory is the single source of truth',
  'Planner reasons only from Memory',
  'Planner never executes work',
  'Capabilities describe what Hubly can do',
  'Executors perform the work',
  'AI never directly modifies the database',
  'Every business change should flow through a capability',
  'reversible where practical',
  'Brain should be observable',
]) {
  ok(foundation.includes(needle), `rule text: ${needle}`);
}

ok(understanding.includes('understandConversation'), 'Understanding layer');
ok(memory.includes('normalizeBusinessMemory'), 'Memory layer');
ok(planner.includes('proposePlanFromMemory'), 'Planner memory-only');
ok(planner.includes('must NEVER inspect raw') || planner.includes('NEVER inspect raw'), 'Planner forbids raw chat');
ok(shared.includes('inspect('), 'Brain.inspect observability');
ok(shared.includes('run('), 'Brain.run observability');
ok(/plan\(memory/.test(shared), 'Brain.plan(memory)');
ok(!/plan\(goal: string/.test(shared), 'plan must not take raw goal');
ok(skills.includes('reversible'), 'capabilities mark reversibility');
ok(!/id: "understandBusiness"/.test(skills), 'Understanding is not a capability skill');
ok(statusFn.includes('HUBLY_BRAIN_RULES') || statusFn.includes('rules:'), 'status exposes rules');
ok(statusFn.includes('sampleTrace') || statusFn.includes('inspect'), 'status exposes trace');
ok(notes.includes('Hubly Brain') && notes.includes('do not collapse'), 'PROJECT_NOTES foundation');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'no premature Claude migration');

if (failed) process.exit(1);
console.log('OK Hubly Brain foundation rules checks passed');
