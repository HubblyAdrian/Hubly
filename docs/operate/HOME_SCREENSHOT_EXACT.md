# Operate Home — screenshot-exact Mission Control

**Status:** active rebuild  
**Branch:** `cursor/home-screenshot-exact-2662`  
**Supersedes UI of:** Command Center v2 (`jos-home-v2`)

## Composition (desktop)

1. **Header** — `Welcome back, {name}` · subtitle · `+ New` · bell · profile  
2. **KPI row** — Total Revenue · Jobs Completed · New Leads · Avg. Rating (sparklines)  
3. **Mid row** — AI Business Coach (wide, dark) · Bookings Overview · Today's Agenda  
4. **Bottom row** — Recent Leads · Revenue Summary · Performance Score  
5. **Quick Actions** strip  

## Shell

- `#p-app.jos-pixel.jos-home-mode` hides global app bar (page owns chrome)  
- Sidebar stays Operate navy; Home nav item brand-orange active  
- Markup: `.jos-home-shot` in `journey.js` · styles in `operate-pixel.css`  

## Data

Real CRM when present. `allowDemoSeed()` / CEO demo only fills empty KPIs, agenda, leads, charts.
