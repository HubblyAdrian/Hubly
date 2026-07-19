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
 *   POST /request
 *
 * Action-style POST also supports: me|document|ai_context|ops|rebuild_document
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAvailability } from "../_shared/marketplace_availability.ts";
import { buildProviderDocument } from "../_shared/marketplace_document.ts";
import { CORS, jsonRes, parsePath } from "../_shared/marketplace_http.ts";
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

async function handleBook(admin: ReturnType<typeof adminClient>, body: Record<string, unknown>) {
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
    return jsonRes({ error: "Provider is not accepting marketplace bookings" }, 400);
  }
  const bookLife = buildLifecycleSnapshot(provider);
  if (!bookLife.can_instant_book) {
    return jsonRes({
      error: bookLife.status !== "verified"
        ? `Provider status is ${bookLife.label} — only Verified providers accept instant bookings`
        : (!provider.accepting_new_jobs
          ? "Provider is not accepting new jobs"
          : "Instant booking is off — submit a quote request instead"),
      code: "not_accepting_instant_book",
      marketplace_status: bookLife.status,
      lifecycle: bookLife,
    }, 400);
  }

  const customerName = String(body.customer_name || body.name || "").trim();
  if (!customerName) return jsonRes({ error: "customer_name required" }, 400);

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
      status: "pending",
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
        ? `Provider status is ${reqLife.label} — only Verified providers accept quote requests`
        : (!provider.accepting_new_jobs
          ? "Provider is not accepting new jobs"
          : "Provider is not accepting quote requests"),
      code: "not_accepting_quotes",
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
  return jsonRes({ ok: true, request: data }, 201);
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

async function resolveProviderRow(
  admin: ReturnType<typeof adminClient>,
  id: string,
) {
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
  } else if (op === "pause" || op === "paused") next = "paused";
  else if (op === "hide" || op === "hidden") next = "hidden";
  else if (op === "draft") next = "draft";
  else {
    return jsonRes({
      error: "op must be verify|reject|suspend|unsuspend|pending|pause|hide|draft",
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
    }

    if (method === "GET" && segments.length === 0) {
      return jsonRes({
        ok: true,
        service: "marketplace",
        routes: [
          "GET /providers",
          "GET /provider/:id",
          "GET /provider/:id/document",
          "POST /provider/settings",
          "POST /provider/ops",
          "GET /availability",
          "POST /book",
          "POST /request",
        ],
      });
    }

    return jsonRes({ error: "Not found", path: segments }, 404);
  } catch (e) {
    console.error("marketplace", e);
    return jsonRes({ error: (e as Error)?.message || "Marketplace error" }, 500);
  }
});
