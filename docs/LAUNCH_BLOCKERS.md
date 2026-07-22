# Launch Blockers

Facts only. No ideas.

---

## P0 — Blocks launch

### P0-1 Live production payment proof missing

**Description**  
Code for Stripe Checkout + webhook paid/failed/refunded + CRM/job updates exists, but `docs/PRODUCTION_PAYMENT_PROOF.md` has zero checked live boxes.

**Customer impact**  
Cannot prove a customer can pay and that money + CRM + Feed update without Hubly staff rescue. Blocks First Customer and closed beta.

**Recommended fix**  
Run one live hire on a charges_enabled Connect account. Complete A–D in `docs/PRODUCTION_PAYMENT_PROOF.md`. Record session ids in the proof table.

**Estimated engineering effort**  
Ops proof run + verification against Feed/CRM/jobs (no new product systems). Small code fixes only if a live failure appears.

---

### P0-2 OpenAI Responses live benchmark not run

**Description**  
PR #184 is merged into the AI stack tip, but `docs/OPENAI_RESPONSES_BENCHMARK.md` still has no live numbers. Cloud agent has no `OPENAI_API_KEY`. Script exists: `scripts/benchmark-openai-transport.mjs`.

**Customer impact**  
Cannot promote Responses as production-ready. Stack must not merge to `main` until benchmark merge criteria pass (or transport rolled back to `OPENAI_TRANSPORT=chat`).

**Recommended fix**  
On staging with `OPENAI_API_KEY`:  
`BENCHMARK_RUNS=2 node scripts/benchmark-openai-transport.mjs`  
Paste results into `docs/OPENAI_RESPONSES_BENCHMARK.md`. Keep chat rollback documented.

**Estimated engineering effort**  
Staging secret + one benchmark run + doc update. No architecture work.

---

### P0-3 AI / HQ stack not on `main`

**Description**  
`cursor/final-ai-migration-2662` @ `d689dd2` (Responses + HQ + OpenAI-only) is not an ancestor of `origin/main`. Production deploys from `main` do not include this stack.

**Customer impact**  
Production may still run older AI/gateway behavior. HQ Release Gate and OpenAI-only path are not what customers get until merged/deployed.

**Recommended fix**  
After P0-2 green: merge open stack PRs (#182/#183 chain) into `main`, deploy edges + migrations, re-run smoke.

**Estimated engineering effort**  
Merge conflict resolution if any + edge deploy + migration apply. No new features.

---

### P0-4 Deployment smoke never recorded → Release Gate RED

**Description**  
Release Gate `e2e_smoke` reads `hubly_smoke_runs`. Until `scripts/smoke-release.mjs` passes and reports (`REPORT_SMOKE=1`), gate stays blocked/red by design.

**Customer impact**  
No trustworthy deploy signal. Risk of shipping broken Business Build / publish / booking / pay / HQ paths unnoticed.

**Recommended fix**  
Apply migration `20260722180000_hubly_smoke_runs.sql`. Run smoke on every deploy; report to HQ. Fix any FAIL before promoting.

**Estimated engineering effort**  
Wire CI/deploy hook to `node scripts/smoke-release.mjs` + secret for report. Small.

---

## P1 — Should fix before beta

### P1-1 Calendar timezone / Google sync production proof open

**Description**  
Busy windows, conflict checks, and Google push exist (`docs/CALENDAR_TRUST.md` still open). No recorded production round-trip proof.

**Customer impact**  
Double-bookings or wrong local times erode trust for First Customer businesses with Google Calendar.

**Recommended fix**  
Prove one accept → Google event → busy window blocks overlap in production TZ. Document in `CALENDAR_TRUST.md`.

**Estimated engineering effort**  
Ops proof + targeted bugfix if mismatch found.

---

### P1-2 SaaS MRR is estimate only

**Description**  
HQ Revenue uses `tier=pro` × $29 estimate; no Hubly billing ledger.

**Customer impact**  
Internal decisions on revenue/adoption can be wrong during beta.

**Recommended fix**  
Either label UI as estimate-only everywhere (already noted) or wire a real subscription source when billing exists — do not invent V2 billing now.

**Estimated engineering effort**  
Doc/UI honesty pass now; real billing later (post-beta).

---

### P1-3 HQ auth is shared secret bootstrap

**Description**  
Hubly HQ gates on `HUBLY_MISSION_CONTROL_SECRET`; `platform_admins` table exists but owner Auth roles are not the primary gate.

**Customer impact**  
Secret leak = full staff OS access. Acceptable for internal testing; weak for multi-operator beta.

**Recommended fix**  
Require `platform_admins` Auth user match for mutating actions; keep secret as break-glass.

**Estimated engineering effort**  
Moderate Auth wiring; read-only surfaces can stay secret-gated short-term.

---

### P1-4 Owner email depends on Resend + business email

**Description**  
Booking notify path uses `api/notify.js`; without `RESEND_API_KEY` / owner email, in-app Feed still works but email may not.

**Customer impact**  
Owners miss booking emails; may think Hubly “didn’t notify.”

**Recommended fix**  
Verify secrets in production; HQ System Health already flags email. Add smoke live check when keys present.

**Estimated engineering effort**  
Ops secret verification + optional live smoke probe.

---

## P2 — Can wait until after launch

### P2-1 Reliability / empty / error / mobile / a11y pass incomplete

**Description**  
`docs/LAUNCH_READINESS_REPORT.md` marks Performance, Mobile, Accessibility as Partial.

**Customer impact**  
Polish and edge-case UX debt; not a hard payment blocker.

**Recommended fix**  
Scheduled reliability pass after First Customer proof.

**Estimated engineering effort**  
Broad QA sweep; many small fixes.

---

### P2-2 Marketplace / Get Done paths are secondary to Instant Site hire

**Description**  
Marketplace stack exists on other branches; North Star is Instant Site hire revenue.

**Customer impact**  
Consumer marketplace quality does not block owner First Customer.

**Recommended fix**  
Do not expand marketplace architecture. Keep frozen until Instant Site hire is proven.

**Estimated engineering effort**  
None now (freeze).
