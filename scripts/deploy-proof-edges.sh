#!/usr/bin/env bash
# Deploy Proof Mode critical edges to production.
# Requires: SUPABASE_ACCESS_TOKEN + project linked (or --project-ref).
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "FAIL: SUPABASE_ACCESS_TOKEN not set — cannot deploy"
  echo "Fix: export SUPABASE_ACCESS_TOKEN=… then re-run"
  exit 2
fi
FUNCS=(
  hubly-build-business
  hubly-daily
  hubly-ai-status
  hubly-find-pro
  hire-crm
  mission-control
  google-calendar-oauth-start
  google-calendar-oauth-callback
  google-calendar-maintain
  google-calendar-push-job
  google-calendar-connection
  google-calendar-sync
  google-calendar-inbound-sync
  google-calendar-webhook
)
for fn in "${FUNCS[@]}"; do
  echo "Deploying $fn …"
  npx supabase functions deploy "$fn" --project-ref "$REF"
done
echo "Deploy complete. Probe:"
echo "  curl -sS -X POST \"https://${REF}.supabase.co/functions/v1/hubly-build-business\" -H \"Authorization: Bearer \$ANON\" -H \"apikey: \$ANON\" -H 'Content-Type: application/json' -d '{\"prompt\":\"test\",\"dry_run\":true}'"
