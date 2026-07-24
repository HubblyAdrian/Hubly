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
| 6 | Business Builder | Pass | `scripts/check-builder-epic6.mjs` | `docs/BUILDER_EPIC6_PROOF.json` | Accepted |
| 7 | Booking Intelligence Builder | Pass | `scripts/check-builder-epic7.mjs` | `docs/BUILDER_EPIC7_PROOF.json` | Accepted |
| 8 | Workspace Intelligence Builder | Pass | `scripts/check-builder-epic8.mjs` | `docs/BUILDER_EPIC8_PROOF.json` | Accepted |
| 9 | Automation Intelligence Builder | Pass | `scripts/check-builder-epic9.mjs` | `docs/BUILDER_EPIC9_PROOF.json` | Accepted |
| 10 | Media Intelligence Engine | Pass | `scripts/check-builder-epic10.mjs` | `docs/BUILDER_EPIC10_PROOF.json` | Accepted |
| 11 | Hubly Chat OS | Pass | `scripts/check-builder-epic11.mjs` | `docs/BUILDER_EPIC11_PROOF.json` | Accepted |
| 12 | Business Deployment Engine | Pass (pending Founder Approval) | `scripts/check-builder-epic12.mjs` | `docs/BUILDER_EPIC12_PROOF.json` · [`MILESTONE15_CERTIFIED.md`](./MILESTONE15_CERTIFIED.md) | — |

## Status legend

- **Locked** — previous epic not accepted  
- **Pass (pending Founder Approval)** — automated gate green  
- **Accepted** — founder signed off; next epic may start  

## Epic 1–11

**Accepted.** Through Hubly Chat OS.

## Epic 12 — Business Deployment Engine

This is the moment Hubly safely changes the business.

- Only approved Change Plans deploy  
- Validation → Dry Run → Progressive deploy → Verify  
- Deployment Health + AI summary  
- Real rollback  
- Mission Control full lifecycle  
- Founder certification artifact  

```bash
npm run check:builder-epic12
npm run milestone15
```

When Epic 12 is accepted, Milestone 1.5 is complete — the core platform.
