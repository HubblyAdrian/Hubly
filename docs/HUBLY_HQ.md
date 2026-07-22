# Hubly HQ

Internal operating system for Hubly staff. **Not customer-facing.**

**Product name:** Hubly HQ  
**URLs:** `/hq` · `/hubly-hq` · `/mission-control` (legacy alias)  
**Auth:** `HUBLY_MISSION_CONTROL_SECRET` (falls back to marketplace ops / cron secret)  
**API:** Edge `mission-control` (service role, read-first)

## Philosophy

| Customers get | Hubly gets |
|---|---|
| Hubly Daily | **CEO Daily** |
| Owner Feed | **Platform Feed** |
| Business Health | **Platform Health** |

## Surfaces (verified)

- CEO Daily
- Dashboard + Platform Feed
- Launch Queue
- Customer Funnel
- Business Search + Business 360
- Platform Health · System Health · AI Health
- Revenue · Errors · Adoption
- Waitlist (invite batches)
- Release Gate (Production Readiness — **RED when smoke fails**)
- Impersonation (audited, token hashed, read-first)
- **Admin Audit Log** (read-only list of `admin_audit_log`)

All surfaces are read-only unless explicitly mutating (waitlist invite, impersonation create). Mutations write `admin_audit_log`.

## Security

- Secret gate + `admin_audit_log` on every action
- `platform_admins` for future Auth roles
- No direct DB editing from the UI
- Never returns Stripe account ids / OAuth tokens
- Impersonation tokens stored as SHA-256 only

## Deploy

1. Apply migrations:
   - `20260722160000_mission_control.sql`
   - `20260722170000_hubly_hq_waitlist_impersonation.sql`
   - `20260722180000_hubly_smoke_runs.sql`
2. Deploy edge `mission-control`
3. Set `HUBLY_MISSION_CONTROL_SECRET`
4. Open `/hq`
5. Every deploy: `node scripts/smoke-release.mjs` then `REPORT_SMOKE=1 …` so Release Gate can go green
