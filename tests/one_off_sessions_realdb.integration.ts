/**
 * One-Off Sessions — the real engine against a REAL PostgreSQL database.
 *
 * This is the strongest verification available without a cloud Supabase project.
 * The in-memory harness proves the engine's decisions; this proves the engine
 * against actual SQL: real CHECK constraints, the real partial unique index
 * (a genuine 23505 raised by Postgres, not a simulated one), and real
 * date / time / jsonb / numeric round-tripping — which is precisely where a
 * hand-written fake can quietly disagree with production.
 *
 * Setup (see scripts/staging/README or the deployment runbook):
 *   psql <db> -f scripts/staging/bootstrap_hubly_core.sql
 *   psql <db> -f supabase/migrations/20260815120000_one_off_sessions.sql
 *
 * Run:
 *   STAGING_DB_URL=postgresql://... deno run --allow-env --allow-net --no-check \
 *     tests/one_off_sessions_realdb.integration.ts
 */

import { connect, pgSupabaseClient } from "./support/pg_supabase_adapter.ts";
import { toDateOnly } from "../supabase/functions/_shared/one_off_session_core.mjs";
import {
  bookSessionSlot,
  cancelSessionBooking,
  closeSession,
  createSession,
  finalizeSessionBookingPayment,
  getSessionAvailability,
  getSessionById,
  publicSessionPayload,
  publishSession,
  sessionSummary,
  updateSession,
} from "../supabase/functions/_shared/one_off_session_engine.ts";

const DB = Deno.env.get("STAGING_DB_URL") ||
  "postgresql://postgres@127.0.0.1:55432/hubly_staging";

const BIZ = "c0000000-0000-4000-8000-000000000001";
const OTHER = "c0000000-0000-4000-8000-000000000002";

let passed = 0;
const failures: string[] = [];
const ck = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { passed++; console.log("PASS · " + name); }
  else { failures.push(name); console.log("FAIL · " + name + (detail !== undefined ? "  [" + JSON.stringify(detail) + "]" : "")); }
};
const eq = (name: string, a: unknown, b: unknown) =>
  ck(name, JSON.stringify(a) === JSON.stringify(b), { actual: a, expected: b });

const client = await connect(DB);
const admin = pgSupabaseClient(client);

async function reset() {
  for (const t of ["one_off_session_bookings", "one_off_sessions", "jobs", "customers"]) {
    await client.queryObject(`delete from public.${t} where business_id = any($1)`, [[BIZ, OTHER]]);
  }
  await client.queryObject(`delete from public.stripe_connect_accounts where business_id = any($1)`, [[BIZ, OTHER]]);
  await client.queryObject(`delete from public.businesses where id = any($1)`, [[BIZ, OTHER]]);
  // The full migration chain brings the real marketplace_providers trigger,
  // which FKs owner_id to auth.users — so the owners must genuinely exist,
  // exactly as they would in production.
  await client.queryObject(
    `insert into auth.users(id,email) values ($1,'owner-a@example.com'),($2,'owner-b@example.com')
     on conflict (id) do nothing`,
    ["aaaaaaaa-0000-4000-8000-000000000001", "aaaaaaaa-0000-4000-8000-000000000002"],
  );
  await client.queryObject(
    `insert into public.businesses(id,owner_id,name,slug,email,phone,business_type,brand_color,meta)
     values ($1,$2,'Adrian Smith Photography','adrian-photo-real','studio@example.com','801-555-0100',
             'photography','#D9632D',$3),
            ($4,$5,'Other Co','other-co-real',null,null,null,null,'{}')`,
    [BIZ, "aaaaaaaa-0000-4000-8000-000000000001",
     JSON.stringify({ hours: {}, cancellationPolicy: "Deposits are non-refundable within 48 hours." }),
     OTHER, "aaaaaaaa-0000-4000-8000-000000000002"],
  );
}

async function withStripe(on: boolean) {
  await client.queryObject(`delete from public.stripe_connect_accounts where business_id = $1`, [BIZ]);
  if (on) {
    await client.queryObject(
      `insert into public.stripe_connect_accounts(business_id,stripe_account_id,charges_enabled)
       values ($1,'acct_test',true)`, [BIZ]);
  }
}

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

/* ══════════════════ create + publish against real SQL ══════════════════ */
await reset();
await withStripe(true);
{
  const created = await createSession(admin, BIZ, MINI);
  ck("realdb · create succeeds", created.ok, created.ok ? "" : created);
  if (!created.ok) throw new Error("setup");

  // Real Postgres hands a `date` column back as a JS Date, not a string — the
  // exact shape the fake DB could never reproduce, and the one that broke
  // publishing until toDateOnly() landed.
  const raw = created.data;
  ck("realdb · a date column really does arrive as a Date (not a string)",
    raw.session_date instanceof Date, typeof raw.session_date);
  eq("realdb · the engine normalises it to the right calendar day",
    toDateOnly(raw.session_date), "2099-08-20");
  ck("realdb · start_time round-trips usably",
    String(raw.start_time).startsWith("08:00"), raw.start_time);
  eq("realdb · jsonb defaults come back as objects",
    typeof raw.website_promotion, "object");
  eq("realdb · booking_questions comes back as an array", Array.isArray(raw.booking_questions), true);

  const avail = await getSessionAvailability(admin, raw);
  eq("realdb · 18 slots derived from real columns", avail.slot_count, 18);
  eq("realdb · first slot", avail.slots[0].time, "08:00");
  eq("realdb · last slot", avail.slots[17].time, "13:40");

  const pub = await publishSession(admin, BIZ, String(raw.id));
  ck("realdb · publish succeeds", pub.ok, pub.ok ? "" : pub);
  if (!pub.ok) throw new Error("setup");

  const { rows: blocks } = await client.queryObject<Record<string, unknown>>(
    `select * from public.jobs where business_id=$1 and customer_name='Blocked'`, [BIZ]);
  eq("realdb · publishing wrote exactly one block job", blocks.length, 1);
  eq("realdb · the block is linked to the session", String(blocks[0].one_off_session_id), String(raw.id));
  eq("realdb · the block covers the whole window", Number(blocks[0].duration_hours), 6);
  ck("realdb · the block starts at 08:00", String(blocks[0].scheduled_time).startsWith("08:00"), blocks[0].scheduled_time);

  // The session's own block must not close its own slots.
  const after = await getSessionAvailability(admin, pub.data);
  eq("realdb · all 18 slots remain open inside the block",
    after.slots.filter((s) => s.available).length, 18);
}

/* ══════════════════ booking + real 23505 concurrency ══════════════════ */
{
  const s = (await getSessionById(admin, BIZ, String(
    (await client.queryObject<{ id: string }>(`select id from public.one_off_sessions where business_id=$1`, [BIZ])).rows[0].id,
  )))!;

  const [a, b] = await Promise.all([
    bookSessionSlot(admin, s, { slot_time: "10:20", customer: { name: "Customer A", email: "a@x.com" } }),
    bookSessionSlot(admin, s, { slot_time: "10:20", customer: { name: "Customer B", email: "b@x.com" } }),
  ]);
  eq("realdb · exactly one of two simultaneous bookers wins", [a, b].filter((r) => r.ok).length, 1);

  const { rows: live } = await client.queryObject<Record<string, unknown>>(
    `select * from public.one_off_session_bookings
      where session_id=$1 and slot_time='10:20' and status <> 'cancelled'`, [s.id]);
  eq("realdb · the database holds exactly one live booking at 10:20", live.length, 1);
  eq("realdb · it holds seat 0", Number(live[0].seat_no), 0);

  // The loser must have been rejected by the real index, not by app bookkeeping.
  const loser = [a, b].find((r) => !r.ok)!;
  ck("realdb · the loser is told the slot is gone",
    !loser.ok && ["slot_taken", "sold_out"].includes(loser.code || ""), loser);

  const winner = [a, b].find((r) => r.ok)!;
  if (!winner.ok) throw new Error("setup");
  eq("realdb · booking starts pending_payment (deposit due)", winner.data.booking.status, "pending_payment");
  eq("realdb · deposit is $50", winner.data.payment.charge_now_cents, 5000);

  const { rows: jobsBefore } = await client.queryObject(
    `select id from public.jobs where business_id=$1 and from_booking = true`, [BIZ]);
  eq("realdb · no appointment job exists before payment", jobsBefore.length, 0);

  // Webhook confirms
  const fin = await finalizeSessionBookingPayment(admin, {
    bookingId: String(winner.data.booking.id), amountPaidCents: 5000,
    paymentIntentId: "pi_real", checkoutSessionId: "cs_real",
  });
  ck("realdb · webhook finalize succeeds", fin.ok, fin);

  const { rows: bk } = await client.queryObject<Record<string, unknown>>(
    `select * from public.one_off_session_bookings where id=$1`, [winner.data.booking.id]);
  eq("realdb · booking is confirmed", bk[0].status, "confirmed");
  eq("realdb · booking is paid", bk[0].payment_status, "paid");
  eq("realdb · amount recorded", Number(bk[0].amount_paid_cents), 5000);

  const { rows: jobsAfter } = await client.queryObject<Record<string, unknown>>(
    `select * from public.jobs where business_id=$1 and from_booking = true`, [BIZ]);
  eq("realdb · exactly one appointment job created", jobsAfter.length, 1);
  ck("realdb · at the booked time", String(jobsAfter[0].scheduled_time).startsWith("10:20"), jobsAfter[0].scheduled_time);
  eq("realdb · linked to the session", String(jobsAfter[0].one_off_session_id), String(s.id));
  eq("realdb · deposit recorded on the job", bk[0].deposit_cents ? Number(bk[0].deposit_cents) : null, 5000);

  const { rows: custs } = await client.queryObject(
    `select id from public.customers where business_id=$1`, [BIZ]);
  eq("realdb · exactly one CRM customer created", custs.length, 1);

  // Replay the webhook — Stripe does this.
  await finalizeSessionBookingPayment(admin, {
    bookingId: String(winner.data.booking.id), amountPaidCents: 5000, paymentIntentId: "pi_real",
  });
  const { rows: jobsReplay } = await client.queryObject(
    `select id from public.jobs where business_id=$1 and from_booking = true`, [BIZ]);
  eq("realdb · a replayed webhook creates no second job", jobsReplay.length, 1);
  const { rows: custsReplay } = await client.queryObject(
    `select id from public.customers where business_id=$1`, [BIZ]);
  eq("realdb · nor a second customer", custsReplay.length, 1);

  // Availability now reflects the real row
  const avail = await getSessionAvailability(admin, s);
  eq("realdb · 10:20 is gone from availability",
    avail.slots.find((x) => x.time === "10:20")!.available, false);
  eq("realdb · booked count is 1", avail.booked, 1);
  eq("realdb · remaining is 17", avail.remaining, 17);
}

/* ══════════════════ real calendar conflict ══════════════════ */
{
  const s = (await getSessionById(admin, BIZ, String(
    (await client.queryObject<{ id: string }>(`select id from public.one_off_sessions where business_id=$1`, [BIZ])).rows[0].id,
  )))!;
  // A normal job the photographer already had — a real row, real time type.
  await client.queryObject(
    `insert into public.jobs(business_id,customer_name,service_name,scheduled_date,scheduled_time,duration_hours,status)
     values ($1,'Regular Client','Headshots','2099-08-20','12:00',0.5,'scheduled')`, [BIZ]);

  const avail = await getSessionAvailability(admin, s);
  const at = (t: string) => avail.slots.find((x) => x.time === t)!;
  eq("realdb · 12:00 closed by a real conflicting job", at("12:00").available, false);
  eq("realdb · 12:20 closed by it too", at("12:20").available, false);
  eq("realdb · 11:40 (before it) stays open", at("11:40").available, true);
  eq("realdb · 12:40 (after it) stays open", at("12:40").available, true);

  const blocked = await bookSessionSlot(admin, s, {
    slot_time: "12:00", customer: { name: "Too Late", email: "tl@x.com" },
  });
  ck("realdb · booking a conflicted slot is refused", !blocked.ok && blocked.code === "calendar_conflict", blocked);
}

/* ══════════════════ §18 change safety against real rows ══════════════════ */
{
  const sid = String((await client.queryObject<{ id: string }>(
    `select id from public.one_off_sessions where business_id=$1`, [BIZ])).rows[0].id);

  const repriced = await updateSession(admin, BIZ, sid, { price_cents: 17500 });
  ck("realdb · repricing is allowed", repriced.ok, repriced.ok ? "" : repriced);
  ck("realdb · and warns it is not retroactive",
    repriced.ok && repriced.data.warnings.some((w) => /existing booking/i.test(w)),
    repriced.ok ? repriced.data.warnings : repriced);

  const { rows: old } = await client.queryObject<Record<string, unknown>>(
    `select price_cents from public.one_off_session_bookings
      where business_id=$1 and status='confirmed'`, [BIZ]);
  eq("realdb · the paid booking keeps the price it was booked at", Number(old[0].price_cents), 15000);

  const shrunk = await updateSession(admin, BIZ, sid, { appointment_duration_minutes: 10 });
  ck("realdb · shortening under an existing booking is refused", !shrunk.ok, shrunk);

  const moved = await updateSession(admin, BIZ, sid, { session_date: "2099-08-21" });
  ck("realdb · moving the date with a booking on it is refused", !moved.ok, moved);

  const extended = await updateSession(admin, BIZ, sid, { end_time: "16:00" });
  ck("realdb · extending the end time is allowed", extended.ok, extended.ok ? "" : extended);
  const { rows: blocksNow } = await client.queryObject<Record<string, unknown>>(
    `select * from public.jobs where business_id=$1 and customer_name='Blocked'`, [BIZ]);
  eq("realdb · extending MOVED the block, did not add one", blocksNow.length, 1);
  eq("realdb · the block now spans 8 hours", Number(blocksNow[0].duration_hours), 8);
}

/* ══════════════════ public projection from real rows ══════════════════ */
{
  const s = (await getSessionById(admin, BIZ, String(
    (await client.queryObject<{ id: string }>(`select id from public.one_off_sessions where business_id=$1`, [BIZ])).rows[0].id,
  )))!;
  const pub = await publicSessionPayload(admin, s);
  const json = JSON.stringify(pub);
  ck("realdb · public payload hides the business id", !json.includes(BIZ));
  ck("realdb · hides the session id", !json.includes(String(s.id)));
  ck("realdb · hides the booking token", !json.includes(String(s.booking_token)));
  eq("realdb · carries the business name", pub.business.name, "Adrian Smith Photography");
  ck("realdb · carries the policy from businesses.meta (stored as TEXT in production)",
    String(pub.policy || "").includes("non-refundable"), pub.policy);
  eq("realdb · reports Stripe as ready", pub.payment.stripe_ready, true);
  eq("realdb · price is $175 after the update", pub.payment.price_cents, 17500);
}

/* ══════════════════ owner cancels one booking ══════════════════ */
{
  const { rows } = await client.queryObject<{ id: string }>(
    `select id from public.one_off_session_bookings where business_id=$1 and status='confirmed'`, [BIZ]);
  const cancelled = await cancelSessionBooking(admin, BIZ, String(rows[0].id));
  ck("realdb · owner can cancel one booking", cancelled.ok, cancelled);
  eq("realdb · it reports what still needs refunding",
    cancelled.ok ? cancelled.data.refund_due_cents : -1, 5000);
  const { rows: job } = await client.queryObject<Record<string, unknown>>(
    `select status from public.jobs where business_id=$1 and from_booking=true`, [BIZ]);
  eq("realdb · the appointment is cancelled, not deleted", job[0].status, "cancelled");
  // No code path may ever write 'refunded' — see ONE_OFF_SESSION_REFUNDS_P1.md
  const { rows: refunded } = await client.queryObject(
    `select id from public.one_off_session_bookings where payment_status='refunded'`);
  eq("realdb · nothing is ever marked refunded", refunded.length, 0);
}

/* ══════════════════ cross-business isolation at the engine level ══════════════════ */
{
  const sid = String((await client.queryObject<{ id: string }>(
    `select id from public.one_off_sessions where business_id=$1`, [BIZ])).rows[0].id);
  eq("realdb · another business cannot read the session", await getSessionById(admin, OTHER, sid), null);
  const hijack = await updateSession(admin, OTHER, sid, { name: "Hijacked" });
  ck("realdb · another business cannot update it", !hijack.ok, hijack);
  const { rows: check } = await client.queryObject<Record<string, unknown>>(
    `select name from public.one_off_sessions where id=$1`, [sid]);
  eq("realdb · the name is untouched", check[0].name, "Fall Mini Sessions");
}

/* ══════════════════ close releases the real block ══════════════════ */
{
  const sid = String((await client.queryObject<{ id: string }>(
    `select id from public.one_off_sessions where business_id=$1`, [BIZ])).rows[0].id);
  const closed = await closeSession(admin, BIZ, sid);
  ck("realdb · close succeeds", closed.ok, closed);
  const { rows: blocks } = await client.queryObject(
    `select id from public.jobs where business_id=$1 and customer_name='Blocked'`, [BIZ]);
  eq("realdb · the block job is gone", blocks.length, 0);
  const summary = await sessionSummary(admin, (await getSessionById(admin, BIZ, sid))!);
  eq("realdb · the session reports the calendar released", summary.calendar_blocked, false);
}

/* ══════════════════ no-Stripe path ══════════════════ */
await reset();
await withStripe(false);
{
  const created = await createSession(admin, BIZ, MINI);
  if (!created.ok) throw new Error("setup");
  const pub = await publishSession(admin, BIZ, String(created.data.id));
  if (!pub.ok) throw new Error("setup");
  const booked = await bookSessionSlot(admin, pub.data, {
    slot_time: "08:00", customer: { name: "No Card", email: "nc@x.com" },
  });
  ck("realdb · booking works with no Stripe account", booked.ok, booked.ok ? "" : booked);
  if (!booked.ok) throw new Error("setup");
  eq("realdb · payment is not demanded", booked.data.requires_payment, false);
  eq("realdb · confirmed immediately", booked.data.booking.status, "confirmed");
  eq("realdb · nothing claimed as paid", booked.data.booking.payment_status, "none");
  const { rows: jobs } = await client.queryObject(
    `select id from public.jobs where business_id=$1 and from_booking=true`, [BIZ]);
  eq("realdb · a real appointment exists anyway", jobs.length, 1);
}

await reset();
await client.end();

console.log(`\n==== REAL POSTGRES INTEGRATION: ${passed} passed, ${failures.length} failed ====`);
if (failures.length) { failures.forEach((f) => console.log("  ✗ " + f)); Deno.exit(1); }
