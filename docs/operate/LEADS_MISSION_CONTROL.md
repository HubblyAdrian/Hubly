# Operate Leads — Dashboard v2

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-leads-mission-control-2662`  
**Viewport:** ≤1800px · `#F8F9FC`

## Layout

```
[ Sidebar 260px | Lead inbox 340px | Workspace (flex ≥900) | Right rail 340px ]
```

- Global app bar hidden while Leads is active
- Sticky header (72px): title, global search, New Lead, Bulk Actions, notifications, business, profile
- Status pills: All · New · Contacted · Qualified · Won · Lost · Unqualified
- Filter row: search, source, service, assigned, More Filters, Export

## Columns

1. **Inbox** — count + sort, 92px lead cards (avatar, badge, service, preview, phone, relative time), Load More  
2. **Workspace** — identity + Call/SMS/Email/More · tabs Overview / Activity / Notes / Appointments / Tasks / Files · score ring + AI recommendation  
3. **Rail** — Status, Assigned To, Tags, Lead Summary sparkline, Pipeline bars, Sources donut  

## Behavior

- Live search & filters · no page reloads  
- KPI / pipeline / source clicks filter the list  
- Convert to Customer copies notes/tags and marks Won  
- Keyboard: `/` search · `N` new lead · `Esc` close  
- Demo leads seeded when pipeline is empty  

## Responsive

| Breakpoint | Behavior |
|---|---|
| ≥1400 | Three columns |
| 1024–1399 | Inbox + workspace; rail grids below |
| <1024 | Stacked; FAB New Lead |
| <768 | Inbox full-screen; tap lead → workspace |

## Ownership

Uses existing Leads OS (`S.pipeline.manual`), handlers, and Operate routes. Marketplace untouched.
