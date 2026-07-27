# Operate Jobs — Mission Control

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-jobs-mission-control-2662`  
**Viewport:** 1440–1728px · 100vh

## Layout

```
[ Sidebar 240px | Main (scroll) | Right rail 320px sticky ]
Job Details drawer 520px (slides from right)
```

- Global app bar hidden while Jobs is active
- Sidebar: logo, + New Job, navigation, business profile
- Main: header, filter card, 5 KPIs, job table + tabs + pagination
- Rail: month calendar, upcoming jobs, business summary

## Interactions

- KPI cards filter the table (or open Revenue)
- Row / customer / status / amount / calendar day all clickable
- Status & ⋯ menus for workflow actions
- Drawer tabs: Overview · Customer · Services · Photos · Checklist · Messages · Invoice · Timeline · Activity
- Export CSV/Excel/PDF/Custom · Advanced filters drawer
- Empty state with New Job / Import Jobs

## Ownership

Uses existing Jobs OS data (`S.jobs`), handlers, and Operate routes. Marketplace untouched.
