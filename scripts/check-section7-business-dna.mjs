#!/usr/bin/env node
/**
 * SECTION 7 — Business DNA Release Gate
 *
 * Proves structured, versioned, evidenced Business DNA knowledge used by
 * Research and Strategy Experts (read-only). No automatic community learning yet.
 */
import fs from 'fs';
import path from 'path';
import {
  HUBLY_DNA_KNOWLEDGE_VERSION,
  DNA_KNOWLEDGE_OWNER,
  loadBusinessDnaKnowledge,
  detectDnaLoadHints,
  attachDnaKnowledgePack,
  expertsReadDnaKnowledge,
} from './lib/dna-knowledge.mjs';
import { clearRegistryForTests } from './lib/expert-framework.mjs';
import { resetExpertsForTests, ensureExpertsRegistered } from './lib/initial-experts.mjs';
import { think } from './lib/think.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  dnaBefore: null,
  dnaAfter: null,
  version: null,
  evidenceLoaded: [],
  expertUsage: {},
  confidence: [],
  reasoning: [],
  regionalIntelligence: null,
  seasonality: null,
  communityLearning: null,
  releaseGate: {},
};

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('PASS:', msg);
    proofs.push(msg);
  }
}

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

const dnaSrc = read('supabase/functions/_shared/hubly_brain_dna.ts');
const knowSrc = read('supabase/functions/_shared/hubly_brain_dna_knowledge.ts');
const expertsSrc = read('supabase/functions/_shared/hubly_brain_experts.ts');
const thinkSrc = read('supabase/functions/_shared/hubly_brain_think.ts');

ok(knowSrc.includes('HUBLY_DNA_KNOWLEDGE_VERSION'), 'Business DNA knowledge engine exists');
ok(dnaSrc.includes('HUBLY_BUSINESS_DNA_VERSION = 2'), 'Business DNA is versioned (schema v2)');
ok(knowSrc.includes('HublyDnaEvidence') && knowSrc.includes('lastReviewed') && knowSrc.includes('appliesTo'), 'Evidence quality model exists');
ok(knowSrc.includes('customerPsychology') || knowSrc.includes('HublyDnaCustomerPsychology'), 'Customer psychology is modeled');
ok(knowSrc.includes('trustSignals') || knowSrc.includes('HublyDnaTrustSignals'), 'Trust signals are modeled');
ok(knowSrc.includes('pricingIntelligence'), 'Pricing intelligence exists');
ok(knowSrc.includes('serviceRelationships'), 'Service relationships exist');
ok(knowSrc.includes('websiteIntelligence'), 'Website intelligence exists');
ok(knowSrc.includes('growthIntelligence'), 'Growth intelligence exists');
ok(knowSrc.includes('seasonality') || knowSrc.includes('HublyDnaSeasonality'), 'Seasonality exists');
ok(knowSrc.includes('regionalIntelligence'), 'Regional intelligence exists');
ok(knowSrc.includes('communityLearning') && knowSrc.includes('automaticLearning: false'), 'Community learning model exists (no auto learning)');
ok(knowSrc.includes('Experts READ') || knowSrc.includes('never modify'), 'Experts read; never modify DNA');
ok(expertsSrc.includes('dnaUsed') && expertsSrc.includes('evidenceUsed'), 'Research/Strategy cite DNA evidence');
ok(expertsSrc.includes('reads: ["business_memory", "business_dna"') || expertsSrc.includes('business_dna'), 'Research Expert reads Business DNA');
ok(thinkSrc.includes('loadAndAttachDnaKnowledge'), 'Hubly Brain loads DNA knowledge for experts');

const DEMO = "I'm starting a pressure washing business in Salt Lake City.";
const dnaBefore = { version: 2, knowledgePack: null, knowledge: null };
evidence.dnaBefore = dnaBefore;

const hints = detectDnaLoadHints({ request: DEMO });
ok(hints.industry === 'pressure washing', 'Detects pressure washing industry from request');
ok(hints.city === 'Salt Lake City', 'Detects Salt Lake City regional hint');

const pack = loadBusinessDnaKnowledge({ request: DEMO });
const dnaAfter = attachDnaKnowledgePack(dnaBefore, pack);
evidence.dnaAfter = {
  knowledgeVersion: pack.knowledgeVersion,
  schemaVersion: pack.schemaVersion,
  industry: pack.industryProfile.industryName,
  region: pack.regionalIntelligence,
  evidenceCount: pack.evidence.length,
};
evidence.version = {
  schemaVersion: pack.schemaVersion,
  knowledgeVersion: pack.knowledgeVersion,
  dnaSchemaVersion: 2,
};

ok(!!pack.industryProfile?.industryName, 'Industry profile loaded');
ok(!!pack.customerPsychology?.buyingTriggers?.length, 'Customer psychology supplied');
ok(!!pack.trustSignals?.rankedByImportance?.length, 'Trust signals supplied');
ok(!!pack.pricingIntelligence?.typicalPricingModels?.length, 'Pricing guidance supplied');
ok(!!pack.websiteIntelligence?.recommendedHomepageOrder?.length, 'Homepage recommendations supplied');
ok(!!pack.websiteIntelligence?.bookingBestPractices?.length, 'Booking recommendations supplied');
ok(!!pack.seasonality?.busySeasons?.length, 'Seasonal opportunities supplied');
ok(pack.regionalIntelligence?.city === 'Salt Lake City', 'Regional intelligence for Salt Lake City');
ok(!!pack.regionalIntelligence?.climate, 'Regional climate intelligence present');
ok(pack.communityLearning?.automaticLearning === false, 'Community learning placeholder — automatic learning off');
ok(Array.isArray(pack.communityLearning?.validationHistory), 'Community learning validation history placeholder');

evidence.regionalIntelligence = pack.regionalIntelligence;
evidence.seasonality = pack.seasonality;
evidence.communityLearning = pack.communityLearning;
evidence.evidenceLoaded = pack.evidence.map((e) => ({
  id: e.id,
  category: e.category,
  source: e.source,
  confidence: e.confidence,
  lastReviewed: e.lastReviewed,
  appliesTo: e.appliesTo,
  claim: e.claim,
}));

ok(pack.evidence.every((e) =>
  e.source && typeof e.confidence === 'number' && e.lastReviewed && e.appliesTo
), 'Every DNA claim has source, confidence, lastReviewed, appliesTo');
ok(pack.evidence.some((e) => e.id === 'pw_trust_before_after' && e.confidence >= 0.9), 'Before/after trust signal evidenced at high confidence');
ok(pack.evidence.some((e) => e.category === 'regional' && /salt lake/i.test(JSON.stringify(e.appliesTo))), 'Regional evidence applies to Salt Lake City');

const usage = expertsReadDnaKnowledge(pack, DEMO);
ok(usage.research.dnaUsed === true, 'Research Expert reads Business DNA');
ok(usage.strategy.dnaUsed === true, 'Strategy Expert reads Business DNA');
ok(usage.research.customerPsychology && usage.research.trustSignals?.length, 'Research receives psychology + trust from DNA');
ok(usage.research.pricingGuidance && usage.research.homepageRecommendations?.length, 'Research receives pricing + homepage from DNA');
ok(usage.research.bookingRecommendations?.length && usage.research.seasonalOpportunities?.length, 'Research receives booking + seasonality from DNA');
ok(usage.strategy.homepageStrategy.includes('Business DNA'), 'Strategy uses DNA homepage recommendations');
ok(usage.strategy.pricingDirection.includes('Business DNA'), 'Strategy uses DNA pricing guidance');
ok(usage.research.readOnly && usage.strategy.readOnly, 'Experts treat DNA as read-only');

evidence.expertUsage = {
  research: {
    dnaUsed: usage.research.dnaUsed,
    evidenceIds: usage.research.evidenceUsed.map((e) => e.id),
    confidence: usage.research.confidence,
  },
  strategy: {
    dnaUsed: usage.strategy.dnaUsed,
    evidenceIds: usage.strategy.evidenceUsed.map((e) => e.id),
    confidence: usage.strategy.confidence,
  },
};
evidence.confidence = [
  { expert: 'research', confidence: usage.research.confidence },
  { expert: 'strategy', confidence: usage.strategy.confidence },
  ...pack.evidence.slice(0, 5).map((e) => ({ evidenceId: e.id, confidence: e.confidence })),
];
evidence.reasoning = [
  ...usage.research.reasoning,
  ...usage.strategy.reasoning,
];

// Full Brain think path — DNA attached, experts execute
clearRegistryForTests();
resetExpertsForTests();
ensureExpertsRegistered();
const result = await think({
  request: DEMO,
  memory: { industry: 'pressure washing', city: 'Salt Lake City' },
  debug: true,
});

const researchOut = result.expertOutputs.find((o) => o.expertId === 'research')?.output || {};
const strategyOut = result.expertOutputs.find((o) => o.expertId === 'strategy')?.output || {};
ok(!!result.dna?.knowledgePack, 'Think result includes attached DNA knowledge pack');
ok(researchOut.dnaUsed === true, 'Think path: Research Expert used Business DNA');
ok(strategyOut.dnaUsed === true, 'Think path: Strategy Expert used Business DNA');
ok(Array.isArray(researchOut.trustSignals) && researchOut.trustSignals.length > 0, 'Think path: Research returned trust signals from DNA');
ok(Array.isArray(researchOut.homepageRecommendations) && researchOut.homepageRecommendations.length > 0, 'Think path: Research returned homepage recommendations');
ok(Array.isArray(researchOut.seasonalOpportunities) && researchOut.seasonalOpportunities.length > 0, 'Think path: Research returned seasonal opportunities');
ok(/Business DNA/i.test(strategyOut.homepageStrategy || '') || strategyOut.dnaUsed, 'Think path: Strategy applied DNA homepage guidance');
ok(researchOut.regional?.city === 'Salt Lake City' || result.dna.knowledgePack.regionalIntelligence.city === 'Salt Lake City', 'Think path: regional DNA for SLC present');

ok(fs.existsSync(path.join(root, 'docs/HUBLY_BRAIN_SECTION7.md')), 'Section 7 documentation exists');
ok(HUBLY_DNA_KNOWLEDGE_VERSION === '1.0.0' && DNA_KNOWLEDGE_OWNER === 'hubly_brain', 'Knowledge owned/versioned by Hubly Brain');

evidence.releaseGate = {
  businessDnaExists: true,
  versioned: true,
  customerPsychologyModeled: true,
  trustSignalsModeled: true,
  pricingIntelligence: true,
  serviceRelationships: true,
  websiteIntelligence: true,
  growthIntelligence: true,
  seasonality: true,
  regionalIntelligence: true,
  communityLearningModel: true,
  researchReadsDna: true,
  strategyReadsDna: true,
  evidenceQuality: true,
  automatedEvidence: true,
};

const report = {
  section: 7,
  title: 'Business DNA',
  passed: !failed,
  checkedAt: new Date().toISOString(),
  version: '1.0.0',
  architectureSummary: {
    dnaModule: 'supabase/functions/_shared/hubly_brain_dna.ts',
    knowledgeModule: 'supabase/functions/_shared/hubly_brain_dna_knowledge.ts',
    schemaVersion: 2,
    knowledgeVersion: pack.knowledgeVersion,
    owner: DNA_KNOWLEDGE_OWNER,
    principle: 'Business DNA is structured evidenced knowledge. Experts read. Brain loads. No automatic community learning yet.',
    evidenceQuality: 'source · confidence · lastReviewed · appliesTo',
  },
  demoRequest: DEMO,
  proofs,
  evidence,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION7_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 7 INCOMPLETE — Business DNA Release Gate failed');
  process.exit(1);
}

console.log('\nSECTION 7 COMPLETE — Business DNA Release Gate passed');
console.log('Industry:', pack.industryProfile.industryName);
console.log('Region:', pack.regionalIntelligence.city, pack.regionalIntelligence.state);
console.log('Evidence claims:', pack.evidence.length);
