/**
 * Hubly Brain — Reasoning Engine (Milestone 1)
 *
 * Every important decision stores: reason, evidence, confidence, expected impact.
 */

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
};

export function makeDecision(opts: {
  domain: string;
  decision: string;
  reason: string;
  evidence?: string[];
  confidence: number;
  expectedImpact?: string | null;
  expertId?: string | null;
  source?: string | null;
}): HublyDecisionRecord {
  return {
    id: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    domain: opts.domain,
    decision: opts.decision,
    reason: opts.reason,
    evidence: opts.evidence || [],
    confidence: Math.max(0, Math.min(100, Math.round(opts.confidence))),
    expectedImpact: opts.expectedImpact ?? null,
    expertId: opts.expertId ?? null,
    source: opts.source ?? null,
  };
}

export function formatDecisionForOwner(d: HublyDecisionRecord): string {
  const impact = d.expectedImpact ? ` Expected impact: ${d.expectedImpact}` : "";
  return `${d.reason}${impact}`.trim();
}

export const HublyReasoning = {
  make: makeDecision,
  formatForOwner: formatDecisionForOwner,
};
