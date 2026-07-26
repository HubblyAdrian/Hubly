# Module 7 — 🌐 Storefront

**Status:** Stage 1 OS in progress  
**Branch:** `cursor/operate-storefront-2662`  
**Design System:** [DESIGN_SYSTEM_V1.md](./DESIGN_SYSTEM_V1.md) · HublyDS (Rule #14)  
**Data ownership:** [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) · Service Catalog owner (Rule #15)  
**Stage in scope:** Stage 1 — Operating System  

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Storefront is the public face of the business — website, booking, service catalog, pricing, gallery, SEO, domain, and acquisition analytics. Stage 1 runs on Hubly data only.

Reviews on the site are **read-only** here (owner: ⭐ Reviews). Full review request/reply lives in the Reviews module.

---

## Stage 1 — Operating System

### Core
- [ ] `ownPixelView('v-editor', 'jos-storefront-root')` ⏳
- [ ] Header (preview site, save, Ask Hubly) ⏳
- [ ] Tabs ⏳
- [ ] HublyDS page chrome ⏳
- [ ] Responsive layout ⏳

### Tabs
- [ ] Website ⏳
- [ ] Booking ⏳
- [ ] Services (catalog — source of truth) ⏳
- [ ] Pricing ⏳
- [ ] Gallery ⏳
- [ ] Reviews (read) ⏳
- [ ] SEO ⏳
- [ ] Domain ⏳
- [ ] Analytics (OS/demo) ⏳

### Service Catalog (Rule #15)
- [ ] List / add / edit / archive services ⏳
- [ ] Owns catalog data (`editorSvcs` / `services`) ⏳
- [ ] Pricing fields (flat / duration / deposit OS) ⏳

### Actions (`sf-*`)
- [ ] Tab switch, save website copy, preview site/booking ⏳
- [ ] Service CRUD ⏳
- [ ] SEO / domain / slug edit ⏳
- [ ] Stage 2 placeholders (live domain DNS, live analytics) ⏳

### Empty / Error / Mobile
- [ ] Empty catalog / gallery ⏳
- [ ] Error + Retry ⏳
- [ ] Responsive ⏳

### QA / MAT / CMV
- [ ] Validator storefront gate ⏳
- [ ] CMV includes Pipeline ⏳
- [ ] MAT ⏳

### Stage 1 Definition of Done
- [ ] Storefront OS complete ⏳
- [ ] HublyDS used ⏳
- [ ] Service Catalog owned here ⏳
- [ ] MAT ✅ ACCEPTED ⏳
- [ ] CMV PASS ⏳
- [ ] Merge → lock 🔒 OS ⏳

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live custom domain DNS / SSL | ⏸ |
| Live analytics provider | ⏸ |
| Live review platform embed sync | ⏸ |
| Live payment deposit processor | ⏸ |
