# OpenAI Responses transport (HublyAI gateway)

**Infrastructure only.** Not a new AI capability. Not a Brain architecture change. Not a prompt change.

All OpenAI traffic goes through `supabase/functions/_shared/hubly_ai.ts`.

```
HublyAI.complete() / skill methods
  → OpenAIProvider | ClaudeProvider
      → OpenAI: Responses (default) or Chat Completions (rollback)
      → Claude: Anthropic Messages
```

Product edges keep calling `Hubly.*` unchanged.

---

## Default

| Setting | Value |
|---|---|
| Reasoning model | `gpt-5.5` |
| OpenAI transport | **Responses** (`POST /v1/responses`) |
| Privacy | `store: false` on every Responses request |
| Claude | Unchanged adapter |

---

## Rollback (no product redeploy)

Set the Edge secret / env:

```bash
OPENAI_TRANSPORT=chat          # Chat Completions rollback
OPENAI_TRANSPORT=responses     # default (or omit)
```

Aliases for chat: `chat_completions`, `completions`, `chat-completions`.

---

## Output budgets (max_output_tokens)

GPT-5.5 reasoning tokens count against the output budget. Caps leave headroom so reasoning cannot consume the entire allowance.

| Task | Budget | Notes |
|---|---:|---|
| `chat` | 2400 | Concierge / short turns |
| `reason` | 4000 | Multi-step reasoning |
| `website_builder` | 6000 | JSON site copy (largest payloads) |
| `creative_director` | 3200 | Talk + optional vision |
| `business_coach` | 3500 | Ask AI / Daily advice |
| `customer_concierge` | 2800 | Storefront + marketplace intake |
| `customer_support` | 2800 | Draft customer message |
| `marketing` | 4000 | Stub / V2 |
| `quote` | 3200 | JSON quotes |
| `photo_analysis` | 4000 | Vision + JSON |
| `memory` | 1600 | Compact memory ops |
| `lightweight` | 1200 | `gpt-5-mini` |
| `planner` | 3500 | JSON plans (if LLM planner used) |

Source of truth: `TASK_ROUTES` / `HUBLY_AI_OUTPUT_BUDGETS` in `hubly_ai.ts`.

---

## Vision

Hubly content parts (`type: "image"`) are adapted **inside the gateway**:

| Transport | Part shape |
|---|---|
| Responses | `input_text` / `input_image` + data URL |
| Chat | `text` / `image_url` |

Callers (Photo Analysis, Creative Director inspiration) keep sending Hubly `HublyImagePart`s — no edge changes.

---

## JSON

| Transport | Field |
|---|---|
| Responses | `text.format = { type: "json_object" }` |
| Chat | `response_format = { type: "json_object" }` |

Callers still receive `HublyAIResult.text` and use `extractJson` as before.

---

## Validation

```bash
node scripts/check-hubly-ai.mjs
node scripts/check-openai-responses.mjs
OPENAI_API_KEY=… node scripts/benchmark-openai-transport.mjs
```

Capability regression (gateway contract): Business Build, Website Runtime, Creative Director, Storefront Chat, Draft Customer Message, Photo Analysis, Import Offers, Marketplace Intake, Ask AI — all must still enter via HublyAI with Memory/DNA injection unchanged.

---

## Benchmark

See `docs/OPENAI_RESPONSES_BENCHMARK.md` (filled by `scripts/benchmark-openai-transport.mjs` when a key is present).
