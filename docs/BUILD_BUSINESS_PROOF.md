# Build Business proof (P0 #4)

## Production probe (2026-07-22)

```
POST /functions/v1/hubly-build-business  →  404 NOT_FOUND
```

Repo path exists: `supabase/functions/hubly-build-business/index.ts`  
Frontend calls: `…/functions/v1/hubly-build-business` (`HublyAI.buildBusiness` in `public/hubly.html`)  
Auth: dry_run may be anon; persist requires owner JWT (checked in-function)  
Config: `supabase/config.toml` → `[functions.hubly-build-business] verify_jwt = false`

## Root cause

**Deployment gap** — function not published to project `rtwxxkxpkqdrhclkozma`.  
Not a frontend route bug (path matches). Not an auth mis-route (404 before handler).

Related: `generate-site` is deployed but returns `AI generation is temporarily unavailable` (OpenAI secret / provider on edge). Instant Site dry-run already falls back locally when `buildBusiness` fails.

## Fix

```bash
export SUPABASE_ACCESS_TOKEN=…
./scripts/deploy-proof-edges.sh
# or:
npx supabase functions deploy hubly-build-business --project-ref rtwxxkxpkqdrhclkozma
```

Also set edge `OPENAI_API_KEY` so Runtime AI builds succeed.

## Client hardening (this branch)

`HublyAI.buildBusiness` returns `{ ok:false, code:'not_deployed' }` on HTTP 404 instead of opaque failure.

## Pass criteria

```bash
curl -sS -X POST "$SUPA/functions/v1/hubly-build-business" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"I run a cleaning company in Denver","dry_run":true}'
# expect HTTP 200 + ok/progress JSON (not 404)
```
