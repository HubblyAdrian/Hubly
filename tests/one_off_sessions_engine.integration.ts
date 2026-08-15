/**
 * One-Off Sessions — engine integration proof.
 *
 * Runs the REAL supabase/functions/_shared/one_off_session_engine.ts (and
 * everything it imports — the Google Calendar sync engine, the CRM customer
 * resolver, portal tokens, booking notifications) against an in-memory database
 * that enforces the migration's own constraints, including the partial unique
 * index that makes double-booking impossible.
 *
 * Nothing here is a re-implementation. Every assertion is about what the
 * production code actually wrote.
 *
 * Run: deno run --allow-env --allow-net tests/one_off_sessions_engine.integration.ts
 */

import { FakeDb, fakeClient } from "./support/fake_supabase.ts";
import {
  bookSessionSlot,
  cancelSession,
  cancelSessionBooking,
  closeSession,
  createSession,
  finalizeSessionBookingPayment,
  getSessionAvailability,
  getSessionById,
  getSessionByToken,
  publicSessionPayload,
  publishSession,
  releaseAbandonedSessionBooking,
  sessionSummary,
  updateSession,
} from "../supabase/functions/_shared/one_off_session_engine.ts";

const BIZ = "biz-photographer";
const OTHER_BIZ = "biz-someone-else";

let passed = 0;
const failures: string[] = [];
function ck(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`PASS · ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL · ${name}${detail !== undefined ? "  [" + JSON.stringify(detail) + "]" : ""}`);
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  ck(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

/** A fresh photographer with a real Stripe Connect account, unless told otherwise. */
function freshDb(opts?: { stripe?: boolean; google?: boolean }) {
  const db = new FakeDb();
  db.seed("businesses", [
    {
      id: BIZ,
      owner_id: "owner-1",
      name: "Adrian Smith Photography",
      slug: "adrian-photo",
      email: "studio@example.com",
      phone: "801-555-0100",
      business_type: "photography",
      brand_color: "#D9632D",
      logo_url: "https://example.com/logo.png",
      meta: JSON.stringify({ hours: {}, service_catalog: { version: 1, services: [], addons: [] } }),
    },
    { id: OTHER_BIZ, owner_id: "owner-2", name: "Someone Else", slug: "other", meta: "{}" },
  ]);
  if (opts?.stripe !== false) {
    db.seed("stripe_connect_accounts", [
      { business_id: BIZ, stripe_account_id: "acct_123", charges_enabled: true },
    ]);
  }
  if (opts?.google) {
    db.seed("google_calendar_connections", [{ id: "gc-1", business_id: BIZ }]);
  }
  return db;
}

/** The brief's exact scenario. Date kept far in the future so "past" logic never fires. */
const MINI = {
  name: "Fall Mini Sessions",
  description: "20-minute photography sessions",
  session_date: "2099-08-20",
  start_time: "08:00",
  end_time: "14:00",
  appointment_duration_minutes: 20,
  buffer_minutes: 0,
  location: "Thanksgiving Point",
  price_cents: 15000,
  payment_mode: "deposit",
  deposit_type: "flat",
  deposit_cents: 5000,
  timezone: "America/Denver",
};

async function makePublished(db: FakeDb, overrides: Record<string, unknown> = {}) {
  const admin = fakeClient(db);
  const created = await createSession(admin, BIZ, { ...MINI, ...overrides });
  if (!created.ok) throw new Error("createSession failed: " + created.error);
  const pub = await publishSession(admin, BIZ, String(created.data.id));
  if (!pub.ok) throw new Error("publishSession failed: " + pub.error);
  return { admin, session: pub.data };
}

/* ══════════════════ PHASE 3 — creation ══════════════════ */
{
  const db = freshDb();
  const admin = fakeClient(db);
  const created = await createSession(admin, BIZ, MINI);
  ck("create · succeeds with the brief's scenario", created.ok, created.ok ? "" : created);
  if (created.ok) {
    const s = created.data;
    eq("create · starts as a DRAFT", s.status, "draft");
    eq("create · is link-only by default", s.visibility, "link_only");
    ck("create · mints an opaque token that is not an id",
      typeof s.booking_token === "string" && String(s.booking_token).length >= 20 &&
      !String(s.booking_token).includes(String(s.id)));
    eq("create · holds NO calendar time while a draft", s.calendar_block_job_id, null);
    eq("create · writes no jobs row while a draft", db.rows("jobs").length, 0);
    const avail = await getSessionAvailability(admin, s);
    eq("create · derives 18 slots (8:00–14:00 @ 20min)", avail.slot_count, 18);
    eq("create · first slot is 8:00", avail.slots[0].time, "08:00");
    eq("create · last slot is 13:40", avail.slots[17].time, "13:40");
  }

  // §17 — the backend refuses bad configuration regardless of who asks.
  const bad = await createSession(admin, BIZ, { ...MINI, end_time: "07:00" });
  ck("create · rejects end before start", !bad.ok && /end time has to be after/i.test(bad.ok ? "" : bad.error));
  const bigDeposit = await createSession(admin, BIZ, { ...MINI, deposit_cents: 20000 });
  ck("create · rejects a deposit larger than the price", !bigDeposit.ok);
  const negative = await createSession(admin, BIZ, { ...MINI, price_cents: -1 });
  ck("create · rejects a negative price", !negative.ok);
  const tooLong = await createSession(admin, BIZ, { ...MINI, appointment_duration_minutes: 600 });
  ck("create · rejects an appointment longer than the window", !tooLong.ok);
}

/* ══════════════════ PHASE 4 — privacy ══════════════════ */
{
  const db = freshDb();
  const admin = fakeClient(db);
  const created = await createSession(admin, BIZ, MINI);
  if (!created.ok) throw new Error("setup");
  const token = String(created.data.booking_token);

  const byToken = await getSessionByToken(admin, token);
  ck("privacy · a draft is findable by token server-side (the API then 404s it)", !!byToken);

  // Cross-business isolation (§17): an id from another business must not resolve.
  const crossed = await getSessionById(admin, OTHER_BIZ, String(created.data.id));
  eq("privacy · another business cannot read this session by id", crossed, null);
  const crossUpdate = await updateSession(admin, OTHER_BIZ, String(created.data.id), { name: "Hijacked" });
  ck("privacy · another business cannot update this session", !crossUpdate.ok);
  const crossPublish = await publishSession(admin, OTHER_BIZ, String(created.data.id));
  ck("privacy · another business cannot publish this session", !crossPublish.ok);
  const crossCancel = await cancelSession(admin, OTHER_BIZ, String(created.data.id));
  ck("privacy · another business cannot cancel this session", !crossCancel.ok);
  eq("privacy · the session is untouched after all of that",
    (await getSessionById(admin, BIZ, String(created.data.id)))?.name, "Fall Mini Sessions");

  // The public projection must not carry internals.
  const { session } = await makePublished(freshDb());
  const pub = await publicSessionPayload(fakeClient(freshDb()), session);
  const json = JSON.stringify(pub);
  ck("privacy · public payload omits business_id", !json.includes(BIZ));
  ck("privacy · public payload omits the session id", !json.includes(String(session.id)));
  ck("privacy · public payload omits the booking token", !json.includes(String(session.booking_token)));
  ck("privacy · public payload carries branding + price",
    json.includes("Fall Mini Sessions") && json.includes("15000"));
}

/* ══════════════════ PHASE 8 — calendar blocking ══════════════════ */
{
  const db = freshDb();
  const { admin, session } = await makePublished(db);

  const blocks = db.rows("jobs").filter((j) => j.customer_name === "Blocked");
  eq("calendar · publishing writes exactly ONE block job", blocks.length, 1);
  const block = blocks[0];
  eq("calendar · block uses the existing 'Blocked' primitive", block.customer_name, "Blocked");
  eq("calendar · block covers the session date", block.scheduled_date, "2099-08-20");
  eq("calendar · block starts at the window start", block.scheduled_time, "08:00");
  eq("calendar · block spans the whole 6-hour window", block.duration_hours, 6);
  eq("calendar · block is linked back to the session", block.one_off_session_id, String(session.id));
  eq("calendar · session records its block job", session.calendar_block_job_id, block.id);
  eq("calendar · NO per-slot events are created", db.rows("jobs").length, 1);

  // The parent block must not close the session's own slots.
  const avail = await getSessionAvailability(admin, session);
  eq("calendar · the session's own 18 slots stay open inside its block",
    avail.slots.filter((s) => s.available).length, 18);
  ck("calendar · no slot is marked conflicted by the session's own block",
    avail.slots.every((s) => !s.conflicted));

  // Closing hands the unsold window back.
  const closed = await closeSession(admin, BIZ, String(session.id));
  ck("calendar · close succeeds", closed.ok);
  eq("calendar · closing removes the block job",
    db.rows("jobs").filter((j) => j.customer_name === "Blocked").length, 0);
  const after = await getSessionById(admin, BIZ, String(session.id));
  eq("calendar · closing clears the recorded block", after?.calendar_block_job_id, null);

  // Reopening re-creates it.
  const reopened = await publishSession(admin, BIZ, String(session.id));
  ck("calendar · a closed session can be reopened", reopened.ok);
  eq("calendar · reopening re-creates exactly one block",
    db.rows("jobs").filter((j) => j.customer_name === "Blocked").length, 1);
}

/* ══════════════════ PHASE 9 — existing calendar conflicts ══════════════════ */
{
  const db = freshDb();
  // A normal job the photographer already had, 10:00–10:30.
  db.seed("jobs", [{
    id: "job-existing",
    business_id: BIZ,
    customer_name: "Regular Client",
    service_name: "Headshots",
    scheduled_date: "2099-08-20",
    scheduled_time: "10:00",
    duration_hours: 0.5,
    status: "scheduled",
    one_off_session_id: null,
  }]);
  // A separate manual block, 12:00–13:00.
  db.seed("jobs", [{
    id: "job-block",
    business_id: BIZ,
    customer_name: "Blocked",
    service_name: "Lunch",
    scheduled_date: "2099-08-20",
    scheduled_time: "12:00",
    duration_hours: 1,
    status: "scheduled",
    one_off_session_id: null,
  }]);
  // A cancelled job must NOT block anything.
  db.seed("jobs", [{
    id: "job-cancelled",
    business_id: BIZ,
    customer_name: "Gone",
    scheduled_date: "2099-08-20",
    scheduled_time: "09:00",
    duration_hours: 1,
    status: "cancelled",
    one_off_session_id: null,
  }]);

  const { admin, session } = await makePublished(db);
  const avail = await getSessionAvailability(admin, session);
  const at = (t: string) => avail.slots.find((s) => s.time === t)!;

  eq("conflicts · 10:00 is closed by the existing job", at("10:00").available, false);
  eq("conflicts · 10:20 is closed by the existing job", at("10:20").available, false);
  eq("conflicts · 9:40 (before it) stays open", at("09:40").available, true);
  eq("conflicts · 10:40 (after it) stays open", at("10:40").available, true);
  eq("conflicts · 12:00 is closed by the manual block", at("12:00").available, false);
  eq("conflicts · 12:40 is closed by the manual block", at("12:40").available, false);
  eq("conflicts · 13:00 (after the block) stays open", at("13:00").available, true);
  eq("conflicts · a CANCELLED job blocks nothing", at("09:00").available, true);

  const booked = await bookSessionSlot(admin, session, {
    slot_time: "10:00",
    customer: { name: "Late Comer", email: "late@example.com" },
  });
  ck("conflicts · booking a conflicted slot is refused",
    !booked.ok && (booked.ok ? "" : booked.code) === "calendar_conflict");
}

/* ══════════════════ PHASE 7 — concurrency ══════════════════ */
{
  const db = freshDb({ stripe: false }); // no Stripe → bookings confirm immediately
  const { admin, session } = await makePublished(db, { payment_mode: "none", price_cents: 15000 });

  // Two customers, same slot, launched together.
  const [a, b] = await Promise.all([
    bookSessionSlot(admin, session, { slot_time: "10:20", customer: { name: "Customer A", email: "a@example.com" } }),
    bookSessionSlot(admin, session, { slot_time: "10:20", customer: { name: "Customer B", email: "b@example.com" } }),
  ]);
  const wins = [a, b].filter((r) => r.ok).length;
  eq("concurrency · exactly one of two simultaneous bookers wins", wins, 1);
  const loser = [a, b].find((r) => !r.ok)!;
  ck("concurrency · the loser is told the slot is gone",
    !loser.ok && ["slot_taken", "sold_out"].includes(loser.code || ""), loser);

  const live = db.rows("one_off_session_bookings")
    .filter((r) => r.slot_time === "10:20:00" && r.status !== "cancelled");
  eq("concurrency · the database holds exactly one live booking for 10:20", live.length, 1);
  eq("concurrency · it holds seat 0", live[0].seat_no, 0);

  // Ten at once on a capacity-3 slot.
  const db3 = freshDb({ stripe: false });
  const three = await makePublished(db3, { payment_mode: "none", price_cents: 15000, capacity_per_slot: 3 });
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      bookSessionSlot(three.admin, three.session, {
        slot_time: "09:00",
        customer: { name: `Racer ${i}`, email: `r${i}@example.com` },
      })),
  );
  eq("concurrency · a capacity-3 slot sells exactly 3 of 10 attempts", results.filter((r) => r.ok).length, 3);
  const seats = db3.rows("one_off_session_bookings")
    .filter((r) => r.slot_time === "09:00:00" && r.status !== "cancelled")
    .map((r) => Number(r.seat_no)).sort();
  eq("concurrency · seats are distinct 0,1,2", seats, [0, 1, 2]);
}

/* ══════════════════ PHASE 6 — payment ══════════════════ */
{
  const db = freshDb(); // Stripe connected
  const { admin, session } = await makePublished(db);

  const booked = await bookSessionSlot(admin, session, {
    slot_time: "10:20",
    customer: { name: "Sarah Chen", email: "sarah@example.com", phone: "801-555-0199" },
  });
  ck("payment · booking succeeds", booked.ok, booked.ok ? "" : booked);
  if (!booked.ok) throw new Error("setup");
  const bookingId = String(booked.data.booking.id);

  eq("payment · deposit is $50 of the $150 price", booked.data.payment.charge_now_cents, 5000);
  eq("payment · balance is $100", booked.data.payment.balance_due_cents, 10000);
  eq("payment · payment is required", booked.data.requires_payment, true);
  eq("payment · booking is NOT confirmed before payment", booked.data.booking.status, "pending_payment");
  eq("payment · no job exists before payment", db.rows("jobs").filter((j) => j.from_booking).length, 0);

  // The webhook is the only thing that confirms.
  const fin = await finalizeSessionBookingPayment(admin, {
    bookingId, amountPaidCents: 5000, paymentIntentId: "pi_1", checkoutSessionId: "cs_1",
  });
  ck("payment · webhook finalize succeeds", fin.ok, fin);
  const row = db.rows("one_off_session_bookings").find((r) => r.id === bookingId)!;
  eq("payment · webhook confirms the booking", row.status, "confirmed");
  eq("payment · webhook marks it paid", row.payment_status, "paid");
  eq("payment · records the real amount", row.amount_paid_cents, 5000);
  eq("payment · records the payment intent", row.stripe_payment_intent_id, "pi_1");

  const jobs = db.rows("jobs").filter((j) => j.from_booking);
  eq("payment · exactly one appointment job is created", jobs.length, 1);
  eq("payment · the job is on the session's date at the booked time",
    [jobs[0].scheduled_date, jobs[0].scheduled_time], ["2099-08-20", "10:20"]);
  eq("payment · the job is linked to the session", jobs[0].one_off_session_id, String(session.id));
  eq("payment · deposit is recorded on the job as paid online", jobs[0].deposit_status, "paid_online");

  // Repeated webhook (Stripe retries) must be inert.
  const again = await finalizeSessionBookingPayment(admin, {
    bookingId, amountPaidCents: 5000, paymentIntentId: "pi_1", checkoutSessionId: "cs_1",
  });
  ck("payment · a repeated webhook succeeds", again.ok);
  eq("payment · a repeated webhook does NOT create a second job",
    db.rows("jobs").filter((j) => j.from_booking).length, 1);
  eq("payment · a repeated webhook does NOT create a second customer", db.rows("customers").length, 1);

  // A customer who already exists is reused, not duplicated.
  const second = await bookSessionSlot(admin, session, {
    slot_time: "11:00", customer: { name: "Sarah Chen", email: "sarah@example.com", phone: "801-555-0199" },
  });
  if (second.ok) {
    await finalizeSessionBookingPayment(admin, { bookingId: String(second.data.booking.id), amountPaidCents: 5000 });
  }
  eq("payment · an existing customer is matched, not duplicated", db.rows("customers").length, 1);

  // Abandoned checkout frees the seat.
  const abandoned = await bookSessionSlot(admin, session, {
    slot_time: "12:00", customer: { name: "Ghost", email: "ghost@example.com" },
  });
  if (!abandoned.ok) throw new Error("setup");
  await releaseAbandonedSessionBooking(admin, String(abandoned.data.booking.id));
  const ghost = db.rows("one_off_session_bookings").find((r) => r.id === String(abandoned.data.booking.id))!;
  eq("payment · an abandoned checkout cancels the booking", ghost.status, "cancelled");
  const reAvail = await getSessionAvailability(admin, session);
  eq("payment · the abandoned seat is back on sale", reAvail.slots.find((s) => s.time === "12:00")!.available, true);

  // A payment that lands on an already-released booking must still be recorded.
  const late = await finalizeSessionBookingPayment(admin, {
    bookingId: String(abandoned.data.booking.id), amountPaidCents: 5000, paymentIntentId: "pi_late",
  });
  ck("payment · a late payment on a released booking is handled", late.ok);
  const ghostAfter = db.rows("one_off_session_bookings").find((r) => r.id === String(abandoned.data.booking.id))!;
  eq("payment · that payment is RECORDED, not discarded", ghostAfter.payment_status, "paid");
  eq("payment · the booking stays cancelled (no seat is stolen back)", ghostAfter.status, "cancelled");
  eq("payment · no job is created for it", db.rows("jobs").filter((j) => j.from_booking).length, 2);
}

/* ══════════════════ Stripe not connected ══════════════════ */
{
  const db = freshDb({ stripe: false });
  const { admin, session } = await makePublished(db);
  const booked = await bookSessionSlot(admin, session, {
    slot_time: "08:00", customer: { name: "No Card", email: "nocard@example.com" },
  });
  ck("stripe-off · booking still succeeds", booked.ok, booked.ok ? "" : booked);
  if (!booked.ok) throw new Error("setup");
  eq("stripe-off · payment is NOT demanded", booked.data.requires_payment, false);
  eq("stripe-off · the booking is confirmed immediately", booked.data.booking.status, "confirmed");
  eq("stripe-off · nothing is claimed as paid", booked.data.booking.payment_status, "none");
  eq("stripe-off · a real appointment job exists", db.rows("jobs").filter((j) => j.from_booking).length, 1);
  const pub = await publicSessionPayload(admin, session);
  eq("stripe-off · the public page says card payment isn't available", pub.payment.stripe_ready, false);
}

/* ══════════════════ PHASE 10 — Google Calendar ══════════════════ */
{
  const dbOff = freshDb({ google: false });
  const { session: sOff } = await makePublished(dbOff);
  eq("gcal-off · publishing still works with no Google connection", sOff.status, "published");
  eq("gcal-off · no Google event id is invented", sOff.google_event_id, null);
  eq("gcal-off · the block job is still created",
    dbOff.rows("jobs").filter((j) => j.customer_name === "Blocked").length, 1);
  const blockJob = dbOff.rows("jobs").find((j) => j.customer_name === "Blocked")!;
  eq("gcal-off · the block job is marked local-only by the sync engine", blockJob.sync_status, "local_only");

  // Re-publishing (reconnect / republish) must not duplicate the block.
  const db2 = freshDb();
  const { admin, session } = await makePublished(db2);
  await publishSession(admin, BIZ, String(session.id)); // idempotent no-op
  eq("gcal · re-publishing does not duplicate the block",
    db2.rows("jobs").filter((j) => j.customer_name === "Blocked").length, 1);
  const moved = await updateSession(admin, BIZ, String(session.id), { end_time: "16:00" });
  ck("gcal · extending the window succeeds", moved.ok);
  const blocksAfter = db2.rows("jobs").filter((j) => j.customer_name === "Blocked");
  eq("gcal · extending MOVES the block rather than adding one", blocksAfter.length, 1);
  eq("gcal · the block now spans 8 hours", blocksAfter[0].duration_hours, 8);
  const grid = await getSessionAvailability(admin, moved.ok ? moved.data.session : session);
  eq("gcal · extending to 4pm yields 24 slots", grid.slot_count, 24);

  // Cancelling leaves no orphan block.
  const cancelled = await cancelSession(admin, BIZ, String(session.id));
  ck("gcal · cancel succeeds", cancelled.ok);
  eq("gcal · cancelling removes the block job",
    db2.rows("jobs").filter((j) => j.customer_name === "Blocked").length, 0);
}

/* ══════════════════ PHASE 18 — modification safety ══════════════════ */
{
  const db = freshDb({ stripe: false });
  const { admin, session } = await makePublished(db, { payment_mode: "none", price_cents: 15000 });
  const sid = String(session.id);

  // Ten real bookings.
  const times = ["08:00", "08:20", "08:40", "09:00", "09:20"];
  for (const t of times) {
    const r = await bookSessionSlot(admin, session, { slot_time: t, customer: { name: "C " + t, email: `c${t}@x.com` } });
    if (!r.ok) throw new Error("setup booking " + t + " " + r.error);
  }
  eq("safety · five bookings exist", db.rows("one_off_session_bookings").filter((b) => b.status !== "cancelled").length, 5);

  // Repricing is allowed but never retroactive.
  const repriced = await updateSession(admin, BIZ, sid, { price_cents: 5000 });
  ck("safety · repricing is allowed", repriced.ok, repriced.ok ? "" : repriced);
  ck("safety · repricing WARNS that it is not retroactive",
    repriced.ok && repriced.data.warnings.some((w) => /existing booking/i.test(w)),
    repriced.ok ? repriced.data.warnings : repriced);
  const first = db.rows("one_off_session_bookings")[0];
  eq("safety · an existing booking keeps the price it was booked at", first.price_cents, 15000);

  // Shortening appointments under an existing booking's length is refused.
  const shortened = await updateSession(admin, BIZ, sid, { appointment_duration_minutes: 10 });
  ck("safety · shortening below an existing booking's length is REFUSED", !shortened.ok);
  ck("safety · the refusal explains why",
    !shortened.ok && /overlap/i.test(shortened.error), shortened.ok ? "" : shortened.error);

  // Moving the date is refused.
  const moved = await updateSession(admin, BIZ, sid, { session_date: "2099-08-21" });
  ck("safety · moving the date with bookings on it is REFUSED", !moved.ok);

  // A change that strands a booking is refused.
  const narrowed = await updateSession(admin, BIZ, sid, { start_time: "09:00" });
  ck("safety · narrowing the window past a booking is REFUSED", !narrowed.ok);
  ck("safety · the refusal names the stranded times",
    !narrowed.ok && /8:00/.test(narrowed.error), narrowed.ok ? "" : narrowed.error);

  // Lengthening is safe.
  const longer = await updateSession(admin, BIZ, sid, { appointment_duration_minutes: 30 });
  ck("safety · lengthening to 30 minutes is refused (it would strand 8:20)", !longer.ok);

  // Extending the end is always safe.
  const extended = await updateSession(admin, BIZ, sid, { end_time: "16:00" });
  ck("safety · extending the end time is allowed", extended.ok, extended.ok ? "" : extended);
  eq("safety · every existing booking survives",
    db.rows("one_off_session_bookings").filter((b) => b.status !== "cancelled").length, 5);

  // Capacity cannot drop below seats handed out.
  const db2 = freshDb({ stripe: false });
  const two = await makePublished(db2, { payment_mode: "none", price_cents: 15000, capacity_per_slot: 2 });
  await bookSessionSlot(two.admin, two.session, { slot_time: "08:00", customer: { name: "One", email: "1@x.com" } });
  await bookSessionSlot(two.admin, two.session, { slot_time: "08:00", customer: { name: "Two", email: "2@x.com" } });
  const shrunk = await updateSession(two.admin, BIZ, String(two.session.id), { capacity_per_slot: 1 });
  ck("safety · dropping capacity below booked seats is REFUSED", !shrunk.ok);
}

/* ══════════════════ sold out ⇄ published ══════════════════ */
{
  const db = freshDb({ stripe: false });
  const { admin, session } = await makePublished(db, {
    payment_mode: "none", price_cents: 15000, total_capacity: 2,
  });
  const sid = String(session.id);
  const b1 = await bookSessionSlot(admin, session, { slot_time: "08:00", customer: { name: "A", email: "a@x.com" } });
  const cur = await getSessionById(admin, BIZ, sid);
  const b2 = await bookSessionSlot(admin, cur!, { slot_time: "08:20", customer: { name: "B", email: "b@x.com" } });
  ck("soldout · both capped seats sell", b1.ok && b2.ok);
  const soldOut = await getSessionById(admin, BIZ, sid);
  eq("soldout · the session flips to sold_out automatically", soldOut?.status, "sold_out");

  const third = await bookSessionSlot(admin, soldOut!, { slot_time: "09:00", customer: { name: "C", email: "c@x.com" } });
  ck("soldout · a sold-out session refuses new bookings", !third.ok);

  // A confirmed booking is only ever released by the owner cancelling it —
  // releaseAbandonedSessionBooking deliberately refuses anything confirmed/paid.
  if (b2.ok) {
    const refused = await releaseAbandonedSessionBooking(admin, String(b2.data.booking.id));
    eq("soldout · the abandon path refuses a CONFIRMED booking", refused.ok, false);
  }
  const cancelledOne = b2.ok
    ? await cancelSessionBooking(admin, BIZ, String(b2.data.booking.id))
    : { ok: false as const, error: "setup", code: "setup" };
  ck("soldout · the owner can cancel a single booking", cancelledOne.ok, cancelledOne);
  const reopened = await getSessionById(admin, BIZ, sid);
  eq("soldout · cancelling a booking flips sold_out back to published", reopened?.status, "published");
  const fourth = await bookSessionSlot(admin, reopened!, { slot_time: "09:00", customer: { name: "D", email: "d@x.com" } });
  ck("soldout · the freed seat is genuinely bookable again", fourth.ok, fourth.ok ? "" : fourth);
  eq("soldout · the cancelled booking's appointment is cancelled, not deleted",
    db.rows("jobs").filter((j) => j.status === "cancelled").length, 1);
  eq("soldout · no refund is claimed, only what is owed is reported",
    cancelledOne.ok ? cancelledOne.data.refund_due_cents : -1, 0);
}

/* ══════════════════ PHASE 23 — edge cases ══════════════════ */
{
  const db = freshDb({ stripe: false });
  const { admin, session } = await makePublished(db, { payment_mode: "none", price_cents: 15000 });

  // Closed / cancelled sessions refuse bookings.
  await closeSession(admin, BIZ, String(session.id));
  const closedSession = await getSessionById(admin, BIZ, String(session.id));
  const onClosed = await bookSessionSlot(admin, closedSession!, {
    slot_time: "08:00", customer: { name: "Too Late", email: "late@x.com" },
  });
  ck("edge · a closed session refuses bookings", !onClosed.ok);
  ck("edge · with an honest reason", !onClosed.ok && /no longer accepting/i.test(onClosed.error));

  const db2 = freshDb({ stripe: false });
  const s2 = await makePublished(db2, { payment_mode: "none", price_cents: 15000 });
  await cancelSession(s2.admin, BIZ, String(s2.session.id));
  const cancelled = await getSessionById(s2.admin, BIZ, String(s2.session.id));
  const onCancelled = await bookSessionSlot(s2.admin, cancelled!, {
    slot_time: "08:00", customer: { name: "X", email: "x@x.com" },
  });
  ck("edge · a cancelled session refuses bookings", !onCancelled.ok);

  // A draft refuses bookings even with the token in hand.
  const db3 = freshDb();
  const admin3 = fakeClient(db3);
  const draft = await createSession(admin3, BIZ, MINI);
  if (!draft.ok) throw new Error("setup");
  const onDraft = await bookSessionSlot(admin3, draft.data, {
    slot_time: "08:00", customer: { name: "Sneaky", email: "s@x.com" },
  });
  ck("edge · a draft refuses bookings", !onDraft.ok && /isn't open for booking/i.test(onDraft.error));

  // A time that isn't on the grid.
  const db4 = freshDb({ stripe: false });
  const s4 = await makePublished(db4, { payment_mode: "none", price_cents: 15000 });
  const offGrid = await bookSessionSlot(s4.admin, s4.session, {
    slot_time: "08:07", customer: { name: "Off", email: "o@x.com" },
  });
  ck("edge · a time not on the grid is refused", !offGrid.ok && offGrid.code === "slot_not_in_session");
  const noName = await bookSessionSlot(s4.admin, s4.session, {
    slot_time: "08:00", customer: { name: "  ", email: "o@x.com" },
  });
  ck("edge · a booking with no name is refused", !noName.ok);

  // Double-submit by the same person at the same time. Capacity 2 so the refusal
  // is genuinely about it being the SAME person, not about the slot being full.
  const dbDup = freshDb({ stripe: false });
  const dup = await makePublished(dbDup, { payment_mode: "none", price_cents: 15000, capacity_per_slot: 2 });
  const first = await bookSessionSlot(dup.admin, dup.session, {
    slot_time: "09:00", customer: { name: "Twice", email: "twice@x.com" },
  });
  const dupe = await bookSessionSlot(dup.admin, dup.session, {
    slot_time: "09:00", customer: { name: "Twice", email: "TWICE@x.com" },
  });
  ck("edge · the first booking succeeds", first.ok);
  ck("edge · a duplicate submit for the same slot+email is refused (case-insensitive)",
    !dupe.ok && dupe.code === "duplicate_booking", dupe);
  const other = await bookSessionSlot(dup.admin, dup.session, {
    slot_time: "09:00", customer: { name: "Someone Else", email: "else@x.com" },
  });
  ck("edge · a DIFFERENT person can still take the second seat", other.ok, other);

  // A session whose day has already gone.
  const dbPast = freshDb({ stripe: false });
  const past = await makePublished(dbPast, {
    session_date: "2020-01-15", payment_mode: "none", price_cents: 15000,
  });
  const onPast = await bookSessionSlot(past.admin, past.session, {
    slot_time: "08:00", customer: { name: "Time Traveller", email: "tt@x.com" },
  });
  ck("edge · a session in the past refuses bookings", !onPast.ok);
  ck("edge · and says it already happened", !onPast.ok && /already happened/i.test(onPast.error),
    onPast.ok ? "" : onPast.error);
  const pastPub = await publicSessionPayload(past.admin, past.session);
  eq("edge · the public page for a past session is not bookable", pastPub.session.bookable, false);

  // 100% deposit and no deposit.
  const dbFull = freshDb();
  const full = await makePublished(dbFull, { payment_mode: "full", deposit_type: null, deposit_cents: null });
  const fullBook = await bookSessionSlot(full.admin, full.session, {
    slot_time: "08:00", customer: { name: "Payer", email: "p@x.com" },
  });
  ck("edge · pay-in-full charges the whole price", fullBook.ok && fullBook.data.payment.charge_now_cents === 15000);
  eq("edge · pay-in-full leaves no balance", fullBook.ok ? fullBook.data.payment.balance_due_cents : -1, 0);
}

/* ══════════════════ expired-checkout self-healing ══════════════════ */
{
  const db = freshDb(); // Stripe connected → bookings start pending_payment
  const { admin, session } = await makePublished(db);

  const held = await bookSessionSlot(admin, session, {
    slot_time: "10:20", customer: { name: "Wanderer", email: "w@example.com" },
  });
  ck("reclaim · a checkout-pending booking holds its seat", held.ok, held.ok ? "" : held);
  if (!held.ok) throw new Error("setup");
  const fresh = await getSessionAvailability(admin, session);
  eq("reclaim · while fresh, the seat stays held",
    fresh.slots.find((s) => s.time === "10:20")!.available, false);

  // Age it past Stripe's own 30-minute checkout expiry (we use 60 for safety).
  const row = db.rows("one_off_session_bookings").find((r) => r.id === String(held.data.booking.id))!;
  row.created_at = new Date(Date.now() - 61 * 60_000).toISOString();

  const healed = await getSessionAvailability(admin, session);
  eq("reclaim · a seat held by an unpayable checkout is released",
    healed.slots.find((s) => s.time === "10:20")!.available, true);
  eq("reclaim · the dead booking is cancelled, not deleted", row.status, "cancelled");
  eq("reclaim · and marked failed rather than paid", row.payment_status, "failed");
  eq("reclaim · the freed seat is genuinely bookable", healed.remaining, 18);

  const rebooked = await bookSessionSlot(admin, session, {
    slot_time: "10:20", customer: { name: "Second Chance", email: "sc@example.com" },
  });
  ck("reclaim · somebody else can now take that time", rebooked.ok, rebooked.ok ? "" : rebooked);

  // A PAID booking must never be reclaimed, however old it is.
  const paid = await bookSessionSlot(admin, session, {
    slot_time: "11:00", customer: { name: "Paid Up", email: "p@example.com" },
  });
  if (!paid.ok) throw new Error("setup");
  await finalizeSessionBookingPayment(admin, { bookingId: String(paid.data.booking.id), amountPaidCents: 5000 });
  const paidRow = db.rows("one_off_session_bookings").find((r) => r.id === String(paid.data.booking.id))!;
  paidRow.created_at = new Date(Date.now() - 400 * 60_000).toISOString();
  const afterPaid = await getSessionAvailability(admin, session);
  eq("reclaim · an old PAID booking is never reclaimed", paidRow.status, "confirmed");
  eq("reclaim · its seat stays held", afterPaid.slots.find((s) => s.time === "11:00")!.available, false);
}

/* ══════════════════ summary shape used by the UI + AI ══════════════════ */
{
  const db = freshDb({ stripe: false });
  const { admin, session } = await makePublished(db, { payment_mode: "none", price_cents: 15000 });
  await bookSessionSlot(admin, session, { slot_time: "08:00", customer: { name: "One", email: "1@x.com" } });
  const summary = await sessionSummary(admin, (await getSessionById(admin, BIZ, String(session.id)))!);
  eq("summary · slot count", summary.slot_count, 18);
  eq("summary · booked", summary.booked, 1);
  eq("summary · remaining", summary.remaining, 17);
  ck("summary · exposes the real private booking link",
    String(summary.booking_url).startsWith("https://adrian-photo.myhubly.app/session/"));
  ck("summary · the link carries the opaque token",
    String(summary.booking_url).endsWith(String(session.booking_token)));
  eq("summary · reports the calendar as blocked", summary.calendar_blocked, true);
  eq("summary · promotion state is active", summary.promotion.state, "active");
  eq("summary · promotion CTA", summary.promotion.cta, "Book Your Session");
}

console.log(`\n==== ENGINE INTEGRATION: ${passed} passed, ${failures.length} failed ====`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  Deno.exit(1);
}
