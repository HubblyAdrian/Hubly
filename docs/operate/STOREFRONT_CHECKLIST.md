# Module 7 — 🌐 Storefront

**Status:** 🔓 Explicit reopen (WYSIWYG visual editor)  
**Branch:** `cursor/operate-storefront-mission-control-2662`  
**Prior lock:** Stage 1 OS locked via [#250](https://github.com/HubblyAdrian/Hubly/pull/250)  
**Spec:** [STOREFRONT_MISSION_CONTROL.md](./STOREFRONT_MISSION_CONTROL.md)  
**MAT:** [STOREFRONT_MAT.md](./STOREFRONT_MAT.md)  
**Data ownership:** [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) · Service Catalog owner (Rule #15)

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending

---

## Mission Control reopen

### Shell
- [x] `jos-storefront-mode` full viewport · hide app bar ✅
- [x] Toolbar: back, devices, URL, undo/redo, preview, publish ✅
- [x] Persistent tabs (9) ✅

### WYSIWYG Website
- [x] Live preview mock (hero, nav, services, reviews) ✅
- [x] Click-to-select elements ✅
- [x] Context panel: Content / Design / Advanced tabs ✅
- [x] Instant live update on hero fields ✅
- [x] Sections list + theme shortcuts ✅

### Tabs (context panel)
- [x] Booking settings + checkboxes ✅
- [x] Services / Pricing / Gallery / Reviews ✅
- [x] SEO + AI generate buttons ✅
- [x] Domain / Analytics ✅

### Actions
- [x] Publish / draft / device / pick / undo-redo ✅
- [x] Existing `sf-*` service CRUD preserved ✅
- [x] Stage 2 placeholders (DNS, analytics connect, gallery upload) ✅

### QA
- [x] `node --check` journey.js ✅
- [ ] Visual QA 1440 / 1600 ⏳
- [ ] MAT re-run ⏳

---

## Stage 2 — Live Integrations ⏸ DEFERRED

Custom domain DNS · live analytics · gallery upload · schedule publish
