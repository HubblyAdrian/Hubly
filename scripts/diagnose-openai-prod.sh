#!/usr/bin/env bash
# Deploy hubly-ai-status + run OpenAI diagnose (captures real provider error).
# Requires: SUPABASE_ACCESS_TOKEN
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"
ANON="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d3h4a3hwa3FkcmhjbGtvem1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjA4MjgsImV4cCI6MjA5Nzk5NjgyOH0.ky9ycGJ621E4ab078pCIR4-1X_XS6OUpfPmH3v8tzf8}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "FAIL: export SUPABASE_ACCESS_TOKEN first"
  exit 2
fi
cd "$(dirname "$0")/.."
git pull origin cursor/production-proof-mode-2662
echo "Deploying hubly-ai-status…"
npx supabase functions deploy hubly-ai-status --project-ref "$REF"
BASE="https://${REF}.supabase.co/functions/v1/hubly-ai-status"
echo ""
echo "=== diagnose responses (default) ==="
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"action":"diagnose_openai"}' | tee /tmp/hubly-openai-diagnose-responses.json
echo ""
echo "=== diagnose chat rollback ==="
curl -sS -X POST "$BASE" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"action":"diagnose_openai","transport":"chat"}' | tee /tmp/hubly-openai-diagnose-chat.json
echo ""
echo "Done. Paste both JSON outputs (no secrets beyond key prefix/suffix)."
