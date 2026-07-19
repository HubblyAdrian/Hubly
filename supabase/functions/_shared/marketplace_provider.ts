/** Provider assemble / ensure helpers — never duplicate Hubly business content. */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeMarketplaceScore } from "./marketplace_score.ts";

export type AdminClient = SupabaseClient;

export function adminClient(): AdminClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !serviceKey) throw new Error("Server isn’t configured yet.");
  return createClient(supabaseUrl, serviceKey);
}

export async function ensureProvider(
  admin: AdminClient,
  businessId: string,
  ownerId: string,
) {
  const { data: existing } = await admin
    .from("marketplace_providers")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("marketplace_providers")
    .insert({
      business_id: businessId,
      owner_id: ownerId,
      provider_kind: "hubly",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function refreshCalendarConnected(
  admin: AdminClient,
  businessId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("google_calendar_connections")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  const connected = !!data?.id;
  await admin
    .from("marketplace_providers")
    .update({ calendar_connected: connected, updated_at: new Date().toISOString() })
    .eq("business_id", businessId);
  return connected;
}

export async function recomputeProviderScore(
  admin: AdminClient,
  providerId: string,
) {
  const { data: provider } = await admin
    .from("marketplace_providers")
    .select("*")
    .eq("id", providerId)
    .maybeSingle();
  if (!provider) return null;

  const { data: business } = await admin
    .from("businesses")
    .select("id,name,logo_url,city,phone,meta,travel_radius_miles,banner_url,slug,business_type,tagline")
    .eq("id", provider.business_id)
    .maybeSingle();
  if (!business) return null;

  const calendarConnected = await refreshCalendarConnected(admin, provider.business_id);

  const { count } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("business_id", provider.business_id)
    .eq("status", "completed");

  const result = computeMarketplaceScore({
    business,
    provider: { ...provider, calendar_connected: calendarConnected },
    jobsCompleted: count || 0,
  });

  const { data: updated } = await admin
    .from("marketplace_providers")
    .update({
      marketplace_score: result.score,
      score_breakdown: result.breakdown,
      calendar_connected: calendarConnected,
      updated_at: new Date().toISOString(),
    })
    .eq("id", providerId)
    .select("*")
    .single();

  return updated;
}

/** Public-safe provider DTO — references Hubly business fields, no duplication. */
export function assembleProviderPublic(
  provider: Record<string, unknown>,
  business: Record<string, unknown>,
) {
  const meta = (business.meta || {}) as Record<string, unknown>;
  const website = (meta.website || {}) as Record<string, unknown>;
  const packages = Array.isArray(meta.editorSvcs)
    ? meta.editorSvcs
    : (Array.isArray(meta.services) ? meta.services : []);
  const reviews = Array.isArray(website.manualReviews) ? website.manualReviews : [];
  const faqs = Array.isArray(website.faq) ? website.faq : [];
  const photos = Array.isArray(meta.portfolioUrls)
    ? meta.portfolioUrls
    : (Array.isArray(meta.galleryPairs) ? meta.galleryPairs : []);

  return {
    id: provider.id,
    business_id: provider.business_id,
    marketplace_enabled: provider.marketplace_enabled,
    marketplace_status: provider.marketplace_status,
    verification_status: provider.verification_status,
    calendar_connected: provider.calendar_connected,
    marketplace_score: provider.marketplace_score,
    score_breakdown: provider.score_breakdown || {},
    accepting_new_jobs: provider.accepting_new_jobs,
    instant_booking: provider.instant_booking,
    accept_quote_requests: provider.accept_quote_requests,
    featured: provider.featured,
    response_time: provider.response_time_minutes,
    completion_rate: provider.completion_rate,
    cancellation_rate: provider.cancellation_rate,
    emergency_jobs: provider.emergency_jobs,
    weekend_jobs: provider.weekend_jobs,
    travel_radius_miles: provider.travel_radius_miles ?? business.travel_radius_miles ?? null,
    category: provider.category || business.business_type || null,
    provider_kind: provider.provider_kind,
    // Referenced Hubly profile (source of truth)
    profile: {
      name: business.name,
      slug: business.slug,
      tagline: business.tagline,
      logo_url: business.logo_url || meta.logoUrl || null,
      banner_url: business.banner_url || meta.bannerUrl || null,
      city: business.city,
      phone: business.phone,
      business_type: business.business_type,
      hours: meta.hours || null,
      packages,
      photos,
      reviews,
      faqs,
      service_area: {
        cities: business.service_area_cities || meta.serviceAreaCities || [],
        states: meta.serviceAreaStates || [],
        radius_miles: meta.serviceAreaRadiusMiles ?? business.travel_radius_miles ?? null,
      },
    },
  };
}
