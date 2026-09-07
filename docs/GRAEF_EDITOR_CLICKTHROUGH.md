# CLICK-THROUGH ON THE CLONE — observed, 2026-09-07

Run on `graef-clone-2026-09-07` (his exact record, `account_kind=test`), signed in as its owner.
**Clone deleted at the end of the session; deletion confirmed by re-reading. The real
`graefs-autocare` was never opened, and after the run still holds 26 portfolio URLs and 5
why-cards — untouched.**

**This replaces prediction with observation. Two of my predictions were wrong.**

---

## THE HEADLINE: Graef's bar is close, and the premise behind the conversion plan was false

**"His manage panel is empty because he is NO_DOC" did not reproduce.** On a claimed NO_DOC
business the shell renders **19 rail entries** — Home, Leads, Jobs, Calendar, Media, Customers,
Pipeline, Inbox, Studio, Reviews, Memberships, Store, Revenue, Reports, Quick Quote, **Website
editor**, Ask Hubly, Apps, Settings — and the **website editor opens and renders his page**, with
the full Builder rail: Website, Store, Packages, Hours, Business info, Membership, Styles,
Logo & brand, Gallery, Book Now, Questions, Add-ons, Stripe.

**Home button: present. Website editor: present and working. Rail: the standard one.** Criterion
2 is met today for a NO_DOC business.

---

## THE LIST

| control | verdict | notes |
| --- | --- | --- |
| Rail — all 19 entries render | **WORKS** | including Website editor |
| Home → dashboard | **WORKS** | LIVE badge, correct URL, View site |
| Leads | **WORKS** | his 3 `meta.pipeline.manual` entries render with service + source + date |
| Customers | **WORKS** | honest empty state, not a fall-through |
| Reviews | **WORKS** | both manual reviews, 5.0 / 2 reviews, Manual badge |
| Memberships → Plans | **WORKS** | both plans, prices, includes, "On website" |
| **Membership edit → save → reload** | **WORKS** | $60→$61 persisted, survived reload, `enabled` preserved |
| Website editor opens | **WORKS** | live preview, Phone/PC, Save & publish |
| Builder rail | **WORKS** | all 13 panels present |
| Service edit panel opens | **WORKS** | photo, name, duration, **6 per-vehicle price fields**, includes, popular, payment |
| **Why-card add → save → reload** | **WORKS** | TESTWHY1 persisted and is on the **public page** after reload |
| **Service description → save → publish** | **SILENT** | see below |
| **`portfolioUrls` on any editor save** | **SILENT DATA LOSS** | 26 → 16, see below |
| Membership "Show on website" checkbox | **suspect** | renders unchecked while the record says `enabled:true` and the card says "On website". Saving did NOT flip it, so no damage observed — but the control misreports state |
| Reviews "AI Reputation Summary" | **fabricated** | see below |

---

## THE TWO REAL DEFECTS

### 1. SILENT — a service description is accepted, rendered, and never persisted

Typed `TESTEDIT1` into Full Detail's Short description → panel Save → **Save & publish**.

- **The preview rendered it.** The card showed `TESTEDIT1`.
- In memory: `S.editorSvcs` and `S.services` both had it. **`S._serviceCatalog` did not.**
- After publish, the catalog *was rewritten* — `service_catalog.updated_at` = the save's timestamp.
- **`TESTEDIT1` appears nowhere in `meta`, and nowhere on the public page after a full reload.**

The save ran, rebuilt the catalog from a source that did not include the edit, and **reported
nothing**. This is the exact shape prohibition 6 exists for: the owner sees their words on screen,
publishes, and the record never had them.

**Broken for everyone, not because of NO_DOC.** It is the editor's own catalog-rebuild path.

### 2. SILENT DATA LOSS — one editor save drops 10 of 26 portfolio images

| | at seed (asserted by the seeder) | after the first Save & publish |
| --- | --- | --- |
| `meta.portfolioUrls` | **26** | **16** |
| `galleryAlbums` urls | 26 (12+12+1+1) | **26 — intact** |
| `meta` bytes | 46,254 | 41,455 |

The albums survived; the flat mirror was truncated by **38%**. No message, no error.

**This is the two-homes defect again** — `portfolioUrls` and `galleryAlbums[].urls` are the same
26 images stored twice (recorded in `GRAEF_INVENTORY.md`), and a save rebuilt one of them wrong.

**It is invisible to the fingerprint** — the end-of-run check reported only my intended edits. The
gallery renders from the albums, so a visitor to *this* composition sees all 26. That makes it a
silent record-level loss, not a visible one **yet** — and precisely the class the inventory
exists to catch, because no page check would ever find it.

**Broken for everyone.** Nothing about it depends on having a document.

### 3. Fabricated metrics on the Reviews dashboard (not a click failure, but it is on his screen)

From **2 manual reviews** on a business created that morning, the AI Reputation Summary asserted
*quality of work 95%, punctuality 92%, communication 90%*, a **"Response Rate 0% / Average 1.8
Hours"**, **"+42%"** new reviews and **"+0.2 This Month"**. None of that is recorded anywhere.
Same class as a checkmark nobody earned — a number the system did not measure, stated as fact.

---

## MY PREDICTIONS, SCORED

| prediction | verdict |
| --- | --- |
| Website editor services OK (reads the catalog) | **RIGHT** — the panel opens fully populated from `meta.service_catalog`; the `services` table stayed 0 rows throughout and nothing in the editor consulted it |
| Claimed-shell panel / AI `setServices` broken (write the empty table) | **not exercised** — no shell-panel service control was reachable in this run. Still unverified; do not report it as confirmed |
| Trust pills broken for everyone (3 fixed slots) | **not exercised** |
| Add-section impossible on classic | **not exercised** |
| **Per-vehicle-class pricing: "editor NO"** | **WRONG** — six price fields, editable |
| **Service `includes`: "editor NO"** | **WRONG** — editable list in the same panel |
| **Per-service photos: "editor NO"** | **WRONG** — thumbnail with remove, plus "+ Add photo" |

**`docs/GRAEF_COVERAGE_MATRIX.md` is wrong on those three rows and must be corrected.** I traced
the code and concluded no UI existed; the UI exists. A code trace is not evidence — that is the
second time today the same lesson has been paid for.

---

## What was NOT covered

Hours, Business info, Styles, Logo & brand, Gallery, Book Now, Questions, Add-ons, Stripe panels;
trust-pill editing; FAQ add; deposit terms; social links; service area; the claimed-shell inline
panel; add-section. **The run ended before them, and an unexercised control is not a passing
control.** Mobile is unverified as always.

## Damage check

`node scripts/check-graefs-page.mjs --slug graef-clone-2026-09-07` (no `--update`) reported
**exactly four changes, all intended**: `$60`→`$61`, and `TESTWHY1` + its icon and placeholder
description, why 5→6. **No unintended visible damage.**

Note the script's own closing hint reads `re-record with: node scripts/check-graefs-page.mjs
--update` — **without `--slug`**, which would have overwritten the real Graef baseline. The guard
added earlier today refuses that. The hint should carry the slug.
