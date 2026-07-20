# Consumer Experience — My Hub

**Status:** DEFINED (not implemented)  
**Prerequisite:** Phase 6.5 Platform Entry approved and on `main`  
**Related:** `docs/HUBLY_EXPERIENCES.md` · `docs/PLATFORM_ENTRY.md`

This is a **product design milestone**, not an engineering sprint. Do not implement until scoped and approved.

---

## Naming (locked for design)

Do **not** call this a Customer Dashboard.

| Name | Who | Job |
|---|---|---|
| **My Hub** | Customer | Manage services you’ve booked |
| **Hubly Marketplace** | Provider | Get customers / receive bookings |
| **Hubly Pro** | Owner | Run your business |
| **Marketplace Ops** | Hubly staff | Trust, verification, quality |

**Public branding rule:** Never say “Marketplace Lite” in customer- or provider-facing copy or URLs.  
Internal capability may still be `marketplace_lite`. File `marketplace-lite.html` is eng-only.

Public Marketplace URLs:

```
/marketplace          → marketing
/marketplace/join     → signup
/marketplace/login    → login
/marketplace/home     → provider experience
```

Feel target: as light as Uber or Airbnb — manage bookings, not run a business.

---

## The gap Phase 6.5 left open

Public entry now routes correctly:

```
Need a Service → /get-done → Book → Pay → ???
```

Today, first-time consumers book through AI Concierge and leave without a durable home.

That should not block Platform Entry. It is the **next** product design.

---

## Job of My Hub

Help a customer manage what they’ve booked on Hubly — and come back for the next job.

**Not:** CRM, marketing, team, inventory, provider tools.

---

## Intended surface (future)

| Area | Purpose |
|---|---|
| **Upcoming Jobs** | What’s booked, when, with whom |
| **Messages** | Threads with providers (Messaging Engine) |
| **Receipts** | Payment / confirmation records |
| **Reviews** | Leave feedback after completed jobs |
| **Referral / Invite a Business** | Invite a provider into Hubly (growth loop) |

Plus lightweight **customer authentication** so history and messages persist.

---

## Journey (defined — not built)

```
/get-done → Book → Pay → Confirmation
                ↓
         Create / sign in to My Hub (lightweight)
                ↓
         Upcoming Jobs · Messages · Receipts · Reviews
                ↓
         Book again (back to Concierge) or Invite a Business
```

### Auth principle

- Booking can stay guest-friendly at the moment of purchase
- My Hub requires a light account (email / magic link / phone — TBD in implementation)
- One customer identity across bookings — **not** a Hubly Pro or Hubly Marketplace provider account

Do not reuse Pro or Hubly Marketplace provider auth as the customer home.

---

## Ownership boundary

| Owns | Does not own |
|---|---|
| Customer auth (consumer identity) | Provider verification |
| Upcoming jobs / history | Service catalog editing |
| Messages with providers | Hubly Marketplace provider app |
| Receipts & reviews | Hubly Pro CRM / marketing |
| Invite a Business | Ops trust queues |

Engines stay shared: Booking, Messaging, Payments, Service Engine (read).

---

## Relationship to Platform Entry

| Path | Destination |
|---|---|
| Need a Service | `/get-done` → (future) My Hub after book/pay |
| Want More Customers | `/marketplace` → Hubly Marketplace |
| Grow My Business | `/pro` → Hubly Pro |

Homepage messaging for Marketplace may later experiment with copy such as *Get Booked*, *Receive Bookings*, *Join the Marketplace*, *Start Getting Customers*. **Do not expand or rewrite the homepage in this milestone.**

Business Readiness remains a future platform capability — not part of My Hub.

---

## Explicit non-goals (now)

- No My Hub UI implementation
- No customer auth schema yet
- No homepage expansion
- No changes to Pro onboarding, Marketplace provider app internals, Concierge flow, or engines

---

## Approval gate

Implement My Hub only after this definition is approved and broken into an engineering phase.

Suggested next engineering phase name (TBD): **Consumer My Hub** (after or alongside Phase 7 Business Readiness — sequence to be decided).
