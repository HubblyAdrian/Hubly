# Website architecture — the layers, and what actually guards them

**Status: MEASUREMENT, 2026-09-17. Nothing in this document has been built.**
Adrian's designer's framing, Adrian's rulings, and what the code does today — measured, not read.

---

> ## OPENAI IS ALLOWED TO BE CREATIVE ABOUT THE EXPERIENCE.
> ## IT IS NOT ALLOWED TO BE CREATIVE ABOUT THE TRUTH.
>
> *— Adrian's designer, 2026-09-17. This is the sentence the rest of the document serves.*

---

## 1. The layers

**SUPERSEDES the earlier four-layer wording.** Adrian's, corrected by his designer, and the correction
is the whole thing:

| | |
|---|---|
| **DATA** | determines **what is true** |
| **RULES** | determine **what the system must never violate** |
| **AI** | determines **the customer experience** |
| **THE RENDERER** | makes that experience **real** |
| *(and the owner)* | answers what the system genuinely cannot know |

**WRONG, and it was mine:** *"Data determines what exists. Rules determine what is REQUIRED. AI
determines what deserves emphasis."*

**Why the correction matters, in one line: RULES ARE PROHIBITIONS, NOT PRESCRIPTIONS.** *"Rules
determine what is required"* quietly becomes a template — a list of sections every page must have, a
hero that must exist, an order that must hold. *"Rules determine what must never be violated"* cannot
become a template, because a prohibition says nothing about what to build.

---

## 2. The sections are a VOCABULARY, not a menu

> *"The AI Creative Director has a vocabulary of available capabilities, but is free to compose the
> experience."* — Adrian's designer

**Do not build a select-from-a-fixed-menu section picker.** That is another template system wearing a
creative name. The AI may compose Hero → Editorial Product Story → Best Sellers → Customer Photo
Mosaic → Brand Manifesto → Product Comparison → Reviews → Shop CTA if that is the best experience for
that business. Six sections or twelve. Unusual ordering. Asymmetric layouts. Its call.

**What it may never do is say something untrue.**

### 2a. And the designer is right that "a vocabulary of sections" is still a menu

`AVAILABLE_SECTIONS = [Hero, Reviews, Products, …]` is a bounded template system pretending to be
freeform. The answer is **primitives**: text · image · video · product · service · review · button ·
grid · stack · columns · media · navigation · form. Then a *Customer Photo Mosaic* is not a section the
model must be granted — it is `section → grid → image × 4 → caption`, composed.

**MEASURED, AND THE ANSWER IS GOOD: the renderer already has primitives, not sections.**

- **The closed four-section list was removed on 2026-08-18.** Its own comment says why: *"It prevented
  the Lehi failure by making the page too short to contain a repeated section — a blunt instrument that
  also stopped a business with eight real things to say from saying them."*
- `ALLOWED_TAGS` is **semantic HTML**: `section, div, header, footer, nav, main, article, aside,
  figure, figcaption, hgroup, address, h1–h6, p, span, strong, em, blockquote, q, cite, abbr, small,
  mark, sub, sup, s, del, ins, code, pre, time, ul, ol, li, dl, dt, dd, table, caption, thead, tbody,
  tfoot, tr, th, td, colgroup, col, details, summary, a, img, video, br, hr, wbr, svg, path, circle,
  rect, line, polyline, polygon, g`.
- **Layout is real primitives, as validated class tokens:** `flex` · `grid` + `grid-cols-*` +
  `col-span-*` · **`columns-2/3/4` + `break-inside-avoid`** (true masonry — "packs items of different
  heights, which a grid cannot do") · `overflow-x-auto` + `snap-x/snap-mandatory/snap-start` (a
  sideways-scrolling strip) · `aspect-*` · `relative`/`absolute`/`inset-0` (text over a full-bleed
  image).

**So primitives are reachable NOW, not a later rewrite.** *Customer Photo Mosaic* today is
`section > div.columns-3.gap-4 > figure > img.object-cover + figcaption`. **Nothing needs to be built
for the vocabulary to be open. It already is.**

The gap is not the renderer. It is §4.

---

## 3. Constrain the output, not the creativity — what the generator returns today

**Measured.** `generateAndValidateDocument` → `HublyAI.complete({ jsonMode: true })` →
`body.response_format = { type: "json_object" }`.

| | |
|---|---|
| **Free text?** | **No.** It is JSON, and the model is told the exact node shape. |
| **Structured Outputs (`json_schema`, `strict: true`)?** | **No.** `json_object` only — the API enforces *"this is JSON"*, nothing more. |
| **What enforces the shape, then?** | `validateHublyDocument`, a hand-written validator, **after** the call — plus **one retry** carrying the exact errors back to the model. |

The model returns `{ designRationale, root }`; only `root` is validated. The first attempt's result is
kept separately as the honest signal, *"because the retry is already contaminated by the rejection
messages, so its vocabulary is ours, not the model's."*

**The upgrade available:** moving `document_generate` to `response_format: { type: "json_schema",
strict: true }` would make the SHAPE unrepresentable rather than rejected-and-retried. It is a small
change and it does not touch composition — which is exactly the designer's point: **constrain the
output, not the creativity.** Not done; recorded.

---

## 4. ★ THE MEASUREMENT THAT MATTERS: does anything ground the generated page?

### The answer is **no. Nothing does.** Proven by trying it.

`validateHublyDocument` was run on a shape-perfect page written for a **real market business**, full
of claims that business has no rows for:

> "Trusted by 200 customers across Utah County." · "Rated 4.9 stars from 312 reviews." · "Licensed,
> bonded and insured since 2009 — 15 years serving Utah County." · "Diamond Ceramic Package — $4,999" ·
> "Same-day service, guaranteed, or your money back" · "Free pickup and delivery within 50 miles" ·
> "1400 W Main St, Provo UT — open 24 hours, 7 days a week." · "Call us on 801-555-0000."

```
{ "ok": true, "errors": [], "warnings": [] }
```

**Zero errors. Zero warnings.** Every one of those is on Adrian's *cannot invent* list.

**What the validator does check** is shape (tags, attributes, class tokens, media origins) and
**emptiness** — the Content Value Rule, which rejects a section carrying no "concrete content": *a
price, a number, a list of two or more items, a table, an expandable question, an image, or a Hubly
element.* On the first run the fabricated hero WAS rejected — **for having no qualified figure in it.**
Adding *"15 years serving Utah County"* — itself a fabrication — satisfied the rule and the page passed.

**The emptiness rule requires a number. It does not care whether the number is true.** That is the gap
stated as precisely as it can be.

### The live corpus — 185 pages, 438 claims

| claim shape | ungrounded / found | on market pages |
|---|---|---|
| **years in business** | **27 of 27** | 0 of 0 |
| **availability** (same-day, 7 days a week) | **20 of 20** | 0 of 0 |
| **phone** | **13 of 280** | 0 of 0 |
| **price** | **9 of 107** | 0 of 2 |
| review count | 2 of 2 | 0 of 0 |
| customer count | 1 of 1 | 0 of 0 |
| address | 1 of 1 | 0 of 0 |

**73 ungrounded claims across 21 businesses. All on test/internal pages. Market: 2 claims, 0
ungrounded.**

#### THE MARKET NUMBER IS NOT REASSURING, AND HERE IS WHY — read this before quoting it

**Only 6 market businesses have a generated document at all**, and four of them hold under 50
characters of text (`lugnuts-regulators` 20, `modern-landscaping-business` 29, `site-aa7537` 48 — empty
starts). **The four market businesses with real pages — `graefs-autocare`, `aquaspeed`,
`bucket-mobile-detailing`, `devdetailing661` — are CLASSIC and have no `business_documents` row, so
they are invisible to this measurement entirely.** Their pages are rendered from `meta` by a template,
so a claim there would come from the template, not the model — a different question, and one this
measurement does not answer.

**So "market: 0 ungrounded" means "we have almost no market freeform pages", not "the guardrail
works". There is no guardrail.**

#### The sharpest row, verified against the rows and not through my extraction

| business | phone on record | phone the page shows |
|---|---|---|
| `hearth-iron` | 801-555-2200 | **801-555-8888** |
| `copperwick-kilns` | 801-555-9001 | **801-555-7420** |
| `saltmarsh-bindery` | 801-555-2277 | **801-555-9001** |
| `bucket-mobile-detailing-09616` | *(none)* | **774-933-0822** |

**`saltmarsh-bindery`'s page shows `801-555-9001` — which is `copperwick-kilns`'s number.** The model
gave one business another business's phone. All four are test fixtures, so no real customer called a
stranger — **and the mechanism is identical on a market page, with nothing that would have stopped
it.**

Also live today: *"22 years in business"*, *"since 1998"*, *"18 years in business"*, *"15 years"*,
*"14 years"*, *"6 years"* on nine different businesses. **There is no founding-year column.** And
`rell-okonjo-photography` / `wynne-castellan` publish `$340`, `$1,400`, `$2,600` with no offer priced
at any of them.

#### What this number is, honestly

- **It counts a FORM, not a fact.** Every shape in `CLAIM_SHAPES` is one we thought of; prose has no
  closed set of forms. **73 is a FLOOR.**
- **It cannot see a claim that is true but unrecorded.** An owner who really is licensed, but whose
  licence is in no table, reads here as ungrounded. That is the right reading for *us* ("we cannot show
  it is true") and the wrong reading for *him* ("he is lying"). **Every row is a CANDIDATE.**
- Two rows are probably extraction artifacts and are named rather than hidden: `"8890 Review"`
  (`marisol-vane`) and `"2 Homeowner"` (`brightleaf-cleaning`) read like fragments of a review embed
  and a heading, not sentences a model wrote.

---

## 5. The answer: ground the PAGE the way we ground the CONVERSATION

A fixed menu is easy to validate — one validator per section. **An open vocabulary means the validator
must handle a composition nobody predicted.** The designer's *"as long as it has the actual ingredients
to do it"* is carrying enormous weight.

**So do not validate SECTIONS. Validate CLAIMS.** Every factual assertion on a generated page must
trace to a row. The model composes anything; it asserts nothing untrue.

**A finite rule that validates infinite creativity.** It is the mechanism already built for the
conversation (`phoneGrounded`, `priceGrounded`, `addressGrounded`, `timeGroundedWhy`,
`cadenceGroundedWhy`), one layer up — and grounding is already a *rules protect reality* rule, not a
composition rule, which is why it is the right shape to lift.

### 5a. The three categories

```
SOURCE     review_count = 47                              ← a row
   ↓
DERIVED    "47 customer reviews" · "dozens of reviews"     ← a restatement of a row
   ↓
CREATIVE   "See why our customers keep coming back."       ← copy; the model's
```

**Only the first two require grounding. The third is copy and it is the model's.**

### 5b. THE TEST that sorts a string into the three — stated, so the categories are not decoration

> **A string is a CLAIM if a reasonable customer could be WRONG by acting on it** — i.e. it is
> falsifiable against the business's records.

Operationally, in `measure-page-claims.mjs`, a span is a claim if it contains:

1. a **quantity** — a number, a money figure, a count, a duration, a distance, a year; **or**
2. a **credential** word — licensed, insured, bonded, certified, accredited; **or**
3. an **availability or promise** word — 24/7, same-day, free delivery, money back, guaranteed; **or**
4. an **identifier** — a phone number, a street address, an email.

Everything else is CREATIVE. *"Our customers keep coming back"* cannot be checked against a row and
nobody can act on it wrongly. *"We have 200 customers"* can, and they can.

### 5c. The subtle part: A DERIVATION CAN BE FALSE FROM A TRUE SOURCE

`47 → "dozens"` holds. **`47 → "hundreds"` is a lie with a real row behind it.**

So the middle category is **not** *"a row exists"* — it is **"the derivation holds"**, and the checker
must be built that way:

- a stated figure **may not exceed** its source (`derivationHolds(claimed, actual)`);
- a vague figure must sit in the right band (`vagueDerivationHolds`): *a few* 1–5 · *several* 3–9 ·
  *dozens* ≥ 24 · *hundreds* ≥ 100 · *thousands* ≥ 1000.

**Red-proof it with an INFLATION, not an invention** — a true source and an overstated claim — because
an invented claim is the easy case and the inflation is the one that will actually get through.

### 5d. The specification of the checker, verbatim from the designer

**The AI CAN invent:** section arrangement · visual composition · headline style · storytelling
sequence · product showcase · split-screen layout · editorial section · visual rhythm · CTA treatment ·
creative concept · how reviews are presented · how products are grouped.

**The AI CANNOT invent:** price · address · phone · reviews · rating · customer count · services ·
products · guarantees · certifications · years in business · availability · shipping promises ·
discounts · locations.

**These two lists are the checker's specification.** And the measurement above says something
uncomfortable about the second one: **for `guarantees`, `certifications`, `years in business`,
`availability`, `shipping promises` and `locations` there is NO COLUMN AT ALL.** Nothing could ground
them even if a checker asked. Those claims must either become **data the owner states** (and then they
ground like a price does) or become **forbidden on a generated page**. There is no third option, and
choosing is Adrian's.

---

## 6. What does NOT change — recorded so nobody re-litigates it

- **Grounding is already a "rules protect reality" rule.** Never writing a price, address, time or
  cadence the owner did not state constrains **truth**, not composition. **It is the right shape and it
  stays.**
- **The section-carries-its-reason check survives.** The reason vocabulary just **widens** — *"because
  the AI chose it and the ingredients exist"* is a good reason. What stays RED is a section with **no**
  reason, which is still the renderer-artifact case it was written for. (`reasoning: { source, reason,
  confidence }` already exists on every node and is already prompted for.)
- **No top-level website type.** Hybrid is the **union**, never a third branch.
- **No invented thresholds.** *"We do not currently have enough evidence to establish this rule"* is a
  valid and wanted result.

---

## 7. ⚠ RULES CATCH FAKE DATA. NOTHING CATCHES "THIS IS A BORING WEBSITE."

**A standing item, not a task. Do not let guardrails be mistaken for a quality bar.**

Rules catch fake data, empty sections and broken flows. **Validity is not quality, and no check will
measure taste.** A page can be entirely true, perfectly valid, fully grounded — and dull, generic,
forgettable, and worse than what a competitor's template produced.

**The only judge of whether the creative director is good is ADRIAN LOOKING AT OUTPUT, regularly, on
real businesses.** That is a process, not code. It does not get a check, it does not get a metric, and
it does not get automated. If this document is ever read as "we have guardrails, therefore the output is
good", it has been misread.

---

## 8. UNRESOLVED — DO NOT IMPLEMENT

*Every entry carries its evidence. Nothing here is built.*

| # | question | evidence today | why it is unresolved |
|---|---|---|---|
| U-1 | **Do ungroundable claims become DATA or become FORBIDDEN?** | No column exists for guarantees, certifications, years in business, availability, shipping promises, locations. 47 of 73 ungrounded claims are in exactly those categories. | Adrian's call. Making them data means asking the owner six more questions; forbidding them means pages cannot say "licensed and insured" even when true. |
| U-2 | **Derived-vs-baked** — *the real tension, and it should be answered first.* | A freeform page is baked HTML with no update path; `placeOneServicePrice` patches prices through a build-time anchor, and hours/logo/service-area/contact have **no anchor and no update path** (recorded in CLAUDE.md). `check-page-price-drift` measures the divergence: 54 baked price spans, 6 comparable, 0 drifting — but only ONE business has both a baked page and a catalogue. | A claim checker that runs at GENERATION does not protect a page whose record changes afterwards. Either every claim gets an anchor (the price pattern, generalised), or pages re-derive claims at render, or drift is accepted and measured. |
| U-3 | **Documents vs applications** — where the boundary is. | The document model renders static semantic HTML with no script. Booking already lives outside it as a reserved element. | **A cart and a checkout cannot be baked HTML.** That is the boundary, and it is the one the storefront work will hit first. |
| U-4 | **Selection-is-the-brief** | No conflict found: the generator already takes the owner's own words as the brief, and the record as the source of every fact. | Listed for completeness; no tension to resolve. |
| U-5 | **Structured Outputs** | `response_format: { type: "json_object" }` today; shape enforced by a hand validator plus one retry. | Moving to `json_schema` + `strict` makes the shape unrepresentable rather than rejected. Small, safe, not done. |
| U-6 | **Classic pages are not covered by any of this** | The 4 market businesses with real pages are classic and have NO `business_documents` row. | A claim checker over `business_documents` sees **none of the market pages that matter**. Ruled 2026-09-16: classic is a supported path. Whatever is built must cover both. |

---

## 9. Layer leakage — the sweep, with AI INTO DATA as the priority

**AI → DATA is the priority because it is the one that corrupts the source of truth.** If model output
becomes a row, every later grounding check passes against a fact the model invented — the guardrail
validates against itself.

**Measured:** the page generator (`generateAndValidateDocument` → `create_business_document`) writes
**only** to `business_documents` — the page and its rationale. It does not write `businesses.meta`,
`services`, or any record row. **No AI→DATA leak on the generation path.**

**But two live paths do write model output into rows, and both are known:**

- **`patch_business_in_progress` / `set_business_service_catalog`** — the conversation's fact writers.
  These are *supposed* to write what the owner said, and the grounding mechanism is exactly what keeps
  them honest. That is the design, not a leak.
- **The seeded membership defaults** (fixed 2026-09-16) were a DATA→DATA leak of a different kind:
  values nobody stated, written to a row, then published. Named here because it is the same failure
  mode one layer over — *a value with no person behind it becoming a fact the system trusts.*

**RULES → AI leakage: none found.** The class-token allowlist and the Content Value Rule are
prohibitions; they do not prescribe a composition.

**AI → RENDERER: the renderer accepts only the validated grammar**, so a composition the validator
rejects cannot reach a page. This is the layer that is working.

---

## 10. What I could not do in this round

- **Adrian's twelve code questions are not in this conversation's context** and I will not invent
  twelve questions to answer. They need to be re-sent, and each will be acted on.
- The claim checker is **not built** — this is a stop point, and §5 is its specification.
- `measure-page-claims.mjs` and `scripts/sql/export-page-claims.sql` **are** built, because the
  measurement was the ask. They are re-runnable and the number moves as the corpus does.
