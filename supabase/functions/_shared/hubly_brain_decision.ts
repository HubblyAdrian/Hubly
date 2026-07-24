/**
 * Hubly Brain — AI Decision & Confidence Engine (Milestone 1 · Section 9)
 *
 * Determines whether Hubly should act, ask, research further, or wait.
 * Confidence is one dimension of a full Decision Score — never the only signal.
 *
 * Decision Matrix:
 *   proceed      — high score, low risk, no approval needed
 *   recommend    — strong recommendation; owner approval required
 *   ask          — information missing
 *   research_more — evidence insufficient
 */

export const DECISION_ENGINE_VERSION = "1.0.0" as const;
export const DECISION_ENGINE_OWNER = "hubly_brain" as const;

export type HublyDecisionAction =
  | "proceed"
  | "recommend"
  | "ask"
  | "research_more";

export type HublyRiskLevel = "low" | "medium" | "high" | "very_high";

export type HublyCustomerImpactKind =
  | "trust"
  | "conversion"
  | "revenue"
  | "retention"
  | "simplicity"
  | "unknown";

/**
 * Canonical Decision Object — every recommendation generates one.
 */
export type HublyDecisionObject = {
  decisionId: string;
  recommendation: string;
  /** Weighted overall 0–100 */
  decisionScore: number;
  confidence: number;
  evidenceQuality: number;
  businessAlignment: number;
  customerImpact: number;
  experienceImpact: number;
  risk: HublyRiskLevel;
  requiresApproval: boolean;
  finalDecision: HublyDecisionAction;
  /** Why this routing / score */
  explanation: string;
  customerImpactKinds: HublyCustomerImpactKind[];
  missingInfo: string[];
  reasoningId?: string | null;
  reasoningKey?: string | null;
  timestamp: string;
  businessId?: string | null;
  request?: string | null;
  dimensions: {
    confidence: number;
    evidenceQuality: number;
    businessAlignment: number;
    customerImpact: number;
    experienceImpact: number;
    riskScore: number;
    risk: HublyRiskLevel;
    requiresApproval: boolean;
  };
};

export type AssessDecisionOpts = {
  recommendation: string;
  request?: string | null;
  /** Expert / reasoning confidence 0–100 */
  confidence?: number | null;
  evidence?: string[] | null;
  evidenceSourceKinds?: string[] | null;
  reasoningExplanation?: string | null;
  reasoningId?: string | null;
  reasoningKey?: string | null;
  expertsInvolved?: string[] | null;
  /** Business context */
  hasBusinessMemory?: boolean;
  hasBusinessDna?: boolean;
  hasStrategy?: boolean;
  industryKnown?: boolean;
  goalsKnown?: boolean;
  missingInfo?: string[] | null;
  /** Expected outcomes from reasoning */
  expectedOutcome?: string | null;
  /** Action characteristics */
  touchesWebsite?: boolean;
  touchesPricing?: boolean;
  touchesBrand?: boolean;
  isDestructive?: boolean;
  autoSafe?: boolean;
  businessId?: string | null;
  at?: string | null;
  /** Force a path for tests / demos */
  forceAction?: HublyDecisionAction | null;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const STORE = new Map<string, HublyDecisionObject>();
const BIZ_INDEX = new Map<string, string[]>();
const KEY_INDEX = new Map<string, string[]>();

function indexBiz(businessId: string | null | undefined, id: string): void {
  if (!businessId) return;
  const list = BIZ_INDEX.get(businessId) || [];
  if (!list.includes(id)) list.push(id);
  BIZ_INDEX.set(businessId, list);
}

function indexKey(key: string, id: string): void {
  const list = KEY_INDEX.get(key) || [];
  if (!list.includes(id)) list.push(id);
  KEY_INDEX.set(key, list);
}

function cloneDecision(d: HublyDecisionObject): HublyDecisionObject {
  return {
    ...d,
    missingInfo: [...d.missingInfo],
    customerImpactKinds: [...d.customerImpactKinds],
    dimensions: { ...d.dimensions },
  };
}

function riskToScore(risk: HublyRiskLevel): number {
  if (risk === "low") return 95;
  if (risk === "medium") return 70;
  if (risk === "high") return 40;
  return 15;
}

function inferRisk(opts: AssessDecisionOpts): HublyRiskLevel {
  if (opts.isDestructive) return "very_high";
  const text = String(opts.request || opts.recommendation || "");
  if (opts.touchesPricing && opts.touchesBrand) return "high";
  if (opts.touchesPricing) return "high";
  if (opts.touchesWebsite && /rewrite|redesign|replace all/i.test(text)) return "medium";
  if (opts.touchesBrand && /luxury|rebrand|positioning/i.test(text)) return "medium";
  // Small layout / trust tweaks (e.g. move reviews) are low risk when marked auto-safe
  if (opts.autoSafe && opts.touchesWebsite && /move |reviews|trust|cta/i.test(text)) return "low";
  if (opts.touchesWebsite || opts.touchesBrand) return "medium";
  return "low";
}

function inferCustomerImpactKinds(expectedOutcome?: string | null): HublyCustomerImpactKind[] {
  const o = String(expectedOutcome || "").toLowerCase();
  const kinds: HublyCustomerImpactKind[] = [];
  if (/trust/.test(o)) kinds.push("trust");
  if (/conversion|book/.test(o)) kinds.push("conversion");
  if (/revenue|price/.test(o)) kinds.push("revenue");
  if (/repeat|retention/.test(o)) kinds.push("retention");
  if (/simpl|seo/.test(o)) kinds.push("simplicity");
  if (!kinds.length) kinds.push("unknown");
  return kinds;
}

function scoreEvidenceQuality(opts: AssessDecisionOpts): number {
  const evidence = opts.evidence || [];
  const kinds = new Set((opts.evidenceSourceKinds || []).map((k) => String(k).toLowerCase()));
  let score = 25;
  score += Math.min(35, evidence.length * 10);
  if (kinds.has("business_dna")) score += 15;
  if (kinds.has("business_memory")) score += 10;
  if (kinds.has("research_expert") || kinds.has("strategy_expert")) score += 10;
  if (kinds.has("external_research")) score += 8;
  if (opts.reasoningExplanation && opts.reasoningExplanation.length > 40) score += 8;
  if (evidence.length === 0) score = Math.min(score, 35);
  return clamp(score);
}

function scoreBusinessAlignment(opts: AssessDecisionOpts): number {
  let score = 30;
  if (opts.hasBusinessMemory) score += 15;
  if (opts.hasBusinessDna) score += 20;
  if (opts.hasStrategy) score += 15;
  if (opts.industryKnown) score += 12;
  if (opts.goalsKnown) score += 8;
  if ((opts.missingInfo || []).some((m) => /goal|industry|strategy/i.test(m))) score -= 15;
  return clamp(score);
}

function scoreCustomerImpact(opts: AssessDecisionOpts, kinds: HublyCustomerImpactKind[]): number {
  let score = 55;
  if (kinds.includes("trust")) score += 12;
  if (kinds.includes("conversion")) score += 12;
  if (kinds.includes("revenue")) score += 8;
  if (kinds.includes("retention")) score += 8;
  if (kinds.includes("simplicity")) score += 10;
  if (kinds.includes("unknown") && kinds.length === 1) score -= 10;
  if ((opts.confidence ?? 0) >= 85) score += 5;
  return clamp(score);
}

function scoreExperienceImpact(opts: AssessDecisionOpts): number {
  const rec = `${opts.recommendation} ${opts.request || ""}`.toLowerCase();
  let score = 70;
  if (/simpl|one cta|fewer|clear|easier|reduce friction/.test(rec)) score += 18;
  if (/quiz|multi-step|settings|dashboard clutter|more options/.test(rec)) score -= 20;
  if (/rewrite|redesign/.test(rec)) score += 5; // clearer site can help if done well
  if (opts.autoSafe) score += 5;
  return clamp(score);
}

/**
 * Route to proceed | recommend | ask | research_more.
 * Confidence alone never decides — uses full Decision Score + risk + gaps.
 */
export function routeDecision(input: {
  decisionScore: number;
  confidence: number;
  evidenceQuality: number;
  risk: HublyRiskLevel;
  requiresApproval: boolean;
  missingInfo: string[];
  forceAction?: HublyDecisionAction | null;
}): HublyDecisionAction {
  if (input.forceAction) return input.forceAction;

  const gaps = input.missingInfo.length > 0;
  // Ask when information is missing (unless evidence is nearly nonexistent).
  if (gaps) {
    if (input.evidenceQuality < 30 && input.confidence < 45) return "research_more";
    return "ask";
  }
  // Research when evidence is insufficient.
  if (input.evidenceQuality < 45 || input.confidence < 50) {
    return "research_more";
  }
  if (
    input.decisionScore >= 85 &&
    input.confidence >= 90 &&
    input.evidenceQuality >= 85 &&
    input.risk === "low" &&
    !input.requiresApproval
  ) {
    return "proceed";
  }
  if (input.decisionScore >= 75 && input.evidenceQuality >= 60) {
    return "recommend";
  }
  if (input.decisionScore >= 60 || input.confidence < 70) return "ask";
  return "research_more";
}

function explainRouting(d: {
  finalDecision: HublyDecisionAction;
  decisionScore: number;
  confidence: number;
  evidenceQuality: number;
  businessAlignment: number;
  customerImpact: number;
  experienceImpact: number;
  risk: HublyRiskLevel;
  requiresApproval: boolean;
  missingInfo: string[];
  recommendation: string;
}): string {
  const dims =
    `Confidence ${d.confidence}%, Evidence Quality ${d.evidenceQuality}%, ` +
    `Business Alignment ${d.businessAlignment}%, Customer Impact ${d.customerImpact}%, ` +
    `Experience Impact ${d.experienceImpact}%, Risk ${d.risk}, ` +
    `Requires Approval ${d.requiresApproval ? "Yes" : "No"}, Overall Decision Score ${d.decisionScore}%.`;

  if (d.finalDecision === "proceed") {
    return `I can proceed with "${d.recommendation}" automatically. ${dims}`;
  }
  if (d.finalDecision === "recommend") {
    return `I recommend "${d.recommendation}" but I'm waiting for your approval before changing anything. ${dims}`;
  }
  if (d.finalDecision === "ask") {
    const miss = d.missingInfo.length ? ` Missing: ${d.missingInfo.join(", ")}.` : "";
    return `I paused on "${d.recommendation}" because I need a bit more information.${miss} ${dims}`;
  }
  return `I want to research more before committing to "${d.recommendation}" — evidence isn't strong enough yet. ${dims}`;
}

/**
 * Assess a recommendation → Decision Object (stored).
 */
export function assessDecision(opts: AssessDecisionOpts): HublyDecisionObject {
  const confidence = clamp(opts.confidence ?? 70);
  const evidenceQuality = scoreEvidenceQuality(opts);
  const businessAlignment = scoreBusinessAlignment(opts);
  const kinds = inferCustomerImpactKinds(opts.expectedOutcome);
  const customerImpact = scoreCustomerImpact(opts, kinds);
  const experienceImpact = scoreExperienceImpact(opts);
  const risk = inferRisk(opts);
  const riskScore = riskToScore(risk);
  const missingInfo = [...(opts.missingInfo || [])];

  // Weighted overall — confidence is only one piece
  const decisionScore = clamp(
    confidence * 0.2 +
      evidenceQuality * 0.2 +
      businessAlignment * 0.2 +
      customerImpact * 0.15 +
      experienceImpact * 0.15 +
      riskScore * 0.1,
  );

  let requiresApproval = true;
  if (
    opts.autoSafe &&
    risk === "low" &&
    confidence >= 90 &&
    evidenceQuality >= 85 &&
    decisionScore >= 85
  ) {
    requiresApproval = false;
  }
  if (risk === "low" && decisionScore >= 90 && evidenceQuality >= 88 && !opts.touchesPricing) {
    requiresApproval = false;
  }
  if (opts.touchesWebsite && /rewrite|redesign|replace all/i.test(String(opts.request || opts.recommendation))) {
    requiresApproval = true;
  }
  if (opts.isDestructive || risk === "high" || risk === "very_high") requiresApproval = true;
  if (opts.forceAction === "proceed") requiresApproval = false;

  const finalDecision = routeDecision({
    decisionScore,
    confidence,
    evidenceQuality,
    risk,
    requiresApproval,
    missingInfo,
    forceAction: opts.forceAction,
  });

  // Proceed path must not require approval
  if (finalDecision === "proceed") requiresApproval = false;
  if (finalDecision === "recommend") requiresApproval = true;

  const recommendation = String(opts.recommendation || "Untitled recommendation").trim();
  const obj: HublyDecisionObject = {
    decisionId: newId("dec"),
    recommendation,
    decisionScore,
    confidence,
    evidenceQuality,
    businessAlignment,
    customerImpact,
    experienceImpact,
    risk,
    requiresApproval,
    finalDecision,
    explanation: "",
    customerImpactKinds: kinds,
    missingInfo,
    reasoningId: opts.reasoningId ?? null,
    reasoningKey: opts.reasoningKey ?? null,
    timestamp: opts.at || new Date().toISOString(),
    businessId: opts.businessId ?? null,
    request: opts.request ?? null,
    dimensions: {
      confidence,
      evidenceQuality,
      businessAlignment,
      customerImpact,
      experienceImpact,
      riskScore,
      risk,
      requiresApproval,
    },
  };
  obj.explanation = explainRouting(obj);

  STORE.set(obj.decisionId, obj);
  indexBiz(opts.businessId, obj.decisionId);
  const key = opts.reasoningKey || recommendation.toLowerCase().replace(/\W+/g, "_").slice(0, 48);
  indexKey(key, obj.decisionId);

  return cloneDecision(obj);
}

export function getDecision(decisionId: string): HublyDecisionObject | null {
  const d = STORE.get(String(decisionId));
  return d ? cloneDecision(d) : null;
}

export function listDecisionHistory(opts?: {
  businessId?: string | null;
  limit?: number;
}): HublyDecisionObject[] {
  let ids: string[] = [];
  if (opts?.businessId) ids = [...(BIZ_INDEX.get(String(opts.businessId)) || [])];
  else ids = [...STORE.keys()];
  const limit = opts?.limit ?? 50;
  return ids
    .map((id) => STORE.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-limit)
    .map(cloneDecision);
}

export function isWhyDecisionQuestion(request: string): boolean {
  const r = String(request || "").toLowerCase();
  return /why didn'?t you|why did you not|why (won'?t|wouldn'?t) you|why (didn'?t|not) (?:make|change|apply|do|act|rewrite)|why (did you )?(pause|wait|ask|research)/.test(r);
}

export type HublyWhyDecisionAnswer = {
  fromStoredDecision: true;
  regenerated: false;
  answer: string;
  decision: HublyDecisionObject | null;
  history: HublyDecisionObject[];
};

/**
 * Answer "Why didn't you make that change?" from stored Decision Objects.
 */
export function answerWhyFromDecision(
  request: string,
  opts?: { businessId?: string | null },
): HublyWhyDecisionAnswer {
  const history = listDecisionHistory({ businessId: opts?.businessId, limit: 30 });
  // Prefer non-proceed decisions when asking why we didn't act
  const nonAuto = [...history].reverse().find((d) => d.finalDecision !== "proceed");
  const latest = nonAuto || (history.length ? history[history.length - 1] : null);

  if (!latest) {
    return {
      fromStoredDecision: true,
      regenerated: false,
      answer: "I don't have a stored decision assessment for that yet.",
      decision: null,
      history: [],
    };
  }

  const answer =
    `I didn't make that change automatically because my Decision Engine routed to "${latest.finalDecision}". ` +
    latest.explanation;

  return {
    fromStoredDecision: true,
    regenerated: false,
    answer,
    decision: cloneDecision(latest),
    history: history.map(cloneDecision),
  };
}

/**
 * Assess common homepage rewrite demo + optional variant paths.
 */
export function assessHomepageRewrite(opts: {
  request?: string;
  businessId?: string | null;
  confidence?: number;
  hasBusinessMemory?: boolean;
  hasBusinessDna?: boolean;
  hasStrategy?: boolean;
  industryKnown?: boolean;
  evidence?: string[];
  evidenceSourceKinds?: string[];
  missingInfo?: string[];
  forceAction?: HublyDecisionAction | null;
  reasoningId?: string | null;
}): HublyDecisionObject {
  return assessDecision({
    recommendation: "Rewrite homepage — lead with proof, then packages, then a single Book CTA",
    request: opts.request || "Rewrite my homepage.",
    confidence: opts.confidence ?? 88,
    evidence: opts.evidence || [
      "Business DNA homepage order",
      "Trust before price for pressure washing",
    ],
    evidenceSourceKinds: opts.evidenceSourceKinds || [
      "business_dna",
      "strategy_expert",
      "research_expert",
    ],
    reasoningExplanation:
      "Homeowners look for proof before comparing price; rewriting the homepage around trust should improve conversion.",
    hasBusinessMemory: opts.hasBusinessMemory ?? true,
    hasBusinessDna: opts.hasBusinessDna ?? true,
    hasStrategy: opts.hasStrategy ?? true,
    industryKnown: opts.industryKnown ?? true,
    goalsKnown: true,
    missingInfo: opts.missingInfo || [],
    expectedOutcome: "higher_conversion",
    touchesWebsite: true,
    businessId: opts.businessId,
    reasoningId: opts.reasoningId,
    reasoningKey: "homepage_rewrite",
    forceAction: opts.forceAction,
  });
}

export function clearDecisionStoreForTests(): void {
  STORE.clear();
  BIZ_INDEX.clear();
  KEY_INDEX.clear();
}

export function exportDecisionStore(): {
  byId: Record<string, HublyDecisionObject>;
  byBusiness: Record<string, string[]>;
} {
  const byId: Record<string, HublyDecisionObject> = {};
  for (const [id, d] of STORE) byId[id] = cloneDecision(d);
  const byBusiness: Record<string, string[]> = {};
  for (const [k, ids] of BIZ_INDEX) byBusiness[k] = [...ids];
  return { byId, byBusiness };
}

/** Map Decision action → legacy confidence band for compatibility. */
export function decisionActionToConfidenceBand(
  action: HublyDecisionAction,
): "auto" | "explain" | "ask" | "research_more" {
  if (action === "proceed") return "auto";
  if (action === "recommend") return "explain";
  if (action === "ask") return "ask";
  return "research_more";
}

export const HublyDecisionEngine = {
  version: DECISION_ENGINE_VERSION,
  owner: DECISION_ENGINE_OWNER,
  assess: assessDecision,
  assessHomepageRewrite,
  route: routeDecision,
  get: getDecision,
  history: listDecisionHistory,
  answerWhy: answerWhyFromDecision,
  isWhyDecisionQuestion,
  clearForTests: clearDecisionStoreForTests,
  exportStore: exportDecisionStore,
  toConfidenceBand: decisionActionToConfidenceBand,
};

export default HublyDecisionEngine;
