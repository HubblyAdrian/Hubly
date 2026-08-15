/**
 * One-Off Session Engine — the ONLY authority that writes one_off_sessions /
 * one_off_session_bookings, and the only place session lifecycle, calendar
 * blocking, and seat reservation happen.
 *
 * Every genuinely shared behavior is imported, never re-implemented:
 *   * pure slot/deposit/validation math → one_off_session_core.mjs (also the
 *     file the Node tests exercise, so tests run the production logic)
 *   * customer identity            → resolveOrCreateCrmCustomer (crm_customer.ts)
 *   * Google Calendar              → syncEnginePushCreate / syncEnginePushDelete
 *   * confirmation email           → notifyBookingCreated (booking_notifications.ts)
 *   * Service Engine lookups       → getService (service_engine.ts)
 *   * businesses.meta parsing      → getBusinessMeta (hubly_business_meta.ts)
 *
 * The provider's calendar hold is one ordinary `jobs` row with
 * customer_name='Blocked' — the exact primitive the app's own "Block time"
 * button already creates. That is what makes §6 real rather than a UI hack:
 * get_busy_windows (website booking wizard) and jobBlocks() (marketplace
 * availability) both read `jobs`, so the 8am–2pm window disappears from normal
 * booking with no change to either availability path.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBusinessMeta } from "./hubly_business_meta.ts";
import { getService } from "./service_engine.ts";
import { resolveOrCreateCrmCustomer } from "./crm_customer.ts";
import { syncEnginePushCreate, syncEnginePushDelete } from "./google_calendar_sync_engine.ts";
import { notifyBookingCreated } from "./booking_notifications.ts";
import { buildPortalUrl, issuePortalAccessToken } from "./portal_access.ts";
import {
  assessSessionChange,
  BOOKABLE_STATUS,
  buildSessionBookingUrl,
  canTransitionSession,
  computeSessionAvailability,
  describeSessionPayment,
  generateSessionSlots,
  minutesToTime,
  nextFreeSeat,
  parseTimeToMinutes,
  resolveSessionPayment,
  sessionBookingBlockReason,
  sessionConfirmationCode,
  sessionHasPassed,
  sessionPromotionState,
  sessionTerminology,
  validateSessionDraft,
} from "./one_off_session_core.mjs";

type Admin = SupabaseClient;

export type SessionRow = Record<string, unknown>;
export type SessionBookingRow = Record<string, unknown>;

export type EngineResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const HUBLY_DOMAIN = (Deno.env.get("HUBLY_PUBLIC_DOMAIN") || "").trim() || "myhubly.app";

/** The block job's customer_name — the exact literal the app's own Block time
 *  button writes and the calendar reads back as isBlock. Never change this in
 *  isolation; it is a cross-file contract with public/hubly.html. */
const BLOCK_CUSTOMER_NAME = "Blocked";

/**
 * "Now" in the SESSION's own local wall time — the convention every Hubly
 * surface stores times in. Without this a link shared on the morning of the
 * session keeps selling 8:00 at 8:05, and a session nobody closed keeps taking
 * bookings for a date that has already gone.
 *
 * Falls back to UTC when the session has no timezone, and to UTC again if the
 * runtime rejects the zone — never throws, and never silently shifts a session
 * by a whole day.
 */
export function sessionLocalNow(session: SessionRow): { date: string; minutes: number } {
  const tz = session?.timezone ? String(session.timezone) : "UTC";
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now).reduce((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);
    const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: hour * 60 + Number(parts.minute),
    };
  } catch (_e) {
    return {
      date: now.toISOString().slice(0, 10),
      minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
    };
  }
}

/* ────────────────────────── token ────────────────────────── */

/** 256 bits of real randomness, base64url. Never derived from any id — see the
 *  migration's comment on booking_token for why that matters. */
function newBookingToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ────────────────────────── field normalization ────────────────────────── */

const WRITABLE_FIELDS = [
  "name",
  "description",
  "visibility",
  "service_id",
  "service_name",
  "session_date",
  "start_time",
  "end_time",
  "timezone",
  "appointment_duration_minutes",
  "buffer_minutes",
  "location_type",
  "location",
  "capacity_per_slot",
  "total_capacity",
  "price_cents",
  "currency",
  "payment_mode",
  "deposit_type",
  "deposit_cents",
  "deposit_percentage",
  "booking_questions",
] as const;

/** Dollars in, cents out — the AI and the owner UI both speak dollars; storage
 *  is always integer cents (§9). Accepts either and never guesses a unit. */
export function toCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function normalizeTime(value: unknown): string | null {
  const mins = parseTimeToMinutes(value);
  return mins == null ? null : `${minutesToTime(mins)}:00`;
}

/**
 * Turn a loose patch (from the owner UI, the API, or an AI action) into a
 * strictly-typed column patch. Unknown keys are dropped, never passed through —
 * an AI can't set `status`, `booking_token`, `business_id`, or anything else
 * structural by naming it in args.
 */
export function normalizeSessionPatch(input: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) {
    if (!(key in input)) continue;
    const raw = input[key];
    switch (key) {
      case "start_time":
      case "end_time": {
        const t = normalizeTime(raw);
        if (t) patch[key] = t;
        break;
      }
      case "session_date": {
        const d = String(raw || "").trim().slice(0, 10);
        if (d) patch[key] = d;
        break;
      }
      case "appointment_duration_minutes":
      case "buffer_minutes":
      case "capacity_per_slot":
      case "total_capacity":
      case "price_cents":
      case "deposit_cents": {
        if (raw == null || raw === "") {
          patch[key] = null;
        } else {
          const n = Number(raw);
          if (Number.isFinite(n)) patch[key] = Math.round(n);
        }
        break;
      }
      case "deposit_percentage": {
        if (raw == null || raw === "") patch[key] = null;
        else {
          const n = Number(raw);
          if (Number.isFinite(n)) patch[key] = n;
        }
        break;
      }
      case "booking_questions": {
        patch[key] = Array.isArray(raw) ? raw.slice(0, 20) : [];
        break;
      }
      case "currency": {
        patch[key] = String(raw || "usd").toLowerCase().slice(0, 3);
        break;
      }
      default: {
        patch[key] = raw == null ? null : String(raw);
      }
    }
  }
  return patch;
}

/** The shape validateSessionDraft() expects — current row merged with a patch. */
function draftFor(session: SessionRow | null, patch: Record<string, unknown>) {
  const merged = { ...(session || {}), ...patch } as Record<string, unknown>;
  return {
    name: merged.name,
    session_date: merged.session_date,
    start_time: merged.start_time,
    end_time: merged.end_time,
    appointment_duration_minutes: merged.appointment_duration_minutes ?? 30,
    buffer_minutes: merged.buffer_minutes ?? 0,
    capacity_per_slot: merged.capacity_per_slot ?? 1,
    total_capacity: merged.total_capacity ?? null,
    price_cents: merged.price_cents ?? null,
    payment_mode: merged.payment_mode ?? "none",
    deposit_type: merged.deposit_type ?? null,
    deposit_cents: merged.deposit_cents ?? null,
    deposit_percentage: merged.deposit_percentage ?? null,
    visibility: merged.visibility ?? "link_only",
    location_type: merged.location_type ?? "in_person",
    status: merged.status ?? "draft",
  };
}

/* ────────────────────────── reads ────────────────────────── */

export async function getSessionById(
  admin: Admin,
  businessId: string,
  sessionId: string,
): Promise<SessionRow | null> {
  const { data } = await admin
    .from("one_off_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("business_id", businessId)
    .maybeSingle();
  return (data as SessionRow) || null;
}

/** Token → session. The only public entry point; there is no id-based public read. */
export async function getSessionByToken(admin: Admin, token: string): Promise<SessionRow | null> {
  const clean = String(token || "").trim();
  if (!clean) return null;
  const { data } = await admin
    .from("one_off_sessions")
    .select("*")
    .eq("booking_token", clean)
    .maybeSingle();
  return (data as SessionRow) || null;
}

export async function listSessions(
  admin: Admin,
  businessId: string,
  opts?: { statuses?: string[] },
): Promise<SessionRow[]> {
  let q = admin
    .from("one_off_sessions")
    .select("*")
    .eq("business_id", businessId)
    .order("session_date", { ascending: true });
  if (opts?.statuses?.length) q = q.in("status", opts.statuses);
  const { data } = await q;
  return (data as SessionRow[]) || [];
}

async function loadSessionBookings(admin: Admin, sessionId: string): Promise<SessionBookingRow[]> {
  const { data } = await admin
    .from("one_off_session_bookings")
    .select("*")
    .eq("session_id", sessionId)
    .order("slot_time", { ascending: true });
  return (data as SessionBookingRow[]) || [];
}

/**
 * Real conflicting holds on the provider's calendar for the session's date.
 *
 * Reads the same `jobs` table every other availability path reads — no second
 * calendar. Two things are deliberately excluded:
 *   * jobs belonging to THIS session (its parent block and its own bookings'
 *     appointments) — the block is what makes these slots exist; treating it as
 *     a conflict would make the session unbookable by its own design, and each
 *     booking's own job is already accounted for by the seat count.
 *   * cancelled jobs, same as jobBlocks() in marketplace_availability.ts.
 */
async function loadSessionDayConflicts(
  admin: Admin,
  session: SessionRow,
): Promise<Array<{ start_minutes: number; end_minutes: number }>> {
  const { data } = await admin
    .from("jobs")
    .select("scheduled_time,duration_hours,status,one_off_session_id")
    .eq("business_id", String(session.business_id))
    .eq("scheduled_date", String(session.session_date).slice(0, 10));
  const out: Array<{ start_minutes: number; end_minutes: number }> = [];
  for (const j of data || []) {
    if (String(j.one_off_session_id || "") === String(session.id)) continue;
    const status = String(j.status || "");
    if (status === "cancelled" || status === "canceled") continue;
    const start = parseTimeToMinutes(j.scheduled_time);
    if (start == null) continue;
    const hours = Number(j.duration_hours);
    const durMin = Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 120;
    out.push({ start_minutes: start, end_minutes: start + durMin });
  }
  return out;
}

/** Live availability for one session — the derived grid folded over real
 *  bookings AND real calendar conflicts. */
export async function getSessionAvailability(
  admin: Admin,
  session: SessionRow,
  opts?: { forCustomer?: boolean },
) {
  const [bookings, busyWindows] = await Promise.all([
    loadSessionBookings(admin, String(session.id)),
    loadSessionDayConflicts(admin, session),
  ]);
  return computeSessionAvailability(session, bookings, {
    ...(opts || {}),
    busyWindows,
    now: sessionLocalNow(session),
  });
}

/* ────────────────────────── create / update ────────────────────────── */

export async function createSession(
  admin: Admin,
  businessId: string,
  input: Record<string, unknown>,
): Promise<EngineResult<SessionRow>> {
  const patch = normalizeSessionPatch(input);
  // A session may reference a real Service; when it does, inherit the name (and
  // price/duration only when the caller didn't state one) from the Service
  // Engine rather than letting a second copy of that data drift.
  if (patch.service_id) {
    const { data: biz } = await admin.from("businesses").select("id,meta").eq("id", businessId).maybeSingle();
    const svc = biz ? getService(biz as Record<string, unknown>, String(patch.service_id)) : null;
    if (svc) {
      if (!patch.service_name) patch.service_name = svc.name;
      if (patch.price_cents == null && svc.pricing?.price_cents != null) {
        patch.price_cents = svc.pricing.price_cents;
      }
      if (patch.appointment_duration_minutes == null && svc.duration_minutes) {
        patch.appointment_duration_minutes = svc.duration_minutes;
      }
    } else {
      // A service_id that doesn't resolve is dropped rather than stored —
      // same "don't invent, don't crash" rule createWebsiteBookingJob uses.
      delete patch.service_id;
    }
  }

  const errors = validateSessionDraft(draftFor(null, patch));
  if (errors.length) return { ok: false, error: errors.join(" "), code: "invalid" };

  const row = {
    ...patch,
    business_id: businessId,
    status: "draft",
    booking_token: newBookingToken(),
  };
  const { data, error } = await admin.from("one_off_sessions").insert(row).select("*").single();
  if (error) return { ok: false, error: error.message, code: "insert_failed" };
  return { ok: true, data: data as SessionRow };
}

export type UpdateSessionOutput = { session: SessionRow; warnings: string[] };

export async function updateSession(
  admin: Admin,
  businessId: string,
  sessionId: string,
  input: Record<string, unknown>,
): Promise<EngineResult<UpdateSessionOutput>> {
  const session = await getSessionById(admin, businessId, sessionId);
  if (!session) return { ok: false, error: "Session not found.", code: "not_found" };
  if (session.status === "cancelled") {
    return { ok: false, error: "A cancelled session can't be edited.", code: "cancelled" };
  }

  const patch = normalizeSessionPatch(input);
  if (!Object.keys(patch).length) return { ok: true, data: { session, warnings: [] } };

  const errors = validateSessionDraft(draftFor(session, patch));
  if (errors.length) return { ok: false, error: errors.join(" "), code: "invalid" };

  // §18 — a change that would break a real appointment is refused outright, and
  // anything the owner genuinely needs to know about (repricing is never
  // retroactive; a moved location doesn't notify anyone) comes back as a warning
  // the caller must surface. All of it lives in the shared core so the API, the
  // provider UI and the AI cannot disagree about what is safe.
  const bookings = await loadSessionBookings(admin, sessionId);
  const impact = assessSessionChange(session, patch, bookings);
  if (impact.blocked.length) {
    return { ok: false, error: impact.blocked.join(" "), code: "unsafe_change" };
  }

  const { data, error } = await admin
    .from("one_off_sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message, code: "update_failed" };

  const updated = data as SessionRow;
  // The calendar hold is derived from the window — if the window moved while
  // the session is live, the block must move with it, or normal booking would
  // be wrong in both directions.
  const windowChanged = patch.session_date != null || patch.start_time != null || patch.end_time != null ||
    patch.name != null || patch.location != null;
  if (windowChanged && updated.calendar_block_job_id) {
    await syncCalendarBlock(admin, updated);
  }
  // Widening the window (or shortening appointments) can open real seats on a
  // session that had gone sold_out — reconcile so it becomes bookable again
  // instead of staying stuck.
  const reconciled = await reconcileSoldOut(admin, updated);
  return { ok: true, data: { session: reconciled, warnings: impact.warnings } };
}

/* ────────────────────────── calendar block ────────────────────────── */

function blockDurationHours(session: SessionRow): number {
  const start = parseTimeToMinutes(session.start_time);
  const end = parseTimeToMinutes(session.end_time);
  if (start == null || end == null || end <= start) return 1;
  return Math.round(((end - start) / 60) * 100) / 100;
}

/**
 * Create (or move) the provider's calendar hold for a published session.
 *
 * One ordinary jobs row, customer_name='Blocked' — identical in shape to what
 * submitBlockTime() writes in public/hubly.html, plus one_off_session_id so
 * the session can find its own block again (and so session slot availability
 * can ignore it — the block is the parent of these appointments, not a
 * conflict with them).
 *
 * Google Calendar gets exactly one event for the whole window, pushed through
 * the existing sync engine so etag/loop/idempotency handling is shared. When
 * Google isn't connected the sync engine returns not_connected and the session
 * still works — nothing here treats that as a failure.
 */
export async function syncCalendarBlock(admin: Admin, session: SessionRow): Promise<string | null> {
  const businessId = String(session.business_id);
  const label = `${String(session.name || "One-Off Session")}${session.location ? ` — ${session.location}` : ""}`;
  const payload = {
    business_id: businessId,
    customer_name: BLOCK_CUSTOMER_NAME,
    service_name: label,
    scheduled_date: String(session.session_date).slice(0, 10),
    scheduled_time: String(session.start_time).slice(0, 5),
    duration_hours: blockDurationHours(session),
    status: "scheduled",
    from_booking: false,
    notes: "Hubly One-Off Session — this window is held for session bookings.",
    one_off_session_id: String(session.id),
  };

  const existingId = session.calendar_block_job_id ? String(session.calendar_block_job_id) : null;
  if (existingId) {
    const { error } = await admin.from("jobs").update(payload).eq("id", existingId).eq("business_id", businessId);
    if (!error) {
      // Push the moved window to Google through the same engine the owner's own
      // job edits use. Best-effort: a Calendar hiccup never invalidates the hold.
      try {
        const g = await syncEnginePushCreate(admin, { businessId, jobId: existingId });
        if (g?.google_event_id && g.google_event_id !== session.google_event_id) {
          await admin.from("one_off_sessions").update({ google_event_id: g.google_event_id })
            .eq("id", session.id);
        }
      } catch (_e) { /* no-op — Google Calendar is best-effort by design (§8) */ }
      return existingId;
    }
    // Fall through and create a fresh one if the old row is gone.
  }

  const { data, error } = await admin.from("jobs").insert(payload).select("id").single();
  if (error || !data?.id) {
    console.warn("one_off_session block job", error?.message);
    return null;
  }
  const jobId = String(data.id);
  let googleEventId: string | null = null;
  try {
    const g = await syncEnginePushCreate(admin, { businessId, jobId });
    googleEventId = g?.google_event_id ? String(g.google_event_id) : null;
  } catch (_e) { /* no-op — see §8: no Google connection means Hubly still works */ }

  await admin.from("one_off_sessions").update({
    calendar_block_job_id: jobId,
    google_event_id: googleEventId,
  }).eq("id", session.id);

  return jobId;
}

/** Release the hold — the window returns to normal booking immediately. */
async function releaseCalendarBlock(admin: Admin, session: SessionRow): Promise<void> {
  const jobId = session.calendar_block_job_id ? String(session.calendar_block_job_id) : null;
  if (!jobId) return;
  const businessId = String(session.business_id);
  try {
    await syncEnginePushDelete(admin, {
      businessId,
      jobId,
      googleEventId: session.google_event_id ? String(session.google_event_id) : null,
    });
  } catch (_e) { /* no-op — Google cleanup is best-effort */ }
  await admin.from("jobs").delete().eq("id", jobId).eq("business_id", businessId);
  await admin.from("one_off_sessions").update({
    calendar_block_job_id: null,
    google_event_id: null,
  }).eq("id", session.id);
}

/* ────────────────────────── lifecycle ────────────────────────── */

export async function publishSession(
  admin: Admin,
  businessId: string,
  sessionId: string,
): Promise<EngineResult<SessionRow>> {
  const session = await getSessionById(admin, businessId, sessionId);
  if (!session) return { ok: false, error: "Session not found.", code: "not_found" };
  if (session.status === "published") return { ok: true, data: session };
  if (!canTransitionSession(String(session.status), "published")) {
    return { ok: false, error: `A ${session.status} session can't be published.`, code: "bad_transition" };
  }
  const errors = validateSessionDraft(draftFor(session, {}));
  if (errors.length) return { ok: false, error: errors.join(" "), code: "invalid" };

  const { data, error } = await admin
    .from("one_off_sessions")
    .update({ status: "published", published_at: new Date().toISOString(), closed_at: null })
    .eq("id", sessionId)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message, code: "update_failed" };

  const published = data as SessionRow;
  await syncCalendarBlock(admin, published);
  return { ok: true, data: (await getSessionById(admin, businessId, sessionId)) || published };
}

export async function closeSession(
  admin: Admin,
  businessId: string,
  sessionId: string,
): Promise<EngineResult<SessionRow>> {
  const session = await getSessionById(admin, businessId, sessionId);
  if (!session) return { ok: false, error: "Session not found.", code: "not_found" };
  if (session.status === "closed") return { ok: true, data: session };
  if (!canTransitionSession(String(session.status), "closed")) {
    return { ok: false, error: `A ${session.status} session can't be closed.`, code: "bad_transition" };
  }
  const { data, error } = await admin
    .from("one_off_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message, code: "update_failed" };

  // Closing stops NEW bookings. Existing confirmed bookings are real
  // appointments and keep their jobs — but the remaining unsold window is
  // handed back, so the provider isn't holding time nobody bought.
  await releaseCalendarBlock(admin, session);
  return { ok: true, data: data as SessionRow };
}

export async function cancelSession(
  admin: Admin,
  businessId: string,
  sessionId: string,
): Promise<EngineResult<{ session: SessionRow; cancelled_bookings: number }>> {
  const session = await getSessionById(admin, businessId, sessionId);
  if (!session) return { ok: false, error: "Session not found.", code: "not_found" };
  if (session.status === "cancelled") {
    return { ok: true, data: { session, cancelled_bookings: 0 } };
  }
  if (!canTransitionSession(String(session.status), "cancelled")) {
    return { ok: false, error: `A ${session.status} session can't be cancelled.`, code: "bad_transition" };
  }

  const bookings = (await loadSessionBookings(admin, sessionId)).filter(
    (b) => String(b.status) !== "cancelled",
  );
  const now = new Date().toISOString();
  for (const b of bookings) {
    await admin.from("one_off_session_bookings")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", b.id);
    if (b.job_id) {
      // The customer's appointment is cancelled, not deleted — history stays.
      await admin.from("jobs").update({ status: "cancelled" }).eq("id", b.job_id);
      try {
        await syncEnginePushDelete(admin, { businessId, jobId: String(b.job_id) });
      } catch (_e) { /* no-op */ }
    }
  }

  await releaseCalendarBlock(admin, session);
  const { data, error } = await admin
    .from("one_off_sessions")
    .update({ status: "cancelled", closed_at: now })
    .eq("id", sessionId)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message, code: "update_failed" };
  // Refunds are deliberately NOT issued here: Hubly has no refund pipeline for
  // booking payments today (stripe-webhook only marks commerce refunds), and
  // silently implying money moved would be worse than saying nothing.
  return { ok: true, data: { session: data as SessionRow, cancelled_bookings: bookings.length } };
}

/** Flip published <-> sold_out to match reality. Called after every booking. */
async function reconcileSoldOut(admin: Admin, session: SessionRow): Promise<SessionRow> {
  const status = String(session.status);
  if (status !== "published" && status !== "sold_out") return session;
  const availability = await getSessionAvailability(admin, session);
  const shouldBeSoldOut = availability.sold_out;
  if (shouldBeSoldOut && status === "published") {
    const { data } = await admin.from("one_off_sessions").update({ status: "sold_out" })
      .eq("id", session.id).select("*").single();
    return (data as SessionRow) || session;
  }
  if (!shouldBeSoldOut && status === "sold_out") {
    const { data } = await admin.from("one_off_sessions").update({ status: "published" })
      .eq("id", session.id).select("*").single();
    return (data as SessionRow) || session;
  }
  return session;
}

/* ────────────────────────── booking ────────────────────────── */

export type BookSessionInput = {
  slot_time: string;
  customer: { name: string; email?: string | null; phone?: string | null };
  answers?: Record<string, unknown>;
};

export type BookSessionOutput = {
  booking: SessionBookingRow;
  payment: ReturnType<typeof resolveSessionPayment>;
  requires_payment: boolean;
  confirmation: {
    session_name: string;
    date: string;
    time_label: string;
    location: string | null;
    confirmation_code: string;
    paid_today_cents: number;
    balance_due_cents: number;
    payment_line: string;
    business: { name: string | null; phone: string | null; email: string | null };
    email_sent: boolean;
  };
};

/**
 * Reserve one seat. This is the concurrency-critical path (§5).
 *
 * Seat assignment is optimistic against the partial unique index
 * (session_id, slot_time, seat_no) WHERE status <> 'cancelled': we read the
 * seats currently taken, try the lowest free one, and let Postgres reject a
 * loser in a race (23505). On rejection we re-read and try again. Two customers
 * clicking the same 8:20 slot at the same instant therefore cannot both succeed
 * on a capacity-1 slot — one of them is honestly told to pick another time.
 *
 * The booking starts as pending_payment when money is due, and is only ever
 * promoted to confirmed by the Stripe webhook (§9) — never by a success screen.
 */
export async function bookSessionSlot(
  admin: Admin,
  session: SessionRow,
  input: BookSessionInput,
): Promise<EngineResult<BookSessionOutput>> {
  const nowLocal = sessionLocalNow(session);
  const blockReason = sessionBookingBlockReason(session, nowLocal);
  if (blockReason) return { ok: false, error: blockReason, code: "not_bookable" };

  const customerName = String(input.customer?.name || "").trim();
  if (!customerName) return { ok: false, error: "A name is required to book.", code: "missing_name" };

  const wantedMinutes = parseTimeToMinutes(input.slot_time);
  if (wantedMinutes == null) {
    return { ok: false, error: "Pick a real time.", code: "invalid_slot" };
  }
  const slotTime = minutesToTime(wantedMinutes);
  const grid = generateSessionSlots(session);
  const slot = grid.find((s) => s.time === slotTime);
  if (!slot) {
    return { ok: false, error: "That time isn't part of this session.", code: "slot_not_in_session" };
  }

  const sessionId = String(session.id);
  const businessId = String(session.business_id);
  const capacity = Math.max(1, Math.round(Number(session.capacity_per_slot) || 1));
  const payment = resolveSessionPayment(session);

  // Whole-session cap, real calendar conflicts and past slots, all checked
  // before a seat is consumed. This is the authoritative check — the customer's
  // slot grid was a snapshot, and something may genuinely have landed on the
  // provider's calendar since it was drawn.
  const availability = await getSessionAvailability(admin, session);
  if (availability.remaining <= 0) {
    return { ok: false, error: "This session is fully booked.", code: "sold_out" };
  }
  const liveSlot = availability.slots.find((s) => s.time === slotTime);
  if (liveSlot?.conflicted) {
    return {
      ok: false,
      error: "That time just became unavailable on the calendar — pick another.",
      code: "calendar_conflict",
    };
  }
  if (liveSlot?.past) {
    return { ok: false, error: "That time has already passed — pick a later one.", code: "slot_past" };
  }

  // A double-submit (or an impatient second tap) must not consume two seats for
  // the same person at the same time. Scoped to email + this exact slot, so a
  // parent legitimately booking two children at different times is unaffected.
  const bookerEmail = String(input.customer?.email || "").trim().toLowerCase();
  if (bookerEmail) {
    const { data: dupe } = await admin
      .from("one_off_session_bookings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("slot_time", `${slotTime}:00`)
      .neq("status", "cancelled")
      .ilike("customer_email", bookerEmail)
      .maybeSingle();
    if (dupe?.id) {
      return {
        ok: false,
        error: "You already have this time booked — check your email for the confirmation.",
        code: "duplicate_booking",
      };
    }
  }

  // Overlap-aware: a longer booking made before the owner shortened
  // appointments still occupies this slot even though no booking shares its
  // exact start time.
  if (liveSlot && liveSlot.seats_open <= 0) {
    return { ok: false, error: "That time was just taken — pick another.", code: "slot_taken" };
  }

  const answers = input.answers && typeof input.answers === "object" ? input.answers : {};
  const code = sessionConfirmationCode();
  // Requiring payment is only real if the business can genuinely take a card
  // today. Without this check a business with no (or an unfinished) Stripe
  // Connect account would create bookings stuck in pending_payment that no
  // checkout could ever be opened for — the seat consumed and the customer
  // stranded. When Stripe isn't ready the booking is confirmed immediately and
  // the balance is simply owed at the session, which is exactly what the public
  // page already tells the customer.
  const stripeReady = payment.requires_checkout ? await businessCanCharge(admin, businessId) : false;
  const requiresPayment = payment.requires_checkout && stripeReady;

  let booking: SessionBookingRow | null = null;
  for (let attempt = 0; attempt < capacity + 2 && !booking; attempt++) {
    const { data: taken } = await admin
      .from("one_off_session_bookings")
      .select("seat_no")
      .eq("session_id", sessionId)
      .eq("slot_time", `${slotTime}:00`)
      .neq("status", "cancelled");
    const seat = nextFreeSeat((taken || []).map((r: Record<string, unknown>) => Number(r.seat_no)), capacity);
    if (seat == null) {
      return { ok: false, error: "That time was just taken — pick another.", code: "slot_taken" };
    }

    const { data, error } = await admin
      .from("one_off_session_bookings")
      .insert({
        session_id: sessionId,
        business_id: businessId,
        slot_date: String(session.session_date).slice(0, 10),
        slot_time: `${slotTime}:00`,
        duration_minutes: Number(session.appointment_duration_minutes) || 30,
        seat_no: seat,
        customer_name: customerName,
        customer_email: input.customer?.email?.trim() || null,
        customer_phone: input.customer?.phone?.trim() || null,
        answers,
        status: requiresPayment ? "pending_payment" : "confirmed",
        payment_status: requiresPayment ? "pending" : "none",
        price_cents: payment.price_cents || null,
        deposit_cents: payment.deposit_cents,
        currency: payment.currency,
        confirmation_code: code,
        confirmed_at: requiresPayment ? null : new Date().toISOString(),
      })
      .select("*")
      .single();

    if (!error && data) {
      booking = data as SessionBookingRow;
      break;
    }
    // 23505 = the unique index did its job; somebody else won this seat.
    const isRace = String((error as { code?: string } | null)?.code || "") === "23505";
    if (!isRace) {
      return { ok: false, error: error?.message || "Could not reserve that time.", code: "insert_failed" };
    }
  }

  if (!booking) {
    return { ok: false, error: "That time was just taken — pick another.", code: "slot_taken" };
  }

  // A booking that needs no payment is real immediately: resolve the customer,
  // create the real job, sync the calendar, send the confirmation.
  let confirmation: BookSessionOutput["confirmation"];
  if (!requiresPayment) {
    confirmation = await materializeConfirmedBooking(admin, session, booking);
  } else {
    confirmation = await buildConfirmationPayload(admin, session, booking, false);
  }

  await reconcileSoldOut(admin, session);

  return {
    ok: true,
    data: {
      booking,
      payment,
      requires_payment: requiresPayment,
      confirmation,
    },
  };
}

/**
 * The "this booking is real now" step: canonical CRM customer, a real `jobs`
 * row (so it appears on the owner's calendar, in Reports, and in Google
 * Calendar exactly like any other appointment), and the confirmation email
 * through the existing Resend infrastructure.
 *
 * Idempotent: called once from the no-payment path and once from the Stripe
 * webhook, and a booking that already has a job_id is never given a second one.
 */
export async function materializeConfirmedBooking(
  admin: Admin,
  session: SessionRow,
  booking: SessionBookingRow,
): Promise<BookSessionOutput["confirmation"]> {
  const businessId = String(session.business_id);

  if (!booking.job_id) {
    let customerId: string | null = booking.customer_id ? String(booking.customer_id) : null;
    if (!customerId) {
      try {
        const { customer } = await resolveOrCreateCrmCustomer(admin, businessId, {
          name: String(booking.customer_name || ""),
          phone: booking.customer_phone ? String(booking.customer_phone) : null,
          email: booking.customer_email ? String(booking.customer_email) : null,
          address: session.location ? String(session.location) : null,
        });
        if (customer?.id) customerId = String(customer.id);
      } catch (e) {
        console.warn("one_off_session resolve customer", e);
      }
    }

    const { data: job } = await admin.from("jobs").insert({
      business_id: businessId,
      customer_id: customerId,
      customer_name: booking.customer_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
      service_name: String(session.name || "Session"),
      service_id: session.service_id || null,
      scheduled_date: String(booking.slot_date).slice(0, 10),
      scheduled_time: String(booking.slot_time).slice(0, 5),
      duration_hours: (Number(booking.duration_minutes) || 30) / 60,
      address: session.location || null,
      amount: booking.price_cents != null ? Number(booking.price_cents) / 100 : null,
      notes: `One-Off Session: ${session.name}`,
      status: "scheduled",
      from_booking: true,
      one_off_session_id: String(session.id),
      deposit_cents: booking.deposit_cents ?? null,
      deposit_status: booking.payment_status === "paid"
        ? "paid_online"
        : (booking.deposit_cents ? "due" : "none"),
    }).select("id").single();

    if (job?.id) {
      await admin.from("one_off_session_bookings").update({
        job_id: job.id,
        customer_id: customerId,
      }).eq("id", booking.id);
      booking.job_id = job.id;
      booking.customer_id = customerId;
      // Same Google Calendar module every other Hubly booking uses — one event
      // per appointment, on top of the session's single block event.
      try {
        await syncEnginePushCreate(admin, { businessId, jobId: String(job.id) });
      } catch (_e) { /* no-op — Calendar is best-effort, never blocks a booking */ }
    }
  }

  return buildConfirmationPayload(admin, session, booking, true);
}

async function buildConfirmationPayload(
  admin: Admin,
  session: SessionRow,
  booking: SessionBookingRow,
  sendEmail: boolean,
): Promise<BookSessionOutput["confirmation"]> {
  const businessId = String(session.business_id);
  const { data: biz } = await admin
    .from("businesses")
    .select("id,name,email,phone,slug")
    .eq("id", businessId)
    .maybeSingle();

  const payment = resolveSessionPayment(session);
  const paidToday = Number(booking.amount_paid_cents) || 0;
  const balance = Math.max(0, (Number(booking.price_cents) || 0) - paidToday);
  const timeLabel = (() => {
    const mins = parseTimeToMinutes(String(booking.slot_time));
    return mins == null ? String(booking.slot_time) : minutesToTime(mins);
  })();

  const confirmation: BookSessionOutput["confirmation"] = {
    session_name: String(session.name || "Session"),
    date: String(booking.slot_date).slice(0, 10),
    time_label: timeLabel,
    location: session.location ? String(session.location) : null,
    confirmation_code: String(booking.confirmation_code || ""),
    paid_today_cents: paidToday,
    balance_due_cents: balance,
    payment_line: describeSessionPayment({ ...payment, charge_now_cents: paidToday, balance_due_cents: balance }),
    business: {
      name: biz?.name ? String(biz.name) : null,
      phone: biz?.phone ? String(biz.phone) : null,
      email: biz?.email ? String(biz.email) : null,
    },
    email_sent: false,
  };

  if (!sendEmail) return confirmation;

  // Portal link + confirmation email through the same infrastructure the
  // Website Concierge and Marketplace bookings already use (§11). Both are
  // best-effort and email_sent is only ever true when Resend genuinely
  // accepted the send — the page never claims an email that didn't go out.
  let portalUrl: string | null = null;
  if (booking.customer_email && booking.customer_id && biz?.slug) {
    try {
      const raw = await issuePortalAccessToken(admin, businessId, String(booking.customer_id));
      if (raw) portalUrl = buildPortalUrl(String(biz.slug), raw);
    } catch (_e) { /* no-op */ }
  }
  try {
    const result = await notifyBookingCreated({
      status: "confirmed",
      confirmation_code: confirmation.confirmation_code,
      customer_name: String(booking.customer_name || ""),
      customer_email: booking.customer_email ? String(booking.customer_email) : null,
      customer_phone: booking.customer_phone ? String(booking.customer_phone) : null,
      service_name: confirmation.session_name,
      starts_at: `${confirmation.date}T${confirmation.time_label}`,
      address: confirmation.location,
      price_cents: booking.price_cents != null ? Number(booking.price_cents) : null,
      what_happens_next: confirmation.payment_line,
      portal_url: portalUrl,
      business: confirmation.business,
    });
    confirmation.email_sent = !!result.customer;
  } catch (_e) { /* no-op — email never blocks a real booking */ }

  return confirmation;
}

/**
 * The customer-safe confirmation for an already-confirmed booking (the polling
 * path after a Stripe redirect). Read-only: it never sends an email and never
 * materializes anything — the webhook already did both.
 */
export async function publicBookingConfirmation(
  admin: Admin,
  session: SessionRow,
  booking: SessionBookingRow,
): Promise<BookSessionOutput["confirmation"]> {
  return buildConfirmationPayload(admin, session, booking, false);
}

/**
 * Stripe webhook entry point (§9). The ONLY path that marks a session booking
 * paid, and idempotent by design: an already-paid booking short-circuits, so a
 * duplicate/replayed webhook can never double-materialize a job.
 */
export async function finalizeSessionBookingPayment(
  admin: Admin,
  opts: {
    bookingId: string;
    amountPaidCents: number;
    paymentIntentId?: string | null;
    checkoutSessionId?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { data: booking } = await admin
    .from("one_off_session_bookings")
    .select("*")
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "session_booking_not_found" };
  if (booking.payment_status === "paid" && booking.job_id) return { ok: true };
  if (String(booking.status) === "cancelled") {
    // The seat was released (abandoned checkout / cancelled session) and the
    // money still arrived. Never silently discard that: record the payment
    // exactly as it happened and leave the booking cancelled, so the owner can
    // see a real payment that needs refunding rather than a missing one. This
    // is the §19 rule — payment records stay accurate even with no refund
    // pipeline. Returns ok so Stripe stops retrying a webhook we handled.
    await admin.from("one_off_session_bookings").update({
      payment_status: "paid",
      amount_paid_cents: Math.max(0, Math.round(opts.amountPaidCents || 0)),
      stripe_payment_intent_id: opts.paymentIntentId || booking.stripe_payment_intent_id || null,
      stripe_checkout_session_id: opts.checkoutSessionId || booking.stripe_checkout_session_id || null,
      paid_at: new Date().toISOString(),
    }).eq("id", opts.bookingId);
    console.error(
      "one_off_session payment received for a cancelled booking — needs manual refund",
      { bookingId: opts.bookingId, paymentIntentId: opts.paymentIntentId },
    );
    return { ok: true };
  }

  const { data: updated, error } = await admin
    .from("one_off_session_bookings")
    .update({
      status: "confirmed",
      payment_status: "paid",
      amount_paid_cents: Math.max(0, Math.round(opts.amountPaidCents || 0)),
      stripe_payment_intent_id: opts.paymentIntentId || booking.stripe_payment_intent_id || null,
      stripe_checkout_session_id: opts.checkoutSessionId || booking.stripe_checkout_session_id || null,
      paid_at: new Date().toISOString(),
      confirmed_at: booking.confirmed_at || new Date().toISOString(),
    })
    .eq("id", opts.bookingId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  const { data: session } = await admin
    .from("one_off_sessions")
    .select("*")
    .eq("id", booking.session_id)
    .maybeSingle();
  if (!session) return { ok: false, error: "session_not_found" };

  await materializeConfirmedBooking(admin, session as SessionRow, updated as SessionBookingRow);
  await reconcileSoldOut(admin, session as SessionRow);
  return { ok: true };
}

/**
 * Cancel ONE booking inside a session (owner action).
 *
 * The seat goes back on sale, the customer's appointment is marked cancelled
 * rather than deleted (history is never destroyed), and the session flips back
 * out of sold_out if that seat was the reason it was full.
 *
 * Deliberately does NOT refund. Hubly has no refund pipeline for booking
 * payments — see docs/operate/ONE_OFF_SESSIONS.md. The payment record is left
 * exactly as it is and `refund_due_cents` reports what a human still owes the
 * customer, so nothing anywhere can imply money moved when it didn't.
 */
export async function cancelSessionBooking(
  admin: Admin,
  businessId: string,
  bookingId: string,
): Promise<EngineResult<{ booking: SessionBookingRow; refund_due_cents: number }>> {
  const { data: booking } = await admin
    .from("one_off_session_bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found.", code: "not_found" };
  if (String(booking.status) === "cancelled") {
    return { ok: true, data: { booking, refund_due_cents: 0 } };
  }

  const { data: updated, error } = await admin
    .from("one_off_session_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message, code: "update_failed" };

  if (booking.job_id) {
    await admin.from("jobs").update({ status: "cancelled" }).eq("id", booking.job_id)
      .eq("business_id", businessId);
    try {
      await syncEnginePushDelete(admin, { businessId, jobId: String(booking.job_id) });
    } catch (_e) { /* no-op — Calendar cleanup is best-effort */ }
  }

  const { data: session } = await admin
    .from("one_off_sessions")
    .select("*")
    .eq("id", booking.session_id)
    .maybeSingle();
  if (session) await reconcileSoldOut(admin, session as SessionRow);

  return {
    ok: true,
    data: {
      booking: updated as SessionBookingRow,
      refund_due_cents: Math.max(0, Number(booking.amount_paid_cents) || 0),
    },
  };
}

/** Abandoned checkout (§9): the seat goes back so nobody loses a slot to a
 *  customer who never paid. Only ever applied to a still-unpaid booking. */
export async function releaseAbandonedSessionBooking(
  admin: Admin,
  bookingId: string,
): Promise<{ ok: boolean }> {
  const { data: booking } = await admin
    .from("one_off_session_bookings")
    .select("id,session_id,payment_status,status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false };
  if (booking.payment_status === "paid" || booking.status === "confirmed") return { ok: false };
  await admin.from("one_off_session_bookings").update({
    status: "cancelled",
    payment_status: booking.payment_status === "pending" ? "failed" : booking.payment_status,
    cancelled_at: new Date().toISOString(),
  }).eq("id", bookingId);
  // Freeing a seat has to be able to un-sell-out the session. Without this a
  // session that filled up and then had one checkout abandoned would sit at
  // sold_out forever — the freed seat unreachable, because sold_out is not a
  // bookable status.
  const { data: session } = await admin
    .from("one_off_sessions")
    .select("*")
    .eq("id", booking.session_id)
    .maybeSingle();
  if (session) await reconcileSoldOut(admin, session as SessionRow);
  return { ok: true };
}

/* ────────────────────────── projections ────────────────────────── */

export async function sessionBookingUrl(admin: Admin, session: SessionRow): Promise<string | null> {
  const { data: biz } = await admin
    .from("businesses")
    .select("slug")
    .eq("id", session.business_id)
    .maybeSingle();
  return buildSessionBookingUrl(biz?.slug ? String(biz.slug) : "", String(session.booking_token), {
    domain: HUBLY_DOMAIN,
  });
}

/**
 * The public projection (§24/§25). Deliberately narrow: what a stranger with
 * the link needs to book, and nothing else. No business id, no session id, no
 * owner contact internals, no other customers, no revenue, no meta.
 */
export async function publicSessionPayload(admin: Admin, session: SessionRow) {
  const businessId = String(session.business_id);
  const { data: biz } = await admin
    .from("businesses")
    .select("name,logo_url,brand_color,phone,slug,business_type,meta")
    .eq("id", businessId)
    .maybeSingle();
  const meta = getBusinessMeta(biz);
  const availability = await getSessionAvailability(admin, session, { forCustomer: true });
  const payment = resolveSessionPayment(session);
  const promo = sessionPromotionState(session);
  const terms = sessionTerminology(biz?.business_type as string);

  return {
    business: {
      name: biz?.name ? String(biz.name) : "",
      logo_url: biz?.logo_url ? String(biz.logo_url) : null,
      brand_color: biz?.brand_color ? String(biz.brand_color) : null,
      phone: biz?.phone ? String(biz.phone) : null,
    },
    session: {
      name: String(session.name || ""),
      description: session.description ? String(session.description) : null,
      status: String(session.status),
      date: String(session.session_date).slice(0, 10),
      start_time: String(session.start_time).slice(0, 5),
      end_time: String(session.end_time).slice(0, 5),
      timezone: session.timezone ? String(session.timezone) : null,
      duration_minutes: Number(session.appointment_duration_minutes) || 30,
      location: session.location ? String(session.location) : null,
      location_type: String(session.location_type || "in_person"),
      booking_questions: Array.isArray(session.booking_questions) ? session.booking_questions : [],
      cta: promo.cta,
      // Genuinely bookable = at least one slot a customer could actually take
      // right now. A published session whose day has passed, whose window is
      // fully conflicted, or whose seats are gone is NOT bookable, and the page
      // shows the honest reason instead of an empty time grid.
      bookable: !availability.block_reason && availability.slots.some((s) => s.available),
      block_reason: availability.block_reason,
      term_verb: terms.verb,
    },
    payment: {
      price_cents: payment.price_cents,
      currency: payment.currency,
      mode: payment.mode,
      charge_now_cents: payment.charge_now_cents,
      balance_due_cents: payment.balance_due_cents,
      deposit_cents: payment.deposit_cents,
      requires_checkout: payment.requires_checkout,
      line: describeSessionPayment(payment),
      // Honest: only true when the business can genuinely take a card today.
      stripe_ready: await businessCanCharge(admin, businessId),
    },
    policy: String(meta.cancellationPolicy || meta.depositMessage || "") || null,
    availability: {
      remaining: availability.remaining,
      total: availability.total_spots,
      slots: availability.slots.map((s) => ({
        time: s.time,
        label: s.label,
        available: s.available,
        seats_open: s.seats_open,
      })),
    },
  };
}

async function businessCanCharge(admin: Admin, businessId: string): Promise<boolean> {
  const { data } = await admin
    .from("stripe_connect_accounts")
    .select("stripe_account_id,charges_enabled")
    .eq("business_id", businessId)
    .maybeSingle();
  return !!(data?.stripe_account_id && data.charges_enabled);
}

/** Provider-side summary: everything the Sessions dashboard row needs. */
export async function sessionSummary(admin: Admin, session: SessionRow) {
  const availability = await getSessionAvailability(admin, session);
  const url = await sessionBookingUrl(admin, session);
  const payment = resolveSessionPayment(session);
  return {
    ...session,
    booking_url: url,
    slot_count: availability.slot_count,
    total_spots: availability.total_spots,
    booked: availability.booked,
    remaining: availability.remaining,
    payment_summary: payment,
    payment_line: describeSessionPayment(payment),
    promotion: sessionPromotionState(session),
    calendar_blocked: !!session.calendar_block_job_id,
    google_synced: !!session.google_event_id,
  };
}

export { generateSessionSlots, resolveSessionPayment, sessionPromotionState, validateSessionDraft };
