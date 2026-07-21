#!/usr/bin/env node
/**
 * Craft checks for Hubly Brain — Understanding vs Memory separation.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const memory = fs.readFileSync('supabase/functions/_shared/hubly_brain_memory.ts', 'utf8');
const understanding = fs.readFileSync('supabase/functions/_shared/hubly_brain_understanding.ts', 'utf8');
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
ok(memory.includes('normalizeBusinessMemory'), 'Business Memory normalize');
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
ok(shared.includes('ingest('), 'Brain.ingest Conversation→Understanding→Memory→Plan');
ok(shared.includes('understand('), 'Brain.understand');
ok(/plan\(memory/.test(shared) || shared.includes('plan(memory?'), 'Brain.plan(memory) only');
ok(!/plan\(goal: string/.test(shared), 'Brain.plan must not take raw goal string');
ok(skills.includes('buildWebsite') && skills.includes('createCrm'), 'core skills');
ok(statusFn.includes('ingest'), 'status demo uses ingest');
ok(client.includes('buildBusinessMemory'), 'client Business Memory builder');
ok(client.includes('Understanding interprets language') ||
  client.includes('Planner reasons only from Memory'), 'client documents separation');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still on Claude (no feature migration)');

if (failed) process.exit(1);
console.log('OK Hubly Brain Understanding/Memory separation checks passed');
