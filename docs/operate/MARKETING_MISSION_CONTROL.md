# Operate Marketing — Growth Mission Control

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-marketing-mission-control-2662`  
**Viewport:** max 1600px · `#FAFAFC` · padding 32/40

## Layout

```
[ Sidebar 260px | Header · Tabs ]
[                | KPI row (5) ]
[                | Top Campaigns | Performance | Calendar + Automations ]
[                | AI Marketing Assistant (full width) ]
```

- App bar hidden while Marketing is active (`jos-marketing-mode`)
- Header: Marketing title, date range, Publish, + New Campaign
- Tabs: Overview · Campaigns · Email · SMS · Social · Ads · Automations · Coupons · AI Studio

## Overview

- KPIs: Marketing Score (ring), Website Clicks, New Customers, Attributed Revenue, Active Campaigns
- Top campaigns with RUNNING / DRAFT / SCHEDULED badges
- Performance bars (animated)
- Content calendar + recent automations
- AI assistant strip with recommendations + Get AI Suggestions

## Ownership

`S.marketingOs` remains source of truth. Audiences read Customers/Leads. Marketplace untouched. Brand `#D9632D`.
