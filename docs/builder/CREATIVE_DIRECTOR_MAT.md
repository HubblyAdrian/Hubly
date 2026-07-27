# 🎨 AI Creative Director — Module Acceptance Test (MAT)

**Module:** 4 — AI Creative Director  
**Architecture:** [CREATIVE_DIRECTOR_ARCHITECTURE.md](./CREATIVE_DIRECTOR_ARCHITECTURE.md)  
**Checklist:** [CREATIVE_DIRECTOR_CHECKLIST.md](./CREATIVE_DIRECTOR_CHECKLIST.md)  
**Vision:** [BUSINESS_VISION.md](./BUSINESS_VISION.md)  
**Gate:** MAT must pass before merge of Stage 1 Creative Director Development

---

## AI

| # | Test | Result |
|---|------|--------|
| A1 | Brand system generated | ⏳ |
| A2 | Website blueprint generated (not claiming final HTML site-only) | ⏳ |
| A3 | Service catalog generated | ⏳ |
| A4 | Pricing strategy generated with WHY | ⏳ |
| A5 | Booking blueprint generated | ⏳ |
| A6 | Marketing blueprint generated | ⏳ |
| A7 | Growth blueprint cites Business Vision when present | ⏳ |
| A8 | Confidence attached to recommendations | ⏳ |

---

## Canonical inputs

| # | Test | Result |
|---|------|--------|
| I1 | Business Profile consumed | ⏳ |
| I2 | Owner Profile consumed | ⏳ |
| I3 | Business DNA consumed | ⏳ |
| I4 | Research Profile consumed | ⏳ |
| I5 | Business Vision consumed (or low-confidence flag if missing) | ⏳ |
| I6 | No parallel duplicate object models invented | ⏳ |

---

## Experience

| # | Test | Result |
|---|------|--------|
| E1 | Live preview updates continuously | ⏳ |
| E2 | Compare mode functions | ⏳ |
| E3 | Ask Why explains recommendations | ⏳ |
| E4 | User edits persist | ⏳ |
| E5 | Signature reveal (“present the business we've created”) | ⏳ |
| E6 | Not a bare loading spinner | ⏳ |

---

## Validation

| # | Test | Result |
|---|------|--------|
| V1 | Console errors = 0 | ⏳ |
| V2 | Responsive = PASS | ⏳ |
| V3 | Accessibility = PASS | ⏳ |
| V4 | CMV locked modules PASS | ⏳ |
| V5 | Locked Landing / Discovery architecture / Rule #26–27 models untouched | ⏳ |

---

## Acceptance criteria

1. Creative Blueprint is the output — not “a generated website” alone.  
2. Recommendations explain WHY using DNA / Research / Vision.  
3. Live preview + compare + ask-why work.  
4. Reveal presents brand → positioning → services → booking → growth.  
5. Canonical objects remain the only source models.

---

## Sign-off

| Role | Status |
|------|--------|
| Architecture approval | ⏳ |
| Self QA | ⏳ |
| MAT | ⏳ |
| CMV | ⏳ |
| Founder approval | ⏳ |
| Merge → Lock Module 4 Stage 1 OS | ⏳ |
