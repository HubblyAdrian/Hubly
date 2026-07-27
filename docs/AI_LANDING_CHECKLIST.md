# 🌎 AI Landing Experience — Checklist

**Status:** Stage 1 implemented · approval conditions addressed · **DO NOT MERGE until founder approval**  
**Architecture:** [AI_LANDING_ARCHITECTURE.md](./AI_LANDING_ARCHITECTURE.md) · [HUBLY_SESSION.md](./HUBLY_SESSION.md)  
**Rule:** #24 — Dual Product Architecture  
**Branch:** `cursor/ai-landing-dual-product-2662`  
**PR:** #259

## Gate

- [x] Architecture doc before Development ✅  
- [x] Marketplace preserved (`/marketplace`, `/get-done`) ✅  
- [x] Do not remove Marketplace ✅  

## Stage 1

- [x] User-phrased paths: grow business · hire someone ✅  
- [x] Shared Hubly Session module `hubly-session.js` (alias `landing-intent.js`) ✅  
- [x] Live status line under input ✅  
- [x] Continue Building enables when ready ✅  
- [x] Popular trades seed the AI box ✅  
- [x] Anonymous Hubly Session (localStorage) ✅  
- [x] Structured session handoff (`?hs=` + `toBuilderPayload`) ✅  
- [x] Builder consumes session — does not re-infer known facts ✅  
- [x] Real import pipeline start (`/api/import-analyze`) ✅  
- [x] Rename Builder Session → Hubly Session ✅  
- [x] Session lifecycle documented (create / upgrade / TTL) ✅  
- [x] Account upgrade path (`upgradeToAccount` on Instant Site signup) ✅  
- [x] Ask Hubly FAB uses intent routing ✅  
- [x] Homepage craft + landing-intent gates ✅  

## Approval conditions (PR #259)

| # | Condition | Status |
|---|-----------|--------|
| 1 | Structured Session Handoff | ✅ Implemented |
| 2 | Real Import Pipeline | ✅ Implemented (website fetch+parse; social partial+queued) |
| 3 | Rename → Hubly Session | ✅ Done |
| 4 | Session Lifecycle | ✅ Documented + TTL + upgrade hook |

## Deferred

- [ ] Live Brain classify API (Stage 2)  
- [ ] Deeper Instagram / Google Business vendor crawl  
- [ ] Server-side Hubly Session persistence (beyond localStorage)  
- [ ] Full Who Are You? page polish  
- [ ] Public Ask Hubly knowledge answers without account  
