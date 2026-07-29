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

OAuth scopes (default): `openid,AdobeID,lr_partner_apis,lr_partner_rendition_apis,offline_access` — sufficient for catalog, albums, renditions, and **asset upload** per Adobe’s partner docs. No extra upload-specific scope is documented; customers still need Lightroom subscription/trial + storage.

Probe after deploy — must **not** be `NOT_FOUND`:

```bash
curl -sS -o /tmp/lr.txt -w "%{http_code}\n" \
  "https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/adobe-lightroom"
```

## Product notes

- **Upload to Lightroom** = Hubly Media → linked Adobe album (`createAsset` + `uploadMaster` + album link)
- **Sync Now** = Adobe → Hubly pull (matches by `lightroom_asset_id` when known)
- **Publish Hubly gallery** = Hubly client gallery only (does not push to Adobe)
- Redeploy `adobe-lightroom` after this change so production picks up upload.
