# Milestone 1.5 — Builder Engine

Treat exactly like Milestone 1: **one epic at a time**, automated proof, Founder Approval, then unlock the next.

Live automation: `npm run milestone15` → `docs/MILESTONE15_RELEASE_GATE.json`

| Epic | Name | Status | Verification | Proof | Founder Approval |
|-----:|------|--------|--------------|-------|------------------|
| 1 | Builder Expert | Pass | `scripts/check-builder-epic1.mjs` | `docs/BUILDER_EPIC1_PROOF.json` | Accepted |
| 2 | Change Plan DSL | Pass | `scripts/check-builder-epic2.mjs` | `docs/BUILDER_EPIC2_PROOF.json` | Accepted |
| 3 | Preview Engine | Pass | `scripts/check-builder-epic3.mjs` | `docs/BUILDER_EPIC3_PROOF.json` | Accepted |
| 4 | Collaboration & Approval | Pass | `scripts/check-builder-epic4.mjs` | `docs/BUILDER_EPIC4_PROOF.json` | Accepted |
| 5 | Version & Rollback | Pass | `scripts/check-builder-epic5.mjs` | `docs/BUILDER_EPIC5_PROOF.json` | Accepted |
| 6 | Business Builder | Pass (pending Founder Approval) | `scripts/check-builder-epic6.mjs` | `docs/BUILDER_EPIC6_PROOF.json` | — |
| 7 | Booking Builder | Locked | — | — | — |
| 8 | CRM Builder | Locked | — | — | — |
| 9 | Automation Builder | Locked | — | — | — |
| 10 | Portfolio Builder | Locked | — | — | — |
| 11 | Hubly Chat | Locked | — | — | — |
| 12 | Builder Validation | Locked | — | — | — |

## Status legend

- **Locked** — previous epic not accepted  
- **Pass (pending Founder Approval)** — automated gate green  
- **Accepted** — founder signed off; next epic may start  

## Epic 1–5

**Accepted.** Intent → Plan → Preview → Collaboration → Versions.

## Epic 6 — Business Builder

Not a Website Builder. Hubly builds the **business**. Website is one canvas / internal module.

- Creative Sessions across Website, Booking, Packages, Portfolio  
- Creative Directions (Luxury, Friendly Premium, Minimal, …)  
- Business Score (trust, clarity, booking experience — not SEO)  
- Creative Memory + negotiation  
- Creative Workspace (conversation + live business)  
- Still requires approval — **no apply**

```bash
npm run check:builder-epic6
```

**Stop.** Do not start Epic 7 until Founder Approval.
