/**
 * Marketplace Lite — owner dashboard helpers.
 * Reuses Booking Engine / Availability / score — does not duplicate CRM.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listCatalogServices } from "./booking_engine.ts";
import { buildLifecycleSnapshot } from "./marketplace_lifecycle.ts";
import { assembleProviderPublic } from "./marketplace_provider.ts";

type Admin = SupabaseClient;

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Private Marketplace Health checklist for the provider. */
export function buildMarketplaceHealth(opts: {
  provider: Record<string, unknown>;
  business: Record<string, unknown>;
  document?: Record<string, unknown> | null;
}): {
  score: number;
  items: Array<{ id: string; label: string; ok: boolean }>;
  tips: string[];
} {
  const life = buildLifecycleSnapshot(opts.provider);
  const pub = assembleProviderPublic(opts.provider, opts.business);
  const packages = listCatalogServices(opts.business);
  const meta = (opts.business.meta || {}) as Record<string, unknown>;
  const photos = Array.isArray(meta.portfolioUrls)
    ? meta.portfolioUrls
    : (Array.isArray(meta.galleryPairs) ? meta.galleryPairs : []);
  const hours = meta.hours && typeof meta.hours === "object";
  const docScore = Number(
    (opts.document as { score?: { total?: number } } | null)?.score?.total ??
      pub.marketplace_score ??
      0,
  );

  const items = [
    {
      id: "profile",
      label: "Profile completion",
      ok: !!(pub.profile?.name && (pub.profile?.logo_url || photos.length)),
    },
    {
      id: "calendar",
      label: "Calendar connected",
      ok: !!pub.calendar_connected,
    },
    {
      id: "instant_book",
      label: "Instant Book enabled",
      ok: !!life.can_instant_book,
    },
    {
      id: "photos",
      label: "Photos added",
      ok: photos.length >= 3,
    },
    {
      id: "services",
      label: "Services complete",
      ok: packages.length >= 1 && packages.every((s) => s.name && (s.price_cents != null || s.duration_minutes)),
    },
    {
      id: "verified",
      label: "Verified",
      ok: life.status === "verified",
    },
    {
      id: "hours",
      label: "Business hours set",
      ok: !!hours,
    },
    {
      id: "response",
      label: "Respond quickly",
      ok: pub.response_time != null && Number(pub.response_time) <= 180,
    },
  ];

  const done = items.filter((i) => i.ok).length;
  const score = Math.round((done / items.length) * 100);
  const tips = items.filter((i) => !i.ok).map((i) => i.label);
  return { score: Math.max(score, Math.min(100, docScore)), items, tips };
}

export async function buildLiteDashboard(
  admin: Admin,
  opts: {
    provider: Record<string, unknown>;
    business: Record<string, unknown>;
    document?: Record<string, unknown> | null;
  },
) {
  const businessId = String(opts.business.id);
  const today = todayYmd();
  const monthStart = startOfMonthIso();

  const { data: bookings } = await admin
    .from("marketplace_bookings")
    .select("id,status,starts_at,requested_date,created_at,payment_status,price_cents")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = bookings || [];
  const todays = rows.filter((b) => {
    const d = (b.starts_at || b.requested_date || "").toString().slice(0, 10);
    return d === today && ["requested", "confirmed", "in_progress"].includes(String(b.status));
  });
  const upcoming = rows.filter((b) => {
    const d = (b.starts_at || b.requested_date || "").toString().slice(0, 10);
    return d >= today && ["confirmed", "in_progress", "requested"].includes(String(b.status));
  }).slice(0, 8);

  const thisMonth = rows.filter((b) => String(b.created_at || "") >= monthStart);
  const completedMonth = thisMonth.filter((b) => b.status === "completed");
  const requestedish = thisMonth.filter((b) =>
    ["requested", "confirmed", "in_progress", "completed", "cancelled"].includes(String(b.status))
  );
  const conversion = requestedish.length
    ? Math.round((completedMonth.length / requestedish.length) * 100)
    : 0;

  const pendingPayoutCents = rows
    .filter((b) => b.payment_status === "paid" && b.status !== "cancelled")
    .reduce((sum, b) => sum + (Number(b.price_cents) || 0), 0);

  const health = buildMarketplaceHealth(opts);
  const life = buildLifecycleSnapshot(opts.provider);

  const { count: viewsApprox } = await admin
    .from("marketplace_bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  return {
    todays_bookings: todays.length,
    upcoming_jobs: upcoming,
    bookings_this_month: thisMonth.length,
    conversion_rate: conversion,
    payouts_pending_cents: pendingPayoutCents,
    marketplace_views: Math.max(viewsApprox || 0, thisMonth.length * 3), // soft signal until dedicated analytics
    marketplace_health: health,
    lifecycle: life,
    quick_actions: [
      { id: "availability", label: "Update Availability" },
      { id: "services", label: "Edit Services" },
      { id: "profile", label: "View Profile" },
      { id: "calendar", label: "Connect Calendar" },
      { id: "instant_book", label: "Enable Instant Book" },
    ],
    upgrade: {
      bookings_total: rows.length,
      headline: rows.length >= 5
        ? `You've received ${rows.length} bookings through Hubly.`
        : "Grow with Hubly Pro when you're ready.",
      bullets: [
        "CRM",
        "Automations",
        "Customer Database",
        "Invoices",
        "AI Assistant",
        "Marketing",
        "Memberships",
      ],
    },
  };
}
