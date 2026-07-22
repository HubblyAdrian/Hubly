# OpenAI-only production path

**Audit (2026-07-22):** No Hubly capability *requires* Anthropic to function.

All `TASK_ROUTES` already targeted OpenAI (`gpt-5.5` / `gpt-5-mini`). Anthropic was only:

1. Misleading “configured” check on edges (`openai || claude`)
2. `defaultProvider()` falling back to Claude for bare `complete()`
3. Dead fallback in `run()` when provider=`claude`

Claude alone could **not** successfully run skill methods (they still resolved to OpenAI and needed `OPENAI_API_KEY`).

## Production rule

| Item | Value |
|---|---|
| Production provider | **OpenAI only** |
| Default | `HUBLY_AI_PROVIDER` unset → `openai` |
| Anthropic on production path | **No** |
| Emergency Claude | `HUBLY_AI_ALLOW_CLAUDE=1` + explicit `provider: "claude"` |

## Capabilities (all OpenAI)

Business Build · Website Runtime · Creative Director · Storefront Chat · Photo Analysis · Import Offers · Draft Customer Message · Ask AI · Marketplace Intake · Planner skill methods

## Verify

```bash
rg 'api.anthropic.com' supabase/functions --glob '!**/hubly_ai.ts'   # empty
node scripts/check-hubly-ai.mjs
```
