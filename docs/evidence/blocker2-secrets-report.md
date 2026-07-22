# BLOCKER 2 — Production Secrets Report

**Date:** 2026-07-22T21:58:30Z  
**Branch:** `cursor/production-proof-mode-2662`  
**Method:** Behavioral probes against production edges + Stripe MCP + Vercel API. No secret values printed.  
**Raw probe log:** `docs/evidence/blocker2-secrets-probe.txt`  
**AI status snapshot:** `docs/evidence/blocker2-hubly-ai-status.json`

**Overall Blocker 2:** **FAIL** — do not start Stripe proof.

---

## Secret inventory

| Secret | Scope | Status | Evidence |
|---|---|---|---|
| `SUPABASE_URL` | Edge (auto) | **CONFIGURED** | Edges reach past “Auth isn’t configured”; REST `https://rtwxxkxpkqdrhclkozma.supabase.co/rest/v1/businesses?slug=eq.aquaspeed` → **200** |
| `SUPABASE_ANON_KEY` | Edge + client | **CONFIGURED** | Same REST **200** with publishable anon JWT from `public/hubly.html` |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge | **CONFIGURED** | `google-calendar-oauth-start` with anon bearer → **400** `business_id required` (code path is after service-role/anon presence check; would be **500** if missing) |
| `OPENAI_API_KEY` | Edge | **INVALID** | `hubly-ai-status` → `configured.openai: true` (non-empty). Live provider calls → **502** “temporarily unavailable” on `generate-site`, `creative-director`, `import-offers`, `draft-customer-message` |
| `OPENAI_TRANSPORT` | Edge | **CONFIGURED** | `hubly-ai-status` → `openaiTransport: "responses"` |
| `OPENAI_MODEL` / reasoning | Edge | **CONFIGURED** | `reasoningModel: "gpt-5.5"` |
| `ANTHROPIC_API_KEY` | Edge | **MISSING** (not required V1) | `configured.claudeEmergency: false` — OpenAI-only production path |
| `STRIPE_SECRET_KEY` | Edge | **CONFIGURED** | `stripe-connect-onboard` → **400** `business_id required` / auth errors — **not** **503** `not_configured` |
| `STRIPE_WEBHOOK_SECRET` | Edge | **NOT VERIFIED** | Unsigned POST → **400** `Invalid signature`. Code maps both missing secret and bad signature to the same message (`stripe-webhook/index.ts`) |
| Stripe platform key (MCP) | Ops MCP | **CONFIGURED** | Stripe MCP `get_stripe_account_info` → `acct_1TubAAEEmwNmC4XD` “Hubly”; balance summary returns |
| `GOOGLE_CLIENT_ID` | Edge | **CONFIGURED** | `google-calendar-oauth-start` → **400** `business_id required` after Google key check (would be **503** if missing) |
| `GOOGLE_CLIENT_SECRET` | Edge | **CONFIGURED** | Same — both required together before `business_id` check |
| `GOOGLE_OAUTH_REDIRECT_URI` | Edge | **NOT VERIFIED** | Optional override; OAuth URL not obtained (no owner session) |
| `RESEND_API_KEY` | Edge | **CONFIGURED** | `send-customer-email` → **200** `{"ok":true}` (not “Add a RESEND_API_KEY”) |
| `RESEND_FROM_EMAIL` | Edge | **NOT VERIFIED** | Send succeeded; exact from-address not returned in body |
| `RESEND_API_KEY` | Vercel `api/*` | **CONFIGURED** | `POST https://myhubly.app/api/support-chat` `{}` → **400** `Missing message` (would be `not_configured` if key missing — `api/support-chat.js`) |
| `HUBLY_MISSION_CONTROL_SECRET` | Edge | **NOT VERIFIED** | `mission-control` → **401** with no/wrong header. Code returns unauthorized for both missing secret and wrong secret |
| `HUBLY_CRON_SECRET` / `HUBLY_MARKETPLACE_OPS_SECRET` | Edge | **NOT VERIFIED** | Fallback auth for HQ; not separately distinguishable |
| `TWILIO_*` | — | **N/A (V1)** | No Twilio references in `supabase/functions`, `api/`, or product code |

---

## Integration initialize

| Integration | Result | Evidence |
|---|---|---|
| OpenAI (key present) | **FAIL** (invalid/unusable) | Presence true; all live HublyAI provider calls **502** |
| Responses API | **FAIL** | Transport set to `responses` + model `gpt-5.5`, but provider calls fail |
| Stripe (edge init) | **PASS** (key loads) | `stripeConfigured()` path clears; checkout edge returns domain validation (`Amount too small…`) |
| Google Calendar (OAuth env) | **PASS** (keys load) | OAuth start reaches `business_id` / session checks |
| Resend | **PASS** | Edge send **200** `ok:true` |
| Mission Control | **NOT VERIFIED** | Cannot authorize; secret unknown to agent |
| HublyAI façade | **PARTIAL** | `Hubly.status()` **200**; Brain dry/local sample build returns capabilities; provider-backed edges **502** |
| Website Runtime | **PARTIAL** | Local/runtime sample in `hubly-ai-status` OK; AI `generate-site` **502** |

---

## What blocks Blocker 2 PASS

1. **OPENAI_API_KEY invalid or rejected by API** — presence alone is not enough; fix key/model access until a provider call returns success (not 502).  
2. **HUBLY_MISSION_CONTROL_SECRET** — must be proven (successful `action: ping` with secret).  
3. **STRIPE_WEBHOOK_SECRET** — must be proven (Dashboard endpoint exists + signature verify with real event, or secrets list).  

---

## Agent environment note

Cloud agent shell has **no** production secrets (`SUPABASE_ACCESS_TOKEN`, `OPENAI_API_KEY`, etc. all unset). Verification used public anon key + behavioral edge responses + Stripe MCP only.
