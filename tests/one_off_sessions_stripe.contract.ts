/**
 * One-Off Sessions — Stripe contract proof.
 *
 * Production Stripe is LIVE, so a real payment test is forbidden until a
 * `sk_test_` staging environment exists. This proves everything about the Stripe
 * integration that does NOT require Stripe to answer:
 *
 *   * the exact HTTP request Hubly would send to api.stripe.com — amount,
 *     currency, connected account, metadata, expiry — captured off the wire,
 *   * that the amount is derived from the stored session and cannot be
 *     influenced by anything a browser sends,
 *   * real webhook signature verification (valid, tampered, replayed, stale),
 *   * the full confirm path against a REAL database.
 *
 * No network call is made and no money can move: `fetch` is intercepted, and the
 * key used is a fake `sk_test_` value.
 *
 * What it does NOT prove: that Stripe itself renders $50 and fires the webhook.
 * That needs a real test-mode key. Everything on Hubly's side of the boundary is
 * proven here.
 *
 * Run:
 *   deno run --allow-env --allow-net --allow-read --no-check \
 *     tests/one_off_sessions_stripe.contract.ts
 */

import { connect, pgSupabaseClient } from "./support/pg_supabase_adapter.ts";
import {
  createDestinationCheckout,
  verifyStripeWebhook,
} from "../supabase/functions/_shared/stripe.ts";
import { resolveSessionPayment } from "../supabase/functions/_shared/one_off_session_core.mjs";
import {
  bookSessionSlot,
  createSession,
  finalizeSessionBookingPayment,
  getSessionAvailability,
  getSessionById,
  publishSession,
  releaseAbandonedSessionBooking,
} from "../supabase/functions/_shared/one_off_session_engine.ts";

const DB = Deno.env.get("STAGING_DB_URL") ||
  "postgresql://postgres@127.0.0.1:55432/hubly_staging";
const BIZ = "e0000000-0000-4000-8000-000000000001";
const OWNER = "e0000000-0000-4000-8000-0000000000aa";
const WEBHOOK_SECRET = "whsec_test_contract_secret";

let passed = 0;
const failures: string[] = [];
const ck = (n: string, c: boolean, d?: unknown) => {
  if (c) { passed++; console.log("PASS · " + n); }
  else { failures.push(n); console.log("FAIL · " + n + (d !== undefined ? "  [" + JSON.stringify(d) + "]" : "")); }
};
const eq = (n: string, a: unknown, b: unknown) =>
  ck(n, JSON.stringify(a) === JSON.stringify(b), { actual: a, expected: b });

/* ── intercept every outbound request; nothing reaches the network ── */
type Captured = { url: string; method: string; form: URLSearchParams; auth: string };
const sent: Captured[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.stripe.com")) {
    const body = String(init?.body || "");
    sent.push({
      url,
      method: init?.method || "GET",
      form: new URLSearchParams(body),
      auth: String((init?.headers as Record<string, string>)?.Authorization || ""),
    });
    return new Response(
      JSON.stringify({
        id: "cs_test_contract_" + sent.length,
        url: "https://checkout.stripe.com/c/pay/cs_test_contract",
        status: "open",
        payment_status: "unpaid",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  // Anything else (Resend, Google) is not part of this contract — swallow it.
  if (url.startsWith("https://api.resend.com") || url.includes("googleapis.com")) {
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(input as never, init);
}) as typeof fetch;

/* ── a real session + booking in a real database ── */
const client = await connect(DB);
const admin = pgSupabaseClient(client);

for (const t of ["one_off_session_bookings", "one_off_sessions", "jobs", "customers"]) {
  await client.queryObject(`delete from public.${t} where business_id = $1`, [BIZ]);
}
await client.queryObject(`delete from public.stripe_connect_accounts where business_id = $1`, [BIZ]);
await client.queryObject(`delete from public.businesses where id = $1`, [BIZ]);
await client.queryObject(
  `insert into auth.users(id,email) values ($1,'stripe-contract@example.com') on conflict (id) do nothing`, [OWNER]);
await client.queryObject(
  `insert into public.businesses(id,owner_id,name,slug,email,business_type,meta)
   values ($1,$2,'Test Photography Business','stripe-contract-biz','studio@example.com','photography','{}')`,
  [BIZ, OWNER]);
await client.queryObject(
  `insert into public.stripe_connect_accounts(business_id,stripe_account_id,charges_enabled,details_submitted)
   values ($1,'acct_1TestConnected',true,true)`, [BIZ]);

const created = await createSession(admin, BIZ, {
  name: "Fall Mini Sessions",
  session_date: "2099-08-20",
  start_time: "08:00",
  end_time: "14:00",
  appointment_duration_minutes: 20,
  location: "Test Location",
  price_cents: 15000,
  payment_mode: "deposit",
  deposit_type: "flat",
  deposit_cents: 5000,
  timezone: "America/Denver",
});
if (!created.ok) throw new Error(created.error);
const pub = await publishSession(admin, BIZ, String(created.data.id));
if (!pub.ok) throw new Error(pub.error);
const session = pub.data;

const booked = await bookSessionSlot(admin, session, {
  slot_time: "10:20",
  customer: { name: "Test Customer", email: "customer@example.com", phone: "801-555-0123" },
});
if (!booked.ok) throw new Error(booked.error);
const bookingId = String(booked.data.booking.id);

eq("setup · booking is pending payment", booked.data.booking.status, "pending_payment");
eq("setup · Hubly says $50 is due", booked.data.payment.charge_now_cents, 5000);

/* ══════════════════ the exact request Hubly sends Stripe ══════════════════ */
{
  // Derived the same way create-booking-checkout's session branch derives it:
  // from the STORED session row, through the shared resolver.
  const { rows: [row] } = await client.queryObject<Record<string, unknown>>(
    `select * from public.one_off_sessions where id = $1`, [session.id]);
  const payment = resolveSessionPayment(row);
  const { rows: [conn] } = await client.queryObject<Record<string, unknown>>(
    `select * from public.stripe_connect_accounts where business_id = $1`, [BIZ]);

  Deno.env.set("STRIPE_SECRET_KEY", "sk_test_contract_fake");
  sent.length = 0;

  const out = await createDestinationCheckout({
    connectedAccountId: String(conn.stripe_account_id),
    amountCents: payment.charge_now_cents,
    currency: payment.currency,
    productName: `Deposit — ${row.name} (Test Photography Business)`,
    successUrl: "https://stripe-contract-biz.myhubly.app/session/tok",
    cancelUrl: "https://stripe-contract-biz.myhubly.app/session/tok",
    customerEmail: "customer@example.com",
    expiresAt: Math.floor(Date.now() / 1000) + 30 * 60,
    metadata: {
      hubly_business_id: BIZ,
      hubly_one_off_session_booking_id: bookingId,
      hubly_one_off_session_id: String(session.id),
      hubly_charge_kind: "deposit",
    },
  });

  eq("wire · exactly one request was made", sent.length, 1);
  const req = sent[0];
  eq("wire · it goes to the Checkout Sessions endpoint", req.url, "https://api.stripe.com/v1/checkout/sessions");
  eq("wire · method", req.method, "POST");
  ck("wire · uses the configured secret key", req.auth === "Bearer sk_test_contract_fake", req.auth.slice(0, 12));

  // THE number that matters.
  eq("wire · charges exactly 5000 cents ($50)", req.form.get("line_items[0][price_data][unit_amount]"), "5000");
  eq("wire · currency is usd", req.form.get("line_items[0][price_data][currency]"), "usd");
  eq("wire · quantity is 1", req.form.get("line_items[0][quantity]"), "1");
  eq("wire · it is a one-off payment, not a subscription", req.form.get("mode"), "payment");
  ck("wire · the customer sees it is a deposit",
    String(req.form.get("line_items[0][price_data][product_data][name]")).startsWith("Deposit — Fall Mini Sessions"),
    req.form.get("line_items[0][price_data][product_data][name]"));

  // Connect: the money must land on the BUSINESS's account.
  eq("connect · funds are routed to the connected account",
    req.form.get("payment_intent_data[transfer_data][destination]"), "acct_1TestConnected");
  eq("connect · no platform fee is taken when none is configured",
    req.form.get("payment_intent_data[application_fee_amount]"), null);

  // Metadata is what the webhook keys on — if this is wrong, payments orphan.
  eq("metadata · carries the booking id", req.form.get("metadata[hubly_one_off_session_booking_id]"), bookingId);
  eq("metadata · carries the session id", req.form.get("metadata[hubly_one_off_session_id]"), String(session.id));
  eq("metadata · carries the business id", req.form.get("metadata[hubly_business_id]"), BIZ);
  eq("metadata · charge kind is deposit", req.form.get("metadata[hubly_charge_kind]"), "deposit");
  eq("metadata · is mirrored onto the PaymentIntent (survives to charge.* events)",
    req.form.get("payment_intent_data[metadata][hubly_one_off_session_booking_id]"), bookingId);

  // The seat is held while the customer pays — the hold must expire.
  const expires = Number(req.form.get("expires_at"));
  const mins = (expires - Math.floor(Date.now() / 1000)) / 60;
  ck("expiry · the checkout expires in ~30 minutes so the seat is released", mins > 25 && mins <= 31, mins);

  // Return URLs come back to the private session page, carrying the booking id.
  ck("return · success returns to the session page", String(req.form.get("success_url")).includes("/session/"));
  ck("return · cancel returns to the session page", String(req.form.get("cancel_url")).includes("/session/"));

  ck("wire · a checkout URL is handed back", String(out.url).startsWith("https://checkout.stripe.com/"), out.url);
}

/* ══════════════════ the amount cannot be influenced by the client ══════════════════ */
{
  // The public page only ever sends a token + booking id. Prove the amount is a
  // pure function of the stored row, whatever anyone claims.
  const { rows: [row] } = await client.queryObject<Record<string, unknown>>(
    `select * from public.one_off_sessions where id = $1`, [session.id]);
  const honest = resolveSessionPayment(row);
  const tampered = resolveSessionPayment({ ...row, amount_cents: 1, amount_dollars: 0.01, charge_now_cents: 1 });
  eq("security · injecting amount fields changes nothing", tampered.charge_now_cents, honest.charge_now_cents);
  eq("security · the amount is still $50", tampered.charge_now_cents, 5000);

  // And a deposit larger than the price can never overcharge.
  const absurd = resolveSessionPayment({ ...row, deposit_cents: 999999 });
  eq("security · an absurd deposit is clamped to the price", absurd.charge_now_cents, 15000);
}

/* ══════════════════ webhook signature verification ══════════════════ */
async function signed(body: string, secret = WEBHOOK_SECRET, at = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${at}.${body}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${at},v1=${hex}`;
}

const completedEvent = JSON.stringify({
  id: "evt_test_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_contract_1",
      payment_status: "paid",
      amount_total: 5000,
      currency: "usd",
      payment_intent: "pi_test_contract",
      metadata: {
        hubly_business_id: BIZ,
        hubly_one_off_session_booking_id: bookingId,
        hubly_one_off_session_id: String(session.id),
        hubly_charge_kind: "deposit",
      },
    },
  },
});

{
  const good = await verifyStripeWebhook(completedEvent, await signed(completedEvent), WEBHOOK_SECRET);
  eq("webhook · a correctly signed event is accepted", good.type, "checkout.session.completed");

  let rejected = false;
  try {
    await verifyStripeWebhook(completedEvent, await signed(completedEvent, "whsec_wrong"), WEBHOOK_SECRET);
  } catch { rejected = true; }
  ck("webhook · an event signed with the WRONG secret is rejected", rejected);

  rejected = false;
  try {
    const sig = await signed(completedEvent);
    await verifyStripeWebhook(completedEvent.replace('"amount_total":5000', '"amount_total":1'), sig, WEBHOOK_SECRET);
  } catch { rejected = true; }
  ck("webhook · a TAMPERED body is rejected", rejected);

  rejected = false;
  try {
    const stale = Math.floor(Date.now() / 1000) - 60 * 60;
    await verifyStripeWebhook(completedEvent, await signed(completedEvent, WEBHOOK_SECRET, stale), WEBHOOK_SECRET);
  } catch { rejected = true; }
  ck("webhook · a REPLAYED (stale) event is rejected", rejected);

  rejected = false;
  try { await verifyStripeWebhook(completedEvent, null, WEBHOOK_SECRET); } catch { rejected = true; }
  ck("webhook · an unsigned event is rejected", rejected);
}

/* ══════════════════ the confirm path, against the real database ══════════════════ */
{
  const before = await client.queryObject(
    `select id from public.jobs where business_id=$1 and from_booking=true`, [BIZ]);
  eq("confirm · no appointment exists before the webhook", before.rows.length, 0);

  const evt = await verifyStripeWebhook(completedEvent, await signed(completedEvent), WEBHOOK_SECRET);
  const obj = evt.data.object as Record<string, unknown>;
  const meta = obj.metadata as Record<string, string>;

  const fin = await finalizeSessionBookingPayment(admin, {
    bookingId: meta.hubly_one_off_session_booking_id,
    amountPaidCents: Number(obj.amount_total),
    paymentIntentId: String(obj.payment_intent),
    checkoutSessionId: String(obj.id),
  });
  ck("confirm · finalize succeeds", fin.ok, fin);

  const { rows: [bk] } = await client.queryObject<Record<string, unknown>>(
    `select * from public.one_off_session_bookings where id=$1`, [bookingId]);
  eq("confirm · booking is confirmed", bk.status, "confirmed");
  eq("confirm · payment is marked paid", bk.payment_status, "paid");
  eq("confirm · the real amount is recorded", Number(bk.amount_paid_cents), 5000);
  eq("confirm · the payment intent is recorded", bk.stripe_payment_intent_id, "pi_test_contract");

  const { rows: jobs } = await client.queryObject<Record<string, unknown>>(
    `select * from public.jobs where business_id=$1 and from_booking=true`, [BIZ]);
  eq("confirm · exactly one appointment is created", jobs.length, 1);
  ck("confirm · at the time the customer chose", String(jobs[0].scheduled_time).startsWith("10:20"), jobs[0].scheduled_time);

  // Stripe retries. Twice more, for good measure.
  await finalizeSessionBookingPayment(admin, {
    bookingId, amountPaidCents: 5000, paymentIntentId: "pi_test_contract", checkoutSessionId: "cs_test_contract_1",
  });
  await finalizeSessionBookingPayment(admin, {
    bookingId, amountPaidCents: 5000, paymentIntentId: "pi_test_contract", checkoutSessionId: "cs_test_contract_1",
  });
  const { rows: jobsAgain } = await client.queryObject(
    `select id from public.jobs where business_id=$1 and from_booking=true`, [BIZ]);
  eq("idempotency · a replayed webhook creates no second appointment", jobsAgain.length, 1);
  const { rows: custs } = await client.queryObject(
    `select id from public.customers where business_id=$1`, [BIZ]);
  eq("idempotency · nor a second customer", custs.length, 1);

  const avail = await getSessionAvailability(admin, (await getSessionById(admin, BIZ, String(session.id)))!);
  eq("confirm · 10:20 has left availability", avail.slots.find((s) => s.time === "10:20")!.available, false);
  eq("confirm · 17 of 18 remain", avail.remaining, 17);
}

/* ══════════════════ failure paths ══════════════════ */
{
  const s = (await getSessionById(admin, BIZ, String(session.id)))!;

  // An UNPAID completed session must never confirm anything.
  const unpaidBooking = await bookSessionSlot(admin, s, {
    slot_time: "11:00", customer: { name: "Declined Card", email: "declined@example.com" },
  });
  if (!unpaidBooking.ok) throw new Error("setup");
  const unpaidId = String(unpaidBooking.data.booking.id);
  const unpaidEvent = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: "cs_unpaid", payment_status: "unpaid", amount_total: 0,
      metadata: { hubly_one_off_session_booking_id: unpaidId } } },
  });
  const evt = await verifyStripeWebhook(unpaidEvent, await signed(unpaidEvent), WEBHOOK_SECRET);
  const status = String((evt.data.object as Record<string, unknown>).payment_status);
  // stripe-webhook only calls finalize when payment_status is paid/no_payment_required.
  ck("failure · an unpaid event does not qualify for finalize",
    !["paid", "no_payment_required"].includes(status), status);
  const { rows: [still] } = await client.queryObject<Record<string, unknown>>(
    `select status,payment_status from public.one_off_session_bookings where id=$1`, [unpaidId]);
  eq("failure · the booking stays pending", still.status, "pending_payment");
  eq("failure · and is not marked paid", still.payment_status, "pending");

  // Expired checkout → the seat goes back.
  await releaseAbandonedSessionBooking(admin, unpaidId);
  const { rows: [released] } = await client.queryObject<Record<string, unknown>>(
    `select status,payment_status from public.one_off_session_bookings where id=$1`, [unpaidId]);
  eq("expired · the booking is cancelled", released.status, "cancelled");
  eq("expired · payment is recorded as failed, never paid", released.payment_status, "failed");
  const avail = await getSessionAvailability(admin, (await getSessionById(admin, BIZ, String(session.id)))!);
  eq("expired · 11:00 is back on sale", avail.slots.find((x) => x.time === "11:00")!.available, true);

  // A released booking must not resurrect as a live one, but the money must still be recorded.
  const late = await finalizeSessionBookingPayment(admin, {
    bookingId: unpaidId, amountPaidCents: 5000, paymentIntentId: "pi_late_contract",
  });
  ck("released · a late payment is handled, not dropped", late.ok, late);
  const { rows: [after] } = await client.queryObject<Record<string, unknown>>(
    `select status,payment_status,amount_paid_cents from public.one_off_session_bookings where id=$1`, [unpaidId]);
  eq("released · it does NOT become an active booking", after.status, "cancelled");
  eq("released · but the payment IS recorded for refunding", after.payment_status, "paid");
  eq("released · with the real amount", Number(after.amount_paid_cents), 5000);
  const { rows: jobs } = await client.queryObject(
    `select id from public.jobs where business_id=$1 and from_booking=true`, [BIZ]);
  eq("released · and no appointment is created for it", jobs.length, 1);
}

/* ══════════════════ the live-key safety rail ══════════════════ */
{
  Deno.env.set("HUBLY_STRIPE_REQUIRE_TEST_MODE", "true");
  Deno.env.set("STRIPE_SECRET_KEY", "sk_live_would_be_a_real_charge");
  sent.length = 0;
  let refused = false;
  try {
    await createDestinationCheckout({
      connectedAccountId: "acct_1TestConnected", amountCents: 5000, productName: "x",
      successUrl: "https://x.myhubly.app/", cancelUrl: "https://x.myhubly.app/", metadata: {},
    });
  } catch { refused = true; }
  ck("safety · a LIVE key is refused when test mode is required", refused);
  eq("safety · and nothing was sent to Stripe", sent.length, 0);

  Deno.env.set("STRIPE_SECRET_KEY", "sk_test_contract_fake");
  let allowed = false;
  try {
    await createDestinationCheckout({
      connectedAccountId: "acct_1TestConnected", amountCents: 5000, productName: "x",
      successUrl: "https://x.myhubly.app/", cancelUrl: "https://x.myhubly.app/", metadata: {},
    });
    allowed = true;
  } catch { /* ignore */ }
  ck("safety · a TEST key is allowed through", allowed);
  Deno.env.delete("HUBLY_STRIPE_REQUIRE_TEST_MODE");
}

/* ── cleanup ── */
for (const t of ["one_off_session_bookings", "one_off_sessions", "jobs", "customers"]) {
  await client.queryObject(`delete from public.${t} where business_id = $1`, [BIZ]);
}
await client.queryObject(`delete from public.stripe_connect_accounts where business_id = $1`, [BIZ]);
await client.queryObject(`delete from public.businesses where id = $1`, [BIZ]);
await client.end();
globalThis.fetch = realFetch;

console.log(`\n==== STRIPE CONTRACT: ${passed} passed, ${failures.length} failed ====`);
console.log("     (no network call was made; no money can move)");
if (failures.length) { failures.forEach((f) => console.log("  ✗ " + f)); Deno.exit(1); }
