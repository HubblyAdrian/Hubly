# One-Off Sessions

**Status:** shipped (Phases 1–7)
**Internal name:** One-Off Session. **UI label:** Sessions.

> A One-Off Session is a **temporary booking campaign**, not a second booking system.
> It is a thin layer over engines Hubly already has.

---

## Philosophy

A **Service** is what a business permanently sells. A **Session** is one specific
date they open up — a photographer's mini sessions, a detailer's wash day, a lawn
crew's neighborhood service day, a spa's express day.

Sessions are **private by default**. Creating one must never change a business's
normal booking page, service catalog, public discovery, or AI recommendations.
The only way in is the link the owner shares.

The core primitive is **industry-agnostic**. Blueprints influence *wording*
(`SESSION_TERMINOLOGY` in `one_off_session_core.mjs`); nothing in the engine
branches on business type.

---

## What is reused (and what is new)

| Concern | Reused from | New here |
|---|---|---|
| Service catalog | Service Engine (`businesses.meta.service_catalog`) | optional `service_id` reference — a session never becomes a Service |
| The customer's appointment | `jobs` (same table the calendar/Reports/GCal read) | `jobs.one_off_session_id` link column |
| **Calendar block** | a `jobs` row with `customer_name='Blocked'` — the exact primitive the app's own *Block time* button writes | `calendar_block_job_id` on the session |
| Normal-booking availability | `get_busy_windows` RPC + `jobBlocks()` in `marketplace_availability.ts` | **nothing** — both already read `jobs` |
| Google Calendar | `syncEnginePushCreate/Update/Delete` | one event for the block, one per booked appointment |
| Payments | `create-booking-checkout` → `createDestinationCheckout` → `stripe-webhook` | one metadata key: `hubly_one_off_session_booking_id` |
| Customer identity | `resolveOrCreateCrmCustomer` (phone → email → name) | — |
| Confirmation email | `notifyBookingCreated` (Resend) + portal magic link | — |
| Standalone customer page | the `/portal` pattern (route + static page + gateway function) | `/session/<token>` → `session.html` |
| AI | Hubly Capability Registry + `hubly-conversation` dispatch | `sessions` capability |

---

## Architecture

```
Business
├── Permanent Services        (Service Engine — untouched)
├── Normal Bookings           (jobs / booking_requests / marketplace_bookings)
├── Customers                 (customers — shared resolver)
├── Calendar                  (jobs + google_calendar_events)
└── One-Off Sessions
      ├── one_off_sessions            configuration + lifecycle + opaque token
      ├── one_off_session_bookings    one seat, one customer, one payment
      ├── calendar block              ONE jobs row (customer_name='Blocked')
      └── /session/<token>            the private booking page
```

### The calendar-block insight

This is the load-bearing design decision. A "blocked time" in Hubly is already
just a `jobs` row named `Blocked` (see `submitBlockTime` in `public/hubly.html`,
and `isBlock: j.customer_name==='Blocked'` on the read side). Both availability
paths — the website booking wizard's `get_busy_windows` RPC and the marketplace
engine's `jobBlocks()` — read `jobs`.

So publishing a session writes **one ordinary block job** for 8 AM–2 PM, and the
window disappears from normal booking **with zero changes to any availability
code**. Nothing is special-cased in the UI.

Session slots inside that window are unaffected, because session availability is
its own derived grid over its own bookings and deliberately skips jobs whose
`one_off_session_id` is this session (`loadSessionDayConflicts`). The block is
the *parent* of these appointments, not a conflict with them. Other real
conflicts on that date **do** close the overlapping slots.

---

## Files

| File | Role |
|---|---|
| `supabase/migrations/20260815120000_one_off_sessions.sql` | tables, constraints, RLS, `jobs.one_off_session_id` |
| `supabase/functions/_shared/one_off_session_core.mjs` | **pure** logic — slots, deposits, validation, lifecycle, seats. Imported by Deno *and* the Node tests, so tests run production code |
| `supabase/functions/_shared/one_off_session_engine.ts` | the only writer: lifecycle, calendar block, seat reservation, payment finalize |
| `supabase/functions/one-off-sessions/index.ts` | API — public (token) half and owner (JWT) half |
| `public/session.html` | the customer booking page |
| `public/journey-os/one-off-sessions.js` | the owner Sessions surface |
| `supabase/functions/_shared/hubly_capability_registry.ts` | the `sessions` AI capability |
| `tests/support/fake_supabase.ts` | in-memory DB that enforces the migration's constraints, so the engine can be tested for real |
| `tests/support/emit_fixtures.ts` | emits real engine payloads for the browser tests |

---

## Lifecycle

```
draft ──publish──► published ──┬──► sold_out ──┬──► closed ──► (republish)
  │                            │               │
  └──────────────► cancelled ◄─┴───────────────┴──► completed
```

* **draft** — not bookable, not reachable even with the link, holds no calendar time.
* **published** — bookable; the calendar block exists.
* **sold_out** — reconciled automatically after every booking; flips back if a seat frees.
* **closed** — no new bookings; **existing appointments are kept**; the unsold window is released back to normal booking.
* **cancelled** — every booking cancelled, appointments marked cancelled, window released. **No automatic refunds** (see Refunds below).
* Sessions are never deleted.

A **single booking** can also be cancelled on its own (`cancelSessionBooking`):
the seat returns to the grid, that customer's appointment is marked cancelled
(never deleted), and the session leaves `sold_out` if that seat was why it was
full.

### Changing a session that already has bookings (§18)

`assessSessionChange` in the core decides, and the API, the provider UI and the
AI all get the same answer. **Refused** (would break a real appointment):
moving the date; narrowing the window past a booking; shortening appointments
below an existing booking's length (which is what would let a new booking be
sold on top of a real one); dropping capacity below seats already handed out.
**Allowed with a warning the caller must surface**: repricing (never
retroactive — each booking keeps the price it was booked at) and moving the
location (already-booked customers are not notified automatically).

---

## Concurrency

Each booking holds a numbered **seat** at a slot:

```sql
create unique index one_off_session_bookings_seat_uniq
  on one_off_session_bookings(session_id, slot_time, seat_no)
  where status <> 'cancelled';
```

`bookSessionSlot` reads the taken seats, tries the lowest free one, and lets
Postgres reject the loser of a race (`23505`), then retries. Two customers
clicking the same capacity-1 slot at the same instant cannot both win. Cancelling
frees the seat back into the grid.

---

## Payments

Integer cents, `usd`, Stripe Connect destination charges — the same path every
other Hubly booking payment takes.

| Mode | Charged today |
|---|---|
| `none` | nothing |
| `deposit` + `flat` | `deposit_cents` |
| `deposit` + `percentage` | `round(price × pct/100)` |
| `full` | `price_cents` |

Clamped to `[0, price]`, and never opened below Stripe's 50¢ floor.

A booking that requires payment is created `pending_payment` / `pending`. It
becomes `confirmed` / `paid` **only** in `stripe-webhook`
(`checkout.session.completed` → `finalizeSessionBookingPayment`), which is
idempotent. The customer's success screen polls `public_booking_status` and says
so honestly if the webhook hasn't landed. `checkout.session.expired` releases the
held seat.

---

## Privacy

* `booking_token` is 192 bits of `crypto.getRandomValues`, base64url — never derived from any id.
* No anon RLS policy exists on either table. Public access goes only through the Edge Function, which resolves the token server-side.
* `publicSessionPayload` returns business branding, session facts, prices, and the slot grid — no business id, no session id, no token, no other customers.
* Checkout is opened server-side (`public_checkout`) so the page never learns the business id.
* `/session/*` is served `private, no-store` + `X-Robots-Tag: noindex, nofollow`.
* Draft sessions 404 even for someone holding the link.

---

## Website promotion

The storefront's `promoBanner` block gained a closed link-target list
(`PROMO_LINK_TYPES`), including `oneOffSession`. The banner stores **only the
session id** — never a copied date, price, or URL.

`store-page.js` resolves promoted sessions through the public
`public_promotions` action (which returns only sessions the owner explicitly
promoted, so it can't enumerate a business) and renders the CTA from live state:

| Session | Banner |
|---|---|
| published | link → `/session/<token>`, "Book Your Session" |
| sold_out | no link, "Sold Out" |
| closed / completed / cancelled | no link, "No longer available" |

A stale "Book Now" is structurally impossible.

---

## AI

Capability `sessions`, allow-listed in the `operate` conversation context, with
the verified `businessId` and owner token injected by the engine (never seen by
the model). Actions: `create · list · get · update · configurePayment · publish ·
close · cancel · getBookingLink · listBookings · cancelBooking ·
addWebsitePromotion · removeWebsitePromotion`.

**"Put it on my website" is one action.** `addWebsitePromotion` authorizes the
promotion *and* places a real `promoBanner` in the storefront layout, returning
it through the same `storefrontAst` channel `storefront.patchStorefront` already
uses — so the browser persists it exactly as it does a storefront edit, and no
second writer for `businesses.meta.storefront` is introduced.

Rules the handlers enforce by construction:

* `create` always produces a **draft** — publishing is a separate, explicitly-confirmed step.
* Required args are only what genuinely can't be inferred: name, date, start, end, duration. Location and deposit are optional, so the AI doesn't interrogate someone who already said everything.
* **The backend is authoritative.** Every §17 rule lives in `validateSessionDraft` and in SQL check constraints; the AI only relays the resulting message.
* Nothing structural (`status`, `booking_token`, `business_id`, `calendar_block_job_id`) is in `WRITABLE_FIELDS`, so no arg can set it.

---

## Refunds

**Not built.** Hubly can take money for a session but cannot refund it. See
[ONE_OFF_SESSION_REFUNDS_P1.md](./ONE_OFF_SESSION_REFUNDS_P1.md) — every path
(cancel session, cancel booking, AI summaries, the provider UI) states this
plainly and reports `refund_due_cents` rather than implying money moved.
`payment_status = 'refunded'` is reserved and never written.

## Tests

Three suites, run with `npm run test:sessions`, `test:sessions:engine`,
`test:sessions:ui`.

**`tests/one_off_sessions_engine.integration.ts` — 139 assertions.** Runs the
REAL engine (and the Google Calendar sync engine, CRM resolver, portal tokens
and notifications it imports) against an in-memory database that enforces the
migration's own constraints, including the partial unique index. Covers
creation, privacy and cross-business isolation, calendar blocking, existing
calendar conflicts, concurrency, payment + webhook idempotency, the Stripe-off
and Google-off paths, modification safety, sold-out reconciliation, and edge
cases.

**`tests/one_off_sessions_ui.mjs` — 99 assertions.** Drives the real pages in
Chromium against fixtures emitted by the real engine: the customer booking page
(desktop + 360px mobile, hierarchy, disabled slots, validation, form-state
retention, checkout hand-off), the storefront promo banner in all three session
states, and the provider surface (list, detail sections, edit, per-booking
cancel).

**`tests/one-off-sessions.test.mjs` — 87 assertions. The behavioral half imports
`one_off_session_core.mjs` directly, so slot generation (8–2 @ 20min = 18 slots,
8:00 … 1:40), deposit math, validation, seat allocation, conflict windows and
lifecycle transitions are exercised against production code, not a copy. The
wiring half proves the SQL constraints, the unique index, ownership checks, the
public/owner action split, webhook routing and idempotency, the route, catalog
lockstep, and that the Service Engine / Booking Engine / website booking path
were not modified.
