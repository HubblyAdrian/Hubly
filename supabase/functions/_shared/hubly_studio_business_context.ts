/**
 * Studio Business Context — canonical reusable object for Hubly Studio V1.
 * Future products may consume this later; V1 consumer = Studio only.
 *
 * Memory facts and DNA tone stay labeled separately — never merged into one blob.
 */

export type StudioReviewSnippet = {
  stars: number;
  quote: string;
  author?: string | null;
};

export type StudioBusinessContext = {
  business_id: string;
  business_name: string;
  industry: string;
  city: string | null;
  phone: string | null;
  services: string[];
  logo_url: string | null;
  brand_colors: string[];
  /** Interpretive — from Business DNA */
  tone: string | null;
  brand_personality: string | null;
  /** Owned operational signals (Recommendation Engine inputs) */
  completed_jobs_recent: number;
  completed_jobs_week: number;
  open_slots_tomorrow: number;
  latest_review: StudioReviewSnippet | null;
  job_photos_count: number;
  has_before_after: boolean;
  has_logo: boolean;
  has_membership: boolean;
  days_since_last_studio_publish: number | null;
  active_promotions: string[];
  season_month: number;
  offer_summary: string | null;
  service_focus: string | null;
};

export type BuildBusinessContextInput = {
  business_id: string;
  business_name?: string | null;
  industry?: string | null;
  city?: string | null;
  phone?: string | null;
  services?: string[];
  logo_url?: string | null;
  brand_colors?: string[];
  tone?: string | null;
  brand_personality?: string | null;
  completed_jobs_recent?: number;
  completed_jobs_week?: number;
  open_slots_tomorrow?: number;
  latest_review?: StudioReviewSnippet | null;
  job_photos_count?: number;
  has_before_after?: boolean;
  has_logo?: boolean;
  has_membership?: boolean;
  days_since_last_studio_publish?: number | null;
  active_promotions?: string[];
  offer_summary?: string | null;
  service_focus?: string | null;
  now?: Date;
};

/** Normalize industry aliases toward V1 detailing-first catalog. */
export function normalizeStudioIndustry(raw?: string | null): string {
  if (!raw) return "detailing";
  const key = String(raw).trim().toLowerCase();
  if (/detail|mobile.?detail|car.?wash|auto.?detail/.test(key)) return "detailing";
  if (/pressure|power.?wash|soft.?wash/.test(key)) return "pressure_washing";
  if (/hvac|heat|cool|furnace|air.?cond/.test(key)) return "hvac";
  if (/plumb/.test(key)) return "plumbing";
  if (/photo/.test(key)) return "photography";
  if (/lawn|landscape/.test(key)) return "landscaping";
  if (/clean|maid/.test(key)) return "cleaning";
  if (/home.?service/.test(key)) return "home_services";
  return key.replace(/\s+/g, "_") || "detailing";
}

export function buildStudioBusinessContext(
  input: BuildBusinessContextInput,
): StudioBusinessContext {
  const now = input.now || new Date();
  return {
    business_id: input.business_id,
    business_name: String(input.business_name || "Your business").trim() || "Your business",
    industry: normalizeStudioIndustry(input.industry),
    city: input.city || null,
    phone: input.phone || null,
    services: Array.isArray(input.services) ? input.services.filter(Boolean) : [],
    logo_url: input.logo_url || null,
    brand_colors: Array.isArray(input.brand_colors) ? input.brand_colors : [],
    tone: input.tone || null,
    brand_personality: input.brand_personality || null,
    completed_jobs_recent: Number(input.completed_jobs_recent) || 0,
    completed_jobs_week: Number(input.completed_jobs_week) || 0,
    open_slots_tomorrow: Number(input.open_slots_tomorrow) || 0,
    latest_review: input.latest_review || null,
    job_photos_count: Number(input.job_photos_count) || 0,
    has_before_after: !!input.has_before_after,
    has_logo: input.has_logo !== false,
    has_membership: !!input.has_membership,
    days_since_last_studio_publish:
      input.days_since_last_studio_publish == null
        ? null
        : Number(input.days_since_last_studio_publish),
    active_promotions: Array.isArray(input.active_promotions)
      ? input.active_promotions.filter(Boolean)
      : [],
    season_month: now.getMonth() + 1,
    offer_summary: input.offer_summary || null,
    service_focus: input.service_focus || null,
  };
}

/** Split for Campaign Engine — facts vs interpretive identity. */
export function splitContextForEngine(ctx: StudioBusinessContext) {
  return {
    business_inputs: {
      business_id: ctx.business_id,
      business_name: ctx.business_name,
      industry: ctx.industry,
      city: ctx.city,
      phone: ctx.phone,
      services: ctx.services,
      logo_url: ctx.logo_url,
      completed_jobs_recent: ctx.completed_jobs_recent,
      completed_jobs_week: ctx.completed_jobs_week,
      open_slots_tomorrow: ctx.open_slots_tomorrow,
      latest_review: ctx.latest_review,
      job_photos_count: ctx.job_photos_count,
      has_before_after: ctx.has_before_after,
      has_logo: ctx.has_logo,
      has_membership: ctx.has_membership,
      days_since_last_studio_publish: ctx.days_since_last_studio_publish,
      active_promotions: ctx.active_promotions,
      offer_summary: ctx.offer_summary,
      service_focus: ctx.service_focus,
      season_month: ctx.season_month,
    },
    dna_inputs: {
      tone: ctx.tone,
      brand_personality: ctx.brand_personality,
    },
  };
}
