# Proof Mode run — 2026-07-22

**Objective:** Can a real business trust Hubly?  
**Operator:** Cloud agent (Playwright + Stripe MCP + live `myhubly.app`)  
**Verdict:** **FAILED — Closed Beta Not Ready**

No proof invented. Every step below has evidence.

---

## Environment

| Check | Result |
|---|---|
| `https://myhubly.app/` | HTTP 200 |
| Stripe MCP account | `acct_1TubAAEEmwNmC4XD` (Hubly) |
| Stripe PaymentIntents | **empty list** |
| Stripe Charges | **empty list** |
| Stripe Connect accounts | **empty list** |
| Agent `STRIPE_SECRET_KEY` / service role / HQ secret | **MISSING** |
| Supabase MCP | **needsAuth** (unavailable) |

---

## Proof 1 — Production Payment Proof

**Status: FAIL**

### Steps attempted

| Step | Result | Evidence |
|---|---|---|
| Customer visits published site | **PASS** | `https://aquaspeed.myhubly.app/` title `Aquaspeed \| Mobile Car Detailing Service`; Playwright screenshot `/opt/cursor/artifacts/aquaspeed-storefront.png` |
| Customer books | **PARTIAL** | Wizard reached Review; `complete_abandoned_booking` → `{ok:true}`; `send-customer-email` → `{ok:true}`. Log: `/opt/cursor/artifacts/proof-payment-attempt.log` |
| Customer pays | **FAIL** | Business `payment_setting=later` (no deposit/full at book). Stripe Connect accounts = **0**. No PaymentIntents / Charges in Hubly Stripe account. |
| Owner notified | **UNVERIFIED** | `notifyWebsiteHire` invoked from client path; no owner inbox / Feed proof (no owner session). Email edge returned ok for customer path. |
| CRM updates | **FAIL** | Public confirm called `upsertCustomer` → HTTP **401** RLS: `new row violates row-level security policy for table "customers"`. Toast: `Could not save customer`. |
| Calendar updates | **FAIL** | No owner accept in this run; Google edges `google-calendar-oauth` / `maintain-google-calendar` → **404 NOT_FOUND** on production. |
| Business Health updates | **UNVERIFIED** | Requires paid/accept hire events; not reached. |
| Review request sends | **FAIL** | Hire not completed; review path not exercised. |

### Record table

| Field | Value |
|---|---|
| Business id / name | `64211e3a-93ee-4ee2-8182-fcf27d8febbf` / Aquaspeed |
| Booking request id | Abandoned id used; anon cannot SELECT rows (RLS). `complete_abandoned_booking` returned ok. |
| Stripe Checkout session | **none** |
| PaymentIntent | **none** |
| Date (UTC) | 2026-07-22 |
| Operator | Cloud agent Proof Mode |

### A–D checklist

- A Success (paid hire): **not run** — no Connect / pay-at-book  
- B Failure/cancel: **not run**  
- C Expire: **not run**  
- D Refund: **not run**

---

## Proof 2 — Calendar Proof

**Status: FAIL**

| Check | Result | Evidence |
|---|---|---|
| Google sync | **FAIL** | Production edges `google-calendar-oauth` and `maintain-google-calendar` return **404** |
| Time zones | **UNVERIFIED** | Aquaspeed `timezone=America/Denver`; busy RPC works but no Google round-trip |
| Conflict detection | **PARTIAL** | `get_busy_windows` RPC returns `[]` (HTTP 200) during booking; no occupied Google block to refuse |
| Reschedule | **FAIL** | Not reached (no accepted job / Google) |
| Cancel | **FAIL** | Not reached |
| No duplicate events | **FAIL** | Not reached |

---

## Proof 3 — Internal Launch Proof

**Status: FAIL**

Required: create Cleaning, Detailing, Lawn Care → publish → book → pay → complete → review.

| Business | Create | Publish | Book | Pay | Complete | Review |
|---|---|---|---|---|---|---|
| Cleaning | **BLOCKED** | — | — | — | — | — |
| Detailing | Used existing **Aquaspeed** (detailing) | Site live | Partial (see Proof 1) | FAIL | FAIL | FAIL |
| Lawn Care | **BLOCKED** | — | — | — | — | — |

**Why create blocked:** Agent has no owner Auth credentials / email verification path to Instant Site claim. `hubly-build-business` edge **404** on production. Cannot forge signups.

**Existing production businesses sampled:** Aquaspeed, Adrian's Window Cleaning, Bucket Mobile Detailing, Graef’s AutoCare, Everlasting, etc. None have Stripe Connect accounts in Hubly Stripe.

---

## Issues discovered (all P0)

1. **No Stripe Connect accounts / no live charges** — cannot pay through Hubly.  
2. **CRM public upsert RLS** — scary false failure toast on book (fixed in this branch for public anon path; CRM still must update on accept/webhook — unproven).  
3. **Google Calendar edges missing in production** (404).  
4. **`hubly-build-business` / `mission-control` not deployed** (404).  
5. **Payment proof A–D unchecked** — no session ids.  
6. **Cannot create three proof businesses** without owner credentials.

---

## Closed Beta gate

**Not Ready.** All three proofs must PASS before `RELEASE_STATUS.md` marks Closed Beta Ready.
