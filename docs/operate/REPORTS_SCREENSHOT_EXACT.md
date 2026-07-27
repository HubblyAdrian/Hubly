# Reports — screenshot exact

Operate **Reports** matches the analytics Mission Control mock: header chrome, date range, four KPIs, AI insights band, three mid widgets, and three bottom widgets.

## Layout

1. **Header** — Reports + subtitle · search · + New · Apr 15 – May 15, 2024 · bell badge 3 · Adrian's Lawn Service  
2. **Actions** — Filters · Create dashboard · Export  
3. **Tabs** — Overview (active) · Dashboards · Definitions · Layouts · Schedules · Forecasts · Sources  
4. **KPIs** — Collected Revenue $24,580 · Jobs Completed 112 ↑12.4% · Active Members 87 ↑7.8% · Review Rating 4.9  
5. **AI band** — AI – Reports Insights BETA · View full insights · Open AI chat  
6. **Mid** — Revenue Over Time · Jobs By Status (112) · Quick Overview (24 / 42% / $219 / 3)  
7. **Bottom** — Top Services (lawn verticals) · Revenue by Source · Insights & Recommendations  
8. **Help** — black `?` FAB  

Removed from Overview: Rule #21 footnote, unequal mid-column widths, non-demo KPI totals when `allowDemoSeed()`.

## Files

- `public/journey-os/journey.js` — `demoReportsSeed`, `renderReportsPageInner`, `renderReportsMcOverview`  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-reports-mode` screenshot styles  
- `scripts/screenshot-reports.mjs` — visual capture  

Demo KPI totals and service rows apply only when `allowDemoSeed()`.
