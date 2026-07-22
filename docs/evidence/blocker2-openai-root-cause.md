# OpenAI 502 — Root Cause

**Date:** 2026-07-22T22:09:12Z  
**Method:** Live `hubly-ai-status` `action=diagnose_openai` (Responses + Chat)  
**Evidence files:**  
- `docs/evidence/blocker2-openai-diagnose-responses.json`  
- `docs/evidence/blocker2-openai-diagnose-chat.json`

## Trace

```
Edge (generate-site / creative-director / …)
  → HublyAI.run / OpenAIProvider.complete
    → POST https://api.openai.com/v1/responses  (default transport)
    → OpenAI HTTP 401 invalid_api_key
    → HublyAIProviderError(status=401)
    → Edge returns HTTP 502 “temporarily unavailable”
```

## Where the 502 originates

| Step | Result |
|---|---|
| Key present in edge runtime | **YES** — `length=175`, prefix `sk-proj`, suffix `rKEA` |
| Transport | `responses` (also fails on `chat`) |
| Model | `gpt-5.5` |
| OpenAI HTTP status | **401** |
| OpenAI error code | **`invalid_api_key`** |
| OpenAI message | `Incorrect API key provided: sk-proj-…rKEA` |
| Request shape / parsing | **Not reached** — rejected at auth |

## Ruled out

- Missing key in edge runtime  
- Responses API request shape  
- Model name  
- Response parsing  
- Timeout / gateway adapter (OpenAI answered in ~194ms)  
- Chat vs Responses transport (both 401)

## Root cause

**The `OPENAI_API_KEY` secret stored on Supabase project `rtwxxkxpkqdrhclkozma` is incorrect / revoked / not a valid OpenAI key.**

HublyAI only checks non-empty presence (`configured.openai: true`), then OpenAI rejects the key → provider error → product edges map that to **502**.

## Fix (ops only — no product code change)

1. Create or copy a valid key from https://platform.openai.com/account/api-keys  
2. Set it on the project:

```bash
export SUPABASE_ACCESS_TOKEN=…
npx supabase secrets set OPENAI_API_KEY='sk-…' --project-ref rtwxxkxpkqdrhclkozma
```

3. Re-probe (no redeploy required for secret change):

```bash
curl -sS -X POST \
  'https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/hubly-ai-status' \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H 'Content-Type: application/json' \
  -d '{"action":"diagnose_openai"}'
```

Expect `diagnose.ok: true`, `httpStatus: 200`, `parsedText` containing the probe reply.

4. Then prove: Business Build, Creative Director, Website Runtime, Storefront Chat, Ask Hubly.
