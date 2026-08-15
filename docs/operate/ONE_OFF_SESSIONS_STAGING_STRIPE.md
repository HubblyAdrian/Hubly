# Staging Stripe (TEST MODE) — setup and status

**Production Stripe is LIVE** (confirmed from the dashboard: $1,177.48 succeeded,
$276.00 failed). No payment test may run against it, and none has.

---

## Phase 1 findings — the existing Stripe architecture

| Question | Answer |
|---|---|
| Does Hubly use Stripe Connect? | **Yes** — destination charges: `payment_intent_data[transfer_data][destination]`, optional `application_fee_amount`. |
| How are businesses connected? | **Express accounts** (`createExpressAccount`, `type: express`) + `account_onboarding` links. Stored in `stripe_connect_accounts`, unique per business AND per Stripe account. |
| Can staging use a separate Stripe environment? | **Yes, with zero code changes.** |
| Does the integration already support test mode? | **Yes.** `stripeKey()` reads `STRIPE_SECRET_KEY` per request; nothing branches on mode. `stripeLivemode()` is informational only (surfaced in Settings → Payments). Connect behaves identically in test mode. |
| What determines the mode? | **`STRIPE_SECRET_KEY`'s prefix, and nothing else.** Plus `STRIPE_WEBHOOK_SECRET` (must match the test endpoint) and optional `STRIPE_APPLICATION_FEE_PERCENT`. |
| Which functions depend on Stripe? | `create-booking-checkout`, `create-store-checkout`, `stripe-connect-onboard`, `stripe-connect-connection`, `stripe-webhook`. |

**Consequence:** Supabase secrets are per-project, so a staging project simply
gets `STRIPE_SECRET_KEY=sk_test_…` while production keeps its live key. The two
never meet, and no code changes.

Note: `stripeLivemode()` treats an unrecognised key shape as **live** — it fails
toward caution, which is the right default.

---

## New safety rail (this release)

There was no code-level protection against pointing a test at the live key — the
rule was procedural only. Now:

```
HUBLY_STRIPE_REQUIRE_TEST_MODE=true
```

Set this on **staging only**. Any attempt to open a Checkout Session with a
non-test key is refused before a single byte reaches Stripe
(`assertStripeTestModeIfRequired` in `_shared/stripe.ts`). Production never sets
it, so production behaviour is byte-for-byte unchanged. Verified both ways.

---

## What I still need from you

Staging Stripe cannot be created from here — it needs your Stripe dashboard and a
cloud Supabase project. Specifically:

1. **A cloud staging Supabase project** (Phase 1 of the previous round explains
   why a blank one can't be built from this repo — use
   `pg_dump --schema-only` of production, or `scripts/staging/bootstrap_hubly_core.sql`).
2. **`sk_test_…`** — Stripe dashboard → toggle **Test mode** → Developers → API keys.
3. **`whsec_…`** — a *test-mode* webhook endpoint pointed at
   `https://<staging-ref>.supabase.co/functions/v1/stripe-webhook`, subscribed to:
   `checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.payment_failed`, `account.updated`, `charge.refunded`.
4. **A test connected account** — in test mode, onboard the test business through
   the normal Hubly flow (`stripe-connect-onboard`); Stripe's test onboarding
   auto-fills. Confirm `charges_enabled: true`.

Then, on the staging project only:

```bash
supabase secrets set --project-ref <staging-ref> \
  STRIPE_SECRET_KEY=sk_test_...              \
  STRIPE_WEBHOOK_SECRET=whsec_...            \
  HUBLY_STRIPE_REQUIRE_TEST_MODE=true
```

Never paste these into git, this repo, or a chat message that gets logged.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.
Decline card: `4000 0000 0000 0002`.

---

## What is already proven without Stripe

`npm run test:sessions:stripe` — **56/56**, no network call, no money.
It intercepts `fetch` and asserts the exact request Hubly *would* send:

* **$50 exactly** (`unit_amount: 5000`), `usd`, quantity 1, `mode: payment`
* funds routed to the **connected account**; no platform fee when none is configured
* metadata carries the booking / session / business ids, **mirrored onto the
  PaymentIntent** so it survives to `charge.*` events
* checkout **expires in ~30 minutes** so an abandoned seat is released
* the amount is a pure function of the stored session — injecting
  `amount_cents` / `amount_dollars` / `charge_now_cents` changes nothing, and an
  absurd deposit is clamped to the price
* **signature verification**: valid accepted; wrong secret, tampered body,
  replayed (stale) timestamp and unsigned all rejected
* **confirm path against a real database**: pending → webhook → confirmed/paid,
  exactly one appointment, replay creates no duplicate job or customer
* **failure paths**: an unpaid event never confirms; an expired checkout releases
  the seat; a late payment on a released booking is *recorded for refunding* but
  never resurrected into an active booking

What that does **not** prove: that Stripe itself renders $50 and fires the
webhook. That is the only part left, and it needs the keys above.
