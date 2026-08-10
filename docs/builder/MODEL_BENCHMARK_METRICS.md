# Model Benchmark — Objective Quality Metrics

Defines what "better" means for a candidate `document_generate` model, before
#38 builds the harness that runs it. Every metric here is computed directly
from real generation output — no human judgment call folded in. Founder/human
review of the actual generated pages is a separate, later step (#39) and
should not be blocked on this.

## Why these specific metrics, not others

`generateAndValidateDocument` (`supabase/functions/_shared/hubly_capability_registry.ts`)
already returns everything below as real, measured values on every call — none
of this requires new instrumentation:

```ts
{ ok, document, usage: { promptTokens, completionTokens, reasoningTokens, calls },
  firstAttemptOk, firstAttemptErrors, modelUsed, rationale }
```

`HublyAI.complete` (`supabase/functions/_shared/hubly_ai.ts`) additionally
returns real `latencyMs` per call. The harness's job (#38) is to call
`generateAndValidateDocument(..., modelOverride)` once per (business, model)
pair via the existing `__benchmarkModel` override and record these fields —
not to invent a new generation path.

One metric here (structural differentiation) has a direct precedent: the
2026-08-06 decision to ship `designRationale` over a `reasoningEffort: medium`
bump (see `buildDesignRationaleInstructions`'s header comment in
`hubly_document.ts`) was made by measuring exactly this, at 65.1% → 58.2%.
Reusing that same metric here instead of inventing a new one keeps this
benchmark comparable to that earlier result.

## The metrics

### 1. Validation pass rate
- **First-attempt-ok rate**: `firstAttemptOk === true` count / total generations.
- **Final pass rate**: `ok === true` count / total generations (after the one
  built-in retry).
- Report both, per model, across the full business set — not just an average
  across mixed business types, since a model could be strong on simple
  briefs and fail disproportionately on complex ones.

### 2. Retry error taxonomy (diagnostic, not just pass/fail)
For every generation where `firstAttemptOk === false`, bucket
`firstAttemptErrors[].path` by prefix (e.g. `$.root.children[*].class` →
"invalid utility class", `$.root` → "missing/malformed root",
`reasoning.confidence` → "malformed reasoning block"). A model that fails
validation in one narrow, fixable way is a different result than one that
fails unpredictably across the schema — same pass rate, different verdict.

### 3. Cost — raw tokens, not a hardcoded dollar figure
Report `promptTokens`, `completionTokens`, `reasoningTokens`, and `calls`
(from `usage`, summed across both attempts when a retry happened) per model,
per business. Convert to a real dollar figure only at analysis time, using
each model's actual published per-token rate as an input — not baked into
this doc, since pricing changes and a stale number here would silently go
stale in a way nobody would notice. `reasoningTokens` gets its own line
always: for a reasoning-tier model it is typically the dominant cost, and
folding it into `completionTokens` would hide that.

### 4. Latency
Real `latencyMs` per generation (both attempts summed if a retry happened,
since that's the real wall-clock cost a user experiences). Report p50 and
p95 per model, not just a mean — reasoning models have long, variable tails,
and a mean alone hides whether a model is "usually fast, occasionally very
slow" vs. "consistently mediocre."

### 5. Structural differentiation (cross-business class-usage overlap)
Same metric as the earlier designRationale decision. For a fixed set of N
generated documents from different businesses (same model), compute the
utility-class sets used per document, and measure pairwise overlap (e.g.
average Jaccard similarity across all pairs). Lower = pages actually look
structurally different from each other, not templated. This is the direct,
objective proxy for "does this model produce a generic template with the
business's name swapped in, or something that reads as built for them."

### 6. Reserved-element justification compliance
`buildDesignRationaleInstructions` requires that any reserved element used
(booking, reviews, contact form, map, customer portal) be justified in the
model's own `designRationale` text. This is mechanically checkable: for every
reserved element type present in the generated `document.root` tree, confirm
the `rationale` string references it. A model that includes reserved elements
without ever justifying them in-band is not following the instruction it was
given, independent of whether the output happens to validate.

### 7. Token efficiency
`completionTokens` ÷ node count in the generated tree. A model that reaches
the same structural richness with fewer completion tokens is cheaper at
equal quality — this catches a model that "pads" its way to a passing
document versus one that's actually concise.

## Explicitly out of scope here
- Visual/aesthetic quality, copy tone, "does this feel premium" — subjective,
  belongs to #39's side-by-side human review, not this objective pass.
- Any metric that isn't already a real field on `DocGenOutcome`/`HublyAIResult`
  or directly computable from the returned `document` tree — if #38 finds it
  needs something else, extend those return shapes for real, don't estimate.

## What #38 needs to run this
- A fixed set of business briefs spanning at least a few industries (reuse
  Section 16's existing scenario businesses — pressure washing, lawn care,
  window cleaning, HVAC, photography, house cleaning — rather than inventing
  a new list, since those were already chosen to cover real DNA variation).
- The same brief run once per candidate model via `__benchmarkModel`, so
  every model sees identical input.
- All seven metrics above computed per (business, model) pair, then rolled up
  per model.
