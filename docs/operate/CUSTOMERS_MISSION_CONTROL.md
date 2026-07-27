# Operate Customers — CRM Command Center

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-customers-mission-control-2662`  
**Viewport:** max 1800px · `#F8F9FB`

## Layout

```
[ Sidebar 260px | List 360px | Workspace (flex) | Intelligence 340px ]
```

- Global app bar hidden while Customers is active
- Sticky header: title, global search, + Add Customer, Import, notifications, avatar
- Segments: All · Active · New · Past · VIP · Lost (with counts)

## Columns

1. **List card** — local search, All Tags, Sort, 94px customer cards, pagination  
2. **Workspace** — identity + Message · 5 stat cards · Overview / Jobs / Messages / Notes / Files / Payments  
3. **Intelligence** — Customer Value, Tags, Upcoming, Satisfaction (sticky; slide-over below 1200px)

## Behavior

- Click customer → loads workspace instantly (no golden-profile modal)
- Stats / jobs / payments / Message navigate or filter in place
- Status pill cycles Active → Inactive → Lost
- Keyboard: `/` search · `N` new customer · `Esc` close  
- Demo customers seeded when CRM is empty (James Anderson VIP, etc.)

## Responsive

| Breakpoint | Behavior |
|---|---|
| ≥1600 | Three columns (rail 340) |
| 1200–1600 | Rail 300px |
| <1200 | Intelligence slide-over + toggle |
| <768 | List → workspace stack + FAB |

## Ownership

Uses existing Customers OS (`S.customers`), golden profile retained for explicit “Open Profile”, Operate routes. Marketplace untouched. Brand accent remains Hubly `#D9632D`.
