# Reviews — screenshot exact

Operate **Reviews** matches the reputation Mission Control mock: top chrome, four KPIs, AI + Take Action, Latest Reviews, Review Growth, Get More Reviews.

## Layout

1. **Top chrome** — global search (⌘K) · + New · Ask Hubly · bell badge · business profile  
2. **Header** — purple star · Reviews + subtitle · Export reviews · This month  
3. **KPIs** — Overall Rating 5.0 · 5-Star Reviews 45 · New This Month 8 · Response Rate 100% (Excellent)  
4. **Mid** — AI Reputation Summary · Take Action (Pending 10 / Sync Google / Sync Facebook)  
5. **Bottom** — Latest Reviews (Alex / Sam R. / Jordan) · Review Growth chart · Get More Reviews link  

## Files

- `public/journey-os/journey.js` — `renderRevMissionControl`, `demoReviewsSeed`, top chrome  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-reviews-mode` screenshot styles  

Demo KPI totals and review list apply only when `allowDemoSeed()`; live accounts keep real `S.reviewsOs` data.

## Not in mock (removed from default view)

Tabs, Request Review CTA, feed Reply/AI Reply rows, Platforms, Goals, Quick actions sidebar.
