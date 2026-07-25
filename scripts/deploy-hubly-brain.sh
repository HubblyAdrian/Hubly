#!/usr/bin/env bash
# Deploy Hubly Brain (Create OpenAI discovery) to Supabase Edge.
#
# Usage (your Mac / local terminal):
#   export SUPABASE_ACCESS_TOKEN=sbp_...   # https://supabase.com/dashboard/account/tokens
#   ./scripts/deploy-hubly-brain.sh
#
# Optional:
#   export SUPABASE_PROJECT_REF=rtwxxkxpkqdrhclkozma
#   export OPENAI_API_KEY=sk-...          # only if secret not already set
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN (sbp_… from https://supabase.com/dashboard/account/tokens)" >&2
  exit 1
fi

echo "=== Project: $PROJECT_REF ==="

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  echo "=== Set OPENAI_API_KEY secret ==="
  npx --yes supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY" --project-ref "$PROJECT_REF"
else
  echo "(Skipping secrets set — OPENAI_API_KEY env not provided. Status already shows openai configured on this project.)"
fi

echo "=== Deploy hubly-brain ==="
npx --yes supabase functions deploy hubly-brain --project-ref "$PROJECT_REF"

echo "=== Deploy hubly-ai-status (optional probe) ==="
npx --yes supabase functions deploy hubly-ai-status --project-ref "$PROJECT_REF" || true

echo ""
echo "=== Smoke: discovery intent ==="
ANON="${SUPABASE_ANON_KEY:-}"
if [[ -z "$ANON" ]]; then
  # Fallback: read public anon key from hubly.html (safe — already in client)
  ANON="$(python3 - <<'PY'
import re
t=open("public/hubly.html").read()
for pat in [r"const SUPA_KEY = '([^']+)'", r"createClient\(\s*'https://[^']+',\s*'([^']+)'"]:
  m=re.search(pat,t)
  if m:
    print(m.group(1)); break
PY
)"
fi

curl -sS -m 60 -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/hubly-brain" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON}" \
  -H "Authorization: Bearer ${ANON}" \
  -d '{
    "action":"think",
    "request":"I am an independent fitness trainer.",
    "intent":"discovery",
    "discovery":{
      "seed":"I am an independent fitness trainer.",
      "facts":{},
      "history":[{"role":"owner","text":"I am an independent fitness trainer."}],
      "turns":1
    },
    "debug":true
  }' | python3 - <<'PY'
import sys, json
raw = sys.stdin.read()
try:
  d = json.loads(raw)
except Exception:
  print("RAW:", raw[:500])
  raise SystemExit(1)
disc = d.get("discovery") or {}
src = d.get("aiSource") or disc.get("source")
print("ok:", d.get("ok"))
print("aiSource:", src)
print("provider:", d.get("aiProvider") or disc.get("provider"))
print("model:", d.get("aiModel") or disc.get("model"))
print("reply:", (d.get("response") or disc.get("reply") or "")[:280])
if src != "openai":
  print("FAIL: expected aiSource=openai (got %r)" % (src,))
  raise SystemExit(2)
print("PASS: OpenAI discovery connected")
PY

echo ""
echo "Next: merge/deploy PR #238 frontend, open /demo, check console: S._is.discoveryAiSource"
