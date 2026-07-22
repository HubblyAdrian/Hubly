# Infrastructure Blockers

**Release Candidate mode** — clearing these is the primary roadmap.  
See `docs/RELEASE_CANDIDATE.md`.

**Not product failures.** Missing deploy, secrets, Connect accounts, OAuth, tokens.

Evidence sources: `docs/EDGE_PROBE.md`, `artifacts/edge-probe.json`, Stripe MCP, agent env.

Generated: 2026-07-22 · RC entry confirmed same day.

**Invite metric:** No — until INFRA-1, INFRA-3, and INFRA-4 clear with evidence.

---

## INFRA-1 — Edge functions not deployed  ← **ACTIVE (Blocker 1)**

| Function | HTTP (2026-07-22T21:28:40Z) | Evidence |
|---|---|---|
| `hubly-build-business` | 404 NOT_FOUND | `docs/evidence/blocker1-deploy-attempt.txt` |
| `hubly-daily` | 404 NOT_FOUND | same |
| `hubly-ai-status` | 404 NOT_FOUND | same |
| `hubly-find-pro` | 404 NOT_FOUND | same |
| `hire-crm` | 404 NOT_FOUND | same |
| `mission-control` | 404 NOT_FOUND | same |

**Deploy attempt:** `./scripts/deploy-proof-edges.sh` → **FAIL** — `SUPABASE_ACCESS_TOKEN not set` (`docs/evidence/blocker1-deploy-script.txt`).  
**Cursor env:** `environment: null` (no secrets attached to this cloud run).  
**Fix:** Export `SUPABASE_ACCESS_TOKEN` (project `rtwxxkxpkqdrhclkozma`) then re-run deploy script. Do not start Blocker 2 until probe shows 0×404 for these six.

---

## INFRA-2 — Deploy / ops credentials missing in agent

| Secret | Status |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | MISSING |
| `OPENAI_API_KEY` (agent + possibly edge) | MISSING in agent; `generate-site` returns AI unavailable |
| `HUBLY_MISSION_CONTROL_SECRET` | MISSING in agent |

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
| `mission-control` edge | MISSING (404) |
| Migrations `hubly_smoke_runs` / `hubly_proof_runs` | In repo; apply on deploy |
| `/hq` static page | Route serves HTML; API dead without edge |

---

## INFRA-6 — Site deploy lag

Public CRM toast fix and Proof Mode UI are on git branches but production CDN/app may still serve older `hubly.html` until ship.

---

## How to clear

1. Export `SUPABASE_ACCESS_TOKEN` and run `./scripts/deploy-proof-edges.sh`  
2. Apply migrations through 20260722190000  
3. Set edge secrets: `OPENAI_API_KEY`, `HUBLY_MISSION_CONTROL_SECRET`, Google OAuth, Stripe  
4. Complete Stripe Connect for one deposit/full business  
5. Connect Google Calendar for one owner business  
6. Ship `public/hubly.html` + `public/mission-control.html`  
7. Re-run `node scripts/probe-production-edges.mjs` → 0 MISSING  
8. Re-run payment + calendar proofs with evidence
