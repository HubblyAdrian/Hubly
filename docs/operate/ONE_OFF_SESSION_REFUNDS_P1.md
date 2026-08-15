# P1 — One-Off Session Refund Pipeline (NOT BUILT)

**Status:** not implemented. This document exists so nothing in the product,
the UI, or the AI ever implies otherwise.

---

## What is true today

Hubly can **take** money for a One-Off Session (Stripe Connect destination
charge, confirmed by webhook). Hubly **cannot refund it**. There is no refund
pipeline for booking payments anywhere in the platform — `stripe-webhook`
handles `charge.refunded` only for `commerce_orders`, and nothing calls Stripe's
refund API for a booking.

Every code path is written to be honest about that:

| Where | What it does |
|---|---|
| `cancelSession()` | cancels bookings + appointments, releases the calendar. Issues **no** refund and sets **no** `refunded` status. |
| `cancelSessionBooking()` | returns `refund_due_cents` — what a human still owes the customer. Never claims it was paid back. |
| Provider UI | the cancel dialog says the amount "was already paid — Hubly cannot refund it automatically, so you'll need to refund it in Stripe", and afterwards shows "$X still needs refunding in Stripe — Hubly did not refund it." |
| AI (`cancel`, `cancelBooking`) | summaries state plainly that no refund was issued and it has to be done in Stripe. |
| `finalizeSessionBookingPayment()` | a payment that lands on an already-cancelled booking is **recorded** (`payment_status: 'paid'`, real amount, real payment intent) and logged as needing a manual refund — never silently discarded, so the money is always visible. |

`payment_status: 'refunded'` exists in the schema's CHECK constraint and is
**never written by any code path**. It is reserved for this work.

---

## Rules until this is built

1. Never tell a customer a refund is coming.
2. Never set `payment_status = 'refunded'`.
3. Never zero out `amount_paid_cents` — the payment record must stay accurate.
4. Always surface `refund_due_cents` so a human can act on it.

---

## What the real pipeline needs

**Money**
- Full refund and partial refund via Stripe's refund API against
  `stripe_payment_intent_id`, on the connected account (destination charges mean
  the refund must reverse the transfer too — `reverse_transfer` /
  `refund_application_fee`).
- Deposit-only refund as a distinct case (refund the deposit, keep nothing else).
- Idempotency keys so a retried cancel cannot refund twice.

**Policy**
- A per-session cancellation policy (e.g. non-refundable inside 48 hours),
  stored on `one_off_sessions` and evaluated server-side — never by the AI.
- The policy must be shown on the public session page *before* payment. There is
  already a `policy` field in `publicSessionPayload`, currently sourced from
  `businesses.meta.cancellationPolicy`.

**State**
- `one_off_session_bookings`: `refunded_cents`, `refunded_at`,
  `stripe_refund_id`; `payment_status` gains real use of `refunded` plus a
  `partially_refunded` value (schema CHECK constraint must be widened by a
  migration).
- Reconciliation from `charge.refunded` / `refund.updated` webhooks, including
  refunds initiated directly in the Stripe dashboard — so a refund a human does
  by hand flows back into Hubly instead of leaving the two out of sync.

**People**
- Customer notification on refund (reuse `booking_notifications.ts`).
- Provider-side visibility: which bookings are owed money, and how much.

**Who can**
- Owner-only, ownership-checked exactly like every other session action. The AI
  may *report* a refund is owed; issuing one should require an explicit,
  confirmed owner action, not a conversational instruction.

---

## Why it was not built now

A refund pipeline that is wrong is worse than none: it can double-refund, refund
the wrong amount, mark money returned that never left, or leave Hubly and Stripe
permanently disagreeing. Building a fake one to make the UI look complete would
have violated the one rule this feature is otherwise strict about — that the
backend is authoritative and the product never claims something happened when it
didn't.
