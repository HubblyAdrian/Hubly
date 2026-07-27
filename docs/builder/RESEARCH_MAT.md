# 🔍 AI Research Engine — Module Acceptance Test (MAT)

**Module:** 3 — AI Research Engine  
**Architecture:** [RESEARCH_ARCHITECTURE.md](./RESEARCH_ARCHITECTURE.md)  
**Checklist:** [RESEARCH_CHECKLIST.md](./RESEARCH_CHECKLIST.md)  
**Gate:** MAT must pass before merge of Stage 1 Research Development

---

## Sources

| # | Test | Result |
|---|------|--------|
| S1 | Website processed (or skipped with continue) | ⏳ |
| S2 | Google Business processed / skipped | ⏳ |
| S3 | Instagram processed / skipped | ⏳ |
| S4 | Facebook processed / skipped | ⏳ |
| S5 | Uploaded media processed when present | ⏳ |

---

## AI

| # | Test | Result |
|---|------|--------|
| A1 | Service catalog generated | ⏳ |
| A2 | Pricing suggestions created | ⏳ |
| A3 | Competitor list generated (or honest low-confidence empty) | ⏳ |
| A4 | Brand profile generated | ⏳ |
| A5 | Market opportunities generated | ⏳ |
| A6 | Confidence attached to findings | ⏳ |
| A7 | Owner Profile influences priority notes when present | ⏳ |

---

## Experience

| # | Test | Result |
|---|------|--------|
| E1 | Live progress updates | ⏳ |
| E2 | Timeline uses activity copy (not bare “Analyzing…”) | ⏳ |
| E3 | No blocking failures — Builder can continue | ⏳ |
| E4 | Session survives refresh | ⏳ |
| E5 | Results cached — no duplicate analysis in-session | ⏳ |

---

## Validation

| # | Test | Result |
|---|------|--------|
| V1 | Console errors = 0 | ⏳ |
| V2 | Responsive = PASS | ⏳ |
| V3 | Accessibility = PASS | ⏳ |
| V4 | CMV locked modules PASS | ⏳ |
| V5 | Locked Landing + Discovery architecture untouched | ⏳ |

---

## Acceptance criteria

1. Research Profile produced for Module 4.  
2. User watched meaningful discoveries (trust earned).  
3. Partial source failure never stops the Builder.  
4. Hubly Session caches research; refresh resumes.  
5. Business Profile + Owner Profile from Module 2 are inputs, not discarded.

---

## Sign-off

| Role | Status |
|------|--------|
| Architecture approval | ⏳ |
| Self QA | ⏳ |
| MAT | ⏳ |
| CMV | ⏳ |
| Founder approval | ⏳ |
| Merge → Lock Module 3 Stage 1 OS | ⏳ |
