/**
 * Hubly Runtime — Domain / Business Launch helpers
 *
 * Production-First: never invent availability.
 * Candidate generation is local; availability comes from DomainProvider.
 */

import {
  runBusinessLaunchDomain,
  type HublyBusinessLaunchResult,
} from "./hubly_brain_launch.ts";
import { generateDomainCandidates } from "./hubly_provider_domain.ts";

export type HublyDomainSuggestion = HublyBusinessLaunchResult["suggestions"][number];
export type HublyDomainResult = HublyBusinessLaunchResult;

/** Sync candidate list only — availability always provider_not_configured until async check. */
export function suggestDomains(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
}): HublyDomainResult {
  const candidates = generateDomainCandidates(opts);
  const cta = "Connect a domain provider to check real availability";
  return {
    version: 1,
    headline: "Let's launch your business.",
    subhead: "A real company deserves a real address — domain, DNS, SSL, and a live site.",
    whyItMatters:
      "Customers decide in seconds. yourbusiness.com signals legitimacy, improves local SEO, and becomes the home for booking, email, and ads.",
    cta,
    experience: {
      headline: "Let's launch your business.",
      subhead: "A real company deserves a real address — not only a temporary Hubly link.",
      whyItMatters:
        "Customers decide in seconds. yourbusiness.com signals legitimacy, improves local SEO, and becomes the home for booking, email, and ads.",
      cta,
    },
    provider: {
      id: "none",
      configured: false,
      missing: [
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID",
        "or PORKBUN_API_KEY",
        "PORKBUN_SECRET_API_KEY",
      ],
      status: "not_configured",
      message: "Use suggestDomainsAsync / Business Launch for real checks",
    },
    preferred: candidates[0]?.domain || null,
    suggestions: candidates.map((c) => ({
      ...c,
      availability: "provider_not_configured" as const,
      checkMessage: "Provider not configured — availability not checked",
    })),
    purchaseReady: false,
    steps: [],
    note: "Production-First: sync helper does not claim availability. Call suggestDomainsAsync.",
  };
}

/** Production path — real provider checks (or honest not_configured). */
export async function suggestDomainsAsync(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
}): Promise<HublyDomainResult> {
  return runBusinessLaunchDomain(opts);
}

export const HublyDomain = { suggestDomains, suggestDomainsAsync };
export default HublyDomain;
