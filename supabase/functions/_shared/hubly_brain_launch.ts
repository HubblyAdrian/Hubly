/**
 * Business Launch — make a business real
 *
 * Domain suggestions + DomainConnector contract + DNS/SSL/publish steps.
 * Registrar vendor intentionally NOT chosen yet.
 */

import type { DomainConnector, DomainCheck, DomainCandidate } from "./hubly_connector_domain.ts";
import { generateDomainCandidates, getDomainConnector } from "./hubly_connector_domain.ts";
import type { HublyConnectorResult } from "./hubly_connectors.ts";

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
  experience: {
    headline: string;
    subhead: string;
    whyItMatters: string;
    cta: string;
  };
  connection: {
    id: string;
    connected: boolean;
    missing: string[];
    status: string;
    message: string;
  };
  /** @deprecated use connection — kept for Instant Site compatibility */
  provider: {
    id: string;
    configured: boolean;
    missing: string[];
    status: string;
    message: string;
  };
  preferred: string | null;
  suggestions: HublyLaunchSuggestion[];
  purchaseReady: boolean;
  steps: Array<{
    id: string;
    label: string;
    status: "ready" | "blocked" | "pending" | "done";
    detail: string;
  }>;
  note: string;
};

export function resolveDomainConnector(): DomainConnector {
  return getDomainConnector();
}

/** @deprecated use resolveDomainConnector */
export function resolveDomainProvider(): DomainConnector {
  return resolveDomainConnector();
}

export async function runBusinessLaunchDomain(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
  connector?: DomainConnector | null;
}): Promise<HublyBusinessLaunchResult> {
  const connector = opts.connector || resolveDomainConnector();
  const candidates = generateDomainCandidates({
    businessName: opts.businessName,
    industry: opts.industry,
    city: opts.city,
  });

  const missing = connector.missingConnection();
  const connected = connector.isConnected();

  let checks: DomainCheck[] = [];
  let connectionMessage = connected
    ? `Using ${connector.id}`
    : "Domain connection required";
  let connectionStatus = connected ? "connected" : "connection_required";

  if (!connected) {
    checks = candidates.map((c) => ({
      domain: c.domain,
      availability: "connection_required" as const,
      reason: connectionMessage,
    }));
  } else {
    const batch: HublyConnectorResult<DomainCheck[]> = await connector.searchAvailabilityBatch(
      candidates.map((c) => c.domain),
    );
    connectionStatus = batch.status;
    connectionMessage = batch.message;
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
  const purchaseReady = available.length > 0 && connected;

  const steps: HublyBusinessLaunchResult["steps"] = [
    {
      id: "identity",
      label: "Business Identity",
      status: "done",
      detail: "Name, brand, and voice from Memory + DNA",
    },
    {
      id: "availability",
      label: "Domain availability",
      status: !connected ? "blocked" : available.length ? "done" : "pending",
      detail: connectionMessage,
    },
    {
      id: "purchase",
      label: "Domain purchase",
      status: purchaseReady ? "ready" : "blocked",
      detail: purchaseReady
        ? "Ready when owner confirms"
        : "Requires Domain connection + available domain",
    },
    {
      id: "dns",
      label: "DNS",
      status: "blocked",
      detail: "Via Domain Connector configureDNS()",
    },
    {
      id: "ssl",
      label: "SSL",
      status: "blocked",
      detail: "Via Domain Connector ensureSsl()",
    },
    {
      id: "publish",
      label: "Website publishing",
      status: "pending",
      detail: "Website Runtime publishes the live site",
    },
    {
      id: "indexing",
      label: "Search indexing",
      status: "pending",
      detail: "Sitemap + robots + schema foundation on publish",
    },
  ];

  const cta = purchaseReady
    ? "Choose a domain to purchase"
    : connected
    ? "No available domains yet — try another name"
    : "Domain connection required to check real availability";

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
      id: connector.id,
      connected,
      missing,
      status: connectionStatus,
      message: connectionMessage,
    },
    provider: {
      id: connector.id,
      configured: connected,
      missing,
      status: connectionStatus,
      message: connectionMessage,
    },
    preferred,
    suggestions,
    purchaseReady,
    steps,
    note: connected
      ? "Live domain connection — availability is real."
      : "Domain connector contract ready. Registrar not chosen yet — Domain connection required.",
  };
}

export const HublyBusinessLaunch = {
  resolveDomainConnector,
  resolveDomainProvider,
  runDomain: runBusinessLaunchDomain,
  generateCandidates: generateDomainCandidates,
};

export default HublyBusinessLaunch;
