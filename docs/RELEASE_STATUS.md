# Release Status

Facts only. Evidence from repository + live Proof Mode probes as of 2026-07-22.

Branch: `cursor/proof-mode-2662` (from RC audit @ `39c2899`).  
Proof narrative: `docs/PROOF_MODE_RUN.md`.

---

## Architecture

**Complete**

Evidence: frozen Brain pipeline in repo rules + `hubly_brain_*.ts` / `hubly_ai.ts`. Proof Mode added no new architecture (one public-CRM toast bugfix only).

---

## AI Migration

**Partial**

Evidence: HublyAI façades in repo; OpenAI-only + Responses on stack tip. Live Responses benchmark not run. Stack not on `main`. Production missing `hubly-build-business` (404).

---

## Website

**Complete** (code) / **Partial** (proof)

Evidence: Aquaspeed storefront live at `https://aquaspeed.myhubly.app/` (Playwright). Publish path in Runtime. Full three-business publish proof incomplete.

---

## Booking

**Partial**

Evidence: Aquaspeed wizard booked through Review; `complete_abandoned_booking` ok; `get_busy_windows` ok. CRM toast failure observed; accept/pay/complete unproven.

---

## Payments

**Partial** → **Proof FAIL**

Evidence: checkout + webhook code in repo. Live Stripe: **0** Connect accounts, **0** PaymentIntents, **0** Charges. `PRODUCTION_PAYMENT_PROOF.md` A–D unchecked.

---

## CRM

**Partial**

Evidence: Accept/webhook upsert code exists. Live public book hit customers RLS 401. Anon-path toast fix on this branch; owner-accept CRM still unproven live.

---

## Calendar

**Partial** → **Proof FAIL**

Evidence: busy windows RPC live. Google OAuth/maintain edges **404** in production. `CALENDAR_TRUST.md` production boxes unchecked.

---

## Hubly HQ

**Partial**

Evidence: HQ in stack tip / RC docs. Production `mission-control` edge **404**.

---

## Production Proof

**Partial** → **FAIL**

Evidence: `docs/PROOF_MODE_RUN.md` — Payment Proof FAIL, Calendar Proof FAIL, Internal Launch Proof FAIL.

---

## Internal Testing

**Ready** (repo) / **Not proven live**

Evidence: Code paths + smoke script exist. Live hire with pay/calendar not completed.

---

## Closed Beta

**Not Ready**

Evidence: All three proofs failed (`PROOF_MODE_RUN.md`, `INTERNAL_LAUNCH_PROOF.md`). P0 blockers in `LAUNCH_BLOCKERS.md`. **Do not mark Ready until all three proofs PASS.**

---

## Public Launch

**Not Ready**

Evidence: Closed Beta Not Ready.

---

## Proof Mode scorecard

| Proof | Status |
|---|---|
| Production Payment | **FAIL** |
| Calendar | **FAIL** |
| Internal Launch (Cleaning / Detailing / Lawn Care) | **FAIL** |

---

## Product flow audit (repo vs live)

| # | Question | Repo | Live proof |
|---|---|---|---|
| 1 | Sign up | YES | UNVERIFIED (no Auth) |
| 2 | Build business | YES | FAIL (`hubly-build-business` 404) |
| 3 | Publish website | YES | PASS (Aquaspeed live) |
| 4 | Book | YES | PARTIAL (request path) |
| 5 | Pay | YES | FAIL (no Connect / charges) |
| 6 | Owner receives booking | YES | UNVERIFIED |
| 7 | CRM auto-update | YES | FAIL (public RLS); accept unproven |
| 8 | Calendar auto-update | YES | FAIL (Google edges 404) |
| 9 | Business Health | YES | UNVERIFIED |
| 10 | Hubly Daily | YES | UNVERIFIED |

---

## Smoke

```bash
node scripts/smoke-release.mjs
```

Repo smoke can be green; it does **not** replace live payment/calendar proofs.
