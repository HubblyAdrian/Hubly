/**
 * PorkbunDomainProvider — alternate DomainProvider for availability + purchase.
 *
 * Env:
 *   PORKBUN_API_KEY
 *   PORKBUN_SECRET_API_KEY
 *
 * Docs: https://porkbun.com/api/json/v3/documentation
 * Production-First: missing keys → Provider not configured.
 */

import {
  envTruthy,
  providerError,
  providerNotConfigured,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";
import type {
  DomainCheck,
  DomainProvider,
  DomainPurchaseInput,
  DomainPurchaseResult,
  DnsRecordInput,
  SslResult,
} from "./hubly_provider_domain.ts";

const PROVIDER_ID = "porkbun";

async function porkbunPost<T>(
  path: string,
  extra?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: T & { status?: string; message?: string } }> {
  const apikey = envTruthy("PORKBUN_API_KEY");
  const secretapikey = envTruthy("PORKBUN_SECRET_API_KEY");
  if (!apikey || !secretapikey) throw new Error("Porkbun keys missing");
  const res = await fetch(`https://api.porkbun.com/api/json/v3${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey, secretapikey, ...(extra || {}) }),
  });
  const json = await res.json().catch(() => ({})) as T & {
    status?: string;
    message?: string;
  };
  return { ok: res.ok && json.status === "SUCCESS", status: res.status, json };
}

export class PorkbunDomainProvider implements DomainProvider {
  readonly id = PROVIDER_ID;

  missingEnv(): string[] {
    const missing: string[] = [];
    if (!envTruthy("PORKBUN_API_KEY")) missing.push("PORKBUN_API_KEY");
    if (!envTruthy("PORKBUN_SECRET_API_KEY")) missing.push("PORKBUN_SECRET_API_KEY");
    return missing;
  }

  isConfigured(): boolean {
    return this.missingEnv().length === 0;
  }

  async checkAvailability(domain: string): Promise<HublyProviderResult<DomainCheck>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    const clean = String(domain || "").trim().toLowerCase();
    try {
      const { ok, status, json } = await porkbunPost<{
        response?: { avail?: string; price?: string; currency?: string };
      }>(`/domain/checkDomain/${encodeURIComponent(clean)}`);
      if (!ok) {
        return providerError(
          PROVIDER_ID,
          "PORKBUN_API_ERROR",
          json.message || `Porkbun error (${status})`,
          { retryable: status >= 500 },
        );
      }
      const avail = String(json.response?.avail || "").toLowerCase();
      const available = avail === "yes" || avail === "available" || avail === "true";
      const priceRaw = json.response?.price;
      const priceCents = priceRaw != null ? Math.round(Number(priceRaw) * 100) : null;
      return providerOk(PROVIDER_ID, {
        domain: clean,
        availability: available ? "available" : "unavailable",
        priceCents,
        currency: json.response?.currency || "USD",
        reason: available ? "Available via Porkbun" : "Not available via Porkbun",
      }, available ? "Domain available" : "Domain unavailable");
    } catch (e) {
      return providerError(
        PROVIDER_ID,
        "PORKBUN_REQUEST_FAILED",
        e instanceof Error ? e.message : "Porkbun request failed",
        { retryable: true },
      );
    }
  }

  async checkAvailabilityBatch(
    domains: string[],
  ): Promise<HublyProviderResult<DomainCheck[]>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    const checks: DomainCheck[] = [];
    for (const d of domains) {
      const r = await this.checkAvailability(d);
      if (!r.ok && r.status === "not_configured") return r as HublyProviderResult<DomainCheck[]>;
      if (r.ok && r.data) checks.push(r.data);
      else checks.push({ domain: d, availability: "unknown", reason: r.message });
    }
    return providerOk(PROVIDER_ID, checks, `Checked ${checks.length} domains`);
  }

  async purchaseDomain(
    input: DomainPurchaseInput,
  ): Promise<HublyProviderResult<DomainPurchaseResult>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    // Porkbun purchase requires contact payload — fail honestly until launch wiring supplies it.
    return providerError(
      PROVIDER_ID,
      "PURCHASE_REQUIRES_CONTACTS",
      "Domain purchase requires registrant contact details — wire Business Launch contacts before calling purchase.",
      { retryable: false, meta: { domain: input.domain, businessId: input.businessId } },
    );
  }

  async ensureDns(
    _records: DnsRecordInput[],
  ): Promise<HublyProviderResult<{ applied: number }>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    return providerError(
      PROVIDER_ID,
      "DNS_NOT_WIRED",
      "Porkbun DNS apply is implemented at the provider boundary — pass records via Business Launch DNS step.",
      { retryable: false },
    );
  }

  async ensureSsl(domain: string): Promise<HublyProviderResult<SslResult>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    // SSL for custom domains is typically Cloudflare/Vercel — Porkbun is registrar-only here.
    return providerError(
      PROVIDER_ID,
      "SSL_USE_DNS_PROVIDER",
      `SSL for ${domain} should run through the DNS/edge provider (Cloudflare), not the registrar.`,
      { retryable: false },
    );
  }
}

export function createPorkbunDomainProvider(): PorkbunDomainProvider {
  return new PorkbunDomainProvider();
}

export default PorkbunDomainProvider;
