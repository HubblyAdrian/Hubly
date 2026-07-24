# Milestone 1.5 — Builder Engine

Treat exactly like Milestone 1: **one epic at a time**, automated proof, Founder Approval, then unlock the next.

Live automation: `npm run milestone15` → `docs/MILESTONE15_RELEASE_GATE.json`

| Epic | Name | Status | Verification | Proof | Founder Approval |
|-----:|------|--------|--------------|-------|------------------|
| 1 | Builder Expert | Pass | `scripts/check-builder-epic1.mjs` | `docs/BUILDER_EPIC1_PROOF.json` | Accepted |
| 2 | Change Plan DSL | Pass (pending Founder Approval) | `scripts/check-builder-epic2.mjs` | `docs/BUILDER_EPIC2_PROOF.json` | — |
| 3 | Preview Engine | Locked | — | — | — |
| 4 | Approval Engine | Locked | — | — | — |
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

## Epic 1 — Builder Expert

**Accepted.** Builder Intent only.

## Epic 2 — Change Plan DSL

Builder Intent → **declarative Change Plan** (desired end state). Universal language for every builder.

- One plan for multi-system requests  
- Action metadata: owner, risk, impact, confidence, dependencies  
- Safety validation before Preview Engine  
- Mission Control: Intent → Change Plan → Waiting for Preview  
- **No** execute / apply / SQL / React / DB / UI mutations  

```bash
npm run check:builder-epic2
```

**Stop.** Do not start Epic 3 until Founder Approval.
