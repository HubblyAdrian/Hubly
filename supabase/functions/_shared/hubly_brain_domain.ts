/**
 * Hubly Runtime — Domain capability (suggestion foundation)
 *
 * After the website is built, suggest intelligent domain options.
 * One-click purchase lands later — this only recommends availability.
 */

export type HublyDomainSuggestion = {
  domain: string;
  /** Soft availability — real registrar check lands with purchase */
  availability: "likely_available" | "check_required" | "likely_taken";
  reason: string;
};

export type HublyDomainResult = {
  preferred: string | null;
  suggestions: HublyDomainSuggestion[];
  purchaseReady: false;
  note: string;
};

function slugBase(name: string): string {
  return String(name || "mybusiness")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 28) || "mybusiness";
}

function words(name: string): string[] {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Generate intelligent domain recommendations from the business name. */
export function suggestDomains(opts: {
  businessName?: string | null;
  industry?: string | null;
  city?: string | null;
}): HublyDomainResult {
  const name = String(opts.businessName || "My Business").trim();
  const base = slugBase(name);
  const parts = words(name);
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

  const candidates: Array<{ domain: string; reason: string }> = [
    { domain: `${base}.com`, reason: "Exact match — strongest brand signal" },
    { domain: `get${base}.com`, reason: "Action-oriented — easy to say aloud" },
    { domain: `${base}.co`, reason: "Short modern alternative" },
    { domain: `${base.replace(/(inc|llc|co)$/i, "")}${serviceWord}.com`.replace(/\.+/g, "."), reason: "Service-forward for local search" },
  ];

  if (opts.city) {
    const city = slugBase(opts.city);
    candidates.push({
      domain: `${base}${city}.com`,
      reason: `Local SEO — ties brand to ${opts.city}`,
    });
  }

  if (short !== base && short.length >= 4) {
    candidates.push({
      domain: `${short}.com`,
      reason: "Compact brandable option",
    });
  }

  const seen = new Set<string>();
  const suggestions: HublyDomainSuggestion[] = candidates
    .filter((c) => {
      const d = c.domain.replace(/\.+/g, ".").replace(/^\./, "");
      if (seen.has(d) || d.length < 5) return false;
      seen.add(d);
      return true;
    })
    .slice(0, 5)
    .map((c, i) => ({
      domain: c.domain.replace(/\.+/g, "."),
      availability: i === 0 ? "check_required" as const : "likely_available" as const,
      reason: c.reason,
    }));

  return {
    preferred: suggestions[0]?.domain || null,
    suggestions,
    purchaseReady: false,
    note:
      "Your own domain makes the business feel real — customers trust yourbusiness.com more than a temporary app link. Suggestions only for now; one-click purchase, DNS, and SSL come next.",
  };
}

export const HublyDomain = { suggestDomains };
export default HublyDomain;
