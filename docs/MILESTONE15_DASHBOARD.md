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
| 8 | Workspace Intelligence Builder | Pass (pending Founder Approval) | `scripts/check-builder-epic8.mjs` | `docs/BUILDER_EPIC8_PROOF.json` | — |
| 9 | Automation Builder | Locked | — | — | — |
| 10 | Portfolio Builder | Locked | — | — | — |
| 11 | Hubly Chat | Locked | — | — | — |
| 12 | Builder Validation & Apply Engine | Locked | — | — | — |

## Status legend

- **Locked** — previous epic not accepted  
- **Pass (pending Founder Approval)** — automated gate green  
- **Accepted** — founder signed off; next epic may start  

## Epic 1–7

**Accepted.** Intent → Plan → Preview → Collaboration → Versions → Business Builder → Booking Intelligence.

## Epic 8 — Workspace Intelligence Builder

Not a layout editor. The workspace evolves around how the owner works — conversation, not settings.

- Adaptive homepage + navigation  
- Contextual quick actions  
- Workspace Memory / learned behaviors  
- Workspace Health + explained recommendations  
- Multi-device (desktop / tablet / phone)  
- **Focus Mode** (Job / Sales / Admin / Growth Day)  
- Mission Control replay  
- Still requires approval — **no apply**

```bash
npm run check:builder-epic8
```

**Stop.** Do not start Epic 9 until Founder Approval.
