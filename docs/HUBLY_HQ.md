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
- **Proof Mode** (Cleaning · Detailing · Lawn Care lifecycle board)
- Impersonation (audited, token hashed, read-first)
- **Admin Audit Log** (read-only list of `admin_audit_log`)

All surfaces are read-only unless explicitly mutating (waitlist invite, impersonation create, proof_step). Mutations write `admin_audit_log`.

## Proof Mode

Matrix per vertical: build → publish → booking → payment → accept → calendar → crm → complete → review → business_health → hubly_daily.

Closed Beta Ready only when all three verticals are `status=pass` (`hubly_proof_runs`).

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
   - `20260722190000_hubly_proof_runs.sql`
2. Deploy edge `mission-control` (+ `hire-crm`, `hubly-build-business` via `scripts/deploy-proof-edges.sh`)
3. Set `HUBLY_MISSION_CONTROL_SECRET`
4. Open `/hq` → Proof Mode
5. Every deploy: `node scripts/smoke-release.mjs` then `REPORT_SMOKE=1 …`
