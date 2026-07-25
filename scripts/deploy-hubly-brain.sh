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
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
TOKEN="${TOKEN//[$'\t\r\n ']/}"
TOKEN="${TOKEN//\"/}"
TOKEN="${TOKEN//\'/}"
# CLI only accepts lowercase hex (see supabase/cli AccessTokenPattern)
TOKEN="$(printf '%s' "$TOKEN" | tr 'A-F' 'a-f')"

# Exact CLI shape: sbp_ + 40 hex, or sbp_oauth_ + 40 hex
token_ok() {
  [[ "$1" =~ ^sbp_[a-f0-9]{40}$ ]] || [[ "$1" =~ ^sbp_oauth_[a-f0-9]{40}$ ]]
}

if [[ -n "$TOKEN" ]]; then
  if ! token_ok "$TOKEN"; then
    echo "SUPABASE_ACCESS_TOKEN rejected (CLI requires sbp_ + 40 lowercase hex)." >&2
    echo "  length: ${#TOKEN}" >&2
    echo "  prefix: ${TOKEN:0:10}…" >&2
    echo "  suffix: …$(printf '%s' "$TOKEN" | tail -c 4)" >&2
    if [[ "$TOKEN" == sbp_v0_* ]]; then
      echo "  This looks experimental (sbp_v0_). Create a classic token instead." >&2
    elif [[ "$TOKEN" == sk-* ]]; then
      echo "  This is an OpenAI key. Use a Supabase account token." >&2
    elif [[ "$TOKEN" == eyJ* ]]; then
      echo "  This is a JWT (anon/service). Use a Supabase account token." >&2
    fi
    echo "" >&2
    echo "Clear the bad env var and use browser login:" >&2
    echo "  unset SUPABASE_ACCESS_TOKEN" >&2
    echo "  npx supabase login" >&2
    echo "  ./scripts/deploy-hubly-brain.sh" >&2
    exit 1
  fi
  export SUPABASE_ACCESS_TOKEN="$TOKEN"
  echo "=== Project: $PROJECT_REF ==="
  echo "=== Access token: sbp_…$(printf '%s' "$TOKEN" | tail -c 4) (len ${#TOKEN}) ==="
else
  echo "=== Project: $PROJECT_REF ==="
  echo "=== Auth: no SUPABASE_ACCESS_TOKEN — using supabase login / stored credentials ==="
  if ! npx --yes supabase projects list >/dev/null 2>&1; then
    echo "Not logged in to Supabase CLI." >&2
    echo "  npx supabase login" >&2
    echo "  ./scripts/deploy-hubly-brain.sh" >&2
    echo "" >&2
    echo "Or classic PAT from https://supabase.com/dashboard/account/tokens" >&2
    echo "  (Generate new token — classic, NOT experimental sbp_v0_)" >&2
    echo "  export SUPABASE_ACCESS_TOKEN=sbp_…   # exactly 40 hex chars after sbp_" >&2
    exit 1
  fi
fi

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

SMOKE_BODY='{
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
}'
HTTP_CODE="$(curl -sS -m 90 -o /tmp/hubly-brain-smoke.json -w '%{http_code}' -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/hubly-brain" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON}" \
  -H "Authorization: Bearer ${ANON}" \
  -d "$SMOKE_BODY" || true)"
python3 - <<PY
import json
raw = open("/tmp/hubly-brain-smoke.json").read()
code = "$HTTP_CODE"
print("http:", code)
print("bytes:", len(raw))
try:
  d = json.loads(raw) if raw.strip() else {}
except Exception:
  print("RAW:", raw[:500])
  raise SystemExit(1)
if not raw.strip():
  print("FAIL: empty response from hubly-brain")
  raise SystemExit(1)
if d.get("error") and not d.get("ok"):
  print("error:", d.get("error"))
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
