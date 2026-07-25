#!/usr/bin/env bash
# Deploy Hubly Brain (Create OpenAI discovery) to Supabase Edge.
#
# Usage (your Mac / local terminal):
#   export SUPABASE_ACCESS_TOKEN=sbp_...   # https://supabase.com/dashboard/account/tokens
#   ./scripts/deploy-hubly-brain.sh
#
# Optional:
#   export SUPABASE_PROJECT_REF=rtwxxkxpkqdrhclkozma
#   export SET_OPENAI_SECRET=1             # only if you must rotate OPENAI_API_KEY
#   export OPENAI_API_KEY=sk-...           # used only when SET_OPENAI_SECRET=1
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-rtwxxkxpkqdrhclkozma}"

# Trim whitespace / accidental quotes from copy-paste
TOKEN="$(printf '%s' "${SUPABASE_ACCESS_TOKEN:-}" | tr -d '[:space:]"'"'")"

if [[ -z "$TOKEN" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN (sbp_… from https://supabase.com/dashboard/account/tokens)" >&2
  echo "  Do NOT use the anon key, service_role JWT, or OpenAI sk- key here." >&2
  exit 1
fi

if [[ "$TOKEN" != sbp_* ]]; then
  echo "SUPABASE_ACCESS_TOKEN has the wrong shape." >&2
  echo "  Expected: sbp_… (Account → Access Tokens)" >&2
  echo "  Got prefix: ${TOKEN:0:12}…" >&2
  echo "  Common mixups: sk-… (OpenAI), eyJ… (JWT anon/service), sbp with quotes/spaces." >&2
  exit 1
fi

export SUPABASE_ACCESS_TOKEN="$TOKEN"

echo "=== Project: $PROJECT_REF ==="
echo "=== Access token: sbp_…$(printf '%s' "$TOKEN" | tail -c 4) ==="

# OpenAI is already configured on this project (hubly-ai-status). Only rotate when asked.
if [[ "${SET_OPENAI_SECRET:-}" == "1" ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "SET_OPENAI_SECRET=1 but OPENAI_API_KEY is empty." >&2
    exit 1
  fi
  echo "=== Set OPENAI_API_KEY secret (explicit) ==="
  npx --yes supabase secrets set "OPENAI_API_KEY=${OPENAI_API_KEY}" --project-ref "$PROJECT_REF"
else
  echo "(Skipping OpenAI secret — already configured. To rotate: SET_OPENAI_SECRET=1 OPENAI_API_KEY=sk-…)"
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
print("discovery.error:", disc.get("error"))
print("reply:", (d.get("response") or disc.get("reply") or "")[:280])
if src != "openai":
  print("FAIL: expected aiSource=openai (got %r)" % (src,))
  raise SystemExit(2)
print("PASS: OpenAI discovery connected")
PY

echo ""
echo "Next: merge/deploy PR #238 frontend, open /demo, check console: S._is.discoveryAiSource"
