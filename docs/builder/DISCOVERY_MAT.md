# 🤖 AI Discovery — Module Acceptance Test (MAT)

**Module:** 2 — AI Discovery  
**Architecture:** [DISCOVERY_ARCHITECTURE.md](./DISCOVERY_ARCHITECTURE.md)  
**Checklist:** [DISCOVERY_CHECKLIST.md](./DISCOVERY_CHECKLIST.md)  
**Gate:** MAT must pass before merge of Stage 1 Discovery Development

---

## Memory

| # | Test | Result |
|---|------|--------|
| M1 | Landing conversation preserved into Discovery | ⏳ |
| M2 | Hubly Session loaded (`toBuilderPayload`) | ⏳ |
| M3 | Known facts reused (industry / location / name / imports) | ⏳ |
| M4 | No duplicate questions for known facts | ⏳ |
| M5 | Session survives refresh / Save & Exit | ⏳ |

---

## Discovery

| # | Test | Result |
|---|------|--------|
| D1 | Dynamic questions adapt by industry | ⏳ |
| D2 | Progress (Business DNA %) updates after each answer | ⏳ |
| D3 | Business DNA grows after each answer | ⏳ |
| D4 | AI suggestions appear as confidence grows | ⏳ |
| D5 | Max 2 questions at once | ⏳ |
| D6 | Why-asking line present on clarifying asks | ⏳ |

---

## Imports

| # | Test | Result |
|---|------|--------|
| I1 | Website analysis displayed when present | ⏳ |
| I2 | Instagram analysis displayed when present | ⏳ |
| I3 | Google Business analysis displayed when present | ⏳ |
| I4 | Facebook analysis displayed when present | ⏳ |
| I5 | Import failure → continue anyway | ⏳ |

---

## Controls

| # | Test | Result |
|---|------|--------|
| C1 | Continue | ⏳ |
| C2 | Back | ⏳ |
| C3 | Save & Exit | ⏳ |
| C4 | Skip | ⏳ |
| C5 | Edit previous / DNA card | ⏳ |

---

## Layout

| # | Test | Result |
|---|------|--------|
| L1 | Split: conversation left · DNA right (desktop) | ⏳ |
| L2 | Responsive tablet / mobile | ⏳ |
| L3 | Hubly wordmark present | ⏳ |

---

## Validation

| # | Test | Result |
|---|------|--------|
| V1 | Console errors = 0 | ⏳ |
| V2 | CMV locked Operate modules still PASS | ⏳ |
| V3 | Locked AI Landing not redesigned | ⏳ |
| V4 | Marketplace `/marketplace` + `/get-done` intact | ⏳ |
| V5 | Accessibility = PASS | ⏳ |

---

## Acceptance criteria

1. Business DNA reaches completion threshold (≥ 90%).  
2. Hubly Session remains intact (Temporary Memory).  
3. No previously known information is requested again.  
4. Dynamic questions adapt correctly to the detected business type.  
5. User feels the AI is **building alongside** them (DNA panel moves with every answer).

---

## Sign-off

| Role | Status |
|------|--------|
| Self QA | ⏳ |
| MAT | ⏳ |
| CMV | ⏳ |
| Founder approval | ⏳ |
| Merge → Lock Module 2 OS | ⏳ |
