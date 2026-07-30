# Hubly Create (Prompt 1)

**Product shift:** Hubly is an AI Business Builder. The conversation is the product.

**Ownership:** Hubly Create owns every **new** business going forward. Blueprint / Instant Site stays for backwards compatibility only — Create does **not** select Blueprint layouts.

## Architecture

```
Marketing CTA → /create (anonymous)
                 │
                 ├─ CreateEngine (SSOT orchestrator)
                 │    ├─ CreateSession (conversation + websiteState)
                 │    ├─ openaiCreateClient → /api/create-chat
                 │    └─ WebsiteState (empty until Prompt 2)
                 │
                 └─ React UI
                      ├─ ChatPanel (stream, markdown, upload, regenerate…)
                      └─ WebsiteCanvas (permanent mount — no generation yet)
```

## Files

| Path | Purpose |
|------|---------|
| `modules/create/` | TypeScript React module |
| `modules/create/services/createEngine.ts` | CreateEngine |
| `modules/create/state/*` | CreateSession + WebsiteState |
| `modules/create/components/WebsiteCanvas.tsx` | Permanent canvas |
| `api/create-chat.js` | OpenAI Responses API SSE proxy |
| `public/create/` | Built static assets |
| `api/router.js` | Serves `/create` |

## Extension points (Prompt 2+)

- `CreateEngine.updateWebsiteState` — apply brand/pages/sections from AI
- WebsiteCanvas — render from `WebsiteState` (do not replace the component)
- Tool calling / screenshot analysis / publishing — not in Prompt 1

## Technical debt / notes

- Session persistence is `localStorage` (anonymous). Account upgrade comes later.
- File uploads are attached to messages for UX; binary is not sent to OpenAI yet.
- Built assets are committed so Vercel does not need a React build step.
- Model default: `HUBLY_CREATE_MODEL` or `OPENAI_MODEL` or `gpt-4.1`.
