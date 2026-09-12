#!/usr/bin/env bash
# Deploy Adobe Lightroom Edge Functions (OAuth + Lightroom API) + apply OAuth migration.
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_...   # https://supabase.com/dashboard/account/tokens
#   ./scripts/deploy-adobe-oauth-edges.sh
#
# Optional env:
#   SUPABASE_PROJECT_REF=rtwxxkxpkqdrhclkozma
#   SKIP_MIGRATION=1   # functions only
#
# Deploys adobe-oauth-* AND adobe-lightroom (required for Sync Now / Create Album).
# Exits non-zero if any step fails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"
MIGRATION_FILE="supabase/migrations/20260728080000_adobe_lightroom_oauth.sql"

# OAuth connect/disconnect first; adobe-lightroom is the sync/create API the UI calls.
EDGES=(
  adobe-oauth-start
  adobe-oauth-callback
  adobe-oauth-refresh
  adobe-oauth-disconnect
  adobe-lightroom
)

die() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  die "Set SUPABASE_ACCESS_TOKEN (sbp_… from https://supabase.com/dashboard/account/tokens)"
fi

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v npx >/dev/null 2>&1 || die "npx is required"

echo "=== Preflight: confirm Edge Function sources exist ==="
[[ -f "$MIGRATION_FILE" ]] || die "Missing migration $MIGRATION_FILE"
for fn in "${EDGES[@]}"; do
  path="supabase/functions/${fn}/index.ts"
  [[ -f "$path" ]] || die "Missing function source: $path"
  echo "  OK  $path"
done

if [[ "${SKIP_MIGRATION:-0}" != "1" ]]; then
  echo
  echo "=== Migrations: NOT pushed from here ==="
  # `supabase db push` was removed from this script on 2026-09-12, and it is banned
  # repo-wide (scripts/check-no-db-push.mjs fails the run if it reappears anywhere).
  #
  # WHY. push replays every migration the ledger does not know about — 53 files today —
  # and one of them, 20260823140000_mark_test_accounts.sql, carries
  #   update businesses set account_kind='test' where account_kind<>'test' and id not in (…)
  # followed by a statement that cannot run any more. Running it relabels every market and
  # internal business as a test account. It came one statement away from doing exactly that
  # on 2026-09-12; the transaction rolled back, which was luck about scope, not a safeguard.
  #
  # Apply ONE migration deliberately instead:
  #   supabase db query --linked -f supabase/migrations/<file>.sql
  npx --yes supabase link --project-ref "$PROJECT_REF" || true
  echo "  SKIPPED  apply any needed migration by hand, one file at a time"
fi

echo
echo "=== Deploy Adobe Edge Functions to ${PROJECT_REF} ==="
for fn in "${EDGES[@]}"; do
  echo "--- Deploy $fn ---"
  # adobe-oauth-callback has verify_jwt=false in supabase/config.toml
  npx --yes supabase functions deploy "$fn" --project-ref "$PROJECT_REF" \
    || die "Deploy failed for $fn"
  echo "  OK  deployed $fn"
done

BASE="https://${PROJECT_REF}.supabase.co/functions/v1"
CALLBACK="${BASE}/adobe-oauth-callback"

echo
echo "=== Verify deployment (must not be 404 NOT_FOUND) ==="
FAILED=0
for fn in "${EDGES[@]}"; do
  url="${BASE}/${fn}"
  code="$(curl -sS -o "/tmp/adobe-probe-${fn}.txt" -w "%{http_code}" "$url" || true)"
  body="$(head -c 200 "/tmp/adobe-probe-${fn}.txt" 2>/dev/null || true)"
  echo "  $fn → HTTP $code"
  if [[ "$code" == "404" ]] || echo "$body" | grep -q 'NOT_FOUND'; then
    echo "    body: $body" >&2
    FAILED=1
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  die "One or more functions still return 404 NOT_FOUND after deploy — Sync Now will fail until adobe-lightroom is live"
fi

# Callback should be reachable without Hubly JWT (verify_jwt=false).
# Expected without ?code=&state=: redirect (302) or error page — not platform NOT_FOUND.
echo
echo "Callback URL: $CALLBACK"
echo "Deploy succeeded (including adobe-lightroom)."
echo
echo "Manual steps still required:"
echo "  1. Adobe Developer Console → Redirect URI:"
echo "       $CALLBACK"
echo "  2. Confirm Supabase Edge secrets: ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET"
echo "  3. In Projects → Lightroom → Sync Now (should no longer say Edge Function failed)"
