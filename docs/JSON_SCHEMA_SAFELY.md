# `json_object` → `json_schema` + `strict` — what "safely" actually requires

> *"What does 'safely' require? What does the flag change, what breaks if it is wrong, what
> observation proves it right, and what specifically must I provide? Name the key by name and prefix
> only. Do not print a value and do not ask me to paste one into a terminal."* — Adrian, 2026-09-17

**Nothing in this file is a value.** The one secret involved is named below by its NAME only, and it
is already set — nothing needs pasting anywhere.

## What the flag changes, exactly

One line today, in `supabase/functions/_shared/hubly_ai.ts:819`:

```
if (opts.jsonMode) body.response_format = { type: "json_object" };
```

`json_object` is a promise about SYNTAX and nothing else: the completion will parse as JSON. Every
statement about its SHAPE — that there is a `root`, that `root.tag` is one of ours, that `children`
is an array — is checked afterwards by `validateHublyDocument`, and when it fails we spend a second
generation. The change would be:

```
body.response_format = { type: "json_schema", json_schema: { name: "hubly_document", strict: true, schema: … } };
```

`strict: true` moves those shape statements from *our validator, after the fact* to *the decoder,
during generation* — the model is constrained so that a malformed shape is not emitted at all.

## What it CANNOT do, and this is the reason to measure before and after

The document validator rejects for six kinds of reason (`kindOf` in
`hubly_capability_registry.ts`). A schema can only prevent three of them:

| error kind | can a strict schema prevent it? |
| --- | --- |
| `shape` — not JSON, missing `root` | **yes** |
| `tag` — an element that is not one of the 75 allowed | **yes**, if the tag is an enum in the schema |
| `attr` — an attribute not allowed on that element | **partly** — only if each tag gets its own object type, which is what makes the schema large |
| `class_token` — an unknown class token | **no**, it is a string with a vocabulary, not a shape |
| `hollow_section` — a section carrying no concrete content | **no** |
| `false_claim` — a claim the record contradicts | **no**, and this is the one that matters most |

**So the honest expectation is "fewer retries for shape errors", never "fewer retries".** If the
change is measured as a single retry rate it will look smaller than it is, or bigger — the split by
`error_kinds` is what makes the number attributable, and that is why the column exists.

## What breaks if the schema is wrong — four failure modes, worst first

1. **THE API REFUSES THE SCHEMA AND EVERY GENERATION 400s.** A structured-output schema has limits
   (no unconstrained `additionalProperties`, every property in `required`, bounded total properties
   and nesting depth). The Hubly document is a **recursive tree of 68 allowed tags plus 7 reserved
   ones** (counted from `ALLOWED_TAGS` and `HUBLY_RESERVED_TAGS`, not from memory), and `children` recurses without a fixed depth. That is precisely the shape most likely to
   exceed a limit. **A 400 here is not a degraded page, it is NO page**, and it would hit every
   build at once — this is the one that must be impossible to ship unnoticed.
2. **THE SCHEMA IS ACCEPTED AND QUIETLY NARROWER THAN THE PRODUCT.** If a tag or an attribute is
   missing from the schema, the model *cannot emit it*. Pages get simpler, and they get simpler in a
   way no validator complains about — because the output is valid. **This is the worst silent
   outcome**: the page is legal, the check is green, and the design is poorer than it was. Nothing in
   the current suite would notice.
3. **`strict: true` REQUIRES EVERY PROPERTY, so optional attributes stop being optional.** Every
   element would carry every attribute, with nulls. Harmless to the renderer, not harmless to the
   token bill or to `maxTokens: 3500`, and a truncated completion is a shape error — i.e. the change
   could *increase* the retry rate it was meant to reduce.
4. **THE PROVIDER BRANCH IS WRONG.** `response_format` is set only in `callOpenAI`. The default
   provider in this codebase is `claude`; the document builder is explicitly
   `website_builder: { provider: "openai", model: DEFAULT_REASONING_MODEL }`. If that ever falls back
   to the Claude path, `jsonMode` silently means nothing and the schema is not applied at all — the
   same silent-undefined failure as a route list that does not match.

## What observation would prove it right — AND THE BASELINE DOES NOT EXIST YET

`document_generation_events` (migration `20260917210000`) records, per attempt: `schema_mode`,
`first_attempt_ok`, `error_kinds[]`, `error_count`, `model`, `tag`, `business_id`.

**Counted on 2026-09-17: the table holds ZERO ROWS.** No page has been generated since it was
created. So today there is no "before", and turning the flag on now would produce an "after" with
nothing to compare it to — which is how a change gets credited with an improvement it did not make.

The observation that would prove it right, in order:

1. **A baseline exists.** ≥ 30 rows at `schema_mode = 'json_object'`, across more than one `tag`.
   Until then the answer to "is this better" is *I can't tell*.
2. **`first_attempt_ok` rises, and it rises in the SHAPE kinds.** `group by schema_mode` on
   `error_kinds && '{shape,tag,attr}'` — if `class_token`, `hollow_section` or `false_claim` move,
   something other than the schema changed and the comparison is contaminated.
3. **No 400s.** Zero generations failing with a provider error, which is a different signal from a
   validation failure and must be read separately.
4. **PAGES DID NOT GET SIMPLER** — the failure mode no number above catches. Element count, distinct
   tags used, and sections per page, before and after, over the same trade. Plus one page LOOKED AT,
   because "simpler" is a legibility judgement and no assertion catches it.

## What Adrian must provide

1. **A ruling that a baseline is collected first.** This is the only real prerequisite, and it is
   a decision, not a value: leave `json_object` in place until `document_generation_events` holds a
   usable baseline. Everything else is reversible; being unable to tell whether it helped is not.
2. **Confirmation of the reasoning model.** `DEFAULT_REASONING_MODEL` is `gpt-5.5`, overridable by
   `HUBLY_AI_REASONING_MODEL` / `HUBLY_AI_OPENAI_MODEL` / `OPENAI_MODEL`. A structured-output schema
   is a per-model capability; **the model NAME is what is needed, and it is not a secret.**
3. **Nothing about the key.** The secret is `OPENAI_API_KEY` and it is already set — referred to by
   name, never by value. No rotation, no new secret, and nothing to paste into a terminal for this
   change. `supabase secrets set` stays banned.

**What is NOT needed from him:** any schema decision. Deriving the schema from `ALLOWED_TAGS`,
`HUBLY_RESERVED_TAGS` and the `ALLOWED` attribute map — rather than hand-writing it — is the whole
job, and a hand-written copy of those three would be another hand-maintained set that goes stale the
first time a tag is added.
