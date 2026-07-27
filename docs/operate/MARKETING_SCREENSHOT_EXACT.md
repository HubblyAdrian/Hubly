# Marketing — screenshot exact

Operate **Marketing** matches the growth Mission Control mock: greeting chrome, Overview KPIs, campaigns / performance / calendar grid, AI Marketing Assistant.

## Layout

1. **Top chrome** — greeting · global search (⌘K) · + New · Ask Hubly · bell badge · business profile chip  
2. **Header** — megaphone · Marketing + subtitle · Date range · Publish · + New Campaign  
3. **Tabs** — Overview (active) · Campaigns · Email · SMS · Social · Ads · Automations · Coupons · AI Studio  
4. **KPIs** — Marketing Score 91 · Website Clicks 48 · New Customers 7 · Attributed Revenue $0 · Active Campaigns 1  
5. **Grid** — Top Campaigns · Performance Overview · Content Calendar + Recent Automations  
6. **AI strip** — AI Marketing Assistant (BETA) · four tip cards · Get AI Suggestions  

## Files

- `public/journey-os/journey.js` — `renderMarketing`, `demoMarketingSeed`, overview chrome  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-marketing-mode` screenshot styles  

Demo KPI totals and campaign list apply only when `allowDemoSeed()`; live accounts keep real `S.marketingOs` data.
