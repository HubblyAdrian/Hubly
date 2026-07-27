# Module 9 — ⭐ Reviews

**Status:** 🔓 Explicit reopen (Mission Control dashboard)  
**Events:** [EVENTS.md](./EVENTS.md) (Rule #17)  
**Design System:** HublyDS (Rule #14)  
**Ownership:** Review records / requests / replies / reputation (Rule #15)  
**MAT:** [REVIEWS_MAT.md](./REVIEWS_MAT.md) · runner `node scripts/mat-reviews.mjs`  
**Mission Control:** [REVIEWS_MISSION_CONTROL.md](./REVIEWS_MISSION_CONTROL.md)

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Mission Control shell

- [x] `jos-reviews-mode` full-height shell, app bar hidden
- [x] Header 90px with search, date range, Request Review
- [x] KPI row (4 cards, clickable drawers)
- [x] AI Reputation Summary card
- [x] 9/3 main grid with feed tabs + sticky sidebar
- [x] Review feed cards (140px, actions, tags)
- [x] Sidebar: growth chart, platforms, goals, quick actions, copy link
- [x] Pagination footer
- [x] Request review modal (4-step)
- [x] Reply / AI reply drawer
- [x] Responsive desktop / laptop / tablet / mobile

## Core OS (retained)

- [x] `ownPixelView('v-reviews', 'jos-reviews-root')`
- [x] `S.reviewsOs` ownership
- [x] HublyEvents: `review.requested` · `review.received` · `review.responded` · `reputation.changed`
- [x] Actions: request · record · AI reply · sync placeholders

## QA / MAT

- [x] Validator + CMV gates
- [ ] Visual QA in browser
- [ ] MAT re-run after merge

## Stage 2 ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live Google Business reviews sync | ⏸ |
| Live Facebook / Yelp sync | ⏸ |
| Live review request delivery (SMS/email) | ⏸ |
