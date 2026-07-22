#!/usr/bin/env node
/**
 * Craft: First Customer hire lifecycle — Owner Feed + Daily + reminders + health.
 */
import fs from 'fs';

const checklist = fs.readFileSync('docs/LAUNCH_CHECKLIST.md', 'utf8');
const v1 = fs.readFileSync('docs/V1_RELEASE.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
const notify = fs.readFileSync('api/notify.js', 'utf8');
const health = fs.readFileSync('supabase/functions/_shared/hubly_brain_health.ts', 'utf8');
const stripe = fs.readFileSync('supabase/functions/_shared/stripe.ts', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20260722010000_jobs_hire_lifecycle.sql',
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
ok(checklist.includes('Can a customer pay') && checklist.includes('without leaving Hubly'), 'three success questions');
ok(checklist.includes('Owner Feed') && checklist.includes('First Customer'), 'First Customer + Owner Feed');
ok(checklist.includes('Reminders send before the job'), 'reminders checklist');
ok(checklist.includes('Completion follow-up'), 'completion checklist');
ok(checklist.includes('Business Health tracks leads'), 'health metrics checklist');
ok(v1.includes('Three questions') || v1.includes('three questions'), 'V1 three questions');
ok(productRule.includes('complete business transactions') && productRule.includes('Owner Feed'), 'product rule');
ok(
  constitution.includes('complete transactions') ||
    constitution.includes('complete business transactions') ||
    constitution.includes('hired a business'),
  'constitution transaction framing',
);

ok(client.includes('id="owner-feed"') && client.includes('function renderOwnerFeed'), 'Owner Feed UI');
ok(client.includes('function buildOwnerFeedEntries') && client.includes('What Hubly has been doing'), 'Owner Feed content');
ok(client.includes('function runHireLifecycleSweep') && client.includes('function sendJobReminder'), 'reminder sweep');
ok(client.includes('function sendCompletionFollowUp') && client.includes('status:\'completed\''), 'completion follow-up');
ok(client.includes('function computeHireOutcomeMetrics') && client.includes('function assessLocalHireHealth'), 'outcome health');
ok(client.includes('notifyWebsiteHire') && client.includes('Stripe connection required'), 'hire path remains');
ok(notify.includes("'reminder'") && notify.includes("'completed'") && notify.includes('Leave a review'), 'notify lifecycle kinds');
ok(health.includes('HublyHealthOutcomes') && health.includes('bookingRate') && health.includes('paymentSuccessRate'), 'health outcomes');
ok(migration.includes('reminder_sent_at') && migration.includes('completion_followup_sent_at'), 'lifecycle migration');
ok(stripe.includes('.myhubly.app'), 'Stripe subdomain return remains');

if (failed) process.exit(1);
console.log('OK First Customer hire lifecycle passed');
