#!/usr/bin/env node
/**
 * Craft checks: frozen Brain + magical Build UX + Customer Runtime + Living roadmap.
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const website = fs.readFileSync('supabase/functions/_shared/hubly_brain_website.ts', 'utf8');
const executors = fs.readFileSync('supabase/functions/_shared/hubly_brain_executors.ts', 'utf8');
const caps = fs.readFileSync('supabase/functions/_shared/hubly_brain_capabilities.ts', 'utf8');
const customerMem = fs.readFileSync('supabase/functions/_shared/hubly_brain_customer_memory.ts', 'utf8');
const customerProf = fs.readFileSync('supabase/functions/_shared/hubly_brain_customer_profile.ts', 'utf8');
const customerMatch = fs.readFileSync('supabase/functions/_shared/hubly_brain_customer_match.ts', 'utf8');
const domain = fs.readFileSync('supabase/functions/_shared/hubly_brain_domain.ts', 'utf8');
const timeline = fs.readFileSync('supabase/functions/_shared/hubly_brain_timeline.ts', 'utf8');
const health = fs.readFileSync('supabase/functions/_shared/hubly_brain_health.ts', 'utf8');
const identity = fs.readFileSync('supabase/functions/_shared/hubly_brain_identity.ts', 'utf8');
const match = fs.readFileSync('supabase/functions/_shared/marketplace_match.ts', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const findPro = fs.readFileSync('supabase/functions/hubly-find-pro/index.ts', 'utf8');
const migrationCustomer = fs.readFileSync('supabase/migrations/20260721240000_customer_memory_profile.sql', 'utf8');
const migrationTimeline = fs.readFileSync('supabase/migrations/20260721250000_business_timeline.sql', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(shared.includes('buildBusiness') && shared.includes('findPro'), 'buildBusiness + findPro APIs');
ok(shared.includes('Nice to meet you') && shared.includes('Your business is live'), 'magical build greeting + live');
ok(shared.includes('identity') && shared.includes('timeline') && shared.includes('health'), 'build returns identity/timeline/health');

ok(caps.includes('"domain"') && caps.includes('Checking domain availability'), 'domain capability');
ok(caps.includes('Preparing your marketplace profile'), 'marketplace profile language');
ok(caps.includes('Writing your website') && caps.includes('Creating your CRM'), 'build progress labels');
ok(executors.includes('runDomain') || executors.includes('suggestDomains'), 'domain executor');
ok(executors.includes('runPayments') || executors.includes('payments'), 'payments executor');
ok(executors.includes('marketplaceProfile'), 'marketplace profile executor');

ok(website.includes('businessSchema') && website.includes('bookingPage') && website.includes('leadForms'), 'rich website surfaces');
ok(domain.includes('suggestDomains') && domain.includes('.com'), 'domain suggestions');
ok(timeline.includes('Business Timeline') || timeline.includes('buildLaunch'), 'timeline signature');
ok(health.includes('assessBusinessHealth') && health.includes('overall'), 'business health');
ok(identity.includes('Status') || identity.includes('Ready'), 'business identity');

ok(customerMem.includes('HublyCustomerMemory') && customerMem.includes('what is true'), 'Customer Memory');
ok(customerProf.includes('HublyCustomerProfile') && customerProf.includes('prefersPremium'), 'Customer Profile');
ok(customerMatch.includes('scoreDnaFit'), 'DNA-fit scoring');
ok(match.includes('scoreDnaFit') && match.includes('dna_fit'), 'ranker uses DNA fit');

ok(migrationCustomer.includes('customer_memories') && migrationCustomer.includes('customer_profiles'), 'customer tables');
ok(migrationTimeline.includes('business_timeline_events'), 'timeline table');
ok(findPro.includes('findPro') || findPro.includes('Hubly.findPro'), 'find-pro edge');
ok(statusFn.includes('sampleFindPro') && statusFn.includes('identity'), 'status demos build+findPro');

ok(constitution.includes('AI business partner') || constitution.includes('partner test'), 'partner test');
ok(constitution.includes('reduce work') || constitution.includes('reduce work for the business owner'), 'work reduction rule');
ok(constitution.includes('as simple as describing one'), 'guiding principle');
ok(constitution.includes('Four Magical Moments') || constitution.includes('Magical Moments'), 'magical moments');
ok(constitution.includes('Living Business') && constitution.includes('Business Timeline'), 'living roadmap + timeline');
ok(constitution.includes('Customer Runtime') && constitution.includes('findPro'), 'customer runtime');
ok(constitution.includes('Never combine') || constitution.includes('never combine'), 'constitution separation');
ok(constitution.includes('Business Health') && constitution.includes('Business Maturity'), 'health + maturity');
ok(constitution.includes('Capability Confidence'), 'confidence');

const maturity = fs.readFileSync('supabase/functions/_shared/hubly_brain_maturity.ts', 'utf8');
ok(maturity.includes('launching') && maturity.includes('scaling') && maturity.includes('inferMaturity'), 'maturity foundation');
ok(shared.includes('inferMaturity') || shared.includes('maturity'), 'buildBusiness returns maturity');

const productRule = fs.readFileSync('.cursor/rules/hubly-product-direction.mdc', 'utf8');
ok(productRule.includes('as simple as describing one') && productRule.includes('Sprint filter'), 'product direction rule');

const creative = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(creative.includes('api.anthropic.com'), 'creative-director still Claude for editor chat');

if (failed) process.exit(1);
console.log('OK Living Business build UX + Customer Runtime checklist passed');
