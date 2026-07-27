# Operate Memberships — Recurring Revenue Mission Control

**Status:** screenshot-exact rebuild  
**Branch:** `cursor/memberships-screenshot-exact-2662`  
**Viewport:** max 1600px · `#F5F6FA` · padding 20/40/40  
**See also:** [MEMBERSHIPS_SCREENSHOT_EXACT.md](./MEMBERSHIPS_SCREENSHOT_EXACT.md)

## Layout

```
[ Sidebar 260px | Title · Search · + New · Ask Hubly · Bell · Profile ]
[                | Create plan · Create membership · Ask Hubly ]
[                | KPI cards (Active · MRR · Churn · Renewals) ]
[                | Tabs · Filter · Start subscription ]
[                | Info banner ]
[                | Toolbar filters + search ]
[                | Subscriptions table ]
[                | Pagination ]
```

- App bar hidden while Memberships is active (`jos-memberships-mode`)
- Default tab: Subscriptions
- Demo KPIs / rows when `allowDemoSeed()`

## Ownership

`S.membershipsOs` remains source of truth. Reads Customers / Jobs / Storefront catalog. Publishes `membership.*` HublyEvents. Stripe Stage 2 deferred.
