#!/usr/bin/env node
/**
 * Craft checks for Hubly Brain foundation lock.
 * Checklist:
 *  - GPT-5.5 connected
 *  - AI abstraction layer
 *  - Business Memory SSOT
 *  - Conversation → Understanding → Memory
 *  - Planner separated from Memory
 *  - Capability registry foundation
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const memory = fs.readFileSync('supabase/functions/_shared/hubly_brain_memory.ts', 'utf8');
const understanding = fs.readFileSync('supabase/functions/_shared/hubly_brain_understanding.ts', 'utf8');
const skills = fs.readFileSync('supabase/functions/_shared/hubly_brain_skills.ts', 'utf8');
const planner = fs.readFileSync('supabase/functions/_shared/hubly_brain_planner.ts', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260721200000_business_memories_ssot.sql', 'utf8');
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
ok(shared.includes('DEFAULT_REASONING_MODEL = "gpt-5.5"') || shared.includes('gpt-5.5'), 'GPT-5.5 connected');
ok(shared.includes('callOpenAI') && shared.includes('callClaude'), 'AI abstraction layer providers');
ok(shared.includes('TASK_ROUTES') || shared.includes('resolveTask'), 'AI abstraction task routing');
ok(shared.includes('foundationChecklist'), 'foundation checklist in status');

ok(memory.includes('normalizeBusinessMemory'), 'Business Memory normalize');
ok(memory.includes('HublyBusinessMemory'), 'Business Memory type');
ok(migration.includes('business_memories'), 'Business Memory SSOT table');
ok(migration.includes('enable row level security'), 'Business Memory RLS');

ok(understanding.includes('understandConversation'), 'Understanding layer');
ok(understanding.includes('Only layer allowed to read free-form language') ||
  understanding.includes('only layer allowed to read free-form language') ||
  understanding.includes('only Brain step that reads raw language'), 'Understanding owns raw language');
ok(understanding.includes('memoryPatch'), 'Understanding writes memory patch');

ok(planner.includes('proposePlanFromMemory'), 'Planner from memory');
ok(planner.includes('NEVER inspect raw') || planner.includes('must NEVER inspect raw') ||
  planner.includes('must never inspect raw'), 'Planner forbids raw conversation');
ok(planner.includes('source: "business_memory"'), 'Plan source is business_memory');
ok(/proposePlanFromText[\s\S]*deprecated/i.test(planner), 'raw-text planner deprecated');
ok(!planner.includes('understandConversation'), 'Planner does not import Understanding');

ok(shared.includes('ingest('), 'Brain.ingest Conversation→Understanding→Memory→Plan');
ok(shared.includes('understand('), 'Brain.understand');
ok(/plan\(memory/.test(shared) || shared.includes('plan(memory?'), 'Brain.plan(memory) only');
ok(!/plan\(goal: string/.test(shared), 'Brain.plan must not take raw goal string');

ok(skills.includes('HUBLY_SKILLS') || skills.includes('listSkills'), 'Capability registry');
ok(skills.includes('buildWebsite') && skills.includes('createCrm'), 'core skills');
ok(skills.includes('executable: false') || skills.includes('executable:false'), 'skills gated until executors');

ok(statusFn.includes('ingest'), 'status demo uses ingest');
ok(statusFn.includes('foundationChecklist') || statusFn.includes('foundation-locked'), 'status reports foundation');

ok(client.includes('buildBusinessMemory'), 'client Business Memory builder');
ok(client.includes('syncBusinessMemory') || client.includes('business_memories'), 'client Memory persistence path');
ok(client.includes('gpt-5.5'), 'client mirrors GPT-5.5');
ok(client.includes('Understanding interprets language') ||
  client.includes('Planner reasons only from Memory'), 'client documents separation');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still on Claude (no early feature migration)');

if (failed) process.exit(1);
console.log('OK Hubly Brain foundation checklist passed');
