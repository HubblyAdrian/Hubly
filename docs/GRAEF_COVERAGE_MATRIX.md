# GRAEF COVERAGE MATRIX — buildable BOTH ways, or it isn't built

Extends `docs/GRAEF_INVENTORY.md`. The requirement: **everything Graef has must be creatable and
editable BOTH by hand in the editor AND by asking the AI — and when a page has no such section at
all, adding the SECTION must also work both ways.**

Read-only, measured 2026-09-07 against the code and his live record.

## The two lanes, named first

| lane | where it lives | how it writes |
| --- | --- | --- |
| **Editor (hand)** — website editor | `public/hubly.html` | mutates `S.website.*` in memory, then `saveStorefront()` `:16981` writes the whole record |
| **Editor (hand)** — claimed shell, inline | `public/platform-home.html:4307` | `directRecordEdit` → `applyOwnerRecordEdit()` (registry `:4297`) |
| **AI** | `supabase/functions/_shared/hubly_capability_registry.ts` | the capability registry — **5 capabilities, 16 actions, and that is the whole surface** |

**The AI's complete write surface**, enumerated from `HUBLY_CAPABILITY_REGISTRY` (`:4958`):

| capability | actions | writes facts? |
| --- | --- | --- |
| `operations` | `read` | **no — read-only** |
| `website` | `analyze`, `generateDocument`, `newPage`, `patchDocument`, `setChrome`, `setDesignKnob`, `restyleElement` | **freeform documents only** |
| `online_presence` | `analyze_facebook`, `analyze_instagram`, `analyze_google_business` | **no — read-only** |
| `booking` | `getAvailability`, `create` | bookings |
| `business` | `startDraft`, `updateDraft`, `setServices` | **the only fact writers** |

`business.updateDraft` (`:6000`) accepts exactly: **name, tagline, about, businessType, phone,
email, city, brandColor, heroHeadline, heroSubhead, seoTitle, layout**. `setServices` (`:6126`)
writes the services list. **Nothing else in the registry writes an owner fact.**

> **And every `website.*` action is INERT FOR GRAEF.** They operate on a `business_documents`
> row; he has **0** (service-role confirmed). `site_mode: classic`. Any of them returns
> `not_freeform` (`:3060`, `:3858`, `:3901`). So the assistant's entire page-editing capability
> does not apply to the one owner who has done the most work.

---

## THE MATRIX

| content type | he has | editor: create/edit? | AI: create/edit? | section addable if missing? |
| --- | --- | --- | --- | --- |
| **Services** | 8 | **YES** — `platform-home.html:4307` → `applyOwnerRecordEdit` kind `service` (add/edit/remove), and `hcServicesGrid` `hubly.html:54327` | **YES** — `business.setServices` `:6126` | **fixed** — `SECTION_DEFS` `:50388`, one of 5 |
| ↳ per-vehicle-class pricing | 4 classes | **NO** | **NO** — `setServices` takes one price | n/a |
| ↳ service `includes` lines | 6+ per service | **NO** | **NO** | n/a |
| ↳ service photos | 8 | **NO** — no per-service image UI found | **NO** | n/a |
| **Why-choose cards** | 5 | **YES** — `add-why` `hubly.html:35210` | **NO** | **fixed** |
| **Trust pills** | 3 (1 blank) | **PARTIAL** — `trust-stats` `:35263`, **exactly 3 fixed slots**, `applyWsPeTrustStats` `:36236` | **NO** | **fixed** |
| **Memberships** | 2 | **YES** — `:36742`, `:36805` | **NO** | **fixed** |
| **Reviews (manual)** | 2 | **YES** — `:38757` | **NO** | **toggle only** — `reviews` exists in `SECTION_DEFS` with `visible:false`; no way to add a reviews surface that isn't one of the 5 |
| **FAQ** | 6 | **YES** — `add-faq` `:35235` | **NO** | **fixed** |
| **Gallery images / albums** | 7 albums, 26 images | **YES** — `ensureGalleryAlbums` `:33636`, `:33586` | **NO** — `uploadDraftPhoto` `:3084` places into a *freeform* page (`not_freeform` for him) | **fixed** |
| **Our Story** | empty | **YES** — `applyWsPeOurStory` `:35826` | **NO** | in `SECTION_DEFS` |
| **Owner bio** | 699 chars | **YES** — `ed-ws-owner-bio` `:17095` | **YES** — `updateDraft.about` `:6012` | in `SECTION_DEFS` (`about`) |
| **Hours** | all 7 days | **YES** — `applyOwnerRecordEdit` kind `hours` `:4325` | **NO** — no hours action in the registry | **fixed** |
| **Contact** (phone/email/address) | phone, email | **YES** — kind `contact` `:4306` | **YES** — `updateDraft` phone/email `:6014` | **fixed** |
| **Social links** (ig / tiktok / fb / google) | ig + tiktok | **YES** — `ed-ig`/`ed-fb`/`ed-tk`/`ed-gb` `:17098` | **NO** | **fixed** |
| **Service area** (radius, city) | 25 mi, Bakersfield | **YES** — `:16076`+ | **PARTIAL** — `updateDraft.city` only; radius **NO** | **fixed** |
| **Logo** | 1 | **YES** — `uploadBrandAsset` `:30634` | **YES** — `uploadDraftLogo` `:2825` | n/a |
| **Banner / hero image** | 1 | **YES** | **YES** — `uploadDraftHeroImage` `:4370` | n/a |
| **Owner photo** | 1 | **YES** — `handleProfileHeroImage` `:35628` | **NO** | n/a |
| **Section headings & copy** (~20) | all edited | **YES** — inline `ws-pe-*` editors | **PARTIAL** — hero headline/sub + SEO title only | n/a |
| **Booking wizard** (21 keys, his wording) | all | **YES** — wizard panel | **NO** | n/a |
| **Deposit terms** | pct/25/call + his sentence | **YES** | **NO** | n/a |
| **Layout / theme / font** | 17 fields | **YES** | **PARTIAL** — `updateDraft.layout`, `setDesignKnob` (freeform only) | n/a |
| **Store section** | on, 0 products | **YES** — storefront AST panel `:40547` **has a real "+ Add section"** | **NO** | **the only place a section CAN be added** |

---

## THE THREE ASYMMETRIES

### 1. AI creates it, editor can't edit it — the owner sees content they cannot change

**This is #54, and the export now measures it exactly.**

`business.setServices` writes the **`services` table**. `applyOwnerRecordEdit` kind `service`
also reads and writes the **`services` table** (`:4345`–`:4357`). But Graef's page renders from
**`meta.service_catalog.services`** — and:

> **`services` table rows for `graefs-autocare`: 0.** Service-role confirmed 2026-09-07, so a 0
> is a 0, not an RLS denial.

His 8 services, with their per-vehicle pricing and `includes` lists, exist **only in `meta`**.
Both the AI's writer and the panel's writer address a table that is **empty for him**. The panel
shows nothing because there is nothing in the table; the page shows 8 because it reads meta.
**Same defect on both lanes, from one cause: the content and the editors have different homes.**

Also in this class:
- **`memberships` table: 0 rows.** His 2 memberships are meta-only.
- Per-vehicle pricing, `includes`, per-service photos and the `ai` block are written by
  generation and **have no editor and no AI action** — richer than anything either lane can touch.

### 2. Editor creates it, AI doesn't know about it — the assistant will offer to build what exists, or claim it can't

**Nine content types the editor can create and the AI cannot touch at all:**
why-choose cards · trust pills · memberships · manual reviews · FAQ · gallery albums and images ·
Our Story · social links · service-area radius · owner photo · the whole booking wizard · deposit
terms.

Ask Hubly to "add a reason people should choose me" and there is no action for it. The registry
has no read of these either, so the assistant cannot see that he already has 5 — it can only
decline, or talk about doing it. **Every one of these is content he entered by hand that the
assistant is blind to.**

### 3. Neither can add the SECTION — the content type is unreachable for a business that didn't get it at generation

For the **classic / profile renderer that Graef is on**, the section set is a **closed list of
five**: `SECTION_DEFS` (`hubly.html:50388`) = portfolio, services, about, story, reviews.
`S_sections.splice` (`:50496`) is drag-reorder. **There is no add.** Visibility can be toggled;
a type that is not one of those five cannot be created by any means.

| renderer | add a section? | where |
| --- | --- | --- |
| **classic / profile** (Graef, and every record-rendered site) | **NO** — 5 fixed types, reorder + show/hide only | `:50388`, `:50496` |
| **storefront AST** | **YES** — a real "+ Add section", block catalogue, add/remove/reorder/inspect | `:40547`, `sfAddBlock` `:40616` |
| **freeform document** | **YES for the AI** — `website.newPage`, `patchDocument` | registry `:5095`, `:5182` |

**So "add me a reviews section" is not possible for Graef in either lane** — and the one place in
the whole product where a section CAN be added by hand is the **store**, which is the surface he
isn't using.

---

## THE SYNTHESIS: does the #66 gate design generalise?

Adrian's framing: *adding a Reviews section and adding a Store tab are the same mechanic at
different scopes — a capability the business doesn't have yet, asked for in conversation, written
by the assistant, announced when it lands.*

**Answer: NO, not as designed. It has the right shape and the wrong scope.**

What the #66 design has that generalises:
- **One predicate, read at every surface** — the discipline that stops a capability meaning
  different things in the nav, the page and the route.
- **Earned, not default** — nothing appears until the business asks for it.
- **Announced when it lands** — prohibition 4 and 6, already required.

What breaks when you point it at "add me a reviews section":

1. **It gates a BOOLEAN, not a THING.** `capabilities.store === true` decides whether one fixed
   surface shows. "Add a reviews section" needs a **list with position and configuration** — which
   sections, in what order, with what variant and copy. A second boolean per section type is how
   you end up with the five decorative keys again.
2. **It has no writer.** The #66 design says which surfaces read the flag; it does not say what
   the assistant CALLS to set it. There is no `addSection` action in the registry, and no
   capability that writes `capabilities` at all. Without that, "asked for in conversation" has no
   landing point.
3. **It cannot express the content.** A reviews section with nothing in it is worse than none —
   and the AI has no action that writes a review (asymmetry 2). The gate would grant an empty
   room and no way to furnish it.
4. **It targets the wrong renderer.** Graef is `classic`; the only working add-a-section
   mechanism is the storefront AST. A gate that turns Store on for a classic site still leaves
   every other section fixed at five.

**What would have to change** — say it now, not after it ships:

| # | change |
| --- | --- |
| **A** | **Make the unit a SECTION LIST, not a set of booleans.** One ordered list of `{type, variant, order, visible, config}` per site — the storefront AST's shape (`:40616`), which already works. `store` becomes one entry, `reviews` another. The five capability keys stop being the mechanism. |
| **B** | **Give the classic renderer that list.** Today `SECTION_DEFS` is a hardcoded five. Until it reads a per-business list, no gate design can add anything for Graef. **This is the load-bearing change and it is not part of #66 as scoped.** |
| **C** | **Add ONE registry action — `addSection(type)`** — that appends to the list, and one that removes. That is the "written by the assistant" half, and it is the same call for reviews and for store. |
| **D** | **Close asymmetry 2 for anything you can add.** A section the AI can create and cannot fill is a trap. `addSection('reviews')` has to come with `setReviews`, or it ships an empty room. |
| **E** | **Fix the home mismatch first (asymmetry 1), or the new list inherits it.** Services live in `meta` while both writers address an empty table. Adding a section mechanism on top of that reproduces the bug at a larger scope. |

**Recommendation: do not ship the Store gate as a boolean.** Build **A + B + C** as one mechanism
and let Store be its first entry. The cost of doing it as a one-off is not the rework — it is
that the second caller (`reviews`) will be built against a different shape, and then the product
has two section models that disagree, which is the defect this codebase already has more of than
any other.

---

## What this matrix does NOT cover

- The **mobile** editor. `Claude Code cannot verify mobile` — none of the above was checked at 390px.
- Whether each editor path **actually works when clicked**. This is a code trace: it locates the
  handler, it does not prove the handler saves. Several of these are exactly the kind of path
  that has reported "Saved." over a write that never happened (`applyOwnerRecordEdit:4335` carries
  that scar in a comment). **Every "YES" here is a claim about reachability, not about success.**
