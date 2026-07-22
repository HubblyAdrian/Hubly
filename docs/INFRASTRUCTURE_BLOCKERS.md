# Infrastructure Blockers

**Release Candidate mode** — clearing these is the primary roadmap.  
See `docs/RELEASE_CANDIDATE.md`.

**Not product failures.** Missing deploy, secrets, Connect accounts, OAuth, tokens.

Evidence sources: `docs/EDGE_PROBE.md`, `artifacts/edge-probe.json`, Stripe MCP, agent env.

Generated: 2026-07-22 · RC entry confirmed same day.

**Invite metric:** No — INFRA-1/2 cleared (OpenAI live); INFRA-3/4 (Stripe Connect + Google OAuth E2E) open.

---

## INFRA-1 — Edge functions not deployed  ← **CLEARED (Blocker 1 PASS)**

| Function | HTTP (2026-07-22T21:54:17Z) | Evidence |
|---|---|---|
| `hubly-build-business` | 400 `prompt required` | `docs/evidence/blocker1-deploy-success.txt` |
| `hubly-daily` | 200 | same |
| `hubly-ai-status` | 200 | same |
| `hubly-find-pro` | 400 `prompt required` | same |
| `hire-crm` | 400 `business_id required` | same |
| `mission-control` | 401 `Unauthorized` | same |

**Deploy:** Mac `./scripts/deploy-proof-edges.sh` with token → Deploy complete.  
**Full probe:** `docs/EDGE_PROBE.md` — **DEPLOYED 30 · MISSING 0** (2026-07-22T21:54:36Z).  
**Next:** INFRA-2 / Blocker 2 — verify production secrets.

---

## INFRA-2 — Production secrets (Blocker 2) ← **CLEARED (OpenAI PASS)**

Full evidence: `docs/evidence/blocker2-openai-proof-summary.json` (2026-07-22T22:18:56Z).

| Secret | Status |
|---|---|
| `OPENAI_API_KEY` (edge) | **CONFIGURED** — Responses + product edges **200** |
| `HUBLY_MISSION_CONTROL_SECRET` | **NOT VERIFIED** (HQ later) |
| `STRIPE_WEBHOOK_SECRET` | **NOT VERIFIED** (Stripe proof later) |
| `STRIPE_SECRET_KEY` (edge) | **CONFIGURED** |
| Google OAuth client id/secret | **CONFIGURED** |
| `RESEND_API_KEY` (edge + Vercel) | **CONFIGURED** |
| Supabase URL / anon / service role | **CONFIGURED** |
| Twilio | N/A for V1 |

---

## INFRA-3 — No Stripe Connect account with charges_enabled

| Check | Evidence |
|---|---|
| Stripe MCP `GetAccounts` | empty list |
| `stripe_connect_accounts` table (anon) | `[]` |
| PaymentIntents / Charges | empty |
| Pay-later businesses | disqualified from payment proof |

**Candidate:** Devdetailing661 (`payment_setting=deposit`) — Connect not complete.  
Doc: `docs/PROOF_PAYMENT_BUSINESS.md`

---

## INFRA-4 — No Google Calendar–connected business for round-trip proof

| Check | Evidence |
|---|---|
| Calendar edges | **DEPLOYED** (oauth-start/callback/push/maintain) — `docs/CALENDAR_PROOF.md` |
| Owner Google OAuth session | Not available to agent |
| Event create / reschedule / cancel | Blocked until owner connects Google |

---

## INFRA-5 — Hubly HQ / Proof Mode not live in production

| Item | Status |
|---|---|
| `mission-control` edge | DEPLOYED (401 without secret) |
| Migrations `hubly_smoke_runs` / `hubly_proof_runs` | In repo; apply on deploy |
| `/hq` static page | Route serves HTML; API dead without edge |

---

## INFRA-6 — Site deploy lag

Public CRM toast fix and Proof Mode UI are on git branches but production CDN/app may still serve older `hubly.html` until ship.

---

## How to clear

1. ~~Export `SUPABASE_ACCESS_TOKEN` and run `./scripts/deploy-proof-edges.sh`~~ **DONE** (Blocker 1 PASS)  
2. Apply migrations through 20260722190000  
3. Set edge secrets: `OPENAI_API_KEY`, `HUBLY_MISSION_CONTROL_SECRET`, Google OAuth, Stripe  
4. Complete Stripe Connect for one deposit/full business  
5. Connect Google Calendar for one owner business  
6. Ship `public/hubly.html` + `public/mission-control.html`  
7. Re-run `node scripts/probe-production-edges.mjs` → 0 MISSING  
8. Re-run payment + calendar proofs with evidence
