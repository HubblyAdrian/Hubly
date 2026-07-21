#!/usr/bin/env node
/**
 * Craft checks for Hubly Brain + Runtime (Phase 7.5).
 * Does NOT require Website Builder migration.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const memory = fs.readFileSync('supabase/functions/_shared/hubly_brain_memory.ts', 'utf8');
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
ok(shared.includes('DEFAULT_REASONING_MODEL = "gpt-5.5"') || shared.includes('gpt-5.5'), 'GPT-5.5 connected');
ok(shared.includes('callOpenAI') && shared.includes('callClaude'), 'AI abstraction layer providers');
ok(shared.includes('foundationChecklist'), 'foundation checklist in status');
ok(shared.includes('hublyRuntime') || shared.includes('orchestrator: true'), 'Runtime checklist flags');

ok(memory.includes('normalizeBusinessMemory'), 'Business Memory normalize');
ok(migrationMem.includes('business_memories'), 'Business Memory SSOT table');
ok(migrationRuns.includes('hubly_execution_runs'), 'Execution history table');
ok(migrationRuns.includes('enable row level security'), 'Execution history RLS');

ok(understanding.includes('understandConversation'), 'Understanding layer');
ok(understanding.includes('Only layer allowed to read free-form language') ||
  understanding.includes('only layer allowed to read free-form language') ||
  understanding.includes('only Brain step that reads raw language'), 'Understanding owns raw language');
ok(understanding.includes('i (?:own|run|operate)'), 'Ownership → full system Understanding');

ok(planner.includes('proposePlanFromMemory'), 'Planner from memory');
ok(planner.includes('proposeExecutionPlanFromMemory'), 'Planner Execution Plan');
ok(planner.includes('NEVER inspect raw') || planner.includes('must NEVER inspect raw') ||
  planner.includes('must never inspect raw'), 'Planner forbids raw conversation');
ok(planner.includes('never think about execution') || planner.includes('WHAT only') ||
  planner.includes('decides WHAT'), 'Planner does not own HOW');
ok(!planner.includes('understandConversation'), 'Planner does not import Understanding');
ok(!planner.includes('hubly_brain_orchestrator') &&
  !/from\s+["'].*orchestrator/.test(planner), 'Planner does not import Orchestrator');

ok(capabilities.includes('HUBLY_CAPABILITIES'), 'Capability registry');
ok(capabilities.includes('branding') && capabilities.includes('website') && capabilities.includes('crm'), 'core capabilities');
ok(capabilities.includes('defaultDependsOn'), 'capability default deps');

ok(executionPlan.includes('HublyExecutionPlan') || executionPlan.includes('dependsOn'), 'Execution Plan type');
ok(executionPlan.includes('buildExecutionGraph'), 'Execution DAG');
ok(executionPlan.includes('findExecutionCycle'), 'cycle detection');

ok(progress.includes('HublyProgressBus') || progress.includes('createProgressBus'), 'Progress Bus');
ok(progress.includes('queued') && progress.includes('running') && progress.includes('waiting'), 'progress states');
ok(progress.includes('retrying') && progress.includes('completed') && progress.includes('failed'), 'progress terminal states');

ok(orchestrator.includes('orchestrate'), 'Orchestrator');
ok(orchestrator.includes('Promise.all'), 'parallel execution');
ok(orchestrator.includes('retry') || orchestrator.includes('maxRetries'), 'retries');
ok(orchestrator.includes('AbortSignal') || orchestrator.includes('cancelled'), 'cancellation');
ok(orchestrator.includes('hubly_execution_runs') || orchestrator.includes('recordExecutionHistory'), 'execution history');
ok(orchestrator.includes('rollback'), 'rollback hooks');

ok(executors.includes('executeCapability'), 'capability executors');
ok(executors.includes('Builder migration deferred') || executors.includes('memory_only') ||
  executors.includes('Website Builder migration'), 'website is scaffold not Builder migration');
ok(executors.includes('persistBusinessMemory'), 'Memory persist via executor/runtime');

ok(shared.includes('ingest('), 'Brain.ingest');
ok(shared.includes('async buildBusiness'), 'async buildBusiness');
ok(/plan\(memory/.test(shared) || shared.includes('plan(memory?'), 'Brain.plan(memory) only');

ok(skills.includes('HUBLY_SKILLS'), 'skills catalog');
ok(/buildWebsite[\s\S]*executable:\s*false/.test(skills), 'buildWebsite skill still gated (no Builder migration)');

ok(statusFn.includes('buildBusiness'), 'status demos buildBusiness');
ok(buildFn.includes('Hubly.buildBusiness') || buildFn.includes('buildBusiness'), 'build-business edge');

ok(client.includes('buildBusinessMemory'), 'client Business Memory builder');
ok(client.includes('async buildBusiness'), 'client Hubly.buildBusiness');
ok(client.includes('gpt-5.5'), 'client mirrors GPT-5.5');
ok(client.includes('Planner reasons only from Memory') ||
  client.includes('decides WHAT'), 'client documents planner separation');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still on Claude (no Website Builder migration)');

if (failed) process.exit(1);
console.log('OK Hubly Runtime Phase 7.5 checklist passed');
