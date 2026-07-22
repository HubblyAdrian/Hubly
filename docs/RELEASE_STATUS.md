# Release Status

Facts only. Evidence from repository + `git` / `gh` as of 2026-07-22.

Source of truth branch for this RC work: `cursor/release-candidate-audit-2662` (from `cursor/final-ai-migration-2662` @ `d689dd2`).  
See also: `docs/GIT_STATE_REPORT.md`, `docs/LAUNCH_BLOCKERS.md`, `docs/PRODUCTION_READINESS_GRADES.md`.

---

## Architecture

**Complete**

Evidence: frozen pipeline documented in `.cursor/rules/hubly-product-direction.mdc`, `docs/V1_FINISH_LINE.md`, Brain modules under `supabase/functions/_shared/hubly_brain_*.ts`, gateway `hubly_ai.ts`. No new architecture introduced in RC mode beyond HQ audit log + smoke gate wiring.

---

## AI Migration

**Partial**

Evidence: product AI edges route through HublyAI (`scripts/check-hubly-ai.mjs`); OpenAI-only production (`docs/OPENAI_ONLY_PRODUCTION.md`); Responses default (`docs/OPENAI_RESPONSES_MIGRATION.md`). **Not Complete:** live Responses benchmark missing (`docs/OPENAI_RESPONSES_BENCHMARK.md` stub; no `OPENAI_API_KEY` in agent). Stack not on `main`.

---

## Website

**Complete**

Evidence: Website Runtime `publishBusinessWebsite` / copy builders in `hubly_brain_website.ts`; Instant Site publish in `public/hubly.html`; `docs/LAUNCH_CHECKLIST.md` / `LAUNCH_READINESS_REPORT.md` mark Website/Publishing Complete.

---

## Booking

**Partial**

Evidence: `submitBooking` + conflict checks + hire accept → jobs in `public/hubly.html`; busy windows migration `20260722030000_get_busy_windows.sql`. **Not Complete:** First Customer live E2E unchecked.

---

## Payments

**Partial**

Evidence: `create-booking-checkout`, `stripe-webhook`, migration `20260722020000_first_customer_payments.sql`, docs `PRODUCTION_PAYMENT_PROOF.md`. **Not Complete:** all live proof checkboxes empty.

---

## CRM

**Complete**

Evidence: accept path `upsertCustomer`; paid path `upsertCrmFromBooking` in `stripe-webhook/index.ts`; graded Complete in `LAUNCH_READINESS_REPORT.md`.

---

## Calendar

**Partial**

Evidence: busy windows, `assertSlotOpen`, `pushJobToGoogleCalendar`, `docs/CALENDAR_TRUST.md`. **Not Complete:** production TZ/Google round-trip proof open.

---

## Hubly HQ

**Partial**

Evidence: `public/mission-control.html` + `mission-control` edge surfaces (CEO Daily, Feed, Launch Queue, Funnel, Search, Business 360, Platform/System/AI Health, Revenue, Errors, Adoption, Waitlist, Release Gate, Impersonation, Admin Audit Log); migrations `20260722160000_*`, `20260722170000_*`, `20260722180000_hubly_smoke_runs.sql`. **Not Complete:** not on `main`; migrations/edge must be deployed; smoke must report green; Auth still secret-bootstrap.

---

## Production Proof

**Partial**

Evidence: payment + calendar proof docs exist with unchecked boxes. No recorded live hire session ids in `PRODUCTION_PAYMENT_PROOF.md`.

---

## Internal Testing

**Ready**

Evidence: code paths for signup → build → publish → book → pay → CRM/calendar/Feed exist; Hubly HQ + Release Gate available for staff; smoke script `scripts/smoke-release.mjs` verifies repo wiring. Caveat: run smoke with `REPORT_SMOKE=1` after migration deploy.

---

## Closed Beta

**Not Ready**

Evidence: P0 blockers in `docs/LAUNCH_BLOCKERS.md` (live payment proof, Responses benchmark, stack not on `main`, smoke gate).

---

## Public Launch

**Not Ready**

Evidence: Closed beta not ready; V1 finish line First Customer incomplete (`docs/V1_FINISH_LINE.md`).

---

## Product flow audit (repo)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Can a brand new customer sign up today? | **YES** | Instant Site signup / claim in `public/hubly.html`; `/` via `api/router.js` |
| 2 | Can Hubly build a business? | **YES** | `hubly-build-business` + `Hubly.buildBusiness` |
| 3 | Can Hubly publish a website? | **YES** | `publishBusinessWebsite` + owner publish |
| 4 | Can a customer book? | **YES** | `submitBooking` → `booking_requests` |
| 5 | Can a customer pay? | **YES** (proof gap) | Checkout + webhook code; live proof unchecked |
| 6 | Does the owner receive the booking? | **YES** | `notifyWebsiteHire` + Feed/realtime |
| 7 | Does CRM update automatically? | **YES** | Accept + paid webhook upserts |
| 8 | Does Calendar update automatically? | **YES** (proof gap) | Job + Google push; TZ proof open |
| 9 | Does Business Health update? | **YES** | Deterministic health after hire events |
| 10 | Does Hubly Daily update? | **YES** | Deterministic daily from live stats |

---

## PR #184 benchmark status

| Item | Status |
|---|---|
| Branch `cursor/openai-responses-transport-2662` on origin | YES @ `250bda5` |
| Script `scripts/benchmark-openai-transport.mjs` | **EXISTS** (14024 bytes) |
| `OPENAI_API_KEY` in this environment | **NOT SET** |
| Live benchmark run | **NOT RUN** |
| Why | Agent environment has no OpenAI key; cannot invent results. Run on staging per `docs/OPENAI_RESPONSES_BENCHMARK.md`. |
| Merge to `main` | **DO NOT** until benchmark green |

---

## Smoke

```bash
node scripts/smoke-release.mjs
# after HQ secret + migration:
REPORT_SMOKE=1 HUBLY_MISSION_CONTROL_SECRET=… node scripts/smoke-release.mjs
```

On failure, Release Gate `e2e_smoke` is **RED** (`offline`) via `hubly_smoke_runs`.
