/**
 * Node mirror of hubly_brain_reasoning.ts — Section 8 behavioral proofs.
 */
export const REASONING_ENGINE_VERSION = '1.0.0';
export const REASONING_OWNER = 'hubly_brain';

const STORE = new Map();
const KEY_INDEX = new Map();
const GRAPH = [];
const BIZ_INDEX = new Map();

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function clampConfidence(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function cloneReasoning(r) {
  return {
    ...r,
    evidence: [...r.evidence],
    evidenceSources: r.evidenceSources.map((e) => ({ ...e })),
    expertsInvolved: [...r.expertsInvolved],
    influencedBy: [...r.influencedBy],
    influences: [...r.influences],
  };
}
function indexKey(key, id) {
  const list = KEY_INDEX.get(key) || [];
  if (!list.includes(id)) list.push(id);
  KEY_INDEX.set(key, list);
}
function indexBiz(businessId, id) {
  if (!businessId) return;
  const list = BIZ_INDEX.get(businessId) || [];
  if (!list.includes(id)) list.push(id);
  BIZ_INDEX.set(businessId, list);
}
function linkGraph(parentId, childId) {
  if (!parentId || !STORE.has(parentId)) return;
  const parent = STORE.get(parentId);
  const child = STORE.get(childId);
  if (!parent.influences.includes(childId)) parent.influences.push(childId);
  if (!child.influencedBy.includes(parentId)) child.influencedBy.push(parentId);
  GRAPH.push({ from: parentId, to: childId, relation: 'influences' });
  STORE.set(parentId, parent);
  STORE.set(childId, child);
}

export function makeReasoning(opts) {
  const key = String(opts.decisionKey || 'general').trim();
  const priorIds = KEY_INDEX.get(key) || [];
  const prior = priorIds.length ? STORE.get(priorIds[priorIds.length - 1]) : null;
  const sameDecision = prior && prior.decision === opts.decision;
  const version = prior ? (sameDecision ? prior.version : prior.version + 1) : 1;

  let explanation = opts.explanation;
  let reusesReasoningId = opts.reusesReasoningId || null;
  if (reusesReasoningId && STORE.has(reusesReasoningId)) {
    const reused = STORE.get(reusesReasoningId);
    if (!explanation || explanation.length < 20) explanation = reused.explanation;
    else if (!explanation.includes(reused.explanation.slice(0, 40))) {
      explanation = `${explanation} (Building on earlier reasoning: ${reused.explanation})`;
    }
  }

  const experts = [...(opts.expertsInvolved || []), ...(opts.expertId ? [opts.expertId] : [])].filter(Boolean);
  const obj = {
    reasoningId: newId('rsn'),
    decisionKey: key,
    decision: opts.decision,
    explanation,
    evidence: [...(opts.evidence || [])],
    evidenceSources: [...(opts.evidenceSources || [])],
    confidence: clampConfidence(opts.confidence),
    expectedOutcome: opts.expectedOutcome,
    expertsInvolved: [...new Set(experts.map(String))],
    timestamp: opts.at || new Date().toISOString(),
    version,
    businessVersion: opts.businessVersion ?? null,
    workspaceVersion: opts.workspaceVersion ?? null,
    dnaVersion: opts.dnaVersion ?? null,
    influencedBy: [],
    influences: [],
    reusesReasoningId,
    domain: opts.domain ?? null,
    businessId: opts.businessId ?? null,
  };
  STORE.set(obj.reasoningId, obj);
  indexKey(key, obj.reasoningId);
  indexBiz(opts.businessId, obj.reasoningId);
  for (const p of [...(opts.influencedBy || []), ...(reusesReasoningId ? [reusesReasoningId] : [])]) {
    linkGraph(p, obj.reasoningId);
  }
  return cloneReasoning(STORE.get(obj.reasoningId));
}

export function getReasoning(reasoningId) {
  const r = STORE.get(String(reasoningId));
  return r ? cloneReasoning(r) : null;
}

export function listReasoningForKey(decisionKey) {
  return (KEY_INDEX.get(String(decisionKey)) || [])
    .map((id) => STORE.get(id))
    .filter(Boolean)
    .map(cloneReasoning);
}

export function listReasoningHistory(opts = {}) {
  let ids = [];
  if (opts.decisionKey) ids = [...(KEY_INDEX.get(String(opts.decisionKey)) || [])];
  else if (opts.businessId) ids = [...(BIZ_INDEX.get(String(opts.businessId)) || [])];
  else ids = [...STORE.keys()];
  const limit = opts.limit ?? 50;
  return ids
    .map((id) => STORE.get(id))
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit)
    .map(cloneReasoning);
}

export function compareReasoningVersions(decisionKey) {
  const versions = listReasoningForKey(decisionKey);
  return {
    key: decisionKey,
    versions,
    changed: versions.length > 1 && versions[0].decision !== versions[versions.length - 1].decision,
  };
}

export function isWhyQuestion(request) {
  const r = String(request || '').toLowerCase();
  return /why did we|why did you|why choose|why (this|our|the)|why move|why recommend|what'?s the reason/.test(r);
}

export function detectWhyDecisionKey(request) {
  const r = String(request || '').toLowerCase();
  if (/homepage|home page|first screen/.test(r)) return 'homepage_strategy';
  if (/booking|book flow|cta/.test(r)) return 'booking_strategy';
  if (/pricing|price|package/.test(r)) return 'pricing_direction';
  if (/brand|positioning|position/.test(r)) return 'brand_positioning';
  if (/trust|review/.test(r)) return 'trust_recommendations';
  if (/industry/.test(r)) return 'industry_selection';
  if (/luxury|family-owned|branding/.test(r)) return 'brand_positioning';
  return null;
}

export function buildDecisionChain(reasoningId) {
  const chain = [];
  const seen = new Set();
  let cur = STORE.get(String(reasoningId));
  const stack = [];
  while (cur && !seen.has(cur.reasoningId)) {
    seen.add(cur.reasoningId);
    stack.push(cur);
    cur = cur.influencedBy[0] ? STORE.get(cur.influencedBy[0]) : undefined;
  }
  stack.reverse();
  for (const r of stack) {
    chain.push({ reasoningId: r.reasoningId, decision: r.decision, decisionKey: r.decisionKey });
  }
  return chain;
}

export function answerWhyFromReasoning(request, opts = {}) {
  const key = detectWhyDecisionKey(request);
  let history = key
    ? listReasoningForKey(key)
    : listReasoningHistory({ businessId: opts.businessId, limit: 20 });
  const latest = history.length ? history[history.length - 1] : null;
  if (!latest) {
    return {
      fromStoredReasoning: true,
      regenerated: false,
      decisionKey: key,
      answer: "I don't have stored reasoning for that decision yet.",
      reasoning: null,
      history: [],
      decisionGraph: [],
      confidence: 40,
    };
  }
  const chain = buildDecisionChain(latest.reasoningId);
  const chainText = chain.length > 1
    ? ' Here\'s how it connects: ' + chain.map((c) => `${c.decisionKey} → ${c.decision}`).join(' → ') + '.'
    : '';
  const versionNote = history.length > 1
    ? ` (This is version ${latest.version}; earlier: "${history[0].decision}".)`
    : '';
  const answer =
    `We chose this because: ${latest.explanation}` +
    ` Evidence: ${latest.evidence.slice(0, 3).join('; ') || 'stored business context'}.` +
    ` Expected outcome: ${latest.expectedOutcome}.` +
    ` Confidence: ${latest.confidence}.` +
    ` Experts involved: ${latest.expertsInvolved.join(' → ') || 'Hubly Brain'}.` +
    versionNote +
    chainText;
  return {
    fromStoredReasoning: true,
    regenerated: false,
    decisionKey: latest.decisionKey,
    answer,
    reasoning: cloneReasoning(latest),
    history: history.map(cloneReasoning),
    decisionGraph: chain,
    confidence: latest.confidence,
  };
}

export function recordBuildBusinessReasoningChain(opts) {
  const biz = opts.businessId || null;
  const industry = opts.industry || 'pressure washing';
  const versions = {
    businessVersion: opts.businessVersion ?? null,
    workspaceVersion: opts.workspaceVersion ?? null,
    dnaVersion: opts.dnaVersion ?? null,
    businessId: biz,
  };

  const industryR = makeReasoning({
    decisionKey: 'industry_selection',
    decision: `Focus on ${industry}`,
    explanation: `You said you're starting a ${industry} business, so industry selection follows your description.`,
    evidence: [opts.request, `industry=${industry}`],
    evidenceSources: [
      { kind: 'business_memory', detail: 'owner request' },
      { kind: 'research_expert', detail: 'industry research' },
    ],
    confidence: 95,
    expectedOutcome: 'clearer_positioning',
    expertsInvolved: ['research', 'hubly_brain'],
    domain: 'industry',
    ...versions,
  });

  const brandR = makeReasoning({
    decisionKey: 'brand_positioning',
    decision: `${industry} that earns trust with before/after proof before asking for a booking`,
    explanation:
      'Homeowners hiring pressure washing services usually look for proof before comparing price. Positioning around visible trust beats generic price competition.',
    evidence: [
      'Business DNA: before/after photos are a top trust signal',
      'Research: buyers fear damage and no-shows',
    ],
    evidenceSources: [
      { kind: 'business_dna', ref: 'pw_trust_before_after' },
      { kind: 'research_expert' },
      { kind: 'strategy_expert' },
    ],
    confidence: 88,
    expectedOutcome: 'higher_trust',
    expertsInvolved: ['research', 'strategy'],
    influencedBy: [industryR.reasoningId],
    domain: 'brand',
    ...versions,
  });

  const homepageR = makeReasoning({
    decisionKey: 'homepage_strategy',
    decision: 'Lead with proof, then packages, then a single Book CTA',
    explanation:
      'I recommend this homepage order because homeowners hiring pressure washing services usually look for proof before comparing price. Based on your Business DNA, putting reviews/proof above pricing should improve trust.',
    evidence: [
      'Business DNA homepage order: Hero with before/after → Packages → Trust proof → Book',
      brandR.decision,
    ],
    evidenceSources: [
      { kind: 'business_dna', ref: 'pw_web_homepage' },
      { kind: 'strategy_expert' },
      { kind: 'creative_director' },
    ],
    confidence: 90,
    expectedOutcome: 'higher_conversion',
    expertsInvolved: ['strategy', 'creative_director', 'critic'],
    influencedBy: [brandR.reasoningId],
    reusesReasoningId: brandR.reasoningId,
    domain: 'website',
    ...versions,
  });

  const bookingR = makeReasoning({
    decisionKey: 'booking_strategy',
    decision: 'One primary Book / Get quote CTA — avoid multi-step quizzes',
    explanation:
      'A single booking path reduces friction once trust is established on the homepage.',
    evidence: ['Business DNA booking best practices', homepageR.decision],
    evidenceSources: [
      { kind: 'business_dna', ref: 'pw_web_booking' },
      { kind: 'strategy_expert' },
    ],
    confidence: 89,
    expectedOutcome: 'simpler_booking',
    expertsInvolved: ['strategy', 'creative_director'],
    influencedBy: [homepageR.reasoningId],
    domain: 'booking',
    ...versions,
  });

  const pricingR = makeReasoning({
    decisionKey: 'pricing_direction',
    decision: 'Package tiers (driveway / house / full property) with a clear mid package',
    explanation:
      'Clear package tiers outperform open-ended hourly quotes for first-time pressure washing buyers.',
    evidence: ['Business DNA pricing models', 'Customer expectation of clear mid package'],
    evidenceSources: [
      { kind: 'business_dna', ref: 'pw_price_packages' },
      { kind: 'strategy_expert' },
    ],
    confidence: 88,
    expectedOutcome: 'more_bookings',
    expertsInvolved: ['strategy', 'research'],
    influencedBy: [brandR.reasoningId, homepageR.reasoningId],
    domain: 'pricing',
    ...versions,
  });

  const trustR = makeReasoning({
    decisionKey: 'trust_recommendations',
    decision: 'Lead with before/after photos and insured language above pricing',
    explanation:
      'Before & after photos are a top trust signal for pressure washing. Showing proof before price reduces damage fears.',
    evidence: [
      'Business DNA trust ranking: Before & after photos first',
      'Insured & licensed language',
    ],
    evidenceSources: [
      { kind: 'business_dna', ref: 'pw_trust_before_after' },
      { kind: 'research_expert' },
      { kind: 'critic' },
    ],
    confidence: 94,
    expectedOutcome: 'higher_trust',
    expertsInvolved: opts.experts || ['research', 'strategy', 'creative_director', 'critic'],
    influencedBy: [brandR.reasoningId, homepageR.reasoningId],
    reusesReasoningId: brandR.reasoningId,
    domain: 'trust',
    ...versions,
  });

  return [industryR, brandR, homepageR, bookingR, pricingR, trustR].map((r) => getReasoning(r.reasoningId));
}

export function clearReasoningStoreForTests() {
  STORE.clear();
  KEY_INDEX.clear();
  GRAPH.length = 0;
  BIZ_INDEX.clear();
}

export function exportReasoningStore() {
  const byId = {};
  for (const [id, r] of STORE) byId[id] = cloneReasoning(r);
  const byKey = {};
  for (const [k, ids] of KEY_INDEX) byKey[k] = [...ids];
  return { byId, byKey, graphEdges: GRAPH.map((e) => ({ ...e })) };
}
