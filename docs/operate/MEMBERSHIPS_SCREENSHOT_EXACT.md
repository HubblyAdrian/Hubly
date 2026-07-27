# Memberships — screenshot exact

Operate **Memberships** matches the recurring revenue Mission Control mock: header chrome, four KPI cards, Subscriptions tab, info banner, and memberships table.

## Layout

1. **Header** — Memberships + subtitle · search · + New · Ask Hubly · bell badge 2 · profile  
2. **Actions** — Create plan · Create membership · Ask Hubly  
3. **KPIs** — Total Active 128 · MRR $8,450 · Churn 2.4% · Upcoming Renewals 23  
4. **Tabs** — Overview · Plans · **Subscriptions** · Visits · Billing · Activity · Filter · Start subscription  
5. **Banner** — customers buy memberships / plans by planId — no customer clones  
6. **Table** — Customer · Plan · Status · Next Payment · Amount · Visits · Billing · Actions  
7. **Pagination** — Showing 1–5 of 128 · pages 1 / 2 / 3 / 26 · Rows per page 10  

## Files

- `public/journey-os/journey.js` — `renderMemMissionControl`, `demoMembershipsSeed`  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-memberships-mode` screenshot styles  

Demo KPI totals and subscription rows apply only when `allowDemoSeed()`.
