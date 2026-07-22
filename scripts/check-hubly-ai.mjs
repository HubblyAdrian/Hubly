#!/usr/bin/env node
/**
 * Craft: V1 release + LAUNCH_CHECKLIST + bulletproof publishing + Production-First honesty.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const domain = fs.readFileSync('supabase/functions/_shared/hubly_brain_domain.ts', 'utf8');
const launch = fs.readFileSync('supabase/functions/_shared/hubly_brain_launch.ts', 'utf8');
const providers = fs.readFileSync('supabase/functions/_shared/hubly_providers.ts', 'utf8');
const cf = fs.readFileSync('supabase/functions/_shared/hubly_provider_cloudflare.ts', 'utf8');
const porkbun = fs.readFileSync('supabase/functions/_shared/hubly_provider_porkbun.ts', 'utf8');
const pay = fs.readFileSync('supabase/functions/_shared/hubly_provider_payments.ts', 'utf8');
const cal = fs.readFileSync('supabase/functions/_shared/hubly_provider_calendar.ts', 'utf8');
const executors = fs.readFileSync('supabase/functions/_shared/hubly_brain_executors.ts', 'utf8');
const caps = fs.readFileSync('supabase/functions/_shared/hubly_brain_capabilities.ts', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const checklist = fs.readFileSync('docs/LAUNCH_CHECKLIST.md', 'utf8');
const v1 = fs.readFileSync('docs/V1_RELEASE.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

// --- V1 + checklist ---
ok(v1.includes('first 100 customers') && v1.includes('Not required for v1'), 'V1_RELEASE scope');
ok(v1.includes('Website publishing') && v1.includes('Booking') && v1.includes('Payments'), 'V1 required capabilities');
ok(v1.includes('AI Marketing automation') && v1.includes('Autonomous Growth'), 'V1 explicitly excludes growth fluff');

ok(checklist.includes('Can a real business owner depend on Hubly'), 'launch checklist customer question');
ok(checklist.includes('PR rule') && checklist.includes('one') && checklist.includes('V1_RELEASE.md'), 'PR + v1 linkage');
ok(checklist.includes('[x]') && checklist.includes('Website publishes reliably'), 'publishing checklist item complete');
ok(checklist.includes('Booking accepts real appointments'), 'next item still open');

ok(constitution.includes('LAUNCH_CHECKLIST.md') && constitution.includes('V1_RELEASE.md'), 'constitution points to both');
ok(constitution.includes('Every PR must complete one checklist row'), 'constitution PR rule');

ok(productRule.includes('LAUNCH_CHECKLIST.md') && productRule.includes('V1_RELEASE.md'), 'product rule points to both');
ok(productRule.includes('Every PR must move one checklist item') || productRule.includes('incomplete → complete'), 'product rule PR contract');
ok(productRule.includes('Publishing') && productRule.includes('Booking'), 'Business Launched order');

// --- Publishing production path ---
ok(client.includes('persistWebsiteMetaQuiet') && client.includes('_saveStorefrontQueued'), 'publish queue + quiet persist');
ok(client.includes("saveStorefront({quiet:true})") || client.includes('saveStorefront({quiet:true})'), 'verified onboard publish');
ok(client.includes('website.published') || client.includes('S.website.published=true'), 'published stamp');
ok(client.includes("Couldn’t publish yet") || client.includes("Couldn't publish yet"), 'no fake You’re live');

// --- Existing Production-First providers still on main ---
ok(providers.includes('PROVIDER_NOT_CONFIGURED') && providers.includes('providerNotConfigured'), 'provider result helpers');
ok(cf.includes('CloudflareDomainProvider') && cf.includes('CLOUDFLARE_API_TOKEN'), 'Cloudflare provider');
ok(porkbun.includes('PorkbunDomainProvider') && porkbun.includes('PORKBUN_API_KEY'), 'Porkbun provider');
ok(pay.includes('StripePaymentsProvider') && pay.includes('stripeConfigured'), 'Stripe payments provider');
ok(cal.includes('GoogleCalendarProvider') && cal.includes('GOOGLE_CLIENT_ID'), 'Google calendar provider');

ok(launch.includes('Business Launch') || launch.includes('runBusinessLaunchDomain'), 'Business Launch');
ok(domain.includes('suggestDomainsAsync') && domain.includes('provider_not_configured'), 'domain async + honest status');
ok(!domain.includes('likely_available'), 'no fake likely_available');
ok(executors.includes('suggestDomainsAsync') && executors.includes('getPaymentsProvider'), 'executors use providers');
ok(caps.includes('Business Launch'), 'capability labeled Business Launch');
ok(shared.includes('productionFirstProviders') && shared.includes('businessLaunch'), 'status flags');
ok(client.includes('provider_not_configured'), 'client does not fake availability');
ok(!client.includes("availability:'likely_available'"), 'client no likely_available');
ok(shared.includes('buildBusiness') && shared.includes('findPro'), 'core APIs remain');

if (failed) process.exit(1);
console.log('OK V1_RELEASE + publishing checklist item + Production-First honesty passed');
