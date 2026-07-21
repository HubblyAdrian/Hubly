/**
 * CloudflareProvider — DomainProvider implementation
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN   — API token with Registrar + Zone DNS permissions
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare account id
 *
 * Production-First: if env missing → Provider not configured (never fake available).
 * Registrar availability uses Cloudflare Registrar API when configured.
 * DNS/SSL use Zone APIs when a zone exists.
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

const PROVIDER_ID = "cloudflare";

async function cfFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; json: T & { success?: boolean; errors?: Array<{ message?: string }> } }> {
  const token = envTruthy("CLOUDFLARE_API_TOKEN");
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN missing");
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({})) as T & {
    success?: boolean;
    errors?: Array<{ message?: string }>;
  };
  return { ok: res.ok && json.success !== false, status: res.status, json };
}

export class CloudflareDomainProvider implements DomainProvider {
  readonly id = PROVIDER_ID;

  missingEnv(): string[] {
    const missing: string[] = [];
    if (!envTruthy("CLOUDFLARE_API_TOKEN")) missing.push("CLOUDFLARE_API_TOKEN");
    if (!envTruthy("CLOUDFLARE_ACCOUNT_ID")) missing.push("CLOUDFLARE_ACCOUNT_ID");
    return missing;
  }

  isConfigured(): boolean {
    return this.missingEnv().length === 0;
  }

  async checkAvailability(domain: string): Promise<HublyProviderResult<DomainCheck>> {
    const missing = this.missingEnv();
    if (missing.length) {
      return providerNotConfigured(PROVIDER_ID, missing);
    }
    const accountId = envTruthy("CLOUDFLARE_ACCOUNT_ID")!;
    const clean = String(domain || "").trim().toLowerCase();
    if (!clean || !clean.includes(".")) {
      return providerError(PROVIDER_ID, "INVALID_DOMAIN", "Domain name is invalid");
    }

    try {
      // Cloudflare Registrar — get domain / check via accounts registrar endpoint
      const path =
        `/accounts/${accountId}/registrar/domains/${encodeURIComponent(clean)}`;
      const { ok, status, json } = await cfFetch<{
        result?: { available?: boolean; name?: string };
      }>(path);

      if (status === 404) {
        // Some CF accounts return 404 when domain isn't in registrar catalog —
        // treat as unknown, never invent "available".
        return providerOk(PROVIDER_ID, {
          domain: clean,
          availability: "unknown" as const,
          reason: "Cloudflare did not return availability for this TLD",
        }, "Availability unknown for this domain", { httpStatus: status });
      }

      if (!ok) {
        const detail = json.errors?.[0]?.message || `Cloudflare error (${status})`;
        return providerError(PROVIDER_ID, "CLOUDFLARE_API_ERROR", detail, {
          retryable: status >= 500,
          meta: { httpStatus: status },
        });
      }

      const available = json.result?.available === true;
      const unavailable = json.result?.available === false;
      return providerOk(PROVIDER_ID, {
        domain: clean,
        availability: available ? "available" : unavailable ? "unavailable" : "unknown",
        reason: available
          ? "Available via Cloudflare Registrar"
          : unavailable
          ? "Not available"
          : "Cloudflare did not confirm availability",
      }, available ? "Domain available" : unavailable ? "Domain unavailable" : "Availability unknown");
    } catch (e) {
      return providerError(
        PROVIDER_ID,
        "CLOUDFLARE_REQUEST_FAILED",
        e instanceof Error ? e.message : "Cloudflare request failed",
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
      else {
        checks.push({
          domain: d,
          availability: "unknown",
          reason: r.message || "Check failed",
        });
      }
    }
    return providerOk(PROVIDER_ID, checks, `Checked ${checks.length} domains`);
  }

  async purchaseDomain(
    input: DomainPurchaseInput,
  ): Promise<HublyProviderResult<DomainPurchaseResult>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    const accountId = envTruthy("CLOUDFLARE_ACCOUNT_ID")!;
    const domain = String(input.domain || "").trim().toLowerCase();
    try {
      const { ok, status, json } = await cfFetch<{ result?: { id?: string } }>(
        `/accounts/${accountId}/registrar/domains/${encodeURIComponent(domain)}`,
        {
          method: "POST",
          body: {
            name: domain,
            years: input.years || 1,
            auto_renew: true,
          },
        },
      );
      if (!ok) {
        return providerError(
          PROVIDER_ID,
          "PURCHASE_FAILED",
          json.errors?.[0]?.message || `Purchase failed (${status})`,
          { retryable: status >= 500, meta: { domain, businessId: input.businessId } },
        );
      }
      return providerOk(PROVIDER_ID, {
        domain,
        orderId: String(json.result?.id || domain),
        status: "purchased" as const,
      }, `Purchased ${domain}`);
    } catch (e) {
      return providerError(
        PROVIDER_ID,
        "PURCHASE_REQUEST_FAILED",
        e instanceof Error ? e.message : "Purchase request failed",
        { retryable: true },
      );
    }
  }

  async ensureDns(
    records: DnsRecordInput[],
  ): Promise<HublyProviderResult<{ applied: number }>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    if (!records.length) {
      return providerOk(PROVIDER_ID, { applied: 0 }, "No DNS records to apply");
    }
    // Zone resolution + record upsert — production path when zone exists.
    // Without a zone id we fail honestly rather than pretend DNS is live.
    const zoneId = envTruthy("CLOUDFLARE_ZONE_ID");
    if (!zoneId) {
      return providerNotConfigured(PROVIDER_ID, ["CLOUDFLARE_ZONE_ID"]);
    }
    let applied = 0;
    try {
      for (const rec of records) {
        const { ok, status, json } = await cfFetch(`/zones/${zoneId}/dns_records`, {
          method: "POST",
          body: {
            type: rec.type,
            name: rec.name,
            content: rec.content,
            ttl: rec.ttl || 1,
            proxied: rec.proxied !== false && (rec.type === "A" || rec.type === "CNAME"),
          },
        });
        if (!ok) {
          return providerError(
            PROVIDER_ID,
            "DNS_APPLY_FAILED",
            json.errors?.[0]?.message || `DNS apply failed (${status})`,
            { retryable: status >= 500 },
          );
        }
        applied++;
      }
      return providerOk(PROVIDER_ID, { applied }, `Applied ${applied} DNS records`);
    } catch (e) {
      return providerError(
        PROVIDER_ID,
        "DNS_REQUEST_FAILED",
        e instanceof Error ? e.message : "DNS request failed",
        { retryable: true },
      );
    }
  }

  async ensureSsl(domain: string): Promise<HublyProviderResult<SslResult>> {
    const missing = this.missingEnv();
    if (missing.length) return providerNotConfigured(PROVIDER_ID, missing);
    const zoneId = envTruthy("CLOUDFLARE_ZONE_ID");
    if (!zoneId) {
      return providerNotConfigured(PROVIDER_ID, ["CLOUDFLARE_ZONE_ID"]);
    }
    try {
      const { ok, status, json } = await cfFetch<{
        result?: { value?: string };
      }>(`/zones/${zoneId}/settings/ssl`);
      if (!ok) {
        return providerError(
          PROVIDER_ID,
          "SSL_STATUS_FAILED",
          json.errors?.[0]?.message || `SSL status failed (${status})`,
          { retryable: status >= 500 },
        );
      }
      const mode = String(json.result?.value || "unknown");
      return providerOk(PROVIDER_ID, {
        domain,
        status: mode === "off" ? "pending" as const : "active" as const,
        issuer: "cloudflare",
      }, `SSL mode: ${mode}`);
    } catch (e) {
      return providerError(
        PROVIDER_ID,
        "SSL_REQUEST_FAILED",
        e instanceof Error ? e.message : "SSL request failed",
        { retryable: true },
      );
    }
  }
}

export function createCloudflareDomainProvider(): CloudflareDomainProvider {
  return new CloudflareDomainProvider();
}

export default CloudflareDomainProvider;
