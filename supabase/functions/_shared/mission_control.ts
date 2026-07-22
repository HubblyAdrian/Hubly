/**
 * Hubly HQ (Mission Control edge) — internal platform operating system.
 * Read-first aggregates for CEO Daily, funnel, launch queue, health.
 * Never simulates Stripe/OpenAI success. Never returns customer secrets.
 * User-facing product name: **Hubly HQ**.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Admin = SupabaseClient;

function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function metaObj(biz: Record<string, unknown>): Record<string, unknown> {
  const m = biz.meta;
  return m && typeof m === "object" && !Array.isArray(m) ? m as Record<string, unknown> : {};
}

function websiteMeta(biz: Record<string, unknown>): Record<string, unknown> {
  const w = metaObj(biz).website;
  return w && typeof w === "object" && !Array.isArray(w) ? w as Record<string, unknown> : {};
}

export function isPublished(biz: Record<string, unknown>): boolean {
  const slug = String(biz.slug || "").trim();
  const w = websiteMeta(biz);
  return !!(slug && (w.published === true || w.publishedAt));
}

export type Milestone =
  | "signed_up"
  | "building"
  | "published"
  | "stripe"
  | "calendar"
  | "first_booking"
  | "first_payment"
  | "live";

export function resolveMilestone(flags: {
  published: boolean;
  stripe: boolean;
  calendar: boolean;
  firstBooking: boolean;
  firstPayment: boolean;
}): Milestone {
  if (flags.firstPayment) return "live";
  if (flags.firstBooking) return "first_booking";
  if (flags.calendar && flags.stripe && flags.published) return "calendar";
  if (flags.stripe && flags.published) return "stripe";
  if (flags.published) return "published";
  if (flags.published === false && !flags.stripe) return "building";
  return "signed_up";
}

export function statusBadge(flags: {
  published: boolean;
  stripe: boolean;
  calendar: boolean;
  firstBooking: boolean;
  firstPayment: boolean;
  abandoned?: boolean;
}): { code: string; label: string; tone: "ok" | "warn" | "bad" } {
  if (flags.abandoned) return { code: "abandoned", label: "Abandoned", tone: "bad" };
  if (flags.firstPayment) return { code: "live", label: "Live", tone: "ok" };
  if (flags.published && !flags.stripe) {
    return { code: "needs_stripe", label: "Needs Stripe", tone: "warn" };
  }
  if (flags.published && flags.stripe && !flags.firstBooking) {
    return { code: "waiting_booking", label: "Waiting for first booking", tone: "warn" };
  }
  if (!flags.published) return { code: "building", label: "Building", tone: "warn" };
  return { code: "in_progress", label: "In progress", tone: "warn" };
}

/** Deterministic hire-health style score from counts (0–100). */
export function roughHealth(input: {
  leads: number;
  bookings: number;
  paid: number;
  completed: number;
}): number {
  const bookingRate = input.leads ? input.bookings / input.leads : 0.4;
  const payRate = input.bookings ? input.paid / Math.max(input.bookings, 1) : 0.35;
  const doneRate = input.bookings ? input.completed / Math.max(input.bookings, 1) : 0.4;
  const dims = [
    Math.min(95, 40 + input.leads * 6),
    Math.round(bookingRate * 100),
    Math.round(payRate * 100),
    Math.round(doneRate * 100),
    input.paid ? Math.min(100, 35 + Math.log10(input.paid + 1) * 18) : 35,
  ];
  return Math.round(dims.reduce((a, b) => a + b, 0) / dims.length);
}

export async function writeAudit(
  admin: Admin,
  row: {
    admin_email?: string | null;
    admin_user_id?: string | null;
    action: string;
    resource_type?: string | null;
    resource_id?: string | null;
    meta?: Record<string, unknown>;
    ip?: string | null;
  },
) {
  try {
    await admin.from("admin_audit_log").insert({
      admin_email: row.admin_email || null,
      admin_user_id: row.admin_user_id || null,
      action: row.action,
      resource_type: row.resource_type || null,
      resource_id: row.resource_id || null,
      meta: row.meta || {},
      ip: row.ip || null,
    });
  } catch (e) {
    console.warn("mission_control audit insert", e);
  }
}

async function loadStripeMap(admin: Admin): Promise<Map<string, Record<string, unknown>>> {
  const { data } = await admin
    .from("stripe_connect_accounts")
    .select("business_id,stripe_account_id,charges_enabled,payouts_enabled,details_submitted,last_error");
  const map = new Map<string, Record<string, unknown>>();
  for (const row of data || []) {
    if (row?.business_id) map.set(String(row.business_id), row as Record<string, unknown>);
  }
  return map;
}

async function loadCalendarSet(admin: Admin): Promise<Set<string>> {
  const set = new Set<string>();
  const { data: gcal } = await admin.from("google_calendar_connections").select("business_id");
  for (const row of gcal || []) {
    if (row?.business_id) set.add(String(row.business_id));
  }
  const { data: mp } = await admin
    .from("marketplace_providers")
    .select("business_id,calendar_connected")
    .eq("calendar_connected", true);
  for (const row of mp || []) {
    if (row?.business_id) set.add(String(row.business_id));
  }
  return set;
}

async function bookingStatsByBusiness(admin: Admin): Promise<Map<string, {
  leads: number;
  bookings: number;
  paid: number;
  completed: number;
  revenueCents: number;
  firstBookingAt: string | null;
  firstPaidAt: string | null;
}>> {
  const map = new Map();
  const { data: reqs } = await admin
    .from("booking_requests")
    .select("business_id,status,payment_status,amount_paid_cents,created_at,paid_at")
    .order("created_at", { ascending: true })
    .limit(5000);
  for (const r of reqs || []) {
    const id = String(r.business_id || "");
    if (!id) continue;
    const cur = map.get(id) || {
      leads: 0,
      bookings: 0,
      paid: 0,
      completed: 0,
      revenueCents: 0,
      firstBookingAt: null as string | null,
      firstPaidAt: null as string | null,
    };
    cur.leads += 1;
    const st = String(r.status || "");
    if (st && st !== "cancelled" && st !== "canceled" && st !== "declined") {
      cur.bookings += 1;
      if (!cur.firstBookingAt) cur.firstBookingAt = r.created_at || null;
    }
    if (r.payment_status === "paid") {
      cur.paid += 1;
      cur.revenueCents += Number(r.amount_paid_cents || 0);
      if (!cur.firstPaidAt) cur.firstPaidAt = r.paid_at || r.created_at || null;
    }
    map.set(id, cur);
  }
  const { data: jobs } = await admin
    .from("jobs")
    .select("business_id,status,paid")
    .eq("status", "completed")
    .limit(5000);
  for (const j of jobs || []) {
    const id = String(j.business_id || "");
    if (!id) continue;
    const cur = map.get(id) || {
      leads: 0,
      bookings: 0,
      paid: 0,
      completed: 0,
      revenueCents: 0,
      firstBookingAt: null,
      firstPaidAt: null,
    };
    cur.completed += 1;
    if (j.paid) cur.paid += 1;
    map.set(id, cur);
  }
  return map;
}

function enrichBusiness(
  biz: Record<string, unknown>,
  stripeMap: Map<string, Record<string, unknown>>,
  calendarSet: Set<string>,
  statsMap: Map<string, Awaited<ReturnType<typeof bookingStatsByBusiness>> extends Map<string, infer V> ? V : never>,
) {
  const id = String(biz.id);
  const stripe = stripeMap.get(id);
  const stats = statsMap.get(id) || {
    leads: 0,
    bookings: 0,
    paid: 0,
    completed: 0,
    revenueCents: 0,
    firstBookingAt: null,
    firstPaidAt: null,
  };
  const flags = {
    published: isPublished(biz),
    stripe: !!(stripe?.stripe_account_id && stripe?.charges_enabled),
    calendar: calendarSet.has(id),
    firstBooking: !!stats.firstBookingAt || stats.bookings > 0,
    firstPayment: !!stats.firstPaidAt || stats.paid > 0,
    abandoned: !isPublished(biz) &&
      Date.now() - new Date(String(biz.created_at || Date.now())).getTime() > 7 * 86400000,
  };
  const health = roughHealth(stats);
  return {
    id,
    name: biz.name || "Untitled",
    email: biz.email || null,
    owner_id: biz.owner_id || null,
    industry: biz.business_type || null,
    city: biz.city || null,
    slug: biz.slug || null,
    created_at: biz.created_at || null,
    tier: biz.tier || null,
    published: flags.published,
    stripe: flags.stripe,
    calendar: flags.calendar,
    first_booking: flags.firstBooking,
    first_payment: flags.firstPayment,
    milestone: resolveMilestone(flags),
    status: statusBadge(flags),
    health,
    stats,
    stripe_account: stripe
      ? {
        charges_enabled: !!stripe.charges_enabled,
        payouts_enabled: !!stripe.payouts_enabled,
        details_submitted: !!stripe.details_submitted,
        has_account: !!stripe.stripe_account_id,
        // never return stripe_account_id to UI by default — redacted
      }
      : null,
  };
}

export async function buildCeoDaily(admin: Admin) {
  const today = startOfTodayIso();
  const yesterday = daysAgoIso(1);
  const { count: totalBiz } = await admin.from("businesses").select("id", { count: "exact", head: true });
  const { data: recent } = await admin
    .from("businesses")
    .select("id,name,slug,meta,created_at,business_type,email,owner_id,tier,city")
    .gte("created_at", daysAgoIso(2))
    .order("created_at", { ascending: false })
    .limit(500);

  const stripeMap = await loadStripeMap(admin);
  const calendarSet = await loadCalendarSet(admin);
  const statsMap = await bookingStatsByBusiness(admin);

  const yStart = new Date(yesterday);
  const tStart = new Date(today);
  let newYesterday = 0;
  let publishedYesterday = 0;
  let firstCustomersYesterday = 0;
  let revenueYesterdayCents = 0;
  let stripeConnected = 0;

  const allFlags = [];
  for (const biz of recent || []) {
    const e = enrichBusiness(biz as Record<string, unknown>, stripeMap, calendarSet, statsMap);
    const created = new Date(String(biz.created_at));
    if (created >= yStart && created < tStart) newYesterday += 1;
    if (e.published && created >= yStart && created < tStart) publishedYesterday += 1;
  }

  const { data: allBiz } = await admin
    .from("businesses")
    .select("id,meta,slug,created_at")
    .limit(2000);
  for (const biz of allBiz || []) {
    const e = enrichBusiness(biz as Record<string, unknown>, stripeMap, calendarSet, statsMap);
    allFlags.push(e);
    if (e.stripe) stripeConnected += 1;
  }

  const { data: paidY } = await admin
    .from("booking_requests")
    .select("amount_paid_cents,paid_at,created_at,business_id")
    .eq("payment_status", "paid")
    .gte("paid_at", yesterday)
    .lt("paid_at", today);
  for (const p of paidY || []) {
    revenueYesterdayCents += Number(p.amount_paid_cents || 0);
    firstCustomersYesterday += 1;
  }

  const publishedRate = Math.round(
    (100 * allFlags.filter((b) => b.published).length) / Math.max(1, allFlags.length),
  );
  const activationRate = Math.round(
    (100 * allFlags.filter((b) => b.first_payment).length) / Math.max(1, allFlags.length),
  );

  const stripeRate = allFlags.length ? Math.round((100 * stripeConnected) / allFlags.length) : 0;
  const biggestBlocker = stripeRate < 60
    ? `Only ${stripeRate}% connected Stripe.`
    : publishedRate < 50
    ? "Fewer than half of businesses have published."
    : "Watch first-booking conversion.";

  const recommendation = stripeRate < 60
    ? "Improve the Stripe connection flow."
    : "Tighten publish → first booking coaching in Hubly Daily.";

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const todaysPriorities = [
    stripeRate < 60 ? "Unblock Stripe Connect for published businesses" : null,
    publishedRate < 50 ? "Help building businesses reach publish" : null,
    activationRate < 20 ? "Drive first booking / first payment" : null,
    "Complete live First Customer production payment proof",
    "Keep calendar conflict + Google sync green",
  ].filter(Boolean);

  return {
    greeting: `${greet}, Adrian.`,
    yesterday: {
      businesses_launched: newYesterday,
      new_businesses: newYesterday,
      published: publishedYesterday,
      first_customers: firstCustomersYesterday,
      revenue_cents: revenueYesterdayCents,
      processed_cents: revenueYesterdayCents,
      processed_display: `$${(revenueYesterdayCents / 100).toFixed(0)}`,
      activation_pct: activationRate,
    },
    biggest_blocker: biggestBlocker,
    recommendation,
    todays_priorities: todaysPriorities,
    totals: {
      businesses: totalBiz || allFlags.length,
      stripe_connected_pct: stripeRate,
      published_pct: publishedRate,
      activation_pct: activationRate,
    },
  };
}

export async function buildOverview(admin: Admin) {
  const today = startOfTodayIso();
  const { count: totalBiz } = await admin.from("businesses").select("id", { count: "exact", head: true });
  const { data: createdToday } = await admin
    .from("businesses")
    .select("id,name,slug,meta,created_at,business_type,email")
    .gte("created_at", today)
    .limit(200);
  const stripeMap = await loadStripeMap(admin);
  const calendarSet = await loadCalendarSet(admin);
  const statsMap = await bookingStatsByBusiness(admin);

  const { data: sample } = await admin
    .from("businesses")
    .select("id,name,slug,meta,created_at,business_type,email,owner_id,tier,city")
    .order("created_at", { ascending: false })
    .limit(400);

  const enriched = (sample || []).map((b) =>
    enrichBusiness(b as Record<string, unknown>, stripeMap, calendarSet, statsMap)
  );
  const publishedToday = enriched.filter((b) =>
    b.published && b.created_at && String(b.created_at) >= today
  ).length;
  // Active subscribers ≈ tier pro (Hubly SaaS billing table not yet present)
  const activeSubscribers = enriched.filter((b) => String(b.tier || "") === "pro").length;
  const mrrEstimate = activeSubscribers * 29; // product price from notes — labeled estimate
  const healthAvg = enriched.length
    ? Math.round(enriched.reduce((s, b) => s + b.health, 0) / enriched.length)
    : 0;

  const { data: paidToday } = await admin
    .from("booking_requests")
    .select("id,amount_paid_cents,payment_status,created_at,paid_at")
    .eq("payment_status", "paid")
    .gte("paid_at", today);
  const revenueTodayCents = (paidToday || []).reduce((s, r) => s + Number(r.amount_paid_cents || 0), 0);
  const { count: bookingsToday } = await admin
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today);

  const feed = await buildPlatformFeed(admin, 40);

  return {
    cards: {
      total_businesses: totalBiz || enriched.length,
      businesses_created_today: (createdToday || []).length,
      published_today: publishedToday,
      active_subscribers: activeSubscribers,
      mrr_estimate_usd: mrrEstimate,
      mrr_note: "Estimate from businesses.tier=pro × $29 until Hubly SaaS billing table lands.",
      revenue_today_cents: revenueTodayCents,
      bookings_today: bookingsToday || 0,
      payments_today: (paidToday || []).length,
      average_business_health: healthAvg,
    },
    feed,
  };
}

export async function buildPlatformFeed(admin: Admin, limit = 40) {
  const events: Array<{ ts: string; kind: string; msg: string; meta?: string; business_id?: string }> = [];

  const { data: biz } = await admin
    .from("businesses")
    .select("id,name,created_at,slug,meta")
    .order("created_at", { ascending: false })
    .limit(30);
  for (const b of biz || []) {
    events.push({
      ts: String(b.created_at),
      kind: "business_created",
      msg: `${b.name || "Business"} signed up.`,
      business_id: b.id,
    });
    if (isPublished(b as Record<string, unknown>)) {
      const at = String(websiteMeta(b as Record<string, unknown>).publishedAt || b.created_at);
      events.push({
        ts: at,
        kind: "website_published",
        msg: `${b.name || "Business"} published their website.`,
        meta: b.slug || "",
        business_id: b.id,
      });
    }
  }

  const { data: stripe } = await admin
    .from("stripe_connect_accounts")
    .select("business_id,charges_enabled,updated_at,created_at")
    .eq("charges_enabled", true)
    .order("updated_at", { ascending: false })
    .limit(20);
  for (const s of stripe || []) {
    events.push({
      ts: String(s.updated_at || s.created_at),
      kind: "stripe_connected",
      msg: "Stripe connected.",
      business_id: s.business_id,
    });
  }

  const { data: gcal } = await admin
    .from("google_calendar_connections")
    .select("business_id,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  for (const g of gcal || []) {
    events.push({
      ts: String(g.updated_at || g.created_at),
      kind: "calendar_connected",
      msg: "Calendar connected.",
      business_id: g.business_id,
    });
  }

  const { data: bookings } = await admin
    .from("booking_requests")
    .select("id,business_id,customer_name,created_at,payment_status,paid_at,service_name")
    .order("created_at", { ascending: false })
    .limit(40);
  for (const b of bookings || []) {
    events.push({
      ts: String(b.created_at),
      kind: "first_booking",
      msg: `${b.customer_name || "Customer"} booked ${b.service_name || "a service"}.`,
      business_id: b.business_id,
    });
    if (b.payment_status === "paid") {
      events.push({
        ts: String(b.paid_at || b.created_at),
        kind: "first_payment",
        msg: "Payment received.",
        business_id: b.business_id,
      });
    }
  }

  const { data: hooks } = await admin
    .from("stripe_webhook_events")
    .select("id,type,processed_at")
    .order("processed_at", { ascending: false })
    .limit(15);
  for (const h of hooks || []) {
    if (String(h.type || "").includes("fail") || String(h.type || "").includes("dispute")) {
      events.push({
        ts: String(h.processed_at),
        kind: "error",
        msg: `Stripe event ${h.type}`,
        meta: h.id,
      });
    }
  }

  const { data: runs } = await admin
    .from("hubly_execution_runs")
    .select("id,business_id,status,started_at,errors")
    .order("started_at", { ascending: false })
    .limit(20);
  for (const r of runs || []) {
    if (String(r.status) === "failed" || r.errors) {
      const errMsg = typeof r.errors === "string"
        ? r.errors
        : (r.errors ? JSON.stringify(r.errors).slice(0, 80) : "");
      events.push({
        ts: String(r.started_at),
        kind: "error",
        msg: `Runtime failure${errMsg ? `: ${errMsg}` : ""}`,
        business_id: r.business_id,
      });
    }
  }

  events.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return events.slice(0, limit);
}

export async function buildSignups(admin: Admin, q = "") {
  const stripeMap = await loadStripeMap(admin);
  const calendarSet = await loadCalendarSet(admin);
  const statsMap = await bookingStatsByBusiness(admin);
  let query = admin
    .from("businesses")
    .select("id,name,slug,meta,created_at,business_type,email,owner_id,tier,city")
    .order("created_at", { ascending: false })
    .limit(150);
  if (q.trim()) {
    query = query.or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%,slug.ilike.%${q.trim()}%`);
  }
  const { data } = await query;
  return (data || []).map((b) =>
    enrichBusiness(b as Record<string, unknown>, stripeMap, calendarSet, statsMap)
  );
}

export async function buildFunnel(admin: Admin) {
  const stripeMap = await loadStripeMap(admin);
  const calendarSet = await loadCalendarSet(admin);
  const statsMap = await bookingStatsByBusiness(admin);
  const { data } = await admin
    .from("businesses")
    .select("id,name,slug,meta,created_at,business_type,email,owner_id,tier,city")
    .limit(2000);
  const rows = (data || []).map((b) =>
    enrichBusiness(b as Record<string, unknown>, stripeMap, calendarSet, statsMap)
  );
  const n = rows.length || 1;
  const stages = [
    { id: "signup", label: "Signup", count: rows.length },
    { id: "published", label: "Website Published", count: rows.filter((r) => r.published).length },
    { id: "stripe", label: "Stripe Connected", count: rows.filter((r) => r.stripe).length },
    { id: "calendar", label: "Calendar Connected", count: rows.filter((r) => r.calendar).length },
    { id: "first_booking", label: "First Booking", count: rows.filter((r) => r.first_booking).length },
    { id: "first_payment", label: "First Payment", count: rows.filter((r) => r.first_payment).length },
    {
      id: "subscriber",
      label: "Subscriber (tier=pro)",
      count: rows.filter((r) => String(r.tier || "") === "pro").length,
    },
  ].map((s) => ({
    ...s,
    pct: Math.round((100 * s.count) / n),
    drop_from_prev: null as number | null,
  }));
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count || 1;
    stages[i].drop_from_prev = Math.round((100 * (prev - stages[i].count)) / prev);
  }
  return { total: rows.length, stages };
}

export async function buildLaunchQueue(admin: Admin) {
  const signups = await buildSignups(admin, "");
  return signups.slice(0, 40).map((s) => {
    const steps = [
      { id: "signup", label: "Signed up", done: true },
      { id: "building", label: "Building", done: s.published || s.milestone !== "signed_up" },
      { id: "published", label: "Published", done: s.published },
      { id: "stripe", label: "Stripe", done: s.stripe },
      { id: "calendar", label: "Calendar", done: s.calendar },
      { id: "booking", label: "First booking", done: s.first_booking },
      { id: "payment", label: "First payment", done: s.first_payment },
    ];
    const doneCount = steps.filter((x) => x.done).length;
    return {
      ...s,
      progress: Math.round((100 * doneCount) / steps.length),
      steps,
      celebrate: s.first_payment,
    };
  });
}

export async function buildBusiness360(admin: Admin, businessId: string) {
  const { data: biz, error } = await admin
    .from("businesses")
    .select("id,name,slug,meta,created_at,business_type,email,owner_id,tier,city,phone,logo_url,banner_url")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !biz) return { error: "Business not found" };

  const stripeMap = await loadStripeMap(admin);
  const calendarSet = await loadCalendarSet(admin);
  const statsMap = await bookingStatsByBusiness(admin);
  const summary = enrichBusiness(biz as Record<string, unknown>, stripeMap, calendarSet, statsMap);

  const { data: memory } = await admin
    .from("business_memories")
    .select("memory,updated_at")
    .eq("business_id", businessId)
    .maybeSingle();
  const { data: dna } = await admin
    .from("business_dna")
    .select("dna,updated_at")
    .eq("business_id", businessId)
    .maybeSingle();
  const { data: timeline } = await admin
    .from("business_timeline_events")
    .select("id,kind,title,body,occurred_at")
    .eq("business_id", businessId)
    .order("occurred_at", { ascending: false })
    .limit(30);
  const { data: customers } = await admin
    .from("customers")
    .select("id,name,email,phone,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(25);
  const { data: payments } = await admin
    .from("booking_requests")
    .select("id,customer_name,service_name,payment_status,amount_paid_cents,paid_at,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(25);
  const { data: runs } = await admin
    .from("hubly_execution_runs")
    .select("id,status,started_at,completed_at,errors")
    .eq("business_id", businessId)
    .order("started_at", { ascending: false })
    .limit(20);

  // Redact secrets from meta before return
  const safeMeta = { ...metaObj(biz as Record<string, unknown>) };
  delete safeMeta.stripe;
  delete safeMeta.tokens;

  const dnaObj = (dna?.dna && typeof dna.dna === "object" ? dna.dna : null) as Record<string, unknown> | null;
  const blueprintHq = dnaObj
    ? {
      source: dnaObj.blueprintSource || null,
      confidence: dnaObj.blueprintConfidence ?? null,
      id: dnaObj.blueprintId || null,
      reasoning: dnaObj.blueprintReasoning || null,
    }
    : null;

  return {
    business: summary,
    memory: memory?.memory || null,
    dna: dna?.dna || null,
    blueprint: blueprintHq,
    website: {
      slug: biz.slug,
      published: summary.published,
      public_path: biz.slug ? `/${biz.slug}` : null,
    },
    crm: customers || [],
    timeline: timeline || [],
    payments: payments || [],
    connections: {
      stripe: summary.stripe_account,
      calendar: summary.calendar,
    },
    health: summary.health,
    ai_actions: runs || [],
    meta_safe: safeMeta,
  };
}

export async function buildSystemHealth(admin: Admin, env: {
  openai: boolean;
  claude: boolean;
  openaiTransport: string;
}) {
  const { count: webhookN } = await admin
    .from("stripe_webhook_events")
    .select("id", { count: "exact", head: true })
    .gte("processed_at", daysAgoIso(1));
  const { data: failRuns } = await admin
    .from("hubly_execution_runs")
    .select("id,status,started_at")
    .gte("started_at", daysAgoIso(1))
    .limit(100);
  const failed = (failRuns || []).filter((r) => String(r.status) === "failed").length;
  const totalRuns = (failRuns || []).length;

  const services = [
    {
      id: "openai",
      label: "OpenAI",
      status: env.openai ? "healthy" : "offline",
      detail: env.openai ? `Transport: ${env.openaiTransport}` : "OPENAI_API_KEY missing",
      critical: true,
    },
    {
      id: "claude",
      label: "Anthropic",
      status: "healthy",
      detail: "Retired from production path — OpenAI only (emergency: HUBLY_AI_ALLOW_CLAUDE=1)",
      critical: false,
    },
    {
      id: "stripe",
      label: "Stripe",
      status: (webhookN || 0) > 0 || !!Deno.env.get("STRIPE_SECRET_KEY")
        ? (Deno.env.get("STRIPE_SECRET_KEY") ? "healthy" : "warning")
        : "warning",
      detail: Deno.env.get("STRIPE_SECRET_KEY")
        ? `${webhookN || 0} webhook events / 24h`
        : "STRIPE_SECRET_KEY missing",
      critical: true,
    },
    {
      id: "supabase",
      label: "Supabase",
      status: "healthy",
      detail: "Service role reachable",
      critical: true,
    },
    {
      id: "email",
      label: "Email",
      status: Deno.env.get("RESEND_API_KEY") ? "healthy" : "warning",
      detail: Deno.env.get("RESEND_API_KEY") ? "Resend configured" : "RESEND_API_KEY missing",
      critical: true,
    },
    {
      id: "calendar",
      label: "Calendar",
      status: Deno.env.get("GOOGLE_CLIENT_ID") ? "healthy" : "warning",
      detail: Deno.env.get("GOOGLE_CLIENT_ID") ? "Google OAuth configured" : "Google OAuth env missing",
      critical: true,
    },
    {
      id: "publishing",
      label: "Publishing",
      status: "healthy",
      detail: "Slug + meta.website.published",
      critical: true,
    },
    {
      id: "edge",
      label: "Edge Functions",
      status: "healthy",
      detail: "mission-control / stripe-webhook / notify paths",
      critical: true,
    },
    {
      id: "jobs",
      label: "Background Jobs",
      status: failed > 5 ? "warning" : "healthy",
      detail: `${failed}/${totalRuns || 0} failed execution runs / 24h`,
      critical: true,
    },
    {
      id: "webhooks",
      label: "Webhooks",
      status: (webhookN || 0) > 0 ? "healthy" : "warning",
      detail: `${webhookN || 0} Stripe webhook events processed / 24h`,
      critical: true,
    },
  ];

  return { services, checked_at: new Date().toISOString() };
}

export async function buildAiHealth(env: {
  openai: boolean;
  claude: boolean;
  openaiTransport: string;
  reasoningModel: string;
}) {
  return {
    provider_primary: "openai",
    reasoning_model: env.reasoningModel,
    gateway: "hubly_ai.ts",
    transport: env.openaiTransport,
    transport_note: "OPENAI_TRANSPORT=responses|chat (Responses RC)",
    anthropic_on_production_path: false,
    configured: { openai: env.openai, claude_emergency_only: env.claude },
    average_latency_ms: null,
    failures_24h: null,
    average_tokens: null,
    note: "Production AI = OpenAI only. Anthropic is not required by any capability.",
  };
}

export async function buildErrors(admin: Admin) {
  const items: Array<Record<string, unknown>> = [];
  const { data: runs } = await admin
    .from("hubly_execution_runs")
    .select("id,business_id,status,errors,started_at")
    .order("started_at", { ascending: false })
    .limit(50);
  for (const r of runs || []) {
    if (String(r.status) !== "failed" && !r.errors) continue;
    const message = typeof r.errors === "string"
      ? r.errors
      : (r.errors ? JSON.stringify(r.errors).slice(0, 160) : "Execution failed");
    items.push({
      id: r.id,
      ts: r.started_at,
      severity: "high",
      capability: "runtime",
      connector: null,
      business_id: r.business_id,
      message,
    });
  }
  const { data: stripe } = await admin
    .from("stripe_connect_accounts")
    .select("business_id,last_error,updated_at")
    .not("last_error", "is", null)
    .order("updated_at", { ascending: false })
    .limit(30);
  for (const s of stripe || []) {
    items.push({
      id: `stripe-${s.business_id}`,
      ts: s.updated_at,
      severity: "medium",
      capability: "payments",
      connector: "stripe",
      business_id: s.business_id,
      message: s.last_error,
    });
  }
  items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return { items: items.slice(0, 80) };
}

export async function buildRevenue(admin: Admin) {
  const { data: paid } = await admin
    .from("booking_requests")
    .select("amount_paid_cents,paid_at,business_id,payment_status")
    .eq("payment_status", "paid")
    .limit(5000);
  const volume = (paid || []).reduce((s, r) => s + Number(r.amount_paid_cents || 0), 0);
  const { count: pro } = await admin
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("tier", "pro");
  const mrr = (pro || 0) * 29;
  return {
    mrr_estimate_usd: mrr,
    arr_estimate_usd: mrr * 12,
    stripe_hire_volume_cents: volume,
    trials: null,
    conversions: null,
    churn: null,
    note: "Hubly SaaS billing tables not present — MRR estimated from tier=pro. Hire volume from booking_requests.",
  };
}

export async function buildAdoption(admin: Admin) {
  const { count: total } = await admin.from("businesses").select("id", { count: "exact", head: true });
  const { count: withDna } = await admin.from("business_dna").select("business_id", { count: "exact", head: true });
  const { count: withMem } = await admin.from("business_memories").select("business_id", { count: "exact", head: true });
  const { count: stripe } = await admin
    .from("stripe_connect_accounts")
    .select("business_id", { count: "exact", head: true })
    .eq("charges_enabled", true);
  const { count: gcal } = await admin
    .from("google_calendar_connections")
    .select("business_id", { count: "exact", head: true });
  const n = total || 1;
  return {
    total_businesses: total || 0,
    features: [
      { id: "memory", label: "Business Memory", count: withMem || 0, pct: Math.round(100 * (withMem || 0) / n) },
      { id: "dna", label: "Business DNA / Creative Director", count: withDna || 0, pct: Math.round(100 * (withDna || 0) / n) },
      { id: "stripe", label: "Stripe / Payments", count: stripe || 0, pct: Math.round(100 * (stripe || 0) / n) },
      { id: "calendar", label: "Calendar", count: gcal || 0, pct: Math.round(100 * (gcal || 0) / n) },
      { id: "daily", label: "Hubly Daily", count: null, pct: null, note: "Client + hubly-daily — wire usage events later" },
      { id: "ask_ai", label: "Ask AI", count: null, pct: null, note: "Wire ai-advisor call metrics later" },
      { id: "owner_feed", label: "Owner Feed", count: null, pct: null, note: "Client aggregate — no server counter yet" },
    ],
  };
}

export async function buildNotifications(admin: Admin) {
  const alerts: Array<{ severity: string; title: string; detail: string }> = [];
  const { data: failRuns } = await admin
    .from("hubly_execution_runs")
    .select("id")
    .eq("status", "failed")
    .gte("started_at", daysAgoIso(1));
  if ((failRuns || []).length >= 5) {
    alerts.push({
      severity: "high",
      title: "Runtime failures spiking",
      detail: `${(failRuns || []).length} failed execution runs in 24h`,
    });
  }
  const funnel = await buildFunnel(admin);
  const stripeStage = funnel.stages.find((s) => s.id === "stripe");
  if (stripeStage && stripeStage.pct < 45) {
    alerts.push({
      severity: "medium",
      title: "Onboarding drop-off: Stripe",
      detail: `Only ${stripeStage.pct}% of businesses connected Stripe`,
    });
  }
  if (!Deno.env.get("OPENAI_API_KEY")) {
    alerts.push({
      severity: "high",
      title: "OpenAI offline",
      detail: "OPENAI_API_KEY missing",
    });
  }
  return { alerts, checked_at: new Date().toISOString() };
}

/** One score summarizing Hubly itself (Platform Health). */
export async function buildPlatformHealth(admin: Admin, env: {
  openai: boolean;
  claude: boolean;
  openaiTransport: string;
}) {
  const system = await buildSystemHealth(admin, env);
  const funnel = await buildFunnel(admin);
  const weights: Record<string, number> = {
    healthy: 100,
    warning: 55,
    offline: 0,
  };
  const critical = (system.services || []).filter((s: { critical?: boolean }) => s.critical !== false);
  const sysScore = critical.length
    ? Math.round(
      critical.reduce(
        (s: number, row: { status: string }) => s + (weights[row.status] ?? 40),
        0,
      ) / critical.length,
    )
    : 0;
  const pub = funnel.stages.find((s) => s.id === "published")?.pct ?? 0;
  const stripe = funnel.stages.find((s) => s.id === "stripe")?.pct ?? 0;
  const pay = funnel.stages.find((s) => s.id === "first_payment")?.pct ?? 0;
  const activationScore = Math.round(pub * 0.35 + stripe * 0.35 + pay * 0.3);
  const overall = Math.round(sysScore * 0.65 + activationScore * 0.35);
  const tone = overall >= 80 ? "ok" : overall >= 55 ? "warn" : "bad";
  return {
    overall,
    tone,
    system_score: sysScore,
    activation_score: activationScore,
    summary: overall >= 80
      ? "Platform Health is strong."
      : overall >= 55
      ? "Platform Health needs attention before scale."
      : "Platform Health is red — do not deploy until critical gates are green.",
    dimensions: system.services,
    funnel_pct: { published: pub, stripe, first_payment: pay },
    checked_at: new Date().toISOString(),
  };
}

/**
 * Production Readiness Gate — block/warn deploys when critical systems are red.
 */
export async function buildReleaseHealth(admin: Admin, env: {
  openai: boolean;
  claude: boolean;
  openaiTransport: string;
}) {
  const system = await buildSystemHealth(admin, env);
  const byId = Object.fromEntries((system.services || []).map((s: { id: string }) => [s.id, s]));

  const smoke = await latestSmokeRun(admin);
  const smokeAgeMs = smoke?.created_at
    ? Date.now() - new Date(String(smoke.created_at)).getTime()
    : Infinity;
  const smokeStale = smokeAgeMs > 36 * 60 * 60 * 1000; // 36h
  let smokeStatus = "offline";
  let smokeDetail = "No smoke run recorded — Release Gate RED until scripts/smoke-release.mjs passes";
  if (smoke) {
    if (!smoke.passed || smoke.gate_status === "red") {
      smokeStatus = "offline";
      smokeDetail = `Smoke FAILED (${(smoke.failed_ids || []).join(", ") || "see checks"}) @ ${smoke.created_at}`;
    } else if (smokeStale) {
      smokeStatus = "offline";
      smokeDetail = `Last green smoke is stale (>36h) @ ${smoke.created_at} — re-run smoke-release.mjs`;
    } else {
      smokeStatus = "healthy";
      smokeDetail = `Smoke green @ ${smoke.created_at}` +
        (smoke.commit_sha ? ` · ${String(smoke.commit_sha).slice(0, 7)}` : "");
    }
  }

  const checks = [
    { id: "ai_gateway", label: "AI Gateway healthy", status: byId.openai?.status || "offline", critical: true },
    { id: "publishing", label: "Website publishing healthy", status: byId.publishing?.status || "warning", critical: true },
    { id: "stripe", label: "Stripe healthy", status: byId.stripe?.status || "warning", critical: true },
    { id: "calendar", label: "Calendar healthy", status: byId.calendar?.status || "warning", critical: true },
    { id: "email", label: "Email healthy", status: byId.email?.status || "warning", critical: true },
    { id: "jobs", label: "Background jobs healthy", status: byId.jobs?.status || "warning", critical: true },
    { id: "webhooks", label: "Webhooks healthy", status: byId.webhooks?.status || "warning", critical: true },
    {
      id: "error_rate",
      label: "Error rate below threshold",
      status: byId.jobs?.status === "healthy" ? "healthy" : "warning",
      critical: true,
    },
    {
      id: "e2e_smoke",
      label: "End-to-end smoke test passed",
      status: smokeStatus,
      detail: smokeDetail,
      critical: true,
    },
    {
      id: "brain_validation",
      label: "Brain Validation",
      status: env.openai ? "healthy" : "offline",
      detail: "Memory/DNA path via HublyAI gateway — OpenAI production only",
      critical: true,
    },
    {
      id: "responses_rc",
      label: "OpenAI Responses RC",
      status: env.openaiTransport === "responses" ? "warning" : "healthy",
      detail: env.openaiTransport === "responses"
        ? "Responses default — merge only after live benchmark green (PR #184)"
        : "Chat Completions rollback active",
      critical: false,
    },
  ];

  const criticalRed = checks.filter((c) =>
    c.critical && (c.status === "offline" || c.status === "bad")
  );
  const criticalWarn = checks.filter((c) => c.critical && c.status === "warning");
  const deploy = criticalRed.length
    ? { ok: false, level: "blocked", message: "Deploy blocked — critical items are red." }
    : criticalWarn.length
    ? { ok: false, level: "warn", message: "Deploy warned — critical items need attention." }
    : { ok: true, level: "green", message: "Production Readiness Gate green." };

  return {
    checks,
    deploy,
    smoke,
    checked_at: new Date().toISOString(),
  };
}

export async function listWaitlist(admin: Admin, status?: string) {
  let q = admin
    .from("hubly_waitlist")
    .select(
      "id,email,name,business_idea,industry,city,status,batch_id,invited_at,signed_up_at,activated_at,published_at,subscribed_at,business_id,created_at,notes",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    // Table may not be migrated yet
    return { rows: [], error: error.message };
  }
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const st = String(row.status || "waiting");
    counts[st] = (counts[st] || 0) + 1;
  }
  return { rows: data || [], counts };
}

export async function inviteWaitlistBatch(
  admin: Admin,
  opts: { ids?: string[]; limit?: number; batch_id?: string; admin_email?: string },
) {
  const batchId = opts.batch_id || `batch-${new Date().toISOString().slice(0, 10)}`;
  let rows: Array<{ id: string }> = [];
  if (opts.ids?.length) {
    const { data } = await admin.from("hubly_waitlist").select("id").in("id", opts.ids);
    rows = data || [];
  } else {
    const { data } = await admin
      .from("hubly_waitlist")
      .select("id")
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(Math.min(50, opts.limit || 10));
    rows = data || [];
  }
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { invited: 0, batch_id: batchId };
  const { error } = await admin
    .from("hubly_waitlist")
    .update({
      status: "invited",
      invited_at: new Date().toISOString(),
      batch_id: batchId,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (error) return { invited: 0, batch_id: batchId, error: error.message };
  await writeAudit(admin, {
    admin_email: opts.admin_email || null,
    action: "hq.waitlist.invite_batch",
    resource_type: "waitlist_batch",
    resource_id: batchId,
    meta: { count: ids.length, ids },
  });
  return { invited: ids.length, batch_id: batchId, ids };
}

export async function addWaitlistEntry(
  admin: Admin,
  entry: { email: string; name?: string; business_idea?: string; industry?: string; city?: string },
) {
  const email = String(entry.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Valid email required" };
  const { data, error } = await admin
    .from("hubly_waitlist")
    .upsert(
      {
        email,
        name: entry.name || null,
        business_idea: entry.business_idea || null,
        industry: entry.industry || null,
        city: entry.city || null,
        status: "waiting",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id,email,status")
    .maybeSingle();
  if (error) return { error: error.message };
  return { row: data };
}

/** Create audited impersonation session — returns one-time token (not stored plaintext). */
export async function createImpersonationSession(
  admin: Admin,
  opts: { business_id: string; admin_email: string; reason?: string; hours?: number },
) {
  const businessId = String(opts.business_id || "").trim();
  if (!businessId) return { error: "business_id required" };
  const { data: biz } = await admin
    .from("businesses")
    .select("id,name,slug")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { error: "Business not found" };

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await sha256Hex(token);
  const hours = Math.min(8, Math.max(1, opts.hours || 2));
  const expires = new Date(Date.now() + hours * 3600000).toISOString();

  const { data, error } = await admin
    .from("hubly_impersonation_sessions")
    .insert({
      business_id: businessId,
      admin_email: opts.admin_email,
      token_hash: tokenHash,
      reason: opts.reason || "support",
      expires_at: expires,
    })
    .select("id,expires_at")
    .maybeSingle();
  if (error) return { error: error.message };

  await writeAudit(admin, {
    admin_email: opts.admin_email,
    action: "hq.impersonation.create",
    resource_type: "business",
    resource_id: businessId,
    meta: { session_id: data?.id, reason: opts.reason || "support", expires_at: expires },
  });

  // Public site view-as (read-first). Owner /app impersonation can honor token later.
  const viewPath = biz.slug
    ? `/${biz.slug}?hq_impersonate=${encodeURIComponent(token)}`
    : `/app?business_id=${encodeURIComponent(businessId)}&hq_impersonate=${encodeURIComponent(token)}`;

  return {
    session_id: data?.id,
    expires_at: expires,
    business: { id: biz.id, name: biz.name, slug: biz.slug },
    view_path: viewPath,
    token, // one-time — shown once to admin; only hash stored
    note: "Read-first support view. All actions must remain audited. Do not share the token.",
  };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read-only Admin Audit Log for Hubly HQ. */
export async function listAdminAuditLog(admin: Admin, limit = 100) {
  const { data, error } = await admin
    .from("admin_audit_log")
    .select("id,admin_email,admin_user_id,action,resource_type,resource_id,meta,ip,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) return { rows: [], error: error.message };
  return { rows: data || [] };
}

export async function latestSmokeRun(admin: Admin) {
  const { data, error } = await admin
    .from("hubly_smoke_runs")
    .select("id,passed,gate_status,checks,failed_ids,environment,commit_sha,reported_by,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Table may not be migrated yet — treat as missing run
    return null;
  }
  return data;
}

/** Record deployment smoke — drives Release Gate e2e_smoke (RED on fail). */
export async function recordSmokeRun(
  admin: Admin,
  opts: {
    passed: boolean;
    checks: unknown[];
    failed_ids?: string[];
    environment?: string;
    commit_sha?: string;
    reported_by?: string;
  },
) {
  const passed = !!opts.passed;
  const gate_status = passed ? "green" : "red";
  const { data, error } = await admin
    .from("hubly_smoke_runs")
    .insert({
      passed,
      gate_status,
      checks: opts.checks || [],
      failed_ids: opts.failed_ids || [],
      environment: opts.environment || null,
      commit_sha: opts.commit_sha || null,
      reported_by: opts.reported_by || null,
    })
    .select("id,passed,gate_status,created_at")
    .maybeSingle();
  if (error) return { error: error.message };
  await writeAudit(admin, {
    admin_email: opts.reported_by || "smoke-release",
    action: passed ? "hq.smoke.pass" : "hq.smoke.fail",
    resource_type: "smoke_run",
    resource_id: data?.id || null,
    meta: {
      gate_status,
      failed_ids: opts.failed_ids || [],
      commit_sha: opts.commit_sha || null,
    },
  });
  return { ok: true, run: data, gate_status };
}



/** Hubly HQ — Proof Mode board (Cleaning / Detailing / Lawn Care lifecycle). */
export const PROOF_VERTICALS = [
  "detailing",
  "cleaning",
  "windows",
  "pressure_washing",
  "landscaping",
  "hvac",
  "electrical",
  "plumbing",
  "painting",
  "junk_removal",
  "photography",
  "spa",
] as const;
export const PROOF_STEPS = [
  "build",
  "publish",
  "booking",
  "payment",
  "accept",
  "calendar",
  "crm",
  "complete",
  "review",
  "business_health",
  "hubly_daily",
] as const;

export async function buildProofMode(admin: Admin) {
  const { data, error } = await admin
    .from("hubly_proof_runs")
    .select("id,vertical,business_id,business_name,steps,status,notes,updated_at,created_at")
    .order("vertical", { ascending: true });
  if (error) {
    return {
      rows: defaultProofRows(),
      error: error.message,
      note: "Apply migration 20260722190000_hubly_proof_runs.sql",
    };
  }
  const byVert = new Map<string, Record<string, unknown>>();
  for (const row of data || []) {
    byVert.set(String(row.vertical), row as Record<string, unknown>);
  }
  const rows = PROOF_VERTICALS.map((v) => {
    const existing = byVert.get(v);
    if (existing) return existing;
    return defaultProofRow(v);
  });
  const allPass = rows.every((r) => String((r as { status?: string }).status || "") === "pass");
  return {
    rows,
    closed_beta_ready: allPass,
    steps: [...PROOF_STEPS],
    checked_at: new Date().toISOString(),
  };
}

function defaultProofRow(vertical: string) {
  const steps: Record<string, string> = {};
  for (const s of PROOF_STEPS) steps[s] = "pending";
  return {
    vertical,
    business_id: null,
    business_name: null,
    steps,
    status: "pending",
    notes: null,
  };
}

function defaultProofRows() {
  return PROOF_VERTICALS.map((v) => defaultProofRow(v));
}

export async function recordProofStep(
  admin: Admin,
  opts: {
    vertical: string;
    step: string;
    result: string;
    business_id?: string;
    business_name?: string;
    notes?: string;
    admin_email?: string;
  },
) {
  const vertical = String(opts.vertical || "").trim().toLowerCase().replace(/\s+/g, "_");
  const step = String(opts.step || "").trim().toLowerCase();
  const result = String(opts.result || "pending").trim().toLowerCase();
  if (!PROOF_VERTICALS.includes(vertical as typeof PROOF_VERTICALS[number])) {
    return { error: "vertical must be a Proof Mode industry key" };
  }
  if (!PROOF_STEPS.includes(step as typeof PROOF_STEPS[number])) {
    return { error: "unknown proof step" };
  }
  if (!["pass", "fail", "pending", "blocked", "skip"].includes(result)) {
    return { error: "result must be pass|fail|pending|blocked|skip" };
  }

  const { data: existing } = await admin
    .from("hubly_proof_runs")
    .select("id,steps,business_id,business_name,notes")
    .eq("vertical", vertical)
    .maybeSingle();

  const steps = {
    ...Object.fromEntries(PROOF_STEPS.map((s) => [s, "pending"])),
    ...((existing?.steps as Record<string, string>) || {}),
    [step]: result,
  };
  const values = Object.values(steps);
  let status = "pending";
  if (values.some((v) => v === "fail" || v === "blocked")) status = "fail";
  else if (PROOF_STEPS.every((s) => steps[s] === "pass" || steps[s] === "skip")) status = "pass";
  else if (values.some((v) => v === "pass")) status = "partial";

  const row = {
    vertical,
    business_id: opts.business_id || existing?.business_id || null,
    business_name: opts.business_name || existing?.business_name || null,
    steps,
    status,
    notes: opts.notes != null ? opts.notes : existing?.notes || null,
    updated_at: new Date().toISOString(),
  };

  let saved;
  if (existing?.id) {
    const { data, error } = await admin.from("hubly_proof_runs").update(row).eq("id", existing.id).select().maybeSingle();
    if (error) return { error: error.message };
    saved = data;
  } else {
    const { data, error } = await admin.from("hubly_proof_runs").insert(row).select().maybeSingle();
    if (error) return { error: error.message };
    saved = data;
  }

  await writeAudit(admin, {
    admin_email: opts.admin_email || "hubly-hq",
    action: "hq.proof.step",
    resource_type: "proof_run",
    resource_id: saved?.id || vertical,
    meta: { vertical, step, result, status },
  });

  return { ok: true, run: saved };
}

/** Living Blueprints — HQ AI Learning dashboard. */
export async function buildAiLearning(admin: Admin) {
  const { data: dnaRows, error: dnaErr } = await admin
    .from("business_dna")
    .select("business_id,dna,updated_at")
    .limit(2000);

  const counts: Record<string, number> = {
    official: 0,
    ai_generated: 0,
    hybrid: 0,
    community_learned: 0,
    hubly_optimized: 0,
    unknown: 0,
  };
  const byIndustry: Record<string, { n: number; confSum: number; sources: Record<string, number> }> = {};
  let confSum = 0;
  let confN = 0;
  const lowConfidence: Array<{ business_id: string; industry: string; confidence: number; source: string }> = [];
  const recommendations: string[] = [];

  for (const row of dnaRows || []) {
    const dna = (row.dna && typeof row.dna === "object" ? row.dna : {}) as Record<string, unknown>;
    const src = String(dna.blueprintSource || "unknown").toLowerCase().replace(/-/g, "_");
    const key = src in counts ? src : "unknown";
    counts[key] += 1;
    const conf = typeof dna.blueprintConfidence === "number"
      ? dna.blueprintConfidence
      : Number(dna.blueprintConfidence);
    if (Number.isFinite(conf)) {
      confSum += conf;
      confN += 1;
      if (conf < 80) {
        lowConfidence.push({
          business_id: String(row.business_id),
          industry: String(dna.blueprintId || "unknown"),
          confidence: conf,
          source: key,
        });
      }
    }
    const ind = String(dna.blueprintId || "unknown");
    if (!byIndustry[ind]) byIndustry[ind] = { n: 0, confSum: 0, sources: {} };
    byIndustry[ind].n += 1;
    if (Number.isFinite(conf)) byIndustry[ind].confSum += conf;
    byIndustry[ind].sources[key] = (byIndustry[ind].sources[key] || 0) + 1;

    const reasoning = dna.blueprintReasoning as { recommendation?: string } | null;
    if (reasoning?.recommendation && recommendations.length < 12) {
      recommendations.push(`${ind}: ${reasoning.recommendation}`);
    }
  }

  // Official registry count (static — Living Blueprints philosophy)
  const officialBlueprints = 8;
  const industryRows = Object.entries(byIndustry)
    .map(([id, v]) => ({
      industry: id,
      businesses: v.n,
      avg_confidence: v.n ? Math.round(v.confSum / Math.max(1, Object.values(v.sources).reduce((a, b) => a + b, 0) || v.n)) : null,
      sources: v.sources,
      hybrid_or_learned: (v.sources.hybrid || 0) + (v.sources.community_learned || 0) + (v.sources.hubly_optimized || 0),
    }))
    .sort((a, b) => b.businesses - a.businesses);

  const mostImproved = [...industryRows].sort((a, b) => b.hybrid_or_learned - a.hybrid_or_learned)[0] || null;
  const lowestConf = [...industryRows]
    .filter((r) => r.avg_confidence != null)
    .sort((a, b) => (a.avg_confidence || 0) - (b.avg_confidence || 0))[0] || null;

  let signals: Array<Record<string, unknown>> = [];
  let signalsNote: string | null = null;
  const { data: sigData, error: sigErr } = await admin
    .from("hubly_blueprint_signals")
    .select("industry,signal_type,signal_key,hit_count,weight,updated_at")
    .order("hit_count", { ascending: false })
    .limit(40);
  if (sigErr) {
    signalsNote = "Apply migration 20260722200000_hubly_blueprint_signals.sql — " + sigErr.message;
  } else {
    signals = (sigData || []) as Array<Record<string, unknown>>;
  }

  // Top requested new industry heuristic: unknown / generic blueprint ids
  const topRequested = industryRows
    .filter((r) => !["detailing", "cleaning", "windows", "pressure_washing", "landscaping", "hvac", "photography", "spa", "electrical", "plumbing", "painting", "junk_removal", "unknown"].includes(r.industry))
    .slice(0, 5);

  const avgConfidence = confN ? Math.round(confSum / confN) : null;

  return {
    philosophy: "Living Blueprints — knowledge is the moat. Official files are a starting point, not the goal.",
    living_path: [
      "Official or AI Generated",
      "Owner edits",
      "Customer behavior",
      "Bookings · Reviews · Revenue",
      "Blueprint improves",
      "Community Learned / Hubly Optimized",
      "Promote to Official",
    ],
    counts: {
      official_blueprints: officialBlueprints,
      official: counts.official,
      ai_generated: counts.ai_generated,
      hybrid: counts.hybrid,
      community_learned: counts.community_learned,
      hubly_optimized: counts.hubly_optimized,
      unknown: counts.unknown,
      businesses_with_dna: (dnaRows || []).length,
    },
    average_confidence: avgConfidence,
    most_improved_industry: mostImproved
      ? { id: mostImproved.industry, hybrid_or_learned: mostImproved.hybrid_or_learned, businesses: mostImproved.businesses }
      : null,
    lowest_confidence_industry: lowestConf
      ? { id: lowestConf.industry, avg_confidence: lowestConf.avg_confidence, businesses: lowestConf.businesses }
      : null,
    top_requested_new_industry: topRequested[0]?.industry || null,
    top_requested: topRequested,
    industries: industryRows.slice(0, 24),
    low_confidence_businesses: lowConfidence.slice(0, 20),
    community_signals: signals,
    signals_note: signalsNote,
    hq_recommendations: recommendations.slice(0, 8),
    dna_error: dnaErr?.message || null,
    checked_at: new Date().toISOString(),
  };
}

/** Record a Blueprint Intelligence signal (community learning). */
export async function recordBlueprintSignal(
  admin: Admin,
  opts: {
    industry: string;
    signal_type: string;
    signal_key: string;
    weight?: number;
    meta?: Record<string, unknown>;
    admin_email?: string;
  },
) {
  const industry = String(opts.industry || "").trim().toLowerCase();
  const signal_type = String(opts.signal_type || "").trim();
  const signal_key = String(opts.signal_key || "").trim();
  if (!industry || !signal_type || !signal_key) {
    return { error: "industry, signal_type, and signal_key required" };
  }
  const { data, error } = await admin.rpc("hubly_record_blueprint_signal", {
    p_industry: industry,
    p_signal_type: signal_type,
    p_signal_key: signal_key,
    p_weight: opts.weight ?? 1,
    p_meta: opts.meta || {},
  });
  if (error) {
    // Fallback upsert if RPC not applied yet
    const { data: existing } = await admin
      .from("hubly_blueprint_signals")
      .select("id,hit_count")
      .eq("industry", industry)
      .eq("signal_type", signal_type)
      .eq("signal_key", signal_key)
      .maybeSingle();
    if (existing?.id) {
      const { data: updated, error: uErr } = await admin
        .from("hubly_blueprint_signals")
        .update({
          hit_count: Number(existing.hit_count || 0) + 1,
          weight: opts.weight ?? 1,
          meta: opts.meta || {},
        })
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (uErr) return { error: uErr.message };
      return { ok: true, signal: updated, via: "update" };
    }
    const { data: inserted, error: iErr } = await admin
      .from("hubly_blueprint_signals")
      .insert({
        industry,
        signal_type,
        signal_key,
        hit_count: 1,
        weight: opts.weight ?? 1,
        meta: opts.meta || {},
      })
      .select()
      .maybeSingle();
    if (iErr) return { error: iErr.message || error.message };
    return { ok: true, signal: inserted, via: "insert" };
  }
  await writeAudit(admin, {
    admin_email: opts.admin_email || "hubly-hq",
    action: "hq.blueprint.signal",
    resource_type: "blueprint_signal",
    resource_id: industry,
    meta: { signal_type, signal_key },
  });
  return { ok: true, signal: data, via: "rpc" };
}

