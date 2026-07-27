# Home crash + Storefront nav fix

## Problem

1. **Home could not load** — `renderHomeDashboard` threw `ReferenceError: leadValue is not defined` after demo-data cleanup (#281) mangled the Command Center function (removed `leadValue` / `staleCustomers` / related widgets while still referencing them).
2. **Storefront missing** — Inbox (#268) and Jobs (#269) Mission Control merges hid Storefront, Pipeline, Memberships, and Ask Hubly behind `jos-nav-hidden`, duplicated Jobs, and relabeled Revenue/Reports as Payments/Analytics.

## Fix

- Restore Business Command Center Home; gate demo schedule / filler behind `allowDemoSeed()`.
- Restore Operate sidebar: Home → Inbox → Jobs & Calendar → Leads → Customers → Pipeline → **Storefront** → Marketing → Reviews → Memberships → Revenue → Reports → Ask Hubly → Settings.
