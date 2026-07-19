/**
 * Phase 3 — Recommendation engine.
 * Feel like a trusted local expert, not an algorithm sorting providers.
 * Answer: "Why should I book this business instead of the others?"
 * Hierarchy implies the rest: Best Overall → Fastest → Best Value → Browse More.
 */

import { getAvailability } from "./marketplace_availability.ts";
import {
  EMPTY_PREFERENCES,
  type CustomerPreferences,
} from "./marketplace_industry_knowledge.ts";
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
  /** Structured job understanding from concierge */
  service?: string | null;
  add_ons?: string[] | null;
  priority?: string | null;
  preferences?: Partial<CustomerPreferences> | null;
  duration_estimate?: string | null;
  vehicle_type?: string | null;
};

export type RecommendationRole =
  | "Best Overall"
  | "Fastest"
  | "Best Value"
  | "Top Specialist"
  | "Strong Local Fit";

export type TrustIndicators = {
  verified: boolean;
  insured: boolean;
  licensed: boolean;
  jobs_completed: number | null;
  repeat_customers: string | null;
  avg_response: string | null;
  cancellation_rate: number | null;
  instant_book: boolean;
};

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
  specialist_label: string | null;
  trust: TrustIndicators;
  confidence_label: "Hubly Match" | "Excellent Match" | "Recommended for your job";
  summary: string;
  why: string[];
  why_heading: string;
  cta: "Book Now" | "Request Booking" | "Schedule Service";
  /** Internal only — never display to customers */
  _internal: {
    score: number;
    marketplace_score: number;
    completion_rate: number | null;
    calendar_connected: boolean;
    category: string | null;
    response_reliability: number;
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
  packText: string;
  responseReliability: number;
  residentialFit: boolean;
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

function responseLabel(minutes: unknown): string | null {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m <= 60) return "Usually responds within an hour";
  if (m <= 180) return "Usually responds in under 3 hours";
  if (m <= 720) return "Usually responds same day";
  return null;
}

function responseReliabilityScore(minutes: unknown, cancellationRate: unknown): number {
  let s = 50;
  const m = Number(minutes);
  if (Number.isFinite(m) && m > 0) {
    if (m <= 60) s += 30;
    else if (m <= 180) s += 20;
    else if (m <= 720) s += 10;
  }
  const c = Number(cancellationRate);
  if (Number.isFinite(c)) {
    if (c <= 5) s += 20;
    else if (c <= 10) s += 10;
    else if (c >= 20) s -= 15;
  }
  return Math.max(0, Math.min(100, s));
}

function specialistLabel(need: MatchNeed, packText: string, residentialFit: boolean): string | null {
  if (residentialFit || need.residential === true) return "Residential Specialist";
  const addOns = Array.isArray(need.add_ons) ? need.add_ons : [];
  for (const a of addOns) {
    const aLow = normalize(a);
    if (aLow && packText.includes(aLow.split(/\s+/)[0] || aLow)) {
      return `${a} Specialist`;
    }
  }
  if (need.vehicle_type && /truck|suv/i.test(need.vehicle_type)) return "Truck & SUV Specialist";
  if (need.service && /interior/i.test(need.service)) return "Interior Specialist";
  return null;
}

function buildTrust(opts: {
  verified: boolean;
  insured: boolean;
  licensed: boolean;
  jobsCompleted: number | null;
  reviewCount: number;
  completion: number | null;
  responseMinutes: unknown;
  cancellationRate: unknown;
  instant: boolean;
}): TrustIndicators {
  let repeat: string | null = null;
  if (opts.completion != null && opts.completion >= 90 && opts.reviewCount >= 3) {
    repeat = "Strong repeat customer base";
  } else if (opts.reviewCount >= 5) {
    repeat = "Trusted by local repeat customers";
  }
  return {
    verified: opts.verified,
    insured: opts.insured,
    licensed: opts.licensed,
    jobs_completed: opts.jobsCompleted,
    repeat_customers: repeat,
    avg_response: responseLabel(opts.responseMinutes),
    cancellation_rate: opts.cancellationRate != null && Number.isFinite(Number(opts.cancellationRate))
      ? Number(opts.cancellationRate)
      : null,
    instant_book: opts.instant,
  };
}

/** Expert-voice why — answers why THIS provider for THIS job. */
function buildWhy(opts: {
  role: RecommendationRole | null;
  need: MatchNeed;
  availLabel: string;
  instant: boolean;
  completion: number | null;
  reviewCount: number;
  local: boolean;
  residentialFit: boolean;
  isLowestPrice: boolean;
  isFastest: boolean;
  packText: string;
  prefs: CustomerPreferences;
  responseReliability: number;
}): string[] {
  const why: string[] = [];
  const addOns = Array.isArray(opts.need.add_ons) ? opts.need.add_ons : [];
  const vehicle = opts.need.vehicle_type || "";

  if (opts.role === "Fastest" || opts.isFastest) {
    if (/today/i.test(opts.availLabel)) why.push("Best availability — can often do same-day");
    else if (/tomorrow/i.test(opts.availLabel)) why.push("Best availability — open tomorrow");
    else if (opts.availLabel && !/ask about/i.test(opts.availLabel)) {
      why.push(`Best availability — ${opts.availLabel.toLowerCase()}`);
    }
  } else if (opts.availLabel && /today|tomorrow/i.test(opts.availLabel)) {
    why.push(opts.availLabel);
  }

  if (opts.residentialFit) why.push("Similar homes — strong residential fit");
  for (const a of addOns) {
    const aLow = normalize(a);
    if (aLow && opts.packText.includes(aLow.split(/\s+/)[0] || aLow)) {
      why.push(`Specializes in ${a.toLowerCase()} for jobs like yours`);
      break;
    }
  }
  if (vehicle && (opts.packText.includes("truck") || opts.packText.includes("suv"))) {
    why.push("Used to trucks and SUVs like yours");
  }

  if (opts.completion != null && opts.completion >= 90) {
    why.push("High completion rate — they finish what they book");
  } else if (opts.reviewCount >= 5) {
    why.push("Solid repeat-customer track record");
  }

  if (opts.responseReliability >= 75) why.push("Reliable responses when customers reach out");
  if (opts.local) why.push("Close enough to serve your area well");
  if (opts.role === "Best Value" || opts.isLowestPrice) {
    why.push("Best value among the options we’d recommend");
  }
  if (opts.instant && (opts.prefs.fastest_appointment || opts.role === "Fastest")) {
    why.push("Instant Book — less back-and-forth");
  }

  const unique = [...new Set(why)].slice(0, 4);
  if (!unique.length) unique.push("Verified on Hubly and a strong fit for this job");
  return unique;
}

function roleSummary(role: RecommendationRole | null, why: string[]): string {
  if (role === "Best Overall") {
    return "The strongest overall fit for your exact job.";
  }
  if (role === "Fastest") {
    return "The quickest path to getting this done.";
  }
  if (role === "Best Value") {
    return "Great quality without overpaying.";
  }
  return why.slice(0, 2).join(" · ") || "A solid fit based on your request.";
}

/**
 * Assign distinct roles, then order primary as:
 * Best Overall → Fastest → Best Value  (quietly answers "why not everyone else")
 */
function assignRolesAndOrder(rows: ScoredRow[]): ScoredRow[] {
  if (!rows.length) return rows;
  for (const r of rows) r.card.role = null;

  rows[0].card.role = "Best Overall";

  let fastestIdx = -1;
  let bestAvail = Infinity;
  rows.forEach((r, i) => {
    if (r.availRank < bestAvail) {
      bestAvail = r.availRank;
      fastestIdx = i;
    }
  });
  if (fastestIdx === 0 && rows.length > 1) {
    let second = -1;
    let secondAvail = Infinity;
    rows.forEach((r, i) => {
      if (i === 0) return;
      if (r.availRank < secondAvail) {
        secondAvail = r.availRank;
        second = i;
      }
    });
    if (second >= 0) fastestIdx = second;
  }
  if (fastestIdx > 0 && bestAvail < 9999) {
    rows[fastestIdx].card.role = "Fastest";
  }

  let valueIdx = -1;
  let bestPrice = Infinity;
  rows.forEach((r, i) => {
    if (r.price == null || r.card.role) return;
    if (r.price < bestPrice) {
      bestPrice = r.price;
      valueIdx = i;
    }
  });
  if (valueIdx < 0) {
    rows.forEach((r, i) => {
      if (i === 0 || r.price == null || r.card.role) return;
      if (r.price < bestPrice) {
        bestPrice = r.price;
        valueIdx = i;
      }
    });
  }
  if (valueIdx >= 0) rows[valueIdx].card.role = "Best Value";

  for (const r of rows) {
    if (r.card.role) continue;
    if (r.specialization >= 14) r.card.role = "Top Specialist";
    else r.card.role = "Strong Local Fit";
  }

  const order: RecommendationRole[] = [
    "Best Overall",
    "Fastest",
    "Best Value",
    "Top Specialist",
    "Strong Local Fit",
  ];
  return [...rows].sort((a, b) => {
    const ai = order.indexOf(a.card.role || "Strong Local Fit");
    const bi = order.indexOf(b.card.role || "Strong Local Fit");
    if (ai !== bi) return ai - bi;
    return b.score - a.score;
  });
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
  decision: string;
  role_ladder: string[];
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
  const prefs: CustomerPreferences = {
    ...EMPTY_PREFERENCES,
    ...(need.preferences || {}),
  };
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

    // Structured service / add-on fit against provider packages
    const packText = packages
      .map((p) => normalize(`${p.name || ""} ${p.title || ""} ${p.description || ""}`))
      .join(" ");
    const serviceNeedle = normalize(need.service || "");
    if (serviceNeedle) {
      const tokens = serviceNeedle.split(/\s+/).filter((w) => w.length > 3);
      const hits = tokens.filter((w) => packText.includes(w) || normalize(cat).includes(w));
      if (hits.length) {
        score += Math.min(12, 4 + hits.length * 2);
        specialization = Math.max(specialization, 16);
      }
    }
    const addOns = Array.isArray(need.add_ons) ? need.add_ons : [];
    for (const addon of addOns) {
      const a = normalize(addon);
      if (a && (packText.includes(a) || packText.includes(a.split(/\s+/)[0] || ""))) {
        score += 6;
      }
    }
    if (need.priority && /interior/i.test(need.priority) && /interior/i.test(packText)) {
      score += 5;
    }
    if (need.vehicle_type && packText.includes(normalize(need.vehicle_type))) {
      score += 6;
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

    // Preference-weighted ranking (inferred, never asked)
    if (prefs.fastest_appointment) {
      if (aRank === 0) score += 10;
      else if (aRank <= 1) score += 7;
      if (instant) score += 6;
    }
    if (prefs.budget_conscious && startingPrice(packages) != null) score += 2;
    if (prefs.premium_quality) {
      if (mq >= 70) score += 8;
      if (rating != null && rating >= 4.7) score += 4;
    }
    if (prefs.weekend_preferred && avail?.available) score += 3;
    if (prefs.mobile_only && /mobile|we come|on.?site|at your/i.test(packText + " " + normalize(profile.tagline))) {
      score += 8;
    }
    if (prefs.eco_friendly && /eco|green|non.?toxic|organic/i.test(packText)) {
      score += 6;
    }

    const residentialFit =
      need.residential === true ||
      /residential|home|house/.test(packText) ||
      /residential|home/.test(normalize(profile.tagline)) ||
      /\b(driveway|my home|my house)\b/i.test(String(need.service_text || ""));
    if (need.residential === true && residentialFit) score += 5;

    const reliability = responseReliabilityScore(
      pub.response_time,
      pub.cancellation_rate,
    );
    score += Math.round(reliability / 20); // 0–5 pts

    const start = startingPrice(packages);
    const years = yearsInBusiness(meta, website);
    const availLabel = availableLabel(avail, need.when);
    const conf = confidenceLabel(score);
    const jobsCompleted = Number(
      (row.provider as Record<string, unknown>).jobs_completed ??
        (row.provider as Record<string, unknown>).completed_jobs ??
        website.jobsCompleted ??
        meta.jobsCompleted,
    );
    const jobsNum = Number.isFinite(jobsCompleted) && jobsCompleted > 0
      ? Math.round(jobsCompleted)
      : null;

    const trust = buildTrust({
      verified: life.status === "verified",
      insured: !!pub.insurance_verified,
      licensed: !!pub.license_verified,
      jobsCompleted: jobsNum,
      reviewCount,
      completion,
      responseMinutes: pub.response_time,
      cancellationRate: pub.cancellation_rate,
      instant,
    });

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
      specialist_label: specialistLabel(need, packText, residentialFit),
      trust,
      confidence_label: conf,
      summary: "",
      why: [],
      why_heading: "Why Hubly picked them",
      cta: instant ? "Book Now" : "Request Booking",
      _internal: {
        score,
        marketplace_score: mq,
        completion_rate: completion,
        calendar_connected: !!pub.calendar_connected,
        category: pub.category ? String(pub.category) : null,
        response_reliability: reliability,
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
      packText,
      responseReliability: reliability,
      residentialFit,
    });
  }

  // Budget preference: boost lowest-priced options before final sort
  if (prefs.budget_conscious) {
    const pricedAll = scored.filter((r) => r.price != null);
    if (pricedAll.length) {
      const lo = Math.min(...pricedAll.map((r) => r.price as number));
      for (const r of scored) {
        if (r.price === lo) r.score += 8;
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.availRank - b.availRank);
  const pool = scored.slice(0, totalLimit);

  const priced = pool.filter((r) => r.price != null);
  const lowestPrice = priced.length ? Math.min(...priced.map((r) => r.price as number)) : null;
  let fastestRank = Infinity;
  for (const r of pool) if (r.availRank < fastestRank) fastestRank = r.availRank;

  const ordered = assignRolesAndOrder(pool);

  for (const r of ordered) {
    const isLowest = lowestPrice != null && r.price === lowestPrice;
    const isFastest = r.availRank === fastestRank && fastestRank < 9999;
    r.card.why = buildWhy({
      role: r.card.role,
      need,
      availLabel: r.card.available_label,
      instant: r.card.instant_book,
      completion: r.card._internal.completion_rate,
      reviewCount: r.card.review_count,
      local: r.local,
      residentialFit: r.residentialFit,
      isLowestPrice: isLowest,
      isFastest,
      packText: r.packText,
      prefs,
      responseReliability: r.responseReliability,
    });
    r.card.summary = roleSummary(r.card.role, r.card.why);
  }

  // Primary = the three decision roles when present; otherwise top N
  const primaryRoles: RecommendationRole[] = ["Best Overall", "Fastest", "Best Value"];
  const primaryRows: ScoredRow[] = [];
  for (const role of primaryRoles) {
    const hit = ordered.find((r) => r.card.role === role);
    if (hit && !primaryRows.includes(hit)) primaryRows.push(hit);
  }
  while (primaryRows.length < Math.min(primaryLimit, ordered.length)) {
    const next = ordered.find((r) => !primaryRows.includes(r));
    if (!next) break;
    primaryRows.push(next);
  }
  const recommendations = primaryRows.slice(0, primaryLimit).map((s) => s.card);
  const primaryIds = new Set(recommendations.map((c) => c.provider_id));
  const more_providers = ordered
    .filter((s) => !primaryIds.has(s.card.provider_id))
    .map((s) => s.card);

  const headline = recommendations.length
    ? "We narrowed it down for you."
    : "We couldn’t find a strong match yet — try a bit more detail.";
  const subhead = recommendations.length
    ? "Three strong options for your job — pick one and book."
    : "Add a city, timing, or a bit more detail and I’ll try again.";

  return {
    headline,
    subhead,
    decision: "Three choices. Done.",
    role_ladder: ["Best Overall", "Fastest", "Best Value", "Browse More"],
    recommendations,
    more_providers,
    more_label: "Browse more providers that may also be a good fit",
    matches: [...recommendations, ...more_providers],
    need,
  };
}
