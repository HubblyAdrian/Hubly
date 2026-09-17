# What a visitor actually sees, and which store produced it

Measured 2026-09-15 against the live database, all 41 claimed businesses.
Guarded by `npm run check:service-stores` (`--live` for the count).

## (a) The truth: there are FOUR read paths, not two stores

The framing "two stores disagree" was too small. A visitor's experience is produced by a
different source depending on which page kind the business has and which surface they are on:

| surface | what it actually reads | businesses |
|---|---|---|
| the site — **freeform** page | `business_documents.rendered_html` — **baked at generation**, neither store is read at render time | **29 of 41** |
| the site — **classic** page | `businesses.meta.service_catalog`, rendered live by `hubly.html` | **12 of 41** |
| the booking wizard — freeform visitor | the **`services` table** (`loadServicesFromDb`, the last-resort branch) | 29 |
| the booking wizard — classic visitor | `meta.service_catalog` (`S._serviceCatalog` wins in `loadServicesFromDb`) | 12 |
| the model's view of the business | `get_business_services` — **both stores**, catalogue wins on price | all |

**A business has no `business_documents` row iff it is classic.** Graef is classic — he has no
document at all, which is why his eight services render live from the catalogue.

### The consequence nobody had stated

**On a freeform page the SITE and the BOOKING WIZARD read different sources.** Proved on real
pages, by dumping both:

| business | the page shows (`data-hubly-service` anchors) | the booking wizard offers (`services` table) |
|---|---|---|
| `crestview-window-cleaning` | Clean windows · Interior and exterior window cleaning · Screen cleaning · Hard water removal · *Interior and exterior window cleaning* · *Screen cleaning* | Interior and exterior window cleaning $220 · Screen cleaning $60 · Hard water removal $140 |
| `larkspur-landscaping` | **nothing** | Lawn care $0 · Garden design $0 · Seasonal cleanups $0 |
| `pike-holloway-tree-service` | **nothing** | Storm damage $0 · Tree removals $0 · Pruning $0 · Stump grinding $0 |
| `dawn-patrol-coffee` | 7 names, **no prices** | the same 7, **with prices** |

Two things fall out that were not previously written down:

1. **The anchor count is not a service count.** Crestview's page carries a section heading
   (`Clean windows`) and two duplicated rows among its anchors. Any check that counts anchors
   and calls it "services on the page" is counting a form, not a fact.
2. **Seven freeform businesses show a visitor NO services while their table holds 2–4** —
   `larkspur-landscaping`, `pike-holloway-tree-service`, `aspen-grove-landscaping`,
   `home-and-business-cleaning`, `detailing-chemicals-equipment-courses` (market), `window-washing`
   (market), `lugnutz`. Their booking wizard offers services their site never mentions.

### The store-level divergence

****2 REAL CONFLICTS** (corrected 2026-09-16 — see `docs/SERVICE_STORES_RESOLVED.md`; the old "23 of 41" figure was wrong).** 194 businesses examined: 5 have both stores populated and only 2 hold different content (`adrians-lawn-service`, `graefs-autocare`). The other 81 "disagreements" are an empty store beside a full one, which needs no adjudication.

| | `services` table | `meta.service_catalog` | page kind |
|---|---|---|---|
| graefs-autocare (**market**) | 1 | **8** | classic |
| bucket-mobile-detailing (**market, paying**) | 0 | **4** | classic |
| star-windows | **9** | 0 | classic |
| aquaspeed (**market**) | **3** | 0 | classic |
| dawn-patrol-coffee | **7** | 0 | freeform |

There is no "just read the other one": the fuller store is the table for some and the catalogue
for others.

## (b) The one reader

**`get_business_services(p_business_id, p_owner_id)`** — `20260914080000_services_reader_both_stores.sql`.
It already exists, already reads both stores, and already has the stated rule. Written here so it
is read rather than inferred at a call site:

- **Both stores are read**, joined on the **exact lower-trimmed name**. The join is deliberately
  exact: "Full Detail" and "Full Detail (Truck)" are two services, and a fuzzy join silently
  merges two real services into one.
- **The catalogue wins on price**, because it is what the page renders and what a customer is
  quoted. Graef's one relational row says `0` for a service his page prices at $75.
- **A disagreement is stated, never quietly resolved** — every row carries `source`
  (`services` / `meta.service_catalog` / `both`) and `conflicts`.
- The catalogue stores **cents**, the table stores **dollars**. One unit out; the reader converts.

**Who uses it today:** `hubly_operational_state.ts` only — the model's view of the business.

**Who bypasses it, and should not:**

| caller | reads | why it matters |
|---|---|---|
| `loadServicesFromDb` (`public/hubly.html`) | `services` table directly | the booking wizard for every freeform visitor |
| the classic renderer | `meta.service_catalog` directly | the site for 12 businesses |
| *(removed 2026-09-15)* `hcBookableServices` | `services` table | said "the 1 service you priced" when the customer saw 4 |

Routing the first two through one reader needs a **public** variant (they run with the anon key
and the current reader is owner-gated). That is a migration and it has not been taken.

## (c) The drift: which writer touches which store

**Both directions have a writer, and each writes one store.**

| writer | `services` table | `meta.service_catalog` | baked HTML |
|---|---|---|---|
| `business.setServices` (chat/model), **freeform** page | yes | **NO — was gated by `if (!isFreeform)`** | yes (`applyServicesToFreeform`) |
| `business.setServices`, **classic** page | yes | yes (`applyServicesToClassic`) | n/a |
| the operator editor (`buildBizMeta`, `public/hubly.html`) | **NO — by design** | yes | n/a |

The editor's omission is a stated decision, in its own words:

> `// Phase 6 freeze: persist Service Engine only — no dual-write to editorSvcs / services mirrors.`

**That is the whole explanation of the data.** Chat-edited freeform businesses read table>0,
catalogue=0. Editor-managed classic businesses read catalogue>0, table stale — Graef exactly.

### Fixed

The `if (!isFreeform)` gate is **gone**: one call, one list, both stores. This changes **future
writes only** — no existing row was touched.

The sentence deliberately did **not** follow the write: on a freeform page what the owner SEES is
the patched HTML, so `classicWrote` stays gated on `!isFreeform`. Writing a record is not
changing a surface, and reporting it as one is the split Lesson 11 exists to prevent.

### NOT fixed, and it needs a ruling

**The operator editor still writes the catalogue only.** Reversing a stated freeze is a design
decision, not a side effect of this work. Until it is reversed, an edit made in the operator app
still drifts the table — which is the half that produced Graef's 1-vs-8.

## (d) Reconciliation — NOT performed

Nothing was reconciled. `graefs-autocare` is **read-only** until Adrian rules, and nothing of his
was read beyond counts. What reconciliation would mean, by group:

| group | n | what a reconcile would do | risk |
|---|---|---|---|
| classic, catalogue fuller (Graef 8v1, Bucket 4v0, cotter 2v0, classic-fixture 3v0) | 4 | copy catalogue -> table | low: the table feeds no public surface for a classic business |
| classic, table fuller (star-windows 9v0, aquaspeed 3v0, adrians 9v5) | 3 | copy table -> catalogue | **HIGH: this changes the live page.** star-windows would gain 9 service cards a visitor has never seen |
| freeform, table fuller, catalogue empty | 16 | copy table -> catalogue | changes which source the booking wizard prefers for those visitors |

The middle group is the one to rule on first, and the answer is not obviously "yes".
