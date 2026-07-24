/**
 * Hubly Brain — Confidence policy (Milestone 1)
 *
 * Section 9: Confidence is one dimension of the AI Decision Engine
 * (`hubly_brain_decision.ts`). Prefer Decision Objects for act/ask/research routing.
 *
 * Legacy single-score bands (still used as a fallback mapping):
 * 95%+  → proceed automatically (where appropriate)
 * 80–95 → proceed but explain
 * 60–80 → ask one clarifying question
 * <60   → research more before acting
 */

export type HublyConfidenceBand =
  | "auto"
  | "explain"
  | "ask"
  | "research_more";

export function confidenceBand(score: number): HublyConfidenceBand {
  const n = Math.max(0, Math.min(100, Number(score) || 0));
  if (n >= 95) return "auto";
  if (n >= 80) return "explain";
  if (n >= 60) return "ask";
  return "research_more";
}

export function shouldAutoProceed(score: number): boolean {
  return confidenceBand(score) === "auto";
}

export function shouldExplain(score: number): boolean {
  const b = confidenceBand(score);
  return b === "explain" || b === "auto";
}

export function shouldAskClarifying(score: number): boolean {
  return confidenceBand(score) === "ask";
}

export function shouldResearchMore(score: number): boolean {
  return confidenceBand(score) === "research_more";
}

export const HublyConfidencePolicy = {
  band: confidenceBand,
  shouldAutoProceed,
  shouldExplain,
  shouldAskClarifying,
  shouldResearchMore,
};
