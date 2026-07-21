#!/usr/bin/env node
/**
 * Craft checks for Hubly Brain + Runtime + Business DNA (Phase 7.6).
 * Does NOT require Website Builder migration.
 * Architecture is frozen after DNA — migrate capabilities next.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const memory = fs.readFileSync('supabase/functions/_shared/hubly_brain_memory.ts', 'utf8');
const dna = fs.readFileSync('supabase/functions/_shared/hubly_brain_dna.ts', 'utf8');
const confidence = fs.readFileSync('supabase/functions/_shared/hubly_brain_confidence.ts', 'utf8');
const weekly = fs.readFileSync('supabase/functions/_shared/hubly_brain_weekly_learning.ts', 'utf8');
const understanding = fs.readFileSync('supabase/functions/_shared/hubly_brain_understanding.ts', 'utf8');
const skills = fs.readFileSync('supabase/functions/_shared/hubly_brain_skills.ts', 'utf8');
const planner = fs.readFileSync('supabase/functions/_shared/hubly_brain_planner.ts', 'utf8');
const capabilities = fs.readFileSync('supabase/functions/_shared/hubly_brain_capabilities.ts', 'utf8');
const executionPlan = fs.readFileSync('supabase/functions/_shared/hubly_brain_execution_plan.ts', 'utf8');
const progress = fs.readFileSync('supabase/functions/_shared/hubly_brain_progress.ts', 'utf8');
const orchestrator = fs.readFileSync('supabase/functions/_shared/hubly_brain_orchestrator.ts', 'utf8');
const executors = fs.readFileSync('supabase/functions/_shared/hubly_brain_executors.ts', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const buildFn = fs.readFileSync('supabase/functions/hubly-build-business/index.ts', 'utf8');
const migrationMem = fs.readFileSync('supabase/migrations/20260721200000_business_memories_ssot.sql', 'utf8');
const migrationRuns = fs.readFileSync('supabase/migrations/20260721220000_hubly_execution_runs.sql', 'utf8');
const migrationDna = fs.readFileSync('supabase/migrations/20260721230000_business_dna.sql', 'utf8');
const rule = fs.readFileSync('.cursor/rules/hubly-memory-vs-dna.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(shared.includes('Hubly Brain') || shared.includes('Hubly Runtime'), 'Hubly Brain/Runtime naming');
ok(shared.includes('export const HublyBrain'), 'HublyBrain export');
ok(shared.includes('export const Hubly'), 'Hubly public alias');
ok(shared.includes('buildBusiness'), 'Hubly.buildBusiness API');
ok(shared.includes('gpt-5.5'), 'GPT-5.5 connected');
ok(shared.includes('callOpenAI') && shared.includes('callClaude'), 'AI abstraction layer providers');
ok(shared.includes('foundationChecklist'), 'foundation checklist in status');
ok(shared.includes('businessDna') || shared.includes('businessDna: true'), 'DNA checklist flag');
ok(shared.includes('architectureFrozenAfterDna') || shared.includes('FROZEN'), 'architecture freeze after DNA');
ok(shared.includes('Never combine'), 'permanent Memory vs DNA rule in Brain');

ok(memory.includes('normalizeBusinessMemory'), 'Business Memory normalize');
ok(migrationMem.includes('business_memories'), 'Business Memory SSOT table');
ok(migrationRuns.includes('hubly_execution_runs'), 'Execution history table');
ok(migrationDna.includes('business_dna'), 'Business DNA table');
ok(migrationDna.includes('enable row level security'), 'Business DNA RLS');
ok(migrationDna.includes('interpretive') || migrationDna.includes('Never combine') ||
  migrationDna.includes('identity'), 'DNA migration documents separation');

ok(dna.includes('HublyBusinessDNA'), 'BusinessDNA type');
ok(dna.includes('Never combine') || dna.includes('never combine'), 'DNA module permanent rule');
ok(dna.includes('inferDNAFromConversation') && dna.includes('inferDNAFromMemory'), 'DNA inference');
ok(dna.includes('evolveBusinessDNA'), 'DNA evolves');
ok(dna.includes('goals') && dna.includes('customerProfile') && dna.includes('personality'), 'DNA shape');
ok(dna.includes('formatBusinessDNA'), 'DNA prompt formatter');
ok(!dna.includes('from "./hubly_brain_memory.ts"') || dna.includes('Reads Memory'), 'DNA may read Memory to infer but stays separate');

ok(confidence.includes('assessCapabilityConfidence'), 'Capability confidence');
ok(confidence.includes('clarifyingQuestions'), 'clarifying questions');
ok(confidence.includes('What do you normally charge') || confidence.includes('normally charge'), 'pricing ask');
ok(confidence.includes('shouldAsk'), 'shouldAsk gate');

ok(weekly.includes('buildWeeklyLearningReport') || weekly.includes('WeeklyLearning'), 'Weekly Learning foundation');
ok(weekly.includes('weekly_learning') || weekly.includes('dnaPatch'), 'weekly DNA evolution');

ok(rule.includes('Business Memory is factual') || rule.includes('factual'), 'cursor rule Memory factual');
ok(rule.includes('interpretive') || rule.includes('DNA'), 'cursor rule DNA identity');
ok(rule.includes('Never combine') || rule.includes('never combine'), 'cursor rule never combine');

ok(understanding.includes('understandConversation'), 'Understanding layer');
ok(planner.includes('proposeExecutionPlanFromMemory'), 'Planner Execution Plan');
ok(planner.includes('dna') || planner.includes('DNA'), 'Planner reads DNA');
ok(planner.includes('never think about execution') || planner.includes('WHAT only') ||
  planner.includes('decides WHAT'), 'Planner does not own HOW');
ok(!planner.includes('hubly_brain_orchestrator'), 'Planner does not import Orchestrator');

ok(capabilities.includes('HUBLY_CAPABILITIES'), 'Capability registry');
ok(executionPlan.includes('buildExecutionGraph'), 'Execution DAG');
ok(progress.includes('HublyProgressBus') || progress.includes('createProgressBus'), 'Progress Bus');
ok(orchestrator.includes('orchestrate') && orchestrator.includes('Promise.all'), 'Orchestrator parallel');
ok(orchestrator.includes('dna') && orchestrator.includes('confidence'), 'Orchestrator passes DNA + confidence');
ok(executors.includes('dna') && executors.includes('persistBusinessDNA'), 'Executors receive/persist DNA');
ok(executors.includes('Builder migration deferred') || executors.includes('migration pending'), 'website not Builder-migrated');

ok(shared.includes('async buildBusiness'), 'async buildBusiness');
ok(/buildWebsite[\s\S]*executable:\s*false/.test(skills), 'buildWebsite skill still gated');

ok(statusFn.includes('dnaIdentity') || statusFn.includes('dna'), 'status shows DNA');
ok(statusFn.includes('confidence'), 'status shows confidence');
ok(buildFn.includes('buildBusiness'), 'build-business edge');

ok(client.includes('buildBusinessMemory'), 'client Business Memory builder');
ok(client.includes('async buildBusiness'), 'client Hubly.buildBusiness');
ok(client.includes('gpt-5.5'), 'client mirrors GPT-5.5');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still on Claude (no Website Builder migration)');

if (failed) process.exit(1);
console.log('OK Hubly Business DNA Phase 7.6 checklist passed');
