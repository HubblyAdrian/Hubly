#!/usr/bin/env bash
# Deploy Stripe Connect + checkout edges that need the admin-key parse fix.
# Usage (Mac):
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   ./scripts/deploy-stripe-connect-edges.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN (sbp_… from https://supabase.com/dashboard/account/tokens)" >&2
  exit 1
fi
EDGES=(
  stripe-connect-onboard
  stripe-connect-connection
  create-booking-checkout
  stripe-webhook
)
for fn in "${EDGES[@]}"; do
  echo "=== Deploy $fn ==="
  npx --yes supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done
echo "Deploy complete."
