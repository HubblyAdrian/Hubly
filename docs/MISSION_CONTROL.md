# Hubly Mission Control

Internal operating system for Hubly staff. **Not customer-facing.**

URL: `/mission-control`  
Auth: `HUBLY_MISSION_CONTROL_SECRET` (falls back to marketplace ops / cron secret)  
API: Edge `mission-control` (service role, read-first)

## Philosophy

| Customers get | Hubly gets |
|---|---|
| Hubly Daily | **CEO Daily** |
| Owner Feed | **Platform Feed** |
| Business Health | **Platform / System Health** |

## Surfaces

- CEO Daily
- Dashboard cards + live feed
- Launch Queue (watch businesses come alive)
- New Signups table
- Customer Funnel (drop-off)
- Business Search / 360 (Memory, DNA, payments, connections — secrets redacted)
- System Health · AI Health (incl. Responses vs Chat transport)
- Error Center · Revenue · Feature Adoption · Alerts

## Security

- Secret gate + `admin_audit_log` on every action
- `platform_admins` table ready for Auth-linked roles
- No direct DB editing from the UI
- Never returns Stripe account ids / OAuth tokens

## Deploy notes

1. Apply migration `20260722160000_mission_control.sql`
2. Deploy edge `mission-control`
3. Set `HUBLY_MISSION_CONTROL_SECRET`
4. Open `/mission-control`
