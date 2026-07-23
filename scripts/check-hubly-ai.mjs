#!/usr/bin/env node
/**
 * Craft: Connector architecture + Connection required + Website Runtime + Business Launch.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const domain = fs.readFileSync('supabase/functions/_shared/hubly_brain_domain.ts', 'utf8');
const launch = fs.readFileSync('supabase/functions/_shared/hubly_brain_launch.ts', 'utf8');
const connectors = fs.readFileSync('supabase/functions/_shared/hubly_connectors.ts', 'utf8');
const domainConn = fs.readFileSync('supabase/functions/_shared/hubly_connector_domain.ts', 'utf8');
const registry = fs.readFileSync('supabase/functions/_shared/hubly_connector_registry.ts', 'utf8');
const website = fs.readFileSync('supabase/functions/_shared/hubly_brain_website.ts', 'utf8');
const executors = fs.readFileSync('supabase/functions/_shared/hubly_brain_executors.ts', 'utf8');
const caps = fs.readFileSync('supabase/functions/_shared/hubly_brain_capabilities.ts', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');

const deletedVendors = [
  'supabase/functions/_shared/hubly_providers.ts',
  'supabase/functions/_shared/hubly_provider_cloudflare.ts',
  'supabase/functions/_shared/hubly_provider_porkbun.ts',
  'supabase/functions/_shared/hubly_provider_domain.ts',
  'supabase/functions/_shared/hubly_provider_payments.ts',
  'supabase/functions/_shared/hubly_provider_calendar.ts',
];

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

for (const p of deletedVendors) {
  ok(!fs.existsSync(p), `premature vendor removed: ${p}`);
}

ok(connectors.includes('connectionRequired') && connectors.includes('CONNECTION_REQUIRED'), 'connector helpers');
ok(connectors.includes('Connection required') || connectors.includes('connection required'), 'owner-facing Connection required');

ok(domainConn.includes('interface DomainConnector'), 'DomainConnector contract');
ok(
  domainConn.includes('searchAvailability') &&
    domainConn.includes('purchase') &&
    domainConn.includes('configureDNS') &&
    domainConn.includes('verify') &&
    domainConn.includes('renew') &&
    domainConn.includes('transfer'),
  'DomainConnector methods',
);
ok(domainConn.includes('UnconfiguredDomainConnector') && domainConn.includes('getDomainConnector'), 'unconfigured domain connector');
ok(!domainConn.includes('CLOUDFLARE_API_TOKEN') && !domainConn.includes('PORKBUN_API_KEY'), 'no premature registrar credentials');

ok(registry.includes('PaymentConnector') && registry.includes('StripePaymentConnector'), 'payment connector');
ok(registry.includes('CalendarConnector') && registry.includes('GoogleCalendarConnector'), 'calendar connector');
ok(registry.includes('EmailConnector') && registry.includes('MessagingConnector'), 'email/sms contracts');
ok(registry.includes('listConnectionStatuses'), 'connections registry');

ok(launch.includes('Business Launch') || launch.includes('runBusinessLaunchDomain'), 'Business Launch');
ok(launch.includes('resolveDomainConnector') && launch.includes('purchaseReady'), 'launch resolves DomainConnector');
ok(launch.includes('Domain connection required'), 'launch connection copy');

ok(domain.includes('suggestDomainsAsync') && domain.includes('connection_required'), 'domain async + honest status');
ok(!domain.includes('likely_available'), 'no fake likely_available');

ok(executors.includes('suggestDomainsAsync') && executors.includes('getPaymentConnector'), 'executors use connectors');
ok(
  executors.includes('connection_required') ||
    executors.includes('connection required') ||
    executors.includes('Connection required'),
  'honest executor messaging',
);
ok(caps.includes('Business Launch'), 'capability labeled Business Launch');

ok(
  website.includes('faqSchema') &&
    website.includes('analytics') &&
    website.includes('leadForms') &&
    website.includes('bookingPage') &&
    website.includes('editing') &&
    website.includes('sitemapPath'),
  'Website Runtime production surfaces',
);

ok(shared.includes('connectorArchitecture') && shared.includes('businessLaunch'), 'status flags');
ok(shared.includes('suggestDomainsAsync') && shared.includes('getPaymentConnector'), 'Hubly exports connectors');
ok(shared.includes('listConnectionStatuses') && shared.includes('connections:'), 'status exposes connections');

ok(constitution.includes('Production-First') && constitution.includes('Never simulate success'), 'constitution production-first');
ok(constitution.includes('Connection required') && constitution.includes('DomainConnector'), 'constitution connectors');
ok(constitution.includes('Business Launch') && constitution.includes('Website Runtime'), 'constitution launch + website');
ok(constitution.includes('Can a paying customer rely') || constitution.includes('paying customer'), 'customer-rely test');
ok(constitution.includes('Connectors') && constitution.includes('Capabilities'), 'capabilities vs connectors');

ok(productRule.includes('Production-First') && productRule.includes('Connection required'), 'product rule production-first');
ok(productRule.includes('Connectors') && productRule.includes('Connections'), 'product rule connectors/connections');

ok(client.includes('connection_required') || client.includes('Domain connection required'), 'client honest availability');
ok(!client.includes("availability:'likely_available'") && !client.includes("availability: 'likely_available'"), 'client no likely_available');

ok(shared.includes('buildBusiness') && shared.includes('daily(') && shared.includes('findPro'), 'core APIs remain');

if (failed) process.exit(1);
console.log('OK Connector architecture + Website Runtime + Business Launch checklist passed');
