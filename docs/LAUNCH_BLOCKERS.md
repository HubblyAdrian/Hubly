# Launch Blockers

Facts only. No ideas.  
Updated after **Proof Mode** run 2026-07-22 (`docs/PROOF_MODE_RUN.md`).

---

## P0 — Blocks launch

### P0-1 Live production payment proof missing

**Description**  
Stripe MCP shows **zero** Connect accounts, PaymentIntents, and Charges on Hubly account `acct_1TubAAEEmwNmC4XD`. Aquaspeed is `payment_setting=later`. A–D in `PRODUCTION_PAYMENT_PROOF.md` unchecked.

**Customer impact**  
A real hire cannot pay through Hubly today. Blocks First Customer and closed beta.

**Recommended fix**  
Connect Stripe for one live business (charges_enabled), set deposit/full, run A–D with recorded session ids.

**Estimated engineering effort**  
Ops Connect onboarding + one live hire. Code only if webhook/path fails.

---

### P0-2 Google Calendar edges not deployed

**Description**  
Production `google-calendar-oauth` and `maintain-google-calendar` return **404**. Calendar Proof cannot run.

**Customer impact**  
Owners cannot trust Google sync; double-book risk unproven.

**Recommended fix**  
Deploy calendar edges + OAuth secrets; run `CALENDAR_TRUST.md` smoke (busy block → book → reschedule → cancel).

**Estimated engineering effort**  
Deploy + OAuth config + proof run. No new architecture.

---

### P0-3 Public booking CRM upsert RLS (toast)

**Description**  
On Aquaspeed confirm, anon `customers` INSERT → RLS 401 and toast “Could not save customer” even when `complete_abandoned_booking` succeeded.

**Customer impact**  
Customer sees a failure message after booking; trust broken. CRM may not update until owner accept/webhook (also unproven).

**Recommended fix**  
Skip client CRM upsert on public anon path (shipped on proof branch). Prove CRM on owner accept + paid webhook with live hire.

**Estimated engineering effort**  
Small client guard (done). Live accept/webhook proof still required.

---

### P0-4 Production missing Hubly Build / HQ edges

**Description**  
`hubly-build-business` and `mission-control` return **404** on production Supabase.

**Customer impact**  
Cannot Instant Site–build via Runtime edge; Hubly HQ unavailable in prod. Internal Launch Proof cannot create Cleaning / Lawn Care from agent.

**Recommended fix**  
Deploy edges from stack tip after merge gate; re-probe.

**Estimated engineering effort**  
Edge deploy only.

---

### P0-5 OpenAI Responses live benchmark not run

**Description**  
PR #184 stack lacks live benchmark numbers (`OPENAI_API_KEY` missing in agent).

**Customer impact**  
Cannot merge Responses stack to `main` as production-ready.

**Recommended fix**  
Staging `BENCHMARK_RUNS=2 node scripts/benchmark-openai-transport.mjs` → update benchmark doc.

**Estimated engineering effort**  
One staging run + doc.

---

### P0-6 AI / HQ stack not on `main`

**Description**  
`cursor/final-ai-migration-2662` @ `d689dd2` not ancestor of `origin/main`.

**Customer impact**  
Production may not match proven stack.

**Recommended fix**  
Merge after P0-5; deploy; re-run proofs.

**Estimated engineering effort**  
Merge + deploy.

---

### P0-7 Internal Launch Proof incomplete

**Description**  
Cleaning / Lawn Care not created; Detailing (Aquaspeed) did not pay/complete/review. See `INTERNAL_LAUNCH_PROOF.md`.

**Customer impact**  
No multi-vertical trust proof.

**Recommended fix**  
Create three businesses with owner accounts; full lifecycle; document ids.

**Estimated engineering effort**  
Ops + proof (not new systems).

---

### P0-8 Deployment smoke never recorded → Release Gate RED

**Description**  
Until `smoke-release.mjs` reports into `hubly_smoke_runs`, Release Gate e2e_smoke stays red.

**Customer impact**  
No deploy gate signal.

**Recommended fix**  
Apply smoke migration; `REPORT_SMOKE=1` on every deploy.

**Estimated engineering effort**  
Small.

---

## P1 — Should fix before beta

### P1-1 SaaS MRR is estimate only

**Description**  
HQ Revenue uses tier estimate, not billing ledger.

**Customer impact**  
Internal revenue view can mislead.

**Recommended fix**  
Keep labeled estimate until real billing exists.

**Estimated engineering effort**  
Honesty pass now.

---

### P1-2 HQ auth is shared secret bootstrap

**Description**  
HQ gates on shared secret; `platform_admins` unused as primary gate.

**Customer impact**  
Secret leak = staff OS access.

**Recommended fix**  
Auth-bind mutating actions before multi-operator beta.

**Estimated engineering effort**  
Moderate.

---

### P1-3 Owner email depends on Resend + business email

**Description**  
Notify path exists; production secret verification incomplete.

**Customer impact**  
Owners may miss email (Feed may still work).

**Recommended fix**  
Verify Resend in prod; include in live hire proof.

**Estimated engineering effort**  
Ops verify.

---

## P2 — Can wait until after launch

### P2-1 Reliability / empty / error / mobile / a11y pass incomplete

**Description**  
Launch readiness marks these Partial.

**Customer impact**  
Polish debt.

**Recommended fix**  
Post–First Customer sweep.

**Estimated engineering effort**  
Broad QA.

---

### P2-2 Marketplace expansion frozen

**Description**  
Marketplace is not First Customer North Star.

**Customer impact**  
None for Instant Site hire proof.

**Recommended fix**  
Keep frozen.

**Estimated engineering effort**  
None.
