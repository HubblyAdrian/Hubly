# Module 10 — 🔁 Memberships

**Status:** 🔒 OS locked · Stage 1 COMPLETE · Stage 2 ⏸ Deferred  
**PR:** [#253](https://github.com/HubblyAdrian/Hubly/pull/253) (merged)  
**Events:** [EVENTS.md](./EVENTS.md) (Rules #17–18)  
**Ownership:** [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) (Rules #15 · #19)  
**Design System:** HublyDS (Rule #14)  
**Plan:** [MEMBERSHIPS_PLAN.md](./MEMBERSHIPS_PLAN.md)  
**MAT:** [MEMBERSHIPS_MAT.md](./MEMBERSHIPS_MAT.md) · runner `node scripts/mat-memberships.mjs`  

**Do not modify Memberships unless:** bug fix · Stage 2 integrations · explicit module reopen.

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Memberships owns recurring plans, subscribers, visits, and renewals.  
First of the connected business systems: Memberships → Revenue → Reports → Ask Hubly.

**Reads:** Customers · Jobs · Revenue  
**Owns:** `S.membershipsOs`  
**Publishes:** `membership.started` · `membership.renewed` · `membership.cancelled` · `membership.paused` · `membership.visit_used`

---

## Stage 1 — Operating System

### Core
- [x] `ownPixelView('v-memberships', 'jos-memberships-root')` ✅  
- [x] HublyDS chrome ✅  
- [x] Tabs ✅  
- [x] Responsive ✅  

### Tabs
- [x] Overview ✅  
- [x] Plans ✅  
- [x] Subscribers ✅  
- [x] Visits ✅  
- [x] Billing (rules OS · Stripe Stage 2 toast) ✅  
- [x] Activity (append-only · Rule #18) ✅  

### Ownership & Events
- [x] `S.membershipsOs` owns plans/subscribers/visits/renewals/activity ✅  
- [x] No customer/payment clones (Rules #15 · #19) ✅  
- [x] Publishes HublyEvents on start/renew/pause/cancel/visit ✅  
- [x] Activity + visits + renewals append-only (Rule #18) ✅  

### Actions (`mem-*`)
- [x] Create / edit plan ✅  
- [x] Start membership ✅  
- [x] Renew / pause / cancel ✅  
- [x] Use visit ✅  
- [x] Open customer profile ✅  
- [x] Stage 2 Stripe toast ✅  

### QA / MAT / CMV
- [ ] Validator memberships + events gates ⏳  
- [ ] MAT ⏳  
- [ ] CMV incl. Reviews ✅  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Stripe subscription billing | ⏸ |
| Live renewals / dunning | ⏸ |
| Live payout sync | ⏸ |
