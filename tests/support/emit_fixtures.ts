/**
 * Emits the exact payloads the real engine produces, for the browser tests to
 * consume. This is what keeps the UI tests honest: the customer page and the
 * provider surface are rendered against genuine server output, not a
 * hand-written guess that could drift from the API.
 *
 * Run: deno run --allow-env --allow-net --allow-write --no-check tests/support/emit_fixtures.ts
 */
import { FakeDb, fakeClient } from "./fake_supabase.ts";
import {
  bookSessionSlot,
  createSession,
  finalizeSessionBookingPayment,
  publicSessionPayload,
  publishSession,
  sessionSummary,
} from "../../supabase/functions/_shared/one_off_session_engine.ts";

const BIZ = "biz-photographer";

const db = new FakeDb();
db.seed("businesses", [{
  id: BIZ,
  owner_id: "owner-1",
  name: "Adrian Smith Photography",
  slug: "adrian-photo",
  email: "studio@example.com",
  phone: "(801) 555-0100",
  business_type: "photography",
  brand_color: "#D9632D",
  logo_url:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='34'%3E%3Crect width='120' height='34' rx='6' fill='%23141B2B'/%3E%3Ctext x='60' y='23' text-anchor='middle' fill='%23fff' font-family='sans-serif' font-size='14'%3EASP%3C/text%3E%3C/svg%3E",
  meta: JSON.stringify({
    hours: {},
    service_catalog: { version: 1, services: [], addons: [] },
    cancellationPolicy: "Deposits are non-refundable within 48 hours of your session.",
  }),
}]);
db.seed("stripe_connect_accounts", [
  { business_id: BIZ, stripe_account_id: "acct_123", charges_enabled: true },
]);

const admin = fakeClient(db);

const created = await createSession(admin, BIZ, {
  name: "Fall Mini Sessions",
  description: "20-minute photography sessions in the gardens — bring the whole family.",
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
  booking_questions: [
    { id: "party", label: "How many people in your group?", type: "text", required: true },
    { id: "notes", label: "Anything we should know?", type: "textarea", required: false },
  ],
});
if (!created.ok) throw new Error(created.error);
const published = await publishSession(admin, BIZ, String(created.data.id));
if (!published.ok) throw new Error(published.error);

// Two real bookings so the customer page has genuinely unavailable slots.
await bookSessionSlot(admin, published.data, {
  slot_time: "08:20",
  customer: { name: "Sarah Chen", email: "sarah@example.com", phone: "801-555-0199" },
});
const marcus = await bookSessionSlot(admin, published.data, {
  slot_time: "09:00",
  customer: { name: "Marcus Webb", email: "marcus@example.com" },
});
// One of them actually paid, so the UI's "already paid / needs refunding in
// Stripe" path is exercised against a real paid booking rather than a guess.
if (marcus.ok) {
  await finalizeSessionBookingPayment(admin, {
    bookingId: String(marcus.data.booking.id),
    amountPaidCents: 5000,
    paymentIntentId: "pi_fixture",
    checkoutSessionId: "cs_fixture",
  });
}

const publicPayload = { ok: true, ...(await publicSessionPayload(admin, published.data)) };
const summary = await sessionSummary(admin, published.data);
const bookings = db.rows("one_off_session_bookings");

// A second session so the provider list has more than one row, and a draft so
// the draft/published distinction is visible in the UI.
const draft = await createSession(admin, BIZ, {
  name: "Holiday Mini Sessions",
  session_date: "2099-12-05",
  start_time: "10:00",
  end_time: "13:00",
  appointment_duration_minutes: 30,
  location: "Studio",
  price_cents: 20000,
  payment_mode: "none",
  timezone: "America/Denver",
});
if (!draft.ok) throw new Error(draft.error);
const draftSummary = await sessionSummary(admin, draft.data);

await Deno.writeTextFile(
  new URL("./fixtures.json", import.meta.url),
  JSON.stringify(
    {
      publicPayload,
      ownerList: { ok: true, sessions: [summary, draftSummary] },
      ownerGet: { ok: true, session: summary },
      ownerBookings: { ok: true, bookings },
      promotions: {
        active: {
          ok: true,
          sessions: [{
            id: String(summary.id),
            name: "Fall Mini Sessions",
            date: "2099-08-20",
            state: "active",
            cta: "Book Your Session",
            linkable: true,
            url: summary.booking_url,
          }],
        },
        sold_out: {
          ok: true,
          sessions: [{
            id: String(summary.id),
            name: "Fall Mini Sessions",
            date: "2099-08-20",
            state: "sold_out",
            cta: "Sold Out",
            linkable: false,
            url: null,
          }],
        },
        closed: {
          ok: true,
          sessions: [{
            id: String(summary.id),
            name: "Fall Mini Sessions",
            date: "2099-08-20",
            state: "closed",
            cta: "No longer available",
            linkable: false,
            url: null,
          }],
        },
      },
      sessionId: String(summary.id),
      bookingToken: String(summary.booking_token),
      bookingUrl: summary.booking_url,
    },
    null,
    2,
  ),
);
console.log("fixtures written · slots=" + summary.slot_count + " booked=" + summary.booked);
