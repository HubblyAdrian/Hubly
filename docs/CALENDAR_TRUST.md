# Calendar Trust (V1)

Owner must trust Hubly’s calendar without babysitting Google.

## Shipped in code

| Capability | Status |
|---|---|
| Busy windows RPC `get_busy_windows` | ✅ |
| Conflict detection at book / accept / reschedule | ✅ (`assertSlotOpen`) |
| Cancel + `sync_status=pending` | ✅ |
| Google maintain pending flush | ✅ |
| Retry / maintain edge | ✅ foundation |

## Production edge evidence (2026-07-22)

Correct names are **deployed** (see `docs/CALENDAR_PROOF.md`). Earlier 404s used wrong names.

| Edge | Probe |
|---|---|
| google-calendar-oauth-start | 400 business_id required |
| google-calendar-oauth-callback | 302 |
| google-calendar-maintain | 401 Unauthorized |
| google-calendar-push-job | 400 business_id required |
| get_busy_windows | 200 `[]` |

## Still required before First Customer “done”

| Item | Status |
|---|---|
| Production timezone correctness | ☐ Prove with a real business TZ + Google event |
| Google sync round-trip in production | ☐ Create/update/delete visible both sides |
| Reschedule conflict UX under load | ☐ |
| Owner never double-books after Hubly accept | ☐ |

## Smoke (staging → production)

1. Connect Google Calendar for a real business  
2. Create an external Google busy block → Hubly must refuse that slot  
3. Book via storefront → event appears in Google  
4. Reschedule in Hubly → Google updates  
5. Cancel in Hubly → Google removes / pending flush recovers  

Related: `docs/CALENDAR_PROOF.md` · migration `20260722030000_get_busy_windows.sql`
