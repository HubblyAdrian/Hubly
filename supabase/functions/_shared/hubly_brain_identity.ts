/**
 * Business Identity — launch screen after build
 *
 * Feels like launching a company, not finishing a setup wizard.
 */

import {
  normalizeBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import {
  normalizeBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";
import type { HublyDomainResult } from "./hubly_brain_domain.ts";

export type HublyIdentitySurface = {
  status: "Ready" | "Building" | "Needs attention";
  businessName: string;
  logo: string | null;
  brandColors: { primary: string; accent: string };
  website: { ready: boolean; slug: string | null; path: string | null };
  booking: { ready: boolean };
  crm: { ready: boolean };
  payments: { ready: boolean };
  marketplace: { ready: boolean };
  domain: { ready: boolean; preferred: string | null; suggestions: string[] };
  customerRuntime: { ready: boolean };
  headline: string;
};

export function buildBusinessIdentity(opts: {
  memory?: HublyBusinessMemoryInput | null;
  dna?: HublyBusinessDNAInput | null;
  domain?: HublyDomainResult | null;
  websitePublished?: boolean;
  marketplaceReady?: boolean;
  paymentsReady?: boolean;
}): HublyIdentitySurface {
  const memory = normalizeBusinessMemory(opts.memory);
  const dna = normalizeBusinessDNA(opts.dna);
  const name = memory.name || "Your Business";
  const slug = memory.currentWebsite?.slug || null;
  const published = !!(opts.websitePublished || memory.currentWebsite?.published || slug);
  const booking = !!(memory.extras && typeof memory.extras === "object" &&
    (memory.extras as Record<string, unknown>).bookingFlow);
  const crm = !!(memory.currentCrm?.pipeline || memory.currentCrm?.customerCount != null);
  const accent = memory.currentWebsite?.accentColor || "#D9632D";
  const primary = "#141B2B";
  const domain = opts.domain;
  const marketplace = !!opts.marketplaceReady || published;

  const readyBits = [published, booking, crm, marketplace, !!domain?.preferred];
  const status: HublyIdentitySurface["status"] =
    readyBits.filter(Boolean).length >= 3 ? "Ready" : published ? "Building" : "Needs attention";

  return {
    status,
    businessName: name,
    logo: null,
    brandColors: { primary, accent },
    website: {
      ready: published,
      slug,
      path: slug ? `/${slug}` : null,
    },
    booking: { ready: booking },
    crm: { ready: crm },
    payments: { ready: !!opts.paymentsReady },
    marketplace: { ready: marketplace },
    domain: {
      ready: !!domain?.preferred,
      preferred: domain?.preferred || null,
      suggestions: (domain?.suggestions || []).map((s) => s.domain),
    },
    customerRuntime: { ready: published },
    headline: status === "Ready"
      ? `${name} is ready to take customers.`
      : `Hubly is finishing ${name}.`,
  };
}

export const HublyIdentity = { build: buildBusinessIdentity };
export default HublyIdentity;
