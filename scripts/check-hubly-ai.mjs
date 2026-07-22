#!/usr/bin/env node
/**
 * Craft: First Customer hire + payment loop (V1 finish line).
 */
import fs from 'fs';

const checklist = fs.readFileSync('docs/LAUNCH_CHECKLIST.md', 'utf8');
const finish = fs.readFileSync('docs/V1_FINISH_LINE.md', 'utf8');
const v1 = fs.readFileSync('docs/V1_RELEASE.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
const notify = fs.readFileSync('api/notify.js', 'utf8');
const webhook = fs.readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');
const health = fs.readFileSync('supabase/functions/_shared/hubly_brain_health.ts', 'utf8');
const stripe = fs.readFileSync('supabase/functions/_shared/stripe.ts', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20260722020000_first_customer_payments.sql',
  'utf8',
);

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(checklist.includes('Revenue generated through Hubly-powered businesses'), 'North Star');
ok(finish.includes('First Customer') && finish.includes('gets paid'), 'V1 finish line');
ok(finish.includes('Do not introduce new AI systems'), 'architecture freeze');
ok(productRule.includes('V1_FINISH_LINE') && productRule.includes('No new AI systems'), 'product rule finish line');
ok(checklist.includes('Customer can pay deposit/full'), 'payments checklist');
ok(v1.includes('Three questions') || v1.includes('three questions'), 'V1 three questions');
ok(
  constitution.includes('hired a business') ||
    constitution.includes('complete transactions') ||
    constitution.includes('complete business transactions'),
  'constitution transaction framing',
);

ok(client.includes('function runHireLifecycleSweep') && client.includes('function sendCompletionFollowUp'), 'hire lifecycle');
ok(client.includes('paymentStatus') && client.includes('Card (Stripe)'), 'accept carries Stripe payment');
ok(client.includes("status:'paid'") || client.includes('status:\'paid\''), 'paid notify from return');
ok(client.includes('function computeHireOutcomeMetrics'), 'outcome health');
ok(notify.includes("'paid'") && notify.includes('Payment received'), 'notify paid receipt');
ok(
  webhook.includes('checkout.session.expired') &&
    webhook.includes('charge.refunded') &&
    webhook.includes('upsertCrmFromBooking') &&
    webhook.includes('stripe_webhook_events'),
  'webhook payment lifecycle',
);
ok(health.includes('HublyHealthOutcomes') && health.includes('paymentSuccessRate'), 'health outcomes');
ok(
  migration.includes('charge_kind') &&
    migration.includes('booking_request_id') &&
    migration.includes('stripe_webhook_events'),
  'payments migration',
);
ok(stripe.includes('.myhubly.app'), 'Stripe subdomain return remains');

if (failed) process.exit(1);
console.log('OK First Customer payment loop + V1 finish line passed');
