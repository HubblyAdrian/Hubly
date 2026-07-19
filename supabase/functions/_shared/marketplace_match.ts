/**
 * AI-first marketplace matching.
 * Returns 3–5 best providers with explicit "why" reasons — never a search dump.
 */

import { getAvailability } from "./marketplace_availability.ts";
import { buildLifecycleSnapshot } from "./marketplace_lifecycle.ts";
import { assembleProviderPublic } from "./marketplace_provider.ts";

export type MatchNeed = {
  category?: string | null;
  service_text?: string | null;
  city?: string | null;
  when?: string | null; // ISO date or "asap" | "flexible"
  residential?: boolean | null;
  notes?: string | null;
};

export type MatchCard = {
  provider_id: string;
  business_id: string;
  name: string;
  slug: string | null;
  rating: number | null;
  review_count: number;
  available_label: string;
  starting_at: number | null;
  match_percent: number;
  why: string[];
  cta: "Book Now" | "Request Booking" | "Schedule Service";
  instant_book: boolean;
  document_summary: {
    category: string | null;
    marketplace_score: number;
    calendar_connected: boolean;
    completion_rate: number | null;
    cities: string[];
  };
};

function normalize(s: unknown): string {
  return String(s || "").toLowerCase().trim();
}

function categoryAliases(cat: string): string[] {
  const c = normalize(cat);
  const map: Record<string, string[]> = {
    windows: ["window", "windows", "glass"],
    detailing: ["detail", "detailing", "car wash", "auto detail", "truck"],
    photography: ["photo", "photographer", "wedding", "portrait"],
    hvac: ["hvac", "ac", "air conditioning", "furnace", "heating"],
    "lawn-care": ["lawn", "grass", "yard", "mowing"],
    "pressure-washing": ["pressure", "power wash", "driveway", "oil stain"],
    "house-cleaning": ["cleaning", "house clean", "maid"],
    spa: ["spa", "massage", "facial"],
  };
  return map[c] || [c];
}

function textMatchesCategory(text: string, category: string | null | undefined): boolean {
  if (!category) return false;
  const t = normalize(text);
  return categoryAliases(category).some((a) => t.includes(a) || normalize(category).includes(a));
}

function cityMatch(
  needCity: string | null | undefined,
  profile: { city?: string | null; service_area?: { cities?: string[] } },
): boolean {
  if (!needCity) return false;
  const n = normalize(needCity);
  if (normalize(profile.city).includes(n) || n.includes(normalize(profile.city))) return true;
  const cities = profile.service_area?.cities || [];
  return cities.some((c) => normalize(c).includes(n) || n.includes(normalize(c)));
}

function startingPrice(packages: Array<Record<string, unknown>>): number | null {
  const prices = packages
    .map((p) => Number(p.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}

function availableLabel(avail: ReturnType<typeof getAvailability> | null, when?: string | null): string {
  if (!avail?.nextAvailable) return "Check availability";
  const next = avail.nextAvailable.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (next === today) return "Available today";
  if (next === tomorrow) return "Available tomorrow";
  if (when && when.length >= 10 && next === when.slice(0, 10)) return `Available ${next}`;
  return `Next opening ${next}`;
}

export type RankInput = {
  need: MatchNeed;
  providers: Array<{
    provider: Record<string, unknown>;
    business: Record<string, unknown>;
    availability?: ReturnType<typeof getAvailability> | null;
  }>;
  limit?: number;
};

/**
 * Score and return top 3–5 matches with human-readable why lines.
 */
export function rankMarketplaceMatches(input: RankInput): {
  headline: string;
  matches: MatchCard[];
  need: MatchNeed;
} {
  // Cap at 5; prefer up to 5 when available (UI shows whatever we find, typically 3–5)
  const limit = Math.min(5, Math.max(1, Number(input.limit) || 5));
  const need = input.need || {};
  const scored: Array<{ card: MatchCard; score: number }> = [];

  for (const row of input.providers) {
    const life = buildLifecycleSnapshot(row.provider);
    if (!life.is_public || !life.can_accept_leads) continue;

    const pub = assembleProviderPublic(row.provider, row.business);
    const profile = pub.profile;
    const packages = (profile.packages || []) as Array<Record<string, unknown>>;
    const why: string[] = [];
    let score = 40; // base for being verified + accepting

    // Specialization / category
    const cat = String(pub.category || profile.business_type || "");
    const svcText = need.service_text || "";
    if (need.category && normalize(cat) === normalize(need.category)) {
      score += 18;
      why.push(`Specializes in ${cat.replace(/-/g, " ")}`);
    } else if (textMatchesCategory(svcText, cat)) {
      score += 14;
      why.push(`Strong fit for “${svcText.slice(0, 48)}”`);
    }

    // Distance / neighborhood
    if (cityMatch(need.city, profile)) {
      score += 14;
      why.push(
        profile.city
          ? `Serves your area (${profile.city})`
          : "Serves your neighborhood",
      );
    }

    // Availability
    const avail = row.availability || null;
    const marketplaceAccepting = life.can_accept_leads;
    if (marketplaceAccepting && avail?.available) {
      score += 12;
      why.push(availableLabel(avail, need.when));
    } else if (avail?.nextAvailable) {
      score += 6;
      why.push(availableLabel(avail, need.when));
    }

    // Instant book
    if (life.can_instant_book) {
      score += 10;
      why.push("Instant Book enabled");
    }

    // Quality score
    const mq = Number(pub.marketplace_score || 0);
    score += Math.min(12, Math.round(mq / 10));
    if (mq >= 70) why.push("High marketplace quality score");

    // Completion / reviews
    const completion = pub.completion_rate != null ? Number(pub.completion_rate) : null;
    if (completion != null && completion >= 90) {
      score += 8;
      why.push(`Excellent completion rate (${completion}%)`);
    }
    const meta = (row.business.meta || {}) as Record<string, unknown>;
    const website = (meta.website || {}) as Record<string, unknown>;
    const reviews = (profile.reviews || []) as unknown[];
    const rating = website.rating != null ? Number(website.rating) : null;
    const reviewCount = Number(website.reviewCount || reviews.length || 0);
    if (rating != null && rating >= 4.7) {
      score += 6;
      why.push(`Top-rated (${rating}★)`);
    } else if (reviews.length >= 3) {
      score += 3;
      why.push("Trusted by local customers");
    }

    // Calendar reliability
    if (pub.calendar_connected) {
      score += 4;
      why.push("Live calendar for reliable scheduling");
    }

    // Deduplicate / trim why
    const whyUnique = [...new Set(why)].slice(0, 4);
    if (!whyUnique.length) whyUnique.push("Verified Hubly marketplace provider");

    const matchPercent = Math.max(55, Math.min(99, Math.round(score)));
    const instant = life.can_instant_book;
    const start = startingPrice(packages);

    scored.push({
      score,
      card: {
        provider_id: String(pub.id),
        business_id: String(pub.business_id),
        name: String(profile.name || "Provider"),
        slug: profile.slug ? String(profile.slug) : null,
        rating: rating != null && Number.isFinite(rating) ? rating : null,
        review_count: reviewCount,
        available_label: availableLabel(avail, need.when),
        starting_at: start,
        match_percent: matchPercent,
        why: whyUnique,
        cta: instant ? "Book Now" : "Request Booking",
        instant_book: instant,
        document_summary: {
          category: pub.category ? String(pub.category) : null,
          marketplace_score: mq,
          calendar_connected: !!pub.calendar_connected,
          completion_rate: completion,
          cities: (profile.service_area?.cities || []).map(String),
        },
      },
    });
  }

  scored.sort((a, b) => b.score - a.score || b.card.match_percent - a.card.match_percent);
  const matches = scored.slice(0, limit).map((s) => s.card);

  return {
    headline: matches.length
      ? "We found your best matches."
      : "We couldn’t find a strong match yet — try a bit more detail.",
    matches,
    need,
  };
}
