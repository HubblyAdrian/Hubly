/**
 * Hubly Brain — Reasoning Engine (Milestone 1 · Section 8)
 *
 * Answers: "Why did Hubly make this decision?"
 *
 * Every recommendation becomes a structured Reasoning Object with evidence,
 * confidence, expected outcome, experts, versions, and Decision Graph links.
 *
 * Hubly never acts like a black box. "Why?" answers come from stored reasoning —
 * not regenerated explanations.
 *
 * Decision Graph: each decision may reference earlier decisions that influenced it
 * (goal → strategy → homepage → booking → growth).
 */

export const REASONING_ENGINE_VERSION = "1.0.0" as const;
export const REASONING_OWNER = "hubly_brain" as const;

export type HublyEvidenceSourceKind =
  | "business_dna"
  | "business_memory"
  | "workspace_memory"
  | "conversation_memory"
  | "research_expert"
  | "strategy_expert"
  | "creative_director"
  | "critic"
  | "experience_director"
  | "external_research"
  | "system";

export type HublyEvidenceSource = {
  kind: HublyEvidenceSourceKind;
  ref?: string | null;
  detail?: string | null;
};

export type HublyExpectedOutcome =
  | "more_bookings"
  | "higher_trust"
  | "better_seo"
  | "simpler_booking"
  | "more_repeat_customers"
  | "higher_conversion"
  | "clearer_positioning"
  | "simpler_experience"
  | string;

/**
 * Canonical Reasoning Object — every AI recommendation creates one.
 */
export type HublyReasoningObject = {
  reasoningId: string;
  /** Decision key / slug for retrieval (e.g. homepage_strategy). */
  decisionKey: string;
  /** What Hubly recommends (human-readable). */
  decision: string;
  /** Why — explanation for the owner. */
  explanation: string;
  /** Facts that influenced the recommendation. */
  evidence: string[];
  evidenceSources: HublyEvidenceSource[];
  confidence: number;
  expectedOutcome: HublyExpectedOutcome;
  expertsInvolved: string[];
  timestamp: string;
  /** Version of this decision lineage (increments when recommendation changes). */
  version: number;
  businessVersion?: number | null;
  workspaceVersion?: number | null;
  dnaVersion?: number | string | null;
  /** Decision Graph — earlier reasoning that influenced this one. */
  influencedBy: string[];
  /** Decision Graph — later reasoning influenced by this one. */
  influences: string[];
  /** Reuse: another reasoningId this explanation references. */
  reusesReasoningId?: string | null;
  domain?: string | null;
  businessId?: string | null;
};

/** @deprecated alias — keep for existing callers */
export type HublyDecisionRecord = {
  id: string;
  at: string;
  domain: string;
  decision: string;
  reason: string;
  evidence: string[];
  confidence: number;
  expectedImpact?: string | null;
  expertId?: string | null;
  source?: string | null;
  reasoningId?: string | null;
};

export type HublyReasoningStoreSnapshot = {
  byId: Record<string, HublyReasoningObject>;
  byKey: Record<string, string[]>;
  graphEdges: Array<{ from: string; to: string; relation: "influences" }>;
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampConfidence(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** In-process store — Brain owns commits; experts suggest via makeReasoning. */
const STORE = new Map<string, HublyReasoningObject>();
const KEY_INDEX = new Map<string, string[]>();
const GRAPH: Array<{ from: string; to: string; relation: "influences" }> = [];
const BIZ_INDEX = new Map<string, string[]>();

function indexKey(key: string, id: string): void {
  const list = KEY_INDEX.get(key) || [];
  if (!list.includes(id)) list.push(id);
  KEY_INDEX.set(key, list);
}

function indexBiz(businessId: string | null | undefined, id: string): void {
  if (!businessId) return;
  const list = BIZ_INDEX.get(businessId) || [];
  if (!list.includes(id)) list.push(id);
  BIZ_INDEX.set(businessId, list);
}

function linkGraph(parentId: string | null | undefined, childId: string): void {
  if (!parentId || !STORE.has(parentId)) return;
  const parent = STORE.get(parentId)!;
  const child = STORE.get(childId)!;
  if (!parent.influences.includes(childId)) parent.influences.push(childId);
  if (!child.influencedBy.includes(parentId)) child.influencedBy.push(parentId);
  GRAPH.push({ from: parentId, to: childId, relation: "influences" });
  STORE.set(parentId, parent);
  STORE.set(childId, child);
}

export type MakeReasoningOpts = {
  decisionKey: string;
  decision: string;
  explanation: string;
  evidence?: string[];
  evidenceSources?: HublyEvidenceSource[];
  confidence: number;
  expectedOutcome: HublyExpectedOutcome;
  expertsInvolved?: string[];
  expertId?: string | null;
  domain?: string | null;
  businessVersion?: number | null;
  workspaceVersion?: number | null;
  dnaVersion?: number | string | null;
  /** Decision Graph parents */
  influencedBy?: string[];
  /** Reuse an earlier reasoning explanation */
  reusesReasoningId?: string | null;
  businessId?: string | null;
  at?: string;
};

/**
 * Create (and store) a Reasoning Object.
 * If the same decisionKey already exists with a different decision, version increments
 * and both records remain available.
 */
export function makeReasoning(opts: MakeReasoningOpts): HublyReasoningObject {
  const key = String(opts.decisionKey || "general").trim();
  const priorIds = KEY_INDEX.get(key) || [];
  const prior = priorIds.length ? STORE.get(priorIds[priorIds.length - 1]) : null;
  const sameDecision = prior && prior.decision === opts.decision;
  const version = prior ? (sameDecision ? prior.version : prior.version + 1) : 1;

  let explanation = opts.explanation;
  let reusesReasoningId = opts.reusesReasoningId || null;
  if (reusesReasoningId && STORE.has(reusesReasoningId)) {
    const reused = STORE.get(reusesReasoningId)!;
    // Experts reuse prior reasoning — don't invent a conflicting explanation
    if (!explanation || explanation.length < 20) {
      explanation = reused.explanation;
    } else if (!explanation.includes(reused.explanation.slice(0, 40))) {
      explanation = `${explanation} (Building on earlier reasoning: ${reused.explanation})`;
    }
  }

  const experts = [
    ...(opts.expertsInvolved || []),
    ...(opts.expertId ? [opts.expertId] : []),
  ].filter(Boolean);
  const uniqueExperts = [...new Set(experts.map(String))];

  const obj: HublyReasoningObject = {
    reasoningId: newId("rsn"),
    decisionKey: key,
    decision: opts.decision,
    explanation,
    evidence: [...(opts.evidence || [])],
    evidenceSources: [...(opts.evidenceSources || [])],
    confidence: clampConfidence(opts.confidence),
    expectedOutcome: opts.expectedOutcome,
    expertsInvolved: uniqueExperts,
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

  const parents = [
    ...(opts.influencedBy || []),
    ...(reusesReasoningId ? [reusesReasoningId] : []),
  ];
  for (const p of parents) linkGraph(p, obj.reasoningId);

  return { ...obj, influencedBy: [...obj.influencedBy], influences: [...obj.influences] };
}

/** Compat wrapper used by existing experts / think pipeline. */
export function makeDecision(opts: {
  domain: string;
  decision: string;
  reason: string;
  evidence?: string[];
  confidence: number;
  expectedImpact?: string | null;
  expertId?: string | null;
  source?: string | null;
  decisionKey?: string;
  evidenceSources?: HublyEvidenceSource[];
  expectedOutcome?: HublyExpectedOutcome;
  expertsInvolved?: string[];
  influencedBy?: string[];
  reusesReasoningId?: string | null;
  businessVersion?: number | null;
  workspaceVersion?: number | null;
  dnaVersion?: number | string | null;
  businessId?: string | null;
}): HublyDecisionRecord {
  const sourceKind = (opts.source || opts.expertId || "system") as string;
  const evidenceSources: HublyEvidenceSource[] = opts.evidenceSources || [{
    kind: mapSourceKind(sourceKind),
    ref: opts.expertId || null,
    detail: opts.domain,
  }];
  const r = makeReasoning({
    decisionKey: opts.decisionKey || `${opts.domain}_${opts.decision}`.replace(/\W+/g, "_").toLowerCase(),
    decision: opts.decision,
    explanation: opts.reason,
    evidence: opts.evidence,
    evidenceSources,
    confidence: opts.confidence,
    expectedOutcome: opts.expectedOutcome || opts.expectedImpact || "higher_trust",
    expertsInvolved: opts.expertsInvolved,
    expertId: opts.expertId,
    domain: opts.domain,
    influencedBy: opts.influencedBy,
    reusesReasoningId: opts.reusesReasoningId,
    businessVersion: opts.businessVersion,
    workspaceVersion: opts.workspaceVersion,
    dnaVersion: opts.dnaVersion,
    businessId: opts.businessId,
  });
  return {
    id: r.reasoningId,
    at: r.timestamp,
    domain: opts.domain,
    decision: opts.decision,
    reason: opts.reason,
    evidence: r.evidence,
    confidence: r.confidence,
    expectedImpact: opts.expectedImpact ?? r.expectedOutcome,
    expertId: opts.expertId ?? null,
    source: opts.source ?? null,
    reasoningId: r.reasoningId,
  };
}

function mapSourceKind(s: string): HublyEvidenceSourceKind {
  const low = s.toLowerCase();
  if (low.includes("dna") || low === "blueprint") return "business_dna";
  if (low.includes("business_memory") || low === "memory") return "business_memory";
  if (low.includes("workspace")) return "workspace_memory";
  if (low.includes("conversation")) return "conversation_memory";
  if (low.includes("research")) return "research_expert";
  if (low.includes("strategy")) return "strategy_expert";
  if (low.includes("creative")) return "creative_director";
  if (low.includes("critic")) return "critic";
  if (low.includes("experience")) return "experience_director";
  if (low.includes("external")) return "external_research";
  return "system";
}

export function getReasoning(reasoningId: string): HublyReasoningObject | null {
  const r = STORE.get(String(reasoningId));
  return r ? cloneReasoning(r) : null;
}

export function listReasoningForKey(decisionKey: string): HublyReasoningObject[] {
  const ids = KEY_INDEX.get(String(decisionKey)) || [];
  return ids.map((id) => STORE.get(id)!).filter(Boolean).map(cloneReasoning);
}

export function listReasoningHistory(opts?: {
  businessId?: string | null;
  decisionKey?: string | null;
  limit?: number;
}): HublyReasoningObject[] {
  let ids: string[] = [];
  if (opts?.decisionKey) ids = [...(KEY_INDEX.get(String(opts.decisionKey)) || [])];
  else if (opts?.businessId) ids = [...(BIZ_INDEX.get(String(opts.businessId)) || [])];
  else ids = [...STORE.keys()];
  const limit = opts?.limit ?? 50;
  return ids
    .map((id) => STORE.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit)
    .map(cloneReasoning);
}

export function compareReasoningVersions(decisionKey: string): {
  key: string;
  versions: HublyReasoningObject[];
  changed: boolean;
} {
  const versions = listReasoningForKey(decisionKey);
  return {
    key: decisionKey,
    versions,
    changed: versions.length > 1 && versions[0].decision !== versions[versions.length - 1].decision,
  };
}

export function isWhyQuestion(request: string): boolean {
  const r = String(request || "").toLowerCase();
  return /why did we|why did you|why choose|why (this|our|the)|why move|why recommend|what'?s the reason/.test(r);
}

export function detectWhyDecisionKey(request: string): string | null {
  const r = String(request || "").toLowerCase();
  if (/homepage|home page|first screen/.test(r)) return "homepage_strategy";
  if (/booking|book flow|cta/.test(r)) return "booking_strategy";
  if (/pricing|price|package/.test(r)) return "pricing_direction";
  if (/brand|positioning|position/.test(r)) return "brand_positioning";
  if (/trust|review/.test(r)) return "trust_recommendations";
  if (/industry/.test(r)) return "industry_selection";
  if (/luxury|family-owned|branding/.test(r)) return "brand_positioning";
  return null;
}

export type HublyWhyAnswer = {
  fromStoredReasoning: true;
  regenerated: false;
  decisionKey: string | null;
  answer: string;
  reasoning: HublyReasoningObject | null;
  history: HublyReasoningObject[];
  decisionGraph: Array<{ reasoningId: string; decision: string; decisionKey: string }>;
  confidence: number;
};

/**
 * Answer "Why?" from stored Reasoning Objects — never regenerate.
 */
export function answerWhyFromReasoning(
  request: string,
  opts?: { businessId?: string | null },
): HublyWhyAnswer {
  const key = detectWhyDecisionKey(request);
  let history = key
    ? listReasoningForKey(key)
    : listReasoningHistory({ businessId: opts?.businessId, limit: 20 });

  if (!history.length && opts?.businessId) {
    history = listReasoningHistory({ businessId: opts.businessId, limit: 20 });
  }

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
    ? " Here's how it connects: " +
      chain.map((c) => `${c.decisionKey} → ${c.decision}`).join(" → ") + "."
    : "";

  const versionNote = history.length > 1
    ? ` (This is version ${latest.version}; earlier: "${history[0].decision}".)`
    : "";

  const answer =
    `We chose this because: ${latest.explanation}` +
    ` Evidence: ${latest.evidence.slice(0, 3).join("; ") || "stored business context"}.` +
    ` Expected outcome: ${latest.expectedOutcome}.` +
    ` Confidence: ${latest.confidence}.` +
    ` Experts involved: ${latest.expertsInvolved.join(" → ") || "Hubly Brain"}.` +
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

/** Walk influencedBy chain for richer "why" narratives. */
export function buildDecisionChain(reasoningId: string): Array<{
  reasoningId: string;
  decision: string;
  decisionKey: string;
}> {
  const chain: Array<{ reasoningId: string; decision: string; decisionKey: string }> = [];
  const seen = new Set<string>();
  let cur = STORE.get(String(reasoningId));
  // Walk to roots first
  const stack: HublyReasoningObject[] = [];
  while (cur && !seen.has(cur.reasoningId)) {
    seen.add(cur.reasoningId);
    stack.push(cur);
    const parentId = cur.influencedBy[0];
    cur = parentId ? STORE.get(parentId) : undefined;
  }
  stack.reverse();
  for (const r of stack) {
    chain.push({
      reasoningId: r.reasoningId,
      decision: r.decision,
      decisionKey: r.decisionKey,
    });
  }
  // Also include children one level for forward context
  const tip = STORE.get(String(reasoningId));
  if (tip) {
    for (const childId of tip.influences.slice(0, 3)) {
      const child = STORE.get(childId);
      if (child && !seen.has(child.reasoningId)) {
        chain.push({
          reasoningId: child.reasoningId,
          decision: child.decision,
          decisionKey: child.decisionKey,
        });
      }
    }
  }
  return chain;
}

export function formatDecisionForOwner(d: HublyDecisionRecord): string {
  const impact = d.expectedImpact ? ` Expected impact: ${d.expectedImpact}` : "";
  return `${d.reason}${impact}`.trim();
}

export function formatReasoningForOwner(r: HublyReasoningObject): string {
  return `I recommend ${r.decision} because ${r.explanation} Expected outcome: ${r.expectedOutcome}.`;
}

function cloneReasoning(r: HublyReasoningObject): HublyReasoningObject {
  return {
    ...r,
    evidence: [...r.evidence],
    evidenceSources: r.evidenceSources.map((e) => ({ ...e })),
    expertsInvolved: [...r.expertsInvolved],
    influencedBy: [...r.influencedBy],
    influences: [...r.influences],
  };
}

export function exportReasoningStore(): HublyReasoningStoreSnapshot {
  const byId: Record<string, HublyReasoningObject> = {};
  for (const [id, r] of STORE) byId[id] = cloneReasoning(r);
  const byKey: Record<string, string[]> = {};
  for (const [k, ids] of KEY_INDEX) byKey[k] = [...ids];
  return { byId, byKey, graphEdges: GRAPH.map((e) => ({ ...e })) };
}

export function clearReasoningStoreForTests(): void {
  STORE.clear();
  KEY_INDEX.clear();
  GRAPH.length = 0;
  BIZ_INDEX.clear();
}

/**
 * Record a standard build-business reasoning chain for Section 8 demos.
 * Creates Decision Graph: industry → brand → homepage → booking → pricing → trust.
 */
export function recordBuildBusinessReasoningChain(opts: {
  request: string;
  businessId?: string | null;
  businessVersion?: number | null;
  workspaceVersion?: number | null;
  dnaVersion?: number | string | null;
  industry?: string | null;
  experts?: string[];
}): HublyReasoningObject[] {
  const biz = opts.businessId || null;
  const industry = opts.industry || "pressure washing";
  const experts = opts.experts || ["research", "strategy", "creative_director", "critic"];
  const versions = {
    businessVersion: opts.businessVersion ?? null,
    workspaceVersion: opts.workspaceVersion ?? null,
    dnaVersion: opts.dnaVersion ?? null,
    businessId: biz,
  };

  const industryR = makeReasoning({
    decisionKey: "industry_selection",
    decision: `Focus on ${industry}`,
    explanation: `You said you're starting a ${industry} business, so industry selection follows your description.`,
    evidence: [opts.request, `industry=${industry}`],
    evidenceSources: [
      { kind: "business_memory", detail: "owner request" },
      { kind: "research_expert", detail: "industry research" },
    ],
    confidence: 95,
    expectedOutcome: "clearer_positioning",
    expertsInvolved: ["research", "hubly_brain"],
    domain: "industry",
    ...versions,
  });

  const brandR = makeReasoning({
    decisionKey: "brand_positioning",
    decision: `${industry} that earns trust with before/after proof before asking for a booking`,
    explanation:
      "Homeowners hiring pressure washing services usually look for proof before comparing price. Positioning around visible trust beats generic price competition.",
    evidence: [
      "Business DNA: before/after photos are a top trust signal",
      "Research: buyers fear damage and no-shows",
    ],
    evidenceSources: [
      { kind: "business_dna", ref: "pw_trust_before_after" },
      { kind: "research_expert" },
      { kind: "strategy_expert" },
    ],
    confidence: 88,
    expectedOutcome: "higher_trust",
    expertsInvolved: ["research", "strategy"],
    influencedBy: [industryR.reasoningId],
    domain: "brand",
    ...versions,
  });

  const homepageR = makeReasoning({
    decisionKey: "homepage_strategy",
    decision: "Lead with proof, then packages, then a single Book CTA",
    explanation:
      "I recommend this homepage order because homeowners hiring pressure washing services usually look for proof before comparing price. Based on your Business DNA, putting reviews/proof above pricing should improve trust.",
    evidence: [
      "Business DNA homepage order: Hero with before/after → Packages → Trust proof → Book",
      brandR.decision,
    ],
    evidenceSources: [
      { kind: "business_dna", ref: "pw_web_homepage" },
      { kind: "strategy_expert" },
      { kind: "creative_director" },
    ],
    confidence: 90,
    expectedOutcome: "higher_conversion",
    expertsInvolved: ["strategy", "creative_director", "critic"],
    influencedBy: [brandR.reasoningId],
    reusesReasoningId: brandR.reasoningId,
    domain: "website",
    ...versions,
  });

  const bookingR = makeReasoning({
    decisionKey: "booking_strategy",
    decision: "One primary Book / Get quote CTA — avoid multi-step quizzes",
    explanation:
      "A single booking path reduces friction once trust is established on the homepage. Property managers and homeowners both convert better with one clear next step.",
    evidence: ["Business DNA booking best practices", homepageR.decision],
    evidenceSources: [
      { kind: "business_dna", ref: "pw_web_booking" },
      { kind: "strategy_expert" },
    ],
    confidence: 89,
    expectedOutcome: "simpler_booking",
    expertsInvolved: ["strategy", "creative_director"],
    influencedBy: [homepageR.reasoningId],
    domain: "booking",
    ...versions,
  });

  const pricingR = makeReasoning({
    decisionKey: "pricing_direction",
    decision: "Package tiers (driveway / house / full property) with a clear mid package",
    explanation:
      "Clear package tiers outperform open-ended hourly quotes for first-time pressure washing buyers and support the proof-led homepage.",
    evidence: ["Business DNA pricing models", "Customer expectation of clear mid package"],
    evidenceSources: [
      { kind: "business_dna", ref: "pw_price_packages" },
      { kind: "strategy_expert" },
    ],
    confidence: 88,
    expectedOutcome: "more_bookings",
    expertsInvolved: ["strategy", "research"],
    influencedBy: [brandR.reasoningId, homepageR.reasoningId],
    domain: "pricing",
    ...versions,
  });

  const trustR = makeReasoning({
    decisionKey: "trust_recommendations",
    decision: "Lead with before/after photos and insured language above pricing",
    explanation:
      "Before & after photos are a top trust signal for pressure washing. Showing proof before price reduces damage fears and no-show anxiety.",
    evidence: [
      "Business DNA trust ranking: Before & after photos first",
      "Insured & licensed language",
    ],
    evidenceSources: [
      { kind: "business_dna", ref: "pw_trust_before_after" },
      { kind: "research_expert" },
      { kind: "critic" },
    ],
    confidence: 94,
    expectedOutcome: "higher_trust",
    expertsInvolved: experts,
    influencedBy: [brandR.reasoningId, homepageR.reasoningId],
    reusesReasoningId: brandR.reasoningId,
    domain: "trust",
    ...versions,
  });

  return [industryR, brandR, homepageR, bookingR, pricingR, trustR].map((r) =>
    getReasoning(r.reasoningId)!
  );
}

export const HublyReasoning = {
  version: REASONING_ENGINE_VERSION,
  owner: REASONING_OWNER,
  make: makeDecision,
  makeReasoning,
  get: getReasoning,
  listForKey: listReasoningForKey,
  history: listReasoningHistory,
  compareVersions: compareReasoningVersions,
  answerWhy: answerWhyFromReasoning,
  isWhyQuestion,
  detectWhyDecisionKey,
  buildChain: buildDecisionChain,
  formatForOwner: formatDecisionForOwner,
  formatReasoningForOwner,
  recordBuildChain: recordBuildBusinessReasoningChain,
  exportStore: exportReasoningStore,
  clearForTests: clearReasoningStoreForTests,
};

export default HublyReasoning;
