/**
 * Hubly Runtime — Domain / Business Launch helpers
 *
 * Production-First: never invent availability.
 * DomainConnector contract only — registrar chosen intentionally later.
 */

import {
  runBusinessLaunchDomain,
  type HublyBusinessLaunchResult,
} from "./hubly_brain_launch.ts";
import { generateDomainCandidates } from "./hubly_connector_domain.ts";

export type HublyDomainSuggestion = HublyBusinessLaunchResult["suggestions"][number];
export type HublyDomainResult = HublyBusinessLaunchResult;

export function suggestDomains(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
}): HublyDomainResult {
  const candidates = generateDomainCandidates(opts);
  const cta = "Domain connection required to check real availability";
  const experience = {
    headline: "Let's launch your business.",
    subhead: "A real company deserves a real address — domain, DNS, SSL, and a live site.",
    whyItMatters:
      "Customers decide in seconds. yourbusiness.com signals legitimacy, improves local SEO, and becomes the home for booking, email, and ads.",
    cta,
  };
  return {
    version: 1,
    ...experience,
    experience,
    connection: {
      id: "domain",
      connected: false,
      missing: ["DOMAIN_CONNECTOR"],
      status: "connection_required",
      message: "Domain connection required",
    },
    provider: {
      id: "domain",
      configured: false,
      missing: ["DOMAIN_CONNECTOR"],
      status: "connection_required",
      message: "Domain connection required",
    },
    preferred: candidates[0]?.domain || null,
    suggestions: candidates.map((c) => ({
      ...c,
      availability: "connection_required" as const,
      checkMessage: "Domain connection required",
    })),
    purchaseReady: false,
    steps: [],
    note: "Call suggestDomainsAsync — DomainConnector contract (registrar TBD).",
  };
}

export async function suggestDomainsAsync(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
}): Promise<HublyDomainResult> {
  return runBusinessLaunchDomain(opts);
}

export const HublyDomain = { suggestDomains, suggestDomainsAsync };
export default HublyDomain;
