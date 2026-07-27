# Reports Mission Control (📊 Stage 1 OS redesign)

Analytics presentation layer for Hubly Operate. Reports is **read-only** for operational data and stores **configuration only** in `S.reportsOs` (Rule #21).

## Layout

- `#p-app.jos-reports-mode` Mission Control shell
- Content max-width **1440px**, padding **32px**, background **#F7F8FA**
- Cards: 16px radius, `#ECECEC` border, white surface, soft shadow

## Overview composition

1. Header — title/subtitle + Filters / Date range / Create dashboard / Export
2. Tabs — Overview · Dashboards · Definitions · Layouts · Schedules · Forecasts · Sources
3. KPI strip — Collected Revenue · Jobs Completed · Active Members · Review Rating
4. AI Reports Insights — beta banner + CTA
5. Mid analytics — Revenue Over Time · Jobs By Status · Quick Overview
6. Bottom analytics — Top Services · Revenue by Source · Insights & Recommendations

## Ownership

- **Reads:** Revenue · Jobs · Memberships · Reviews · Leads · Customers · Marketing · Pipeline
- **Owns:** dashboards, definitions, layouts, schedules, forecasts, activity
- **Never owns:** payments, invoices, customers, jobs, leads, campaigns, reviews, memberships, subscribers

## Interactions

- KPI cards deep-link to owner modules
- Filters open a right drawer (demo persistence on root state)
- Export opens a local menu (PDF/CSV/Excel/Print Stage 1 placeholders)
- Create dashboard opens existing OS modal (`rpt-dash-open`)
- Existing config tabs and `rpt-*` actions remain intact
