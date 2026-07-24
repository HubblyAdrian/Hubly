/**
 * Node mirror of hubly_brain_dna_knowledge.ts — Section 7 behavioral proofs.
 */
export const HUBLY_DNA_KNOWLEDGE_VERSION = '1.0.0';
export const DNA_KNOWLEDGE_OWNER = 'hubly_brain';
const REVIEWED = '2026-07-23';

function evidence(partial) {
  return {
    id: partial.id,
    claim: partial.claim,
    category: partial.category,
    source: partial.source,
    confidence: partial.confidence,
    lastReviewed: partial.lastReviewed,
    appliesTo: {
      industry: partial.appliesTo?.industry || ['pressure washing'],
      region: partial.appliesTo?.region || 'global',
      businessStage: partial.appliesTo?.businessStage || ['starting', 'growing', 'established'],
    },
  };
}

function pressureWashingEvidence(region) {
  const base = [
    evidence({
      id: 'pw_psych_curb',
      claim: 'Homeowners hire pressure washing for curb appeal before selling, parties, or spring refresh — they fear damage and no-shows more than price alone.',
      category: 'customer_psychology', source: 'Internal blueprint', confidence: 0.94, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_trust_before_after',
      claim: 'Before & after photos are a top trust signal for pressure washing companies.',
      category: 'trust_signals', source: 'Internal blueprint', confidence: 0.94, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_trust_insured',
      claim: 'Insured & licensed language reduces damage fears for pressure washing buyers.',
      category: 'trust_signals', source: 'Internal blueprint', confidence: 0.91, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_price_packages',
      claim: 'Clear package tiers (driveway / house / full property) outperform open-ended hourly quotes for first-time buyers.',
      category: 'pricing', source: 'Internal blueprint', confidence: 0.88, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_web_homepage',
      claim: 'High-converting pressure washing homepages lead with proof, then packages, then a single booking CTA.',
      category: 'website', source: 'Internal blueprint', confidence: 0.9, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_web_booking',
      claim: 'One primary Book / Get quote CTA beats multi-step preference quizzes for local service booking.',
      category: 'website', source: 'Internal blueprint', confidence: 0.89, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_season_spring',
      claim: 'Pressure washing demand peaks spring through early fall; wet weeks shift scheduling.',
      category: 'seasonality', source: 'Internal blueprint', confidence: 0.92, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_services_bundle',
      claim: 'Driveway + house wash bundles and soft-wash upsells naturally belong together.',
      category: 'services', source: 'Internal blueprint', confidence: 0.87, lastReviewed: REVIEWED,
    }),
    evidence({
      id: 'pw_growth_reviews',
      claim: 'Asking for a review after a strong before/after job is a primary growth lever for new pressure washing businesses.',
      category: 'growth', source: 'Internal blueprint', confidence: 0.85, lastReviewed: REVIEWED,
    }),
  ];
  if (region?.city && /salt lake/i.test(region.city)) {
    base.push(evidence({
      id: 'pw_slc_climate',
      claim: 'Salt Lake City pressure washing is seasonal around freeze/thaw and spring pollen — winter outdoor washing is limited.',
      category: 'regional', source: 'Internal blueprint', confidence: 0.9, lastReviewed: REVIEWED,
      appliesTo: {
        industry: ['pressure washing'],
        region: { country: 'US', state: 'UT', city: 'Salt Lake City' },
        businessStage: ['starting', 'growing', 'established'],
      },
    }));
    base.push(evidence({
      id: 'pw_slc_buy',
      claim: 'Salt Lake City homeowners respond to clear scheduling around weather windows and mountain-valley dust cleanup messaging.',
      category: 'regional', source: 'Internal blueprint', confidence: 0.84, lastReviewed: REVIEWED,
      appliesTo: {
        industry: ['pressure washing'],
        region: { country: 'US', state: 'UT', city: 'Salt Lake City' },
        businessStage: ['starting', 'growing'],
      },
    }));
  }
  return base;
}

function buildPressureWashingPack({ city, state, country }) {
  const evidenceList = pressureWashingEvidence({ city, state });
  return {
    schemaVersion: HUBLY_DNA_KNOWLEDGE_VERSION,
    knowledgeVersion: 1,
    loadedAt: new Date().toISOString(),
    loadedBy: DNA_KNOWLEDGE_OWNER,
    industryProfile: {
      industryName: 'pressure washing',
      businessCategories: ['exterior cleaning', 'property maintenance', 'local service'],
      typicalBusinessStages: ['starting', 'solo operator', 'crew-based', 'commercial routes'],
      commonBusinessModels: ['mobile service', 'residential routes', 'commercial contracts'],
      serviceDeliveryMethods: ['on-site mobile', 'soft wash', 'surface cleaning'],
    },
    customerPsychology: {
      buyingTriggers: ['curb appeal before sale', 'spring cleanup', 'events/parties', 'hard-water stains'],
      buyingFears: ['damage to paint/siding', 'no-shows', 'upsell pressure', 'unclear pricing'],
      trustBuilders: ['before/after photos', 'insured language', 'clear packages', 'same-week availability'],
      decisionSpeed: 'fast when proof is visible — often 2–3 quotes compared',
      priceSensitivity: 'moderate — quality/trust beats cheapest once fear of damage is addressed',
      emotionalMotivations: ['pride of home', 'relief from hassle', 'confidence neighbors will notice'],
      commonObjections: [
        'Will it damage paint/siding?',
        'Are you insured?',
        'Can you do driveways and roofs?',
        'Why not hire the cheaper neighbor?',
      ],
    },
    trustSignals: {
      signals: ['Before & after photos', 'Insured & licensed', 'Years in business / reviews', 'Guarantees', 'Clear package pricing', 'Certifications'],
      rankedByImportance: ['Before & after photos', 'Insured & licensed', 'Clear package pricing', 'Reviews', 'Guarantees', 'Years in business'],
    },
    serviceRelationships: {
      primaryServices: ['driveway wash', 'house wash', 'sidewalk / patio clean'],
      upsells: ['soft wash', 'gutter brightening', 'fleet wash'],
      crossSells: ['window rinse', 'deck clean'],
      seasonalServices: ['spring package', 'pre-sale curb appeal'],
      serviceBundles: ['driveway + house', 'full property'],
      membershipOpportunities: ['quarterly wash club', 'HOA route contract'],
    },
    pricingIntelligence: {
      typicalPricingModels: ['package tiers', 'per-surface', 'quote after photos'],
      customerExpectations: ['clear mid package', 'written scope', 'no surprise fees'],
      premiumPositioningOpportunities: ['soft wash expertise', 'insured commercial routes', 'photo proof gallery'],
      valuePositioning: ['proof first', 'bundle savings', 'reliable scheduling'],
      discountRisks: ['race-to-bottom quotes', 'holiday deep discounts that train delay'],
    },
    websiteIntelligence: {
      recommendedHomepageOrder: ['Hero with before/after', 'Packages', 'Trust proof', 'Book'],
      highConvertingLayouts: ['proof-led', 'three package cards', 'single CTA'],
      bookingBestPractices: ['one Book / Get quote CTA', 'photo upload optional', 'same-week slots highlighted'],
      galleryRecommendations: ['real before/after pairs', 'local properties', 'avoid stock-only'],
      ctaStrategy: ['Book now as only hard ask on first screen'],
      contentPriorities: ['damage myths', 'insurance', 'package clarity', 'seasonal tips'],
    },
    growthIntelligence: {
      growthOpportunities: ['commercial property routes', 'realtor partnerships', 'HOA contracts'],
      referralIdeas: ['neighbor referral after curb-appeal job', 'realtor thank-you cards'],
      membershipIdeas: ['quarterly wash membership'],
      reviewStrategies: ['ask after strong before/after delivery', 'photo in review request'],
      customerRetentionIdeas: ['seasonal reminder texts', 'annual spring package'],
      expansionOpportunities: ['window cleaning add-on', 'fleet contracts'],
    },
    seasonality: {
      busySeasons: ['spring', 'early summer', 'early fall'],
      slowSeasons: ['deep winter'],
      weatherImpact: ['wet weeks delay outdoor washing', 'freeze/thaw limits winter work'],
      holidayOpportunities: ['pre-holiday curb appeal', 'spring open-house prep'],
      regionalSeasonality: city && /salt lake/i.test(city)
        ? ['SLC: strong spring pollen/dust cleanup window', 'limited outdoor washing in freeze months']
        : ['Adjust to local climate'],
    },
    regionalIntelligence: {
      country: country || 'US',
      state: state || (/salt lake/i.test(city || '') ? 'UT' : null),
      city: city || null,
      climate: city && /salt lake/i.test(city)
        ? 'Semi-arid mountain valley — dusty springs, cold winters'
        : null,
      regionalBuyingBehavior: city && /salt lake/i.test(city)
        ? [
          'Schedule around weather windows',
          'Mountain-valley dust cleanup messaging resonates',
          'Homeowners compare a few local quotes quickly',
        ]
        : ['Local homeowners compare 2–3 quotes'],
      localTerminology: ['soft wash', 'driveway wash', 'house wash', 'curb appeal', 'valley dust'],
    },
    communityLearning: {
      enabled: false,
      automaticLearning: false,
      version: 0,
      evidence: [],
      confidence: 0,
      source: 'placeholder — community learning not implemented',
      communityLearnings: [],
      validationHistory: [{
        at: REVIEWED,
        action: 'model_created',
        note: 'Community learning data model reserved; automatic learning not implemented in Section 7.',
      }],
    },
    evidence: evidenceList,
  };
}

/** Platform Extensibility (Section 15) — industry packs register here. */
const INDUSTRY_PACKS = new Map();

function normalizeIndustryKey(industry) {
  return String(industry || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function registerDnaIndustryPack(industry, pack) {
  const key = normalizeIndustryKey(industry);
  if (!key) throw new Error('DNA industry pack requires industry key');
  INDUSTRY_PACKS.set(key, pack);
}

export function unregisterDnaIndustryPack(industry) {
  return INDUSTRY_PACKS.delete(normalizeIndustryKey(industry));
}

export function getDnaIndustryPack(industry) {
  return INDUSTRY_PACKS.get(normalizeIndustryKey(industry)) || null;
}

export function listDnaIndustryPacks() {
  return [...INDUSTRY_PACKS.entries()].map(([industry, pack]) => ({
    industry,
    industryName: pack.industryProfile?.industryName || industry,
    knowledgeVersion: pack.knowledgeVersion,
  }));
}

export function clearDnaIndustryPacksForTests() {
  INDUSTRY_PACKS.clear();
}

export function detectDnaLoadHints(opts = {}) {
  const req = String(opts.request || '');
  const industryHint = String(opts.industry || '').toLowerCase();
  let industry = 'local service';
  if (/pressure\s*wash/.test(industryHint) || /pressure\s*wash/.test(req)) industry = 'pressure washing';
  else if (/pool\s*clean/.test(industryHint) || /pool\s*clean/.test(req)) industry = 'pool cleaning';
  else if (industryHint) industry = industryHint;
  for (const key of INDUSTRY_PACKS.keys()) {
    if (industryHint.includes(key) || req.toLowerCase().includes(key) || industry === key) {
      industry = key;
      break;
    }
  }
  let city = opts.city || null;
  let state = opts.state || null;
  if (/salt lake city/i.test(req)) {
    city = 'Salt Lake City';
    state = state || 'UT';
  }
  return { industry, city, state, country: opts.country || 'US' };
}

export function loadBusinessDnaKnowledge(opts = {}) {
  const hints = detectDnaLoadHints(opts);
  const registered = getDnaIndustryPack(hints.industry);
  if (registered) {
    return {
      ...registered,
      loadedAt: new Date().toISOString(),
      loadedBy: DNA_KNOWLEDGE_OWNER,
      regionalIntelligence: {
        ...registered.regionalIntelligence,
        city: hints.city ?? registered.regionalIntelligence.city,
        state: hints.state ?? registered.regionalIntelligence.state,
        country: hints.country ?? registered.regionalIntelligence.country,
      },
    };
  }
  if (hints.industry === 'pressure washing') {
    return buildPressureWashingPack({
      city: hints.city,
      state: hints.state,
      country: hints.country,
    });
  }
  // Generic structured pack for unknown industries (registered packs handled above).
  return {
    schemaVersion: HUBLY_DNA_KNOWLEDGE_VERSION,
    knowledgeVersion: 1,
    loadedAt: new Date().toISOString(),
    loadedBy: DNA_KNOWLEDGE_OWNER,
    industryProfile: {
      industryName: hints.industry,
      businessCategories: ['local service'],
      typicalBusinessStages: ['starting', 'growing'],
      commonBusinessModels: ['mobile / on-site'],
      serviceDeliveryMethods: ['on-site'],
    },
    customerPsychology: {
      buyingTriggers: ['need + trust'],
      buyingFears: ['wasted money'],
      trustBuilders: ['reviews'],
      decisionSpeed: 'moderate',
      priceSensitivity: 'moderate',
      emotionalMotivations: ['relief'],
      commonObjections: ['price'],
    },
    trustSignals: { signals: ['Reviews'], rankedByImportance: ['Reviews'] },
    serviceRelationships: {
      primaryServices: [],
      upsells: [],
      crossSells: [],
      seasonalServices: [],
      serviceBundles: [],
      membershipOpportunities: [],
    },
    pricingIntelligence: {
      typicalPricingModels: ['packages'],
      customerExpectations: ['clarity'],
      premiumPositioningOpportunities: [],
      valuePositioning: ['proof first'],
      discountRisks: [],
    },
    websiteIntelligence: {
      recommendedHomepageOrder: ['Hero', 'Offers', 'Trust', 'Book'],
      highConvertingLayouts: ['proof-led'],
      bookingBestPractices: ['one CTA'],
      galleryRecommendations: [],
      ctaStrategy: ['single primary CTA'],
      contentPriorities: ['clarity'],
    },
    growthIntelligence: {
      growthOpportunities: [],
      referralIdeas: [],
      membershipIdeas: [],
      reviewStrategies: [],
      customerRetentionIdeas: [],
      expansionOpportunities: [],
    },
    seasonality: {
      busySeasons: [],
      slowSeasons: [],
      weatherImpact: [],
      holidayOpportunities: [],
      regionalSeasonality: [],
    },
    regionalIntelligence: {
      country: hints.country,
      state: hints.state,
      city: hints.city,
      climate: null,
      regionalBuyingBehavior: [],
      localTerminology: [],
    },
    communityLearning: {
      enabled: false,
      automaticLearning: false,
      version: 0,
      evidence: [],
      confidence: 0,
      source: 'generic',
      communityLearnings: [],
      validationHistory: [],
    },
    evidence: [],
  };
}

export function attachDnaKnowledgePack(dna, pack) {
  const base = dna && typeof dna === 'object' ? { ...dna } : {};
  return {
    version: 2,
    ...base,
    knowledgePack: pack,
    knowledge: {
      customerPsychology: pack.customerPsychology.buyingTriggers.join('; '),
      buyingBehavior: pack.customerPsychology.decisionSpeed,
      trustSignals: pack.trustSignals.rankedByImportance,
      seasonality: [...pack.seasonality.busySeasons, ...pack.seasonality.regionalSeasonality].join('; '),
      pricingNorms: pack.pricingIntelligence.typicalPricingModels.join('; '),
      commonObjections: pack.customerPsychology.commonObjections,
      highConvertingLayouts: pack.websiteIntelligence.highConvertingLayouts,
      upsells: pack.serviceRelationships.upsells,
      crossSells: pack.serviceRelationships.crossSells,
      industryVocabulary: pack.regionalIntelligence.localTerminology,
      homepageGoals: pack.websiteIntelligence.recommendedHomepageOrder,
      decisionFactors: pack.customerPsychology.trustBuilders,
    },
    source: 'blueprint',
    updatedAt: new Date().toISOString(),
  };
}

/** Simulate Research + Strategy reading DNA (experts never write). */
export function expertsReadDnaKnowledge(pack, request) {
  const evidenceUsed = pack.evidence.slice(0, 8).map((e) => ({
    id: e.id,
    claim: e.claim,
    category: e.category,
    source: e.source,
    confidence: e.confidence,
    lastReviewed: e.lastReviewed,
    appliesTo: e.appliesTo,
  }));

  const research = {
    expertId: 'research',
    expertName: 'Research Expert',
    dnaUsed: true,
    readOnly: true,
    customerPsychology: pack.customerPsychology,
    trustSignals: pack.trustSignals.rankedByImportance,
    pricingGuidance: pack.pricingIntelligence,
    homepageRecommendations: pack.websiteIntelligence.recommendedHomepageOrder,
    bookingRecommendations: pack.websiteIntelligence.bookingBestPractices,
    seasonalOpportunities: [
      ...pack.seasonality.busySeasons,
      ...pack.seasonality.holidayOpportunities,
      ...pack.seasonality.regionalSeasonality,
    ],
    regional: pack.regionalIntelligence,
    evidenceUsed,
    confidence: 90,
    reasoning: [{
      reason: `Used Business DNA knowledge (${pack.industryProfile.industryName} v${pack.knowledgeVersion}) as evidence for: ${request}`,
      evidence: evidenceUsed.map((e) => e.claim).slice(0, 4),
      confidence: 90,
    }],
  };

  const strategy = {
    expertId: 'strategy',
    expertName: 'Strategy Expert',
    dnaUsed: true,
    readOnly: true,
    pricingDirection: `Pricing from Business DNA: ${pack.pricingIntelligence.typicalPricingModels.join('; ')}`,
    homepageStrategy: `Homepage order from Business DNA: ${pack.websiteIntelligence.recommendedHomepageOrder.join(' → ')}`,
    bookingStrategy: pack.websiteIntelligence.bookingBestPractices[0],
    seasonalOpportunities: [...pack.seasonality.busySeasons, ...pack.seasonality.regionalSeasonality],
    evidenceUsed: evidenceUsed.filter((e) => ['website', 'pricing', 'seasonality', 'regional'].includes(e.category)),
    confidence: 88,
    reasoning: [{
      reason: 'Strategy used Business DNA website/pricing/seasonality evidence (read-only).',
      evidence: pack.websiteIntelligence.recommendedHomepageOrder,
      confidence: 88,
    }],
  };

  return { research, strategy };
}
