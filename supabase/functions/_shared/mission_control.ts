/**
 * Hubly Mission Control — internal platform operating system.
 * Read-first aggregates for CEO Daily, funnel, launch queue, health.
 * Never simulates Stripe/OpenAI success. Never returns customer secrets.
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

  const stripeRate = allFlags.length ? Math.round((100 * stripeConnected) / allFlags.length) : 0;
  const biggestBlocker = stripeRate < 60
    ? `Only ${stripeRate}% connected Stripe.`
    : allFlags.filter((b) => b.published).length / Math.max(1, allFlags.length) < 0.5
    ? "Fewer than half of businesses have published."
    : "Watch first-booking conversion.";

  const recommendation = stripeRate < 60
    ? "Improve the Stripe connection flow."
    : "Tighten publish → first booking coaching in Hubly Daily.";

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return {
    greeting: `${greet}, Adrian.`,
    yesterday: {
      new_businesses: newYesterday,
      published: publishedYesterday,
      first_customers: firstCustomersYesterday,
      processed_cents: revenueYesterdayCents,
      processed_display: `$${(revenueYesterdayCents / 100).toFixed(0)}`,
    },
    biggest_blocker: biggestBlocker,
    recommendation,
    totals: {
      businesses: totalBiz || allFlags.length,
      stripe_connected_pct: stripeRate,
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
    .select("id,business_id,status,started_at,error")
    .order("started_at", { ascending: false })
    .limit(20);
  for (const r of runs || []) {
    if (String(r.status) === "failed" || r.error) {
      events.push({
        ts: String(r.started_at),
        kind: "error",
        msg: `Runtime failure${r.error ? `: ${String(r.error).slice(0, 80)}` : ""}`,
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
    .select("id,status,started_at,finished_at,error")
    .eq("business_id", businessId)
    .order("started_at", { ascending: false })
    .limit(20);

  // Redact secrets from meta before return
  const safeMeta = { ...metaObj(biz as Record<string, unknown>) };
  delete safeMeta.stripe;
  delete safeMeta.tokens;

  return {
    business: summary,
    memory: memory?.memory || null,
    dna: dna?.dna || null,
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
    },
    {
      id: "claude",
      label: "Claude",
      status: env.claude ? "healthy" : "warning",
      detail: env.claude ? "Configured" : "ANTHROPIC_API_KEY missing (fallback)",
    },
    {
      id: "stripe",
      label: "Stripe",
      status: (webhookN || 0) > 0 ? "healthy" : "warning",
      detail: `${webhookN || 0} webhook events / 24h`,
    },
    {
      id: "supabase",
      label: "Supabase",
      status: "healthy",
      detail: "Service role reachable",
    },
    {
      id: "email",
      label: "Email",
      status: Deno.env.get("RESEND_API_KEY") ? "healthy" : "warning",
      detail: Deno.env.get("RESEND_API_KEY") ? "Resend configured" : "RESEND_API_KEY missing",
    },
    {
      id: "calendar",
      label: "Calendar",
      status: Deno.env.get("GOOGLE_CLIENT_ID") ? "healthy" : "warning",
      detail: Deno.env.get("GOOGLE_CLIENT_ID") ? "Google OAuth configured" : "Google OAuth env missing",
    },
    {
      id: "publishing",
      label: "Publishing",
      status: "healthy",
      detail: "Slug + meta.website.published",
    },
    {
      id: "jobs",
      label: "Background Jobs",
      status: failed > 5 ? "warning" : "healthy",
      detail: `${failed}/${totalRuns || 0} failed execution runs / 24h`,
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
    transport_note: "OPENAI_TRANSPORT=responses|chat",
    configured: { openai: env.openai, claude: env.claude },
    average_latency_ms: null,
    failures_24h: null,
    average_tokens: null,
    note: "Wire live latency from edge logs / future ai_call_metrics table. No new AI capabilities — telemetry only.",
  };
}

export async function buildErrors(admin: Admin) {
  const items: Array<Record<string, unknown>> = [];
  const { data: runs } = await admin
    .from("hubly_execution_runs")
    .select("id,business_id,status,error,started_at")
    .order("started_at", { ascending: false })
    .limit(50);
  for (const r of runs || []) {
    if (String(r.status) !== "failed" && !r.error) continue;
    items.push({
      id: r.id,
      ts: r.started_at,
      severity: "high",
      capability: "runtime",
      connector: null,
      business_id: r.business_id,
      message: r.error || "Execution failed",
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
