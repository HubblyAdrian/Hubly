// Website Concierge booking execution — the real backend target the
// "customer" conversation context's booking capability dispatches to when
// the visitor is on a specific business's own website (as opposed to
// Marketplace's provider-matching flow, which keeps using
// marketplace_bookings exactly as it already does — see
// hubly_capability_registry.ts's booking.create/getAvailability, which
// branch on args.bookingChannel).
//
// A business's own website customer becomes a real Hubly Job immediately:
// same `jobs`/`customers` tables the owner-facing app uses, same Google
// Calendar sync module `google-calendar-push-job`'s own handler calls.
// public/hubly.html's createJob()/findOrCreateCustomer() are browser
// functions — there is no module boundary between that runtime and this
// Deno edge function, so they cannot literally be imported here. This
// ports the same real operations (same tables, same column shapes) rather
// than inventing different behavior; anywhere a genuinely shared module
// already existed (service_engine.ts for real service data, the Google
// Calendar sync engine), it's imported directly, not re-implemented.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCatalog, getService } from "./service_engine.ts";
import { syncEnginePushCreate } from "./google_calendar_sync_engine.ts";
import { computeNextOccurrenceDate, VALID_FREQUENCIES, type RecurringFrequency } from "./recurring_schedule_engine.ts";
import { getCustomerMembership, type CustomerMembership } from "./customer_membership.ts";
import { notifyBookingCreated } from "./booking_notifications.ts";
import { buildPortalUrl, issuePortalAccessToken } from "./portal_access.ts";
import { resolveOrCreateCrmCustomer } from "./crm_customer.ts";

type DayHours = { open: string; close: string; closed: boolean };

// Mirrors hoursForBookingDate()'s own fallback default (public/hubly.html)
// exactly — an unset business gets the same honest default hours the
// owner-facing booking wizard already assumes, not an invented one.
const DEFAULT_HOURS: Record<string, DayHours> = {
  Sun: { open: "09:00", close: "17:00", closed: false },
  Mon: { open: "08:00", close: "17:00", closed: false },
  Tue: { open: "08:00", close: "17:00", closed: false },
  Wed: { open: "08:00", close: "17:00", closed: false },
  Thu: { open: "08:00", close: "17:00", closed: false },
  Fri: { open: "08:00", close: "17:00", closed: false },
  Sat: { open: "08:00", close: "15:00", closed: false },
};
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMin(hhmm: string): number {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function loadBusinessForBooking(admin: SupabaseClient, businessId: string) {
  // #188: name/phone/email added for real confirmation-email content
  // (booking_notifications.ts's business.name/email/phone fields).
  // #189: slug added to build the real portal URL. Other existing
  // callers only ever read .meta, so widening this select doesn't
  // change their behavior.
  const { data } = await admin
    .from("businesses")
    .select("id, meta, name, phone, email, slug")
    .eq("id", businessId)
    .maybeSingle();
  return data || null;
}

/** Real slots for one date on this business's own calendar — their real
 *  hours (meta.hours, same shape/fallback hoursForBookingDate() already
 *  uses) minus real busy windows from get_busy_windows, the same Postgres
 *  RPC fetchBusyWindows() already calls client-side. Never invents a slot:
 *  a business with no hours configured gets the honest default hours; any
 *  real scheduling conflict removes that hour, nothing else does. */
export async function getWebsiteAvailability(
  admin: SupabaseClient,
  opts: { businessId: string; date: string; durationMinutes?: number },
): Promise<{ ok: boolean; closed?: boolean; slots?: string[]; error?: string }> {
  const business = await loadBusinessForBooking(admin, opts.businessId);
  if (!business) return { ok: false, error: "business_not_found" };

  const meta = (business.meta || {}) as Record<string, unknown>;
  const hoursMap =
    meta.hours && typeof meta.hours === "object"
      ? (meta.hours as Record<string, DayHours>)
      : DEFAULT_HOURS;
  const d = new Date(`${opts.date}T12:00:00`);
  const dayKey = DAY_KEYS[isNaN(d.getTime()) ? new Date().getDay() : d.getDay()];
  const hours = hoursMap[dayKey] || DEFAULT_HOURS[dayKey];
  if (!hours || hours.closed) return { ok: true, closed: true, slots: [] };

  const open = timeToMin(hours.open || "08:00");
  const close = timeToMin(hours.close || "17:00");
  const duration = Math.max(30, opts.durationMinutes || 60);

  const { data: busyRows } = await admin.rpc("get_busy_windows", {
    p_business_id: opts.businessId,
    p_date: opts.date,
  });
  const busy = (Array.isArray(busyRows) ? busyRows : []).map((r: Record<string, unknown>) => {
    const start = timeToMin(String(r.scheduled_time || "").slice(0, 5));
    const end = start + Math.round(Number(r.duration_hours || 2) * 60);
    return { start, end };
  });

  const slots: string[] = [];
  for (let m = open; m + duration <= close; m += 60) {
    const conflict = busy.some((b) => m < b.end && m + duration > b.start);
    if (!conflict) slots.push(minToTime(m));
  }
  return { ok: true, closed: false, slots };
}

export type CreateWebsiteBookingInput = {
  businessId: string;
  serviceId?: string;
  serviceName?: string;
  date: string;
  time?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  notes?: string;
  amount?: number;
  /** Set only when the customer explicitly asked for this to repeat — see
   *  hubly_capability_registry.ts's create handler. Never invented here. */
  frequency?: string;
};

/** The Website Concierge's one job-creation execution. Mirrors
 *  createJob()/findOrCreateCustomer()'s real behavior — same `customers`/
 *  `jobs` tables, same column shapes, `from_booking:true` the same way a
 *  browser-side booking already sets it — then reuses the exact Google
 *  Calendar sync module google-calendar-push-job's own handler calls, so a
 *  Concierge booking gets identical Calendar behavior to any owner-created
 *  job. Customer matching is phone -> email -> name against the real
 *  `customers` table for this business (not the Leads pipeline the
 *  browser's findExistingCustomerMatch additionally checks, most of which
 *  lives in a JSON meta blob impractical to query server-side — not needed
 *  for "don't create a duplicate customer", which is the real requirement
 *  a second createJob() implementation would otherwise risk). */

// #188: the ONLY booking data that crosses into the browser — deliberately
// narrow. No internal ids, no membership object, no server implementation
// details. This is the single source of truth the confirmation card
// renders from; the AI never composes or reformats these facts.
export type WebsiteBookingConfirmation = {
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string | null;
  address: string | null;
  amount: number | null;
  customerName: string;
  // Non-null only when a real recurring_schedules row backs this booking
  // (new or reused) — never implies future job rows exist, only that the
  // schedule itself does.
  recurring: { frequency: string; nextOccurrenceDate: string | null } | null;
  // True only if the confirmation email genuinely sent via Resend — never
  // set true speculatively, and a false value never blocks or reflects on
  // the booking itself having succeeded.
  emailSent: boolean;
};

export async function createWebsiteBookingJob(
  admin: SupabaseClient,
  input: CreateWebsiteBookingInput,
): Promise<
  | {
    ok: true;
    jobId: string;
    job: Record<string, unknown>;
    customerId: string;
    recurringScheduleId: string | null;
    existingScheduleConflict: Record<string, unknown> | null;
    membership: CustomerMembership | null;
    confirmation: WebsiteBookingConfirmation;
  }
  | { ok: false; error: string }
> {
  const business = await loadBusinessForBooking(admin, input.businessId);
  if (!business) return { ok: false, error: "business_not_found" };

  let serviceName = String(input.serviceName || "").trim();
  // #187: this is the normal Service Engine/catalog price, unconditionally
  // — no membership-price branch here. The `memberships` table has no
  // structured field stating "this plan covers/discounts service X at
  // price Y" (service_name is a freeform label, not a safe coverage
  // signal — matching it against the booked service by name was
  // explicitly rejected as unreliable evidence). If/when an explicit,
  // owner-authored coverage rule exists, it belongs here; until then this
  // must not guess one from a name match.
  let amount = input.amount != null ? Number(input.amount) : null;
  let durationHours: number | null = null;
  // resolvedServiceId is only ever set when the lookup actually succeeds —
  // an input.serviceId that doesn't resolve (deleted/archived/wrong
  // business) never gets written to the job; service_name falls back to
  // whatever the caller already had, same "don't invent, don't crash"
  // rule as createJob()'s own resolution (public/hubly.html).
  let resolvedServiceId: string | null = null;
  if (input.serviceId) {
    getCatalog(business as Record<string, unknown>); // ensures catalog normalization before lookup
    const svc = getService(business as Record<string, unknown>, input.serviceId);
    if (svc) {
      resolvedServiceId = svc.id;
      serviceName = svc.name;
      if (amount == null && svc.pricing.price_cents != null) amount = svc.pricing.price_cents / 100;
      if (svc.duration_minutes) durationHours = svc.duration_minutes / 60;
    }
  }

  const phone = String(input.customerPhone || "").trim();
  const email = String(input.customerEmail || "").trim().toLowerCase();
  const name = String(input.customerName || "").trim();
  if (!name) return { ok: false, error: "customer_name_required" };

  // Match precedence mirrors findExistingCustomerMatch(): phone, then
  // email, then name — scoped to this business, real customers table only.
  // Extracted into the shared resolveOrCreateCrmCustomer() so the Marketplace
  // booking path uses the exact same one implementation (behavior-identical
  // to the previous inline block — same precedence, same insert shape).
  const digits = phone.replace(/\D/g, "").slice(-10);
  const { customer, error: custErr } = await resolveOrCreateCrmCustomer(admin, input.businessId, {
    name,
    phone,
    email,
    address: input.address,
  });
  if (custErr || !customer) return { ok: false, error: custErr || "customer_create_failed" };
  // Every branch above either returns early or assigns a real row —
  // customer is never null past this point (TS can't see that across the
  // reassignments above, hence the explicit assertion).
  const resolvedCustomer: Record<string, unknown> = customer!;

  // Lead reconciliation: a website visitor may already exist as an open
  // (pending/abandoned) booking_requests row from the old public wizard,
  // a quote, or an abandoned cart — same real table and same
  // phone->email->name precedence as the customer match just above, not a
  // second matching algorithm. Marks it accepted (mirrors exactly what
  // acceptBookingRequest/acceptAbandonedLead already do client-side) so it
  // stops appearing as an open lead once this Concierge booking has
  // superseded it. Best-effort: never blocks or fails the real booking.
  // Manual/CSV leads (businesses.meta.pipeline.manual, a JSON blob) are a
  // known, narrower gap this doesn't cover — reconciling those needs an
  // atomic server-side JSON patch mechanism that doesn't exist yet.
  try {
    let openRequest: Record<string, unknown> | null = null;
    if (digits.length >= 7) {
      const { data } = await admin
        .from("booking_requests")
        .select("id, customer_phone")
        .eq("business_id", input.businessId)
        .in("status", ["pending", "abandoned"]);
      openRequest =
        (data || []).find(
          (r: Record<string, unknown>) => String(r.customer_phone || "").replace(/\D/g, "").slice(-10) === digits,
        ) || null;
    }
    if (!openRequest && email) {
      const { data } = await admin
        .from("booking_requests")
        .select("id")
        .eq("business_id", input.businessId)
        .in("status", ["pending", "abandoned"])
        .ilike("customer_email", email)
        .maybeSingle();
      openRequest = data || null;
    }
    if (!openRequest && name) {
      const { data } = await admin
        .from("booking_requests")
        .select("id")
        .eq("business_id", input.businessId)
        .in("status", ["pending", "abandoned"])
        .ilike("customer_name", name)
        .maybeSingle();
      openRequest = data || null;
    }
    if (openRequest) {
      await admin.from("booking_requests").update({ status: "accepted" }).eq("id", openRequest.id as string);
    }
  } catch (_e) { /* no-op — reconciliation is best-effort, never blocks the real booking */ }

  // #187: real membership state, read from the structured `memberships`
  // table (never by parsing customers.notes here) — independent of
  // whether this particular booking is itself recurring. Membership and
  // Recurring Schedule relate only through resolvedCustomer.id, never a
  // foreign key between the two tables. This does NOT affect pricing
  // below — see the amount-resolution comment further down for why.
  let membership: CustomerMembership | null = null;
  try {
    membership = await getCustomerMembership(admin, input.businessId, String(resolvedCustomer.id));
  } catch (_e) { /* no-op — membership visibility is best-effort, never blocks the real booking */ }

  // Recurring: only when the customer explicitly asked for repetition (the
  // model is instructed to only set this when genuinely stated — see the
  // create action's description in hubly_capability_registry.ts). Creates
  // the schedule record and links this first occurrence to it — the
  // schedule owns cadence/next_occurrence_date/status going forward;
  // hubly-recurring-maintain (a scheduled worker, same pattern as
  // google-calendar-maintain) generates each future visit as one real job,
  // one at a time, as it actually becomes due — never a batch of future
  // jobs created up front.
  let recurringScheduleId: string | null = null;
  // Surfaced to the caller (never silently swallowed) when this customer
  // already has an active schedule for the same service — the AI/customer
  // gets told about it instead of a second, competing schedule getting
  // created underneath them. v1: just surfaces the fact; actually
  // attaching this visit to the existing schedule or replacing it is a
  // real decision, not something guessed here.
  let existingScheduleConflict: Record<string, unknown> | null = null;
  // #188: whichever schedule this booking actually ends up tied to (new or
  // reused) — its real frequency/next_occurrence_date, captured once here
  // so the customer-safe confirmation payload below never has to
  // re-derive or guess it. Null when no schedule is involved at all.
  let confirmedSchedule: { frequency: string; nextOccurrenceDate: string | null } | null = null;
  const frequency = String(input.frequency || "").trim().toLowerCase();
  if (VALID_FREQUENCIES.includes(frequency as RecurringFrequency)) {
    let existingQuery = admin
      .from("recurring_schedules")
      .select("id, frequency, service_name, next_occurrence_date")
      .eq("business_id", input.businessId)
      .eq("customer_id", resolvedCustomer.id)
      .eq("status", "active");
    existingQuery = resolvedServiceId
      ? existingQuery.eq("service_id", resolvedServiceId)
      : existingQuery.ilike("service_name", serviceName || "");
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      existingScheduleConflict = existing as Record<string, unknown>;
      confirmedSchedule = {
        frequency: String(existing.frequency || frequency),
        nextOccurrenceDate: existing.next_occurrence_date ? String(existing.next_occurrence_date) : null,
      };
    } else {
      // The FIRST occurrence is this job itself (created below, right
      // now) — next_occurrence_date must be the date AFTER it, or
      // hubly-recurring-maintain would immediately try to generate a
      // second job for the same date as occurrence #1.
      const newScheduleNextOccurrenceDate = computeNextOccurrenceDate(input.date, frequency, undefined);
      const { data: schedule, error: schedErr } = await admin
        .from("recurring_schedules")
        .insert({
          business_id: input.businessId,
          customer_id: resolvedCustomer.id,
          customer_name: (resolvedCustomer.name as string) || name,
          service_name: serviceName || null,
          service_id: resolvedServiceId,
          frequency,
          status: "active",
          start_date: input.date,
          next_occurrence_date: newScheduleNextOccurrenceDate,
          preferred_time: input.time || null,
          amount,
          address: input.address || null,
        })
        .select()
        .single();
      if (!schedErr && schedule) {
        recurringScheduleId = String(schedule.id);
        confirmedSchedule = { frequency, nextOccurrenceDate: newScheduleNextOccurrenceDate };
      }
    }
  }

  const payload = {
    business_id: input.businessId,
    // #189: previously omitted — every job this function created was
    // unreachable by customer_id, only by name/phone/email string match.
    // The Customer Portal (and anything else that needs to reliably find
    // "this customer's jobs") needs the real link. Historical jobs
    // created before this fix, and jobs from the separate owner-side
    // createJob() (public/hubly.html), still lack it — tracked
    // separately, not fixed here (see #200).
    customer_id: resolvedCustomer.id,
    customer_name: (resolvedCustomer.name as string) || name,
    service_name: serviceName,
    service_id: resolvedServiceId,
    scheduled_date: input.date || null,
    scheduled_time: input.time || null,
    address: input.address || null,
    amount,
    notes: input.notes || null,
    status: "scheduled",
    from_booking: true,
    phone: (resolvedCustomer.phone as string) || phone || null,
    email: (resolvedCustomer.email as string) || email || null,
    duration_hours: durationHours,
    recurring_schedule_id: recurringScheduleId,
  };
  const { data: job, error: jobErr } = await admin.from("jobs").insert(payload).select().single();
  if (jobErr || !job) return { ok: false, error: jobErr?.message || "job_create_failed" };

  // Best-effort, same as pushJobToGoogleCalendar()'s own try/catch — a
  // Calendar hiccup never blocks the booking itself from having succeeded.
  try {
    await syncEnginePushCreate(admin, { businessId: input.businessId, jobId: String(job.id) });
  } catch (_e) { /* no-op */ }

  // #188: the customer-safe confirmation payload the browser actually
  // renders — deliberately narrow (no internal ids, no membership object,
  // no server implementation details), built once here from the real job/
  // schedule rows, never left for the model to compose or reformat. See
  // hubly_capability_registry.ts for how this crosses into the AI
  // response, and hubly-conversation/index.ts for how it reaches the
  // browser.
  const confirmation: WebsiteBookingConfirmation = {
    serviceName,
    scheduledDate: String(job.scheduled_date || input.date),
    scheduledTime: job.scheduled_time ? String(job.scheduled_time) : null,
    address: job.address ? String(job.address) : null,
    amount: job.amount != null ? Number(job.amount) : null,
    customerName: (resolvedCustomer.name as string) || name,
    recurring: confirmedSchedule,
    emailSent: false,
  };

  // #189: a portal access link, only when there's a real email to send it
  // to — no email means no token, no link, no error. Best-effort and
  // fully isolated from the email send below: a failure here must never
  // prevent the confirmation email (or the booking) from succeeding.
  const customerEmail = (resolvedCustomer.email as string) || email || null;
  let portalUrl: string | null = null;
  if (customerEmail) {
    try {
      const bizSlug = (business as Record<string, unknown>).slug
        ? String((business as Record<string, unknown>).slug)
        : null;
      if (bizSlug) {
        const rawToken = await issuePortalAccessToken(admin, input.businessId, String(resolvedCustomer.id));
        if (rawToken) portalUrl = buildPortalUrl(bizSlug, rawToken);
      }
    } catch (_e) { /* no-op — portal link is best-effort, never blocks the booking or the email */ }
  }

  // Real, best-effort confirmation email via the existing Resend
  // infrastructure (booking_notifications.ts) — the same mechanism the
  // Marketplace booking engine already uses in production, not a second
  // email system. Website Concierge bookings are always instant/confirmed
  // (no accept/decline step), so status is always "confirmed" here.
  // Never blocks or fails the booking itself; confirmation.emailSent only
  // becomes true if the send genuinely succeeded, so the AI/card can never
  // claim an email went out that didn't.
  try {
    const emailResult = await notifyBookingCreated({
      status: "confirmed",
      customer_name: confirmation.customerName,
      customer_email: customerEmail,
      customer_phone: (resolvedCustomer.phone as string) || phone || null,
      service_name: serviceName,
      starts_at: `${confirmation.scheduledDate}T${confirmation.scheduledTime || "00:00"}`,
      address: confirmation.address,
      price_cents: confirmation.amount != null ? Math.round(confirmation.amount * 100) : null,
      portal_url: portalUrl,
      business: {
        name: (business as Record<string, unknown>).name ? String((business as Record<string, unknown>).name) : null,
        email: (business as Record<string, unknown>).email ? String((business as Record<string, unknown>).email) : null,
        phone: (business as Record<string, unknown>).phone ? String((business as Record<string, unknown>).phone) : null,
      },
    });
    confirmation.emailSent = !!emailResult.customer;
  } catch (_e) { /* no-op — email is best-effort, never blocks the real booking */ }

  return {
    ok: true,
    jobId: String(job.id),
    job: job as Record<string, unknown>,
    customerId: String(resolvedCustomer.id),
    recurringScheduleId,
    existingScheduleConflict,
    membership,
    confirmation,
  };
}
