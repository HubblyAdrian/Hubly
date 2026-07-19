/**
 * Premium recommendation matching.
 * Hubly does the research — return a few high-confidence options with roles + why.
 * Marketplace score stays internal; customers see natural-language confidence.
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
  scope?: string | null;
  notes?: string | null;
};

export type RecommendationRole =
  | "Best Overall"
  | "Best Value"
  | "Fastest Availability"
  | "Top Specialist"
  | "Strong Local Fit";

export type MatchCard = {
  provider_id: string;
  business_id: string;
  name: string;
  slug: string | null;
  tagline: string | null;
  hero_photo: string | null;
  logo_url: string | null;
  verified: boolean;
  rating: number | null;
  review_count: number;
  starting_at: number | null;
  available_label: string;
  distance_label: string | null;
  instant_book: boolean;
  years_in_business: number | null;
  role: RecommendationRole | null;
  confidence_label: "Hubly Match" | "Excellent Match" | "Recommended for your job";
  summary: string;
  why: string[];
  cta: "Book Now" | "Request Booking" | "Schedule Service";
  /** Internal only — never display to customers */
  _internal: {
    score: number;
    marketplace_score: number;
    completion_rate: number | null;
    calendar_connected: boolean;
    category: string | null;
  };
  /** @deprecated kept for older clients — do not show in UI */
  match_percent?: number;
};

type ScoredRow = {
  card: MatchCard;
  score: number;
  availRank: number; // lower = sooner
  price: number | null;
  specialization: number;
  local: boolean;
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
  if (!n) return false;
  if (normalize(profile.city).includes(n) || n.includes(normalize(profile.city))) return true;
  const cities = profile.service_area?.cities || [];
  return cities.some((c) => normalize(c).includes(n) || n.includes(normalize(c)));
}

function startingPrice(packages: Array<Record<string, unknown>>): number | null {
  const prices = packages
    .map((p) => Number(p.price ?? p.startingPrice ?? p.amount))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}

function firstPhoto(
  profile: { photos?: unknown[]; banner_url?: string | null; logo_url?: string | null },
): string | null {
  const photos = profile.photos || [];
  for (const p of photos) {
    if (typeof p === "string" && p.startsWith("http")) return p;
    if (p && typeof p === "object") {
      const row = p as Record<string, unknown>;
      const url = String(row.url || row.after || row.src || row.image || "").trim();
      if (url.startsWith("http")) return url;
    }
  }
  if (profile.banner_url && String(profile.banner_url).startsWith("http")) {
    return String(profile.banner_url);
  }
  return null;
}

function yearsInBusiness(meta: Record<string, unknown>, website: Record<string, unknown>): number | null {
  const candidates = [
    meta.yearsInBusiness,
    meta.years_in_business,
    website.yearsInBusiness,
    website.years_in_business,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0 && n < 120) return Math.round(n);
  }
  const founded = meta.foundedYear || website.foundedYear || meta.yearStarted;
  const y = Number(founded);
  if (Number.isFinite(y) && y >= 1900 && y <= new Date().getFullYear()) {
    return Math.max(1, new Date().getFullYear() - y);
  }
  return null;
}

function availableLabel(avail: ReturnType<typeof getAvailability> | null, when?: string | null): string {
  if (!avail?.nextAvailable) return "Ask about availability";
  const next = avail.nextAvailable.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (next === today) return "Available today";
  if (next === tomorrow) return "Available tomorrow";
  if (when && when.length >= 10 && next === when.slice(0, 10)) return `Available ${next}`;
  return `Next opening ${next}`;
}

function availRank(avail: ReturnType<typeof getAvailability> | null): number {
  if (!avail?.nextAvailable) return 9999;
  const next = Date.parse(avail.nextAvailable.slice(0, 10));
  if (!Number.isFinite(next)) return 9999;
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  return Math.max(0, Math.round((next - today) / 86400000));
}

function confidenceLabel(score: number): MatchCard["confidence_label"] {
  if (score >= 85) return "Excellent Match";
  if (score >= 70) return "Hubly Match";
  return "Recommended for your job";
}

function distanceLabel(
  needCity: string | null | undefined,
  profile: { city?: string | null; service_area?: { cities?: string[]; radius_miles?: number | null } },
  local: boolean,
): string | null {
  if (local && profile.city) return `Serves ${profile.city}`;
  if (local) return "Serves your neighborhood";
  const radius = profile.service_area?.radius_miles;
  if (radius != null && Number.isFinite(Number(radius))) {
    return `Within about ${Math.round(Number(radius))} miles`;
  }
  if (needCity && profile.city) return `${profile.city} area`;
  if (profile.city) return profile.city;
  return null;
}

function buildWhy(opts: {
  role: RecommendationRole | null;
  cat: string;
  need: MatchNeed;
  availLabel: string;
  instant: boolean;
  completion: number | null;
  rating: number | null;
  reviewCount: number;
  local: boolean;
  residential: boolean | null;
  price: number | null;
  isLowestPrice: boolean;
  isFastest: boolean;
  years: number | null;
}): string[] {
  const why: string[] = [];
  const catLabel = opts.cat.replace(/-/g, " ") || "your service";

  if (opts.isFastest || /today|tomorrow/i.test(opts.availLabel)) {
    why.push(opts.availLabel);
  } else if (opts.availLabel && !/ask about/i.test(opts.availLabel)) {
    why.push(opts.availLabel);
  }

  if (opts.need.residential === true || /residential|home/i.test(opts.need.service_text || "")) {
    why.push("Specializes in residential homes");
  } else if (opts.cat) {
    why.push(`Specializes in ${catLabel}`);
  }

  if (opts.completion != null && opts.completion >= 90) {
    why.push("Excellent completion history");
  } else if (opts.rating != null && opts.rating >= 4.7) {
    why.push("Highly rated by local customers");
  } else if (opts.reviewCount >= 3) {
    why.push("Trusted by repeat local customers");
  }

  if (opts.instant) why.push("Instant Book enabled");
  if (opts.isLowestPrice && opts.price != null) why.push("Lowest starting price among matches");
  if (opts.local) why.push("Serves your neighborhood");
  if (opts.years != null && opts.years >= 3) why.push(`${opts.years}+ years in business`);

  // Role-tuned extras
  if (opts.role === "Best Value" && !why.some((w) => /price|rated/i.test(w))) {
    why.push("Flexible scheduling");
  }
  if (opts.role === "Fastest Availability" && opts.instant && !why.includes("Instant Book enabled")) {
    why.push("Responds quickly");
  }

  const unique = [...new Set(why)].slice(0, 4);
  if (!unique.length) unique.push("Verified Hubly marketplace provider");
  return unique;
}

function roleSummary(role: RecommendationRole | null, why: string[]): string {
  if (role === "Best Overall") {
    return why.slice(0, 3).join(" · ") || "Strong overall fit for your job.";
  }
  if (role === "Best Value") {
    return why.slice(0, 3).join(" · ") || "Great balance of price and quality.";
  }
  if (role === "Fastest Availability") {
    return why.slice(0, 3).join(" · ") || "The quickest path to getting this done.";
  }
  if (role === "Top Specialist") {
    return why.slice(0, 3).join(" · ") || "Focused experience for this type of job.";
  }
  return why.slice(0, 3).join(" · ") || "A solid fit based on your request.";
}

function assignRoles(rows: ScoredRow[]): void {
  if (!rows.length) return;

  // Best Overall = highest score
  rows[0].card.role = "Best Overall";

  // Fastest Availability among top set
  let fastestIdx = -1;
  let bestAvail = Infinity;
  rows.forEach((r, i) => {
    if (r.availRank < bestAvail) {
      bestAvail = r.availRank;
      fastestIdx = i;
    }
  });
  if (fastestIdx > 0 && bestAvail < 9999) {
    rows[fastestIdx].card.role = "Fastest Availability";
  } else if (fastestIdx === 0 && rows.length > 1 && bestAvail <= 1) {
    // Keep Best Overall; give Fastest to next-soonest if distinct
    let second = -1;
    let secondAvail = Infinity;
    rows.forEach((r, i) => {
      if (i === 0) return;
      if (r.availRank < secondAvail) {
        secondAvail = r.availRank;
        second = i;
      }
    });
    if (second >= 0 && secondAvail < 9999) {
      rows[second].card.role = "Fastest Availability";
    }
  }

  // Best Value = lowest price among those with a price, preferring high score
  let valueIdx = -1;
  let bestPrice = Infinity;
  rows.forEach((r, i) => {
    if (r.price == null) return;
    if (r.card.role) return; // don't overwrite Best Overall / Fastest if already set... actually Best Overall can also be Best Value? Prefer distinct roles
    if (r.price < bestPrice || (r.price === bestPrice && r.score > (rows[valueIdx]?.score || 0))) {
      bestPrice = r.price;
      valueIdx = i;
    }
  });
  // Allow Best Value on unassigned; if only Best Overall has price, assign Best Value to next cheapest
  if (valueIdx < 0) {
    rows.forEach((r, i) => {
      if (r.price == null || i === 0) return;
      if (r.price < bestPrice) {
        bestPrice = r.price;
        valueIdx = i;
      }
    });
  }
  if (valueIdx > 0 && !rows[valueIdx].card.role) {
    rows[valueIdx].card.role = "Best Value";
  } else if (valueIdx === 0 && rows.length > 1) {
    // find second-cheapest for Best Value so Best Overall stays unique
    let alt = -1;
    let altPrice = Infinity;
    rows.forEach((r, i) => {
      if (i === 0 || r.price == null || r.card.role) return;
      if (r.price < altPrice) {
        altPrice = r.price;
        alt = i;
      }
    });
    if (alt >= 0) rows[alt].card.role = "Best Value";
  }

  // Remaining top recommendations get specialist / local labels
  for (const r of rows) {
    if (r.card.role) continue;
    if (r.specialization >= 14) r.card.role = "Top Specialist";
    else if (r.local) r.card.role = "Strong Local Fit";
    else r.card.role = "Strong Local Fit";
  }
}

export type RankInput = {
  need: MatchNeed;
  providers: Array<{
    provider: Record<string, unknown>;
    business: Record<string, unknown>;
    availability?: ReturnType<typeof getAvailability> | null;
  }>;
  /** Primary recommendations shown first (default 3) */
  primary_limit?: number;
  /** Total pool before browse-more split (default 6) */
  total_limit?: number;
};

export function rankMarketplaceMatches(input: RankInput): {
  headline: string;
  subhead: string;
  recommendations: MatchCard[];
  more_providers: MatchCard[];
  more_label: string;
  /** @deprecated alias of recommendations + more for older clients */
  matches: MatchCard[];
  need: MatchNeed;
} {
  const primaryLimit = Math.min(3, Math.max(1, Number(input.primary_limit) || 3));
  const totalLimit = Math.min(8, Math.max(primaryLimit, Number(input.total_limit) || 6));
  const need = input.need || {};
  const scored: ScoredRow[] = [];

  for (const row of input.providers) {
    const life = buildLifecycleSnapshot(row.provider);
    if (!life.is_public || !life.can_accept_leads) continue;

    const pub = assembleProviderPublic(row.provider, row.business);
    const profile = pub.profile;
    const packages = (profile.packages || []) as Array<Record<string, unknown>>;
    const meta = (row.business.meta || {}) as Record<string, unknown>;
    const website = (meta.website || {}) as Record<string, unknown>;

    let score = 40;
    let specialization = 0;
    const cat = String(pub.category || profile.business_type || "");
    const svcText = need.service_text || "";

    if (need.category && normalize(cat) === normalize(need.category)) {
      score += 18;
      specialization = 18;
    } else if (textMatchesCategory(svcText, cat)) {
      score += 14;
      specialization = 14;
    } else if (need.scope && textMatchesCategory(need.scope, cat)) {
      score += 10;
      specialization = 10;
    }

    const local = cityMatch(need.city, profile);
    if (local) score += 14;

    const avail = row.availability || null;
    const aRank = availRank(avail);
    if (life.can_accept_leads && avail?.available) score += 14;
    else if (avail?.nextAvailable) score += Math.max(4, 12 - Math.min(aRank, 8));

    const instant = life.can_instant_book;
    if (instant) score += 10;

    const mq = Number(pub.marketplace_score || 0);
    score += Math.min(12, Math.round(mq / 10));

    const completion = pub.completion_rate != null ? Number(pub.completion_rate) : null;
    if (completion != null && completion >= 90) score += 8;
    else if (completion != null && completion >= 75) score += 4;

    const reviews = (profile.reviews || []) as unknown[];
    const rating = website.rating != null ? Number(website.rating) : null;
    const reviewCount = Number(website.reviewCount || reviews.length || 0);
    if (rating != null && rating >= 4.7) score += 6;
    else if (rating != null && rating >= 4.3) score += 3;
    else if (reviews.length >= 3) score += 3;

    if (pub.calendar_connected) score += 4;

    // Residential preference soft boost when packages mention residential
    if (need.residential === true) {
      const packText = packages.map((p) => normalize(p.name || p.title || "")).join(" ");
      if (/residential|home|house/.test(packText) || /residential|home/.test(normalize(profile.tagline))) {
        score += 5;
      }
    }

    const start = startingPrice(packages);
    const years = yearsInBusiness(meta, website);
    const availLabel = availableLabel(avail, need.when);
    const conf = confidenceLabel(score);

    const card: MatchCard = {
      provider_id: String(pub.id),
      business_id: String(pub.business_id),
      name: String(profile.name || "Provider"),
      slug: profile.slug ? String(profile.slug) : null,
      tagline: profile.tagline ? String(profile.tagline) : null,
      hero_photo: firstPhoto(profile),
      logo_url: profile.logo_url ? String(profile.logo_url) : null,
      verified: life.status === "verified",
      rating: rating != null && Number.isFinite(rating) ? rating : null,
      review_count: reviewCount,
      starting_at: start,
      available_label: availLabel,
      distance_label: distanceLabel(need.city, profile, local),
      instant_book: instant,
      years_in_business: years,
      role: null,
      confidence_label: conf,
      summary: "",
      why: [],
      cta: instant ? "Book Now" : "Request Booking",
      _internal: {
        score,
        marketplace_score: mq,
        completion_rate: completion,
        calendar_connected: !!pub.calendar_connected,
        category: pub.category ? String(pub.category) : null,
      },
      match_percent: Math.max(55, Math.min(99, Math.round(score))),
    };

    scored.push({
      card,
      score,
      availRank: aRank,
      price: start,
      specialization,
      local,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.availRank - b.availRank);
  const pool = scored.slice(0, totalLimit);

  // Price extrema for why lines
  const priced = pool.filter((r) => r.price != null);
  const lowestPrice = priced.length ? Math.min(...priced.map((r) => r.price as number)) : null;
  let fastestRank = Infinity;
  for (const r of pool) if (r.availRank < fastestRank) fastestRank = r.availRank;

  assignRoles(pool);

  for (const r of pool) {
    const isLowest = lowestPrice != null && r.price === lowestPrice;
    const isFastest = r.availRank === fastestRank && fastestRank < 9999;
    r.card.why = buildWhy({
      role: r.card.role,
      cat: String(r.card._internal.category || ""),
      need,
      availLabel: r.card.available_label,
      instant: r.card.instant_book,
      completion: r.card._internal.completion_rate,
      rating: r.card.rating,
      reviewCount: r.card.review_count,
      local: r.local,
      residential: need.residential ?? null,
      price: r.price,
      isLowestPrice: isLowest,
      isFastest,
      years: r.card.years_in_business,
    });
    r.card.summary = roleSummary(r.card.role, r.card.why);
  }

  const recommendations = pool.slice(0, primaryLimit).map((s) => s.card);
  const more_providers = pool.slice(primaryLimit).map((s) => {
    // Browse-more: softer role — keep confidence, clear primary role emphasis
    return s.card;
  });

  const headline = recommendations.length
    ? "We found your best matches."
    : "We couldn’t find a strong match yet — try a bit more detail.";
  const subhead = recommendations.length
    ? "Hubly already narrowed this down — here’s who we’d book for your job."
    : "Add a city, timing, or a bit more detail and I’ll try again.";

  return {
    headline,
    subhead,
    recommendations,
    more_providers,
    more_label: "We found a few more providers that may also be a good fit.",
    matches: [...recommendations, ...more_providers],
    need,
  };
}
