# Hubly HQ

Internal operating system for Hubly staff. **Not customer-facing.**

**URLs:** `/hq` · `/hubly-hq` · `/mission-control`  
**Auth:** `HUBLY_MISSION_CONTROL_SECRET`  
**API:** Edge `mission-control` (service role, read-first)

## Surfaces

CEO Daily · Platform Feed · Launch Queue · Funnel · Business Search · Business 360 · Platform/System/AI Health · Revenue · Errors · Adoption · Waitlist · Release Gate · **Proof Mode (blueprint industries)** · Impersonation (audited) · Admin Audit Log

## Proof Mode

Tracks every required industry (Detailing, Cleaning, Windows, Pressure Washing, Lawn Care, HVAC, Electrical, Plumbing, Painting, Junk Removal, Photography, Spa).

Closed Beta Ready only when industries pass Blueprint Validation + live payment/calendar proofs — see `docs/GO_LIVE_CHECKLIST.md`.

## Release Gate → RED when

- Smoke fails / stale
- Critical edges missing (after `LIVE_EDGES=1` probe)
- (Live) payments / publishing / AI gateway unhealthy

## Deploy

See `docs/INFRASTRUCTURE_BLOCKERS.md` and `scripts/deploy-proof-edges.sh`.
