/**
 * Marketplace Ops — Hubly internal control center helpers.
 * Owns: quality, verification, trust, analytics, fraud, moderation, lifecycle.
 * Not Provider Experience / Marketplace Lite. Not Hubly Pro / CRM. Staff-only.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listCatalogServices } from "./booking_engine.ts";
import { buildMarketplaceHealth } from "./marketplace_lite.ts";
import { buildLifecycleSnapshot } from "./marketplace_lifecycle.ts";
import { assembleProviderPublic } from "./marketplace_provider.ts";

type Admin = SupabaseClient;

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/** Missing verification / readiness requirements for the queue. */
export function missingRequirements(
  provider: Record<string, unknown>,
  business: Record<string, unknown>,
  stripe?: { charges_enabled?: boolean | null; stripe_account_id?: string | null } | null,
): string[] {
  const missing: string[] = [];
  const meta = (business.meta || {}) as Record<string, unknown>;
  const packages = listCatalogServices(business);
  const photos = Array.isArray(meta.portfolioUrls)
    ? meta.portfolioUrls
    : (Array.isArray(meta.galleryPairs) ? meta.galleryPairs : []);
  const hours = meta.hours && typeof meta.hours === "object";

  if (!business.name) missing.push("Business name");
  if (!business.logo_url && !meta.logoUrl) missing.push("Profile logo");
  if (photos.length < 2) missing.push("Profile photos");
  if (!packages.length) missing.push("Services");
  if (!hours) missing.push("Business hours");
  if (!provider.calendar_connected) missing.push("Calendar");
  if (!provider.insurance_verified) missing.push("Insurance");
  if (!provider.license_verified) missing.push("License / identity");
  if (!stripe?.stripe_account_id || !stripe?.charges_enabled) missing.push("Stripe");
  return missing;
}

export async function buildOpsOverview(admin: Admin) {
  const today = todayYmd();
  const weekAgo = daysAgoIso(7);

  const { data: providers } = await admin
    .from("marketplace_providers")
    .select("id,marketplace_status,instant_booking,created_at,updated_at")
    .limit(500);

  const rows = providers || [];
  const pending = rows.filter((p) => p.marketplace_status === "pending_verification");
  const active = rows.filter((p) => p.marketplace_status === "verified");
  const newProviders = rows.filter((p) => String(p.created_at || "") >= weekAgo);

  const { data: bookings } = await admin
    .from("marketplace_bookings")
    .select("id,status,price_cents,instant_book,created_at,starts_at,requested_date,payment_status")
    .order("created_at", { ascending: false })
    .limit(500);

  const books = bookings || [];
  const bookingsToday = books.filter((b) => {
    const d = String(b.starts_at || b.requested_date || b.created_at || "").slice(0, 10);
    return d === today;
  });
  const gmvCents = books
    .filter((b) => b.status === "completed" || b.payment_status === "paid")
    .reduce((s, b) => s + (Number(b.price_cents) || 0), 0);
  const instantCount = books.filter((b) => b.instant_book).length;
  const instantPct = books.length ? Math.round((instantCount / books.length) * 100) : 0;
  const completed = books.filter((b) => b.status === "completed").length;
  const cancelled = books.filter((b) => b.status === "cancelled").length;
  const settled = completed + cancelled;
  const completionRate = settled ? Math.round((completed / settled) * 100) : 0;

  // Soft marketplace health = share of verified with instant book + calendar-ish activity
  const health = active.length
    ? Math.round((active.filter((p) => p.instant_booking).length / active.length) * 100)
    : 0;

  return {
    new_providers: newProviders.length,
    pending_verification: pending.length,
    active_providers: active.length,
    bookings_today: bookingsToday.length,
    gmv_cents: gmvCents,
    instant_book_pct: instantPct,
    completion_rate: completionRate,
    marketplace_health: health,
    totals: {
      providers: rows.length,
      bookings: books.length,
    },
  };
}

export async function listOpsProviders(
  admin: Admin,
  opts: { status?: string; q?: string; limit?: number; offset?: number },
) {
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const needle = String(opts.q || "").toLowerCase().trim();

  // Search businesses first when a query is present so matches aren't limited
  // to the most recently updated provider rows.
  let matchedBusinessIds: string[] | null = null;
  if (needle) {
    const safe = needle.replace(/[%_,.()]/g, " ").trim();
    if (safe) {
      const { data: bizHits } = await admin
        .from("businesses")
        .select("id,name,city,email,business_type")
        .or(
          `name.ilike.%${safe}%,city.ilike.%${safe}%,email.ilike.%${safe}%,business_type.ilike.%${safe}%`,
        )
        .limit(200);
      matchedBusinessIds = (bizHits || []).map((b) => String(b.id));
      if (!matchedBusinessIds.length) {
        matchedBusinessIds = null;
      }
    }
  }

  let q = admin
    .from("marketplace_providers")
    .select("*")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.status) q = q.eq("marketplace_status", opts.status);
  if (matchedBusinessIds && matchedBusinessIds.length) {
    q = q.in("business_id", matchedBusinessIds);
  }

  const { data: providers, error } = await q;
  if (error) throw error;

  let providerRows = providers || [];
  // If name search returned nothing but needle looks like a status, filter in DB already.
  // If needle set and business search empty, fall back to scanning a larger provider window.
  if (needle && (!matchedBusinessIds || !matchedBusinessIds.length)) {
    const { data: wider } = await admin
      .from("marketplace_providers")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    providerRows = wider || [];
    if (opts.status) {
      providerRows = providerRows.filter((p) => p.marketplace_status === opts.status);
    }
  }

  const ids = providerRows.map((p) => p.business_id);
  const { data: businesses } = ids.length
    ? await admin.from("businesses").select(
      "id,name,slug,city,email,phone,logo_url,business_type,created_at,meta",
    ).in("id", ids)
    : { data: [] as Array<Record<string, unknown>> };
  const byId = new Map((businesses || []).map((b) => [String(b.id), b]));

  const stripeByBiz = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const { data: stripes } = await admin
      .from("stripe_connect_accounts")
      .select("business_id,stripe_account_id,charges_enabled")
      .in("business_id", ids);
    for (const s of stripes || []) {
      stripeByBiz.set(String(s.business_id), s);
    }
  }

  const bookingCounts = new Map<string, number>();
  if (ids.length) {
    const { data: books } = await admin
      .from("marketplace_bookings")
      .select("business_id")
      .in("business_id", ids);
    for (const b of books || []) {
      const id = String(b.business_id);
      bookingCounts.set(id, (bookingCounts.get(id) || 0) + 1);
    }
  }

  const list = [];
  for (const p of providerRows) {
    const biz = byId.get(String(p.business_id)) || {};
    const life = buildLifecycleSnapshot(p);
    const health = buildMarketplaceHealth({
      provider: p,
      business: biz,
    });
    const stripe = stripeByBiz.get(String(p.business_id)) || null;
    const missing = missingRequirements(p, biz, stripe);
    const row = {
      provider_id: p.id,
      business_id: p.business_id,
      name: biz.name || "Provider",
      city: biz.city || null,
      email: biz.email || null,
      phone: biz.phone || null,
      industry: p.category || biz.business_type || null,
      verification_status: p.verification_status || life.status,
      marketplace_status: life.status,
      marketplace_readiness: health.score,
      marketplace_score: p.marketplace_score,
      instant_book: !!life.can_instant_book,
      calendar_connected: !!p.calendar_connected,
      insurance_verified: !!p.insurance_verified,
      license_verified: !!p.license_verified,
      stripe_ready: !!(stripe && stripe.stripe_account_id && stripe.charges_enabled),
      last_active: p.updated_at || p.created_at,
      bookings: bookingCounts.get(String(p.business_id)) || 0,
      rating: null as number | null,
      joined_at: biz.created_at || p.created_at,
      missing_requirements: missing,
      status_reason: p.status_reason || null,
    };
    if (needle) {
      const blob =
        `${row.name} ${row.city} ${row.email} ${row.industry} ${row.marketplace_status} ${row.provider_id}`
          .toLowerCase();
      if (!blob.includes(needle)) continue;
    }
    list.push(row);
    if (list.length >= limit) break;
  }
  return list;
}

export async function buildOpsProvider360(
  admin: Admin,
  providerIdOrBusinessId: string,
) {
  let { data: provider } = await admin
    .from("marketplace_providers")
    .select("*")
    .eq("id", providerIdOrBusinessId)
    .maybeSingle();
  if (!provider) {
    const { data } = await admin
      .from("marketplace_providers")
      .select("*")
      .eq("business_id", providerIdOrBusinessId)
      .maybeSingle();
    provider = data;
  }
  if (!provider) throw new Error("Provider not found");

  const { data: business } = await admin
    .from("businesses")
    .select("*")
    .eq("id", provider.business_id)
    .maybeSingle();
  if (!business) throw new Error("Business not found");

  const pub = assembleProviderPublic(provider, business);
  const health = buildMarketplaceHealth({ provider, business });
  const services = listCatalogServices(business);

  const { data: bookings } = await admin
    .from("marketplace_bookings")
    .select("*")
    .eq("business_id", provider.business_id)
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: conversations } = await admin
    .from("marketplace_conversations")
    .select("*")
    .eq("business_id", provider.business_id)
    .order("updated_at", { ascending: false })
    .limit(20);

  const { data: notes } = await admin
    .from("marketplace_ops_notes")
    .select("*")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: flags } = await admin
    .from("marketplace_ops_flags")
    .select("*")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: stripe } = await admin
    .from("stripe_connect_accounts")
    .select("stripe_account_id,charges_enabled,payouts_enabled,details_submitted")
    .eq("business_id", provider.business_id)
    .maybeSingle();

  const missing = missingRequirements(provider, business, stripe);

  const reviews = (pub.profile?.reviews || []) as unknown[];

  return {
    provider: pub,
    lifecycle: buildLifecycleSnapshot(provider),
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      city: business.city,
      email: business.email,
      phone: business.phone,
      business_type: business.business_type,
      created_at: business.created_at,
    },
    health,
    missing_requirements: missing,
    services,
    bookings: bookings || [],
    conversations: conversations || [],
    reviews,
    payout: {
      connected: !!stripe?.stripe_account_id,
      charges_enabled: !!stripe?.charges_enabled,
      payouts_enabled: !!stripe?.payouts_enabled,
      details_submitted: !!stripe?.details_submitted,
    },
    availability: {
      calendar_connected: !!provider.calendar_connected,
      instant_booking: !!provider.instant_booking,
      accepting_new_jobs: provider.accepting_new_jobs !== false,
      weekend_jobs: provider.weekend_jobs !== false,
      hours: ((business.meta || {}) as Record<string, unknown>).hours || null,
    },
    risk_flags: flags || [],
    internal_notes: notes || [],
  };
}

export async function listOpsBookings(
  admin: Admin,
  opts: { status?: string; limit?: number },
) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  let q = admin
    .from("marketplace_bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;

  const bizIds = [...new Set((data || []).map((b) => b.business_id))];
  const { data: businesses } = bizIds.length
    ? await admin.from("businesses").select("id,name,city").in("id", bizIds)
    : { data: [] as Array<Record<string, unknown>> };
  const byId = new Map((businesses || []).map((b) => [String(b.id), b]));

  return (data || []).map((b) => ({
    ...b,
    provider_name: byId.get(String(b.business_id))?.name || "Provider",
    provider_city: byId.get(String(b.business_id))?.city || null,
  }));
}

export async function buildOpsAnalytics(admin: Admin) {
  const { data: providers } = await admin
    .from("marketplace_providers")
    .select("id,marketplace_status,created_at")
    .limit(1000);
  const { data: bookings } = await admin
    .from("marketplace_bookings")
    .select("id,status,price_cents,created_at,customer_email,payment_status")
    .limit(1000);

  const byDay: Record<string, { providers: number; bookings: number; gmv: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    byDay[d] = { providers: 0, bookings: 0, gmv: 0 };
  }
  for (const p of providers || []) {
    const d = String(p.created_at || "").slice(0, 10);
    if (byDay[d]) byDay[d].providers += 1;
  }
  for (const b of bookings || []) {
    const d = String(b.created_at || "").slice(0, 10);
    if (byDay[d]) {
      byDay[d].bookings += 1;
      if (b.status === "completed" || b.payment_status === "paid") {
        byDay[d].gmv += Number(b.price_cents) || 0;
      }
    }
  }

  const books = bookings || [];
  const completed = books.filter((b) => b.status === "completed").length;
  const cancelled = books.filter((b) => b.status === "cancelled").length;
  const settled = completed + cancelled;
  const priced = books.filter((b) => Number(b.price_cents) > 0);
  const avgBooking = priced.length
    ? Math.round(priced.reduce((s, b) => s + Number(b.price_cents), 0) / priced.length)
    : 0;

  const emails = books.map((b) => String(b.customer_email || "").toLowerCase()).filter(Boolean);
  const uniqueCustomers = new Set(emails).size;
  const repeat = emails.length - uniqueCustomers;

  return {
    series: Object.keys(byDay).sort().map((date) => ({ date, ...byDay[date] })),
    provider_growth: (providers || []).length,
    customer_growth: uniqueCustomers,
    booking_volume: books.length,
    gmv_cents: books
      .filter((b) => b.status === "completed" || b.payment_status === "paid")
      .reduce((s, b) => s + (Number(b.price_cents) || 0), 0),
    average_booking_value_cents: avgBooking,
    completion_rate: settled ? Math.round((completed / settled) * 100) : 0,
    cancellation_rate: settled ? Math.round((cancelled / settled) * 100) : 0,
    repeat_customer_rate: emails.length
      ? Math.round((repeat / emails.length) * 100)
      : 0,
  };
}
