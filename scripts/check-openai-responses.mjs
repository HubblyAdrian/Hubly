#!/usr/bin/env node
/**
 * Structural regression: OpenAI Responses transport inside HublyAI gateway.
 * No live model calls — validates contract + capability entry points.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const gateway = fs.readFileSync(path.join(root, 'supabase/functions/_shared/hubly_ai.ts'), 'utf8');

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('OK:', msg);
  }
}

ok(gateway.includes('HublyModelProvider'), 'provider adapter interface');
ok(gateway.includes('OpenAIProvider') && gateway.includes('ClaudeProvider'), 'OpenAI + Claude adapters');
ok(gateway.includes('resolveOpenAITransport'), 'OPENAI_TRANSPORT resolver');
ok(gateway.includes('api.openai.com/v1/responses'), 'Responses endpoint');
ok(gateway.includes('api.openai.com/v1/chat/completions'), 'Chat Completions rollback endpoint');
ok(/store:\s*false/.test(gateway), 'Responses store:false privacy default');
ok(gateway.includes('max_output_tokens'), 'Responses max_output_tokens');
ok(gateway.includes('input_image') && gateway.includes('input_text'), 'Responses vision parts');
ok(gateway.includes('image_url') && gateway.includes('toOpenAIChatContent'), 'Chat vision rollback parts');
ok(gateway.includes('format: { type: "json_object" }') || gateway.includes("format: { type: 'json_object' }"), 'Responses JSON mode');
ok(gateway.includes('response_format') && gateway.includes('json_object'), 'Chat JSON mode rollback');
ok(gateway.includes('HUBLY_AI_OUTPUT_BUDGETS'), 'documented output budgets');
ok(gateway.includes('DEFAULT_REASONING_MODEL = "gpt-5.5"'), 'GPT-5.5 default reasoning model');

const capabilities = [
  ['hubly-build-business', 'Hubly.buildBusiness|buildBusiness'],
  ['generate-site', 'Hubly.generateWebsite'],
  ['creative-director', 'Hubly.creativeDirector'],
  ['chatbot-message', 'Hubly.customerConcierge'],
  ['draft-customer-message', 'Hubly.customerSupport'],
  ['analyze-photos', 'Hubly.photoAnalysis'],
  ['import-offers', 'Hubly.complete'],
  ['ai-advisor', 'Hubly.businessCoach'],
];

for (const [edge, pattern] of capabilities) {
  const file = path.join(root, 'supabase/functions', edge, 'index.ts');
  const text = fs.readFileSync(file, 'utf8');
  ok(new RegExp(pattern).test(text), `${edge} still uses HublyAI façade`);
  ok(!text.includes('api.openai.com') && !text.includes('api.anthropic.com'), `${edge} has no direct provider HTTP`);
}

const intake = fs.readFileSync(path.join(root, 'supabase/functions/_shared/marketplace_intake.ts'), 'utf8');
ok(intake.includes('Hubly.customerConcierge'), 'marketplace intake HublyAI');
ok(!intake.includes('api.openai.com') && !intake.includes('api.anthropic.com'), 'marketplace intake no direct provider');

const executors = fs.readFileSync(path.join(root, 'supabase/functions/_shared/hubly_brain_executors.ts'), 'utf8');
ok(executors.includes('HublyAI.generateWebsite') || executors.includes('generateWebsite'), 'Website Runtime uses HublyAI');

const docs = fs.readFileSync(path.join(root, 'docs/OPENAI_RESPONSES_MIGRATION.md'), 'utf8');
ok(docs.includes('OPENAI_TRANSPORT') && docs.includes('store: false'), 'migration doc');
ok(fs.existsSync(path.join(root, 'docs/OPENAI_RESPONSES_BENCHMARK.md')), 'benchmark doc present');

if (failed) process.exit(1);
console.log('OK OpenAI Responses structural regression passed');
