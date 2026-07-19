/**
 * Canonical AI-ready provider document.
 * One object AI (and future marketplace UI) can trust as the single source of truth.
 * Profile content is referenced from Hubly businesses — never duplicated as editable copies.
 */

import { getAvailability } from "./marketplace_availability.ts";
import {
  buildLifecycleSnapshot,
  marketplaceStatusLabel,
  type MarketplaceStatus,
} from "./marketplace_lifecycle.ts";
import { assembleProviderPublic } from "./marketplace_provider.ts";

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  weight: number;
};

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function packageSummary(packages: unknown[]): Array<Record<string, unknown>> {
  return packages.slice(0, 40).map((p) => {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    return {
      name: o.name || o.title || null,
      price: o.price ?? o.amount ?? null,
      duration_hours: o.dur ?? o.duration_hours ?? o.duration ?? null,
      description: o.desc || o.description || null,
    };
  });
}

function reviewSummary(reviews: unknown[]): Array<Record<string, unknown>> {
  return reviews.slice(0, 20).map((r) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    return {
      name: o.name || o.author || null,
      rating: o.rating ?? o.stars ?? null,
      text: o.text || o.body || o.review || null,
    };
  });
}

export function buildReadinessChecklist(
  provider: Record<string, unknown>,
  business: Record<string, unknown>,
  lifecycle: ReturnType<typeof buildLifecycleSnapshot>,
): { items: ReadinessItem[]; ready_score: number; marketplace_ready: boolean } {
  const meta = (business.meta || {}) as Record<string, unknown>;
  const website = (meta.website || {}) as Record<string, unknown>;
  const packages = asArray(meta.editorSvcs).length
    ? asArray(meta.editorSvcs)
    : asArray(meta.services);
  const photos = asArray(meta.portfolioUrls).length
    ? asArray(meta.portfolioUrls)
    : asArray(meta.galleryPairs);
  const reviews = asArray(website.manualReviews);

  const items: ReadinessItem[] = [
    {
      key: "profile_name",
      label: "Business name",
      ok: !!(business.name && String(business.name).trim()),
      weight: 10,
    },
    {
      key: "logo",
      label: "Logo",
      ok: !!(business.logo_url || meta.logoUrl),
      weight: 10,
    },
    {
      key: "packages",
      label: "Packages / services",
      ok: packages.length > 0,
      weight: 15,
    },
    {
      key: "photos",
      label: "Photos",
      ok: photos.length > 0,
      weight: 10,
    },
    {
      key: "hours",
      label: "Business hours",
      ok: !!(meta.hours && typeof meta.hours === "object"),
      weight: 10,
    },
    {
      key: "service_area",
      label: "Service area",
      ok: !!(
        business.city ||
        asArray(business.service_area_cities).length ||
        asArray(meta.serviceAreaStates).length ||
        meta.serviceAreaRadiusMiles ||
        business.travel_radius_miles
      ),
      weight: 10,
    },
    {
      key: "calendar",
      label: "Calendar connected",
      ok: !!provider.calendar_connected,
      weight: 15,
    },
    {
      key: "reviews",
      label: "Reviews",
      ok: reviews.length > 0 || !!(website.rating || website.reviewCount),
      weight: 10,
    },
    {
      key: "lifecycle_verified",
      label: "Verified for marketplace",
      ok: lifecycle.status === "verified",
      weight: 10,
    },
  ];

  const totalW = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + (i.ok ? i.weight : 0), 0);
  const ready_score = totalW ? Math.round((earned / totalW) * 100) : 0;

  return {
    items,
    ready_score,
    marketplace_ready: lifecycle.is_public && ready_score >= 60,
  };
}

export type ProviderDocumentInput = {
  provider: Record<string, unknown>;
  business: Record<string, unknown>;
  availability?: ReturnType<typeof getAvailability> | null;
  jobsCompleted?: number;
};

/**
 * Full AI document — deterministic, structured, no marketing fluff.
 */
export function buildProviderDocument(input: ProviderDocumentInput) {
  const { provider, business } = input;
  const publicDto = assembleProviderPublic(provider, business);
  const lifecycle = publicDto.lifecycle;
  const meta = (business.meta || {}) as Record<string, unknown>;
  const website = (meta.website || {}) as Record<string, unknown>;
  const packages = asArray(meta.editorSvcs).length
    ? asArray(meta.editorSvcs)
    : asArray(meta.services);
  const photos = asArray(meta.portfolioUrls).length
    ? asArray(meta.portfolioUrls)
    : asArray(meta.galleryPairs);
  const reviews = asArray(website.manualReviews);
  const faqs = asArray(website.faq);
  const readiness = buildReadinessChecklist(provider, business, lifecycle);

  const capabilities = {
    listed_publicly: lifecycle.is_public,
    instant_book: lifecycle.can_instant_book,
    quote_request: lifecycle.can_quote_request,
    accept_new_jobs: lifecycle.can_accept_leads,
    emergency_jobs: !!provider.emergency_jobs,
    weekend_jobs: provider.weekend_jobs !== false,
    calendar_hubly: true,
    calendar_google: !!provider.calendar_connected,
    calendar_outlook: false,
    insurance_verified: !!provider.insurance_verified,
    license_verified: !!provider.license_verified,
    background_check: provider.background_check_status || "none",
  };

  const availability = input.availability
    ? {
      available: input.availability.available,
      next_available: input.availability.nextAvailable,
      blocked_count: input.availability.blockedTimes?.length || 0,
      sources: input.availability.sources,
    }
    : null;

  const status = lifecycle.status as MarketplaceStatus;

  return {
    schema_version: "hubly.marketplace.provider.v1",
    generated_at: new Date().toISOString(),
    id: provider.id,
    business_id: provider.business_id,
    provider_kind: provider.provider_kind || "hubly",
    category: publicDto.category,

    // Lifecycle — AI must respect these before acting
    lifecycle: {
      status,
      label: marketplaceStatusLabel(status),
      is_public: lifecycle.is_public,
      is_participating: lifecycle.is_participating,
      can_accept_leads: lifecycle.can_accept_leads,
      can_instant_book: lifecycle.can_instant_book,
      can_quote_request: lifecycle.can_quote_request,
      owner_locked: lifecycle.owner_locked,
      verified_at: provider.verified_at || null,
      status_changed_at: provider.status_changed_at || null,
      status_reason: provider.status_reason || provider.verification_notes || null,
    },

    score: {
      marketplace_score: provider.marketplace_score ?? 0,
      breakdown: provider.score_breakdown || {},
      readiness_score: readiness.ready_score,
      marketplace_ready: readiness.marketplace_ready,
      checklist: readiness.items,
    },

    capabilities,

    metrics: {
      response_time_minutes: provider.response_time_minutes ?? null,
      completion_rate: provider.completion_rate ?? null,
      cancellation_rate: provider.cancellation_rate ?? null,
      jobs_completed: input.jobsCompleted ?? null,
    },

    // Referenced Hubly profile (source of truth — do not invent alternate copies)
    profile: {
      name: business.name || null,
      slug: business.slug || null,
      tagline: business.tagline || null,
      city: business.city || null,
      phone: business.phone || null,
      email: business.email || null,
      business_type: business.business_type || null,
      logo_url: business.logo_url || meta.logoUrl || null,
      banner_url: business.banner_url || meta.bannerUrl || null,
      hours: meta.hours || null,
      travel_radius_miles:
        provider.travel_radius_miles ?? business.travel_radius_miles ?? null,
      service_area: publicDto.profile.service_area,
      packages: packageSummary(packages),
      photos: photos.slice(0, 30),
      reviews: reviewSummary(reviews),
      faqs: faqs.slice(0, 30),
      rating: website.rating ?? null,
      review_count: website.reviewCount ?? reviews.length,
    },

    availability,

    // Compact instruction block for AI agents
    ai_directives: {
      may_recommend: lifecycle.is_public,
      may_instant_book: lifecycle.can_instant_book,
      may_create_quote_request: lifecycle.can_quote_request,
      if_not_public: `Provider status is ${marketplaceStatusLabel(status)}; do not present as a public marketplace listing.`,
      source_of_truth: "Hubly businesses table + marketplace_providers lifecycle; profile fields are references, not copies.",
    },

    // Convenience mirror of public DTO for existing clients
    public: publicDto,
  };
}
