# The two service stores, resolved — 2 real conflicts, not 83 and not 23

**Measured 2026-09-16, read-only.** Ordered because two numbers were in tension: "83 of 194
disagree" and "5 have both stores populated" cannot both describe conflicts.

## (a) THE TENSION RESOLVES — the disagreement is almost entirely one-sided emptiness

| | |
|---|---|
| businesses examined (claimed, or named rather than `site-*`) | **194** |
| both stores populated | **5** |
| only the `services` table | 78 |
| only `meta.service_catalog` | 3 |
| neither | 108 |
| "counts differ" | 83 |
| **both populated AND different — REAL CONFLICTS** | **2** |

**83 = 78 + 3 + 2.** A one-sided "disagreement" is an empty store, not a conflict, and needs no
adjudication. **Adrian's "23 of 41" was wrong, and my "83 of 194" was misleading in exactly the way
he suspected.**

### The five both-populated businesses, printed in full

| business | kind | table | catalog | verdict |
|---|---|---|---|---|
| `apollo-weeds` | test | 1 | 1 | same content |
| `evergreen-yard-care` | test | 6 | 6 | same content |
| `hubly-paging-fixture` | test | 2 | 2 | same content |
| **`adrians-lawn-service`** | test | **9** | **5** | **CONFLICT — different businesses entirely** |
| **`graefs-autocare`** | **market** | **1** | **8** | **CONFLICT — the table holds one stray row** |

- **`adrians-lawn-service`**: the table holds WINDOW CLEANING services *with duplicate rows*
  (`Exterior Window Cleaning` twice, `Hard Water Spot Removal` twice); the catalog holds LAWN
  services. Two different businesses' worth of data in one record.
- **`graefs-autocare`**: the catalog holds his 8 real, priced services. The table holds a single
  lowercase row, `clay and seal`. **This resolves an old scar**: the reader that once reported
  Graef as having one service, "clay and seal, price 0", was reading the TABLE.

## (b) WHO IS ACTUALLY SERVED BY THE CLASSIC RENDERER — and it is not only Graef

41 claimed businesses; 29 have a freeform document, **12 do not** and are therefore served by the
classic template. **Four of those twelve are `market`:**

`aquaspeed` · `bucket-mobile-detailing` · `devdetailing661` · **`graefs-autocare`**

(The other eight: `adrians-lawn-service`, `cedar-ridge-plumbing`, `cotter-aviation`,
`hubly-classic-fixture`, `hubly-paging-fixture`, `my-auto-detailing`, `my-photography`,
`star-windows`.)

**So "Graef is the only one that will do the old store" is true as an intention and not as a fact
today.** Three other market businesses would lose their page if classic were retired now.

## (c) THE HISTORY — partially established, and said so

**Established:** `c62cdd2` (2026-09-13) *"The classic store gets a writer, and the sentence that
denied it ships with it"* — the classic/catalog store got its writer only three days ago.
`syncEditorPackagesToServices()` copies `S.editorSvcs` → `S.services` **in memory only**, and only
as the FALLBACK when `scheduleEditorCatalogPersist()` throws. So there is a partial both-write, and
it never reaches the database on the happy path.

**NOT established, and I am not guessing:** which store existed first, and which commit introduced
the second. That needs a full archaeology pass over the migration history and I did not do one.

## (d) GRAEF, READ-ONLY — and the membership premise is not visible in the data

His catalog, all 8 `active`, all `website: true`, all priced, all `mode: variable` (priced by
vehicle size):

| service | price |
|---|---|
| Full Detail | $85.00 |
| Premium Detail | $130.00 |
| Shampoo Detail | $120.00 |
| Clay & Seal Package | $75.00 |
| Paint Enhancement | $150.00 |
| All-in-One Paint Correction | $200.00 |
| Single Stage Paint Correction | $275.00 |
| 2 Stage Paint Correction | $400.00 |

**Which store I read and why:** the catalog. `getBookingServices()` — the page's and the booking
wizard's own reader — prefers `editorSvcs`, which loads from the catalog; the table's single
`clay and seal` row is not what a customer sees.

**"Graef has memberships" is not in the data.** `memberships` table: **0 rows** (and it exists with
the right shape — `plan_name, service_name, cadence, price, next_due_date, includes`).
`meta.membership_offers`: **0 businesses**. No catalog entry categorised as a membership. Across the
whole corpus only **three** membership-shaped service names exist, all on test businesses
(`Monthly Flight Club`, `Quarterly Maintenance Plan` ×2).

**This is a question for Adrian, not a thing to guess**: either he sells memberships off-system, or
they live somewhere I have not found. It matters because he said we model from him.

## (e) ACROSS ALL 194

**Membership-shaped:** 3 service rows, all test. Listed above.

**Quote/estimate-shaped:** 7, all test — `Landscape Design Consult`, `WEED PULLING`,
**`Car Restoration`**, `Headlight Restoration`, and three `site-*` drafts. Adrian's own two examples
are both here.

**Discount-shaped: NOTHING.** Zero in `meta`, zero in service names, zero in page copy. One
conversation matched and it is a false positive — *"a nervous first-time student"*. **There is no
discount data to reuse.** Whatever the discount model is, it is new.

## (f) THE 403 PATCHED VERSIONS — and the data is NOT trapped

633 document versions across 179 businesses: **403 `patch`**, 207 `ai`, 23 `system`.

**What a patch changes:** sampled `hearth-and-iron` v2 — the prices are byte-identical before and
after (`$9 | $11 | $5.50 | $6 | $8.50 | $22`) while the document doubled in size. That patch is
structural, not factual.

**The decisive measurement:**

| | |
|---|---|
| businesses with a stored page | 179 |
| pages with prices baked into the HTML | **37** |
| of those, prices ALSO in a store | **35** |
| **prices baked with NO store at all** | **2** |

The two: `rell-okonjo-photography` and `wynne-castellan` — both **unclaimed test drafts**, both
holding `$340 / $1,400 / $2,600`.

**So the facts are duplicated, not trapped.** A rebuild would cost the DESIGN and the owner's
edits. It would cost FACTS on two unclaimed test drafts.
