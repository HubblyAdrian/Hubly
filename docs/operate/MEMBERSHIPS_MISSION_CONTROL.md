# Operate Memberships — Recurring Revenue Mission Control

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-memberships-mission-control-2662`  
**Viewport:** max 1600px · `#F8F9FB` · padding 32/40

## Layout

```
[ Sidebar 240px | Header · Create plan · Create membership · Ask Hubly ]
[                | KPI strip (Active · MRR · Churn · Renewals) ]
[                | Tabs · Filter · Start subscription ]
[                | Info banner ]
[                | Toolbar filters + search ]
[                | Subscriptions table ]
[                | Pagination ]
```

- App bar hidden while Memberships is active (`jos-memberships-mode`)
- KPI strip: single card, 4 equal columns, clickable
- Tabs: Overview · Plans · Subscriptions · Visits · Billing · Activity (orange underline)
- Info banner: customers buy memberships / no customer clones
- Table: Customer · Plan · Status · Next Payment · Amount · Visits · Billing · Actions
- View opens 520px membership drawer (customer, membership, usage, billing, timeline, notes)

## Ownership

`S.membershipsOs` remains source of truth. Reads Customers / Jobs / Storefront catalog. Publishes `membership.*` HublyEvents. Stripe Stage 2 deferred.
