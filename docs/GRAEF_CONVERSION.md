# ⛔ REVERSED 2026-09-07 — DO NOT CONVERT GRAEF TO A DOCUMENT

**This document's plan is WITHDRAWN. It is not an approved plan and must not be picked up as
one.** Everything below the line is kept only as the record of what was considered and why it
was rejected.

## The ruling

**Do not convert Graef to a `business_documents` row. Not now, possibly not ever.** The
conversion designed below is the single most likely way to destroy the work he cares most about.

## The reason — measured, not argued

His acceptance criterion is the **EDITOR UI**: home button, website editor, all buttons
functional. **Not AI parity.** And the decisive fact is that **his content is richer than
anything the generator can produce**, so running his record through the producer is a downgrade
by construction.

`generateFreeformPage` builds its prompt from `buildBusinessRecordBlock(record)`
(`hubly_capability_registry.ts:316`), and `BusinessRecord` (`:285`) has **18 fields**:

> services, photos, reviews, hours, hoursNote, areaCities, city, state, travelRadiusMiles,
> yearsInBusiness, phone, email, address, logoUrl, businessType, about, tagline

**It has no field for anything Graef built by hand:**

| his content | count | in `BusinessRecord`? |
| --- | --- | --- |
| Why-choose cards | 5 | **no concept** |
| FAQ | 6 | **no concept** |
| Social links (his own URLs) | 2 | **no concept** |
| Memberships | 2 | **no concept** |
| Trust pills | 3 | **no concept** |
| Gallery **albums** (named, incl. 3 empty) | 7 | **no concept** — `photos` is a flat list |
| Per-vehicle-class pricing | 32 prices | **no concept** — one `price` per service |
| Booking wizard, deposit terms, `custom*` flags, `ourStory` | 26 fields | **no concept** |

**And it is worse than "those get dropped."** The record block is built from the TABLES, and for
Graef the tables are empty (service-role confirmed): `services` **0 rows**, `review_submissions`
**0 rows**. So the generator would be handed, verbatim from `:316`:

```
SERVICES: none on record. Do not invent a service list.
REVIEWS: none on record. Do not write testimonials, star ratings, review counts…
```

> **Converting him today produces a page with no services, no reviews, no why-cards, no FAQ, no
> memberships and no social links — because the generator is correctly forbidden from inventing
> what the record does not hold, and his record does not hold it. His content is in `meta`.**

The safety property at `:426` (`documentHasOwnerEdits` — refuse to regenerate over
`created_by='patch'`) does **not** protect him: he has no document, so there is no owner-edit
history to detect. The guard that exists for this exact class of destruction cannot see him.

## The job instead

**Make the editor fully work for a NO_DOC business.** Not move him to where the editor already
works. See `docs/GRAEF_EDITOR_BAR.md`.

---

# CONVERTING GRAEF ONTO THE STANDARD PATH — design only, nothing built

**Graef's acceptance criterion, in his words:** *the same display as the others — the home
button, the website editor, and all the buttons working.*

That reframes the job. He is not a special case to preserve; he is a business to **convert onto
the standard path with his content intact**. His manage panel is empty and every `website.*` AI
action returns `not_freeform` for one reason: **he has no `business_documents` row.**

**Definition of done** (his, and ours):
1. Content survives — the `check-graefs-page.mjs` fingerprint **plus** everything in
   `GRAEF_INVENTORY.md` the fingerprint cannot see: the blank trust pill, the 3 empty albums,
   the unfilled `ourStory`, the 4 `custom*` flags, the 3 customers in `meta.pipeline.manual`.
2. Standard UI — home button, website editor, the same rail as everyone else.
3. `GRAEF_COVERAGE_MATRIX.md` **all green, not partially**.

---

# THE RULE, BEFORE ANY CODE

> ## THE CONVERTER RUNS ON A CLONE FIRST. NEVER ON GRAEF.
>
> Seed a test business from the export taken 2026-09-07 (`exports/graefs-autocare-…T18-05-36/`,
> `COMPLETE: true`), convert **that**, verify it against his fingerprint and his inventory, and
> only then touch the real record.
>
> **He has 11 booking requests, 4 customers and 2 jobs. He is not the rehearsal.**
>
> And this is the correction to a mistake made this morning: the migration pilot was chosen by
> blast radius and landed on a case that *could not fail* — aquaspeed's only inlined image was a
> shadowed field, so both directions were invisible and the green run proved nothing. **The clone
> is the opposite choice: the subject that can show the defect.** It carries every item on the
> checklist, so a converter that drops one has nowhere to hide.
>
> The clone must be `account_kind = 'test'`, on its own slug, and it must be seeded from the
> EXPORT rather than by copying the live row — reading the live row again is one more chance to
> touch it.

---

# C1. WHAT IS THE STANDARD PATH?

### `site_mode` is NOT it. Nothing reads that column.

Grepped every `.html`, `.js`, `.ts` and `.sql` in the repo: `site_mode` appears **three times** —
the schema default (`docs/schema.sql:2421`), a debug RLS migration's column list, and a `grant
select` list. **Zero functional readers.** Graef being `classic` does not *cause* anything; it is
a fourth decorative column, the same class as `hubly_pro` (#66).

### What actually decides the renderer: whether a `business_documents` row exists.

`loadLatestBusinessDocumentHtml` (`public/hubly.html:17358`) reads
`get_public_business_document(slug, tag)`. A row → render the stored page. No row → **"the legacy
archetype renderer"**, in the code's own words. **That is the whole discriminator.**

### There are THREE states, not two — and the two document formats support DIFFERENT halves of the AI.

| state | renderer | AI editing |
| --- | --- | --- |
| **1. No document** | legacy archetype | **nothing** — every `website.*` helper has no page |
| **2. Document, `format: 'ast'`** | AST fragment | **`patchDocument` only** (`applyDirectDocumentPatch:1449` requires `ast`) |
| **3. Document, `format: 'html'`** | freeform, in a same-origin `srcdoc` iframe | **six of seven** — `applyDirectFreeformEdit:1885`, `applyOwnerStyleEdit:1643`, `applyOwnerSectionMove:1761`, `applyOwnerNodeMove:1822`, `applyOwnerNodeDelete:1860`, `applyOwnerDesignEdit:4110` all require `html` |

**Graef is in state 1.** `generateDocument` and `newPage` both call `generateFreeformPage`, so the
path the product actually builds today lands in **state 3**.

> ### THERE IS NO STATE IN WHICH ALL SEVEN WORK.
> `patchDocument` needs `ast`; the other six need `html`. **"All green" is not reachable for
> anybody today** — not for Graef, and not for whoever is already on freeform. So the target of
> the conversion does not fully exist yet: **part of it has to be built before anyone is
> converted to it.** That is a finding about the product, not about Graef.

### Which businesses are in which state — NOT MEASURED, and I will not estimate it.

This needs a service-role read of `businesses` + `business_documents` + `services`, and there is
no service key in this session's environment. Guessing the distribution is exactly the kind of
uncounted claim that has cost us a week before.

**`scripts/probe-standard-path.mjs` is written and NOT RUN.** Read-only, GETs only, key from the
environment. It reports the three-state census (all and MARKET-only), the `services`-table vs
`meta.service_catalog` split, the market businesses with hand-entered content ranked, and an
explicit **candidate list of "already good" businesses** — printing, if the list is empty:

> `NONE. The target state does not exist in the corpus — it has to be BUILT before anyone is converted to it.`

**Run it before the conversion is designed further.** If it names a real, market, freeform
business with services in the table and hand-entered content, that business is the reference for
"the same display as the others". **If it names none, Graef is not being converted to a standard
path — he is being converted to a path we are inventing, and that has to be said out loud.**

---

# C2. CAN HIS CONTENT BE EXPRESSED IN IT? — item by item

Target = state 3 (a freeform `html` document) + the record, which is what the archetype renderer
already draws from. **Anything with no home is a gap in the TARGET.**

| item | count | expressible? | note |
| --- | --- | --- | --- |
| Business name, phone, email, city | — | **YES** | record columns; unchanged by conversion |
| Hours (7 days) | 7 | **YES** | `meta.hours`; `applyContactHoursToFreeform:3896` places them |
| Contact block | — | **YES** | `syncFreeformFacts` has a value-swap for contact |
| Services — names | 8 | **YES** | `insertServiceIntoFreeform:3692` + `markServiceAnchorsInFreeform:3835` |
| Services — flat price | 8 | **YES** | `data-hubly-price` span |
| **Services — per-vehicle-class pricing** | 4 classes × 8 | **NO — GAP IN TARGET** | `setServices` and `applyOwnerRecordEdit` both carry ONE `price`. The freeform anchor stamps one price span. **Nothing in the target can hold `{coupe, sedan, suv, van}`.** Converting as-is silently collapses 32 prices to 8. |
| **Services — `includes` line items** | 6+ each | **NO — GAP IN TARGET** | no field, no anchor, no action |
| **Services — per-service photos** | 8 | **NO — GAP IN TARGET** | `media.photos` has no counterpart |
| Services — `flags`, `ai` block, duration | 8 | **NO — GAP IN TARGET** | generation-only today |
| Why-choose cards | 5 | **PARTIAL** | survive as prose in a generated page; **no structured home, no editor after conversion, no AI action** |
| Trust pills | 3 (1 blank) | **PARTIAL** | same; and the blank one must survive as blank — a converter that "tidies" it has changed his page |
| Memberships | 2 | **PARTIAL** | `memberships` table is **0 rows** for him; meta-only today, prose after |
| Manual reviews | 2 | **PARTIAL** | `review_submissions` **0 rows**; meta-only |
| FAQ | 6 | **PARTIAL** | prose only |
| Owner bio (699) | 1 | **YES** | `about` column + `ownerBio` |
| `ourStory` — **empty** | 1 | **YES, and must stay empty** | a converter that fills it invents content |
| Gallery: 7 albums / 26 images | 26 | **PARTIAL — GAP** | images survive as URLs; **album names and the 3 EMPTY albums have no home.** Empty albums are his shelves; dropping them is data loss that no fingerprint catches |
| `portfolioUrls` (same 26) | 26 | **YES** | duplicate of the album set |
| Logo / banner / owner photo | 3 | **YES** | columns + meta, already hosted |
| Service area (25 mi + city) | — | **PARTIAL** | `city` yes; **radius has no AI action and no freeform anchor** |
| Social links (ig, tiktok) | 2 | **YES** in record; **no AI action** | |
| Deposit terms + his sentence | 4 fields | **PARTIAL** | record columns survive; no anchor, no action |
| **Booking wizard — 21 keys in his words** | 21 | **YES, if untouched** | it is `meta.bookingWizard`, read by the booking flow, not the page renderer. **Conversion must not touch it.** The risk is a converter that "normalises" meta |
| **`custom*` flags (4)** | 4 | **MUST BE CARRIED** | they record which sentences are HIS. `updateDraft` sets `customHeroHeadline`/`customHeroSub` (`:6080`). **If conversion drops them, the next rebuild overwrites his words** — the exact defect `check-graefs-page.mjs` exists for |
| `section_order` (4) + `page.blocks` (8) + `profileTabs` (5) | 17 | **GAP** | three ordering records; freeform has none of them. Conversion has to decide which is authoritative and say so |
| **`meta.pipeline.manual` — 3 real customers** | 3 | **CARRY UNTOUCHED** | not page content. **A converter that rewrites `meta` must preserve this key byte-for-byte**, or it deletes three people's records |
| 11 booking_requests, 4 customers, 2 jobs | 17 rows | **YES** | separate tables, untouched by conversion |

**Summary of gaps in the TARGET (not problems with Graef): 8.** Per-vehicle pricing · service
`includes` · per-service photos · service flags/ai · album names and empty albums · service-area
radius · the three ordering records · and the structured homes for why-cards / trust pills /
memberships / reviews / FAQ (asymmetry 2 from the matrix, now blocking conversion rather than
just editing).

**Per-vehicle-class pricing is the one that costs money.** 8 services × 4 classes = **32 prices
he set**, and the target holds 8. That is a pricing change on a live business, made by us,
without asking — the failure class `docs/CLAUDE.md` calls out under pricing advice.

---

# C3. WHAT DOES CONVERSION DO? — a sketch, not a build

**Both, in this order, and the second one is not optional.**

### Step 0 — the clone. `account_kind='test'`, seeded from the export. Nothing else runs first.

### Step 1 — RECONCILE THE HOMES (fixes asymmetry 1 before it is inherited)
Write `meta.service_catalog.services` into the **`services` table** — 8 rows, currently 0. Until
this happens, the editor panel and `setServices` both address an empty table while the page shows
8 services. **Conversion without this ships his site onto a path where his services still cannot
be edited.** Per-vehicle prices, `includes`, photos and flags have no columns — so this step
**must** be preceded by a target that can hold them, or it is lossy and must be declared lossy.

### Step 2 — GENERATE the `business_documents` row from his record
`generateFreeformPage` (`:2175`) with a brief built from his meta, then `markServiceAnchorsInFreeform`
(`:3835`) stamps `data-hubly-service` on every service so the post-build update path exists —
the anchor discipline, applied at generation, where the fact and the element are both in hand.
`format: 'html'`, `tag: 'website'`, version 1.

### Step 3 — CARRY, DON'T REWRITE
`meta` is not regenerated. `pipeline`, `bookingWizard`, `custom*`, `galleryAlbums` (**including
the empty ones**), `ourStory: ""`, `storeOs`, `studioOs` are carried **byte-for-byte**. The only
keys conversion writes are the ones it explicitly owns.

### Step 4 — VERIFY, against both documents
- `node scripts/check-graefs-page.mjs --slug <clone>` → the fingerprint: 162 text runs, 8 links,
  8 services, 5 why cards, 2 trust pills, 2 membership cards, 2 reviews, 2 social icons.
  **Baseline captured BEFORE, compared AFTER, with no `--update` in between.**
- Then the items the fingerprint cannot see, checked by hand against `GRAEF_INVENTORY.md`:
  blank trust pill still blank · 3 empty albums still present · `ourStory` still `""` · 4
  `custom*` flags still true · `pipeline.manual` still 3 entries with phone/email/address ·
  32 per-vehicle prices accounted for (kept, or **declared lost in writing**).

### Step 5 — the UI half of his criterion
Home button, website editor and rail are what state 1 → state 3 is supposed to fix. **Whether
they light up must be verified by signing in AS THE CLONE'S OWNER and clicking them** — not by
reading that the document now exists. Everything a claimed owner touches is a different code path.

### What conversion must NOT do
- Not run on Graef before the clone is green.
- Not regenerate `meta`.
- Not delete `meta.service_catalog` — it is the only copy of the rich fields until the target can hold them.
- Not "tidy" the blank trust pill, the empty albums or the empty `ourStory`.
- Not fill `ourStory` — that is publishing a fact the owner never stated.

---

## The one-line status

**The target does not fully exist.** No state supports all seven AI helpers, eight of his content
shapes have no home in it, and whether any real business is in the good state is **unmeasured
until `scripts/probe-standard-path.mjs` is run**. Converting him today would give him the standard
UI and cost him 32 prices, 7 album names and every structured field the archetype renderer holds.
**Build the missing target first; convert the clone; then Graef.**
