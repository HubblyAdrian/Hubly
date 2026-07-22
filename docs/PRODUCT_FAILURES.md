# Product Failures

Logic / blueprint / runtime behavior issues — **not** missing deploys or secrets.

**RC rule:** Every bug entry needs Severity · Customer impact · Reproduction · Fix · Evidence.

Evidence: `docs/BLUEPRINT_VALIDATION_REPORT.md`, live booking probes.

Generated: 2026-07-22 (Living Blueprints) · RC mode active.

---

## Bug report template (RC)

```
### BUG-N — short title
- Severity: P0 / P1 / P2 / P3
- Customer impact:
- Reproduction:
- Fix:
- Evidence: (URL / log / smoke / PaymentIntent / Event ID)
```

Infrastructure gaps → `INFRASTRUCTURE_BLOCKERS.md` (not this file).

---

## Philosophy (frozen)

**Living Blueprints** — Hubly supports businesses; knowledge is the moat.  
Official blueprints improve quality. Missing official files are **not** product failures if a Living Blueprint can build the business.

Path: Official / AI Generated → Owner edits → Behavior → Bookings / Reviews / Revenue → Improves → Community Learned / Hubly Optimized → Promote to Official.

---

## PROD-1 — Industry buildability (cleared)

All 12 required home-service industries **PASS** build validation (8 official @ 99%, 4 Living AI-generated @ ~84–86%).

Evidence: `docs/BLUEPRINT_VALIDATION_REPORT.md`

---

## PROD-2 — Living Blueprints + AI Review (in git)

| Capability | Status |
|---|---|
| AI Review Pass before publish | In git (`public/website-ai-review.js`) |
| Blueprint Intelligence / community signals | In git + migration `20260722200000_hubly_blueprint_signals.sql` |
| HQ AI Learning dashboard | In git (`ai_learning` action) — needs mission-control deploy |
| HQ blueprint reasoning on 360 | In git |

Live end-to-end build no longer blocked by missing edge (`hubly-build-business` DEPLOYED). E2E owner proof still outstanding.

---

## PROD-3 — Live booking / CRM / pay (when infra present)

| Area | Product status | Notes |
|---|---|---|
| Aquaspeed storefront + booking request | Works | |
| Public CRM write | Fixed in git | Site deploy lag |
| Pay-later as payment proof | N/A | Use Connect business only |

---

## Rules

- Missing **official** blueprint ≠ product failure  
- Cannot generate a valid Living Blueprint / cannot build = product  
- Infrastructure gaps → `INFRASTRUCTURE_BLOCKERS.md`
