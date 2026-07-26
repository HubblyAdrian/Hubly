# Module 9 — ⭐ Reviews

**Status:** Stage 1 OS in progress  
**Branch:** `cursor/operate-reviews-2662`  
**Events:** [EVENTS.md](./EVENTS.md) (Rule #17)  
**Design System:** HublyDS (Rule #14)  
**Ownership:** Review records / requests / replies / reputation (Rule #15)  

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Reviews owns reputation. Complements Marketing (demand + trust).

**Reads:** Customers · Jobs · Marketing  
**Owns:** `S.reviewsOs`  
**Publishes:** `review.requested` · `review.received` · `review.responded` · `reputation.changed`

---

## Stage 1 — Operating System

### Core
- [x] `ownPixelView('v-reviews', 'jos-reviews-root')` ✅  
- [x] HublyDS chrome ✅  
- [x] Tabs ✅  
- [x] Responsive ✅  

### Tabs
- [x] Overview / Reputation ✅  
- [x] All Reviews (Google / Facebook / Website) ✅  
- [x] Requests ✅  
- [x] AI Replies ✅  
- [x] Analytics ✅  
- [x] Event log (recent HublyEvents) ✅  

### Ownership & Events
- [x] `S.reviewsOs` owns reviews/requests/replies ✅  
- [x] Publishes HublyEvents on request/receive/respond/reputation ✅  
- [x] Reads Customers + completed Jobs for request targets ✅  

### Actions (`rev-*`)
- [x] Request review (customer/job picker) ✅  
- [x] Record / ingest review (OS) ✅  
- [x] AI reply draft + save response ✅  
- [x] Stage 2: Google / Facebook sync toasts ✅  

### QA / MAT / CMV
- [x] Validator reviews + hubly-events gates ✅  
- [ ] MAT ⏳  
- [x] CMV incl. Marketing ✅  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Google Business reviews sync | ⏸ |
| Live Facebook reviews sync | ⏸ |
| Live review request delivery (SMS/email) | ⏸ |
