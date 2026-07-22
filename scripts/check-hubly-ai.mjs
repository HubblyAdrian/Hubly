#!/usr/bin/env node
/**
 * Craft: customer outcome docs + Production-First domain honesty still on main.
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
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

// --- Customer Definition of Done ---
ok(checklist.includes('Can a real business owner depend on Hubly'), 'launch checklist customer question');
ok(checklist.includes('Business Created') && checklist.includes('Business Launched'), 'milestones in checklist');
ok(checklist.includes('First Customer') && checklist.includes('Business Running') && checklist.includes('Business Growing'), 'full milestone set');
ok(checklist.includes('CURRENT PRIORITY') && checklist.includes('Booking accepts real appointments'), 'Business Launched is current priority');
ok(checklist.includes('Domain Connector') && checklist.includes('No marketplace terminology'), 'connector + customer runtime rules');
ok(checklist.includes('No fake testimonials') || checklist.includes('No fake testimonials, fake reviews'), 'no fake trust content');

ok(constitution.includes('LAUNCH_CHECKLIST.md'), 'constitution points to checklist');
ok(constitution.includes('fail honestly') && constitution.includes('paying customer'), 'constitution production-first');
ok(constitution.includes('Business Launched') && constitution.includes('Domain Connector'), 'constitution launch + connector');
ok(constitution.includes('business employee') || constitution.includes('AI employee'), 'employee philosophy');

ok(productRule.includes('LAUNCH_CHECKLIST.md'), 'product rule points to checklist');
ok(productRule.includes('Business Launched') && productRule.includes('taking off the owner'), 'product rule outcomes + work removal');
ok(productRule.includes('biggest thing preventing'), 'sprint question');

// --- Existing Production-First providers still on main ---
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

ok(client.includes('provider_not_configured'), 'client does not fake availability');
ok(!client.includes("availability:'likely_available'") && !client.includes("availability: 'likely_available'"), 'client no likely_available');

ok(shared.includes('buildBusiness') && shared.includes('daily(') && shared.includes('findPro'), 'core APIs remain');

if (failed) process.exit(1);
console.log('OK LAUNCH_CHECKLIST + customer outcomes + Production-First honesty passed');
