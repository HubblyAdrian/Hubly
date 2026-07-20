/**
 * Marketplace API (foundation + AI-ready).
 *
 * Routes (under /functions/v1/marketplace):
 *   GET  /providers
 *   GET  /provider/:id
 *   GET  /provider/:id/document   — canonical AI provider document
 *   POST /provider/settings
 *   POST /provider/ops            — verify|reject|suspend|unsuspend|pending (ops secret)
 *   GET  /availability?business_id=|&provider_id=
 *   POST /book
 *   POST /request              — booking request (not quotes)
 *   POST /intake               — AI concierge (understand job → ask only gaps)
 *   POST /match                — top recommendations with why + browse-more
 *   POST /booking/catalog      — Shared Service Catalog for a provider
 *   POST /booking/slots        — real appointment slots
 *   POST /booking/create       — Booking Engine create (confirm or request)
 *   GET  /booking/:id          — confirmation payload
 *
 * Action-style POST also supports: me|document|ai_context|ops|rebuild_document|intake|match|
 * booking_catalog|booking_slots|booking_create|booking_get
 *
 * Vision: AI Concierge → match → Booking Engine (service → slot → pay → confirm).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPaymentSummary,
  createBooking,
  listCatalogServices,
  loadAvailabilityContext,
  publicCatalogPayload,
  resolveService,
  transitionBooking,
  type BookingStatus,
} from "../_shared/booking_engine.ts";
import { buildLiteDashboard } from "../_shared/marketplace_lite.ts";
import {
  buildOpsAnalytics,
  buildOpsOverview,
  buildOpsProvider360,
  listOpsBookings,
  listOpsProviders,
} from "../_shared/marketplace_ops.ts";
import { getAvailability } from "../_shared/marketplace_availability.ts";
import { buildProviderDocument } from "../_shared/marketplace_document.ts";
import { CORS, jsonRes, parsePath } from "../_shared/marketplace_http.ts";
import {
  INTAKE_SUGGESTED_PROMPTS,
  runMarketplaceIntake,
  type IntakeMessage,
} from "../_shared/marketplace_intake.ts";
import {
  buildLifecycleSnapshot,
  canAcceptMarketplaceLeads,
  isOwnerLockedStatus,
  isPubliclyListed,
  MARKETPLACE_STATUSES,
  normalizeMarketplaceStatus,
  resolveOwnerStatusTransition,
  verificationFromLifecycle,
  type MarketplaceStatus,
} from "../_shared/marketplace_lifecycle.ts";
import { rankMarketplaceMatches, type MatchNeed } from "../_shared/marketplace_match.ts";
import {
  adminClient,
  assembleProviderPublic,
  ensureProvider,
  recomputeProviderScore,
  refreshCalendarConnected,
} from "../_shared/marketplace_provider.ts";

function opsAuthorized(req: Request): boolean {
  const secret =
    (Deno.env.get("HUBLY_MARKETPLACE_OPS_SECRET") || "").trim() ||
    (Deno.env.get("HUBLY_CRON_SECRET") || "").trim();
  if (!secret) return false;
  const header = (req.headers.get("x-hubly-marketplace-ops") || "").trim();
  if (header && header === secret) return true;
  const auth = req.headers.get("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ") && auth.slice(7).trim() === secret) {
    return true;
  }
  return false;
}

async function loadJobsCompleted(
  admin: ReturnType<typeof adminClient>,
  businessId: string,
): Promise<number> {
  const { count } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "completed");
  return count || 0;
}

async function buildAvailabilityForBusiness(
  admin: ReturnType<typeof adminClient>,
  businessId: string,
  provider: Record<string, unknown> | null,
  business: Record<string, unknown>,
) {
  const meta = (business.meta || {}) as Record<string, unknown>;
  const hours = (meta.hours || null) as Record<
    string,
    { open?: string; close?: string; closed?: boolean }
  > | null;
  const googleConnected = !!(await refreshCalendarConnected(admin, businessId));
  const base = new Date().toISOString().slice(0, 10);
  const start = new Date(base + "T00:00:00.000Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 14);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data: jobs } = await admin
    .from("jobs")
    .select("scheduled_date,scheduled_time,duration_hours,status,service_name")
    .eq("business_id", businessId)
    .gte("scheduled_date", startStr)
    .lte("scheduled_date", endStr);

  let googleEvents: Record<string, unknown>[] = [];
  if (googleConnected) {
    const { data: ev } = await admin
      .from("google_calendar_events")
      .select(
        "start_at,end_at,all_day,local_date,local_start_time,duration_hours,summary,status",
      )
      .eq("business_id", businessId)
      .gte("start_at", new Date(startStr + "T00:00:00.000Z").toISOString())
      .lte("start_at", new Date(endStr + "T23:59:59.999Z").toISOString());
    googleEvents = ev || [];
  }

  return getAvailability({
    date: base,
    durationMinutes: 120,
    weekendJobs: provider?.weekend_jobs !== false,
    hours,
    jobs: jobs || [],
    googleEvents,
    googleConnected,
    outlookConnected: false,
    acceptingNewJobs: provider?.accepting_new_jobs !== false,
  });
}

async function rebuildAndCacheDocument(
  admin: ReturnType<typeof adminClient>,
  providerId: string,
) {
  const { data: provider } = await admin
    .from("marketplace_providers")
    .select("*")
    .eq("id", providerId)
    .maybeSingle();
  if (!provider) return null;

  const business = await loadBusinessBundle(admin, provider.business_id);
  if (!business) return null;

  const scored = await recomputeProviderScore(admin, providerId);
  const row = scored || provider;
  const availability = await buildAvailabilityForBusiness(
    admin,
    provider.business_id,
    row,
    business,
  );
  const jobsCompleted = await loadJobsCompleted(admin, provider.business_id);
  const document = buildProviderDocument({
    provider: row,
    business,
    availability,
    jobsCompleted,
  });

  await admin
    .from("marketplace_providers")
    .update({
      ai_document: document,
      ai_document_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", providerId);

  return document;
}

async function requireOwner(req: Request, businessId: string) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { error: jsonRes({ error: "Sign in required" }, 401) };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { error: jsonRes({ error: "Auth isn’t configured on the server yet." }, 500) };
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return { error: jsonRes({ error: "Your session expired — refresh and try again." }, 401) };
  }
  const admin = adminClient();
  const { data: biz } = await admin
    .from("businesses")
    .select("id,owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz || biz.owner_id !== userData.user.id) {
    return { error: jsonRes({ error: "Business not found" }, 404) };
  }
  return { user: userData.user, admin, biz };
}

async function loadBusinessBundle(admin: ReturnType<typeof adminClient>, businessId: string) {
  const { data: business } = await admin
    .from("businesses")
    .select(
      "id,owner_id,name,slug,tagline,logo_url,banner_url,city,phone,email,meta,travel_radius_miles,business_type,service_area_cities,timezone",
    )
    .eq("id", businessId)
    .maybeSingle();
  return business;
}

async function handleListProviders(admin: ReturnType<typeof adminClient>, search: URLSearchParams) {
  const category = (search.get("category") || "").trim();
  const featuredOnly = search.get("featured") === "1" || search.get("featured") === "true";
  const limit = Math.min(50, Math.max(1, Number(search.get("limit")) || 20));

  // Only Verified providers are publicly listed
  let q = admin
    .from("marketplace_providers")
    .select("*")
    .eq("marketplace_status", "verified")
    .order("featured", { ascending: false })
    .order("marketplace_score", { ascending: false })
    .limit(limit);

  if (category) q = q.eq("category", category);
  if (featuredOnly) q = q.eq("featured", true);

  const { data: providers, error } = await q;
  if (error) return jsonRes({ error: error.message }, 500);

  const ids = (providers || []).map((p) => p.business_id);
  if (!ids.length) return jsonRes({ providers: [] });

  const { data: businesses } = await admin
    .from("businesses")
    .select(
      "id,name,slug,tagline,logo_url,banner_url,city,phone,meta,travel_radius_miles,business_type,service_area_cities",
    )
    .in("id", ids);

  const byId = new Map((businesses || []).map((b) => [b.id, b]));
  const out = (providers || [])
    .map((p) => {
      const biz = byId.get(p.business_id);
      if (!biz) return null;
      return assembleProviderPublic(p, biz);
    })
    .filter(Boolean);

  return jsonRes({ providers: out });
}

async function handleGetProvider(
  admin: ReturnType<typeof adminClient>,
  id: string,
  opts?: { allowNonPublic?: boolean },
) {
  let providerQuery = admin.from("marketplace_providers").select("*");
  // Allow lookup by provider id or business id
  const { data: byProvider } = await providerQuery.eq("id", id).maybeSingle();
  let provider = byProvider;
  if (!provider) {
    const { data: byBiz } = await admin
      .from("marketplace_providers")
      .select("*")
      .eq("business_id", id)
      .maybeSingle();
    provider = byBiz;
  }
  if (!provider) return jsonRes({ error: "Provider not found" }, 404);

  const status = normalizeMarketplaceStatus(provider.marketplace_status);
  if (!opts?.allowNonPublic && !isPubliclyListed(status)) {
    return jsonRes({
      error: "Provider is not publicly listed",
      code: "not_public",
      marketplace_status: status,
    }, 404);
  }

  const business = await loadBusinessBundle(admin, provider.business_id);
  if (!business) return jsonRes({ error: "Provider not found" }, 404);

  return jsonRes({
    provider: assembleProviderPublic(provider, business),
  });
}

async function handleSettings(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return jsonRes({ error: "business_id required" }, 400);

  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { user, admin } = auth as {
    user: { id: string };
    admin: ReturnType<typeof adminClient>;
  };

  const provider = await ensureProvider(admin, businessId, user.id);
  await refreshCalendarConnected(admin, businessId);

  const currentStatus = normalizeMarketplaceStatus(provider.marketplace_status);
  if (isOwnerLockedStatus(currentStatus)) {
    return jsonRes({
      error: `Marketplace is ${currentStatus} — contact Hubly support to change this.`,
      code: "owner_locked",
      marketplace_status: currentStatus,
    }, 403);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    settings_updated_at: new Date().toISOString(),
  };

  const boolKeys = [
    "accepting_new_jobs",
    "instant_booking",
    "accept_quote_requests",
    "featured",
    "emergency_jobs",
    "weekend_jobs",
  ] as const;
  for (const k of boolKeys) {
    if (body[k] !== undefined) patch[k] = !!body[k];
  }
  if (body.travel_radius_miles !== undefined) {
    const n = Number(body.travel_radius_miles);
    patch.travel_radius_miles = Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  }
  if (body.category !== undefined) {
    patch.category = String(body.category || "").trim() || null;
  }

  // Lifecycle transitions from owner controls
  const previouslyVerified = !!(provider.verified_at || currentStatus === "verified" ||
    currentStatus === "paused");
  let nextStatus: MarketplaceStatus = currentStatus;

  if (body.marketplace_status !== undefined) {
    const requested = normalizeMarketplaceStatus(body.marketplace_status);
    // Owners may set: draft, hidden, pending_verification, verified (resume), paused
    // Not suspended/rejected
    if (isOwnerLockedStatus(requested)) {
      return jsonRes({ error: "Owners cannot set suspended or rejected" }, 403);
    }
    if ((MARKETPLACE_STATUSES as readonly string[]).includes(requested)) {
      nextStatus = requested;
    }
  } else if (body.marketplace_enabled !== undefined || body.pause !== undefined) {
    nextStatus = resolveOwnerStatusTransition({
      current: currentStatus,
      showInMarketplace: body.marketplace_enabled !== undefined
        ? !!body.marketplace_enabled
        : (currentStatus !== "draft" && currentStatus !== "hidden"),
      pause: body.pause !== undefined ? !!body.pause : undefined,
      previouslyVerified,
    });
  }

  if (nextStatus !== currentStatus) {
    patch.marketplace_status = nextStatus;
    patch.status_changed_at = new Date().toISOString();
    patch.verification_status = verificationFromLifecycle(nextStatus);
    if (nextStatus === "verified" && !provider.verified_at) {
      patch.verified_at = new Date().toISOString();
    }
  }
  // Keep marketplace_enabled mirrored for legacy readers
  patch.marketplace_enabled = nextStatus === "verified" || nextStatus === "pending_verification" ||
    nextStatus === "paused";

  const { data: updated, error } = await admin
    .from("marketplace_providers")
    .update(patch)
    .eq("id", provider.id)
    .select("*")
    .single();
  if (error) return jsonRes({ error: error.message }, 500);

  const document = await rebuildAndCacheDocument(admin, updated.id);
  const business = await loadBusinessBundle(admin, businessId);
  const { data: fresh } = await admin
    .from("marketplace_providers")
    .select("*")
    .eq("id", updated.id)
    .maybeSingle();

  return jsonRes({
    ok: true,
    provider: assembleProviderPublic(fresh || updated, business || {}),
    document,
  });
}

async function handleAvailability(
  admin: ReturnType<typeof adminClient>,
  search: URLSearchParams,
  body?: Record<string, unknown>,
) {
  const businessId = String(
    search.get("business_id") || body?.business_id || "",
  ).trim();
  const providerId = String(
    search.get("provider_id") || body?.provider_id || "",
  ).trim();
  const date = String(search.get("date") || body?.date || "").trim() || null;
  const durationMinutes = Number(
    search.get("duration_minutes") || body?.duration_minutes || 120,
  );

  let bizId = businessId;
  let provider: Record<string, unknown> | null = null;
  if (providerId) {
    const { data } = await admin.from("marketplace_providers").select("*").eq("id", providerId)
      .maybeSingle();
    provider = data;
    if (provider) bizId = String(provider.business_id);
  }
  if (!bizId) return jsonRes({ error: "business_id or provider_id required" }, 400);

  if (!provider) {
    const { data } = await admin.from("marketplace_providers").select("*").eq("business_id", bizId)
      .maybeSingle();
    provider = data;
  }

  const business = await loadBusinessBundle(admin, bizId);
  if (!business) return jsonRes({ error: "Business not found" }, 404);

  const meta = (business.meta || {}) as Record<string, unknown>;
  const hours = (meta.hours || null) as Record<string, { open?: string; close?: string; closed?: boolean }> | null;

  const googleConnected = !!(await refreshCalendarConnected(admin, bizId));

  // Load jobs ±14 days around target
  const base = date || new Date().toISOString().slice(0, 10);
  const start = new Date(base + "T00:00:00.000Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 14);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data: jobs } = await admin
    .from("jobs")
    .select("scheduled_date,scheduled_time,duration_hours,status,service_name")
    .eq("business_id", bizId)
    .gte("scheduled_date", startStr)
    .lte("scheduled_date", endStr);

  let googleEvents: Record<string, unknown>[] = [];
  if (googleConnected) {
    const { data: ev } = await admin
      .from("google_calendar_events")
      .select(
        "start_at,end_at,all_day,local_date,local_start_time,duration_hours,summary,status",
      )
      .eq("business_id", bizId)
      .gte("start_at", new Date(startStr + "T00:00:00.000Z").toISOString())
      .lte("start_at", new Date(endStr + "T23:59:59.999Z").toISOString());
    googleEvents = ev || [];
  }

  const life = provider ? buildLifecycleSnapshot(provider) : null;
  // Calendar engine always runs; marketplace lead acceptance is a separate flag.
  const marketplaceAccepting = !!(life && life.can_accept_leads);

  const result = getAvailability({
    date: base,
    durationMinutes,
    weekendJobs: provider?.weekend_jobs !== false,
    hours,
    jobs: jobs || [],
    googleEvents,
    googleConnected,
    outlookConnected: false, // Outlook Connect not shipped yet
    acceptingNewJobs: provider?.accepting_new_jobs !== false,
  });

  return jsonRes({
    business_id: bizId,
    provider_id: provider?.id || null,
    marketplace_status: life?.status || null,
    lifecycle: life,
    marketplace_accepting: marketplaceAccepting,
    available: marketplaceAccepting ? result.available : false,
    nextAvailable: marketplaceAccepting ? result.nextAvailable : null,
    blockedTimes: result.blockedTimes,
    sources: result.sources,
    calendar_available: result.available,
    calendar_next_available: result.nextAvailable,
  });
}

async function resolveProviderRow(
  admin: ReturnType<typeof adminClient>,
  bodyOrId: Record<string, unknown> | string,
) {
  if (typeof bodyOrId === "string") {
    const id = bodyOrId.trim();
    if (!id) return null;
    const { data: byProvider } = await admin
      .from("marketplace_providers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (byProvider) return byProvider;
    const { data: byBiz } = await admin
      .from("marketplace_providers")
      .select("*")
      .eq("business_id", id)
      .maybeSingle();
    return byBiz;
  }
  const providerId = String(bodyOrId.provider_id || "").trim();
  const businessId = String(bodyOrId.business_id || "").trim();
  if (providerId) {
    const { data } = await admin.from("marketplace_providers").select("*").eq("id", providerId)
      .maybeSingle();
    return data;
  }
  if (businessId) {
    const { data } = await admin.from("marketplace_providers").select("*").eq("business_id", businessId)
      .maybeSingle();
    return data;
  }
  return null;
}

/** Phase 4 — Shared Service Catalog for booking step 2 */
async function handleBookingCatalog(
  admin: ReturnType<typeof adminClient>,
  body: Record<string, unknown>,
) {
  const provider = await resolveProviderRow(admin, body);
  if (!provider) return jsonRes({ error: "Provider not found" }, 404);
  const business = await loadBusinessBundle(admin, String(provider.business_id));
  if (!business) return jsonRes({ error: "Business not found" }, 404);
  const life = buildLifecycleSnapshot(provider);
  const pub = assembleProviderPublic(provider, business);
  const catalog = publicCatalogPayload(business);
  const recommendedId = String(body.service_id || body.recommended_service_id || "").trim();
  let recommended = recommendedId ? resolveService(business, recommendedId) : null;
  if (!recommended && body.service_name) {
    recommended = resolveService(business, String(body.service_name));
  }
  if (!recommended && catalog.services.length) {
    const needle = normalize(String(body.service_hint || body.need_service || ""));
    if (needle) {
      recommended = catalog.services.find((s) =>
        normalize(s.name).includes(needle) || needle.includes(normalize(s.name))
      ) || null;
    }
  }
  return jsonRes({
    ok: true,
    provider: {
      id: provider.id,
      business_id: provider.business_id,
      name: pub.profile.name,
      logo_url: pub.profile.logo_url,
      verified: life.status === "verified",
      instant_book: life.can_instant_book,
      trust: {
        verified: life.status === "verified",
        insured: !!pub.insurance_verified,
        licensed: !!pub.license_verified,
        instant_book: life.can_instant_book,
      },
      why: Array.isArray(body.why) ? body.why.map(String) : [],
    },
    recommended_service_id: recommended?.id || catalog.services[0]?.id || null,
    ...catalog,
  });
}

function normalize(s: string): string {
  return String(s || "").toLowerCase().trim();
}

/** Phase 4 — real appointment slots for a service */
async function handleBookingSlots(
  admin: ReturnType<typeof adminClient>,
  body: Record<string, unknown>,
) {
  const provider = await resolveProviderRow(admin, body);
  if (!provider) return jsonRes({ error: "Provider not found" }, 404);
  const business = await loadBusinessBundle(admin, String(provider.business_id));
  if (!business) return jsonRes({ error: "Business not found" }, 404);

  const serviceId = String(body.service_id || "").trim();
  const service = serviceId
    ? resolveService(business, serviceId)
    : listCatalogServices(business)[0] || null;
  if (!service) return jsonRes({ error: "No bookable services on this provider" }, 400);

  const life = buildLifecycleSnapshot(provider);
  if (!life.can_accept_leads) {
    return jsonRes({ ok: true, service, slots: [], available: false, nextAvailable: null });
  }

  const ctx = await loadAvailabilityContext(
    admin,
    String(provider.business_id),
    provider,
    service.duration_minutes,
    String(body.date || "").trim() || null,
  );

  // Group by date for the UI
  const byDate: Record<string, typeof ctx.slots> = {};
  for (const s of ctx.slots) {
    (byDate[s.date] || (byDate[s.date] = [])).push(s);
  }

  return jsonRes({
    ok: true,
    service,
    available: ctx.slots.length > 0,
    nextAvailable: ctx.result.nextAvailable,
    slots: ctx.slots.slice(0, 80),
    days: Object.keys(byDate).sort().map((date) => ({
      date,
      slots: byDate[date],
    })),
    sources: ctx.result.sources,
    payment: buildPaymentSummary(business, service.price_cents),
  });
}

/** Phase 4 — Booking Engine create */
async function handleBookingCreate(
  admin: ReturnType<typeof adminClient>,
  body: Record<string, unknown>,
) {
  const provider = await resolveProviderRow(admin, body);
  if (!provider) return jsonRes({ error: "Provider not found" }, 404);
  const business = await loadBusinessBundle(admin, String(provider.business_id));
  if (!business) return jsonRes({ error: "Business not found" }, 404);

  try {
    const { booking, confirmation } = await createBooking(admin, {
      provider,
      business,
      service_id: String(body.service_id || "").trim(),
      starts_at: String(body.starts_at || "").trim(),
      customer: {
        name: String(body.customer_name || body.name || "").trim(),
        email: String(body.customer_email || body.email || "").trim() || null,
        phone: String(body.customer_phone || body.phone || "").trim() || null,
        address: String(body.address || "").trim() || null,
      },
      add_on_ids: Array.isArray(body.add_on_ids)
        ? body.add_on_ids.map(String)
        : [],
      notes: String(body.notes || "").trim() || null,
      channel: "marketplace",
      match_why: Array.isArray(body.why) ? body.why.map(String) : [],
    });

    return jsonRes({
      ok: true,
      booking,
      confirmation,
      checkout: confirmation.payment.requires_checkout
        ? {
          required: true,
          amount_cents: confirmation.payment.charge_now_cents,
          charge_kind: confirmation.payment.rule === "pay_in_full" ? "full" : "deposit",
          // Client calls create-booking-checkout with marketplace booking id
          hint: "Invoke create-booking-checkout with booking metadata",
        }
        : { required: false },
    }, 201);
  } catch (e) {
    return jsonRes({ error: (e as Error)?.message || "Could not create booking" }, 400);
  }
}

async function handleBookingGet(
  admin: ReturnType<typeof adminClient>,
  id: string,
) {
  const { data: booking, error } = await admin
    .from("marketplace_bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonRes({ error: error.message }, 500);
  if (!booking) return jsonRes({ error: "Booking not found" }, 404);

  const { data: business } = await admin
    .from("businesses")
    .select("id,name,phone,city")
    .eq("id", booking.business_id)
    .maybeSingle();

  const snap = (booking.service_snapshot || {}) as Record<string, unknown>;
  const payment = {
    rule: booking.payment_rule,
    price_cents: booking.price_cents,
    deposit_cents: booking.deposit_cents,
    amount_paid_cents: booking.amount_paid_cents,
    payment_status: booking.payment_status,
  };

  return jsonRes({
    ok: true,
    confirmation: {
      booking_id: booking.id,
      confirmation_code: booking.confirmation_code,
      status: booking.status,
      instant_book: booking.instant_book,
      headline: booking.status === "confirmed" ? "Booking confirmed" : "Booking request sent",
      provider: {
        id: booking.provider_id,
        business_id: booking.business_id,
        name: business?.name || "Provider",
        phone: business?.phone || null,
      },
      service: {
        id: booking.service_id,
        name: booking.service_name,
        duration_minutes: booking.duration_minutes,
      },
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      address: booking.address,
      payment,
      what_happens_next: booking.what_happens_next,
      why_matched: Array.isArray(snap.why_matched) ? snap.why_matched : [],
    },
  });
}

/** Owner: list marketplace bookings for management */
async function handleBookingList(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return jsonRes({ error: "business_id required" }, 400);
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { admin } = auth as { admin: ReturnType<typeof adminClient> };

  const status = String(body.status || "").trim();
  let q = admin
    .from("marketplace_bookings")
    .select("*")
    .eq("business_id", businessId)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ ok: true, bookings: data || [] });
}

/** Owner: accept (confirm) or decline (cancel) a marketplace booking */
async function handleBookingTransition(
  req: Request,
  body: Record<string, unknown>,
  to: BookingStatus,
) {
  const businessId = String(body.business_id || "").trim();
  const bookingId = String(body.booking_id || body.id || "").trim();
  if (!businessId) return jsonRes({ error: "business_id required" }, 400);
  if (!bookingId) return jsonRes({ error: "booking_id required" }, 400);
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { admin } = auth as { admin: ReturnType<typeof adminClient> };

  try {
    const booking = await transitionBooking(admin, {
      booking_id: bookingId,
      business_id: businessId,
      to,
    });
    return jsonRes({ ok: true, booking });
  } catch (e) {
    return jsonRes({ error: (e as Error)?.message || "Could not update booking" }, 400);
  }
}

async function handleBook(admin: ReturnType<typeof adminClient>, body: Record<string, unknown>) {
  // Prefer Booking Engine when service + appointment are present
  if (body.service_id && body.starts_at) {
    return await handleBookingCreate(admin, body);
  }

  const provider = await resolveProviderRow(admin, body);
  if (!provider) {
    return jsonRes({ error: "Provider is not accepting marketplace bookings" }, 400);
  }
  const bookLife = buildLifecycleSnapshot(provider);
  if (!bookLife.can_instant_book) {
    return jsonRes({
      error: bookLife.status !== "verified"
        ? `Provider status is ${bookLife.label} — only Verified providers accept instant bookings`
        : (!provider.accepting_new_jobs
          ? "Provider is not accepting new jobs"
          : "Instant booking is off — use Request Booking instead"),
      code: "not_accepting_instant_book",
      marketplace_status: bookLife.status,
      lifecycle: bookLife,
    }, 400);
  }

  const customerName = String(body.customer_name || body.name || "").trim();
  if (!customerName) return jsonRes({ error: "customer_name required" }, 400);

  // Legacy thin book → engine statuses
  const { data, error } = await admin
    .from("marketplace_bookings")
    .insert({
      provider_id: provider.id,
      business_id: provider.business_id,
      customer_name: customerName,
      customer_email: String(body.customer_email || body.email || "").trim() || null,
      customer_phone: String(body.customer_phone || body.phone || "").trim() || null,
      service_name: String(body.service_name || "").trim() || null,
      requested_date: String(body.requested_date || body.date || "").trim() || null,
      requested_time: String(body.requested_time || body.time || "").trim() || null,
      address: String(body.address || "").trim() || null,
      notes: String(body.notes || "").trim() || null,
      status: "confirmed",
      instant_book: true,
      channel: "marketplace",
      confirmation_code: `H${Date.now().toString(36).toUpperCase().slice(-7)}`,
      what_happens_next:
        "You’re all set. The provider has your booking and will follow up with final details.",
    })
    .select("*")
    .single();

  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ ok: true, booking: data }, 201);
}

async function handleRequest(admin: ReturnType<typeof adminClient>, body: Record<string, unknown>) {
  const providerId = String(body.provider_id || "").trim();
  const businessId = String(body.business_id || "").trim();
  if (!providerId && !businessId) {
    return jsonRes({ error: "provider_id or business_id required" }, 400);
  }

  let provider;
  if (providerId) {
    const { data } = await admin.from("marketplace_providers").select("*").eq("id", providerId)
      .maybeSingle();
    provider = data;
  } else {
    const { data } = await admin.from("marketplace_providers").select("*").eq("business_id", businessId)
      .maybeSingle();
    provider = data;
  }
  if (!provider) {
    return jsonRes({ error: "Provider is not accepting marketplace requests" }, 400);
  }
  const reqLife = buildLifecycleSnapshot(provider);
  if (!reqLife.can_quote_request) {
    return jsonRes({
      error: reqLife.status !== "verified"
        ? `Provider status is ${reqLife.label} — only Verified providers accept booking requests`
        : (!provider.accepting_new_jobs
          ? "Provider is not accepting new jobs"
          : "Provider is not accepting booking requests"),
      code: "not_accepting_booking_requests",
      marketplace_status: reqLife.status,
      lifecycle: reqLife,
    }, 400);
  }

  const customerName = String(body.customer_name || body.name || "").trim();
  if (!customerName) return jsonRes({ error: "customer_name required" }, 400);

  const { data, error } = await admin
    .from("marketplace_requests")
    .insert({
      provider_id: provider.id,
      business_id: provider.business_id,
      customer_name: customerName,
      customer_email: String(body.customer_email || body.email || "").trim() || null,
      customer_phone: String(body.customer_phone || body.phone || "").trim() || null,
      service_interest: String(body.service_interest || body.service_name || "").trim() || null,
      preferred_date: String(body.preferred_date || body.date || "").trim() || null,
      message: String(body.message || body.notes || "").trim() || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) return jsonRes({ error: error.message }, 500);
  // Booking terminology — not quotes/estimates
  return jsonRes({ ok: true, booking_request: data, request: data }, 201);
}

async function handleIntake(body: Record<string, unknown>) {
  const messagesRaw = Array.isArray(body.messages) ? body.messages : [];
  const messages: IntakeMessage[] = messagesRaw
    .map((m) => {
      const row = m && typeof m === "object" ? m as Record<string, unknown> : {};
      const role = row.role === "assistant" ? "assistant" : "user";
      const content = String(row.content || "").trim();
      return content ? { role, content } as IntakeMessage : null;
    })
    .filter(Boolean) as IntakeMessage[];

  // Convenience: single prompt field
  const prompt = String(body.prompt || body.message || body.text || "").trim();
  if (!messages.length && prompt) {
    messages.push({ role: "user", content: prompt });
  }
  if (!messages.length) {
    return jsonRes({
      ok: true,
      reply: "What can we help you get done today?",
      ready_to_confirm: false,
      ready_to_match: false,
      confidence: 0,
      need: {
        category: null,
        service_text: null,
        city: null,
        when: null,
        residential: null,
        scope: null,
        notes: null,
        service: null,
        add_ons: [],
        possible_add_ons: [],
        priority: null,
        preferences: {
          budget_conscious: false,
          fastest_appointment: false,
          premium_quality: false,
          eco_friendly: false,
          mobile_only: false,
          weekend_preferred: false,
        },
        duration_estimate: null,
        vehicle_type: null,
      },
      job: {
        industry: null,
        category: null,
        service: null,
        add_ons: [],
        possible_add_ons: [],
        priority: null,
        vehicle_type: null,
        property_type: null,
        understanding_summary: null,
        known: [],
        missing: [],
        advisor_reason: null,
        add_on_reasons: {},
        duration_estimate: null,
        preferences: {
          budget_conscious: false,
          fastest_appointment: false,
          premium_quality: false,
          eco_friendly: false,
          mobile_only: false,
          weekend_preferred: false,
        },
        confirmation_bullets: [],
      },
      booking: {
        title: "Building Your Booking",
        fields: [],
        checklist: [],
      },
      confirmation: null,
      follow_ups: [],
      suggested_prompts: INTAKE_SUGGESTED_PROMPTS,
      ux: {
        entry: "What can we help you get done today?",
        placeholder: "Describe what you need...",
        philosophy: "reduce_uncertainty_end_conversation",
      },
    });
  }

  const cityHint = String(body.city || body.city_hint || "").trim() || null;
  const result = await runMarketplaceIntake({ messages, cityHint });
  return jsonRes({
    ok: true,
    ...result,
    suggested_prompts: result.suggested_prompts || INTAKE_SUGGESTED_PROMPTS,
    ux: {
      entry: "What can we help you get done today?",
      placeholder: "Describe what you need...",
      philosophy: "reduce_uncertainty_end_conversation",
      next: result.ready_to_confirm
        ? "confirm"
        : (result.follow_ups?.length ? "follow_up" : "continue"),
    },
  });
}

async function handleMatch(
  admin: ReturnType<typeof adminClient>,
  body: Record<string, unknown>,
) {
  const needIn = (body.need && typeof body.need === "object"
    ? body.need
    : body) as Record<string, unknown>;
  const prefsIn = (needIn.preferences && typeof needIn.preferences === "object"
    ? needIn.preferences
    : {}) as Record<string, unknown>;
  const need: MatchNeed = {
    category: needIn.category ? String(needIn.category) : null,
    service_text: needIn.service_text
      ? String(needIn.service_text)
      : (needIn.prompt ? String(needIn.prompt) : null),
    city: needIn.city ? String(needIn.city) : null,
    when: needIn.when ? String(needIn.when) : null,
    residential: typeof needIn.residential === "boolean" ? needIn.residential : null,
    scope: needIn.scope ? String(needIn.scope) : null,
    notes: needIn.notes ? String(needIn.notes) : null,
    service: needIn.service ? String(needIn.service) : null,
    add_ons: Array.isArray(needIn.add_ons)
      ? needIn.add_ons.map((x) => String(x)).filter(Boolean)
      : null,
    priority: needIn.priority ? String(needIn.priority) : null,
    duration_estimate: needIn.duration_estimate ? String(needIn.duration_estimate) : null,
    vehicle_type: needIn.vehicle_type
      ? String(needIn.vehicle_type)
      : null,
    preferences: {
      budget_conscious: !!prefsIn.budget_conscious,
      fastest_appointment: !!prefsIn.fastest_appointment,
      premium_quality: !!prefsIn.premium_quality,
      eco_friendly: !!prefsIn.eco_friendly,
      mobile_only: !!prefsIn.mobile_only,
      weekend_preferred: !!prefsIn.weekend_preferred,
    },
  };

  const { data: providers, error } = await admin
    .from("marketplace_providers")
    .select("*")
    .eq("marketplace_status", "verified")
    .eq("accepting_new_jobs", true)
    .limit(40);
  if (error) return jsonRes({ error: error.message }, 500);

  const ids = (providers || []).map((p) => p.business_id);
  if (!ids.length) {
    return jsonRes({
      ok: true,
      headline: "We couldn’t find a strong match yet — try a bit more detail.",
      subhead: "Add a city, timing, or a bit more detail and I’ll try again.",
      decision: null,
      explanation: {
        intro: "We checked calendars and fit — but couldn’t find a strong bookable match yet.",
        looked_for_heading: "Before recommending anyone, we look for businesses that:",
        criteria: [
          "Match your exact request",
          "Have real calendar availability",
          "Can get you booked quickly",
        ],
        outro: "Add a city, timing, or a bit more detail and I’ll try again.",
      },
      role_ladder: ["Best Match", "Fastest Availability", "Best Value", "Browse More"],
      recommendations: [],
      more_providers: [],
      more_label: "Browse more providers that may also be a good fit",
      matches: [],
      need,
    });
  }

  const { data: businesses } = await admin
    .from("businesses")
    .select(
      "id,name,slug,tagline,logo_url,banner_url,city,phone,email,meta,travel_radius_miles,business_type,service_area_cities",
    )
    .in("id", ids);
  const byId = new Map((businesses || []).map((b) => [b.id, b]));

  const rows = [];
  for (const p of providers || []) {
    const biz = byId.get(p.business_id);
    if (!biz) continue;
    // Filter by category when known
    if (need.category) {
      const cat = String(p.category || biz.business_type || "").toLowerCase();
      if (cat && cat !== String(need.category).toLowerCase()) {
        // soft filter — still allow if service_text might match; skip hard miss
        const svc = String(need.service_text || "").toLowerCase();
        if (svc && !svc.includes(cat.split("-")[0]) && !cat.includes(svc.slice(0, 4))) {
          continue;
        }
      }
    }
    let availability = null;
    try {
      availability = await buildAvailabilityForBusiness(admin, p.business_id, p, biz);
    } catch (e) {
      console.warn("match availability", e);
    }
    rows.push({ provider: p, business: biz, availability });
  }

  const ranked = rankMarketplaceMatches({
    need,
    providers: rows,
    primary_limit: 3,
    total_limit: 6,
  });

  // Strip internal scoring from customer-facing payload
  const publicCard = (c: (typeof ranked.recommendations)[number]) => {
    const { _internal, match_percent: _pct, ...rest } = c;
    return rest;
  };

  return jsonRes({
    ok: true,
    headline: ranked.headline,
    subhead: ranked.subhead,
    decision: ranked.decision,
    explanation: ranked.explanation,
    role_ladder: ranked.role_ladder,
    recommendations: ranked.recommendations.map(publicCard),
    more_providers: ranked.more_providers.map(publicCard),
    more_label: ranked.more_label,
    matches: ranked.matches.map(publicCard),
    need: ranked.need,
    cta_labels: {
      primary: "Book Now",
      secondary: "Request Booking",
      schedule: "Schedule Service",
    },
    ux: {
      philosophy: "best_provider_for_this_job",
      primary_count: 3,
      role_ladder: ranked.role_ladder,
      browse_more: true,
      trust_indicators: true,
      job_specific_labels: true,
      match_explanation: true,
      avoid: [
        "search bars",
        "category grids",
        "maps",
        "endless cards",
        "match percentages",
        "quote requests",
        "algorithmic sorting feel",
        "generic Best Overall labels",
      ],
    },
  });
}

async function handleOwnerGet(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return jsonRes({ error: "business_id required" }, 400);
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { user, admin } = auth as {
    user: { id: string };
    admin: ReturnType<typeof adminClient>;
  };
  const provider = await ensureProvider(admin, businessId, user.id);
  const document = await rebuildAndCacheDocument(admin, provider.id);
  const business = await loadBusinessBundle(admin, businessId);
  const { data: fresh } = await admin
    .from("marketplace_providers")
    .select("*")
    .eq("id", provider.id)
    .maybeSingle();
  return jsonRes({
    provider: assembleProviderPublic(fresh || provider, business || {}),
    document,
  });
}

async function handleDocument(
  req: Request,
  admin: ReturnType<typeof adminClient>,
  id: string,
  opts?: { rebuild?: boolean; body?: Record<string, unknown> },
) {
  const provider = await resolveProviderRow(admin, id);
  if (!provider) return jsonRes({ error: "Provider not found" }, 404);

  const status = normalizeMarketplaceStatus(provider.marketplace_status);
  const businessId = String(provider.business_id);
  const isOwner = !!(opts?.body?.business_id && req.headers.get("Authorization"));
  let ownerOk = false;
  if (isOwner) {
    const auth = await requireOwner(req, String(opts?.body?.business_id || businessId));
    ownerOk = !("error" in auth && auth.error);
  }
  const opsOk = opsAuthorized(req);

  // Public may only read documents for verified providers
  if (!isPubliclyListed(status) && !ownerOk && !opsOk) {
    return jsonRes({
      error: "Provider document is not public",
      code: "not_public",
      marketplace_status: status,
    }, 404);
  }

  if (opts?.rebuild || !provider.ai_document) {
    const document = await rebuildAndCacheDocument(admin, provider.id);
    return jsonRes({ ok: true, document });
  }

  return jsonRes({
    ok: true,
    document: provider.ai_document,
    cached: true,
    ai_document_updated_at: provider.ai_document_updated_at || null,
  });
}

async function handleOps(req: Request, body: Record<string, unknown>) {
  if (!opsAuthorized(req)) {
    return jsonRes({
      error: "Ops authorization required (x-hubly-marketplace-ops or HUBLY_MARKETPLACE_OPS_SECRET)",
      code: "ops_unauthorized",
    }, 401);
  }

  const admin = adminClient();
  const id = String(body.provider_id || body.business_id || body.id || "").trim();
  const op = String(body.op || body.status_action || "").trim().toLowerCase();
  if (!id) return jsonRes({ error: "provider_id or business_id required" }, 400);

  const provider = await resolveProviderRow(admin, id);
  if (!provider) return jsonRes({ error: "Provider not found" }, 404);

  const reason = String(body.reason || body.status_reason || "").trim() || null;
  const reviewedBy = String(body.reviewed_by || "ops").trim() || "ops";
  const now = new Date().toISOString();

  let next: MarketplaceStatus | null = null;
  if (op === "verify" || op === "verified") next = "verified";
  else if (op === "reject" || op === "rejected") next = "rejected";
  else if (op === "suspend" || op === "suspended") next = "suspended";
  else if (op === "unsuspend" || op === "pending" || op === "pending_verification") {
    next = "pending_verification";
  }   else if (op === "pause" || op === "paused") next = "paused";
  else if (op === "hide" || op === "hidden") next = "hidden";
  else if (op === "draft") next = "draft";
  else if (op === "request_changes" || op === "changes") next = "pending_verification";
  else {
    return jsonRes({
      error: "op must be verify|reject|suspend|unsuspend|pending|pause|hide|draft|request_changes",
    }, 400);
  }

  const patch: Record<string, unknown> = {
    marketplace_status: next,
    verification_status: verificationFromLifecycle(next),
    status_changed_at: now,
    status_reason: reason,
    reviewed_at: now,
    reviewed_by: reviewedBy,
    updated_at: now,
    marketplace_enabled: next === "verified" || next === "pending_verification" ||
      next === "paused",
  };
  if (next === "verified") {
    patch.verified_at = provider.verified_at || now;
  }

  const { data: updated, error } = await admin
    .from("marketplace_providers")
    .update(patch)
    .eq("id", provider.id)
    .select("*")
    .single();
  if (error) return jsonRes({ error: error.message }, 500);

  const document = await rebuildAndCacheDocument(admin, updated.id);
  return jsonRes({
    ok: true,
    op,
    marketplace_status: next,
    provider: assembleProviderPublic(
      updated,
      (await loadBusinessBundle(admin, updated.business_id)) || {},
    ),
    document,
  });
}

/** Provider Experience (Marketplace Lite) — dashboard summary */
async function handleLiteDashboard(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return jsonRes({ error: "business_id required" }, 400);
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { admin, user } = auth as {
    admin: ReturnType<typeof adminClient>;
    user: { id: string };
  };

  const provider = await ensureProvider(admin, businessId, user.id);
  const business = await loadBusinessBundle(admin, businessId);
  if (!business) return jsonRes({ error: "Business not found" }, 404);
  const document = await rebuildAndCacheDocument(admin, provider.id).catch(() => null);
  const dashboard = await buildLiteDashboard(admin, {
    provider,
    business,
    document: document as Record<string, unknown> | null,
  });
  return jsonRes({
    ok: true,
    provider: assembleProviderPublic(provider, business),
    document,
    dashboard,
  });
}

/** Provider Experience (Marketplace Lite) — booking conversations */
async function handleConversationList(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return jsonRes({ error: "business_id required" }, 400);
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { admin } = auth as { admin: ReturnType<typeof adminClient> };

  const { data: convos, error } = await admin
    .from("marketplace_conversations")
    .select("*")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return jsonRes({ error: error.message }, 500);

  const bookingIds = (convos || []).map((c) => c.booking_id).filter(Boolean);
  let bookingsById = new Map<string, Record<string, unknown>>();
  if (bookingIds.length) {
    const { data: books } = await admin
      .from("marketplace_bookings")
      .select("id,customer_name,service_name,status,starts_at,confirmation_code")
      .in("id", bookingIds);
    bookingsById = new Map((books || []).map((b) => [String(b.id), b]));
  }

  // Last message preview
  const out = [];
  for (const c of convos || []) {
    const { data: last } = await admin
      .from("marketplace_messages")
      .select("body,created_at,sender_role")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const booking = c.booking_id ? bookingsById.get(String(c.booking_id)) : null;
    out.push({
      ...c,
      booking,
      last_message: last || null,
    });
  }

  return jsonRes({ ok: true, conversations: out });
}

async function handleMessageList(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  const conversationId = String(body.conversation_id || "").trim();
  if (!businessId || !conversationId) {
    return jsonRes({ error: "business_id and conversation_id required" }, 400);
  }
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { admin } = auth as { admin: ReturnType<typeof adminClient> };

  const { data: convo } = await admin
    .from("marketplace_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!convo) return jsonRes({ error: "Conversation not found" }, 404);

  const { data: messages, error } = await admin
    .from("marketplace_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return jsonRes({ error: error.message }, 500);

  return jsonRes({ ok: true, conversation: convo, messages: messages || [] });
}

async function handleMessageSend(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  const conversationId = String(body.conversation_id || "").trim();
  const text = String(body.body || body.message || "").trim();
  if (!businessId || !conversationId) {
    return jsonRes({ error: "business_id and conversation_id required" }, 400);
  }
  if (!text) return jsonRes({ error: "message body required" }, 400);
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { admin } = auth as { admin: ReturnType<typeof adminClient> };

  const { data: convo } = await admin
    .from("marketplace_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!convo) return jsonRes({ error: "Conversation not found" }, 404);

  const photos = Array.isArray(body.photo_urls)
    ? body.photo_urls.map(String).filter(Boolean).slice(0, 6)
    : [];

  const { data: msg, error } = await admin
    .from("marketplace_messages")
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      booking_id: convo.booking_id || null,
      sender_role: "provider",
      body: text,
      photo_urls: photos,
    })
    .select("*")
    .single();
  if (error) return jsonRes({ error: error.message }, 500);

  await admin.from("marketplace_conversations").update({
    updated_at: new Date().toISOString(),
  }).eq("id", conversationId);

  return jsonRes({ ok: true, message: msg }, 201);
}

/** Save services into Shared Service Catalog (businesses.meta.editorSvcs) */
async function handleLiteServicesSave(req: Request, body: Record<string, unknown>) {
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return jsonRes({ error: "business_id required" }, 400);
  const auth = await requireOwner(req, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const { admin } = auth as { admin: ReturnType<typeof adminClient> };

  const servicesIn = Array.isArray(body.services) ? body.services : null;
  if (!servicesIn) return jsonRes({ error: "services array required" }, 400);

  const { data: business, error } = await admin
    .from("businesses")
    .select("id,meta")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !business) return jsonRes({ error: "Business not found" }, 404);

  const meta = { ...((business.meta || {}) as Record<string, unknown>) };
  const cleaned = servicesIn.slice(0, 40).map((raw, i) => {
    const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const price = Number(s.price ?? s.startingPrice ?? s.amount);
    const duration = Number(s.duration_minutes ?? s.durationMinutes ?? s.mins) || 120;
    return {
      id: String(s.id || `svc-${Date.now()}-${i}`),
      name: String(s.name || s.title || "Service").trim() || "Service",
      description: s.description != null ? String(s.description) : (s.desc != null ? String(s.desc) : ""),
      price: Number.isFinite(price) && price >= 0 ? price : null,
      durationMinutes: Math.max(15, Math.round(duration)),
      includes: Array.isArray(s.includes)
        ? s.includes.map(String).filter(Boolean)
        : [],
      photos: Array.isArray(s.photos) ? s.photos.map(String).filter(Boolean).slice(0, 8) : [],
      imgUrl: s.imgUrl || s.image || null,
      instantBook: s.instantBook !== false,
    };
  });

  meta.editorSvcs = cleaned;
  const { error: upErr } = await admin
    .from("businesses")
    .update({ meta, updated_at: new Date().toISOString() })
    .eq("id", businessId);
  if (upErr) return jsonRes({ error: upErr.message }, 500);

  return jsonRes({
    ok: true,
    services: listCatalogServices({ ...business, meta }),
  });
}

/** Internal Hubly ops — list providers (searchable directory) */
async function handleOpsList(req: Request, body: Record<string, unknown>) {
  if (!opsAuthorized(req)) {
    return jsonRes({
      error: "Ops authorization required",
      code: "ops_unauthorized",
    }, 401);
  }
  const admin = adminClient();
  try {
    const providers = await listOpsProviders(admin, {
      status: String(body.status || body.marketplace_status || "").trim() || undefined,
      q: String(body.q || body.query || "").trim() || undefined,
      limit: Number(body.limit) || 50,
    });
    const overview = await buildOpsOverview(admin);
    return jsonRes({
      ok: true,
      providers,
      pending_verification: providers.filter((p) => p.marketplace_status === "pending_verification"),
      analytics: {
        providers_listed: overview.active_providers,
        pending_verification: overview.pending_verification,
        bookings_total: overview.totals.bookings,
        open_requests: overview.bookings_today,
      },
      overview,
    });
  } catch (e) {
    return jsonRes({ error: (e as Error)?.message || "Ops list failed" }, 500);
  }
}

async function handleOpsOverview(req: Request) {
  if (!opsAuthorized(req)) {
    return jsonRes({ error: "Ops authorization required", code: "ops_unauthorized" }, 401);
  }
  try {
    const overview = await buildOpsOverview(adminClient());
    return jsonRes({ ok: true, overview });
  } catch (e) {
    return jsonRes({ error: (e as Error)?.message || "Ops overview failed" }, 500);
  }
}

async function handleOpsBookings(req: Request, body: Record<string, unknown>) {
  if (!opsAuthorized(req)) {
    return jsonRes({ error: "Ops authorization required", code: "ops_unauthorized" }, 401);
  }
  try {
    const bookings = await listOpsBookings(adminClient(), {
      status: String(body.status || "").trim() || undefined,
      limit: Number(body.limit) || 50,
    });
    return jsonRes({ ok: true, bookings });
  } catch (e) {
    return jsonRes({ error: (e as Error)?.message || "Ops bookings failed" }, 500);
  }
}

async function handleOpsAnalytics(req: Request) {
  if (!opsAuthorized(req)) {
    return jsonRes({ error: "Ops authorization required", code: "ops_unauthorized" }, 401);
  }
  try {
    const analytics = await buildOpsAnalytics(adminClient());
    return jsonRes({ ok: true, analytics });
  } catch (e) {
    return jsonRes({ error: (e as Error)?.message || "Ops analytics failed" }, 500);
  }
}

async function handleOpsProvider360(req: Request, body: Record<string, unknown>) {
  if (!opsAuthorized(req)) {
    return jsonRes({ error: "Ops authorization required", code: "ops_unauthorized" }, 401);
  }
  const id = String(body.provider_id || body.business_id || body.id || "").trim();
  if (!id) return jsonRes({ error: "provider_id required" }, 400);
  try {
    const detail = await buildOpsProvider360(adminClient(), id);
    return jsonRes({ ok: true, ...detail });
  } catch (e) {
    return jsonRes({ error: (e as Error)?.message || "Provider 360 failed" }, 404);
  }
}

async function handleOpsNote(req: Request, body: Record<string, unknown>) {
  if (!opsAuthorized(req)) {
    return jsonRes({ error: "Ops authorization required", code: "ops_unauthorized" }, 401);
  }
  const admin = adminClient();
  const providerId = String(body.provider_id || "").trim();
  const text = String(body.body || body.note || "").trim();
  if (!providerId || !text) return jsonRes({ error: "provider_id and note required" }, 400);
  const provider = await resolveProviderRow(admin, providerId);
  if (!provider) return jsonRes({ error: "Provider not found" }, 404);
  const { data, error } = await admin
    .from("marketplace_ops_notes")
    .insert({
      provider_id: provider.id,
      business_id: provider.business_id,
      author: String(body.author || "ops").trim() || "ops",
      body: text,
    })
    .select("*")
    .single();
  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ ok: true, note: data }, 201);
}

async function handleOpsFlag(req: Request, body: Record<string, unknown>) {
  if (!opsAuthorized(req)) {
    return jsonRes({ error: "Ops authorization required", code: "ops_unauthorized" }, 401);
  }
  const admin = adminClient();
  const providerId = String(body.provider_id || "").trim() || null;
  const summary = String(body.summary || "").trim();
  if (!summary) return jsonRes({ error: "summary required" }, 400);
  let businessId = String(body.business_id || "").trim() || null;
  if (providerId && !businessId) {
    const provider = await resolveProviderRow(admin, providerId);
    businessId = provider ? String(provider.business_id) : null;
  }
  const { data, error } = await admin
    .from("marketplace_ops_flags")
    .insert({
      provider_id: providerId,
      business_id: businessId,
      booking_id: String(body.booking_id || "").trim() || null,
      flag_type: String(body.flag_type || "general"),
      severity: String(body.severity || "low"),
      status: "open",
      summary,
      details: body.details != null ? String(body.details) : null,
      created_by: String(body.created_by || "ops"),
    })
    .select("*")
    .single();
  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ ok: true, flag: data }, 201);
}

async function handleOpsFlagsList(req: Request, body: Record<string, unknown>) {
  if (!opsAuthorized(req)) {
    return jsonRes({ error: "Ops authorization required", code: "ops_unauthorized" }, 401);
  }
  const admin = adminClient();
  let q = admin
    .from("marketplace_ops_flags")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (body.status) q = q.eq("status", String(body.status));
  const { data, error } = await q;
  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ ok: true, flags: data || [] });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { segments, search } = parsePath(req);
    const method = req.method.toUpperCase();
    let body: Record<string, unknown> = {};
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      body = await req.json().catch(() => ({}));
    }

    const action = String(body.action || "").toLowerCase();
    const admin = adminClient();

    // Path routing
    const [a, b] = segments;

    if (method === "GET" && (a === "providers" || a === "provider" && !b)) {
      return await handleListProviders(admin, search);
    }
    if (method === "GET" && a === "provider" && b && segments[2] === "document") {
      return await handleDocument(req, admin, b, { rebuild: search.get("rebuild") === "1" });
    }
    if (method === "GET" && a === "provider" && b) {
      return await handleGetProvider(admin, b);
    }
    if (method === "POST" && (a === "provider" && b === "settings" || a === "settings")) {
      return await handleSettings(req, body);
    }
    if (method === "POST" && (a === "provider" && b === "ops" || a === "ops")) {
      return await handleOps(req, body);
    }
    if (method === "GET" && a === "availability") {
      return await handleAvailability(admin, search);
    }
    if (method === "POST" && (a === "book" || a === "marketplace" && b === "book")) {
      return await handleBook(admin, body);
    }
    if (method === "POST" && (a === "request" || a === "marketplace" && b === "request")) {
      return await handleRequest(admin, body);
    }
    if (method === "POST" && a === "booking" && b === "catalog") {
      return await handleBookingCatalog(admin, body);
    }
    if (method === "POST" && a === "booking" && b === "slots") {
      return await handleBookingSlots(admin, body);
    }
    if (method === "POST" && a === "booking" && b === "create") {
      return await handleBookingCreate(admin, body);
    }
    if (method === "GET" && a === "booking" && b) {
      return await handleBookingGet(admin, b);
    }
    if (method === "POST" && a === "intake") {
      return await handleIntake(body);
    }
    if (method === "POST" && a === "match") {
      return await handleMatch(admin, body);
    }

    // Action-style fallbacks (easier from hubly.html invoke)
    if (method === "POST") {
      if (action === "list" || action === "providers") {
        return await handleListProviders(admin, search);
      }
      if (action === "get" || action === "provider") {
        const id = String(body.id || body.provider_id || body.business_id || "");
        if (!id) return jsonRes({ error: "id required" }, 400);
        // Owner self-view with score refresh
        if (body.business_id && req.headers.get("Authorization")) {
          return await handleOwnerGet(req, body);
        }
        return await handleGetProvider(admin, id);
      }
      if (action === "settings" || action === "provider/settings") {
        return await handleSettings(req, body);
      }
      if (action === "availability") {
        return await handleAvailability(admin, search, body);
      }
      if (action === "book" || action === "marketplace/book") {
        return await handleBook(admin, body);
      }
      if (action === "request" || action === "marketplace/request") {
        return await handleRequest(admin, body);
      }
      if (action === "booking_catalog" || action === "booking/catalog") {
        return await handleBookingCatalog(admin, body);
      }
      if (action === "booking_slots" || action === "booking/slots") {
        return await handleBookingSlots(admin, body);
      }
      if (action === "booking_create" || action === "booking/create") {
        return await handleBookingCreate(admin, body);
      }
      if (action === "booking_get" || action === "booking/get") {
        const id = String(body.booking_id || body.id || "").trim();
        if (!id) return jsonRes({ error: "booking_id required" }, 400);
        return await handleBookingGet(admin, id);
      }
      if (action === "booking_list" || action === "booking/list") {
        return await handleBookingList(req, body);
      }
      if (action === "booking_accept" || action === "booking/accept") {
        return await handleBookingTransition(req, body, "confirmed");
      }
      if (action === "booking_decline" || action === "booking/decline") {
        return await handleBookingTransition(req, body, "cancelled");
      }
      if (action === "booking_complete" || action === "booking/complete") {
        return await handleBookingTransition(req, body, "completed");
      }
      if (
        action === "booking_start" || action === "booking/start" ||
        action === "booking_in_progress"
      ) {
        return await handleBookingTransition(req, body, "in_progress");
      }
      if (action === "me" || action === "owner") {
        return await handleOwnerGet(req, body);
      }
      if (action === "document" || action === "ai_context" || action === "rebuild_document") {
        const id = String(body.provider_id || body.business_id || body.id || "").trim();
        if (!id) return jsonRes({ error: "provider_id or business_id required" }, 400);
        return await handleDocument(req, admin, id, {
          rebuild: action === "rebuild_document" || body.rebuild === true,
          body,
        });
      }
      if (action === "ops") {
        return await handleOps(req, body);
      }
      if (action === "ops_list" || action === "ops/list") {
        return await handleOpsList(req, body);
      }
      if (action === "ops_overview" || action === "ops/overview") {
        return await handleOpsOverview(req);
      }
      if (action === "ops_bookings" || action === "ops/bookings") {
        return await handleOpsBookings(req, body);
      }
      if (action === "ops_analytics" || action === "ops/analytics") {
        return await handleOpsAnalytics(req);
      }
      if (action === "ops_provider" || action === "ops/provider" || action === "ops_360") {
        return await handleOpsProvider360(req, body);
      }
      if (action === "ops_note" || action === "ops/note") {
        return await handleOpsNote(req, body);
      }
      if (action === "ops_flag" || action === "ops/flag") {
        return await handleOpsFlag(req, body);
      }
      if (action === "ops_flags" || action === "ops/flags") {
        return await handleOpsFlagsList(req, body);
      }
      if (action === "lite_dashboard" || action === "dashboard") {
        return await handleLiteDashboard(req, body);
      }
      if (action === "conversation_list" || action === "conversations") {
        return await handleConversationList(req, body);
      }
      if (action === "message_list" || action === "messages") {
        return await handleMessageList(req, body);
      }
      if (action === "message_send" || action === "send_message") {
        return await handleMessageSend(req, body);
      }
      if (action === "lite_services_save" || action === "services_save") {
        return await handleLiteServicesSave(req, body);
      }
      if (action === "intake") {
        return await handleIntake(body);
      }
      if (action === "match") {
        return await handleMatch(admin, body);
      }
    }

    if (method === "GET" && segments.length === 0) {
      return jsonRes({
        ok: true,
        service: "marketplace",
        philosophy: "ai_first_booking",
        routes: [
          "GET /providers",
          "GET /provider/:id",
          "GET /provider/:id/document",
          "POST /provider/settings",
          "POST /provider/ops",
          "GET /availability",
          "POST /book",
          "POST /request",
          "POST /booking/catalog",
          "POST /booking/slots",
          "POST /booking/create",
          "GET /booking/:id",
          "POST /intake",
          "POST /match",
        ],
      });
    }

    return jsonRes({ error: "Not found", path: segments }, 404);
  } catch (e) {
    console.error("marketplace", e);
    return jsonRes({ error: (e as Error)?.message || "Marketplace error" }, 500);
  }
});
