/**
 * Phase 3 — Recommendation engine.
 * Feel like a trusted local expert, not an algorithm sorting providers.
 * Answer: "Why should I book this business instead of the others?"
 * Hierarchy: Best Match (job-specific) → Fastest / Availability → Best Value → Browse More.
 * Labels are generated from the customer's job — never static "Best Overall".
 */

import { getAvailability } from "./marketplace_availability.ts";
import {
  EMPTY_PREFERENCES,
  type CustomerPreferences,
} from "./marketplace_industry_knowledge.ts";
import { buildLifecycleSnapshot } from "./marketplace_lifecycle.ts";
import { assembleProviderPublic } from "./marketplace_provider.ts";
import { listServices, toMatchDto } from "./service_engine.ts";

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

/** Internal slot for ranking / ordering — never shown raw to customers */
export type RoleKey = "best_match" | "fastest" | "best_value" | "specialist" | "local";

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
  /** Job-specific display label, e.g. "Best for Odor Removal" */
  role: string | null;
  role_key: RoleKey | null;
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
  mobileFit: boolean;
};

/** Signals inferred from the customer's exact job (not the industry alone). */
type JobSignals = {
  small_job: boolean;
  odor: boolean;
  interior: boolean;
  exterior: boolean;
  wedding: boolean;
  commercial: boolean;
  large_home: boolean;
  luxury_vehicle: boolean;
  same_day: boolean;
  this_week: boolean;
  mobile: boolean;
  truck_suv: boolean;
  service_short: string | null;
  add_on_primary: string | null;
};

function jobSignals(need: MatchNeed): JobSignals {
  const blob = [
    need.service_text,
    need.service,
    need.notes,
    need.scope,
    ...(need.add_ons || []),
  ].filter(Boolean).join(" ").toLowerCase();

  const small_job = /\b(only|just|few|two|2|three|3|front|small job|couple)\b/.test(blob) ||
    /\b(1|2|3|4|5|6)\s*windows?\b/.test(blob);
  const odor = /odor|odour|smoke|smell|stink/.test(blob) ||
    (need.add_ons || []).some((a) => /odor|smoke/i.test(a));
  const interior = /interior/.test(blob) && !/exterior over interior/i.test(need.priority || "");
  const exterior = /exterior/.test(blob) && !/interior over exterior/i.test(need.priority || "");
  const wedding = /wedding/.test(blob) || need.category === "photography" && /wedding/i.test(blob);
  const commercial = need.residential === false || /commercial|office|storefront/.test(blob);
  const large_home = /large home|big house|two stor|2 stor|three stor|many windows|\b(20|25|30|[3-9]\d)\s*windows/.test(blob);
  const luxury_vehicle = /luxury|premium|ceramic|exotic|bmw|mercedes|porsche/.test(blob);
  const same_day = /asap|today|tonight|same.?day|urgent/.test(blob) ||
    !!(need.preferences?.fastest_appointment) || need.when === "asap";
  const this_week = /this week/.test(blob) || need.when === "this week";
  const mobile = !!(need.preferences?.mobile_only) || /mobile/.test(blob);
  const truck_suv = /truck|suv/.test(need.vehicle_type || "") || /truck|suv/.test(blob);
  const add_on_primary = (need.add_ons && need.add_ons[0]) || null;
  let service_short = need.service || null;
  if (service_short && service_short.length > 28) {
    service_short = service_short.replace(/ Window Cleaning$/i, "").replace(/ Detail$/i, " Detail");
  }

  return {
    small_job,
    odor,
    interior,
    exterior,
    wedding: !!wedding,
    commercial,
    large_home,
    luxury_vehicle,
    same_day,
    this_week,
    mobile,
    truck_suv,
    service_short,
    add_on_primary,
  };
}

/** Dynamic labels from the customer's job — never generic "Best Overall". */
function labelsForJob(need: MatchNeed, signals: JobSignals): {
  best_match: string;
  fastest: string;
  best_value: string;
  specialist: string;
  local: string;
} {
  let best_match = "Best Match";
  if (signals.odor) best_match = "Best for Odor Removal";
  else if (signals.small_job && need.category === "windows") best_match = "Best for Small Jobs";
  else if (signals.wedding) best_match = "Best for Weddings";
  else if (signals.commercial) best_match = "Best for Commercial Buildings";
  else if (signals.large_home) best_match = "Best for Large Homes";
  else if (signals.luxury_vehicle) best_match = "Best for Luxury Vehicles";
  else if (signals.interior && need.category === "detailing") best_match = "Best for Interior Detail";
  else if (signals.interior && need.category === "windows") best_match = "Best for Interior Windows";
  else if (signals.exterior && need.category === "windows") best_match = "Best for Exterior Windows";
  else if (signals.add_on_primary) best_match = `Best for ${signals.add_on_primary}`;
  else if (signals.service_short) best_match = `Best for ${signals.service_short}`;
  else if (need.category === "hvac" && /diagnostic|repair|stopped/i.test(need.service || "")) {
    best_match = "Best for AC Repair";
  } else best_match = "Best for Your Job";

  let fastest = "Fastest Availability";
  if (signals.wedding) fastest = "Most Experienced";
  else if (signals.same_day) fastest = "Same-Day Available";
  else if (signals.this_week) fastest = "Best Availability This Week";

  const best_value = "Best Value";
  const specialist = signals.wedding
    ? "Most Experienced"
    : (signals.odor
      ? "Odor Removal Specialist"
      : (signals.truck_suv ? "Truck & SUV Specialist" : "Top Specialist"));
  const local = "Strong Local Fit";

  return { best_match, fastest, best_value, specialist, local };
}

function fastestLabelForAvail(base: string, availLabel: string, signals: JobSignals): string {
  if (/today/i.test(availLabel)) return "Same-Day Available";
  if (/tomorrow/i.test(availLabel)) return "Available Tomorrow";
  if (signals.same_day) return "Same-Day Available";
  return base;
}

/**
 * Trust-building explanation shown before provider cards.
 * Answers: what Hubly looked for based on THIS request.
 */
export function buildMatchExplanation(
  need: MatchNeed,
  signals?: JobSignals,
): {
  intro: string;
  looked_for_heading: string;
  criteria: string[];
  outro: string;
} {
  const s = signals || jobSignals(need);
  const criteria: string[] = [];

  if (s.interior && need.category === "detailing") {
    criteria.push("Offer Interior Detail");
  } else if (s.interior && need.category === "windows") {
    criteria.push("Offer interior window cleaning");
  } else if (need.service) {
    criteria.push(`Offer ${need.service}`);
  } else if (s.service_short) {
    criteria.push(`Offer ${s.service_short}`);
  }

  if (s.odor) criteria.push("Specialize in Odor Removal");
  else if (s.add_on_primary && !s.odor) {
    criteria.push(`Specialize in ${s.add_on_primary}`);
  }

  if (s.truck_suv) criteria.push("Service Trucks");
  else if (need.vehicle_type) {
    const vt = String(need.vehicle_type).trim();
    criteria.push(vt.toLowerCase().endsWith("s") ? `Service ${vt}` : `Service ${vt}s`);
  }

  if (s.small_job && (need.category === "windows" || need.residential === true)) {
    criteria.push("Accept small residential jobs");
  }
  if (s.wedding) criteria.push("Specialize in wedding photography");
  if (s.commercial) criteria.push("Handle commercial buildings");
  if (s.large_home) criteria.push("Handle larger homes");
  if (s.luxury_vehicle) criteria.push("Experience with luxury vehicles");
  if (s.mobile || need.preferences?.mobile_only) criteria.push("Offer mobile service");

  if (s.same_day) criteria.push("Have same-day or next-day openings on their calendar");
  else criteria.push("Have real openings on their calendar this week");

  // De-dupe while preserving order
  const unique = [...new Set(criteria)].slice(0, 5);
  if (!unique.length) {
    unique.push(
      "Match your exact request",
      "Have real calendar availability",
      "Can get you booked quickly",
    );
  }

  return {
    intro:
      "We checked calendars first — then narrowed it to providers who can actually take your job.",
    looked_for_heading: "Before recommending anyone, we looked for businesses that:",
    criteria: unique,
    outro: "These providers are bookable for your request — not a directory listing.",
  };
}

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

function startingPriceCents(
  services: Array<{ price_cents: number | null; quote_required: boolean }>,
): number | null {
  const prices = services
    .filter((s) => !s.quote_required && s.price_cents != null && s.price_cents > 0)
    .map((s) => Number(s.price_cents));
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

/**
 * Why Hubly matched them — about THIS job, not generic quality.
 */
function buildWhy(opts: {
  roleKey: RoleKey | null;
  need: MatchNeed;
  signals: JobSignals;
  availLabel: string;
  instant: boolean;
  completion: number | null;
  reviewCount: number;
  local: boolean;
  residentialFit: boolean;
  mobileFit: boolean;
  isLowestPrice: boolean;
  isFastest: boolean;
  packText: string;
  years: number | null;
}): string[] {
  const why: string[] = [];
  const addOns = Array.isArray(opts.need.add_ons) ? opts.need.add_ons : [];
  const s = opts.signals;

  // Job-specific specialization first — this customer's job, not generic quality
  if (s.odor) {
    why.push("Specializes in odor removal");
    if (s.interior || /interior/.test(opts.packText)) {
      why.push("Interior-only detailing available");
    }
  }
  for (const a of addOns) {
    if (s.odor && /odor|smoke/i.test(a)) continue;
    const aLow = normalize(a);
    if (aLow && opts.packText.includes(aLow.split(/\s+/)[0] || aLow)) {
      why.push(`Specializes in ${a.toLowerCase()}`);
      break;
    }
  }

  if (s.truck_suv || /truck|suv/.test(opts.need.vehicle_type || "")) {
    why.push("Services trucks regularly");
  }

  if (s.mobile || opts.mobileFit) {
    if (/mobile|we come|on.?site|at your/.test(opts.packText) || opts.mobileFit) {
      why.push("Mobile service available");
    }
  }

  if (s.interior && !s.odor && opts.need.category === "detailing") {
    why.push("Interior-only detailing available");
  }

  if (s.small_job && (opts.need.category === "windows" || opts.need.residential === true)) {
    why.push("Accepts small residential jobs");
    why.push("No minimum service fee");
  }

  if (
    opts.need.category === "windows" &&
    (s.small_job || /window/i.test(opts.need.service || opts.need.service_text || ""))
  ) {
    if (opts.reviewCount >= 3 || opts.completion != null && opts.completion >= 85) {
      why.push("Highly rated for window cleaning");
    }
  }

  if (s.wedding) {
    why.push("Wedding photography experience");
    if (opts.years != null && opts.years >= 5) why.push("Years of event coverage");
  }

  if (s.commercial) why.push("Set up for commercial sites");
  if (s.large_home) why.push("Comfortable with larger homes");
  if (s.interior && !s.odor && opts.need.category !== "detailing") {
    why.push("Customers frequently book them for interior-only services");
  }
  if (opts.residentialFit && !s.commercial && !s.small_job && opts.need.category !== "detailing") {
    why.push("Strong residential fit for homes like yours");
  }

  // Availability tied to this booking
  if (opts.isFastest || opts.roleKey === "fastest" || /today|tomorrow/i.test(opts.availLabel)) {
    if (/today/i.test(opts.availLabel)) why.push("Earliest appointment today");
    else if (/tomorrow/i.test(opts.availLabel)) why.push("Earliest appointment tomorrow");
    else if (opts.availLabel && !/ask about/i.test(opts.availLabel)) {
      why.push(opts.availLabel);
    }
  }

  if (opts.roleKey === "best_value" || opts.isLowestPrice) {
    why.push("Best starting price among the options we’d recommend");
  }

  if (opts.instant && (s.same_day || opts.roleKey === "fastest")) {
    why.push("Instant Book — less back-and-forth");
  }

  if (opts.local && why.length < 4) why.push("Serves your area");

  // Only add completion if we still need a 4th line and it's exceptional
  if (why.length < 3 && opts.completion != null && opts.completion >= 92) {
    why.push("Excellent completion history on booked jobs");
  }

  const unique = [...new Set(why)].slice(0, 4);
  if (!unique.length) {
    unique.push(
      opts.need.service
        ? `A strong match for ${opts.need.service.toLowerCase()}`
        : "A strong match for your exact request",
    );
  }
  return unique;
}

function roleSummary(roleLabel: string | null, signals: JobSignals): string {
  if (signals.odor) return "Picked for smoke / odor work on a vehicle like yours.";
  if (signals.small_job) return "Picked because this is a focused, smaller job.";
  if (signals.wedding) return "Picked for wedding-day coverage.";
  if (roleLabel?.startsWith("Best for")) return `Picked as ${roleLabel.toLowerCase()}.`;
  return "Picked for your exact request — not a generic top-rated list.";
}

/**
 * Assign role keys, paint job-specific labels, order:
 * best_match → fastest → best_value → …
 */
function assignRolesAndOrder(
  rows: ScoredRow[],
  need: MatchNeed,
): ScoredRow[] {
  if (!rows.length) return rows;
  const signals = jobSignals(need);
  const labels = labelsForJob(need, signals);

  for (const r of rows) {
    r.card.role = null;
    r.card.role_key = null;
  }

  rows[0].card.role_key = "best_match";
  rows[0].card.role = labels.best_match;

  // Second slot: for weddings prefer experience; otherwise soonest availability.
  let fastestIdx = -1;
  if (signals.wedding && rows.length > 1) {
    let bestYears = -1;
    rows.forEach((r, i) => {
      if (i === 0) return;
      const y = r.card.years_in_business ?? 0;
      if (y > bestYears) {
        bestYears = y;
        fastestIdx = i;
      }
    });
    if (fastestIdx < 0) fastestIdx = 1;
    rows[fastestIdx].card.role_key = "fastest";
    rows[fastestIdx].card.role = labels.fastest;
  } else {
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
      rows[fastestIdx].card.role_key = "fastest";
      rows[fastestIdx].card.role = fastestLabelForAvail(
        labels.fastest,
        rows[fastestIdx].card.available_label,
        signals,
      );
    }
  }

  let valueIdx = -1;
  let bestPrice = Infinity;
  rows.forEach((r, i) => {
    if (r.price == null || r.card.role_key) return;
    if (r.price < bestPrice) {
      bestPrice = r.price;
      valueIdx = i;
    }
  });
  if (valueIdx < 0) {
    rows.forEach((r, i) => {
      if (i === 0 || r.price == null || r.card.role_key) return;
      if (r.price < bestPrice) {
        bestPrice = r.price;
        valueIdx = i;
      }
    });
  }
  if (valueIdx >= 0) {
    rows[valueIdx].card.role_key = "best_value";
    rows[valueIdx].card.role = labels.best_value;
  }

  for (const r of rows) {
    if (r.card.role_key) continue;
    if (r.specialization >= 14 || signals.wedding) {
      r.card.role_key = "specialist";
      r.card.role = labels.specialist;
    } else {
      r.card.role_key = "local";
      r.card.role = labels.local;
    }
  }

  const order: RoleKey[] = ["best_match", "fastest", "best_value", "specialist", "local"];
  return [...rows].sort((a, b) => {
    const ai = order.indexOf(a.card.role_key || "local");
    const bi = order.indexOf(b.card.role_key || "local");
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

export type MatchExplanation = ReturnType<typeof buildMatchExplanation>;

export function rankMarketplaceMatches(input: RankInput): {
  headline: string;
  subhead: string;
  decision: string;
  explanation: MatchExplanation;
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
    const catalogServices = listServices(row.business, { channel: "marketplace" }).map((s) =>
      toMatchDto(row.business, s)
    );
    const meta = (row.business.meta || {}) as Record<string, unknown>;
    const website = (meta.website || {}) as Record<string, unknown>;

    let score = 40;
    // Prefer providers with a published marketplace catalog so Match → Book works.
    if (catalogServices.length > 0) score += 16;
    else if (life.can_quote_request || life.can_booking_request) score += 4;
    else score -= 8;
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

    // Structured service / add-on fit against Service Engine catalog only
    // AI must never invent services — only score against what exists.
    const packText = catalogServices
      .map((p) =>
        normalize(
          `${p.name || ""} ${p.description || ""} ${p.includes.join(" ")} ${p.category || ""} ${p.subcategory || ""} ${p.addon_names.join(" ")}`,
        )
      )
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
    if (prefs.budget_conscious && startingPriceCents(catalogServices) != null) score += 2;
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

    const startCents = startingPriceCents(catalogServices);
    const start = startCents != null ? startCents / 100 : null;
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
      role_key: null,
      specialist_label: specialistLabel(need, packText, residentialFit),
      trust,
      confidence_label: conf,
      summary: "",
      why: [],
      why_heading: "Why Hubly matched them",
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

    const mobileFit = /mobile|we come|on.?site|at your/i.test(
      packText + " " + normalize(profile.tagline),
    );

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
      mobileFit,
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

  const signals = jobSignals(need);
  const ordered = assignRolesAndOrder(pool, need);

  for (const r of ordered) {
    const isLowest = lowestPrice != null && r.price === lowestPrice;
    const isFastest = r.availRank === fastestRank && fastestRank < 9999;
    r.card.why = buildWhy({
      roleKey: r.card.role_key,
      need,
      signals,
      availLabel: r.card.available_label,
      instant: r.card.instant_book,
      completion: r.card._internal.completion_rate,
      reviewCount: r.card.review_count,
      local: r.local,
      residentialFit: r.residentialFit,
      mobileFit: r.mobileFit,
      isLowestPrice: isLowest,
      isFastest,
      packText: r.packText,
      years: r.card.years_in_business,
    });
    r.card.summary = roleSummary(r.card.role, signals);
    r.card.why_heading = "Why Hubly matched them";
  }

  // Primary = best_match → fastest → best_value when present
  const primaryKeys: RoleKey[] = ["best_match", "fastest", "best_value"];
  const primaryRows: ScoredRow[] = [];
  for (const key of primaryKeys) {
    const hit = ordered.find((r) => r.card.role_key === key);
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

  const ladderLabels = recommendations.map((c) => c.role).filter(Boolean) as string[];
  if (more_providers.length) ladderLabels.push("Browse More");

  const explanation = buildMatchExplanation(need, signals);
  const headline = recommendations.length
    ? explanation.intro
    : "We couldn’t find a strong match yet — try a bit more detail.";
  const subhead = recommendations.length
    ? explanation.outro
    : "Add a city, timing, or a bit more detail and I’ll try again.";

  return {
    headline,
    subhead,
    decision: "Three choices. Done.",
    explanation,
    role_ladder: ladderLabels.length
      ? ladderLabels
      : ["Best Match", "Fastest Availability", "Best Value", "Browse More"],
    recommendations,
    more_providers,
    more_label: "Browse more providers that may also be a good fit",
    matches: [...recommendations, ...more_providers],
    need,
  };
}
