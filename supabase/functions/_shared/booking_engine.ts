/**
 * Hubly Booking Engine — provider-agnostic.
 *
 * Knows only: service_id, duration, pricing, availability rules,
 * booking rules, payment rules, customer details.
 * Industry/catalog content comes from the Shared Service Catalog
 * (businesses.meta.editorSvcs / services) — never duplicated here.
 *
 * Powers: marketplace, provider websites, future AI booking, Hubly Pro.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getAvailability,
  listAppointmentSlots,
  type AvailabilityResult,
  type AppointmentSlot,
  type DayHours,
} from "./marketplace_availability.ts";
import { buildLifecycleSnapshot } from "./marketplace_lifecycle.ts";

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentRule =
  | "pay_in_full"
  | "deposit"
  | "card_on_file"
  | "pay_after_service";

export type BookingChannel = "marketplace" | "website" | "ai" | "crm";

export type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  price_label: string | null;
  duration_minutes: number;
  includes: string[];
  add_ons: Array<{ id: string; name: string; price_cents: number | null }>;
  image_url: string | null;
};

export type PaymentSummary = {
  rule: PaymentRule;
  rule_label: string;
  price_cents: number | null;
  deposit_cents: number | null;
  charge_now_cents: number;
  currency: string;
  requires_checkout: boolean;
  message: string | null;
};

export type CreateBookingInput = {
  provider: Record<string, unknown>;
  business: Record<string, unknown>;
  service_id: string;
  starts_at: string;
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  add_on_ids?: string[];
  notes?: string | null;
  channel?: BookingChannel;
  /** Why Hubly matched — stored for confirmation, not ranking */
  match_why?: string[] | null;
};

export type BookingConfirmation = {
  booking_id: string;
  confirmation_code: string;
  status: BookingStatus;
  instant_book: boolean;
  headline: string;
  provider: { id: string; business_id: string; name: string; phone: string | null };
  service: { id: string; name: string; duration_minutes: number };
  starts_at: string;
  ends_at: string;
  address: string | null;
  payment: PaymentSummary;
  what_happens_next: string;
  why_matched: string[];
};

type Admin = SupabaseClient;

function normalize(s: unknown): string {
  return String(s || "").toLowerCase().trim();
}

function dollarsToCents(n: unknown): number | null {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.round(x * 100);
}

function readPackages(business: Record<string, unknown>): Array<Record<string, unknown>> {
  const meta = (business.meta || {}) as Record<string, unknown>;
  if (Array.isArray(meta.editorSvcs)) return meta.editorSvcs as Array<Record<string, unknown>>;
  if (Array.isArray(meta.services)) return meta.services as Array<Record<string, unknown>>;
  return [];
}

function serviceDurationMinutes(raw: Record<string, unknown>): number {
  const mins = Number(raw.durationMinutes ?? raw.duration_minutes ?? raw.mins);
  if (Number.isFinite(mins) && mins > 0) return Math.round(mins);
  const hours = Number(raw.durationHours ?? raw.duration_hours ?? raw.hours);
  if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
  const dur = String(raw.duration || raw.time || "").toLowerCase();
  const hm = dur.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hm) return Math.round(Number(hm[1]) * 60);
  const mm = dur.match(/(\d+)\s*m/);
  if (mm) return Number(mm[1]);
  return 120;
}

function servicePriceCents(raw: Record<string, unknown>): number | null {
  return dollarsToCents(raw.price ?? raw.startingPrice ?? raw.amount ?? raw.starting_at);
}

function serviceIncludes(raw: Record<string, unknown>): string[] {
  const list = raw.includes ?? raw.included ?? raw.includeList;
  if (Array.isArray(list)) return list.map((x) => String(x)).filter(Boolean);
  if (typeof list === "string" && list.trim()) {
    return list.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Resolve a catalog service by id (or name fallback). Industry-agnostic. */
export function resolveService(
  business: Record<string, unknown>,
  serviceId: string,
): CatalogService | null {
  const packs = readPackages(business);
  if (!packs.length) return null;
  const needle = String(serviceId || "").trim();
  if (!needle) return null;

  let raw = packs.find((p) => String(p.id || "") === needle) || null;
  if (!raw) {
    raw = packs.find((p) => normalize(p.name || p.title) === normalize(needle)) || null;
  }
  if (!raw) return null;

  const id = String(raw.id || needle);
  const name = String(raw.name || raw.title || "Service").trim() || "Service";
  const price = servicePriceCents(raw);
  const addOnsRaw = Array.isArray(raw.addOns)
    ? raw.addOns
    : (Array.isArray(raw.addons) ? raw.addons : []);
  const add_ons = (addOnsRaw as Array<Record<string, unknown>>).map((a, i) => ({
    id: String(a.id || `addon-${i}`),
    name: String(a.name || a.title || "Add-on"),
    price_cents: dollarsToCents(a.price ?? a.amount),
  }));

  const img = raw.imgUrl || raw.image ||
    (Array.isArray(raw.photos) && raw.photos[0] ? raw.photos[0] : null);
  return {
    id,
    name,
    description: raw.description ? String(raw.description) : (raw.desc ? String(raw.desc) : null),
    price_cents: price,
    price_label: price != null
      ? `$${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}`
      : (raw.priceLabel ? String(raw.priceLabel) : null),
    duration_minutes: serviceDurationMinutes(raw),
    includes: serviceIncludes(raw),
    add_ons,
    image_url: img ? String(img) : null,
  };
}

/** List services from Shared Service Catalog for a business. */
export function listCatalogServices(business: Record<string, unknown>): CatalogService[] {
  return readPackages(business)
    .map((p, i) => {
      const id = String(p.id || `svc-${i}`);
      return resolveService(business, id);
    })
    .filter((s): s is CatalogService => !!s && !!s.name);
}

export function resolvePaymentRule(business: Record<string, unknown>): {
  rule: PaymentRule;
  deposit_type: "pct" | "flat";
  deposit_val: number;
  message: string | null;
} {
  const meta = (business.meta || {}) as Record<string, unknown>;
  const setting = normalize(meta.paymentSetting || "later");
  let rule: PaymentRule = "pay_after_service";
  if (setting === "full" || setting === "pay_in_full" || setting === "upfront") {
    rule = "pay_in_full";
  } else if (setting === "deposit") {
    rule = "deposit";
  } else if (setting === "card" || setting === "card_on_file") {
    rule = "card_on_file";
  } else {
    rule = "pay_after_service";
  }
  const deposit_type = normalize(meta.depositType) === "flat" ? "flat" : "pct";
  const deposit_val = Number(meta.depositVal ?? 25) || 25;
  const message = meta.depositMessage ? String(meta.depositMessage) : null;
  return { rule, deposit_type, deposit_val, message };
}

export function buildPaymentSummary(
  business: Record<string, unknown>,
  priceCents: number | null,
): PaymentSummary {
  const cfg = resolvePaymentRule(business);
  let deposit_cents: number | null = null;
  let charge_now = 0;
  if (priceCents != null && priceCents > 0) {
    if (cfg.rule === "pay_in_full") charge_now = priceCents;
    else if (cfg.rule === "deposit") {
      deposit_cents = cfg.deposit_type === "flat"
        ? Math.round(cfg.deposit_val * (cfg.deposit_val < 1000 ? 100 : 1))
        : Math.round(priceCents * (cfg.deposit_val / 100));
      deposit_cents = Math.max(50, Math.min(priceCents, deposit_cents));
      charge_now = deposit_cents;
    }
  }
  const labels: Record<PaymentRule, string> = {
    pay_in_full: "Pay in full",
    deposit: "Deposit required",
    card_on_file: "Card on file",
    pay_after_service: "Pay after service",
  };
  const requires_checkout = (cfg.rule === "pay_in_full" || cfg.rule === "deposit") &&
    charge_now >= 50;
  return {
    rule: cfg.rule,
    rule_label: labels[cfg.rule],
    price_cents: priceCents,
    deposit_cents,
    charge_now_cents: charge_now,
    currency: "usd",
    requires_checkout,
    message: cfg.message,
  };
}

function confirmationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "H";
  for (let i = 0; i < 7; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function whatHappensNext(status: BookingStatus, instant: boolean, payment: PaymentSummary): string {
  if (status === "confirmed") {
    if (payment.requires_checkout && payment.charge_now_cents > 0) {
      return "Your appointment is confirmed. Complete payment to lock it in — you’ll get a receipt by email.";
    }
    return "You’re all set. The provider has your appointment on their calendar. We’ll remind you before it starts.";
  }
  if (instant) {
    return "Your booking is confirmed. The provider will see it immediately.";
  }
  return "Your booking request was sent. The provider will accept or decline shortly — you’ll be notified either way.";
}

function parseHmFromIso(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return { date, time };
}

/** Load calendar inputs for a business (jobs + google + hours). */
export async function loadAvailabilityContext(
  admin: Admin,
  businessId: string,
  provider: Record<string, unknown> | null,
  durationMinutes: number,
  fromDate?: string | null,
): Promise<{
  hours: Record<string, DayHours> | null;
  jobs: Array<Record<string, unknown>>;
  googleEvents: Array<Record<string, unknown>>;
  googleConnected: boolean;
  result: AvailabilityResult;
  slots: AppointmentSlot[];
}> {
  const { data: business } = await admin
    .from("businesses")
    .select("id,meta")
    .eq("id", businessId)
    .maybeSingle();
  const meta = ((business?.meta || {}) as Record<string, unknown>);
  const hours = (meta.hours || null) as Record<string, DayHours> | null;

  const { data: gconn } = await admin
    .from("google_calendar_connections")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  const googleConnected = !!gconn?.id;

  const base = (fromDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
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

  // Also block existing marketplace bookings with real slots
  const { data: mBooks } = await admin
    .from("marketplace_bookings")
    .select("starts_at,ends_at,status,service_name,duration_minutes,requested_date,requested_time")
    .eq("business_id", businessId)
    .in("status", ["requested", "confirmed", "in_progress"]);

  const jobRows = [...(jobs || [])];
  for (const b of mBooks || []) {
    if (b.starts_at) {
      const { date, time } = parseHmFromIso(String(b.starts_at));
      const durM = Number(b.duration_minutes) || durationMinutes;
      jobRows.push({
        scheduled_date: date,
        scheduled_time: time,
        duration_hours: durM / 60,
        status: "scheduled",
        service_name: b.service_name || "Marketplace booking",
      });
    } else if (b.requested_date) {
      jobRows.push({
        scheduled_date: String(b.requested_date).slice(0, 10),
        scheduled_time: b.requested_time || "09:00",
        duration_hours: (Number(b.duration_minutes) || durationMinutes) / 60,
        status: "scheduled",
        service_name: b.service_name || "Marketplace booking",
      });
    }
  }

  let googleEvents: Array<Record<string, unknown>> = [];
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

  const availInput = {
    date: base,
    durationMinutes,
    weekendJobs: provider?.weekend_jobs !== false,
    hours,
    jobs: jobRows as never[],
    googleEvents: googleEvents as never[],
    googleConnected,
    outlookConnected: false,
    acceptingNewJobs: provider?.accepting_new_jobs !== false,
  };

  return {
    hours,
    jobs: jobRows,
    googleEvents,
    googleConnected,
    result: getAvailability(availInput),
    slots: listAppointmentSlots({ ...availInput, days: 14, slotStepMinutes: 30, bufferMinutes: 15 }),
  };
}

async function upsertCustomer(
  admin: Admin,
  businessId: string,
  customer: CreateBookingInput["customer"],
): Promise<string> {
  const email = customer.email?.trim() || null;
  const phone = customer.phone?.trim() || null;
  if (email) {
    const { data: existing } = await admin
      .from("marketplace_customers")
      .select("id")
      .eq("business_id", businessId)
      .ilike("email", email)
      .maybeSingle();
    if (existing?.id) {
      await admin.from("marketplace_customers").update({
        name: customer.name,
        phone: phone || undefined,
        address: customer.address || undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      return String(existing.id);
    }
  }
  const { data, error } = await admin
    .from("marketplace_customers")
    .insert({
      business_id: businessId,
      name: customer.name,
      email,
      phone,
      address: customer.address || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

async function reserveCalendarJob(
  admin: Admin,
  opts: {
    businessId: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    serviceName: string;
    startsAt: string;
    durationMinutes: number;
    address: string | null;
    notes: string | null;
    status: "scheduled" | "pending";
  },
): Promise<string | null> {
  const { date, time } = parseHmFromIso(opts.startsAt);
  try {
    const { data, error } = await admin
      .from("jobs")
      .insert({
        business_id: opts.businessId,
        customer_name: opts.customerName,
        email: opts.customerEmail,
        phone: opts.customerPhone,
        service_name: opts.serviceName,
        scheduled_date: date,
        scheduled_time: time,
        duration_hours: opts.durationMinutes / 60,
        address: opts.address,
        notes: opts.notes,
        status: opts.status,
        from_booking: true,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("booking_engine reserve job", error.message);
      return null;
    }
    return data?.id ? String(data.id) : null;
  } catch (e) {
    console.warn("booking_engine reserve job", e);
    return null;
  }
}

/**
 * Create a booking through the engine.
 * Instant Book → confirmed + calendar reservation.
 * Otherwise → requested (provider accepts later).
 */
export async function createBooking(
  admin: Admin,
  input: CreateBookingInput,
): Promise<{ booking: Record<string, unknown>; confirmation: BookingConfirmation }> {
  const life = buildLifecycleSnapshot(input.provider);
  const instant = !!life.can_instant_book;
  if (!life.can_accept_leads) {
    throw new Error("This provider isn’t accepting bookings right now.");
  }
  if (!instant && !life.can_booking_request) {
    throw new Error("This provider isn’t accepting booking requests right now.");
  }

  const customerName = String(input.customer.name || "").trim();
  if (!customerName) throw new Error("customer name is required");

  const service = resolveService(input.business, input.service_id);
  if (!service) throw new Error("Service not found in provider catalog");

  const startsAt = String(input.starts_at || "").trim();
  if (!startsAt || !Number.isFinite(Date.parse(startsAt))) {
    throw new Error("A real appointment time is required");
  }
  const endsAt = new Date(Date.parse(startsAt) + service.duration_minutes * 60_000).toISOString();

  // Double-book guard: slot must still be open
  const ctx = await loadAvailabilityContext(
    admin,
    String(input.business.id),
    input.provider,
    service.duration_minutes,
    startsAt.slice(0, 10),
  );
  const stillOpen = ctx.slots.some((s) => s.starts_at === startsAt ||
    Math.abs(Date.parse(s.starts_at) - Date.parse(startsAt)) < 60_000);
  if (!stillOpen) {
    throw new Error("That appointment time is no longer available — pick another.");
  }

  const selectedAddOns = (input.add_on_ids || [])
    .map((id) => service.add_ons.find((a) => a.id === id))
    .filter(Boolean) as CatalogService["add_ons"];
  let priceCents = service.price_cents;
  for (const a of selectedAddOns) {
    if (a.price_cents != null) priceCents = (priceCents || 0) + a.price_cents;
  }

  const payment = buildPaymentSummary(input.business, priceCents);
  const status: BookingStatus = instant ? "confirmed" : "requested";
  const code = confirmationCode();
  const businessId = String(input.business.id);
  const providerId = String(input.provider.id);

  const customerId = await upsertCustomer(admin, businessId, input.customer);

  const { date, time } = parseHmFromIso(startsAt);
  const nextCopy = whatHappensNext(status, instant, payment);

  const row = {
    provider_id: providerId,
    business_id: businessId,
    customer_id: customerId,
    customer_name: customerName,
    customer_email: input.customer.email?.trim() || null,
    customer_phone: input.customer.phone?.trim() || null,
    address: input.customer.address?.trim() || null,
    notes: input.notes?.trim() || null,
    service_id: service.id,
    service_name: service.name,
    requested_date: date,
    requested_time: time,
    starts_at: startsAt,
    ends_at: endsAt,
    duration_minutes: service.duration_minutes,
    price_cents: priceCents,
    currency: "usd",
    payment_rule: payment.rule,
    payment_status: payment.requires_checkout ? "pending" : "none",
    deposit_cents: payment.deposit_cents,
    amount_paid_cents: 0,
    confirmation_code: code,
    channel: input.channel || "marketplace",
    add_ons: selectedAddOns,
    what_happens_next: nextCopy,
    instant_book: instant,
    status,
    service_snapshot: {
      id: service.id,
      name: service.name,
      duration_minutes: service.duration_minutes,
      price_cents: service.price_cents,
      includes: service.includes,
      why_matched: input.match_why || [],
    },
  };

  const { data: booking, error } = await admin
    .from("marketplace_bookings")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;

  // Conversation thread
  const { data: convo } = await admin
    .from("marketplace_conversations")
    .insert({
      business_id: businessId,
      provider_id: providerId,
      booking_id: booking.id,
      customer_id: customerId,
      subject: `${service.name} — ${date}`,
    })
    .select("id")
    .single();
  if (convo?.id) {
    await admin.from("marketplace_bookings").update({
      conversation_id: convo.id,
      updated_at: new Date().toISOString(),
    }).eq("id", booking.id);
    booking.conversation_id = convo.id;
  }

  // Calendar reservation (prevents double booking via jobs + availability)
  const jobId = await reserveCalendarJob(admin, {
    businessId,
    customerName,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    serviceName: service.name,
    startsAt,
    durationMinutes: service.duration_minutes,
    address: row.address,
    notes: row.notes,
    status: instant ? "scheduled" : "pending",
  });
  if (jobId) {
    await admin.from("marketplace_bookings").update({
      job_id: jobId,
      updated_at: new Date().toISOString(),
    }).eq("id", booking.id);
    booking.job_id = jobId;
  }

  const confirmation: BookingConfirmation = {
    booking_id: String(booking.id),
    confirmation_code: code,
    status,
    instant_book: instant,
    headline: status === "confirmed" ? "Booking confirmed" : "Booking request sent",
    provider: {
      id: providerId,
      business_id: businessId,
      name: String(input.business.name || "Provider"),
      phone: input.business.phone ? String(input.business.phone) : null,
    },
    service: {
      id: service.id,
      name: service.name,
      duration_minutes: service.duration_minutes,
    },
    starts_at: startsAt,
    ends_at: endsAt,
    address: row.address,
    payment,
    what_happens_next: nextCopy,
    why_matched: input.match_why || [],
  };

  return { booking, confirmation };
}

export function publicCatalogPayload(business: Record<string, unknown>) {
  const services = listCatalogServices(business);
  const payment = buildPaymentSummary(
    business,
    services[0]?.price_cents ?? null,
  );
  return {
    services,
    payment_defaults: {
      rule: payment.rule,
      rule_label: payment.rule_label,
      message: payment.message,
    },
  };
}
