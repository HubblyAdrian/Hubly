# Hubly V1 Finish Line

**Source of truth** (with [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)).

## V1 Freeze

Hubly V1 **architecture** is frozen.  
Hubly V1 **feature scope** is frozen.

- No new AI systems · prompts · agents  
- No new product categories  
- No new architecture  
- No new capabilities unless required to complete this Finish Line  
- No direct Claude/OpenAI outside Hubly Brain (`hubly_ai.ts`) — see `docs/AI_BRAIN_MIGRATION_AUDIT.md`

Frozen layers: Business Memory · Business DNA · Runtime · Planner · Orchestrator · Connectors · Constitution · Customer Runtime · Website Runtime · Business Health.

**Deterministic (intentionally not AI):** Hubly Daily · Business Health · Timeline · Owner Feed. AI advises after those facts exist.

---

## Current objective

**Complete First Customer.**

Do not begin Business Running until First Customer is proven with a **real production transaction**.

### Definition of Done

A real customer can:

1. Discover a business  
2. Book  
3. Pay  
4. Receive confirmation  
5. Complete the job (business side)  
6. Receive a review request  

A real owner can:

1. Receive the lead  
2. Accept it  
3. See it in Calendar  
4. See it in CRM  
5. Receive payment  
6. Complete the job  
7. See Business Health update  
8. See everything in Owner Feed  

No manual intervention. No admin fixes. No database edits. Everything through the Runtime.

### Revenue loop (one transaction)

Visitor → Lead → Quote (if needed) → Booking → Payment → Calendar → Job → Completion → Review request → Review → CRM → Business Health → Owner Feed → Repeat customer  

Nothing should exist outside this loop.

---

## Final V1 blockers (work in order)

### 1. Complete a real production payment ★ CURRENT

Not a test flow. A real end-to-end payment.

Verify checklist: [`PRODUCTION_PAYMENT_PROOF.md`](./PRODUCTION_PAYMENT_PROOF.md)

- Payment succeeds  
- Payment fails  
- Payment expires  
- Refund works  
- Receipt sends  
- CRM updates  
- Owner Feed updates  
- Business Health updates  

This is the proof Hubly can earn revenue.

### 2. Calendar reliability

Conflict detection · Rescheduling · Cancellation · Time zones · Google Calendar sync · Failure recovery  

Calendar must be trustworthy.

### 3. Complete hire lifecycle

Lead → Booking → Payment → Job → Completion → Review request → Review → CRM → Business Health → Owner Feed — **automatically**.

### 4. Reliability pass

Error handling · Retries · Logging · Ownership · Permissions · Duplicate prevention · Webhook idempotency · Race conditions · Mobile · Empty/loading states  

Goal: trust.

### 5. Beta readiness

Run **ten** real businesses entirely through Hubly. Observe. Record friction. Fix. Repeat.  
No new features until they operate successfully.

---

## Out of V1 (do not build)

AI Marketing · Living Business · Living Marketplace · AI Coach Expansion · Autonomous Growth · Business Intelligence · Multi-location · Team management · Advanced reporting · Accounting integrations  

---

## Engineering rule

Every sprint completes one **measurable customer outcome**.

Never merge architecture work because it is interesting.

Measure: businesses launched · jobs booked · payments completed · reviews requested · Business Health improvements.

### V2 gate

V2 starts only when this is **yes**:

> Can a real home service business launch on Hubly, get paid through Hubly, and operate daily without another platform?

If no → continue V1. If yes → freeze V1 and begin V2.

---

## North Star

**Revenue generated through Hubly-powered businesses.**
