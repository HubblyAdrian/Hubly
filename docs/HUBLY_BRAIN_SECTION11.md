# Section 11 — AI Capability Registry & Tool Registry + Knowledge Registry

**Status: Proven only when `node scripts/check-section11-registries.mjs` exits 0.**

Do not begin Section 12 until this section passes. Do not begin Milestone 2.

## Objective

Hubly Brain should never guess. It should know.

| Registry | Answers |
|----------|---------|
| **Tool / Capability Registry** | What can Hubly do? Who owns this action? |
| **Knowledge Registry** | Where does Hubly get information? Read or write? |
| **Expert Framework** (Section 3) | Which experts exist (name, version, purpose, responsibilities)? |

## Tool Registry (examples)

**Website Builder** — Update Homepage · Change Colors · Add/Remove Sections · Update Hero · Publish  

**Booking** — Arrival Windows · No Same-Day Bookings · Booking Rules · Availability · Calendar Sync  

**CRM** — Create Job · Update Customer · Send Email · Merge / Archive · Reschedule · Text  

**Marketplace · Automation · Portfolio Builder · Image Processor** — each with declared capabilities

## Knowledge Registry (examples)

| Source | Access |
|--------|--------|
| Weather | Read Only |
| Stripe / Payments | Read + Write |
| Business Memory | Read + Write |
| Workspace Memory | Read + Write |
| Business DNA | Read Only |
| Marketplace | Read + Write |
| Website | Read + Write |

## Why it matters

> I want arrival windows.

Brain asks the registry: **Booking** owns `arrival_windows` — not “maybe the Booking Expert knows.”

> Upload these photos.

Routes to **Portfolio Builder + Image Processor + Website Builder**.

> Weather tomorrow + reschedule + text customers.

Knowledge Registry → weather. Capability Registry → reschedule + text. Decision Engine → ask approval. (Builder Engine in Milestone 1.5 executes.)

## Verify

```bash
node scripts/check-section11-registries.mjs
# or
npm run check:section11
```

Evidence: `docs/HUBLY_BRAIN_SECTION11_PROOF.json`
