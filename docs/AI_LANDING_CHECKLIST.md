# 🌎 AI Landing Experience — Checklist

**Status:** Stage 1 ✅ COMPLETE · 🔒 Locked  
**Architecture:** [AI_LANDING_ARCHITECTURE.md](./AI_LANDING_ARCHITECTURE.md) · [HUBLY_SESSION.md](./HUBLY_SESSION.md) · [HUBLY_MEMORY.md](./HUBLY_MEMORY.md)  
**Rule:** #24 — Dual Product Architecture  
**PR:** [#259](https://github.com/HubblyAdrian/Hubly/pull/259) merged  
**Milestone:** [Hubly AI Business Builder](./builder/README.md)

## Gate

- [x] Architecture doc before Development ✅  
- [x] Marketplace preserved (`/marketplace`, `/get-done`) ✅  
- [x] Do not remove Marketplace ✅  
- [x] Merged #259 → **🔒 Locked** ✅  

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
| 1 | Structured Session Handoff | ✅ |
| 2 | Real Import Pipeline | ✅ |
| 3 | Rename → Hubly Session | ✅ |
| 4 | Session Lifecycle | ✅ |

---

**AI Landing Experience is locked (🔒).**  

It is the official entry point into Hubly. The Hubly Session is the canonical session object from first interaction until account creation. Marketplace remains a parallel product.

**Do not redesign Landing unless:** bug fix · Stage 2 Brain classify · explicit reopen.

## Deferred (Stage 2 — additive only)

- [ ] Live Brain classify API  
- [ ] Deeper Instagram / Google Business vendor crawl  
- [ ] Server-side Hubly Session persistence (beyond localStorage)  
- [ ] Public Ask Hubly knowledge answers without account  
