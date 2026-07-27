# Reports Mission Control (📊 Stage 1 OS redesign)

Analytics presentation layer for Hubly Operate. Reports is **read-only** for operational data and stores **configuration only** in `S.reportsOs` (Rule #21).

See also: [REPORTS_SCREENSHOT_EXACT.md](./REPORTS_SCREENSHOT_EXACT.md) for the locked visual layout.

## Layout

- `#p-app.jos-reports-mode` Mission Control shell
- Content max-width **1600px**, padding **40px**, background **#F5F6FA**
- Cards: 16px radius, `#E8EAF0` border, white surface, soft shadow

## Overview composition

1. Header chrome — search · + New · date range · notifications · profile
2. Actions — Filters · Create dashboard · Export
3. Tabs — Overview · Dashboards · Definitions · Layouts · Schedules · Forecasts · Sources
4. KPI strip — Collected Revenue $24,580 · Jobs Completed 112 · Active Members 87 · Review Rating 4.9 (demo)
5. AI – Reports Insights — BETA banner + CTAs
6. Mid analytics — Revenue Over Time · Jobs By Status · Quick Overview (equal columns)
7. Bottom analytics — Top Services · Revenue by Source · Insights & Recommendations
8. Help FAB — black `?`

## Ownership

- **Reads:** Revenue · Jobs · Memberships · Reviews · Leads · Customers · Marketing · Pipeline
- **Owns:** dashboards, definitions, layouts, schedules, forecasts, activity
- **Never owns:** payments, invoices, customers, jobs, leads, campaigns, reviews, memberships, subscribers
- Demo KPI/service filler applies only when `allowDemoSeed()` / `_ceoDemo`

## Interactions

- KPI cards deep-link to owner modules
- Filters open a right drawer (demo persistence on root state)
- Export opens a local menu (PDF/CSV/Excel/Print Stage 1 placeholders)
- Create dashboard opens existing OS modal (`rpt-dash-open`)
- Existing config tabs and `rpt-*` actions remain intact
