# Product Failures

Logic / blueprint / runtime behavior issues — **not** missing deploys or secrets.

Evidence: `docs/BLUEPRINT_VALIDATION_REPORT.md`, live booking probes.

Generated: 2026-07-22 (updated: AI blueprint fallback)

---

## Philosophy (frozen)

Hubly supports businesses — not blueprint files.  
Official blueprints improve quality. Missing official files are **not** product failures if an AI-generated blueprint can build the business.

---

## PROD-1 — Industry buildability (cleared)

All 12 required home-service industries **PASS** build validation:

| Source | Industries |
|---|---|
| Official (99%) | Detailing, Cleaning, Windows, Pressure Washing, Lawn Care, HVAC, Photography, Spa |
| AI-generated (84%) | Electrical, Plumbing, Painting, Junk Removal |

Evidence: `docs/BLUEPRINT_VALIDATION_REPORT.md` — 12 PASS / 0 FAIL.

Optional future product work: handcraft official Electrical / Plumbing / Painting / Junk Removal for higher copy/SEO/upsell quality (not required to support the industry).

---

## PROD-2 — Live Build My Business end-to-end

Live AI `Hubly.buildBusiness` / `hubly-build-business` end-to-end: **not run** (blocked by INFRA — edge MISSING / OPENAI).  
Do not mark live build as product-pass until edge deployed + AI key set.  
Repo validation proves blueprint → Memory/DNA/Planner/Website/Booking/CRM/Health/Daily/CD/Ask AI **seeds** for all 12.

---

## PROD-3 — Live booking / CRM / pay (when infra present)

| Area | Product status | Notes |
|---|---|---|
| Aquaspeed storefront + booking request | Works | `complete_abandoned_booking` ok |
| Public CRM write | Fixed in git | Was incorrect product behavior; infra deploy pending for site |
| Pay-later as payment proof | N/A | Process rule — use Connect business only |

---

## Rules

- Never list `hubly-build-business` 404 here → `INFRASTRUCTURE_BLOCKERS.md`  
- Never list missing Stripe Connect here → infrastructure  
- Missing **official** blueprint ≠ product failure (AI-generated fills the gap)  
- Cannot generate a valid blueprint / cannot build = product  
- Wrong CRM on public book = product (fixed in branch)
