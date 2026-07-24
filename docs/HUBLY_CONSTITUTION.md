# Hubly Constitution v1.0

**Product constitution** — not the AI Constitution.  
**Audience:** every future engineer, designer, and founder working on Hubly.  
**Status:** Accepted · Milestone 1 complete  
**Version:** 1.0

This is the permanent product contract.

When you are unsure what to build, what to refuse, or how Hubly should feel — start here.

---

## The sentence

Every release should move Hubly closer to this:

> **“I can’t believe software understood my business.”**

That is the guiding principle for every future decision.

If a change makes Hubly feel more like software and less like a partner who *gets* the business — it violates this constitution.

---

## Not the AI Constitution

Two different documents. Do not conflate them.

| Document | What it is |
|----------|------------|
| **This file — Hubly Constitution v1.0** | The **product** contract: how Hubly behaves as a company, platform, and partner |
| [Architecture · Constitution Guide](./architecture/CONSTITUTION_GUIDE.md) | How experts/builders are evaluated against the **Identity System** principles at runtime |
| Identity System (Section 13) | Character + ten behavioral principles on every owner-facing response |

Product constitution decides *what Hubly is allowed to become*.  
AI Constitution decides *how Hubly speaks and behaves in a turn*.

Both are mandatory. This document is the one you read on day one.

---

## Hubly Principles

### 1. There is only one AI

The customer never chooses experts.  
They never pick Research, Strategy, Creative, Critic, or Builder.  
They only talk to **Hubly**.

Experts are internal. Hubly is the product.

### 2. Hubly thinks before it builds

Order is not optional:

```
Research
  → Strategy
  → Creative
  → Critic
  → Builder
```

Do not skip straight to building.  
Thinking is part of the product.

### 3. Every recommendation has reasoning

Never act without explanation.  
“Why?” must come from stored Reasoning Objects and Decision Objects — not improvised after the fact.

If Hubly cannot explain it, Hubly should not recommend it.

### 4. Memory is sacred

Three systems. Never mix them.

| Memory | Question it answers |
|--------|---------------------|
| **Business Memory** | What is true about the business? |
| **Workspace Memory** | How does this owner like to work? |
| **Conversation Intelligence** | What are we working on right now? |

Facts are not preferences. Preferences are not chat. Chat is not truth.

### 5. Every action requires ownership

Everything Hubly changes can be explained.  
Who decided. Why. What changed. How to undo.

Silent mutations are forbidden.  
Ownership is part of trust.

### 6. Hubly builds with owners

Never replace them.  
Always collaborate.

Hubly is a partner — not an autopilot that hijacks the business.  
Recommend. Preview. Approve. Build together.

### 7. Simplicity wins

One recommendation is better than ten.  
One clear next step beats a dashboard of options.  
Overwhelm is a product failure.

### 8. AI should remove software

The owner should not learn menus.  
The owner should describe what they want.  
Hubly builds it.

Configuration is our problem. Conversation is theirs.

---

## The partner filter

Every feature must answer:

> **Does this make Hubly feel more like a business partner?**

If not — **don’t build it.**

Also ask:

1. Does this reduce work for the business owner?  
2. Does this move us toward *“I can’t believe software understood my business”*?  
3. Does this keep one Hubly voice (no expert picker, no settings maze)?  
4. Can we explain and own every change?  
5. Will this still feel right two years from now?

If any answer is **no**, redesign before writing code.

---

## How Hubly works (product truth)

Hubly is **not** a CRM, website builder, marketplace, or chatbot.

Hubly is an **AI that starts, runs, and grows local service businesses**.

Everything else is a **capability**.

Owners describe outcomes.  
Hubly decides which capabilities matter.  
Hubly Brain is the only AI entry point.  
Experience Director is the last gate before the owner sees a response.

---

## Production-first (non-negotiable)

Hubly does not ship demo theater.

- Real providers · real data · real failure modes  
- Fail honestly (“Provider not configured”) — never fake success  
- Done means a paying customer could rely on it when credentials exist  

---

## Before Milestone 1.5 — Founder review (mandatory)

**Do not write a single line of Builder Engine code yet.**

Milestone 1 certified the Brain. Milestone 1.5 layers Builder on top.  
Weaknesses are cheap to fix now and expensive after Builder ships.

Spend deliberate time reviewing everything:

1. Open **Mission Control**  
2. Run every **Founder Acceptance Scenario** (`npm run check:section18`)  
3. Try to **break** it  
4. Ask weird questions  
5. Give contradictory instructions  
6. Change your mind mid-conversation  
7. Stress the Brain  

Fix what you find. Then — and only then — start Builder Engine.

Spec only until then: [`docs/architecture/BUILDER_ENGINE_SPEC.md`](./architecture/BUILDER_ENGINE_SPEC.md)

---

## Related reading (after this)

1. [Developer Onboarding](./architecture/DEVELOPER_ONBOARDING.md)  
2. [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md)  
3. [AI Lifecycle](./architecture/AI_LIFECYCLE.md)  
4. [ADRs](./adr/README.md) — *why* we designed it this way  
5. [Constitution Guide (engineering / AI)](./architecture/CONSTITUTION_GUIDE.md)  
6. [Milestone 1 Certificate](./releases/MILESTONE1_CERTIFIED.md)  

---

## One-line test

If a change invents a second AI face, mixes memories, skips thinking before building, acts without reasoning, replaces the owner, adds menus the owner must learn, or moves Hubly away from *“I can’t believe software understood my business”* — it violates **Hubly Constitution v1.0**.
