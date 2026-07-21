/**
 * Hubly Runtime — Weekly Learning foundation (Phase 7.6)
 *
 * Every Sunday (future cron): Hubly Brain reviews outcomes and evolves Business DNA.
 * This module defines the report shape + pure apply helpers.
 * Scheduling / metrics ingestion lands with Autonomous Growth — not feature migration.
 *
 * Example observations:
 *   Revenue +18%
 *   Ceramic coatings = 41% of revenue
 *   Repeat customers up
 *   Travel time hurting profit → recommend travel fee
 */

import {
  evolveBusinessDNA,
  normalizeBusinessDNA,
  type HublyBusinessDNA,
  type HublyBusinessDNAInput,
  type HublyBusinessGoal,
} from "./hubly_brain_dna.ts";

export type HublyWeeklyObservation = {
  kind: string;
  summary: string;
  metric?: string | null;
  value?: number | string | null;
  deltaPct?: number | null;
};

export type HublyWeeklyRecommendation = {
  id: string;
  summary: string;
  /** Suggested DNA patch (interpretive only) */
  dnaPatch?: HublyBusinessDNAInput | null;
  priority?: number | null;
};

export type HublyWeeklyLearningReport = {
  version: 1;
  weekOf: string;
  businessId?: string | null;
  observations: HublyWeeklyObservation[];
  recommendations: HublyWeeklyRecommendation[];
  /** DNA before learning */
  dnaBefore: HublyBusinessDNA;
  /** Proposed DNA after applying recommendations */
  dnaAfter: HublyBusinessDNA;
  applied: boolean;
  createdAt: string;
};

/**
 * Build a weekly learning report from observations.
 * Does not persist — Orchestrator / cron will store later.
 */
export function buildWeeklyLearningReport(opts: {
  weekOf: string;
  businessId?: string | null;
  dna?: HublyBusinessDNAInput | null;
  observations: HublyWeeklyObservation[];
  apply?: boolean;
}): HublyWeeklyLearningReport {
  const dnaBefore = normalizeBusinessDNA(opts.dna);
  const recommendations = recommendationsFromObservations(opts.observations, dnaBefore);
  let dnaAfter = dnaBefore;
  if (opts.apply !== false) {
    for (const rec of recommendations) {
      if (rec.dnaPatch) dnaAfter = evolveBusinessDNA(dnaAfter, {
        ...rec.dnaPatch,
        source: "weekly_learning",
      });
    }
  }
  return {
    version: 1,
    weekOf: opts.weekOf,
    businessId: opts.businessId || null,
    observations: opts.observations,
    recommendations,
    dnaBefore,
    dnaAfter,
    applied: opts.apply !== false,
    createdAt: new Date().toISOString(),
  };
}

function recommendationsFromObservations(
  observations: HublyWeeklyObservation[],
  dna: HublyBusinessDNA,
): HublyWeeklyRecommendation[] {
  const recs: HublyWeeklyRecommendation[] = [];
  for (const obs of observations) {
    const low = `${obs.kind} ${obs.summary}`.toLowerCase();
    if (/ceramic|coating/.test(low) && /revenue|percent|%/.test(low)) {
      recs.push({
        id: "rec_focus_ceramic",
        summary: "Lean into ceramic coatings as a primary growth service.",
        priority: 1,
        dnaPatch: {
          services: {
            idealJobs: ["Ceramic coatings"],
            focus: ["Ceramic coatings", ...(dna.services.focus || [])],
          },
          identity: { preferredJobs: ["Ceramic coatings"] },
          goals: [
            {
              id: "goal_book_ceramic",
              label: "Book more ceramic coatings",
              kind: "bookings",
              priority: 1,
              status: "active",
            } satisfies HublyBusinessGoal,
          ],
        },
      });
    }
    if (/repeat/.test(low) && (obs.deltaPct == null || obs.deltaPct >= 0)) {
      recs.push({
        id: "rec_repeat",
        summary: "Double down on retention and repeat-customer offers.",
        priority: 2,
        dnaPatch: {
          goals: [
            {
              id: "goal_repeat",
              label: "Increase repeat customers",
              kind: "repeat",
              priority: 2,
              status: "active",
            },
          ],
          marketing: { themes: ["repeat customers", "memberships"] },
        },
      });
    }
    if (/travel/.test(low) && /hurt|profit|cost|time/.test(low)) {
      recs.push({
        id: "rec_travel_fee",
        summary: "Recommend increasing travel fee — travel time is hurting profit.",
        priority: 1,
        dnaPatch: {
          operations: {
            travelNotes: "Travel time hurting profit — increase travel fee",
          },
          pricing: {
            strategy: dna.pricing.strategy || "Value-based with travel fee",
            notes: "Consider higher travel fee",
          },
        },
      });
    }
    if (/revenue/.test(low) && typeof obs.deltaPct === "number" && obs.deltaPct > 0) {
      recs.push({
        id: "rec_growth_stage",
        summary: `Revenue up ${obs.deltaPct}% — update growth stage and keep premium posture.`,
        priority: 3,
        dnaPatch: {
          growthStage: dna.growthStage === "just_started" ? "growing" : (dna.growthStage || "growing"),
        },
      });
    }
  }
  // Dedupe by id
  const seen = new Set<string>();
  return recs.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export const HublyWeeklyLearning = {
  buildReport: buildWeeklyLearningReport,
};

export default HublyWeeklyLearning;
