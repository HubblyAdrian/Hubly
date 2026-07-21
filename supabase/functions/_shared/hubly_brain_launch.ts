/**
 * Business Launch — production-first capability surface
 *
 * Launch = Domain availability → purchase → DNS → SSL → publish readiness
 * Not "buy a domain" as a feature — launch a company.
 *
 * Uses DomainProvider. Never fakes availability or purchase success.
 */

import type { DomainProvider, DomainCheck, DomainCandidate } from "./hubly_provider_domain.ts";
import { generateDomainCandidates } from "./hubly_provider_domain.ts";
import { createCloudflareDomainProvider } from "./hubly_provider_cloudflare.ts";
import { createPorkbunDomainProvider } from "./hubly_provider_porkbun.ts";
import type { HublyProviderResult } from "./hubly_providers.ts";

export type HublyLaunchSuggestion = DomainCandidate & {
  availability: DomainCheck["availability"];
  priceCents?: number | null;
  currency?: string | null;
  checkMessage?: string | null;
};

export type HublyBusinessLaunchResult = {
  version: 1;
  headline: string;
  subhead: string;
  whyItMatters: string;
  cta: string;
  /** Alias block for Instant Site UI */
  experience: {
    headline: string;
    subhead: string;
    whyItMatters: string;
    cta: string;
  };
  provider: {
    id: string;
    configured: boolean;
    missing: string[];
    status: string;
    message: string;
  };
  preferred: string | null;
  suggestions: HublyLaunchSuggestion[];
  /** True only when a real provider confirmed at least one available domain */
  purchaseReady: boolean;
  steps: Array<{
    id: string;
    label: string;
    status: "ready" | "blocked" | "pending" | "done";
    detail: string;
  }>;
  note: string;
};

/** Resolve domain provider: prefer configured registrar, else Cloudflare, else Porkbun stub. */
export function resolveDomainProvider(): DomainProvider {
  const porkbun = createPorkbunDomainProvider();
  if (porkbun.isConfigured()) return porkbun;
  const cf = createCloudflareDomainProvider();
  if (cf.isConfigured()) return cf;
  // Default surface is Cloudflare — reports not_configured until keys exist.
  const prefer = (typeof Deno !== "undefined"
    ? (Deno.env.get("HUBLY_DOMAIN_PROVIDER") || "").trim().toLowerCase()
    : "") || "cloudflare";
  return prefer === "porkbun" ? porkbun : cf;
}

/**
 * Run Business Launch domain phase:
 * generate candidates → real availability checks (or honest not_configured).
 */
export async function runBusinessLaunchDomain(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
  provider?: DomainProvider | null;
}): Promise<HublyBusinessLaunchResult> {
  const provider = opts.provider || resolveDomainProvider();
  const candidates = generateDomainCandidates({
    businessName: opts.businessName,
    industry: opts.industry,
    city: opts.city,
  });

  const missing = provider.missingEnv();
  const configured = provider.isConfigured();

  let checks: DomainCheck[] = [];
  let providerMessage = configured
    ? `Using ${provider.id}`
    : `Provider not configured. Add: ${missing.join(", ")}`;
  let providerStatus = configured ? "ready" : "not_configured";

  if (!configured) {
    checks = candidates.map((c) => ({
      domain: c.domain,
      availability: "provider_not_configured" as const,
      reason: providerMessage,
    }));
  } else {
    const batch: HublyProviderResult<DomainCheck[]> = await provider.checkAvailabilityBatch(
      candidates.map((c) => c.domain),
    );
    providerStatus = batch.status;
    providerMessage = batch.message;
    if (batch.ok && batch.data) {
      checks = batch.data;
    } else {
      checks = candidates.map((c) => ({
        domain: c.domain,
        availability: "unknown" as const,
        reason: batch.message,
      }));
    }
  }

  const byDomain = new Map(checks.map((c) => [c.domain, c]));
  const suggestions: HublyLaunchSuggestion[] = candidates.map((c) => {
    const check = byDomain.get(c.domain);
    return {
      ...c,
      availability: check?.availability || "unknown",
      priceCents: check?.priceCents ?? null,
      currency: check?.currency ?? null,
      checkMessage: check?.reason || null,
    };
  });

  const available = suggestions.filter((s) => s.availability === "available");
  const preferred = available[0]?.domain || suggestions[0]?.domain || null;
  const purchaseReady = available.length > 0 && configured;

  const steps: HublyBusinessLaunchResult["steps"] = [
    {
      id: "availability",
      label: "Domain availability",
      status: !configured ? "blocked" : available.length ? "done" : "pending",
      detail: !configured
        ? providerMessage
        : available.length
        ? `${available.length} available`
        : providerMessage,
    },
    {
      id: "purchase",
      label: "Domain purchase",
      status: purchaseReady ? "ready" : "blocked",
      detail: purchaseReady
        ? "Ready when owner confirms"
        : "Requires configured provider + available domain",
    },
    {
      id: "dns",
      label: "DNS",
      status: configured && provider.id === "cloudflare" ? "ready" : "blocked",
      detail: "Cloudflare Zone DNS when CLOUDFLARE_ZONE_ID is set",
    },
    {
      id: "ssl",
      label: "SSL",
      status: configured && provider.id === "cloudflare" ? "ready" : "blocked",
      detail: "Provisioned via DNS/edge provider — never faked",
    },
    {
      id: "publish",
      label: "Website publishing",
      status: "pending",
      detail: "Website Runtime publishes the live site",
    },
  ];

  return {
    version: 1,
    headline: "Let's launch your business.",
    subhead: "A real company deserves a real address — domain, DNS, SSL, and a live site.",
    whyItMatters:
      "Customers decide in seconds. yourbusiness.com signals legitimacy, improves local SEO, and becomes the home for booking, email, and ads.",
    cta: purchaseReady
      ? "Choose a domain to purchase"
      : configured
      ? "No available domains yet — try another name"
      : "Connect a domain provider to check real availability",
    experience: {
      headline: "Let's launch your business.",
      subhead: "A real company deserves a real address — domain, DNS, SSL, and a live site.",
      whyItMatters:
        "Customers decide in seconds. yourbusiness.com signals legitimacy, improves local SEO, and becomes the home for booking, email, and ads.",
      cta: purchaseReady
        ? "Choose a domain to purchase"
        : configured
        ? "No available domains yet — try another name"
        : "Connect a domain provider to check real availability",
    },
    provider: {
      id: provider.id,
      configured,
      missing,
      status: providerStatus,
      message: providerMessage,
    },
    preferred,
    suggestions,
    purchaseReady,
    steps,
    note: configured
      ? "Live provider checks — availability is real."
      : "Production-ready architecture. Provider not configured — Hubly will not pretend domains are available.",
  };
}

export const HublyBusinessLaunch = {
  resolveDomainProvider,
  runDomain: runBusinessLaunchDomain,
  generateCandidates: generateDomainCandidates,
};

export default HublyBusinessLaunch;
