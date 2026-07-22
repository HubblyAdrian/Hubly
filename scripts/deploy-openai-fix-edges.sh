#!/usr/bin/env bash
# Redeploy edges that bundle HublyAI after gateway OpenAI fixes.
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "FAIL: export SUPABASE_ACCESS_TOKEN first"
  exit 2
fi
cd "$(dirname "$0")/.."
FUNCS=(
  hubly-ai-status
  hubly-build-business
  generate-site
  creative-director
  chatbot-message
  ai-advisor
  import-offers
  draft-customer-message
  analyze-photos
)
for fn in "${FUNCS[@]}"; do
  echo "Deploying $fn …"
  npx supabase functions deploy "$fn" --project-ref "$REF"
done
echo "Deploy complete."
