#!/usr/bin/env bash
# Deploy Stripe payment proof edges.
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "FAIL: export SUPABASE_ACCESS_TOKEN=sbp_… first"
  exit 2
fi
cd "$(dirname "$0")/.."
FUNCS=(
  create-booking-checkout
  stripe-connect-onboard
  stripe-connect-connection
  stripe-webhook
  booking-confirmed
  hire-crm
  send-customer-email
)
for fn in "${FUNCS[@]}"; do
  echo "Deploying $fn …"
  npx supabase functions deploy "$fn" --project-ref "$REF"
done
echo "Deploy complete."
