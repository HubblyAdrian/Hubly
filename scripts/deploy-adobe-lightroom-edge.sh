#!/usr/bin/env bash
# Deploy ONLY the adobe-lightroom Edge Function (Sync Now / Create Album / browse).
# Use when OAuth is already live but Sync fails with "Failed to send a request to the Edge Function"
# or HTTP 404 NOT_FOUND on adobe-lightroom.
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   ./scripts/deploy-adobe-lightroom-edge.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"
FN="adobe-lightroom"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || die "Set SUPABASE_ACCESS_TOKEN"
[[ -f "supabase/functions/${FN}/index.ts" ]] || die "Missing supabase/functions/${FN}/index.ts"

echo "=== Deploy ${FN} → ${PROJECT_REF} ==="
npx --yes supabase functions deploy "$FN" --project-ref "$PROJECT_REF" \
  || die "Deploy failed for $FN"

BASE="https://${PROJECT_REF}.supabase.co/functions/v1/${FN}"
code="$(curl -sS -o /tmp/adobe-probe-lightroom.txt -w "%{http_code}" "$BASE" || true)"
body="$(head -c 240 /tmp/adobe-probe-lightroom.txt 2>/dev/null || true)"
echo "Probe ${BASE} → HTTP ${code}"
echo "Body: ${body}"

if [[ "$code" == "404" ]] || echo "$body" | grep -q 'NOT_FOUND'; then
  die "adobe-lightroom still NOT_FOUND after deploy"
fi

echo "OK — adobe-lightroom is reachable (HTTP ${code} is expected without a session JWT)."
