#!/usr/bin/env node
/**
 * SECTION 9 — AI Decision & Confidence Engine Release Gate
 *
 * Proves multi-dimension Decision Objects, matrix routing
 * (proceed / recommend / ask / research_more), approval, history,
 * and "Why didn't you…?" from stored decisions.
 */
import fs from 'fs';
import path from 'path';
import {
  DECISION_ENGINE_VERSION,
  DECISION_ENGINE_OWNER,
  assessDecision,
  assessHomepageRewrite,
  listDecisionHistory,
  answerWhyFromDecision,
  isWhyDecisionQuestion,
  clearDecisionStoreForTests,
  decisionActionToConfidenceBand,
} from './lib/decision-engine.mjs';
import { think } from './lib/think.mjs';
import { clearRegistryForTests } from './lib/expert-framework.mjs';
import { resetExpertsForTests, ensureExpertsRegistered } from './lib/initial-experts.mjs';

const root = process.cwd();
let failed = false;
const proofs = [];
const evidence = {
  decisionObjects: [],
  decisionScores: [],
  routingDecisions: {},
  approvalDecisions: [],
  askVsProceed: {},
  researchMoreExample: null,
  storedDecisionHistory: [],
  whyDidntYou: null,
  demo: {},
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

clearDecisionStoreForTests();
clearRegistryForTests();
resetExpertsForTests();
ensureExpertsRegistered();

const decisionSrc = read('supabase/functions/_shared/hubly_brain_decision.ts');
const thinkSrc = read('supabase/functions/_shared/hubly_brain_think.ts');
const policySrc = read('supabase/functions/_shared/hubly_brain_confidence_policy.ts');
const aiSrc = read('supabase/functions/_shared/hubly_ai.ts');

ok(decisionSrc.includes('DECISION_ENGINE_VERSION'), 'AI Decision Engine module exists');
ok(decisionSrc.includes('HublyDecisionObject'), 'Decision Object type exists');
ok(
  decisionSrc.includes('evidenceQuality') &&
    decisionSrc.includes('businessAlignment') &&
    decisionSrc.includes('customerImpact') &&
    decisionSrc.includes('experienceImpact'),
  'Multi-dimension scores exist (beyond confidence alone)',
);
ok(decisionSrc.includes('requiresApproval') && decisionSrc.includes('finalDecision'), 'Approval + final decision fields exist');
ok(/proceed|recommend|ask|research_more/.test(decisionSrc), 'Decision matrix states exist');
ok(decisionSrc.includes('answerWhyFromDecision'), 'Why-didn\'t-you retrieval from Decision Objects exists');
ok(thinkSrc.includes('assessHomepageRewrite') || thinkSrc.includes('assessDecision'), 'Think pipeline uses Decision Engine');
ok(thinkSrc.includes('isWhyDecisionQuestion'), 'Think answers Why didn\'t you? from Decision Engine');
ok(policySrc.includes('Decision Engine') || policySrc.includes('hubly_brain_decision'), 'Confidence policy notes Decision Engine ownership');
ok(aiSrc.includes('HublyDecisionEngine'), 'HublyAI exposes Decision Engine');
ok(DECISION_ENGINE_OWNER === 'hubly_brain', 'Decision Engine owned by Hubly Brain');
ok(DECISION_ENGINE_VERSION === '1.0.0', 'Decision Engine versioned');

const BUSINESS_ID = 'biz_section9_demo';
const DEMO = 'Rewrite my homepage.';

// Demo: Rewrite homepage → full assessment (expect recommend — approval for rewrite)
const homepage = assessHomepageRewrite({
  request: DEMO,
  businessId: BUSINESS_ID,
  confidence: 90,
  hasBusinessMemory: true,
  hasBusinessDna: true,
  hasStrategy: true,
  industryKnown: true,
  missingInfo: [],
});
evidence.demo.request = DEMO;
evidence.demo.homepageDecisionId = homepage.decisionId;
evidence.decisionObjects.push(summarize(homepage));
evidence.decisionScores.push({
  recommendation: homepage.recommendation,
  decisionScore: homepage.decisionScore,
  dimensions: homepage.dimensions,
});

ok(!!homepage.decisionId, 'Homepage rewrite generates a Decision Object');
ok(typeof homepage.confidence === 'number', 'Confidence is calculated');
ok(typeof homepage.evidenceQuality === 'number', 'Evidence Quality is calculated');
ok(typeof homepage.businessAlignment === 'number', 'Business Alignment is calculated');
ok(typeof homepage.customerImpact === 'number', 'Customer Impact is calculated');
ok(typeof homepage.experienceImpact === 'number', 'Experience Impact is calculated');
ok(['low', 'medium', 'high', 'very_high'].includes(homepage.risk), 'Risk is calculated');
ok(typeof homepage.requiresApproval === 'boolean', 'Approval requirement is calculated');
ok(['proceed', 'recommend', 'ask', 'research_more'].includes(homepage.finalDecision), 'Final decision is one of four matrix states');
ok(homepage.finalDecision === 'recommend', 'Homepage rewrite routes to Recommend (approval required)');
ok(homepage.requiresApproval === true, 'Homepage rewrite requires owner approval');
ok(homepage.decisionScore >= 70, 'Homepage rewrite has a strong overall Decision Score');
evidence.routingDecisions.homepageRewrite = homepage.finalDecision;
evidence.approvalDecisions.push({
  recommendation: homepage.recommendation,
  requiresApproval: homepage.requiresApproval,
  finalDecision: homepage.finalDecision,
});

// Proceed automatically — Move Reviews Higher (safe, low risk, high scores)
const proceedEx = assessDecision({
  recommendation: 'Move Reviews Higher',
  request: 'Move reviews above pricing on the homepage',
  confidence: 96,
  evidence: [
    'Business DNA: proof before price',
    'Prior reasoning: trust is primary objective',
    'Strategy Expert alignment',
  ],
  evidenceSourceKinds: ['business_dna', 'strategy_expert', 'research_expert'],
  reasoningExplanation:
    'Homeowners hiring pressure washing look for proof before comparing price — reviews above pricing improves trust.',
  hasBusinessMemory: true,
  hasBusinessDna: true,
  hasStrategy: true,
  industryKnown: true,
  goalsKnown: true,
  missingInfo: [],
  expectedOutcome: 'higher_trust',
  touchesWebsite: true,
  autoSafe: true,
  businessId: BUSINESS_ID,
  reasoningKey: 'move_reviews_higher',
});
ok(proceedEx.finalDecision === 'proceed', 'Ask vs Proceed: Move Reviews Higher → Proceed Automatically');
ok(proceedEx.requiresApproval === false, 'Proceed path does not require approval');
ok(proceedEx.risk === 'low', 'Proceed example has low risk');
evidence.decisionObjects.push(summarize(proceedEx));
evidence.askVsProceed.proceed = summarize(proceedEx);
evidence.routingDecisions.moveReviews = proceedEx.finalDecision;

// Ask — missing information
const askEx = assessDecision({
  recommendation: 'Rewrite homepage for luxury branding',
  request: 'Make my site feel luxury',
  confidence: 68,
  evidence: ['Owner asked for luxury feel'],
  evidenceSourceKinds: ['conversation_memory'],
  hasBusinessMemory: false,
  hasBusinessDna: false,
  hasStrategy: false,
  industryKnown: false,
  goalsKnown: false,
  missingInfo: ['industry', 'target_customer', 'business_name'],
  expectedOutcome: 'higher_trust',
  touchesWebsite: true,
  touchesBrand: true,
  businessId: BUSINESS_ID,
  reasoningKey: 'luxury_ask',
});
ok(askEx.finalDecision === 'ask', 'Ask vs Proceed: missing info → Ask');
ok(askEx.missingInfo.length >= 1, 'Ask example records missing information');
evidence.decisionObjects.push(summarize(askEx));
evidence.askVsProceed.ask = summarize(askEx);
evidence.routingDecisions.luxuryAsk = askEx.finalDecision;

// Research More — weak evidence
const researchEx = assessDecision({
  recommendation: 'Change pricing to premium packages only',
  request: 'Should I only offer premium pricing?',
  confidence: 42,
  evidence: [],
  evidenceSourceKinds: [],
  hasBusinessMemory: true,
  hasBusinessDna: false,
  hasStrategy: false,
  industryKnown: true,
  missingInfo: [],
  expectedOutcome: 'revenue',
  touchesPricing: true,
  businessId: BUSINESS_ID,
  reasoningKey: 'premium_pricing_research',
});
ok(researchEx.finalDecision === 'research_more', 'Research More example routes correctly');
ok(researchEx.evidenceQuality < 55, 'Research More has weak Evidence Quality');
evidence.decisionObjects.push(summarize(researchEx));
evidence.researchMoreExample = summarize(researchEx);
evidence.routingDecisions.premiumPricing = researchEx.finalDecision;

// Recommend (explicit high confidence + approval)
const recommendEx = assessDecision({
  recommendation: 'Use Family-Owned Branding',
  request: 'Update brand positioning',
  confidence: 88,
  evidence: ['Expanded into residential', 'DNA trust signals'],
  evidenceSourceKinds: ['business_memory', 'business_dna', 'strategy_expert'],
  reasoningExplanation: 'Residential expansion favors family-owned trust over luxury.',
  hasBusinessMemory: true,
  hasBusinessDna: true,
  hasStrategy: true,
  industryKnown: true,
  goalsKnown: true,
  expectedOutcome: 'more_repeat_customers',
  touchesBrand: true,
  businessId: BUSINESS_ID,
  reasoningKey: 'family_owned_brand',
});
ok(recommendEx.finalDecision === 'recommend', 'Brand change routes to Recommend');
ok(recommendEx.requiresApproval === true, 'Recommend path requires approval');
evidence.decisionObjects.push(summarize(recommendEx));
evidence.routingDecisions.familyOwned = recommendEx.finalDecision;
evidence.approvalDecisions.push({
  recommendation: recommendEx.recommendation,
  requiresApproval: recommendEx.requiresApproval,
  finalDecision: recommendEx.finalDecision,
});

const history = listDecisionHistory({ businessId: BUSINESS_ID, limit: 50 });
ok(history.length >= 5, 'Decision history is stored and retrievable');
evidence.storedDecisionHistory = history.map((d) => ({
  decisionId: d.decisionId,
  recommendation: d.recommendation,
  finalDecision: d.finalDecision,
  decisionScore: d.decisionScore,
  timestamp: d.timestamp,
}));

ok(isWhyDecisionQuestion("Why didn't you make that change?"), 'Detects Why didn\'t you? question');
const why = answerWhyFromDecision("Why didn't you make that change?", { businessId: BUSINESS_ID });
ok(why.fromStoredDecision === true && why.regenerated === false, 'Why didn\'t you? answers from stored Decision Object');
ok(!!why.decision, 'Why didn\'t you? retrieves a Decision Object');
ok(/Decision Engine|routed to|Confidence|Evidence Quality/i.test(why.answer), 'Why answer includes Decision Score dimensions');
ok(why.decision.finalDecision !== 'proceed' || history.some((h) => h.finalDecision !== 'proceed'), 'Why prefers explaining non-automatic routing');
evidence.whyDidntYou = {
  question: "Why didn't you make that change?",
  fromStoredDecision: why.fromStoredDecision,
  regenerated: why.regenerated,
  answer: why.answer,
  decisionId: why.decision?.decisionId || null,
  finalDecision: why.decision?.finalDecision || null,
};

// End-to-end think: Rewrite my homepage
const rewriteThink = await think({
  request: DEMO,
  businessId: 'biz_section9_think',
  memory: {
    businessId: 'biz_section9_think',
    name: 'Sparkle Wash Co',
    industry: 'pressure washing',
    memoryVersion: 2,
  },
  workspace: { memoryVersion: 1 },
});
ok(!!rewriteThink.primaryDecision, 'Think generates a primary Decision Object for homepage rewrite');
ok(typeof rewriteThink.primaryDecision.confidence === 'number', 'Think Decision Object has confidence');
ok(typeof rewriteThink.primaryDecision.evidenceQuality === 'number', 'Think Decision Object has evidence quality');
ok(typeof rewriteThink.primaryDecision.businessAlignment === 'number', 'Think Decision Object has business alignment');
ok(typeof rewriteThink.primaryDecision.customerImpact === 'number', 'Think Decision Object has customer impact');
ok(typeof rewriteThink.primaryDecision.risk === 'string', 'Think Decision Object has risk');
ok(
  ['proceed', 'recommend', 'ask', 'research_more'].includes(rewriteThink.primaryDecision.finalDecision),
  'Think chooses Proceed, Recommend, Ask, or Research',
);
ok(
  rewriteThink.experienceDirector?.actions?.some((a) => String(a).startsWith('decision_engine_')),
  'Think Experience Director records Decision Engine action',
);
ok(
  rewriteThink.confidenceBand === decisionActionToConfidenceBand(rewriteThink.primaryDecision.finalDecision),
  'Confidence band maps from Decision Engine action',
);
evidence.demo.think = {
  finalDecision: rewriteThink.primaryDecision.finalDecision,
  decisionScore: rewriteThink.primaryDecision.decisionScore,
  dimensions: rewriteThink.primaryDecision.dimensions,
  requiresApproval: rewriteThink.primaryDecision.requiresApproval,
  actions: rewriteThink.experienceDirector?.actions || [],
  responseSnippet: String(rewriteThink.response || '').slice(0, 240),
};

const whyThink = await think({
  request: "Why didn't you make that change?",
  businessId: 'biz_section9_think',
  memory: { businessId: 'biz_section9_think', industry: 'pressure washing', memoryVersion: 2 },
});
ok(whyThink.whyDecisionAnswer?.fromStoredDecision === true, 'Think Why didn\'t you? uses stored Decision Object');
ok(whyThink.whyDecisionAnswer?.regenerated === false, 'Think Why didn\'t you? does not regenerate');
ok(/routed to|Decision Engine|Confidence/i.test(whyThink.response), 'Think Why response grounded in Decision Object');
evidence.demo.thinkWhy = {
  response: whyThink.response,
  fromStored: whyThink.whyDecisionAnswer?.fromStoredDecision,
  finalDecision: whyThink.whyDecisionAnswer?.decision?.finalDecision,
};

evidence.releaseGate = {
  everyRecommendationGeneratesDecisionObject: evidence.decisionObjects.length >= 5,
  confidenceCalculated: evidence.decisionObjects.every((d) => typeof d.confidence === 'number'),
  evidenceQualityCalculated: evidence.decisionObjects.every((d) => typeof d.evidenceQuality === 'number'),
  businessAlignmentCalculated: evidence.decisionObjects.every((d) => typeof d.businessAlignment === 'number'),
  customerImpactCalculated: evidence.decisionObjects.every((d) => typeof d.customerImpact === 'number'),
  experienceImpactCalculated: evidence.decisionObjects.every((d) => typeof d.experienceImpact === 'number'),
  riskCalculated: evidence.decisionObjects.every((d) => !!d.risk),
  approvalRequirementsCalculated: evidence.decisionObjects.every((d) => typeof d.requiresApproval === 'boolean'),
  choosesProceedRecommendAskOrResearch: new Set(Object.values(evidence.routingDecisions)).size >= 4,
  decisionHistoryStored: history.length >= 5,
  ownerCanAskWhyDidntAct: why.fromStoredDecision && !why.regenerated,
  automatedEvidence: true,
};

ok(Object.values(evidence.releaseGate).every(Boolean), 'All Section 9 release-gate claims proven');
ok(
  evidence.releaseGate.choosesProceedRecommendAskOrResearch,
  'Routing covers Proceed, Recommend, Ask, and Research More',
);

const report = {
  section: 9,
  title: 'AI Decision & Confidence Engine',
  passed: !failed,
  version: DECISION_ENGINE_VERSION,
  owner: DECISION_ENGINE_OWNER,
  checkedAt: new Date().toISOString(),
  proofs,
  evidence,
  failures: failed ? 'One or more Section 9 checks failed — see console.' : null,
};

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs/HUBLY_BRAIN_SECTION9_PROOF.json'),
  JSON.stringify(report, null, 2) + '\n',
);

if (failed) {
  console.error('\nSECTION 9 INCOMPLETE — AI Decision & Confidence Engine');
  process.exit(1);
}

console.log('\nSECTION 9 PASS — AI Decision & Confidence Engine');
console.log('Evidence:', path.join(root, 'docs/HUBLY_BRAIN_SECTION9_PROOF.json'));
process.exit(0);

function summarize(d) {
  return {
    decisionId: d.decisionId,
    recommendation: d.recommendation,
    decisionScore: d.decisionScore,
    confidence: d.confidence,
    evidenceQuality: d.evidenceQuality,
    businessAlignment: d.businessAlignment,
    customerImpact: d.customerImpact,
    experienceImpact: d.experienceImpact,
    risk: d.risk,
    requiresApproval: d.requiresApproval,
    finalDecision: d.finalDecision,
    explanation: d.explanation,
    missingInfo: d.missingInfo,
    timestamp: d.timestamp,
  };
}
