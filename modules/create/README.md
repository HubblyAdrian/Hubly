# Hubly Create — AI Business Builder

Hubly Create is the production front door for every **new** business.

It is **not** Blueprint Instant Site. Blueprint remains only for existing businesses.

## Prompt 1 foundation

| Piece | Role |
|-------|------|
| `CreateSession` | Single source of truth (conversation + websiteState) |
| `WebsiteState` | Permanent website representation (empty until Prompt 2+) |
| `CreateEngine` | Owns all Create logic — React never contains Builder logic |
| `WebsiteCanvas` | Permanent React home for future website rendering |
| `/api/create-chat` | OpenAI Responses API streaming proxy |

## Layout

- Left 40% — conversation
- Right 60% — WebsiteCanvas

Anonymous access. No login required.

## Develop

```bash
npm install --prefix modules/create
npm run create:dev    # Vite on :5174
npm run create:build  # → public/create/
```

Requires `OPENAI_API_KEY` for streaming (fails honestly when missing).

## Route

`/create` is served by `api/router.js` from `public/create/index.html`.
