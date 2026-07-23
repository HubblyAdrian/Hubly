/**
 * DomainConnector — contract only until we intentionally choose a registrar.
 *
 * Business Launch requires a Domain Connection.
 * Do NOT implement Cloudflare / Porkbun / Namecheap until launch choice is made.
 */

import {
  connectionRequired,
  type HublyConnectorResult,
} from "./hubly_connectors.ts";

export type DomainAvailability =
  | "available"
  | "unavailable"
  | "unknown"
  | "connection_required";

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

/** Contract Hubly expects — vendor-agnostic. */
export interface DomainConnector {
  readonly id: string;
  isConnected(): boolean;
  missingConnection(): string[];
  searchAvailability(domain: string): Promise<HublyConnectorResult<DomainCheck>>;
  searchAvailabilityBatch(domains: string[]): Promise<HublyConnectorResult<DomainCheck[]>>;
  purchase(input: DomainPurchaseInput): Promise<HublyConnectorResult<DomainPurchaseResult>>;
  configureDNS(records: DnsRecordInput[]): Promise<HublyConnectorResult<{ applied: number }>>;
  verify(domain: string): Promise<HublyConnectorResult<{ verified: boolean }>>;
  renew(domain: string, years?: number): Promise<HublyConnectorResult<{ renewed: boolean }>>;
  transfer(domain: string): Promise<HublyConnectorResult<{ started: boolean }>>;
  ensureSsl(domain: string): Promise<HublyConnectorResult<SslResult>>;
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

/**
 * Unconfigured Domain Connector — production contract with honest state.
 * Vendor (Cloudflare / Porkbun / Namecheap) chosen intentionally later.
 */
export class UnconfiguredDomainConnector implements DomainConnector {
  readonly id = "domain";

  isConnected(): boolean {
    return false;
  }

  missingConnection(): string[] {
    return ["DOMAIN_CONNECTOR"];
  }

  async searchAvailability(domain: string): Promise<HublyConnectorResult<DomainCheck>> {
    const r = connectionRequired(this.id, "Domain", this.missingConnection());
    return {
      ...r,
      data: {
        domain,
        availability: "connection_required",
        reason: r.message,
      },
    } as HublyConnectorResult<DomainCheck>;
  }

  async searchAvailabilityBatch(
    domains: string[],
  ): Promise<HublyConnectorResult<DomainCheck[]>> {
    const r = connectionRequired(this.id, "Domain", this.missingConnection());
    return {
      ...r,
      data: domains.map((domain) => ({
        domain,
        availability: "connection_required" as const,
        reason: r.message,
      })),
    } as HublyConnectorResult<DomainCheck[]>;
  }

  async purchase(_input: DomainPurchaseInput) {
    return connectionRequired(this.id, "Domain", this.missingConnection());
  }
  async configureDNS(_records: DnsRecordInput[]) {
    return connectionRequired(this.id, "Domain", this.missingConnection());
  }
  async verify(_domain: string) {
    return connectionRequired(this.id, "Domain", this.missingConnection());
  }
  async renew(_domain: string, _years?: number) {
    return connectionRequired(this.id, "Domain", this.missingConnection());
  }
  async transfer(_domain: string) {
    return connectionRequired(this.id, "Domain", this.missingConnection());
  }
  async ensureSsl(_domain: string) {
    return connectionRequired(this.id, "Domain", this.missingConnection());
  }
}

export function getDomainConnector(): DomainConnector {
  // Intentional: no registrar wired until we choose one for launch.
  return new UnconfiguredDomainConnector();
}

export default getDomainConnector;
