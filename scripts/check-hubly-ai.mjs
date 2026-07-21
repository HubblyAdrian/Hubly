#!/usr/bin/env node
/**
 * Craft checks: frozen Brain + Website Runtime polish + Customer Runtime foundation.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const website = fs.readFileSync('supabase/functions/_shared/hubly_brain_website.ts', 'utf8');
const executors = fs.readFileSync('supabase/functions/_shared/hubly_brain_executors.ts', 'utf8');
const customerMem = fs.readFileSync('supabase/functions/_shared/hubly_brain_customer_memory.ts', 'utf8');
const customerProf = fs.readFileSync('supabase/functions/_shared/hubly_brain_customer_profile.ts', 'utf8');
const customerMatch = fs.readFileSync('supabase/functions/_shared/hubly_brain_customer_match.ts', 'utf8');
const match = fs.readFileSync('supabase/functions/_shared/marketplace_match.ts', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const findPro = fs.readFileSync('supabase/functions/hubly-find-pro/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260721240000_customer_memory_profile.sql', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(shared.includes('buildBusiness') && shared.includes('findPro'), 'buildBusiness + findPro APIs');
ok(shared.includes('customerRuntime') || shared.includes('7.8'), 'Customer Runtime in status');
ok(shared.includes('Your business is live') || executors.includes('Your business is live'), 'business-live messaging');

ok(executors.includes('Learning who you are') && executors.includes('Building your brand') && executors.includes('Publishing your business'), 'website progress language');
ok(!executors.includes('Writing homepage…') || executors.includes('Designing your homepage'), 'not underselling as website-only');
ok(website.includes('businessSchema') && website.includes('bookingPage') && website.includes('leadForms'), 'rich website surfaces');
ok(website.includes('socialShare') || website.includes('seo'), 'SEO/social share');

ok(customerMem.includes('HublyCustomerMemory') && customerMem.includes('what is true'), 'Customer Memory');
ok(customerProf.includes('HublyCustomerProfile') && customerProf.includes('prefersPremium'), 'Customer Profile');
ok(customerMatch.includes('scoreDnaFit'), 'DNA-fit scoring');
ok(match.includes('scoreDnaFit') && match.includes('dna_fit'), 'ranker uses DNA fit');
ok(match.includes('customerProfile'), 'ranker accepts customer profile');

ok(migration.includes('customer_memories') && migration.includes('customer_profiles'), 'customer tables');
ok(findPro.includes('findPro') || findPro.includes('Hubly.findPro'), 'find-pro edge');
ok(statusFn.includes('findPro') || statusFn.includes('sampleFindPro'), 'status demos findPro');

ok(constitution.includes('Customer Runtime') || constitution.includes('Customer Profile'), 'constitution customer');
ok(constitution.includes('Your business is live') || constitution.includes('business is live'), 'constitution live messaging');
ok(constitution.includes('Never combine') || constitution.includes('never combine'), 'constitution separation');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still Claude for editor chat');

if (failed) process.exit(1);
console.log('OK Website polish + Customer Runtime Phase 7.8 checklist passed');
