# Go Live Checklist

Every remaining task before inviting Closed Beta customers.  
Ordered by impact. Infrastructure vs product labeled.

When **every** box is checked → Closed Beta Ready.

---

## 1. Clear production edge gaps (INFRASTRUCTURE)

- [ ] Set `SUPABASE_ACCESS_TOKEN` for deploy
- [ ] Run `./scripts/deploy-proof-edges.sh`
- [ ] `node scripts/probe-production-edges.mjs` → **0 MISSING**
- [ ] Evidence attached: updated `docs/EDGE_PROBE.md`

Required missing today: `hubly-build-business`, `hubly-daily`, `hubly-ai-status`, `hubly-find-pro`, `hire-crm`, `mission-control`

---

## 2. Edge secrets (INFRASTRUCTURE)

- [ ] `OPENAI_API_KEY` on edge (generate-site / build no longer “temporarily unavailable”)
- [ ] `HUBLY_MISSION_CONTROL_SECRET`
- [ ] Stripe live keys + webhook secret
- [ ] Google `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / redirect URI

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

## 8. Blueprint coverage (PRODUCT)

- [ ] Electrical blueprint in registry **or** explicitly out of Closed Beta scope
- [ ] Plumbing blueprint **or** out of scope
- [ ] Painting blueprint **or** out of scope
- [ ] Junk Removal blueprint **or** out of scope
- [ ] `node scripts/validate-blueprints.mjs` — required set PASS  
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

## Do not do before Closed Beta

- New AI systems / agents
- V2 Marketing / Living Marketplace / Autonomous Growth
- New architecture layers
- Expanding beyond go-live checklist
