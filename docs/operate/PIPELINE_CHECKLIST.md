# Module 6 — 🧭 Pipeline

**Status:** 🔒 OS LOCKED (Stage 1) — merged #249  
**Branch:** `cursor/operate-pipeline-2662`  
**PR:** [#249](https://github.com/HubblyAdrian/Hubly/pull/249)  
**MAT:** [PIPELINE_MAT.md](./PIPELINE_MAT.md)  
**Design System:** [DESIGN_SYSTEM_V1.md](./DESIGN_SYSTEM_V1.md) · `HublyDS` (Rule #14)  
**Stage in scope:** Stage 1 — Operating System  
**Golden profile:** Reuse `openCustomerProfile` — never a second CRM profile

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Pipeline is the sales engine — Lead → Qualified → Quote → Booked → Completed → Review → Membership. Stage 1 runs on Hubly data (leads, quotes, jobs, customers). Cards open existing surfaces (Leads, golden Customer profile, Jobs, Smart Quote).

---

## Stage 1 — Operating System

### Core Layout
- [x] `ownPixelView('v-pipeline', 'jos-pipeline-root')` ✅
- [x] Page header (search, filters, Add Lead / Quick Quote) ✅
- [x] KPI strip (deals by stage / value) ✅
- [x] Board columns (7 sales stages) ✅
- [x] Right detail sidebar on card select ✅
- [x] Board view (default) ✅
- [x] Responsive layout ✅

### Board stages
- [x] Lead ✅
- [x] Qualified ✅
- [x] Quote ✅
- [x] Booked ✅
- [x] Completed ✅
- [x] Review ✅
- [x] Membership ✅

### Search
- [x] Real-time filter: name, phone, service, vehicle, source, stage ✅
- [x] ESC clears search ✅

### Filters (drawer · HublyDS `filterDrawer`)
- [x] Stage ✅
- [x] Source ✅
- [x] Service ✅
- [x] Value range ✅
- [x] Apply / Reset / Save Filter ✅

### Detail sidebar (HublyDS)
- [x] Contact + stage badge ✅
- [x] Amount / service meta ✅
- [x] AI next action (`aiInsightCard`) ✅
- [x] Timeline / activity (`activityFeed`) ✅
- [x] Stage prev / next + stage picker ✅
- [x] Action toolbar ✅

### Card interactions
- [x] Click selects + shows detail ✅
- [x] Drag-drop between columns → persist stage override ✅
- [x] `HublyDS.pipelineCard` when available (fallback OK) ✅

### Actions (`pipe-*`)
- [x] Filter open / apply / reset / save ✅
- [x] Search ✅
- [x] Select card ✅
- [x] Move stage (prev / next / picker) ✅
- [x] Open lead ✅
- [x] Open customer golden profile (`openCustomerProfile`) ✅
- [x] Create quote ✅
- [x] Book job ✅
- [x] Request review ✅
- [x] Offer membership ✅
- [x] Archive ✅
- [x] AI refresh ✅

### Design System usage (Rule #14)
- [x] `pageHeader`, `searchBar`, `filterDrawer` ✅
- [x] `metricCard`, `aiInsightCard`, `activityFeed` ✅
- [x] `actionToolbar`, `actionButton`, `statusBadge` ✅
- [x] `emptyState`, `sectionHeader`, `pipelineCard` ✅

### Empty / Error / Mobile
- [x] Empty column state ✅
- [x] Empty board (no cards) ✅
- [x] Error + Retry ✅
- [x] Responsive Desktop / Tablet / Mobile ✅

### Integrations (Stage 2 placeholders only)
- [x] Live CRM sync → toast “Stage 2 · not connected” ✅

### QA / MAT / CMV
- [x] Buttons / navigation functional ✅
- [x] Validator pipeline gate ✅
- [x] CMV includes Customers ✅
- [x] MAT formal acceptance ✅ (`docs/operate/PIPELINE_MAT.md`)

### Stage 1 Definition of Done
- [x] Pipeline OS complete (Stage 1) ✅
- [x] HublyDS v1 for new UI ✅
- [x] Golden profile reused ✅
- [x] Validator PASS ✅
- [x] CMV PASS (locked modules incl. Customers) ✅
- [x] MAT ✅ ACCEPTED ✅
- [x] Merged #249 → **🔒 OS LOCKED** ✅

---

**Pipeline Operating System is locked (🔒 OS).** Do not modify Stage 1 OS unless bug fix, Stage 2 integrations, or explicit reopen.

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live CRM / external pipeline sync | ⏸ |
| Live quote / booking provider webhooks | ⏸ |
| Live review platform sync | ⏸ |

Do not claim “connected” in Stage 1 UI.
