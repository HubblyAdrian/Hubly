# Release Candidate Mode

**Entered:** 2026-07-22  
**Status:** Official — inventing is complete. Proving begins.

Branch: `cursor/production-proof-mode-2662`  
Trackers: `docs/RELEASE_STATUS.md` · `docs/INFRASTRUCTURE_BLOCKERS.md` · `docs/PRODUCT_FAILURES.md` · `docs/GO_LIVE_CHECKLIST.md`

---

## Mission shift

| Before | Now |
|---|---|
| Can Hubly build businesses? | Can a real business owner **trust** Hubly? |

Vision · architecture · product philosophy · Build experience · Living Blueprints · Business Partner feel — **complete**.

From this point forward: **stop inventing. Start proving.**

---

## Allowed work only

Every engineering task must fall into **one** category:

1. **Infrastructure** — deployments, secrets, env, edge functions, Connections, OAuth, Stripe, Google, domains  
2. **Production Proof** — real signups, businesses, websites, bookings, payments, calendars, CRM, reviews, emails, reminders  
3. **Bug Fixes** — with severity, customer impact, reproduction, fix, evidence  

**Nothing else.**

---

## Forbidden in RC

- UX redesigns  
- Philosophy changes  
- AI improvements / new prompts / new agents  
- Architecture / Brain / Runtime / Memory / DNA redesign  
- V2 thinking  
- New features not required to clear a go-live blocker  

Everything now supports launch.

---

## Daily question

> What is preventing someone from trusting Hubly today?

Fix that. Repeat.

---

## Invite metric

> Would I confidently invite the next person on our waitlist today?

| Answer | Action |
|---|---|
| **No** | Fix the blocker. |
| **Yes** | Invite them. |

**Today’s answer: No.**  
Evidence: production edges **DEPLOYED 30 / MISSING 0** (Blocker 1 PASS). Still blocked: secrets verification, no `charges_enabled` Stripe Connect payment proof, no Google Calendar owner OAuth round-trip. See `docs/INFRASTRUCTURE_BLOCKERS.md`.

---

## Launch metric (success)

Not features shipped.

- Businesses launched  
- Customers booked  
- Payments processed  
- Reviews collected  
- Owners who tell a friend: *“I told Hubly about my business and it built my company.”*

Hubly’s first **50 customers** are the product roadmap. Stop predicting. Start learning.

After every onboarding, capture:

- Where did they smile?  
- Where did they hesitate?  
- Where did they get confused?  
- What surprised them?  
- What made them trust Hubly?  
- What made them doubt Hubly?  

Those answers determine every future sprint.

---

## Evidence rule

Every completed task includes evidence — not assumptions, not screenshots alone.

Examples: live URL · webhook ID · Stripe PaymentIntent · Google Event ID · smoke test · deployment verification · production logs.

Every bug includes: **Severity · Customer impact · Reproduction · Fix · Evidence**.

---

## Next actions (ordered)

1. ~~Clear INFRA-1 — deploy 6 missing edges~~ **DONE** (2026-07-22T21:54Z)  
2. Apply pending migrations + edge secrets (INFRA-2)  
3. Stripe Connect `charges_enabled` + payment proof (INFRA-3 → `docs/PRODUCTION_PAYMENT_PROOF.md`)  
4. Google Calendar owner OAuth round-trip (INFRA-4)  
5. Ship owner app + HQ; HQ Release Gate green (INFRA-5/6)  
6. Re-answer the invite metric  

Full checklist: `docs/GO_LIVE_CHECKLIST.md`
