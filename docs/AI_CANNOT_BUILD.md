# WHAT A HUMAN CAN ADD AND THE ASSISTANT CANNOT

**The gap is the roadmap.** Graef hand-built why-choose cards, FAQs and social links with his own
URLs — content types the generator has no concept of — and they render fine. **So the renderer
already supports content the AI can't create.** Every row below is something Hubly claims to
build for people and doesn't.

Measured 2026-09-07, read-only.

## The two questions, kept apart

They need different fixes and must not be conflated:

- **Does the AI have an ACTION to write it?** (the registry: **7 capabilities, 28 actions**
  as of 2026-09-08 — `places`, `operations` and `storefront` since this was written. Counted
  structurally by `scripts/check-draft-arg-name.mjs`'s parser, not by eye. None of the
  fourteen below is covered by any of the twelve added actions; the list is unchanged.)
- **Does the GENERATOR have a CONCEPT of it?** `generateFreeformPage` prompts from
  `buildBusinessRecordBlock(record)` (`hubly_capability_registry.ts:316`), and `BusinessRecord`
  (`:285`) has exactly **18 fields**: services, photos, reviews, hours, hoursNote, areaCities,
  city, state, travelRadiusMiles, yearsInBusiness, phone, email, address, logoUrl, businessType,
  about, tagline.

A "no" in the second column is the deeper failure: **the model is never even told the thing
exists**, so it cannot produce it however it is asked.

## THE LIST

| content type | human can add | renders | AI action? | in `BusinessRecord`? | reserved element? |
| --- | --- | --- | --- | --- | --- |
| **Why-choose cards** | `hubly.html:35210` | `:39801` | **NO** | **NO** | **NO** |
| **FAQ** | `:35235` | `:39856` | **NO** | **NO** | **NO** |
| **Social links** (ig/fb/tiktok/google) | `:17098` | header/footer | **NO** | **NO** | **NO** |
| **Memberships** | `:36742`, `:36805` | membership cards | **NO** | **NO** | **NO** |
| **Trust pills** | `:35263` (3 fixed slots) | `:39659` | **NO** | **NO** | **NO** |
| **Gallery albums** (named, incl. empty) | `:33636` | gallery | **NO** | **NO** — `photos` is a flat list with `kind`+`caption`, no album | **NO** |
| **Our Story** | `:35826` | story section | **NO** | **NO** | **NO** |
| **Deposit terms** (type/value/collect + owner's sentence) | editor | booking | **NO** | **NO** | **NO** |
| **Booking wizard** (21 keys, owner's wording) | wizard panel | booking flow | **NO** | **NO** | **NO** |
| **Per-vehicle-class pricing** | `:15499`+ | service cards | **NO** | **NO** — one `price` | n/a |
| **Service `includes` lines** | `addIncludeOb:15499` | service cards | **NO** | **partial** — `includes` is in the record block but no action writes it | n/a |
| **Per-service photos** | editor | service cards | **NO** | **NO** — `photos` is business-level | n/a |
| **Owner photo** | `:35628` | about | **NO** | via `photos` | n/a |
| **Service-area radius** | `:16076` | area section | **NO** | **YES** (`travelRadiusMiles`) — no action writes it | n/a |
| **Manual reviews** | `:38757` | reviews | **NO** | **YES**, but sourced from `review_submissions` | **`HublyReviews`** |
| Services (name, one price, description) | yes | yes | **YES** `setServices` | yes | — |
| Contact (phone/email) | yes | yes | **YES** `updateDraft` | yes | — |
| Hours | yes | yes | **NO action** | yes | — |
| Bio / about, tagline, hero copy, layout, brand colour | yes | yes | **YES** `updateDraft` | yes | — |
| Logo / banner / hero image | yes | yes | **YES** upload helpers | yes | — |

### Count

**14 content types a human can add and the assistant cannot.** Of those, **12 the generator has
no concept of at all** — it is not that the model refuses, it is that nothing ever tells it these
exist. The document format has **one** reserved element (`HublyReviews`) across all of them.

### The two shapes of the gap

1. **No action, but the record knows** — hours, service-area radius, service `includes`.
   *Cheapest fix:* one registry action each; the data model already holds it.
2. **No action AND no concept** — why-cards, FAQ, social links, memberships, trust pills, gallery
   albums, Our Story, deposit terms, booking wizard, per-vehicle pricing, per-service photos.
   *These need a field on `BusinessRecord` and a line in `buildBusinessRecordBlock` BEFORE an
   action is worth writing* — otherwise the AI can write a fact the generator will drop on the
   next rebuild.

> **Order matters, and getting it wrong is destructive.** Add an action without the record field
> and you have a fact the assistant can write and the next regeneration silently discards. That
> is the same class as the shadowed `meta.logoUrl` — a value stored somewhere nothing reads.

### Why this list, not the store gate, is what "our AI builds it for them" requires

The store gate answers *may this business see a Store tab*. This list answers *can Hubly build
what an owner actually asks for*. **"Add a section for frequently asked questions" fails today at
every layer**: no action, no record field, no reserved element, and no way to add a section on
the classic renderer (`SECTION_DEFS`, `hubly.html:50388`, five fixed types). The gate is one
predicate on top of a producer that cannot make the thing being gated.

**Graef is the proof — of the gap, not necessarily of its cause.** He is the richest business in
the corpus, and every one of the twelve is a request some other owner made and did not get.
But the causal claim that he hand-built *because* the generator cannot conceive of these things
is now a HYPOTHESIS, not a finding: `graefs-autocare` is one of the nine businesses in
`docs/CLAIMED_OWNER_EDIT_LOCKOUT.md` whose `draft_token` is null, so until 2026-09-08 the
assistant refused his four general editing actions outright. Whether he built by hand because
the generator lacked the concepts, or because the assistant refused him at all, or both, is not
established. Do not repeat it as a finding — that is how a scar note becomes folklore.
