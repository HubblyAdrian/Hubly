#!/usr/bin/env node
/**
 * Craft checks: Hubly Brain frozen architecture + Website Runtime (7.7).
 * creative-director may remain on Claude for editor chat; website publish is Runtime.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const memory = fs.readFileSync('supabase/functions/_shared/hubly_brain_memory.ts', 'utf8');
const dna = fs.readFileSync('supabase/functions/_shared/hubly_brain_dna.ts', 'utf8');
const website = fs.readFileSync('supabase/functions/_shared/hubly_brain_website.ts', 'utf8');
const confidence = fs.readFileSync('supabase/functions/_shared/hubly_brain_confidence.ts', 'utf8');
const skills = fs.readFileSync('supabase/functions/_shared/hubly_brain_skills.ts', 'utf8');
const planner = fs.readFileSync('supabase/functions/_shared/hubly_brain_planner.ts', 'utf8');
const capabilities = fs.readFileSync('supabase/functions/_shared/hubly_brain_capabilities.ts', 'utf8');
const orchestrator = fs.readFileSync('supabase/functions/_shared/hubly_brain_orchestrator.ts', 'utf8');
const executors = fs.readFileSync('supabase/functions/_shared/hubly_brain_executors.ts', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const buildFn = fs.readFileSync('supabase/functions/hubly-build-business/index.ts', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const rule = fs.readFileSync('.cursor/rules/hubly-memory-vs-dna.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(shared.includes('export const Hubly'), 'Hubly public alias');
ok(shared.includes('buildBusiness'), 'Hubly.buildBusiness API');
ok(shared.includes('gpt-5.5'), 'GPT-5.5 connected');
ok(shared.includes('websiteRuntime') || shared.includes('7.7'), 'Website Runtime in status');
ok(shared.includes('Never combine'), 'Memory vs DNA rule');
ok(shared.includes('HUBLY_CONSTITUTION') || shared.includes('constitution'), 'constitution referenced');

ok(memory.includes('normalizeBusinessMemory'), 'Memory normalize');
ok(dna.includes('HublyBusinessDNA') && dna.includes('Never combine') || dna.includes('never combine'), 'DNA separate');
ok(confidence.includes('assessCapabilityConfidence'), 'confidence');

ok(constitution.includes('Business Memory stores facts'), 'constitution Memory');
ok(constitution.includes('Business DNA stores identity'), 'constitution DNA');
ok(constitution.includes('Planner') && constitution.includes('Orchestrator'), 'constitution roles');
ok(constitution.includes('AI never writes directly') || constitution.includes('never writes directly'), 'constitution no model DB writes');
ok(constitution.includes('Website Runtime') || constitution.includes('Marketplace Runtime'), 'constitution roadmap');
ok(constitution.includes('frozen') || constitution.includes('FROZEN') || constitution.includes('Do not invent'), 'architecture freeze');

ok(rule.includes('Never combine') || rule.includes('never combine'), 'cursor rule');

ok(website.includes('buildWebsiteCopyFromMemoryDna'), 'DNA-informed website copy');
ok(website.includes('Who is this business') || website.includes('visual expression'), 'website answers DNA questions');
ok(website.includes('publishBusinessWebsite'), 'website publisher');
ok(website.includes('allocateUniqueSlug'), 'slug allocation');
ok(!website.includes('Build a website."') || website.includes('do NOT take orders'), 'not prompt-to-site');

ok(executors.includes('runWebsite') || executors.includes('publishBusinessWebsite'), 'website executor real');
ok(executors.includes('Writing homepage') || executors.includes('Publishing'), 'website progress steps');
ok(executors.includes('emitProgress'), 'executor progress streaming');
ok(orchestrator.includes('emitProgress') && orchestrator.includes('ownerId'), 'orchestrator wires progress + owner');

ok(capabilities.includes('Published Instant Site') || capabilities.includes('Publish Instant Site') ||
  capabilities.includes('from Memory + DNA'), 'capability describes Runtime website');
ok(/buildWebsite[\s\S]*executable:\s*true/.test(skills), 'buildWebsite skill executable');

ok(planner.includes('proposeExecutionPlanFromMemory'), 'planner');
ok(!planner.includes('hubly_brain_orchestrator'), 'planner does not import orchestrator');

ok(statusFn.includes('7.7') || statusFn.includes('website-runtime') || statusFn.includes('Acme Home Cleaning'), 'status demo Acme');
ok(buildFn.includes('phase: "7.7"') || buildFn.includes('7.7'), 'build-business phase 7.7');
ok(buildFn.includes('ownerId') || buildFn.includes('owner_id') || buildFn.includes('userData.user.id'), 'build-business owner');

ok(client.includes('async buildBusiness'), 'client buildBusiness');
ok(client.includes('gpt-5.5'), 'client GPT-5.5');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still Claude for editor chat (allowed)');

if (failed) process.exit(1);
console.log('OK Hubly Website Runtime Phase 7.7 + Constitution checklist passed');
