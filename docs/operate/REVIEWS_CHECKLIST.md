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
- [ ] `ownPixelView('v-reviews', 'jos-reviews-root')` ⏳  
- [ ] HublyDS chrome ⏳  
- [ ] Tabs ⏳  
- [ ] Responsive ⏳  

### Tabs
- [ ] Overview / Reputation ⏳  
- [ ] All Reviews (Google / Facebook / Website) ⏳  
- [ ] Requests ⏳  
- [ ] AI Replies ⏳  
- [ ] Analytics ⏳  
- [ ] Event log (recent HublyEvents) ⏳  

### Ownership & Events
- [ ] `S.reviewsOs` owns reviews/requests/replies ⏳  
- [ ] Publishes HublyEvents on request/receive/respond/reputation ⏳  
- [ ] Reads Customers + completed Jobs for request targets ⏳  

### Actions (`rev-*`)
- [ ] Request review (customer/job picker) ⏳  
- [ ] Record / ingest review (OS) ⏳  
- [ ] AI reply draft + save response ⏳  
- [ ] Stage 2: Google / Facebook sync toasts ⏳  

### QA / MAT / CMV
- [ ] Validator reviews + hubly-events gates ⏳  
- [ ] MAT ⏳  
- [ ] CMV incl. Marketing ⏳  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Google Business reviews sync | ⏸ |
| Live Facebook reviews sync | ⏸ |
| Live review request delivery (SMS/email) | ⏸ |
