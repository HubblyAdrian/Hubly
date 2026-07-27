# Operate Reviews — Reputation Mission Control

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-reviews-mission-control-2662`  
**Viewport:** max 1600px · `#F7F8FC` · padding 32/32/40

## Layout

```
[ Sidebar 260px | Header · Search · Date · Request Review ]
[                | KPI row (4) ]
[                | AI Reputation Summary ]
[                | Feed (9) | Sidebar (3): Growth · Platforms · Goals · Quick Actions ]
[                | Pagination ]
```

- App bar hidden while Reviews is active (`jos-reviews-mode`)
- Header: ⭐ Reviews title, live search, date range, Request Review CTA
- KPIs: Overall Rating · New Reviews · Response Rate · Review Requests (click → drawer)
- AI summary strip with View Report · AI Actions · Refresh
- Feed tabs: Overview · Inbox · Needs Reply · Requests · Analytics · Connections
- Review cards: avatar · stars · platform · text · tags · Reply / AI Reply / Customer / More
- Sidebar: Take action · Review growth chart · Platforms · Goals · Quick actions · Copy link

## Behavior

- KPI cards open 560px right drawer (ESC / outside click closes)
- Search debounced 300ms across name, text, platform, tags
- Date range updates metrics and feed (demo)
- Request Review opens 720px 4-step modal
- Feed filters: rating, platform, tag chips with clear
- Pagination: 25/50/100 rows
- Keyboard: `/` search · `R` request · `ESC` close

## Ownership

`S.reviewsOs` remains source of truth. Reads Customers + completed Jobs. Publishes `review.*` and `reputation.changed` HublyEvents. Stage 2 live sync deferred.
