#!/usr/bin/env bash
# Deploy Adobe Lightroom OAuth Edge Functions + apply OAuth migration.
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_...   # https://supabase.com/dashboard/account/tokens
#   ./scripts/deploy-adobe-oauth-edges.sh
#
# Optional:
#   SUPABASE_PROJECT_REF=rtwxxkxpkqdrhclkozma
#   SKIP_MIGRATION=1   # functions only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN (sbp_… from https://supabase.com/dashboard/account/tokens)" >&2
  exit 1
fi

EDGES=(
  adobe-oauth-start
  adobe-oauth-callback
  adobe-oauth-refresh
  adobe-oauth-disconnect
)

if [[ "${SKIP_MIGRATION:-0}" != "1" ]]; then
  echo "=== Apply remote migrations (includes 20260728080000_adobe_lightroom_oauth.sql) ==="
  npx --yes supabase link --project-ref "$PROJECT_REF" || true
  npx --yes supabase db push --linked
fi

for fn in "${EDGES[@]}"; do
  echo "=== Deploy $fn ==="
  # adobe-oauth-callback has verify_jwt=false in supabase/config.toml
  npx --yes supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

CALLBACK="https://${PROJECT_REF}.supabase.co/functions/v1/adobe-oauth-callback"
echo "=== Verify callback reachable: $CALLBACK ==="
CODE="$(curl -sS -o /tmp/adobe-oauth-callback-probe.txt -w "%{http_code}" "$CALLBACK" || true)"
echo "HTTP $CODE"
head -c 400 /tmp/adobe-oauth-callback-probe.txt; echo
# Expected: 302 redirect (missing code/state) — NOT 404 NOT_FOUND
if [[ "$CODE" == "404" ]]; then
  echo "Callback still 404 — deploy may have failed." >&2
  exit 1
fi

echo
echo "Deploy complete."
echo "Register this Redirect URI in Adobe Developer Console:"
echo "  $CALLBACK"
echo "Confirm Supabase secrets exist: ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET"
