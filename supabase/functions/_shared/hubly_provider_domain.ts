/**
 * DomainProvider — vendor-agnostic domain / DNS / SSL boundary.
 *
 * Capability: Business Launch (domain → DNS → SSL → publish)
 * Runtime never imports Cloudflare/Porkbun directly — only via providers.
 */

import type { HublyProviderResult } from "./hubly_providers.ts";

export type DomainAvailability =
  | "available"
  | "unavailable"
  | "unknown"
  | "provider_not_configured";

export type DomainCheck = {
  domain: string;
  availability: DomainAvailability;
  priceCents?: number | null;
  currency?: string | null;
  reason?: string | null;
};

export type DomainPurchaseInput = {
  domain: string;
  businessId: string;
  ownerId: string;
  years?: number;
};

export type DomainPurchaseResult = {
  domain: string;
  orderId: string;
  status: "purchased" | "pending";
};

export type DnsRecordInput = {
  domain: string;
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX";
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
};

export type SslResult = {
  domain: string;
  status: "active" | "pending" | "error";
  issuer?: string | null;
};

/** Vendor-agnostic domain + DNS + SSL operations. */
export interface DomainProvider {
  readonly id: string;
  isConfigured(): boolean;
  missingEnv(): string[];
  checkAvailability(domain: string): Promise<HublyProviderResult<DomainCheck>>;
  checkAvailabilityBatch(domains: string[]): Promise<HublyProviderResult<DomainCheck[]>>;
  purchaseDomain(input: DomainPurchaseInput): Promise<HublyProviderResult<DomainPurchaseResult>>;
  ensureDns(records: DnsRecordInput[]): Promise<HublyProviderResult<{ applied: number }>>;
  ensureSsl(domain: string): Promise<HublyProviderResult<SslResult>>;
}

export type DomainCandidate = {
  domain: string;
  reason: string;
};

/** Name generation only — never claims availability. */
export function generateDomainCandidates(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
}): DomainCandidate[] {
  const name = String(opts.businessName || "My Business").trim();
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 28) || "mybusiness";
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const short = parts.length > 1
    ? parts.map((p) => p[0]).join("") + (parts[parts.length - 1] || "")
    : base.slice(0, 12);
  const industry = String(opts.industry || "").toLowerCase();
  const serviceWord = /clean/.test(industry)
    ? "cleaning"
    : /detail/.test(industry)
    ? "detailing"
    : /lawn|landscap/.test(industry)
    ? "lawn"
    : /pressure|wash/.test(industry)
    ? "wash"
    : parts.find((p) => /clean|detail|wash|lawn|hvac|spa/.test(p)) || "pro";

  const raw: DomainCandidate[] = [
    { domain: `${base}.com`, reason: "Exact match — strongest brand signal" },
    { domain: `get${base}.com`, reason: "Action-oriented — easy to say aloud" },
    { domain: `${base}.co`, reason: "Short modern alternative" },
    {
      domain: `${base.replace(/(inc|llc|co)$/i, "")}${serviceWord}.com`.replace(/\.+/g, "."),
      reason: "Service-forward for local search",
    },
  ];
  if (opts.city) {
    const city = String(opts.city).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
    if (city) {
      raw.push({
        domain: `${base}${city}.com`,
        reason: `Local SEO — ties brand to ${opts.city}`,
      });
    }
  }
  if (short !== base && short.length >= 4) {
    raw.push({ domain: `${short}.com`, reason: "Compact brandable option" });
  }

  const seen = new Set<string>();
  return raw.filter((c) => {
    const d = c.domain.replace(/\.+/g, ".").replace(/^\./, "");
    if (seen.has(d) || d.length < 5) return false;
    seen.add(d);
    c.domain = d;
    return true;
  }).slice(0, 5);
}

export default DomainProvider;
