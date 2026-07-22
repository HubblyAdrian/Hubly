# Proof Mode run — updated 2026-07-22 (blocker fixes)

**Objective:** Can a real business trust Hubly?  
**Branch:** `cursor/proof-mode-2662`  
**Verdict:** **FAILED — Closed Beta Not Ready**

---

## P0 fixes in this iteration

| P0 | Fix | Deployed to prod? |
|---|---|---|
| #1 Public CRM writes | `upsertCustomer` refuses DB writes for public/anon; `hire-crm` service-role edge; stripe-webhook uses shared `crm_from_booking` | **hire-crm 404 until deploy**; client fix ships with site deploy |
| #2 Payment business | Documented: **no charges_enabled business exists** — only Devdetailing661 has deposit, Connect incomplete | N/A — ops |
| #3 Calendar 404 | **False alarm** — wrong names probed. Correct edges live (oauth-start/callback/maintain/push-job). Evidence in `CALENDAR_PROOF.md` | Calendar edges already live |
| #4 Build Business | Repo + config + deploy script; prod still **404** until `SUPABASE_ACCESS_TOKEN` deploy | **NOT deployed** (no access token in agent) |

---

## HQ Proof Mode dashboard

Added **Proof Mode** nav in Hubly HQ (`proof_mode` / `proof_step` actions + `hubly_proof_runs` migration). Shows Cleaning / Detailing / Lawn Care step matrix. Closed Beta Ready flag only when all three `status=pass`.

Requires deploy of `mission-control` + migration `20260722190000_hubly_proof_runs.sql`.

---

## Three-business lifecycle rerun

| Vertical | Build | Publish | Book | Pay | Accept | Calendar | CRM | Complete | Review | Health | Daily |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cleaning | ❌ not_deployed | — | — | — | — | — | — | — | — | — | — |
| Detailing (Aquaspeed) | — | ✅ live site | ✅ request | ❌ no Connect / pay-later | — | ⚠ edges live; Google not connected | ❌ prod still old CRM toast | — | — | — | — |
| Lawn Care | ❌ not_deployed | — | — | — | — | — | — | — | — | — | — |

**Payment business:** none eligible — see `PROOF_PAYMENT_BUSINESS.md`.

---

## Closed Beta

**Not Ready.** Do not flip `RELEASE_STATUS.md` until all three verticals pass every step with recorded ids.
