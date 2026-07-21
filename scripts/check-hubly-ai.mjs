#!/usr/bin/env node
/**
 * Craft: Production-First providers + Business Launch + Phase 8 surfaces.
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
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(providers.includes('PROVIDER_NOT_CONFIGURED') && providers.includes('providerNotConfigured'), 'provider result helpers');

ok(cf.includes('CloudflareDomainProvider') && cf.includes('CLOUDFLARE_API_TOKEN'), 'Cloudflare provider');
ok(cf.includes('checkAvailability') && cf.includes('purchaseDomain') && cf.includes('ensureDns') && cf.includes('ensureSsl'), 'CF full DomainProvider');
ok(porkbun.includes('PorkbunDomainProvider') && porkbun.includes('PORKBUN_API_KEY'), 'Porkbun provider');
ok(pay.includes('StripePaymentsProvider') && pay.includes('stripeConfigured'), 'Stripe payments provider');
ok(cal.includes('GoogleCalendarProvider') && cal.includes('GOOGLE_CLIENT_ID'), 'Google calendar provider');

ok(launch.includes('Business Launch') || launch.includes('runBusinessLaunchDomain'), 'Business Launch');
ok(launch.includes('resolveDomainProvider') && launch.includes('purchaseReady'), 'launch resolves provider');
ok(domain.includes('suggestDomainsAsync') && domain.includes('provider_not_configured'), 'domain async + honest status');
ok(!domain.includes('likely_available'), 'no fake likely_available');

ok(executors.includes('suggestDomainsAsync') && executors.includes('getPaymentsProvider'), 'executors use providers');
ok(executors.includes('provider_not_configured') || executors.includes('Provider not configured') || executors.includes('not configured'), 'honest executor messaging');
ok(caps.includes('Business Launch'), 'capability labeled Business Launch');

ok(shared.includes('productionFirstProviders') && shared.includes('businessLaunch'), 'status flags');
ok(shared.includes('suggestDomainsAsync') && shared.includes('getPaymentsProvider'), 'Hubly exports providers');

ok(constitution.includes('Production-First') && constitution.includes('fail honestly'), 'constitution production-first');
ok(constitution.includes('Business Launch') && constitution.includes('DomainProvider'), 'constitution launch');
ok(constitution.includes('Can a paying customer rely') || constitution.includes('paying customer'), 'customer-rely test');
ok(productRule.includes('Production-First') && productRule.includes('Provider not configured'), 'product rule production-first');

ok(client.includes('provider_not_configured'), 'client does not fake availability');
ok(!client.includes("availability:'likely_available'") && !client.includes('availability:\'likely_available\''), 'client no likely_available');

ok(shared.includes('buildBusiness') && shared.includes('daily(') && shared.includes('findPro'), 'core APIs remain');

if (failed) process.exit(1);
console.log('OK Production-First providers + Business Launch checklist passed');
