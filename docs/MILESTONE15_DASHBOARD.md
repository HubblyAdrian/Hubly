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
| 9 | Automation Intelligence Builder | Pass (pending Founder Approval) | `scripts/check-builder-epic9.mjs` | `docs/BUILDER_EPIC9_PROOF.json` | — |
| 10 | Portfolio Intelligence Builder | Locked | — | — | — |
| 11 | Hubly Chat OS | Locked | — | — | — |
| 12 | Builder Validation & Apply Engine | Locked | — | — | — |

## Status legend

- **Locked** — previous epic not accepted  
- **Pass (pending Founder Approval)** — automated gate green  
- **Accepted** — founder signed off; next epic may start  

## Epic 1–8

**Accepted.** Through Workspace Intelligence.

## Epic 9 — Automation Intelligence Builder

Not an automation settings UI. Conversation → workflow. Hubly acts as operations manager.

- Natural-language workflows + explained steps  
- Preview graph + 30-day simulation  
- Multi-system automations  
- Automation Health + time saved  
- AI recommendations + **Automation Discovery**  
- Mission Control replay  
- Still requires approval — **no apply / no execute**

```bash
npm run check:builder-epic9
```

**Stop.** Do not start Epic 10 until Founder Approval.
