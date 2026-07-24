# Milestone 1.5 — Builder Engine

Treat exactly like Milestone 1: **one epic at a time**, automated proof, Founder Approval, then unlock the next.

Live automation: `npm run milestone15` → `docs/MILESTONE15_RELEASE_GATE.json`

| Epic | Name | Status | Verification | Proof | Founder Approval |
|-----:|------|--------|--------------|-------|------------------|
| 1 | Builder Expert | Pass | `scripts/check-builder-epic1.mjs` | `docs/BUILDER_EPIC1_PROOF.json` | Accepted |
| 2 | Change Plan DSL | Pass | `scripts/check-builder-epic2.mjs` | `docs/BUILDER_EPIC2_PROOF.json` | Accepted |
| 3 | Preview Engine | Pass | `scripts/check-builder-epic3.mjs` | `docs/BUILDER_EPIC3_PROOF.json` | Accepted |
| 4 | Collaboration & Approval | Pass (pending Founder Approval) | `scripts/check-builder-epic4.mjs` | `docs/BUILDER_EPIC4_PROOF.json` | — |
| 5 | Rollback Engine | Locked | — | — | — |
| 6 | Website Builder | Locked | — | — | — |
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

## Epic 1–3

**Accepted.** Intent → Change Plan → Preview.

## Epic 4 — Collaboration & Approval Engine

Preview → conversation → recommendation → approval. Hubly is a design partner — not a Save dialog.

- Opens with **What do you think?** (never Approve? first)
- Recommends with confidence + DNA alignment
- Refinement rounds, alternatives, AI negotiation
- Partial approval + risk-tiered approval levels
- Approval summary + **Let's launch this.**
- Owner confidence for Experience Director
- Mission Control: full collaboration history
- **No** apply — waiting for Apply Engine

```bash
npm run check:builder-epic4
```

**Stop.** Do not start Epic 5 until Founder Approval.
