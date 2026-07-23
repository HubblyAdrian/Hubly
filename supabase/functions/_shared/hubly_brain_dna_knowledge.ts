/**
 * Hubly Brain — Business DNA Knowledge Engine (Milestone 1 · Section 7)
 *
 * Business DNA is structured knowledge that teaches Hubly how businesses operate.
 * Not a prompt. Not a template. Not a JSON config for UI.
 *
 * Evidence quality (every claim):
 *   source · confidence · lastReviewed · appliesTo (industry / region / stage)
 *
 * Community learning model exists for the future — automatic learning is NOT implemented.
 *
 * Rules:
 * - Experts READ DNA knowledge.
 * - Experts never modify DNA.
 * - Hubly Brain loads / versions DNA knowledge.
 */

export const HUBLY_DNA_KNOWLEDGE_VERSION = "1.0.0" as const;
export const DNA_KNOWLEDGE_OWNER = "hubly_brain" as const;

export type DnaEvidenceCategory =
  | "industry"
  | "customer_psychology"
  | "trust_signals"
  | "pricing"
  | "services"
  | "website"
  | "growth"
  | "seasonality"
  | "regional";

export type HublyDnaAppliesTo = {
  industry: string[];
  region: "global" | { country?: string; state?: string; city?: string };
  businessStage: string[];
};

/** Every piece of Business DNA knowledge carries evidence quality. */
export type HublyDnaEvidence = {
  id: string;
  claim: string;
  category: DnaEvidenceCategory;
  source: string;
  /** 0–1 confidence in this knowledge claim */
  confidence: number;
  lastReviewed: string;
  appliesTo: HublyDnaAppliesTo;
};

export type HublyDnaIndustryProfile = {
  industryName: string;
  businessCategories: string[];
  typicalBusinessStages: string[];
  commonBusinessModels: string[];
  serviceDeliveryMethods: string[];
};

export type HublyDnaCustomerPsychology = {
  buyingTriggers: string[];
  buyingFears: string[];
  trustBuilders: string[];
  decisionSpeed: string;
  priceSensitivity: string;
  emotionalMotivations: string[];
  commonObjections: string[];
};

export type HublyDnaTrustSignals = {
  signals: string[];
  /** Ordered by industry importance (highest first). */
  rankedByImportance: string[];
};

export type HublyDnaServiceRelationships = {
  primaryServices: string[];
  upsells: string[];
  crossSells: string[];
  seasonalServices: string[];
  serviceBundles: string[];
  membershipOpportunities: string[];
};

export type HublyDnaPricingIntelligence = {
  typicalPricingModels: string[];
  customerExpectations: string[];
  premiumPositioningOpportunities: string[];
  valuePositioning: string[];
  discountRisks: string[];
};

export type HublyDnaWebsiteIntelligence = {
  recommendedHomepageOrder: string[];
  highConvertingLayouts: string[];
  bookingBestPractices: string[];
  galleryRecommendations: string[];
  ctaStrategy: string[];
  contentPriorities: string[];
};

export type HublyDnaGrowthIntelligence = {
  growthOpportunities: string[];
  referralIdeas: string[];
  membershipIdeas: string[];
  reviewStrategies: string[];
  customerRetentionIdeas: string[];
  expansionOpportunities: string[];
};

export type HublyDnaSeasonality = {
  busySeasons: string[];
  slowSeasons: string[];
  weatherImpact: string[];
  holidayOpportunities: string[];
  regionalSeasonality: string[];
};

export type HublyDnaRegionalIntelligence = {
  country: string | null;
  state: string | null;
  city: string | null;
  climate: string | null;
  regionalBuyingBehavior: string[];
  localTerminology: string[];
};

/** Placeholder for future community learning — no automatic learning yet. */
export type HublyDnaCommunityLearning = {
  enabled: false;
  automaticLearning: false;
  version: number;
  evidence: HublyDnaEvidence[];
  confidence: number;
  source: string;
  communityLearnings: Array<{
    id: string;
    claim: string;
    status: "placeholder";
  }>;
  validationHistory: Array<{
    at: string;
    action: string;
    note: string;
  }>;
};

export type HublyDnaKnowledgePack = {
  schemaVersion: typeof HUBLY_DNA_KNOWLEDGE_VERSION;
  /** Content version for this loaded pack */
  knowledgeVersion: number;
  loadedAt: string;
  loadedBy: typeof DNA_KNOWLEDGE_OWNER;
  industryProfile: HublyDnaIndustryProfile;
  customerPsychology: HublyDnaCustomerPsychology;
  trustSignals: HublyDnaTrustSignals;
  serviceRelationships: HublyDnaServiceRelationships;
  pricingIntelligence: HublyDnaPricingIntelligence;
  websiteIntelligence: HublyDnaWebsiteIntelligence;
  growthIntelligence: HublyDnaGrowthIntelligence;
  seasonality: HublyDnaSeasonality;
  regionalIntelligence: HublyDnaRegionalIntelligence;
  communityLearning: HublyDnaCommunityLearning;
  /** Flat evidence index — every claim with quality metadata */
  evidence: HublyDnaEvidence[];
};

function evidence(
  partial: Omit<HublyDnaEvidence, "appliesTo"> & { appliesTo?: Partial<HublyDnaAppliesTo> },
): HublyDnaEvidence {
  return {
    id: partial.id,
    claim: partial.claim,
    category: partial.category,
    source: partial.source,
    confidence: partial.confidence,
    lastReviewed: partial.lastReviewed,
    appliesTo: {
      industry: partial.appliesTo?.industry || ["pressure washing"],
      region: partial.appliesTo?.region || "global",
      businessStage: partial.appliesTo?.businessStage || ["starting", "growing", "established"],
    },
  };
}

const REVIEWED = "2026-07-23";

/** Built-in pressure washing knowledge — Internal blueprint (not auto-learned). */
function pressureWashingEvidence(region?: { city?: string | null; state?: string | null }): HublyDnaEvidence[] {
  const base: HublyDnaEvidence[] = [
    evidence({
      id: "pw_psych_curb",
      claim: "Homeowners hire pressure washing for curb appeal before selling, parties, or spring refresh — they fear damage and no-shows more than price alone.",
      category: "customer_psychology",
      source: "Internal blueprint",
      confidence: 0.94,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_trust_before_after",
      claim: "Before & after photos are a top trust signal for pressure washing companies.",
      category: "trust_signals",
      source: "Internal blueprint",
      confidence: 0.94,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_trust_insured",
      claim: "Insured & licensed language reduces damage fears for pressure washing buyers.",
      category: "trust_signals",
      source: "Internal blueprint",
      confidence: 0.91,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_price_packages",
      claim: "Clear package tiers (driveway / house / full property) outperform open-ended hourly quotes for first-time buyers.",
      category: "pricing",
      source: "Internal blueprint",
      confidence: 0.88,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_price_discount_risk",
      claim: "Heavy discounting trains pressure washing buyers to wait for deals and erodes trust in quality.",
      category: "pricing",
      source: "Internal blueprint",
      confidence: 0.86,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_web_homepage",
      claim: "High-converting pressure washing homepages lead with proof, then packages, then a single booking CTA.",
      category: "website",
      source: "Internal blueprint",
      confidence: 0.9,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_web_booking",
      claim: "One primary Book / Get quote CTA beats multi-step preference quizzes for local service booking.",
      category: "website",
      source: "Internal blueprint",
      confidence: 0.89,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_season_spring",
      claim: "Pressure washing demand peaks spring through early fall; wet weeks shift scheduling.",
      category: "seasonality",
      source: "Internal blueprint",
      confidence: 0.92,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_services_bundle",
      claim: "Driveway + house wash bundles and soft-wash upsells naturally belong together.",
      category: "services",
      source: "Internal blueprint",
      confidence: 0.87,
      lastReviewed: REVIEWED,
    }),
    evidence({
      id: "pw_growth_reviews",
      claim: "Asking for a review after a strong before/after job is a primary growth lever for new pressure washing businesses.",
      category: "growth",
      source: "Internal blueprint",
      confidence: 0.85,
      lastReviewed: REVIEWED,
    }),
  ];

  if (region?.city && /salt lake/i.test(region.city)) {
    base.push(evidence({
      id: "pw_slc_climate",
      claim: "Salt Lake City pressure washing is seasonal around freeze/thaw and spring pollen — winter outdoor washing is limited.",
      category: "regional",
      source: "Internal blueprint",
      confidence: 0.9,
      lastReviewed: REVIEWED,
      appliesTo: {
        industry: ["pressure washing"],
        region: { country: "US", state: "UT", city: "Salt Lake City" },
        businessStage: ["starting", "growing", "established"],
      },
    }));
    base.push(evidence({
      id: "pw_slc_buy",
      claim: "Salt Lake City homeowners respond to clear scheduling around weather windows and mountain-valley dust cleanup messaging.",
      category: "regional",
      source: "Internal blueprint",
      confidence: 0.84,
      lastReviewed: REVIEWED,
      appliesTo: {
        industry: ["pressure washing"],
        region: { country: "US", state: "UT", city: "Salt Lake City" },
        businessStage: ["starting", "growing"],
      },
    }));
  }

  return base;
}

function buildPressureWashingPack(opts: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): HublyDnaKnowledgePack {
  const city = opts.city || null;
  const state = opts.state || (/salt lake/i.test(city || "") ? "UT" : null);
  const country = opts.country || "US";
  const evidenceList = pressureWashingEvidence({ city, state });

  return {
    schemaVersion: HUBLY_DNA_KNOWLEDGE_VERSION,
    knowledgeVersion: 1,
    loadedAt: new Date().toISOString(),
    loadedBy: DNA_KNOWLEDGE_OWNER,
    industryProfile: {
      industryName: "pressure washing",
      businessCategories: ["exterior cleaning", "property maintenance", "local service"],
      typicalBusinessStages: ["starting", "solo operator", "crew-based", "commercial routes"],
      commonBusinessModels: ["mobile service", "residential routes", "commercial contracts"],
      serviceDeliveryMethods: ["on-site mobile", "soft wash", "surface cleaning"],
    },
    customerPsychology: {
      buyingTriggers: ["curb appeal before sale", "spring cleanup", "events/parties", "hard-water stains"],
      buyingFears: ["damage to paint/siding", "no-shows", "upsell pressure", "unclear pricing"],
      trustBuilders: ["before/after photos", "insured language", "clear packages", "same-week availability"],
      decisionSpeed: "fast when proof is visible — often 2–3 quotes compared",
      priceSensitivity: "moderate — quality/trust beats cheapest once fear of damage is addressed",
      emotionalMotivations: ["pride of home", "relief from hassle", "confidence neighbors will notice"],
      commonObjections: [
        "Will it damage paint/siding?",
        "Are you insured?",
        "Can you do driveways and roofs?",
        "Why not hire the cheaper neighbor?",
      ],
    },
    trustSignals: {
      signals: [
        "Before & after photos",
        "Insured & licensed",
        "Years in business / reviews",
        "Guarantees",
        "Clear package pricing",
        "Certifications",
      ],
      rankedByImportance: [
        "Before & after photos",
        "Insured & licensed",
        "Clear package pricing",
        "Reviews",
        "Guarantees",
        "Years in business",
      ],
    },
    serviceRelationships: {
      primaryServices: ["driveway wash", "house wash", "sidewalk / patio clean"],
      upsells: ["soft wash", "gutter brightening", "fleet wash"],
      crossSells: ["window rinse", "deck clean"],
      seasonalServices: ["spring package", "pre-sale curb appeal"],
      serviceBundles: ["driveway + house", "full property"],
      membershipOpportunities: ["quarterly wash club", "HOA route contract"],
    },
    pricingIntelligence: {
      typicalPricingModels: ["package tiers", "per-surface", "quote after photos"],
      customerExpectations: ["clear mid package", "written scope", "no surprise fees"],
      premiumPositioningOpportunities: ["soft wash expertise", "insured commercial routes", "photo proof gallery"],
      valuePositioning: ["proof first", "bundle savings", "reliable scheduling"],
      discountRisks: ["race-to-bottom quotes", "holiday deep discounts that train delay"],
    },
    websiteIntelligence: {
      recommendedHomepageOrder: ["Hero with before/after", "Packages", "Trust proof", "Book"],
      highConvertingLayouts: ["proof-led", "three package cards", "single CTA"],
      bookingBestPractices: ["one Book / Get quote CTA", "photo upload optional", "same-week slots highlighted"],
      galleryRecommendations: ["real before/after pairs", "local properties", "avoid stock-only"],
      ctaStrategy: ["Book now as only hard ask on first screen"],
      contentPriorities: ["damage myths", "insurance", "package clarity", "seasonal tips"],
    },
    growthIntelligence: {
      growthOpportunities: ["commercial property routes", "realtor partnerships", "HOA contracts"],
      referralIdeas: ["neighbor referral after curb-appeal job", "realtor thank-you cards"],
      membershipIdeas: ["quarterly wash membership"],
      reviewStrategies: ["ask after strong before/after delivery", "photo in review request"],
      customerRetentionIdeas: ["seasonal reminder texts", "annual spring package"],
      expansionOpportunities: ["window cleaning add-on", "fleet contracts"],
    },
    seasonality: {
      busySeasons: ["spring", "early summer", "early fall"],
      slowSeasons: ["deep winter"],
      weatherImpact: ["wet weeks delay outdoor washing", "freeze/thaw limits winter work"],
      holidayOpportunities: ["pre-holiday curb appeal", "spring open-house prep"],
      regionalSeasonality: city && /salt lake/i.test(city)
        ? ["SLC: strong spring pollen/dust cleanup window", "limited outdoor washing in freeze months"]
        : ["Adjust to local climate"],
    },
    regionalIntelligence: {
      country,
      state,
      city,
      climate: city && /salt lake/i.test(city)
        ? "Semi-arid mountain valley — dusty springs, cold winters"
        : null,
      regionalBuyingBehavior: city && /salt lake/i.test(city)
        ? [
          "Schedule around weather windows",
          "Mountain-valley dust cleanup messaging resonates",
          "Homeowners compare a few local quotes quickly",
        ]
        : ["Local homeowners compare 2–3 quotes"],
      localTerminology: city && /salt lake/i.test(city)
        ? ["soft wash", "driveway wash", "house wash", "curb appeal", "valley dust"]
        : ["soft wash", "driveway wash", "house wash", "curb appeal"],
    },
    communityLearning: {
      enabled: false,
      automaticLearning: false,
      version: 0,
      evidence: [],
      confidence: 0,
      source: "placeholder — community learning not implemented",
      communityLearnings: [],
      validationHistory: [{
        at: REVIEWED,
        action: "model_created",
        note: "Community learning data model reserved; automatic learning not implemented in Section 7.",
      }],
    },
    evidence: evidenceList,
  };
}

export type LoadDnaKnowledgeOpts = {
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  request?: string | null;
};

/** Infer industry + region from owner request / memory hints. */
export function detectDnaLoadHints(opts: LoadDnaKnowledgeOpts): {
  industry: string;
  city: string | null;
  state: string | null;
  country: string | null;
} {
  const req = String(opts.request || "");
  const industryHint = String(opts.industry || "").toLowerCase();
  let industry = "local service";
  if (/pressure\s*wash/.test(industryHint) || /pressure\s*wash/.test(req)) {
    industry = "pressure washing";
  } else if (industryHint) {
    industry = industryHint;
  }

  let city = opts.city || null;
  let state = opts.state || null;
  const country = opts.country || "US";
  const slc = req.match(/salt lake city/i);
  if (slc) {
    city = "Salt Lake City";
    state = state || "UT";
  }
  return { industry, city, state, country };
}

/**
 * Hubly Brain loads Business DNA knowledge for experts to read.
 * Experts never call this to mutate knowledge.
 */
export function loadBusinessDnaKnowledge(opts: LoadDnaKnowledgeOpts = {}): HublyDnaKnowledgePack {
  const hints = detectDnaLoadHints(opts);
  if (hints.industry === "pressure washing") {
    return buildPressureWashingPack({
      city: hints.city,
      state: hints.state,
      country: hints.country,
    });
  }
  // Minimal generic pack for other industries (still structured + evidenced)
  const genericEvidence: HublyDnaEvidence[] = [
    evidence({
      id: "generic_trust",
      claim: "Clear proof and simple next steps build trust for local service businesses.",
      category: "trust_signals",
      source: "Internal blueprint",
      confidence: 0.75,
      lastReviewed: REVIEWED,
      appliesTo: {
        industry: [hints.industry],
        region: "global",
        businessStage: ["starting", "growing"],
      },
    }),
  ];
  return {
    schemaVersion: HUBLY_DNA_KNOWLEDGE_VERSION,
    knowledgeVersion: 1,
    loadedAt: new Date().toISOString(),
    loadedBy: DNA_KNOWLEDGE_OWNER,
    industryProfile: {
      industryName: hints.industry,
      businessCategories: ["local service"],
      typicalBusinessStages: ["starting", "growing"],
      commonBusinessModels: ["mobile / on-site"],
      serviceDeliveryMethods: ["on-site"],
    },
    customerPsychology: {
      buyingTriggers: ["need + trust"],
      buyingFears: ["wasted money", "poor quality"],
      trustBuilders: ["reviews", "clear pricing"],
      decisionSpeed: "moderate",
      priceSensitivity: "moderate",
      emotionalMotivations: ["relief", "confidence"],
      commonObjections: ["price", "timing"],
    },
    trustSignals: {
      signals: ["Reviews", "Clear pricing", "Guarantees"],
      rankedByImportance: ["Reviews", "Clear pricing", "Guarantees"],
    },
    serviceRelationships: {
      primaryServices: [],
      upsells: [],
      crossSells: [],
      seasonalServices: [],
      serviceBundles: [],
      membershipOpportunities: [],
    },
    pricingIntelligence: {
      typicalPricingModels: ["packages"],
      customerExpectations: ["clarity"],
      premiumPositioningOpportunities: [],
      valuePositioning: ["proof first"],
      discountRisks: ["race to bottom"],
    },
    websiteIntelligence: {
      recommendedHomepageOrder: ["Hero", "Offers", "Trust", "Book"],
      highConvertingLayouts: ["proof-led"],
      bookingBestPractices: ["one CTA"],
      galleryRecommendations: [],
      ctaStrategy: ["single primary CTA"],
      contentPriorities: ["clarity"],
    },
    growthIntelligence: {
      growthOpportunities: [],
      referralIdeas: [],
      membershipIdeas: [],
      reviewStrategies: ["ask after great jobs"],
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
      source: "placeholder — community learning not implemented",
      communityLearnings: [],
      validationHistory: [{
        at: REVIEWED,
        action: "model_created",
        note: "Community learning data model reserved; automatic learning not implemented.",
      }],
    },
    evidence: genericEvidence,
  };
}

export function evidenceByCategory(
  pack: HublyDnaKnowledgePack,
  category: DnaEvidenceCategory,
): HublyDnaEvidence[] {
  return (pack.evidence || []).filter((e) => e.category === category);
}

export function formatDnaKnowledgeForExperts(pack: HublyDnaKnowledgePack): string {
  return [
    "HUBLY BUSINESS DNA KNOWLEDGE (structured evidence — read only for experts):",
    `industry: ${pack.industryProfile.industryName}`,
    `knowledgeVersion: ${pack.knowledgeVersion}`,
    `psychology: ${pack.customerPsychology.buyingTriggers.join("; ")}`,
    `top trust: ${pack.trustSignals.rankedByImportance.slice(0, 3).join(", ")}`,
    `pricing: ${pack.pricingIntelligence.typicalPricingModels.join(", ")}`,
    `homepage: ${pack.websiteIntelligence.recommendedHomepageOrder.join(" → ")}`,
    `seasonality: ${pack.seasonality.busySeasons.join(", ")}`,
    `region: ${[pack.regionalIntelligence.city, pack.regionalIntelligence.state].filter(Boolean).join(", ") || "global"}`,
    "",
    "EVIDENCE JSON:",
    JSON.stringify(pack.evidence, null, 2),
  ].join("\n");
}

export const HublyDnaKnowledgeApi = {
  version: HUBLY_DNA_KNOWLEDGE_VERSION,
  owner: DNA_KNOWLEDGE_OWNER,
  load: loadBusinessDnaKnowledge,
  detectHints: detectDnaLoadHints,
  byCategory: evidenceByCategory,
  format: formatDnaKnowledgeForExperts,
};
