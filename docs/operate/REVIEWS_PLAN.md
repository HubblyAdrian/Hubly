# Module 9 — ⭐ Reviews · Planning

**Branch:** `cursor/operate-reviews-2662`  
**Stage:** 1 — Operating System  
**Rules:** #14 HublyDS · #15 ownership · #16 E2E · #17 events  
**Events:** [EVENTS.md](./EVENTS.md)  
**Locked modules (do not modify):** Home · Inbox · Jobs · Leads · Customers · Pipeline · Storefront · Marketing OS

## Purpose

Reviews owns reputation: Google / Facebook / Website testimonials, AI replies, review requests, reputation analytics.

**Reads:** Customers · Jobs · Marketing  
**Owns:** `S.reviewsOs` (reviews, requests, replies, analytics)  
**Publishes:** `review.requested` · `review.received` · `review.responded` · `reputation.changed`

## Implementation plan

1. Lock Marketing OS after #251.  
2. Ship Rule #17 + `hubly-events.js` + EVENTS.md.  
3. Replace thin `renderBizReviews` with full Reviews OS (`ownPixelView`, HublyDS, `rev-*` acts).  
4. Seed owned reviews from demo / existing `website.manualReviews` once, then own going forward.  
5. Publish HublyEvents on request / receive / respond / reputation change.  
6. Stage 2 placeholders for live Google / Facebook sync.  
7. Validator + MAT + CMV (+ Marketing).  
8. PR → approval → merge → 🔒 OS.
