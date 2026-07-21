#!/usr/bin/env node
/**
 * Craft checks: Phase 8 prove-the-product (Build · Creative Director · Daily · Domain).
 */
import fs from 'fs';

const shared = fs.readFileSync('supabase/functions/_shared/hubly_ai.ts', 'utf8');
const website = fs.readFileSync('supabase/functions/_shared/hubly_brain_website.ts', 'utf8');
const executors = fs.readFileSync('supabase/functions/_shared/hubly_brain_executors.ts', 'utf8');
const caps = fs.readFileSync('supabase/functions/_shared/hubly_brain_capabilities.ts', 'utf8');
const creative = fs.readFileSync('supabase/functions/_shared/hubly_brain_creative_director.ts', 'utf8');
const daily = fs.readFileSync('supabase/functions/_shared/hubly_brain_daily.ts', 'utf8');
const domain = fs.readFileSync('supabase/functions/_shared/hubly_brain_domain.ts', 'utf8');
const client = fs.readFileSync('public/hubly.html', 'utf8');
const constitution = fs.readFileSync('docs/HUBLY_CONSTITUTION.md', 'utf8');
const statusFn = fs.readFileSync('supabase/functions/hubly-ai-status/index.ts', 'utf8');
const dailyEdge = fs.readFileSync('supabase/functions/hubly-daily/index.ts', 'utf8');
const buildEdge = fs.readFileSync('supabase/functions/hubly-build-business/index.ts', 'utf8');
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  }
}

ok(shared.includes('buildBusiness') && shared.includes('findPro') && shared.includes('daily('), 'APIs: buildBusiness + findPro + daily');
ok(shared.includes('creativeDirector') && shared.includes('buildCreativeDirectorBrief'), 'build returns Creative Director');
ok(shared.includes('Hubly Daily') || shared.includes('buildHublyDaily'), 'Hubly Daily on Runtime');
ok(shared.includes('Phase 8') || shared.includes('"8"'), 'Phase 8 status');

ok(creative.includes('How I designed this') && creative.includes('targeting'), 'CD rationales');
ok(creative.includes('palette') || creative.includes('Color'), 'CD palette rationale');
ok(daily.includes('greeting') && daily.includes('recommendation'), 'Daily briefing');
ok(daily.includes('hublyWillHandle'), 'Daily handles work');
ok(domain.includes("Let's launch your business") && domain.includes('experience'), 'Domain launch experience');

ok(caps.includes('Checking domain availability') && caps.includes('Writing your website'), 'build capability labels');
ok(website.includes('businessSchema') && website.includes('leadForms'), 'rich website surfaces');
ok(executors.includes('suggestDomains') || executors.includes('runDomain'), 'domain executor');

ok(client.includes('hubly-daily') && client.includes('renderHublyDaily'), 'client Hubly Daily');
ok(client.includes('is-cd-brief') && client.includes('isAttachRuntimeBuildSurfaces'), 'client Creative Director after build');
ok(client.includes('is-domain-launch') && client.includes("Let's launch your business"), 'client Domain launch');
ok(client.includes('Launching your company') || client.includes('isBuildTitle'), 'magical build copy');

ok(dailyEdge.includes('Hubly.daily') || dailyEdge.includes('buildHublyDaily'), 'daily edge');
ok(buildEdge.includes('creativeDirector') && buildEdge.includes('daily'), 'build-business returns CD + Daily');
ok(statusFn.includes('creativeDirector') || statusFn.includes('dailyGreeting'), 'status demos Phase 8');

ok(constitution.includes('Hubly Daily') && constitution.includes('Creative Director'), 'constitution Phase 8 surfaces');
ok(constitution.includes('What job should Hubly do') || constitution.includes('Jobs Hubly performs'), 'jobs framing');
ok(constitution.includes('as simple as describing one'), 'guiding principle');

const cdEdge = fs.readFileSync('supabase/functions/creative-director/index.ts', 'utf8');
ok(cdEdge.includes('api.anthropic.com'), 'editor Creative Director still Claude');

if (failed) process.exit(1);
console.log('OK Phase 8 prove-the-product checklist passed');
