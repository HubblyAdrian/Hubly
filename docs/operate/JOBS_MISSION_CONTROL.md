# Operate Jobs — Mission Control

**Status:** 🔓 Explicit reopen (product redesign)  
**Branch:** `cursor/operate-jobs-mission-control-2662`  
**Viewport:** 1440–1728px · 100vh · `#F7F8FA`

## Layout

```
[ Sidebar 240px #111827 | Main (scroll) | Right rail 320px sticky ]
Job Details drawer 520px (slides from right)
```

- Global app bar hidden while Jobs is active
- Sidebar: logo, + New Job, navigation, business profile (never scrolls)
- Main width ≈ `calc(100% - 560px)` · padding 32 / 32 / 40
- Rail: Calendar (340px) · Upcoming (280px) · Business Summary (230px)

## Main content

1. **Header (80px)** — Jobs + subtitle · Export (CSV/Excel/PDF/Custom) · New Job · Notifications · Profile  
2. **Filter card (92px)** — Date / Status / Services / Team / Locations / Search · Source / Tags / Clear / Advanced  
3. **KPI row (5 × 110px)** — Total · Completed · In Progress · Scheduled · Revenue  
4. **Table card** — tabs (All / Scheduled / In Progress / Completed / Canceled) · sticky header · 92px rows · pagination **5 per page** (screenshot)  

## Interactions

- KPI cards filter the table (Revenue → Money)
- Row / customer / service / date / status / amount / ⋯ all clickable
- Status menu: In Progress / Complete / Reschedule / Assign / Cancel / Duplicate
- Drawer tabs: Overview · Customer · Services · Photos · Checklist · Messages · Invoice · Timeline · Activity
- Empty state: New Job + Import Jobs · demo jobs seeded when empty
- Live search · stacked filters · calendar day sync · hover 150ms · card lift 4px · button scale 1.02

## Responsive

| Breakpoint | Behavior |
|---|---|
| ≥1200 | Sidebar + Main + Rail (screenshot truth) |
| 1024–1199 | Rail collapses to Calendar / Upcoming / Summary tabs under main (sticky table headers disabled so they cannot overlay the calendar) |
| 768–1023 | Icon sidebar · filter chips · stacked job cards · FAB |
| <768 | Single column · KPI carousel · rail below list · FAB |

## Ownership

Uses existing Jobs OS data (`S.jobs`), handlers, and Operate routes. Marketplace untouched.
