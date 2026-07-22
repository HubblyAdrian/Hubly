# Internal Launch Proof

Create three businesses and run the full lifecycle. Document every issue. Every failure is P0.

**Run date:** 2026-07-22  
**Status:** **FAIL**

## Matrix

| Business | Create | Publish | Book | Pay | Complete | Review | Notes |
|---|---|---|---|---|---|---|---|
| Cleaning | FAIL | — | — | — | — | — | No owner Auth in agent; `hubly-build-business` **404** on production |
| Detailing | N/A (existing Aquaspeed) | PASS (subdomain live) | PARTIAL | FAIL | FAIL | FAIL | See `PROOF_MODE_RUN.md` / payment + CRM RLS + no Connect |
| Lawn Care | FAIL | — | — | — | — | — | Same create blocker as Cleaning |

## Issues (P0)

1. Cannot Instant Site–create businesses without credentials / deployed build edge.  
2. Aquaspeed cannot take card payment (no Connect; pay later).  
3. Public CRM upsert RLS failure (mitigated for anon toast; accept/webhook CRM still unproven).  
4. Google Calendar production edges missing.  
5. Complete + review never reached.

## Pass criteria

All three rows green end-to-end with recorded ids (business, booking, payment, job, review).  
Until then Closed Beta stays **Not Ready**.
