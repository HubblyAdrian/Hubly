# Experience First — Product Standard

**Status:** Active · Next phase priority  
**Audience:** every engineer and founder reviewing Hubly PRs

Architecture (Brain, DNA, One OS, Runtime, Constitution) is the foundation.  
**This phase optimizes for what the customer can see, feel, and interact with.**

---

## The standard

After every significant PR, answer:

> If I were a brand-new customer, would I immediately notice that Hubly got better?

If **no** — we built architecture, not experience. Redirect.

---

## What Hubly should feel like

Not onboarding. Not a wizard. Not a scripted chatbot.

> You just hired an AI business consultant.  
> It says: **“I’ll build this for you.”**  
> Not: **“Answer my questions.”**

### Discovery = ChatGPT + a live studio

- Understand context  
- Make intelligent assumptions  
- **Begin building immediately**  
- Ask questions only when the answer changes the outcome  
- Explain what it’s doing while it works  

### Build while talking

The customer should see, as they talk:

- Website taking shape  
- Booking page appearing  
- Packages being created  
- Brand coming together  
- CRM being configured  

Questions interrupt work only when necessary.

### Visuals over text

Every important AI decision should produce an **asset**:

Homepage preview · Booking preview · Package cards · Brand colors · Logo direction · Dashboard widgets

### Reveal = one moment

🎉 **I built your business.**

Then show clickable: Website · Booking · CRM · Packages  

No reports. No confidence scores. No timelines.

---

## Hubly OS (unchanged)

One OS. AI personalizes above it.  
See [`HUBLY_OS.md`](./HUBLY_OS.md).

---

## Every PR must include visible progress

Significant PRs require at least one of:

- Screenshots / screen recording of the customer journey  
- Interactive UI the founder can click  
- Updated living prototype path  
- Clear before → after for what the customer sees  

Review the **experience**, not just the architecture.

Suggested screenshot set for Create-flow PRs:

1. Discovery with **Live studio** (website / booking / packages lit)  
2. Reveal: **I built your business** + clickable cards  
3. Hubly Home after Continue

---

## Living prototype (source of truth)

Maintain one interactive path that always matches the current vision:

```
Landing → Conversation → Live website/booking/packages
  → Reveal → Hubly Home → Website → CRM → Jobs → Revenue
```

Doc: [`LIVING_PROTOTYPE.md`](./LIVING_PROTOTYPE.md)

When the product improves, this path improves too.
