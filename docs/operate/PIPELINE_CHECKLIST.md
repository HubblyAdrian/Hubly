# Module 6 — 🧭 Pipeline

**Status:** 🔓 Explicit reopen (product redesign — Mission Control)  
**Branch:** `cursor/operate-pipeline-mission-control-2662`  
**Prior lock:** Stage 1 OS locked via [#249](https://github.com/HubblyAdrian/Hubly/pull/249)  
**Spec:** [PIPELINE_MISSION_CONTROL.md](./PIPELINE_MISSION_CONTROL.md)  
**MAT:** [PIPELINE_MAT.md](./PIPELINE_MAT.md)  
**Design System:** [DESIGN_SYSTEM_V1.md](./DESIGN_SYSTEM_V1.md) · `HublyDS` (Rule #14)  
**Golden profile:** Reuse `openCustomerProfile` — never a second CRM profile

Legend: ✅ Complete · ⏸ Deferred · ⏳ Pending · 🔴 Blocked

---

## Purpose

Pipeline is the visual sales engine — Lead → Qualified → Quote → Booked → Completed. The operator should manage the deal on this page (contact, AI, tags, convert to job) without leaving Pipeline.

---

## Mission Control reopen

### Core Layout
- [x] `ownPixelView('v-pipeline', 'jos-pipeline-root')` ✅
- [x] `jos-pipeline-mode` full-height shell · hide app bar ✅
- [x] Header 80px — title 36px, subtitle, Add Lead + Bulk Deals ✅
- [x] Search 52px + Filters + Sort ✅
- [x] KPI row (4 cards · 112px) ✅
- [x] Kanban 5 columns + sticky 360px workspace ✅
- [x] Pro tip footer ✅

### Board stages (visible)
- [x] Lead (blue) ✅
- [x] Qualified (purple) ✅
- [x] Quote (orange) ✅
- [x] Booked (green) ✅
- [x] Completed (gray) ✅
- [x] Review / Membership map into Completed on board ✅

### Deal cards
- [x] Avatar · name · service · status tag · amount ✅
- [x] Hover scale · grab cursor · drag rotate ✅
- [x] Click selects workspace ✅
- [x] Drop highlight (target + green ok) ✅

### Workspace
- [x] Customer header + stage badge + value ✅
- [x] Quick actions: Call · Email · Message · Maps ✅
- [x] AI Hubly Insights + View Insights ✅
- [x] Activity + See All ✅
- [x] Details (source, owner, dates, service, vehicle) ✅
- [x] Tags + Add Tag + filter-by-tag ✅
- [x] Convert to Job CTA ✅

### Actions (`pipe-*`)
- [x] Filters / sort / KPI filters ✅
- [x] Bulk Deals (toast placeholder) ✅
- [x] Add lead / add-in-stage ✅
- [x] Call / email / maps / AI drawer ✅
- [x] Convert to job / book job ✅
- [x] Archive / stage move / DnD ✅
- [x] Open lead / golden customer profile ✅

### Responsive
- [x] Desktop 1600 / laptop 1440 ✅
- [x] Tablet horizontal board scroll ✅
- [x] Mobile stacked stages ✅

### QA
- [x] `node --check` journey.js ✅
- [ ] Visual QA 1440 / 1600 ⏳
- [ ] MAT re-run after merge candidate ⏳

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live CRM / external pipeline sync | ⏸ |
| Live quote / booking provider webhooks | ⏸ |
| Bulk CSV import | ⏸ |
| Supabase Realtime multi-user sync | ⏸ |

Do not claim “connected” in Stage 1 UI.
