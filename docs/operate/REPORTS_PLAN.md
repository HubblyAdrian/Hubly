# Reports — Stage 1 Plan

**Module:** 📊 Reports  
**Rules:** #14–21 (especially **#21 — Reports Never Duplicate Data**)  
**Mount:** `#v-reports` / `#jos-reports-root`

## Owns

| Entity | Store |
|--------|--------|
| Dashboards | `S.reportsOs.dashboards` |
| Saved report definitions | `S.reportsOs.definitions` |
| Layouts | `S.reportsOs.layouts` |
| Scheduled reports | `S.reportsOs.schedules` |
| Forecast models (OS) | `S.reportsOs.forecasts` |

## Reads (aggregate only — never copies)

Revenue · Memberships · Pipeline · Customers · Leads · Jobs · Marketing · Reviews

## Does not own

Customers · Payments · Jobs · Leads · Campaigns · Reviews · Memberships

## Tabs

Overview · Dashboards · Definitions · Layouts · Scheduled · Forecasts · Sources
