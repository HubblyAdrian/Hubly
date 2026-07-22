# Hubly Constitution

This is not code. These are the permanent rules of Hubly.

When adding features, check this document first.
Do not invent new Brain layers.
Do not redesign the Runtime.
Do not build demo implementations or temporary code.

**Customer Definition of Done:** [`docs/LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)  
**v1 (first 100 customers):** [`docs/V1_RELEASE.md`](./V1_RELEASE.md)

**North Star:** Revenue generated through Hubly-powered businesses.

Three success questions: Can a business launch? Can a customer pay? Can the owner run every day without leaving Hubly?

Optimize **complete transactions** (“a customer hired a business”) — not isolated capabilities.

Every PR must move a hire/revenue outcome forward. No architecture PRs. Avoid overbuilding.
Before merge: *Could a real owner make more money because of this?*

---

## Feeling principle (owner confidence)

Hubly should never make the owner feel like they are filling out software.

Every interaction should leave them feeling more understood, more confident, and closer to running a successful business.

The measure of success is not how many features Hubly has.
It is whether the owner finishes their first session believing:

> Someone finally understands the business I’m trying to build.

Prefer **discoveries** over task status (“I noticed something…” vs “Building homepage…”).
Prefer **outcomes** over features. Prefer **moments** over progress bars.
When Hubly makes a creative decision, occasionally show **why** — not because they asked, because it builds trust.

---

## Production-First Principle

Hubly does **not** build prototypes.

Every completed capability must be deployable to a production customer.

- Real execution path · real data · real auth/ownership · real persistence  
- Real error handling, logging, progress events  

Capabilities should **fail honestly** rather than simulate success.

Missing Connections (owner-facing):

> Domain connection required  
> Stripe connection required  
> Google Calendar connection required  

Internally: connectors / providers. Externally: **Connections**.

The Runtime should always reflect **real system state**. Never fake progress, reviews, urgency, or availability.

Done means a **paying customer** could rely on this — not “the feature exists.”

### Capabilities vs Connectors

```
Capability → WHAT Hubly does (Hubly IP)
Connector  → HOW Hubly connects externally (infrastructure)
```

Hubly Runtime never embeds vendor-specific APIs.
Do not implement extra vendors until a milestone requires them.
Domain purchase stays on the Domain Connector until a registrar is chosen.

---

## Customer outcome milestones (not engineering phases)

| Milestone | Meaning | Priority |
|---|---|---|
| **Business Created** | Conversation creates Identity, Website, Booking, CRM foundation | Finish honestly |
| **Business Launched** | Customers can hire the business — publish, book, pay, calendar, email, domain workflow | ★ Current |
| **First Customer** | Homeowner describes need → match → book → pay → notify | After Launched |
| **Business Running** | CRM/jobs/payments/Daily/Health run with minimal manual work | After First Customer |
| **Business Growing** | Daily, Coach, Living Business, AI Marketing | After Running |

A website alone is **not** a launch. A business is launched when customers can hire it.

See [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md) for the checkbox Definition of Done.

### Sprint rule

> If a customer signed up today, what is the biggest thing preventing them from relying on Hubly?

Build that. Ship it. Repeat.

---

## Guiding principle

> **Hubly should make owning a business feel as simple as describing one.**

We are not building software. We are building a **business employee**.

Conversation instead of configuration.
AI instead of manual setup.
Business understanding instead of disconnected features.
Continuous improvement instead of static software.
Production-ready Connections instead of demos.

---

## Product truth

The Hubly Brain architecture is **complete and frozen**.
We are **optimizing for deployable customer outcomes**.

Hubly is **not** a CRM, website builder, marketplace, or chatbot.

Hubly is an **AI that builds, launches, runs, and grows local service businesses**.

Everything else is simply a **capability**.

### Permanent philosophy

Business owners should never think about software.
They describe what they want.
Hubly decides how to make it happen.

If a user says *“I want more customers,”* Hubly determines Website, Marketing, Pricing, Reviews, Email, Ads, Booking, CRM — without the user choosing tools.

### Product rule

Every new feature must answer:

> **What work is Hubly taking off the owner's plate?**

If it doesn’t reduce owner work — do not build it.

### Partner / employee test

> Does this make Hubly feel more like an AI employee / business partner?

### Final sprint filter

1. Does this reduce work for the business owner?  
2. Does this make Hubly feel more like an employee?  
3. Does this fit the existing Runtime?  
4. Can this become a reusable capability?  
5. Will this still make sense two years from now?  
6. Can a paying customer rely on this today?  
7. Is it checked in [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)?

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
Connectors               ← external systems (HOW)
    ↓
Platform
```

**Future work ships customer outcomes via capabilities + Connections — not architecture.**

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

### Domain / Business Launch

Celebrate `yourbusiness.com`, not only `business.hubly.app`.

Business Launch is the go-live experience: Identity · Publishing · Domain connection workflow · Connection status · Business Health · Timeline.

Domain availability → purchase → DNS → SSL → publish stays on the **Domain Connector** only. No registrar-specific Runtime code.

If Domain Connection is missing → **Domain connection required** — never invent `available: true`.

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

### Hubly Daily (login homepage)

Owners land on a morning briefing — not charts.

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

### Business Health (single AI metric)

Leads · Booking rate · Payment success · Job completion · Reviews · Repeat · Revenue · Response time  
(+ Marketing / Operations as supporting dimensions) → one overall score.
**AI Coach / Hubly Daily optimize Business Health.** Every recommendation improves one of these.

### Business Maturity

Idea → Launching → Growing → Scaling → Multi-location → Enterprise.
Stored as DNA `growthStage` — not a new Brain layer.

### AI Creative Director

Website Runtime explains its thinking from DNA:
who you're targeting · palette · headline emphasis · highlighted services · voice.

### Capability Confidence

Every capability reports confidence. Missing pricing → ask — never guess.

---

## AI Coach

Proactive daily OS:

> Revenue is down. Raise pricing. You haven’t posted recently. These customers need review requests.

Fed by Business Health + Timeline + evolving DNA (Weekly Learning).

---

## Roadmap (customer outcomes)

Source of truth for checkboxes: [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)

| Milestone | Proof |
|---|---|
| ✅ Architecture frozen | Runtime · Memory · DNA · Planner · Orchestrator · Connectors |
| **Business Created** | Owner describes business → real company exists (no fake trust content) |
| **Business Launched** ★ | Publish · book · pay · calendar · email · domain workflow · leave other platforms |
| **First Customer** | Homeowner describes need → match → book → pay → notify |
| **Business Running** | CRM/jobs/payments/Daily/Health with minimal manual work |
| **Business Growing** | Proactive Daily · Coach · Living Business · AI Marketing |

### Final product proof

1. *“I own Acme Home Cleaning.”* → Identity, Website, Booking, CRM, Health, Timeline, Dashboard  
2. *“I need my house cleaned.”* → Find, book, pay, notify  

Everything else comes after those two experiences are dependable.

---

## One-line test

If a change invents a new core Brain layer, redesigns the Runtime, lets a model write the DB, merges Memory with DNA, bypasses Planner → Orchestrator → Executors → Connectors, fakes success, ships without a checked item in `LAUNCH_CHECKLIST.md`, fails the employee / work-reduction / paying-customer tests, or makes owning a business feel *harder* than describing one — it violates this constitution.
