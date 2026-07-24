# Milestone 1.5 — Builder Engine

Treat exactly like Milestone 1: **one epic at a time**, automated proof, Founder Approval, then unlock the next.

Live automation: `npm run milestone15` → `docs/MILESTONE15_RELEASE_GATE.json`

| Epic | Name | Status | Verification | Proof | Founder Approval |
|-----:|------|--------|--------------|-------|------------------|
| 1 | Builder Expert | Pass | `scripts/check-builder-epic1.mjs` | `docs/BUILDER_EPIC1_PROOF.json` | Accepted |
| 2 | Change Plan DSL | Pass | `scripts/check-builder-epic2.mjs` | `docs/BUILDER_EPIC2_PROOF.json` | Accepted |
| 3 | Preview Engine | Pass | `scripts/check-builder-epic3.mjs` | `docs/BUILDER_EPIC3_PROOF.json` | Accepted |
| 4 | Collaboration & Approval | Pass | `scripts/check-builder-epic4.mjs` | `docs/BUILDER_EPIC4_PROOF.json` | Accepted |
| 5 | Version & Rollback | Pass (pending Founder Approval) | `scripts/check-builder-epic5.mjs` | `docs/BUILDER_EPIC5_PROOF.json` | — |
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

## Epic 1–4

**Accepted.** Intent → Change Plan → Preview → Collaboration (“What do you think?”).

## Epic 5 — Version & Rollback Engine

Git for a business. Every approved change becomes a Business Version.

- Website / Booking / Workspace / Automation / Portfolio versions  
- Compare + diffs  
- Full / partial / single-change **rollback plans** (not executed)  
- AI restore suggestions (owner-approved only)  
- **Business Timeline** — the story of the business  
- Mission Control: Current → History → Diff → Rollback → Restore suggestions  
- **No** apply / execute  

```bash
npm run check:builder-epic5
```

**Stop.** Do not start Epic 6 until Founder Approval.
