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

## Surfaces

- CEO Daily (yesterday + blocker + today’s priorities)
- Dashboard + Platform Feed
- **Production Readiness Gate** (block/warn deploys)
- **Platform Health** (one score for Hubly)
- Launch Queue
- **Waitlist Manager** (invite batches · Invited → Subscribed)
- Signups · Funnel · Business 360
- **Impersonation** (audited, read-first, token hashed)
- System Health · AI Health · Errors · Revenue · Adoption · Alerts

## Security

- Secret gate + `admin_audit_log` on every action
- `platform_admins` for future Auth roles
- No direct DB editing from the UI
- Never returns Stripe account ids / OAuth tokens
- Impersonation tokens stored as SHA-256 only

## Deploy

1. Apply migrations `20260722160000_mission_control.sql` + `20260722170000_hubly_hq_waitlist_impersonation.sql`
2. Deploy edge `mission-control`
3. Set `HUBLY_MISSION_CONTROL_SECRET`
4. Open `/hq`
