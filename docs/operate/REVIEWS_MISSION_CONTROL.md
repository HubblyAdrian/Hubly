# Operate Reviews — Reputation Mission Control

**Status:** screenshot-exact rebuild  
**Branch:** `cursor/reviews-screenshot-exact-2662`  
**Viewport:** max 1600px · `#F5F6FA` · padding 20/40/40  
**See also:** [REVIEWS_SCREENSHOT_EXACT.md](./REVIEWS_SCREENSHOT_EXACT.md)

## Layout

```
[ Sidebar 260px | Top chrome: Search · + New · Ask Hubly · Bell · Profile ]
[                | Header · Export · This month ]
[                | KPI row (4): Rating · 5-Star · New · Response ]
[                | AI Reputation Summary | Take Action ]
[                | Latest Reviews | Review Growth · Get More Reviews ]
```

- App bar hidden while Reviews is active (`jos-reviews-mode`)
- Demo KPIs / latest reviews when `allowDemoSeed()`
- Tabs, Request Review CTA, Platforms, Goals, Quick actions removed from default view

## Ownership

`S.reviewsOs` remains source of truth. Reads Customers + completed Jobs. Publishes `review.*` and `reputation.changed` HublyEvents. Stage 2 live sync deferred.
