#!/usr/bin/env node
/**
 * Craft: North Star + hire journey + publishing + Production-First honesty.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const domain = fs.readFileSync('supabase/functions/_shared/hubly_brain_domain.ts', 'utf8');
const launch = fs.readFileSync('supabase/functions/_shared/hubly_brain_launch.ts', 'utf8');
const providers = fs.readFileSync('supabase/functions/_shared/hubly_providers.ts', 'utf8');
const stripe = fs.readFileSync('supabase/functions/_shared/stripe.ts', 'utf8');
const pay = fs.readFileSync('supabase/functions/_shared/hubly_provider_payments.ts', 'utf8');
const cal = fs.readFileSync('supabase/functions/_shared/hubly_provider_calendar.ts', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const checklist = fs.readFileSync('docs/LAUNCH_CHECKLIST.md', 'utf8');
const v1 = fs.readFileSync('docs/V1_RELEASE.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
const notify = fs.readFileSync('api/notify.js', 'utf8');

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(v1.includes('Revenue generated through Hubly-powered businesses'), 'V1 North Star');
ok(checklist.includes('Revenue generated through Hubly-powered businesses'), 'checklist North Star');
ok(checklist.includes('Hire path works') || checklist.includes('Hire journey'), 'hire journey checklist');
ok(checklist.includes('make more money'), 'money merge gate');
ok(productRule.includes('North Star') && productRule.includes('Revenue generated'), 'product rule North Star');
ok(constitution.includes('Revenue generated through Hubly-powered businesses'), 'constitution North Star');

ok(client.includes('notifyWebsiteHire') && client.includes('/api/notify'), 'hire notify wired');
ok(client.includes('Stripe connection required') || client.includes('Stripe connection required'), 'honest Stripe gate');
ok(client.includes("return;") && client.includes('wantsOnlinePay'), 'no silent unpaid success path guard present');
ok(!client.includes('Fall through to unpaid booking request when Connect'), 'removed silent Stripe fallthrough');
ok(client.includes('accept CRM upsert') || client.includes('upsertCustomer'), 'CRM on accept');
ok(stripe.includes('.myhubly.app') && stripe.includes('sanitizeAppReturnUrl'), 'Stripe return allows business subdomains');
ok(notify.includes("status === 'confirmed'") || notify.includes("kind === 'confirmed'"), 'notify requested vs confirmed');
ok(notify.includes('Request received') || notify.includes('New booking request'), 'honest request email copy');

ok(client.includes('persistWebsiteMetaQuiet') && client.includes('_saveStorefrontQueued'), 'publishing reliability remains');
ok(providers.includes('PROVIDER_NOT_CONFIGURED'), 'provider helpers remain');
ok(pay.includes('StripePaymentsProvider'), 'Stripe payments provider remains');
ok(cal.includes('GoogleCalendarProvider'), 'calendar provider remains');
ok(launch.includes('Business Launch') || launch.includes('runBusinessLaunchDomain'), 'Business Launch');
ok(domain.includes('suggestDomainsAsync') && !domain.includes('likely_available'), 'domain honesty');
ok(shared.includes('buildBusiness') && shared.includes('findPro'), 'core APIs remain');

if (failed) process.exit(1);
console.log('OK North Star + hire journey checklist outcome passed');
