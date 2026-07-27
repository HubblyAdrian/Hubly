# Pipeline — screenshot exact

Operate **Pipeline** matches the sales Kanban mock: top chrome, KPIs, five-column board, Deal Workspace rail.

## Layout

1. **Top chrome** — greeting · global search (⌘K) · + New · AI Assistant · bell badge · business profile chip  
2. **Header** — Pipeline + subtitle · + Add Lead · + Bulk Deals  
3. **Search row** — name/phone/service/vehicle/source/tags · Filters · Sort  
4. **KPIs** — Open Deals · Pipeline Value · Won / Recurring · Stages (demo: 14 / $8,197 / 0 / 7)  
5. **Board** — Lead → Qualified → Quote → Booked → Completed (colored tops, counts, totals, + Add Lead)  
6. **Deal Workspace** — title bar · stage/$ · identity · Call/Email/Chat/Maps · AI Hubly Insights · Activity · Details · Tags · Convert to Job  

## Files

- `public/journey-os/journey.js` — `renderPipeline`, demo seed (Alex Rivera…), `pipeDemoKpis`  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-pipeline-mode` screenshot styles  

Demo KPI totals show only when `allowDemoSeed()`; real CRM pipeline data is never invented for live accounts.
