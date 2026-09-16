# Condition 4's sweep — which documented examples are untested claims

**Measured 2026-09-15. `node scripts/measure-documented-examples.mjs`.**

> "report which other documented examples in the registry are untested claims; that is its own
> small sweep and I suspect this is not the only one." — Adrian

**You were right.** `the Maple St one is $200 now` was not the only one.

## What would make these numbers wrong — before the numbers

1. **"Appears verbatim in a check" is a weak proxy for tested.** A check may exercise the same
   intent in different words, which makes the untested count too **high**.
2. **An example appearing in a check is not proof the check asserts on it.** Which pushes the other
   way.
3. **The parse could miss capabilities.** This is the one that nearly produced a bad number, below.

So read this as *"how many documented examples has nobody deliberately exercised"*, not *"how many
are broken."* The updateJob one was broken; the rest are **unknown**, and unknown is the finding.

## The parse nearly reported off half the registry

My first regex required `doors:` or `argsSchema:` to close a description block and parsed **25 of
42** capabilities. It would have reported "42 untested" off 60% of the file. The second attempt
parsed 42 but my *denominator* said 43 — and the extra was `name: "name", tagline: "tagline", …`, a
**field-mapping object**, not a capability.

The sweep now derives its own denominator (a `name:` alone on its line, with `description:` on the
next) and **refuses to print a total it cannot reconcile**. It prints the reconciliation first:

```
reconciled: 42 capability blocks parsed = 42 name+description headers found.
```

That is the leg-0 habit from the Lesson 87 addendum, applied to a sweep instead of a check.

## The numbers

**42 capabilities parsed. 20 carry quoted examples. 73 documented examples; 11 appear verbatim in a
check; 62 do not.**

| capability | examples | in a check | not |
|---|---|---|---|
| `showMe` | 11 | 2 | **9** |
| `restyleElement` | 9 | 1 | **8** |
| `setDesignKnob` | 8 | 1 | **7** |
| `places` | 7 | 0 | **7** |
| `patchStorefront` | 5 | 0 | **5** |
| `setProductVisibility` | 5 | 0 | **5** |
| `updateJob` | 5 | 2 | **3** |
| `goToPlace` | 5 | 2 | **3** |
| `moveSection` | 3 | 1 | 2 |
| `addVariant`, `configureStore`, `generateStorefront` | 2 each | 0 | 2 each |
| `showMeWhere` | 2 | 1 | 1 |
| `capture`, `setAddress`, `createProduct`, `createCollection`, `addProductsToCollection`, `updateVariant` | 1 each | 0 | 1 each |
| `create` | 1 | 1 | 0 |

**`create` is the only capability whose every documented example is exercised.**

## The ones worth looking at first, and why

**`places` — 7 of 7 untested, and its examples are phrases an owner actually says:** "Take me to my
schedule", "show me my jobs", "open my customers", "add a store", "can I get a store in my
sidebar". This is the same *shape* as the updateJob defect — natural phrasings resolved against a
matcher — so it is the likeliest place for a second instance.

**`showMe` — 9 of 11 untested**, and `showMe` is the third door we built on 2026-09-14 precisely
because it had none. A new door whose documented invocations are unexercised is a door we have not
walked.

**One example is not an example at all:** `moveSection` lists `"was performed"`. That is a fragment
of an instruction to the model ("never say a change *was performed*") that my quote-extractor read
as a user phrase. A reminder that this sweep measures **quoted strings in descriptions**, not
verified intents — stated so the 73 is read for what it is.


## THE SPLIT, ranked (2026-09-15) — reported before any testing

Adrian: *"do not test all 62. Rank them — which sit on capabilities an owner can actually reach
today, versus ones behind a door that does not exist. Report the split before you start."*

**42 reachable · 20 behind a door.**

**The ranking is derived, not judged.** The authority is `CONTEXT_CAPABILITY_ALLOWLIST` in
`hubly-conversation/index.ts`, read from source by the sweep — because a capability absent from the
context the owner is in is **filtered out of the model's prompt AND blocked at dispatch**, so it
cannot be invoked at all. A context change re-ranks this on its own.

```
dashboard = [website, online_presence, business, places, operations]   ← the owner's ordinary conversation
operate   = [storefront, places]
customer  = [booking]
```

### Behind a door the owner's conversation cannot open — 20 examples

Every one belongs to the **`storefront`** group, which appears **only** in the `operate` context. And
`operate` is reached only through the editor hub's **`store` tab**, inside the **`?hcEdit=1`**-gated
editor that `platform-home.html` opens — traced 2026-09-15 (`hubly.html:38241` → `edStoreAiSend` →
`S._edHubTab==='store'`). An owner talking to Hubly normally can never invoke any of them.

`createProduct` · `setProductVisibility` (5) · `addVariant` (2) · `updateVariant` ·
`createCollection` · `addProductsToCollection` · `configureStore` (2) · `generateStorefront` (2) ·
`patchStorefront` (5)

**These are not worth testing yet** — a documented example on an unreachable capability is a promise
nobody can call in. (It also lines up with OPEN_FINDINGS #14, "the storefront capability is invisible
to the model in the claimed shell".)

### Reachable today — 42 examples, test these first

These are the ones where "a promise in our own description the code does not keep" can actually reach
an owner, which is exactly how `the maple st one` survived.

**Highest suspicion, and in this order:**

1. **`places` (7 of 7) and `business/goToPlace` (3 of 3)** — their examples are phrasings an owner
   literally says: *"Take me to my schedule"*, *"show me my jobs"*, *"open my customers"*,
   *"can I get a store in my sidebar"*. This is the **same shape** as the `updateJob` defect —
   natural phrasings resolved against a matcher — so it is the likeliest second instance, and it is
   two capabilities that overlap in wording, which is its own risk.
2. **`business/showMe` (9 of 11)** — the third door, built 2026-09-14 *because* it had none. A new
   door whose documented invocations are unexercised is a door nobody has walked.
3. **`website/restyleElement` (8), `website/setDesignKnob` (7)** — freeform phrasings
   (*"make this bigger"*, *"make this feel more premium"*, *"bold that"*) against a live page. High
   example count, and the blast radius is an owner's actual website.
4. **`business/capture` (1), `business/setAddress` (1), `website/moveSection` (2), `website/showMeWhere` (1)** — small, and worth doing because they are cheap.

### One correction to the count itself

`moveSection` lists `"was performed"`, which is **not an example** — it is a fragment of an
instruction to the model (*never say a change "was performed"*) that my quote-extractor read as a
user phrase. So 42 is at most 41 real reachable examples. Left in the number rather than silently
adjusted, because the extractor's limit is the honest thing to report: **this sweep measures quoted
strings in descriptions, not verified intents.**

### What I have not done

**Not tested any of the 42.** The split was the deliverable. Each needs the capability's backend and
an authed session against a real business, which is the same constraint that stops every other
owner-path verification here.

## What this does not do

- **It does not test any of the 62.** Running them needs each capability's backend and, for most,
  an authed session against a real business. This is a list to work through, not a verdict.
- **It does not cover the client-composed lane.** Some of what Hubly says is written in
  `public/platform-home.html`, not the registry, and its promises are not in this count.
- **Nothing here is fixed.** `updateJob`'s example now works and has a check; the other 62 are
  reported, not repaired.
