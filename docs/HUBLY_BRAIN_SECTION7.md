# Section 7 — Business DNA (Release Gate)

**Status: Proven only when `node scripts/check-section7-business-dna.mjs` exits 0.**

Section 7 accepted. Proceed only when the next section’s release gate is ready.

## Objective

Business DNA is Hubly’s permanent **structured business knowledge** system.

It is **not** a prompt, template, or UI JSON config.

It teaches Hubly how businesses actually operate so recommendations sound like an experienced consultant.

## Separation

| System | Answers |
|--------|---------|
| Business Memory | What is true about *this* business |
| Business DNA | How businesses like this operate (knowledge + identity) |
| Workspace Memory | How the owner likes to work |

## Knowledge areas

Industry profile · Customer psychology · Trust signals · Service relationships · Pricing intelligence · Website intelligence · Growth intelligence · Seasonality · Regional intelligence · Community learning model (placeholder — no automatic learning yet)

## Evidence quality

Every DNA claim carries:

| Field | Example |
|-------|---------|
| Source | Internal blueprint |
| Confidence | 0.94 |
| Last reviewed | 2026-07-23 |
| Applies to | industry / region / business stage |

## Rules

- Experts **read** DNA  
- Experts **never modify** DNA  
- Versioned · Auditable · Explainable · Future-proof  

## Demonstration

> I'm starting a pressure washing business in Salt Lake City.

Prove DNA supplies psychology, trust, pricing, homepage, booking, and seasonal opportunities — and that Research + Strategy experts used that evidence.

## Verify

```bash
node scripts/check-section7-business-dna.mjs
```

Evidence: `docs/HUBLY_BRAIN_SECTION7_PROOF.json`
