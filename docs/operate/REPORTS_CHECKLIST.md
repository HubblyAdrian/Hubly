# Module 12 — 📊 Reports

**Status:** Stage 1 OS in progress  
**Branch:** `cursor/operate-reports-2662`  
**Plan:** [REPORTS_PLAN.md](./REPORTS_PLAN.md)  
**Platform:** [PLATFORM_READINESS.md](./PLATFORM_READINESS.md)  
**Rules:** #14–21 (especially **#21**)  
**Design System:** HublyDS (Rule #14)  

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
- [ ] `ownPixelView('v-reports', 'jos-reports-root')` ⏳  
- [ ] HublyDS chrome ⏳  
- [ ] Tabs ⏳  
- [ ] Responsive ⏳  

### Tabs
- [ ] Overview (live aggregates) ⏳  
- [ ] Dashboards ⏳  
- [ ] Definitions ⏳  
- [ ] Layouts ⏳  
- [ ] Scheduled ⏳  
- [ ] Forecasts ⏳  
- [ ] Sources (owner map · Rule #21) ⏳  

### Ownership (Rule #21)
- [ ] `S.reportsOs` owns presentation config only ⏳  
- [ ] KPIs computed at read-time from owners — no payment/customer copies ⏳  
- [ ] Deep-links to Revenue / Memberships / Jobs / etc. ⏳  

### Actions (`rpt-*`)
- [ ] Create / save dashboard ⏳  
- [ ] Create / save report definition ⏳  
- [ ] Save layout ⏳  
- [ ] Schedule report (OS) ⏳  
- [ ] Run / refresh forecast (OS) ⏳  
- [ ] Navigate to owner modules ⏳  

### QA / MAT / CMV
- [ ] Validator reports gates ⏳  
- [ ] MAT ⏳  
- [ ] CMV incl. Revenue ⏳  

### Definition of Done
- [ ] OS · MAT ✅ · CMV PASS · merge → 🔒 OS ⏳  

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Email / Slack scheduled delivery | ⏸ |
| Export CSV / PDF live pipelines | ⏸ |
| External BI connectors | ⏸ |
