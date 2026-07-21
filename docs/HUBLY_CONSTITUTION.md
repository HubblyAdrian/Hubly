# Hubly Constitution

This is not code. These are the permanent rules of Hubly.

When adding features months from now, check this document first.
Do not invent new Brain layers unless absolutely required.

---

## Product truth

Hubly is the **AI that starts, runs, and grows local service businesses — and connects them with the right customers**.

Not a CRM. Not a marketplace. Not a website builder.
Those are **capabilities**. The product is **Hubly**.

Business owners describe **outcomes**, not software.
Customers describe **problems**, not categories.
Hubly builds around the business — and matches customers through conversation.

### Partner test (every sprint)

> Does this make Hubly feel more like an AI business partner?

If yes → build it. If no — even if useful — backlog it.

Optimize for: *“I told it about my business, and it built everything for me.”*

---

## Pipeline (frozen)

```
Conversation
    ↓
Understanding
    ↓
Business Memory          ← What is true?
Business DNA             ← Who is this business? (evolves)
    ↓
Planner                  ← WHAT (never HOW)
    ↓
Execution Plan
    ↓
Orchestrator             ← HOW
    ↓
Capabilities
    ↓
Executors
    ↓
Platform
```

**Architecture is frozen after Business DNA.**
We are no longer building core systems. Every sprint proves the architecture through **user experience**.

| Business | Customer |
|---|---|
| Business Memory (facts) | Customer Memory (facts) |
| Business DNA (identity — evolves) | Customer Profile (identity — evolves) |

**Never combine Memory and DNA / Profile.**

---

## Public APIs

```
Hubly.buildBusiness(prompt)   → company from conversation
Hubly.findPro(prompt)         → customer journey from conversation
```

---

## Magical Build experience

User types: `I own Acme Home Cleaning.`

Stream (not a setup wizard):

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

Then one **Business Identity** screen: Name · Logo · Colors · Website · Booking · CRM · Marketplace · Domain · Status: **Ready**.

Feels like launching a company.

### Website Runtime

Consumes **Business DNA** (and Memory facts). Never asks “build a website.”
Internally asks: Who is this company? Who are they attracting? What emotions? What’s different?

Quietly generates: homepage, about, services, contact, SEO, social share, schema, booking, lead forms.

### Domain capability

After website: suggest intelligent domains (`acmehomecleaning.com`, `getacmecleaning.com`, …).
Availability first; one-click purchase later.

### Customer Runtime

```
"I need my driveway pressure washed."
  → Understanding → Customer Memory → Customer Profile
  → Planner → Matching (incl. Business DNA fit) → Booking → Payment
```

No categories. No “marketplace” language. Only conversation.

---

## Signature concept — Business Timeline

Every AI action is the **story** of the business.

```
Today     ✓ Website created · Booking enabled · CRM generated · Domain found
Tomorrow  AI recommends pricing change
Friday    Ask three customers for reviews
Next week Spring promotion
```

Owners land on: *Here’s what Hubly has done — and what it recommends next.*
Not a dashboard-first Jobber/HCP clone.

---

## Business Health (before Coach)

One AI-owned score Hubly optimizes:

Overall · Revenue · Bookings · Reviews · Marketing · Operations · Retention

Proactive Coach uses Health:

> Good morning. Three things I’d work on today…

---

## DNA evolves (Weekly Learning)

Business DNA is not static.

```
Current → Learned (luxury converts better) → Updated ideal customer
→ Website, ads, quotes, emails, ranking, Coach all shift
```

---

## Roadmap (prove through experience)

| Phase | Focus |
|---|---|
| ✅ 7.5–7.6 | Runtime + Business DNA (frozen) |
| ✅ 7.7 | Website Runtime |
| ✅ 7.8 | Customer Runtime foundation |
| **8 Living Business** | Site/services/pricing/SEO stay fresh daily |
| **9 Living Customer** | Memory + Profile + LTV + habits deepen |
| **10 Living Marketplace** | Customer Profile × Business DNA = perfect match |
| Business Health | First AI metric → proactive Coach |
| Self-growing CRM | Quiet enrichment — never “build CRM” |
| Autonomous Growth | Weekly Learning drives the living layers |

Priorities now:

1. Perfect **Build My Business**
2. Perfect **Find a Pro**
3. Proactive Coach (via Health + Timeline)
4. Domain purchase + Identity polish
5. Polish until effortless

---

## Role boundaries

| Layer | Owns | Must not |
|---|---|---|
| **Understanding** | Read raw conversation; write Memory + DNA/Profile patches | Plan execution or write platform tables |
| **Planner** | WHAT from Memory + DNA | HOW, retries, raw chat |
| **Orchestrator** | HOW — DAG, parallel, retries, progress, history | Rewrite DNA/Memory meaning |
| **Capabilities** | Registry nodes | One-off flows outside registry |
| **Executors** | Work + writes | Strategy; **model never writes DB directly** |

---

## AI rules

1. AI never writes the database — **Executors** write.
2. Features receive **Business DNA** — no invented personality prompts.
3. Features receive **Business Memory** — no hand-rebuilt facts.
4. Low confidence → **ask**, don’t guess.
5. New work funnels through `buildBusiness` / `findPro` / Runtime.
6. Do not invent new core Brain layers.

---

## One-line test

If a change invents a new core Brain layer, lets a model write the DB, merges Memory with DNA, bypasses Planner → Orchestrator → Executors, or fails the **partner test** — it violates this constitution.
