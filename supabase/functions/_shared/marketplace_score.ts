import { getCatalog } from "./service_engine.ts";

/** Marketplace score engine (0–100). Reuses Hubly business profile data. */

export type ScoreInputs = {
  business: {
    name?: string | null;
    logo_url?: string | null;
    city?: string | null;
    phone?: string | null;
    meta?: Record<string, unknown> | null;
    travel_radius_miles?: number | null;
  };
  provider: {
    calendar_connected?: boolean;
    verification_status?: string;
    insurance_verified?: boolean;
    license_verified?: boolean;
    accepting_new_jobs?: boolean;
    instant_booking?: boolean;
    response_time_minutes?: number | null;
    completion_rate?: number | null;
    cancellation_rate?: number | null;
  };
  jobsCompleted?: number;
};

export type ScoreResult = {
  score: number;
  breakdown: Record<string, number>;
};

function hasPhotos(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  const portfolio = meta.portfolioUrls;
  if (Array.isArray(portfolio) && portfolio.length > 0) return true;
  const pairs = meta.galleryPairs;
  if (Array.isArray(pairs) && pairs.length > 0) return true;
  const website = meta.website as Record<string, unknown> | undefined;
  if (website?.ownerPhotoUrl) return true;
  return false;
}

function hasReviews(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  const website = meta.website as Record<string, unknown> | undefined;
  const manual = website?.manualReviews;
  if (Array.isArray(manual) && manual.length > 0) return true;
  if (website?.rating || website?.reviewCount) return true;
  if (meta.reviewEmbedCode) return true;
  return false;
}

function hasServices(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  // Service Engine only — migrate-on-read covers legacy editorSvcs / meta.services.
  return getCatalog({ meta }).services.some((s) => s.status === "active");
}

/**
 * Weighted marketplace score. Weights sum to 100.
 */
export function computeMarketplaceScore(input: ScoreInputs): ScoreResult {
  const meta = (input.business.meta || {}) as Record<string, unknown>;
  const breakdown: Record<string, number> = {};

  // Profile complete — 15
  const profileBits = [
    !!(input.business.name && String(input.business.name).trim()),
    !!(input.business.logo_url || meta.logoUrl),
    !!(input.business.city && String(input.business.city).trim()),
    !!(input.business.phone && String(input.business.phone).trim()),
    hasServices(meta),
  ];
  const profilePct = profileBits.filter(Boolean).length / profileBits.length;
  breakdown.profile_complete = Math.round(15 * profilePct);

  // Photos — 15
  breakdown.photos = hasPhotos(meta) ? 15 : 0;

  // Reviews — 15
  breakdown.reviews = hasReviews(meta) ? 15 : 0;

  // Calendar connected — 15
  breakdown.calendar_connected = input.provider.calendar_connected ? 15 : 0;

  // Response time — 10 (unknown → partial credit if accepting jobs)
  const rt = input.provider.response_time_minutes;
  if (rt != null && Number.isFinite(rt)) {
    if (rt <= 30) breakdown.response_time = 10;
    else if (rt <= 120) breakdown.response_time = 7;
    else if (rt <= 1440) breakdown.response_time = 4;
    else breakdown.response_time = 1;
  } else {
    breakdown.response_time = input.provider.accepting_new_jobs ? 3 : 0;
  }

  // Verification — 15
  if (input.provider.verification_status === "verified") {
    breakdown.verification = 15;
  } else if (input.provider.insurance_verified || input.provider.license_verified) {
    breakdown.verification = 8;
  } else if (input.provider.verification_status === "pending") {
    breakdown.verification = 3;
  } else {
    breakdown.verification = 0;
  }

  // Bookings completed — 10
  const completed = Number(input.jobsCompleted || 0);
  if (completed >= 25) breakdown.bookings_completed = 10;
  else if (completed >= 10) breakdown.bookings_completed = 7;
  else if (completed >= 3) breakdown.bookings_completed = 4;
  else if (completed >= 1) breakdown.bookings_completed = 2;
  else breakdown.bookings_completed = 0;

  // Cancellation rate — 5 (lower is better; unknown → neutral 2)
  const cancel = input.provider.cancellation_rate;
  if (cancel != null && Number.isFinite(Number(cancel))) {
    const c = Number(cancel);
    if (c <= 5) breakdown.cancellation_rate = 5;
    else if (c <= 15) breakdown.cancellation_rate = 3;
    else if (c <= 30) breakdown.cancellation_rate = 1;
    else breakdown.cancellation_rate = 0;
  } else {
    breakdown.cancellation_rate = 2;
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      Object.values(breakdown).reduce((s, n) => s + n, 0),
    ),
  );

  return { score, breakdown };
}
