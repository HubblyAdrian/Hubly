/**
 * Hubly Customer Runtime — DNA-fit matching (Phase 7.8)
 *
 * Rank providers using classic signals PLUS Business DNA fit vs Customer Profile.
 * Premium / careful customers should not default to cheapest providers.
 */

import type { HublyBusinessDNAInput } from "./hubly_brain_dna.ts";
import { normalizeBusinessDNA } from "./hubly_brain_dna.ts";
import type { HublyCustomerProfileInput } from "./hubly_brain_customer_profile.ts";
import { normalizeCustomerProfile } from "./hubly_brain_customer_profile.ts";
import type { HublyCustomerMemoryInput } from "./hubly_brain_customer_memory.ts";
import { normalizeCustomerMemory } from "./hubly_brain_customer_memory.ts";

export type HublyDnaFitResult = {
  /** 0–100 contribution-ready score (typically 0–24 applied as boost) */
  score: number;
  boost: number;
  reasons: string[];
};

/**
 * Score how well a business's DNA fits this customer.
 * Returns boost points for the marketplace ranker (0–24).
 */
export function scoreDnaFit(opts: {
  customerProfile?: HublyCustomerProfileInput | null;
  customerMemory?: HublyCustomerMemoryInput | null;
  businessDna?: HublyBusinessDNAInput | null;
}): HublyDnaFitResult {
  const profile = normalizeCustomerProfile(opts.customerProfile);
  const memory = normalizeCustomerMemory(opts.customerMemory);
  const dna = normalizeBusinessDNA(opts.businessDna);
  const reasons: string[] = [];
  let score = 40;

  const service = (memory.job?.service || "").toLowerCase();
  const idealJobs = (dna.services.idealJobs || dna.services.focus || dna.identity.preferredJobs || [])
    .map((s) => s.toLowerCase());
  if (service && idealJobs.some((j) => j.includes(service.split(" ")[0]) || service.includes(j.split(" ")[0]))) {
    score += 18;
    reasons.push("Service matches their specialty");
  }

  if (profile.prefersPremium || profile.caresAboutCarefulness) {
    const tier = (dna.pricing.tier || "").toLowerCase();
    const sales = (dna.brand.salesStyle || "").toLowerCase();
    const personality = (dna.brand.personality || dna.personality.traits || []).join(" ").toLowerCase();
    if (tier === "premium" || tier === "luxury" || sales === "premium") {
      score += 16;
      reasons.push("Premium brand fit");
    } else if (/professional|luxury|care|quality|white.?glove/.test(personality)) {
      score += 10;
      reasons.push("Careful / professional personality fit");
    } else if (tier === "budget" || /cheap|budget/.test(personality)) {
      score -= 12;
      reasons.push("Budget-leaning brand — weaker premium fit");
    }
  }

  if (profile.budgetConscious) {
    const tier = (dna.pricing.tier || "").toLowerCase();
    if (tier === "budget" || tier === "mid" || !tier) {
      score += 8;
      reasons.push("Value-oriented fit");
    }
    if (tier === "luxury") score -= 6;
  }

  if (profile.caresAboutCarefulness) {
    const avoid = (dna.identity.avoid || []).join(" ").toLowerCase();
    const ideal = (dna.customerProfile.idealCustomer || "").toLowerCase();
    if (/care|homeowner|quality|premium|discerning/.test(ideal)) {
      score += 10;
      reasons.push("Ideal customer is homeowners who value care");
    }
    if (/cheap customer|price.?only|tire.?kicker/.test(avoid)) {
      score += 6;
      reasons.push("Avoids price-only customers");
    }
  }

  if (profile.prefersMobile) {
    const adv = (dna.identity.competitiveAdvantage || "").toLowerCase();
    if (/convenience|mobile|come to you/.test(adv)) {
      score += 10;
      reasons.push("Convenience / mobile advantage");
    }
  }

  if (profile.hasPets) {
    // Soft preference — businesses mentioning pet-friendly in DNA extras aren't modeled yet
    score += 2;
  }

  const boost = Math.max(0, Math.min(24, Math.round((score - 40) * 0.6 + 8)));
  return { score: Math.max(0, Math.min(100, score)), boost, reasons: reasons.slice(0, 4) };
}

export const HublyCustomerMatch = { scoreDnaFit };
export default HublyCustomerMatch;
