# Calendar Proof — evidence (2026-07-22)

## Finding

Earlier Proof Mode 404s used **wrong edge names**:

| Wrong probe (404) | Correct production name | Live probe |
|---|---|---|
| `google-calendar-oauth` | `google-calendar-oauth-start` | **400** `business_id required` (deployed) |
| *(n/a)* | `google-calendar-oauth-callback` | **302** redirect (deployed) |
| `maintain-google-calendar` | `google-calendar-maintain` | **401** Unauthorized (deployed; secret required) |
| *(n/a)* | `google-calendar-push-job` | **400** `business_id required` |
| *(n/a)* | `google-calendar-connection` | **400** `business_id required` |
| *(n/a)* | `google-calendar-sync` | **400** `business_id required` |
| *(n/a)* | `google-calendar-inbound-sync` | **400** `business_id required` |
| *(n/a)* | `google-calendar-webhook` | **200** |

Raw log: `/opt/cursor/artifacts/calendar-build-proof-probe.txt`

## Frontend routes (verified in repo)

`public/hubly.html` invokes only the correct names (`google-calendar-oauth-start`, `push-job`, `connection`, `sync`, `inbound-sync`).

## Busy windows

`get_busy_windows(p_business_id, p_date)` — Aquaspeed 2026-07-30 → `[]` (HTTP 200). Conflict detection wired via `assertSlotOpen`.

## Still blocked for full Google lifecycle

| Step | Status |
|---|---|
| OAuth endpoint deployed | **PASS** |
| Callback deployed | **PASS** |
| Busy windows | **PASS** |
| Event creation | **BLOCKED** — needs owner Google Connect + accept job |
| Reschedule | **BLOCKED** — same |
| Cancel | **BLOCKED** — same |
| Duplicate prevention | **BLOCKED** — same |

No Google-connected business available to this agent (requires owner Auth + Google OAuth).

## Fix applied

- Documented correct edge names (no code alias needed — frontend already correct).
- Smoke checks now assert correct calendar edge filenames + client invoke names.
- Deploy script `scripts/deploy-proof-edges.sh` re-deploys calendar edges when `SUPABASE_ACCESS_TOKEN` is set.
