# Module 7 — 🌐 Storefront

**Status:** 🔒 OS LOCKED (Stage 1) — merged #250  
**Branch:** `cursor/operate-storefront-2662`  
**PR:** [#250](https://github.com/HubblyAdrian/Hubly/pull/250)  
**Design System:** [DESIGN_SYSTEM_V1.md](./DESIGN_SYSTEM_V1.md) · HublyDS (Rule #14)  
**Data ownership:** [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) · Service Catalog owner (Rule #15)  
**MAT:** [STOREFRONT_MAT.md](./STOREFRONT_MAT.md)  
**Stage in scope:** Stage 1 — Operating System  

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Storefront is the public face of the business — website, booking, service catalog, pricing, gallery, SEO, domain, and acquisition analytics. Stage 1 runs on Hubly data only.

Reviews on the site are **read-only** here (owner: ⭐ Reviews). Full review request/reply lives in the Reviews module.

---

## Stage 1 — Operating System

### Core
- [x] `ownPixelView('v-editor', 'jos-storefront-root')` ✅
- [x] Header (preview site, save, Ask Hubly) ✅
- [x] Tabs ✅
- [x] HublyDS page chrome ✅
- [x] Responsive layout ✅
- [x] Legacy editor gated when `jos-pixel-owned` ✅

### Tabs
- [x] Website ✅
- [x] Booking ✅
- [x] Services (catalog — source of truth) ✅
- [x] Pricing ✅
- [x] Gallery ✅
- [x] Reviews (read) ✅
- [x] SEO ✅
- [x] Domain ✅
- [x] Analytics (OS/demo) ✅

### Service Catalog (Rule #15)
- [x] List / add / edit / archive services ✅
- [x] Owns catalog data (`editorSvcs` / `services`) ✅
- [x] Pricing fields (flat / duration / deposit OS) ✅
- [x] `syncStorefrontCatalogToServices()` mirror for consumers ✅

### Actions (`sf-*`)
- [x] Tab switch, save website copy, preview site/booking ✅
- [x] Service CRUD ✅
- [x] SEO / domain / slug edit ✅
- [x] Stage 2 placeholders (live domain DNS, live analytics, gallery upload) ✅

### Empty / Error / Mobile
- [x] Empty catalog / gallery ✅
- [x] Error + Retry ✅
- [x] Responsive ✅

### QA / MAT / CMV
- [x] Validator storefront gate ✅
- [x] CMV includes Pipeline ✅
- [x] MAT formal acceptance ✅

### Stage 1 Definition of Done
- [x] Storefront OS complete ✅
- [x] HublyDS used ✅
- [x] Service Catalog owned here ✅
- [x] MAT ✅ ACCEPTED ✅
- [x] CMV PASS ✅
- [x] Merged #250 → **🔒 OS LOCKED** ✅

---

**Storefront Operating System is locked (🔒 OS).** Do not modify Stage 1 OS unless bug fix, Stage 2 integrations, or explicit reopen.

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live custom domain DNS / SSL | ⏸ |
| Live analytics provider | ⏸ |
| Live review platform embed sync | ⏸ |
| Live payment deposit processor | ⏸ |
| Cloud gallery upload | ⏸ |
