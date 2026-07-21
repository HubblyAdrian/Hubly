#!/usr/bin/env node
/**
 * Craft checks for the HublyAI abstraction layer.
 * Does not call providers — verifies the shared module + client stub shape.
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
ok(shared.includes('async complete(') || shared.includes('async complete(opts'), 'HublyAI.complete');
ok(shared.includes('api.anthropic.com'), 'Claude provider connected');
ok(shared.includes('api.openai.com'), 'OpenAI provider connected');
ok(shared.includes('HUBLY_AI_PROVIDER'), 'provider env override');
ok(shared.includes('OPENAI_API_KEY'), 'OPENAI_API_KEY read');
ok(shared.includes('ANTHROPIC_API_KEY'), 'ANTHROPIC_API_KEY read');
ok(shared.includes('defaultProvider(): HublyAIProvider') || shared.includes('defaultProvider()'), 'defaultProvider');
ok(/return normalizeProvider\(env\("HUBLY_AI_PROVIDER"\)\) \|\| "claude"/.test(shared)
  || shared.includes('|| "claude"'), 'default provider remains claude');
ok(shared.includes('extractJson'), 'shared extractJson');
ok(statusFn.includes('HublyAI.status'), 'status edge function uses HublyAI');
ok(client.includes('const HublyAI={') || client.includes('const HublyAI = {'), 'client HublyAI memory layer');
ok(client.includes('_shared/hubly_ai') || client.includes('HublyAI.complete') || /edge HublyAI|server HublyAI|centralized AI/i.test(client), 'client documents server HublyAI layer');

// Existing Claude call sites must still be present (not swapped yet)
const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still on Claude direct (not migrated yet)');
ok(creative.includes('ANTHROPIC_API_KEY'), 'creative-director still uses Anthropic key');

if (failed) process.exit(1);
console.log('OK HublyAI abstraction checks passed');
