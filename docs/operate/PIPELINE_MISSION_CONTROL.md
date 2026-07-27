# Operate Pipeline — Sales Mission Control

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-pipeline-mission-control-2662`  
**Viewport:** design 1600px · min 1440px desktop · `#F8F9FB` · 100vh

## Layout

```
[ Sidebar | Header · Search · KPIs ]
[         | Kanban (75%)  | Deal Workspace (25% / 360px) ]
```

- Global app bar hidden while Pipeline is active (`jos-pipeline-mode`)
- Header: **Pipeline** title + subtitle, **+ Add Lead**, **+ Bulk Deals**
- Search (52px) + Filters + Sort
- KPI cards: Open Deals · Pipeline Value · Won / Recurring · Stages
- Board: Lead → Qualified → Quote → Booked → Completed (colored headers, count + $)
- Sticky deal workspace: header, quick actions, AI Hubly Insights, Activity, Details, Tags, **Convert to Job**

## Behavior

- Click deal → workspace updates in place (no reload)
- Drag & drop between stages → persists stage override + toast
- Column **+ Add Lead** opens lead create (preferred stage remembered)
- KPI Open filters to open stages; Won filters Completed; Value/Stages toast guidance
- Tags filter the board; custom tags persist on `S.pipeline.tags`
- Keyboard: `N` new lead · `/` search · `Esc` close · arrows move stage · Delete archive
- Demo deals seeded when Hubly pipeline data is empty

## Ownership

Uses existing Pipeline OS (`S.pipeline`, leads, quotes, jobs), golden customer profile, Operate routes. Marketplace untouched. Brand accent remains Hubly `#D9632D`.

## Tech note

Implemented in Journey OS (`journey.js` + `operate-pixel.css`), not a separate React app. Spec stack (React / dnd-kit / etc.) maps to vanilla DnD + existing Hubly data events.
