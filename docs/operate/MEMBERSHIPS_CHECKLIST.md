# Module 10 — 🔁 Memberships

**Status:** 🔓 Explicit reopen (Mission Control dashboard)  
**Events:** [EVENTS.md](./EVENTS.md) (Rules #17–18)  
**Ownership:** [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) (Rules #15 · #19)  
**Design System:** HublyDS (Rule #14)  
**Plan:** [MEMBERSHIPS_PLAN.md](./MEMBERSHIPS_PLAN.md)  
**MAT:** [MEMBERSHIPS_MAT.md](./MEMBERSHIPS_MAT.md) · runner `node scripts/mat-memberships.mjs`  
**Mission Control:** [MEMBERSHIPS_MISSION_CONTROL.md](./MEMBERSHIPS_MISSION_CONTROL.md)

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Mission Control shell

- [x] `jos-memberships-mode` full-height shell, app bar hidden
- [x] Header with Create plan / Create membership / Ask Hubly
- [x] KPI strip (Active, MRR, Churn, Renewals)
- [x] Tabs with orange underline (Subscriptions default)
- [x] Info banner + toolbar filters/search
- [x] Memberships table (72px rows, status pills, visit bars, actions menu)
- [x] Membership drawer (520px) with usage ring, billing, timeline
- [x] Pagination (10/25/50)
- [x] Responsive tablet/mobile

## Core OS (retained)

- [x] `S.membershipsOs` ownership
- [x] HublyEvents: started · renewed · cancelled · paused · visit_used
- [x] Plans / subscribers / visits / renewals / append-only activity
- [x] Rule #18 append-only activity · Rule #19 no customer clones

## QA / MAT

- [x] Validator + CMV gates
- [ ] Visual QA in browser
- [ ] MAT re-run after merge

## Stage 2 ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Stripe subscriptions | ⏸ |
| Card-on-file / retry payment | ⏸ |
| Automated renewals | ⏸ |
