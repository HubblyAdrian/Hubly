# Release Status

Facts only. Updated after Proof Mode blocker-fix pass 2026-07-22.

Branch: `cursor/proof-mode-2662`.  
Evidence: `docs/PROOF_MODE_RUN.md`, `docs/CALENDAR_PROOF.md`, `docs/PROOF_PAYMENT_BUSINESS.md`, `docs/BUILD_BUSINESS_PROOF.md`.

---

## Architecture

**Complete**

---

## AI Migration

**Partial** — stack tip not on `main`; `hubly-build-business` **404** in production.

---

## Website

**Partial** — Aquaspeed publish live; three-business publish proof incomplete.

---

## Booking

**Partial** — Aquaspeed booking request succeeds (`complete_abandoned_booking` ok). CRM toast still on **production** until site deploy of public CRM guard.

---

## Payments

**Fail (proof)** — No `charges_enabled` Connect business. See `PROOF_PAYMENT_BUSINESS.md`.

---

## CRM

**Partial** — Service-role path added (`hire-crm` + shared helper + webhook). Public booking no longer writes CRM in **this branch**. Edge `hire-crm` **404** until deploy. Live accept/payment CRM unproven.

---

## Calendar

**Partial** — OAuth/push/maintain edges **deployed** (correct names). Full Google round-trip (create/reschedule/cancel/no-dupe) blocked without connected owner. See `CALENDAR_PROOF.md`.

---

## Hubly HQ

**Partial** — Proof Mode board added in repo; production `mission-control` still **404** until deploy.

---

## Production Proof

**Fail** — Three verticals incomplete; payment business missing; build edge missing.

---

## Internal Testing

**Ready** (repo) / **Not proven live**

---

## Closed Beta

**Not Ready**

All three businesses (Cleaning, Detailing, Lawn Care) have **not** completed the full lifecycle. Payment proof business with `charges_enabled=true` does not exist.

---

## Public Launch

**Not Ready**

---

## Proof Mode scoreboard

| Business | Build | Publish | Booking | Payment | Calendar | CRM | Review |
|---|---|---|---|---|---|---|---|
| Cleaning | ❌ | — | — | — | — | — | — |
| Detailing | — | ✅ | ✅ | ❌ | ❌ | ❌ | — |
| Lawn Care | ❌ | — | — | — | — | — | — |

---

## Deploy required (ops)

```bash
export SUPABASE_ACCESS_TOKEN=…
./scripts/deploy-proof-edges.sh
# apply migrations 20260722180000 + 20260722190000
# ship public/hubly.html + mission-control.html
# complete Stripe Connect for Devdetailing661 (or equivalent)
```
