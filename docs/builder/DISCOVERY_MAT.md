# 🤖 AI Discovery — Module Acceptance Test (MAT)

**Module:** 2 — AI Discovery  
**Architecture:** 🔒 Locked — [DISCOVERY_ARCHITECTURE.md](./DISCOVERY_ARCHITECTURE.md)  
**Checklist:** [DISCOVERY_CHECKLIST.md](./DISCOVERY_CHECKLIST.md)  
**Gate:** MAT must pass before merge of Stage 1 Discovery Development

---

## Memory

| # | Test | Result |
|---|------|--------|
| M1 | Landing conversation preserved into Discovery | ⏳ |
| M2 | Hubly Session loaded (`toBuilderPayload`) | ⏳ |
| M3 | Known facts seeded into Business vs Owner Profile correctly | ⏳ |
| M4 | No duplicate questions for known facts | ⏳ |
| M5 | Session survives refresh / Save & Exit | ⏳ |

---

## Profiles / DNA

| # | Test | Result |
|---|------|--------|
| P1 | Business Profile fields update from business answers | ⏳ |
| P2 | Owner Profile fields update from founder answers | ⏳ |
| P3 | Business DNA % reflects both profiles | ⏳ |
| P4 | DNA cards editable | ⏳ |
| P5 | Completion at ≥ 90% DNA | ⏳ |

---

## Discovery

| # | Test | Result |
|---|------|--------|
| D1 | Dynamic questions adapt by industry | ⏳ |
| D2 | Progress updates after each answer | ⏳ |
| D3 | Owner-aware AI suggestions when goals/stage known | ⏳ |
| D4 | Max 2 questions at once | ⏳ |
| D5 | Why-asking line present on clarifying asks | ⏳ |

---

## Imports

| # | Test | Result |
|---|------|--------|
| I1–I4 | Website / Instagram / Google / Facebook displayed when present | ⏳ |
| I5 | Import failure → continue anyway | ⏳ |

---

## Controls / Layout / Validation

| # | Test | Result |
|---|------|--------|
| C1–C5 | Continue · Back · Save & Exit · Skip · Edit | ⏳ |
| L1 | Split: conversation left · DNA (Business+Owner) right | ⏳ |
| L2 | Responsive tablet / mobile | ⏳ |
| L3 | Hubly wordmark present | ⏳ |
| V1 | Console errors = 0 | ⏳ |
| V2 | CMV locked Operate modules PASS | ⏳ |
| V3 | Locked Landing + Discovery architecture not redesigned | ⏳ |
| V4 | Marketplace intact | ⏳ |
| V5 | Accessibility = PASS | ⏳ |

---

## Acceptance criteria

1. Business DNA ≥ 90% (Business Profile + Owner Profile).  
2. Hubly Session remains intact.  
3. No previously known information is requested again.  
4. Dynamic questions adapt to industry **and** owner gaps.  
5. User feels Hubly is building alongside them — DNA panel moves with every answer.  
6. Outputs include both profiles for Module 3 / Ask Hubly coaching later.

---

## Sign-off

| Role | Status |
|------|--------|
| Architecture lock | ✅ |
| Self QA | ⏳ |
| MAT | ⏳ |
| CMV | ⏳ |
| Founder approval | ⏳ |
| Merge → Lock Module 2 Stage 1 OS | ⏳ |
