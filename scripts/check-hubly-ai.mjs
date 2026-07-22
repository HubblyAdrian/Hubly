#!/usr/bin/env node
/**
 * Craft: V1 freeze + First Customer blockers (payment proof + calendar trust).
 */
import fs from 'fs';

const finish = fs.readFileSync('docs/V1_FINISH_LINE.md', 'utf8');
const proof = fs.readFileSync('docs/PRODUCTION_PAYMENT_PROOF.md', 'utf8');
const checklist = fs.readFileSync('docs/LAUNCH_CHECKLIST.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
const webhook = fs.readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');
const maintain = fs.readFileSync('supabase/functions/google-calendar-maintain/index.ts', 'utf8');
const busySql = fs.readFileSync('supabase/migrations/20260722030000_get_busy_windows.sql', 'utf8');

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

if (failed) process.exit(1);
console.log('OK V1 freeze + calendar trust + payment proof gate passed');
