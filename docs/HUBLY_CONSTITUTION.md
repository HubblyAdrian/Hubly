# Hubly Constitution

This is not code. These are the permanent rules of Hubly.

When adding features months from now, check this document first.
Do not invent new Brain layers unless absolutely required.
Do not redesign the Runtime.
Do not build demo implementations or temporary code.

---

## Production-First Principle

Hubly does **not** build prototypes.

Every completed capability must be **production deployable** for a real business:

- Real execution path  
- Real data  
- Real authentication / authorization / ownership  
- Real persistence  
- Real error handling, logging, progress events  

If something cannot execute because a Connection is missing, return the **real system state**.

Never simulate success. Never fake progress.

Owner-facing copy when an external system is not linked:

> Domain connection required  
> Stripe connection required  
> Google Calendar connection required  

Internally these are **connectors**. Externally, owners think in **Connections**.

Done means: *if Connections were linked today, a paying customer could rely on this* — not “the feature exists.”

---

## Capabilities vs Connectors

```
Capability  → WHAT Hubly does
Connector   → HOW Hubly talks to an external system
```

```
Capability → Connector contract → Vendor implementation (chosen intentionally)
```

Hubly Runtime **never** embeds vendor-specific APIs.

Build **connector interfaces** first. Do **not** prematurely implement multiple vendors (e.g. Cloudflare + Porkbun + Namecheap) before an intentional launch choice.

### Connector contracts

| Connector | Contract role | Intentional vendor (when ready) |
|---|---|---|
| DomainConnector | searchAvailability · purchase · configureDNS · verify · renew · transfer · ensureSsl | TBD — Cloudflare **or** Porkbun **or** Namecheap |
| PaymentConnector | Connect account · booking checkout | Stripe |
| CalendarConnector | list / create events | Google Calendar |
| EmailConnector | send | Resend |
| MessagingConnector | SMS | Twilio |
| MapsConnector | geocode | Google Maps |
| AdvertisingConnector | campaigns | Google Ads / Meta |
| AccountingConnector | books | TBD |

Until a Connection is linked, capabilities that need it return **Connection required** — never invent `available: true`, paid, or synced.

---

## Business stages (not software modules)

| Stage | Jobs |
|---|---|
| **1 · Build My Business** | Business Identity · Creative Director · Website Runtime · Business DNA · Business Memory · Instant Site |
| **2 · Launch My Business** | Business Launch · Custom Domain · Publishing · SSL · DNS · Business Email foundation · Search indexing · Provider Connections |
| **3 · Run My Business** | Booking · CRM · Calendar · Messaging · Payments · Hubly Daily · Timeline · Business Health |
| **4 · Grow My Business** | Customer Runtime · AI Coach · Marketing · Marketplace · Reviews · SEO · Living Business |
| **5 · Optimize My Business** | Weekly Learning · DNA evolution · Living Marketplace · Autonomous Growth · Optimization Engine |

**Vertical shipping:** finish one capability completely before beginning another. Nothing is complete until it is production deployable.

### Current priority

1. **Finish Website Runtime** — real generation, publishing, editing, SEO, schema, booking, forms, analytics hooks.  
2. Then **Business Launch** — identity, domain suggestions, DomainConnector / DNS / SSL interfaces, publishing, search indexing foundation. Registrar not committed yet.

**Business Launch** replaces “domain purchase.” It is the experience of making a business real. The Runtime only knows Launch requires a **Domain Connector**.

---

## Guiding principle

> **Hubly should make owning a business feel as simple as describing one.**

Conversation instead of configuration.
AI instead of manual setup.
Business understanding instead of disconnected features.
Continuous improvement instead of static software.
Production-ready Connections instead of demos.

---

## Product truth

The Hubly Brain architecture is **complete and frozen**.
We are **no longer optimizing for architecture**.
We are **optimizing for deployability** — every sprint should make Hubly more usable for real businesses.

Hubly is **not** a CRM, website builder, marketplace, or chatbot.

Hubly is an **AI that builds, launches, runs, and grows local service businesses**.

Everything else is simply a **capability**.

### Permanent philosophy

Business owners should never think about software.
They describe what they want.
Hubly decides how to make it happen.

If a user says *“I want more customers,”* Hubly determines Website, Marketplace profile, Marketing, Pricing, Reviews, Email, Ads, Booking, CRM — without the user choosing tools.

### Product rule

Every new feature must answer:

> **Does this reduce work for the business owner?**

If not — do not build it.

### Partner / employee test

> Does this make Hubly feel more like an AI employee / business partner?

### Final sprint filter

Before building any feature, ask:

1. Does this reduce owner work?
2. Does this make Hubly feel more like an employee?
3. Does this fit the Runtime?
4. Does this become a reusable capability?
5. Is this production deployable?
6. Will this still make sense two years from now?

If any answer is **no**, redesign before building.

---

## Architecture (frozen)

```
Conversation
    ↓
Understanding
    ↓
Business Memory          ← What is true?
Business DNA             ← What kind of business is this? (evolves)
    ↓
Planner                  ← WHAT should happen?
    ↓
Execution Plan
    ↓
Orchestrator             ← HOW should it happen?
    ↓
Capabilities             ← reusable (WHAT)
    ↓
Executors                ← never reason; model never writes DB
    ↓
Connectors               ← external systems (HOW)
    ↓
Platform
```

**Future work builds capabilities and Connections, not architecture.**

| Business | Customer |
|---|---|
| Business Memory (facts) | Customer Memory (facts) |
| Business DNA (identity — evolves) | Customer Profile (identity — evolves) |

**Never combine Memory and DNA / Profile.**

### Permanent role rules

| Layer | Answers / owns |
|---|---|
| Memory | What is true? |
| DNA | What kind of business is this? |
| Planner | What should happen? |
| Orchestrator | How should it happen? |
| Executors | Perform work — never reason about strategy |
| Capabilities | WHAT Hubly does — stay reusable |
| Connectors | HOW Hubly connects externally — vendor-replaceable |

- The AI never writes directly to the database.
- Business owners describe outcomes, not software.
- Hubly builds around the business, not the other way around.
- Capability Confidence: low confidence → ask one question; never fabricate business data.

---

## Public APIs

```
Hubly.buildBusiness(prompt)   → company from conversation
Hubly.findPro(prompt)         → customer journey from conversation
Hubly.daily()                 → Hubly Daily briefing
```

---

## The Four Magical Moments

Every feature should support one of these:

1. **Hubly built my business** — owner describes; Hubly builds.
2. **Hubly got me my first customer** — homeowner describes a project; Hubly matches, books, pays.
3. **Hubly helped me grow** — proactive recommendations (pricing, reviews, marketing, website, SEO, revenue).
4. **Hubly runs my business** — continuous work: site, marketing, follow-up, booking, communication, growth.

---

## Magical Build

User types: `I own Acme Home Cleaning.`

```
👋 Nice to meet you.
Learning about your business…
✓ Understanding who you are
✓ Learning who your customers are
✓ Creating your brand
✓ Writing your website
✓ Building your booking system
✓ Creating your CRM
✓ Setting up your dashboard
✓ Preparing your marketplace profile
✓ Checking domain availability
🎉 Your business is live.
```

Then **Business Identity**: Name · Logo · Colors · Fonts · Voice · Domain · Website · Booking · CRM · Marketplace Profile · Health · Timeline · Status: **Ready**.

Feels like launching a company — not finishing a wizard.

When Connections are linked, Hubly additionally secures a custom domain, configures DNS, publishes, connects Stripe / Calendar / Email / SMS — **without changing the Runtime**.

### Website Runtime

Never ask “Build a website.”
Ask: Who is this business? Who are they serving? Why hire them? What emotions? What’s different? What actions?

The website is an expression of **Business DNA**.

Production path must include: real generation · publishing · editing · SEO · schema · booking integration · forms · analytics hooks.

### Business Launch

Celebrate `yourbusiness.com`, not only `business.hubly.app`.

Business Launch includes: Business Identity · Logo · Brand colors · Domain suggestions · DomainConnector · DNS · SSL · Publishing · Search indexing foundation.

If Domain Connection is missing → **Domain connection required** — never invent availability.

### Customer Runtime

Customers only describe problems:

`“I need my driveway pressure washed.”`

→ Understanding → Customer Memory → Customer Profile → Planner → Matching → Booking → Payment → Confirmation.

No categories. No marketplace language. Conversation only.

---

## Living layers

### Living Business

A business should never go stale. When reviews, pricing, services, or photos change — website, quotes, and gallery update. Hubly continuously improves the business.

### Living Customer

Customer Memory · Profile · booking history · preferences · property · communication · lifetime value — deepen matching over time.

### Living Marketplace

The marketplace is **invisible infrastructure**.
Customers never browse. They talk to Hubly. Hubly understands, matches, books, pays.

---

## Signature surfaces

### Hubly Daily (login homepage)

Owners land on a morning briefing — not charts. The dashboard is secondary.

```
Good morning, Adrian.

Here's what's happening today:
3 jobs scheduled · 2 new leads · 1 review request · Health 91 (+3)

My recommendation
Raise your premium package by $25.

One thing I'll handle today
Update homepage photos + SEO.
```

That's an employee briefing. Advice first.

### Business Timeline

Story of what Hubly did and recommends next.

### Business Health (primary success metric)

Not revenue alone. Not jobs alone. **Overall Business Health.**

Revenue · Bookings · Reviews · Retention · Marketing · Operations · Growth → one overall score.
**Everything Hubly does should improve this score.** AI Coach / Hubly Daily optimize Business Health.

### Business Maturity

Idea → Launching → Growing → Scaling → Multi-location → Enterprise.
Stored as DNA `growthStage` — not a new Brain layer.

### AI Creative Director

Website Runtime explains its thinking from DNA:
who you're targeting · palette · headline emphasis · highlighted services · voice.

### Capability Confidence

Every capability reports confidence. Missing pricing → ask — never guess.

### Connections

Owner-facing page mental model for Stripe, Google, Twilio, Domain, Email, etc.
Internal code may say connector / provider; UI says **Connections** / **Connection required**.

---

## AI Coach

Proactive daily OS — do not wait for questions:

> Revenue is down. Raise pricing. You haven’t posted recently. These customers need review requests.

Surface opportunities. Recommend improvements. Drive Business Health.
Fed by Business Health + Timeline + evolving DNA (Weekly Learning).

---

## Roadmap (deployability, not architecture)

| Focus | Proof |
|---|---|
| ✅ Runtime + DNA | Architecture frozen |
| ✅ Website Runtime foundation | Magical moment 1 |
| ✅ Customer Runtime foundation | Magical moment 2 |
| ✅ Phase 8 surfaces | Daily · Creative Director · Launch UI |
| ✅ Connector contracts | Domain (TBD) · Stripe · Google Calendar · Email/SMS/Maps stubs |
| **Finish Website Runtime** | Generate · publish · edit · SEO · schema · booking · forms · analytics |
| **Business Launch** | Connection-gated availability → purchase → DNS → SSL → publish (registrar TBD) |
| Living Business | Magical moments 3–4 |
| Living Customer | Richer matching |
| Living Marketplace | Invisible perfect match |
| Weekly Learning | DNA evolves automatically |

### Jobs Hubly performs (not software categories)

1. Build my business  
2. Launch my business  
3. Run my business  
4. Grow my business  
5. Optimize my business  

We no longer ask *“What feature should we build?”*  
We ask *“What job should Hubly do for the owner?”*  
and *“Can a paying customer rely on this?”*

---

## One-line test

If a change invents a new core Brain layer, redesigns the Runtime, lets a model write the DB, merges Memory with DNA, bypasses Planner → Orchestrator → Executors → Connectors, fakes success when a Connection is missing, fails the partner / work-reduction / production-deployable tests, or makes owning a business feel *harder* than describing one — it violates this constitution.
