# Go Live Checklist

**Release Candidate mode.** Inventing is frozen.  
Canonical board: [`docs/LAUNCH_PROOF.md`](./LAUNCH_PROOF.md)

| Proof | Status |
|---|---|
| AI Proof | ✅ |
| Infrastructure Proof | ✅ |
| Revenue Proof | □ |
| Scheduling Proof | □ |
| New Owner Proof | □ |
| Closed Beta | □ |

When **every** Launch Proof box is checked → invite metric can become **Yes**.

Mode: `docs/RELEASE_CANDIDATE.md`

---

## Infrastructure Proof ✅

- [x] Set `SUPABASE_ACCESS_TOKEN` for deploy ← Mac operator, 2026-07-22
- [x] Run `./scripts/deploy-proof-edges.sh` ← Deploy complete
- [x] Live probe each of the six → not 404 (validation 400/401/200 OK)
- [x] `node scripts/probe-production-edges.mjs` → **0 MISSING** (30 DEPLOYED)
- [x] Evidence: `docs/EDGE_PROBE.md` + `docs/evidence/blocker1-deploy-success.txt`

---

## AI Proof ✅

Evidence: `docs/evidence/blocker2-openai-proof-after-fix.txt` (2026-07-22T22:18:56Z)

- [x] `OPENAI_API_KEY` usable on edge
- [x] HublyAI proofs: Build · Creative Director · Website · Storefront Chat · Ask Hubly
- [x] Supabase URL / anon / service role configured for AI path
- [ ] `HUBLY_MISSION_CONTROL_SECRET` ← NOT VERIFIED (HQ later)
- [ ] `STRIPE_WEBHOOK_SECRET` ← NOT VERIFIED (Revenue Proof)
- [x] Google OAuth client id/secret configured (Scheduling Proof later)
- [x] `RESEND_API_KEY` configured

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

## Revenue Proof □

- [ ] Deploy checkout admin-client fix (`./scripts/deploy-stripe-proof-edges.sh`)
- [ ] Checkout no longer returns `Business not found` for real business ids
- [ ] One business with `charges_enabled = true`
- [ ] `payment_setting` = deposit or full (not later)
- [ ] Document in `docs/PROOF_PAYMENT_BUSINESS.md` (name, id, Connect account id)
- [ ] Real checkout → payment → webhook → CRM → receipt → notify → Health
- [ ] Real refund → webhook → CRM → Health → Feed
- [ ] Record PaymentIntent / Checkout Session / webhook event / Refund IDs

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
