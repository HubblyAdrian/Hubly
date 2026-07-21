#!/usr/bin/env node
/**
 * Craft: Website Runtime production DoD + customer outcome milestones.
 * Also guards Production-First domain honesty still on main.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const domain = fs.readFileSync('supabase/functions/_shared/hubly_brain_domain.ts', 'utf8');
const launch = fs.readFileSync('supabase/functions/_shared/hubly_brain_launch.ts', 'utf8');
const website = fs.readFileSync('supabase/functions/_shared/hubly_brain_website.ts', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
const router = fs.readFileSync('api/router.js', 'utf8');
const ast = fs.readFileSync('public/website-ast.js', 'utf8');

let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

// --- Website Runtime production DoD ---
ok(client.includes('function applyWebsiteSeo'), 'applyWebsiteSeo');
ok(client.includes('hubly-faq-schema') && client.includes('hubly-business-schema'), 'JSON-LD schemas');
ok(client.includes('og:title') && client.includes('twitter:card') && client.includes('canonical'), 'OG/Twitter/canonical');
ok(client.includes('function hublyTrack') && client.includes("hublyTrack('page_view'"), 'analytics hooks');
ok(client.includes('ws-sec-contact') && client.includes('submitWebsiteContact'), 'contact section + form');
ok(client.includes('never invent') || client.includes('Never invent') || client.includes('never invents'), 'no fake trust copy guard');
ok(client.includes('tickerEnabled=false') || client.includes('tickerEnabled==null)w.tickerEnabled=false'), 'ticker off by default');
ok(client.includes('S._published=true') && client.includes('persistWebsiteMetaQuiet'), 'publish honesty + AI persist');
ok(!client.includes('reviewPlaceholder} Highly recommend'), 'no fake review card injection');

ok(router.includes("/robots.txt") && router.includes('/sitemap.xml'), 'robots + sitemap routes');
ok(router.includes('User-agent:') && router.includes('urlset'), 'robots/sitemap bodies');

ok(ast.includes("'contact'") && ast.includes('ws-sec-contact'), 'AST includes contact');

ok(
  website.includes('faqSchema') &&
    website.includes('businessSchema') &&
    website.includes('analytics') &&
    website.includes('leadForms') &&
    website.includes('editing') &&
    website.includes('indexing'),
  'Website Runtime meta surfaces',
);

// --- Customer outcome milestones ---
ok(constitution.includes('Business Created') && constitution.includes('First Customer'), 'outcome milestones');
ok(constitution.includes('Could we release this to paying customers today'), 'paying-customer test');
ok(constitution.includes('Website Runtime') && constitution.includes('Definition of Done'), 'website DoD in constitution');
ok(
  /connection required/i.test(constitution) && constitution.includes('Domain connection required'),
  'connection required language',
);
ok(productRule.includes('Business Created') && productRule.includes('Connection required'), 'product rule outcomes');
ok(productRule.includes('single biggest thing preventing'), 'sprint question');

// --- Domain honesty (still production-first on main) ---
ok(launch.includes('Business Launch') || launch.includes('runBusinessLaunchDomain'), 'Business Launch');
ok(domain.includes('suggestDomainsAsync'), 'domain async');
ok(!domain.includes('likely_available'), 'no fake likely_available');
ok(
  client.includes('provider_not_configured') ||
    client.includes('connection_required') ||
    client.includes('Domain connection required'),
  'client honest domain status',
);
ok(!client.includes("availability:'likely_available'"), 'client no likely_available');

ok(shared.includes('buildBusiness') && shared.includes('findPro'), 'core APIs remain');

if (failed) process.exit(1);
console.log('OK Website Runtime production + customer outcome milestones checklist passed');
