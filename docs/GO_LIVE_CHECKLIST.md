# Go Live Checklist

**Release Candidate mode.** Inventing is frozen.  
Every remaining task before inviting Closed Beta customers.  
Ordered by impact. Infrastructure vs product labeled.

When **every** box is checked → Closed Beta Ready → invite metric can become **Yes**.

Mode: `docs/RELEASE_CANDIDATE.md`

---

## 1. Clear production edge gaps (INFRASTRUCTURE) — **BLOCKER 1 / PASS**

- [x] Set `SUPABASE_ACCESS_TOKEN` for deploy ← Mac operator (len=44), 2026-07-22
- [x] Run `./scripts/deploy-proof-edges.sh` ← Deploy complete
- [x] Live probe each of the six → not 404 (validation 400/401/200 OK)
- [x] `node scripts/probe-production-edges.mjs` → **0 MISSING** (30 DEPLOYED)
- [x] Evidence attached: `docs/EDGE_PROBE.md` + `docs/FINAL_LAUNCH_AUDIT.md` Blocker 1 + `docs/evidence/blocker1-deploy-success.txt`

Cleared: `hubly-build-business`, `hubly-daily`, `hubly-ai-status`, `hubly-find-pro`, `hire-crm`, `mission-control`  
**Next:** §2 Edge secrets (Blocker 2).

---

## 2. Edge secrets (INFRASTRUCTURE) — **BLOCKER 2 / FAIL**

Evidence: `docs/evidence/blocker2-secrets-report.md` (2026-07-22T21:58Z)

- [ ] `OPENAI_API_KEY` usable on edge ← **INVALID** (present but provider calls **502**)
- [ ] `HUBLY_MISSION_CONTROL_SECRET` ← **NOT VERIFIED**
- [x] `STRIPE_SECRET_KEY` on edge ← **CONFIGURED** (onboard not `not_configured`)
- [ ] `STRIPE_WEBHOOK_SECRET` ← **NOT VERIFIED**
- [x] Google `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ← **CONFIGURED**
- [ ] Google redirect URI exercised ← **NOT VERIFIED**
- [x] `RESEND_API_KEY` (edge + Vercel) ← **CONFIGURED** (edge send **200**)
- [x] Supabase URL / anon / service role ← **CONFIGURED**
- [x] Twilio ← **N/A (V1)**

**STOP — no Stripe proof until Blocker 2 reviewed/cleared.**

---

## 3. Database migrations (INFRASTRUCTURE)

- [ ] Apply through `20260722190000_hubly_proof_runs.sql`
- [ ] Apply `20260722191000_hubly_proof_runs_industries.sql`

---

## 4. Ship owner app + HQ UI (INFRASTRUCTURE)

- [ ] Deploy `public/hubly.html` (public CRM guard + hire-crm client)
- [ ] Deploy `public/mission-control.html` (Proof Mode board)
- [ ] Verify `/hq` unlocks against live `mission-control`

---

## 5. Stripe Connect payment business (INFRASTRUCTURE)

- [ ] One business with `charges_enabled = true`
- [ ] `payment_setting` = deposit or full (not later)
- [ ] Document in `docs/PROOF_PAYMENT_BUSINESS.md` (name, id, Connect account id)

Preferred candidate: Devdetailing661 (already deposit)

---

## 6. Production Payment Proof (PRODUCT flow on live infra)

- [ ] Customer books
- [ ] Checkout opens
- [ ] Payment succeeds
- [ ] Webhook marks paid
- [ ] CRM upserts (service-role)
- [ ] Calendar updates (if connected)
- [ ] Receipt / owner notify
- [ ] Business Health updates
- [ ] Hubly Daily reflects hire
- [ ] Review request path exercised  
Evidence: filled `docs/PRODUCTION_PAYMENT_PROOF.md` A–D

---

## 7. Calendar Proof (PRODUCT flow on live infra)

- [ ] Owner completes Google OAuth
- [ ] Busy windows refuse Google busy slot
- [ ] Accept creates Google event (event id recorded)
- [ ] Reschedule updates event
- [ ] Cancel removes / flushes
- [ ] No duplicates  
Evidence: `docs/CALENDAR_PROOF.md` + event ids

---

## 8. Blueprint buildability + Living Blueprints (PRODUCT)

Permanent rule: Hubly supports businesses — knowledge is the moat.

- [x] Every supported industry can complete Build My Business (official **or** Living AI blueprint)
- [x] `node scripts/validate-blueprints.mjs` → **12 PASS / 0 FAIL**
- [x] Blueprint Source: Official · AI Generated · Hybrid · Community Learned · Hubly Optimized
- [x] HQ-only `blueprintReasoning` (“why I built it this way”)
- [x] Blueprint Intelligence (community signals + seed suppressions)
- [x] **AI Review Pass** before publish (`website-ai-review.js` — score &lt;90 regenerates weak sections)
- [x] Hubly HQ **AI Learning** dashboard (in git; needs mission-control deploy)
- [ ] Apply migration `20260722200000_hubly_blueprint_signals.sql`
- [ ] Live `hubly-build-business` for ≥1 official + ≥1 generated industry (needs INFRA-1)

Evidence: `docs/BLUEPRINT_VALIDATION_REPORT.md`

---

## 9. Live Build My Business (PRODUCT + INFRA)

- [ ] `hubly-build-business` dry_run HTTP 200
- [ ] Persist build for ≥1 industry creates Memory + DNA + website seeds
- [ ] Handcraft spot-check vs blueprint voice

---

## 10. Hubly HQ Release Gate (INFRASTRUCTURE + automation)

- [ ] CEO Daily / Feed / Launch Queue / Search / 360 load
- [ ] Platform / System / AI Health load
- [ ] Proof Mode board shows industries
- [ ] Admin Audit Log + Impersonation audited
- [ ] Smoke `LIVE_EDGES=1 node scripts/smoke-release.mjs` → green
- [ ] `REPORT_SMOKE=1` records green; Release Gate not RED

---

## 11. Final status docs

- [ ] `docs/RELEASE_STATUS.md` Closed Beta → Ready (only after 1–10)
- [ ] `docs/INFRASTRUCTURE_BLOCKERS.md` empty / all cleared
- [ ] Human review sign-off

---

## Do not do in Release Candidate / before Closed Beta

- New AI systems / agents / prompt rewrites for their own sake  
- V2 Marketing / Living Marketplace / Autonomous Growth  
- New architecture layers  
- UX redesigns or philosophy changes (feel is frozen — see `docs/RELEASE_CANDIDATE.md`)  
- Expanding beyond this go-live checklist  

If it is not Infrastructure, Production Proof, or a Bug Fix — do not build it.
