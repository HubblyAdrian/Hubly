# Section 2 — Experience Director (proven)

Milestone 2 may not start until every section 1–18 is green. This section is **proven**.

## Claims

| # | Claim | Proof |
|---|--------|--------|
| 1 | Experience Director exists | `hubly_brain_experience_director.ts` + registered expert |
| 2 | Every customer-facing think response is reviewed | think invariant + weather/workspace fast paths call `applyExperienceDirector` |
| 3 | Max 2 clarifying questions | Fixture A — 10 → 2 |
| 4 | Max 4 homepage sections shown | Fixture B — 8 → 4 shown, 4 delayed |
| 5 | Max 1 dashboard recommendation | Fixture C — 15 → 1 |
| 6 | Technical language rewritten | Fixture D — LLM/API/hero/CTA stripped |
| 7 | Celebration moments | Fixture E — build/launch yes; weather no |
| 8 | Extra lines delayed | Fixture F — 5 lines → 3 shown |

## Behavioral evidence (not just a code audit)

```bash
node scripts/check-section2-experience-director.mjs
```

Produces `docs/HUBLY_BRAIN_SECTION2_PROOF.json` with fixture inputs/outputs.

### Example — Fixture A

**Input:** Research proposes 10 questions.  
**Output:** Experience Director shows **2**, delays **8**, action `limited_questions_to_2`.

### Example — Fixture D

**Input:** `The LLM hero CTA uses an OpenAI API JSON prompt in the UX pipeline.`  
**Output:** Owner sees plain Hubly language (no LLM / OpenAI / API / JSON / CTA jargon).

## Caps (Simplicity Wins)

| Cap | Value |
|-----|------:|
| Questions | 2 |
| Owner-facing lines | 3 |
| Homepage sections shown | 4 |
| Dashboard widgets shown | 1 |
| Response characters | 520 |
