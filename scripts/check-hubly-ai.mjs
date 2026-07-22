#!/usr/bin/env node
/**
 * Craft: V1 freeze + First Customer blockers + Hubly Brain AI gate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const finish = fs.readFileSync(path.join(root, 'docs/V1_FINISH_LINE.md'), 'utf8');
const proof = fs.readFileSync(path.join(root, 'docs/PRODUCTION_PAYMENT_PROOF.md'), 'utf8');
const checklist = fs.readFileSync(path.join(root, 'docs/LAUNCH_CHECKLIST.md'), 'utf8');
const productRule = fs.readFileSync(path.join(root, '.cursor/rules/hubly-product-direction.mdc'), 'utf8');
const client = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/stripe-webhook/index.ts'), 'utf8');
const maintain = fs.readFileSync(path.join(root, 'supabase/functions/google-calendar-maintain/index.ts'), 'utf8');
const busySql = fs.readFileSync(path.join(root, 'supabase/migrations/20260722030000_get_busy_windows.sql'), 'utf8');

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(finish.includes('V1 Freeze') && finish.includes('No new AI systems'), 'finish line freeze');
ok(finish.includes('real production transaction'), 'production transaction gate');
ok(finish.includes('Ordered') || finish.includes('work in order'), 'ordered blockers');
ok(proof.includes('live') && proof.includes('Refund'), 'payment proof runbook');
ok(productRule.includes('V1 Freeze') && productRule.includes('PRODUCTION_PAYMENT_PROOF'), 'product rule');
ok(checklist.includes('Production payment proof'), 'checklist blocker #1');
ok(checklist.includes('get_busy_windows'), 'checklist calendar');

ok(busySql.includes('get_busy_windows') && busySql.includes('security definer'), 'busy windows RPC');
ok(client.includes('function assertSlotOpen') && client.includes('Final conflict check'), 'book conflict');
ok(client.includes('excludeJobId') && client.includes('That time conflicts'), 'reschedule conflict');
ok(client.includes('sync_status:\'pending\'') || client.includes("sync_status:'pending'"), 'cancel pending sync');
ok(maintain.includes('pending_flushed') && maintain.includes('syncEnginePushDelete'), 'maintain pending flush');
ok(webhook.includes('stripe_webhook_events') && webhook.includes('charge.refunded'), 'payment webhook remains');

const audit = fs.readFileSync(path.join(root, 'docs/AI_BRAIN_MIGRATION_AUDIT.md'), 'utf8');
const draft = fs.readFileSync(path.join(root, 'supabase/functions/draft-customer-message/index.ts'), 'utf8');
const advisor = fs.readFileSync(path.join(root, 'supabase/functions/ai-advisor/index.ts'), 'utf8');
const chatbot = fs.readFileSync(path.join(root, 'supabase/functions/chatbot-message/index.ts'), 'utf8');
const creative = fs.readFileSync(path.join(root, 'supabase/functions/creative-director/index.ts'), 'utf8');
const photos = fs.readFileSync(path.join(root, 'supabase/functions/analyze-photos/index.ts'), 'utf8');
const offers = fs.readFileSync(path.join(root, 'supabase/functions/import-offers/index.ts'), 'utf8');
const generateSite = fs.readFileSync(path.join(root, 'supabase/functions/generate-site/index.ts'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'supabase/functions/_shared/marketplace_intake.ts'), 'utf8');

ok(audit.includes('Brain Runtime Migration') && audit.includes('Direct model calls'), 'AI audit doc');
ok(audit.includes('AI development freeze') && audit.includes('No new AI capabilities'), 'AI freeze declared');
ok(audit.includes('draft-customer-message') && audit.includes('Migration'), 'migration plan');
ok(draft.includes('Hubly.customerSupport') && !draft.includes('api.anthropic.com'), 'draft via HublyAI');
ok(client.includes("business_id:currentBusiness?.id||null") && client.includes('draft-customer-message'), 'client passes business_id');

ok(advisor.includes('Hubly.businessCoach') && !advisor.includes('api.anthropic.com'), 'ask AI via HublyAI');
ok(client.includes('function buildAskAiOpsContext') && client.includes('feed_summary:ops.feed_summary'), 'ask AI ops context');
ok(chatbot.includes('Hubly.customerConcierge') && !chatbot.includes('api.anthropic.com'), 'storefront chat via HublyAI');
ok(creative.includes('Hubly.creativeDirector') && !creative.includes('api.anthropic.com'), 'creative director via HublyAI');
ok(photos.includes('Hubly.photoAnalysis') && !photos.includes('api.anthropic.com'), 'photo analysis via HublyAI');
ok(offers.includes('Hubly.complete') && !offers.includes('api.anthropic.com'), 'import offers via HublyAI');
ok(generateSite.includes('Hubly.generateWebsite') && !generateSite.includes('api.anthropic.com'), 'generate-site Website Runtime façade');
ok(intake.includes('Hubly.customerConcierge') && !intake.includes('api.anthropic.com'), 'marketplace intake via HublyAI');

ok(
  client.includes("functions.invoke('creative-director'") &&
    /creative-director[\s\S]{0,400}business_id:\s*currentBusiness\?\.id/.test(client),
  'creative director client passes business_id'
);
ok(
  client.includes("functions.invoke('analyze-photos'") &&
    /analyze-photos[\s\S]{0,200}business_id:\s*currentBusiness\?\.id/.test(client),
  'analyze-photos client passes business_id'
);
ok(
  client.includes("functions.invoke('import-offers'") &&
    /import-offers[\s\S]{0,200}business_id:\s*currentBusiness\?\.id/.test(client),
  'import-offers client passes business_id'
);

/** Ban direct Anthropic outside the HublyAI gateway. */
function walkTs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (name.endsWith('.ts') || name.endsWith('.js')) out.push(p);
  }
  return out;
}

const functionsRoot = path.join(root, 'supabase/functions');
const gateway = path.join(functionsRoot, '_shared/hubly_ai.ts');
const offenders = [];
for (const file of walkTs(functionsRoot)) {
  if (path.resolve(file) === path.resolve(gateway)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('api.anthropic.com') || text.includes('api.openai.com')) {
    offenders.push(path.relative(root, file));
  }
}
ok(offenders.length === 0, 'no direct Anthropic/OpenAI outside hubly_ai.ts' + (offenders.length ? `: ${offenders.join(', ')}` : ''));
ok(fs.existsSync(gateway) && fs.readFileSync(gateway, 'utf8').includes('api.anthropic.com'), 'hubly_ai.ts remains sole gateway');

if (failed) process.exit(1);
console.log('OK V1 freeze + calendar trust + Hubly Brain AI gate passed');
