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

## What this does not do

- **It does not test any of the 62.** Running them needs each capability's backend and, for most,
  an authed session against a real business. This is a list to work through, not a verdict.
- **It does not cover the client-composed lane.** Some of what Hubly says is written in
  `public/platform-home.html`, not the registry, and its promises are not in this count.
- **Nothing here is fixed.** `updateJob`'s example now works and has a check; the other 62 are
  reported, not repaired.
