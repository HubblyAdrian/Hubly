# Hubly Constitution

This is not code. These are the permanent rules of Hubly.

When adding features months from now, check this document first.
Do not invent new Brain layers unless absolutely required.

---

## Guiding principle

> **Hubly should make owning a business feel as simple as describing one.**

Conversation instead of configuration.
AI instead of manual setup.
Business understanding instead of disconnected features.
Continuous improvement instead of static software.

---

## Product truth (post Phase 7)

We are **no longer building infrastructure**.
The Hubly Brain architecture is **complete**.
We are **no longer optimizing for architecture**.
We are **optimizing for experience**.

Hubly is **not** a CRM, website builder, marketplace, or chatbot.

Hubly is an **AI that starts, runs, and grows local service businesses**.

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

### Partner test

> Does this make Hubly feel more like an AI business partner?

### Final sprint filter

Before building any feature, ask:

1. Does this reduce work for the business owner?
2. Does this make Hubly feel more like a business partner?
3. Does this fit the existing Runtime?
4. Can this become a reusable capability?
5. Will this still make sense two years from now?

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
Capabilities             ← reusable
    ↓
Executors                ← never reason; model never writes DB
    ↓
Platform
```

**Future work builds capabilities, not architecture.**

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
| Capabilities | Stay reusable |

- The AI never writes directly to the database.
- Business owners describe outcomes, not software.
- Hubly builds around the business, not the other way around.
- Capability Confidence: low confidence → ask one question; never fabricate business data.

---

## Public APIs

```
Hubly.buildBusiness(prompt)   → company from conversation
Hubly.findPro(prompt)         → customer journey from conversation
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

### Website Runtime

Never ask “Build a website.”
Ask: Who is this business? Who are they serving? Why hire them? What emotions? What’s different? What actions?

The website is an expression of **Business DNA**.

Quietly generate: homepage, about, services, contact, SEO, social share, schema, booking, lead forms.

### Domain capability

Celebrate `yourbusiness.com`, not only `business.hubly.app`.

Suggest domains · check availability · one-click purchase (future) · DNS · SSL · hosting · business email (future).
Explain why owning a domain matters.

### Customer Runtime

Customers only describe problems:

`“I need my driveway pressure washed.”`

→ Understanding → Customer Memory → Customer Profile → Planner → Matching → Booking → Payment → Confirmation.

No categories. No marketplace language. Conversation only.

---

## Living layers

### Living Business

A business should never go stale. Photos, reviews, pricing, services, hours, SEO, promotions — Hubly continuously improves.

### Living Customer

Customer Memory · Profile · booking history · preferences · property · communication · lifetime value — deepen matching over time.

### Living Marketplace

The marketplace is **invisible infrastructure**.
Customers never browse. They talk to Hubly. Hubly understands, matches, books, pays.

---

## Signature surfaces

### Business Timeline (homepage)

Owners open Timeline — not dashboards first.

```
Today      ✓ Website · Booking · CRM · Domain
Tomorrow   AI recommends pricing change
Friday     Three customers need review requests
Next week  Suggested promotion
```

### Business Health (single AI metric)

Revenue · Bookings · Reviews · Retention · Marketing · Operations · Growth → one overall score.
**AI Coach optimizes Business Health.**

### Business Maturity

Every business has a stage: Idea → Launching → Growing → Scaling → Multi-location → Enterprise.

Hubly adapts capabilities (simple site/CRM for Launching; hiring/routes/automation for Scaling).
Coach changes with maturity. Stored as DNA `growthStage` — not a new Brain layer.

### Capability Confidence

Every capability reports confidence. Missing pricing → ask *“What do you normally charge?”* — never guess.

---

## AI Coach

Proactive daily OS:

> Revenue is down. Raise pricing. You haven’t posted recently. These customers need review requests.

Fed by Business Health + Timeline + evolving DNA (Weekly Learning).

---

## Roadmap (experience, not architecture)

| Focus | Proof |
|---|---|
| ✅ Runtime + DNA | Architecture frozen |
| ✅ Website Runtime | Magical moment 1 |
| ✅ Customer Runtime foundation | Magical moment 2 |
| Living Business | Magical moments 3–4 |
| Living Customer | Richer matching |
| Living Marketplace | Invisible perfect match |
| Health → proactive Coach | Daily operating system |
| Domain purchase + Identity polish | Real company launch |
| Self-growing CRM | Quiet enrichment |

Priorities: perfect Build · perfect Find a Pro · proactive Coach · domain + identity · polish until effortless.

---

## One-line test

If a change invents a new core Brain layer, lets a model write the DB, merges Memory with DNA, bypasses Planner → Orchestrator → Executors, fails the partner / work-reduction tests, or makes owning a business feel *harder* than describing one — it violates this constitution.
