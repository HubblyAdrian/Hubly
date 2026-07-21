#!/usr/bin/env node
/**
 * Craft checks for the HublyAI intelligence layer.
 * Does not call providers — verifies capability surface + per-task models.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(shared.includes('export const HublyAI'), 'HublyAI export');
ok(shared.includes('async complete('), 'HublyAI.complete low-level');
ok(shared.includes('async chat('), 'HublyAI.chat');
ok(shared.includes('async reason('), 'HublyAI.reason');
ok(shared.includes('async generateWebsite('), 'HublyAI.generateWebsite');
ok(shared.includes('async generateQuote('), 'HublyAI.generateQuote');
ok(shared.includes('async generateMarketing('), 'HublyAI.generateMarketing');
ok(shared.includes('async businessCoach('), 'HublyAI.businessCoach');
ok(shared.includes('async creativeDirector('), 'HublyAI.creativeDirector');
ok(shared.includes('async customerSupport('), 'HublyAI.customerSupport');
ok(shared.includes('async customerConcierge('), 'HublyAI.customerConcierge');
ok(shared.includes('async photoAnalysis('), 'HublyAI.photoAnalysis');
ok(shared.includes('memory('), 'HublyAI.memory');
ok(shared.includes('listCapabilities'), 'capability registry surface');
ok(shared.includes('HublyBusinessMemory'), 'Business Memory type (Phase 7.1)');
ok(shared.includes('TASK_ROUTES'), 'per-task model registry');
ok(shared.includes('gpt-5.5'), 'GPT-5.5 primary reasoning model');
ok(!shared.includes('gpt-4.1-mini'), 'must not default to gpt-4.1-mini');
ok(shared.includes('api.anthropic.com'), 'Claude provider connected');
ok(shared.includes('api.openai.com'), 'OpenAI provider connected');
ok(shared.includes('OPENAI_API_KEY'), 'OPENAI_API_KEY read');
ok(shared.includes('ANTHROPIC_API_KEY'), 'ANTHROPIC_API_KEY read');
ok(statusFn.includes('HublyAI.status'), 'status edge function uses HublyAI');
ok(client.includes('const HublyAI={') || client.includes('const HublyAI = {'), 'client HublyAI memory layer');
ok(/intelligence layer|Business Memory|capability/i.test(client), 'client documents HublyAI brain vision');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still on Claude direct (not migrated yet)');

if (failed) process.exit(1);
console.log('OK HublyAI brain capability checks passed');
