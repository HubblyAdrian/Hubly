# Adobe Lightroom Edge deploy

## Production check (2026-07-29)

```
GET …/functions/v1/adobe-oauth-*  → reachable (401 without JWT)
GET …/functions/v1/adobe-lightroom → 404 NOT_FOUND
```

That 404 is why Projects shows **Adobe Connected** (OAuth works) but **Sync Now** toasts *Failed to send a request to the Edge Function*.

## Fix

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…   # https://supabase.com/dashboard/account/tokens
export SUPABASE_PROJECT_REF=rtwxxkxpkqdrhclkozma

# Lightroom sync API only (fastest)
./scripts/deploy-adobe-lightroom-edge.sh

# Or OAuth + Lightroom together
SKIP_MIGRATION=1 ./scripts/deploy-adobe-oauth-edges.sh
```

Confirm secrets: `ADOBE_CLIENT_ID`, `ADOBE_CLIENT_SECRET`.

Probe after deploy — must **not** be `NOT_FOUND`:

```bash
curl -sS -o /tmp/lr.txt -w "%{http_code}\n" \
  "https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/adobe-lightroom"
```

## Product notes

- **Sync Now** = Adobe → Hubly pull
- **Publish Hubly gallery** = Hubly client gallery only (does not push to Adobe)
- Hubly Media → Lightroom upload is still Stage 2
