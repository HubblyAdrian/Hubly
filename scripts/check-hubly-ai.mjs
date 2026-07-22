#!/usr/bin/env node
/**
 * Craft: First Customer surfaces — Owner Feed + Daily briefing + North Star.
 */
import fs from 'fs';

const checklist = fs.readFileSync('docs/LAUNCH_CHECKLIST.md', 'utf8');
const v1 = fs.readFileSync('docs/V1_RELEASE.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
const stripe = fs.readFileSync('supabase/functions/_shared/stripe.ts', 'utf8');

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
ok(checklist.includes('complete business transactions') || checklist.includes('complete business transaction'), 'transaction framing');
ok(v1.includes('Three questions') || v1.includes('three questions'), 'V1 three questions');
ok(productRule.includes('complete business transactions') && productRule.includes('Owner Feed'), 'product rule');
ok(constitution.includes('complete transactions') || constitution.includes('complete business transactions') || constitution.includes('hired a business'), 'constitution transaction framing');

ok(client.includes('id="owner-feed"') && client.includes('function renderOwnerFeed'), 'Owner Feed UI');
ok(client.includes('function buildOwnerFeedEntries') && client.includes('What Hubly has been doing'), 'Owner Feed content');
ok(client.includes('renderOwnerFeed()') && client.includes("v==='dashboard'"), 'Feed on dashboard');
ok(client.includes('payments still waiting') || client.includes('payment') && client.includes('Outstanding') || client.includes('outstanding lead'), 'Daily briefing ops signals');
ok(client.includes('notifyWebsiteHire') && client.includes('Stripe connection required'), 'hire path remains');
ok(stripe.includes('.myhubly.app'), 'Stripe subdomain return remains');

if (failed) process.exit(1);
console.log('OK First Customer Owner Feed + transaction framing passed');
