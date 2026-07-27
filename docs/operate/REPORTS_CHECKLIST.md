# Module 12 — 📊 Reports

**Status:** 🔓 Explicit reopen (Mission Control dashboard) · Stage 1 COMPLETE · Stage 2 ⏸ Deferred  
**PR:** [#255](https://github.com/HubblyAdrian/Hubly/pull/255) (merged)  
**Plan:** [REPORTS_PLAN.md](./REPORTS_PLAN.md)  
**Platform:** [PLATFORM_READINESS.md](./PLATFORM_READINESS.md)  
**Rules:** #14–21 (especially **#21**)  
**Design System:** HublyDS (Rule #14)  
**MAT:** [REPORTS_MAT.md](./REPORTS_MAT.md) · runner `node scripts/mat-reports.mjs`  

**Do not modify Reports unless:** bug fix · Stage 2 integrations · explicit module reopen. 

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Reports is a **presentation and analytics layer**. It owns almost no business data.

**Reads (aggregate):** Revenue · Memberships · Pipeline · Customers · Leads · Jobs · Marketing · Reviews  
**Owns:** `S.reportsOs` — dashboards, definitions, layouts, schedules, forecast models  
**Never owns:** customers, payments, jobs, leads, campaigns, reviews, memberships

---

## Stage 1 — Operating System

### Core
- [x] `ownPixelView('v-reports', 'jos-reports-root')` ✅
- [x] HublyDS chrome ✅
- [x] Tabs ✅
- [x] Responsive ✅

### Tabs
- [x] Overview (live aggregates) ✅
- [x] Dashboards ✅
- [x] Definitions ✅
- [x] Layouts ✅
- [x] Scheduled ✅
- [x] Forecasts ✅
- [x] Sources (owner map · Rule #21) ✅

### Ownership (Rule #21)
- [x] `S.reportsOs` owns presentation config only ✅
- [x] KPIs computed at read-time from owners — no payment/customer copies ✅
- [x] Deep-links to Revenue / Memberships / Jobs / etc. ✅

### Actions (`rpt-*`)
- [x] Create / save dashboard ✅
- [x] Create / save report definition ✅
- [x] Save layout ✅
- [x] Schedule report (OS) ✅
- [x] Run / refresh forecast (OS) ✅
- [x] Navigate to owner modules ✅

### QA / MAT / CMV
- [x] Validator reports gates ✅  
- [x] MAT ✅ ACCEPTED (`scripts/mat-reports.mjs` · [REPORTS_MAT.md](./REPORTS_MAT.md))  
- [x] CMV incl. Revenue ✅  

### Definition of Done
- [x] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ✅ 

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Email / Slack scheduled delivery | ⏸ |
| Export CSV / PDF live pipelines | ⏸ |
| External BI connectors | ⏸ |
