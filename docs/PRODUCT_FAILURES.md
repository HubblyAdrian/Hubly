# Product Failures

Logic / blueprint / runtime behavior issues — **not** missing deploys or secrets.

Evidence: `docs/BLUEPRINT_VALIDATION_REPORT.md`, live booking probes.

Generated: 2026-07-22

---

## PROD-1 — Missing industry blueprints (registry)

Required industries with **no** blueprint file:

| Business Type | Result | Reason |
|---|---|---|
| Electrical | FAIL | No blueprint in `public/business-blueprints/` |
| Plumbing | FAIL | No blueprint |
| Painting | FAIL | No blueprint |
| Junk Removal | FAIL | No blueprint |

**Impact:** Hubly cannot claim “any supported business” until these exist (or Closed Beta scope explicitly excludes them).

**Not** an infrastructure issue.

---

## PROD-2 — Registered blueprints (schema + lifecycle seeds)

| Business Type | Result | Evidence |
|---|---|---|
| Mobile Detailing | PASS | detailing.json |
| House Cleaning | PASS | house-cleaning.json |
| Window Cleaning | PASS | window-cleaning.json |
| Pressure Washing | PASS | pressure-washing.json |
| Lawn Care | PASS | lawn-care.json |
| HVAC | PASS | hvac.json |
| Photography | PASS | photography.json |
| Spa & Wellness | PASS | spa.json |

Lifecycle seed checks (Memory/DNA/Planner/Website/Services/Booking/CRM/Payments/Calendar/Health/Daily): **all pass** for the eight above.  
Live AI `Hubly.buildBusiness` end-to-end: **not run** (blocked by INFRA-1 / OPENAI) — do not mark live build as product-pass until edge deployed + AI key set.

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
- Missing blueprint = product  
- Wrong CRM on public book = product (fixed in branch)
