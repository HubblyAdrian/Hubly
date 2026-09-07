# GRAEF IS THE SPECIFICATION

`graefs-autocare` — the one real owner who has put sustained work in. He is not a migration
problem to be handled after the new structure is designed; he is the acceptance criteria for it.
**Anything on this list with no home in the new model is a gap in the model, not a problem with
Graef.**

Taken **2026-09-07**, read-only, from the live record. Snapshot on disk at
`exports/graefs-autocare-2026-09-07T17-57-39/` (gitignored — see *What is missing* below).

**How each number here was established:** *measured* — parsed out of the exported row. No
estimates. Where something could not be read, it says so rather than reporting zero.

---

## Where his content lives, at a glance

| home | size | what it holds |
| --- | --- | --- |
| `businesses` row — **56 columns** | 55,411 B | identity, contact, brand, generated copy, section order |
| ↳ `meta` (a **JSON string** inside it) — **52 keys** | 46,254 B | **almost everything he actually made** |
| `business_documents` | **none** | `get_public_business_document` returns `[]` for every tag |
| `brand-assets` storage | **35 objects** | all verified 200 / `image/jpeg` |
| related tables | **UNREADABLE** | see *What is missing* |

**His page is not a stored document.** There is no `business_documents` row at any tag, so the
site is rendered live from this row every time. The rebuild inherits a structured record, not
frozen HTML — which is the good case.

---

## 1. IDENTITY & CONTACT — `businesses` columns

| item | column | present |
| --- | --- | --- |
| Business name | `name` | "Graef's AutoCare" |
| Slug | `slug` | `graefs-autocare` |
| Phone | `phone` | 12 chars |
| Email | `email` | 22 chars |
| City | `city` | "Bakersfield" |
| Business type | `business_type` | `detailing` |
| Timezone | `timezone` | set |
| Instagram | `ig_handle` | 15 chars |
| TikTok | `tiktok_handle` | 16 chars |
| Facebook / Google | `fb_url`, `google_url` | **NULL** |
| Owner | `owner_id`, `owner_identified` | set, `true` |
| Classification | `account_kind`, `tier` | market, `pro` |
| **Empty but modelled** | `address`, `state`, `zip`, `latitude`, `longitude`, `tagline`, `hours_note`, `years_in_business`, `travel_radius_miles`, `service_area_cities`, `location_source`, `signup_device` | **NULL / empty** |

## 2. SERVICES — 8, and they live in TWO places with different price shapes

| # | service | `service_catalog` price | `bookingWizard` price |
| --- | --- | --- | --- |
| 1 | Full Detail | 8500¢ | $85 |
| 2 | Premium Detail | 13000¢ | $130 |
| 3 | Shampoo Detail | 12000¢ | $120 |
| 4 | Clay & Seal Package | 7500¢ | $75 |
| 5 | Paint Enhancement | 15000¢ | $150 |
| 6 | All-in-One Paint Correction | 20000¢ | $200 |
| 7 | Single Stage Paint Correction | 27500¢ | $275 |
| 8 | 2 Stage Paint Correction | 40000¢ | $400 |

Names match exactly across both. **`meta.service_catalog.services`** (12,328 B) is the rich one —
**18 fields per service**: `id, name, description, category, subcategory, status, sort_order,
duration_minutes, pricing, payment, includes, media, flags, addon_ids, ai, recommend_tag,
created_at, updated_at`. Inside those:

- **`pricing`** is not a number. `{mode: "variable", price_cents: 8500, variable_prices: {coupe, sedan, suv, van, …}}` — **per-vehicle-class pricing**. Any new model that stores a service price as one number loses this.
- **`includes`** — a list of line items per service ("Full Foam Bath", "Full Wheel Cleaning", "Door Jams", "Streak-Free Windows", "Full Vacuum", "Plastics Cleaned"…).
- **`flags`** — `{marketplace, website, popular, instant_book_eligible}`, per service.
- **`media.photos`** — **8 service photos**, one per service.
- **`ai`** — `{recommended_addon_ids, frequently_combined_service_ids, suggested_upsells, preparation_instructions}`.

**Add-ons: 3** — Pet hair removal, Engine bay clean, Headlight restore (in `service_catalog.addons`, 8 fields each; also mirrored in `bookingWizard.addons`).

## 3. THE THINGS HE WROTE HIMSELF

| item | count | where |
| --- | --- | --- |
| **Why Choose Us cards** | **5** | `meta.website.whyChooseUs` — `{label}` only |
| **Trust pills** | **3** (one blank) | `meta.website.trustStats` — `{label, value}` |
| **Memberships** | **2** | `meta.website.membershipOffers` — Monthly $60/mo, Bi-Weekly $50 |
| **Reviews** | **2** | `meta.website.manualReviews` — `{quote, stars, author}` |
| **FAQ** | **6** | `meta.website.faq` — question + answer |
| **Owner bio** | 699 chars | `meta.website.ownerBio` (and the `about` column, same length) |
| **Our Story** | **empty** | `meta.website.ourStory` — modelled, never filled |
| Owner name / title | "Graef's" / "Meet Your Detailer" | `meta.website` |

**Section headings and copy he edited** — every one is a separate stored string he can change:
`heroHeadline`, `heroSub`, `servicesTitle`/`servicesSub`, `whyTitle`/`whySub`,
`galleryTitle`/`gallerySub`, `reviewsTitle`/`reviewsSub`, `faqTitle`/`faqSub`, `areaTitle`/`areaSub`,
`ownerTitle`, `footerCtaTitle`, `secondaryCtaText`, `storeSection.{title,sub}`, plus
`sectionCopy.{services,gallery}` and four `custom*` flags recording that he overrode the generated
text (`customHeroHeadline`, `customHeroSub`, `customFooterCta`, `customOwnerTitle`).

> **The `custom*` flags are the part most likely to be dropped.** They are the record that a
> sentence is HIS and not the generator's. Lose them and the next rebuild silently overwrites his
> words — which is exactly the defect `check-graefs-page.mjs` was created for.

## 4. IMAGES — 35 objects, 75 references, zero base64

| where | distinct | note |
| --- | --- | --- |
| `meta.portfolioUrls` | 26 | |
| `meta.website.galleryAlbums[].urls` | 26 | **byte-identical set to `portfolioUrls`** — two homes, one library |
| `service_catalog.services[].media.photos` | 8 | one per service |
| `bookingWizard.services[].image` | 8 | |
| Logo | 1 | `meta.logoUrl` == `businesses.logo_url` == `meta.bkLogoUrl` — **3 homes, in sync** |
| Banner | 1 | `meta.bannerUrl` == `businesses.banner_url` == `meta.bkBannerUrl` — **3 homes, in sync** |
| Owner photo | 1 | `meta.website.ownerPhotoUrl` |

**All 35 verified: HTTP 200, `image/jpeg`.** All in `brand-assets`. **No data URIs anywhere in his
row** — he is already fully migrated, unlike the three businesses in #60.

**Gallery albums — 7, named by him:**

| album | images |
| --- | --- |
| Interior | 12 |
| Exterior | 12 |
| Ceramic Coating | 1 |
| Paint Correction | 1 |
| Restoration | 0 |
| Wax & Sealant | 0 |
| New bucket | 0 |

The three empty albums and "New bucket" are **his organisation**, not junk. A model that drops
empty albums deletes the shelves he made.

## 5. HOURS, AREA, PAYMENT

- **Hours: all 7 days**, `{open, close, closed}` each — Mon–Fri 08:00–17:00, Sat 08:00–15:00, Sun 09:00–17:00. In `meta.hours`. (The `hours_note` column is NULL; `settings_business_hours` unreadable.)
- **Service area**: `meta.serviceAreaRadiusMiles` = 25, `areaQuery`/`areaSub` = "Bakersfield", `travelsToCustomers` = true, `areaZips` empty. The `businesses.service_area_cities` column is **empty** — the real value is in meta.
- **Deposit**: `depositType` `pct`, `depositVal` `25`, `depositCollect` `call`, plus his own sentence in `depositMessage` (58 chars). `payment_setting` = `deposit`.
- **Dirty surcharge**: modelled with 4 tiers, `enabled: false`.
- **Promo**: `promoEnabled: false`, code/percent/text empty.

## 6. BOOKING WIZARD — 21 keys, 5,958 B, all his wording

`headline`, `blurb`, `servicePrompt`, `packagesTitle`, `ctaLabel` ("Book my detail"),
`reviewTrust`, `cancelBlurb`, `helpBlurb`, `whereNote` ("Only Accept @ Home or Drop off's
currently" — **his sentence, his policy**), `studioAddress` ("2814 Mercedes Dr"),
plus **3 where-options**, **5 info fields**, **6 benefit options**, **4 owner tips**,
**3 trust lines**, **4 sidebar includes**, and the 8 services + 3 add-ons above.
`frameId: detailing`, `done: false`.

## 7. LAYOUT & BRAND

`layout: obsidian-gold`, `theme: obsidian`, `composition: classic`, `font: montserrat`,
`gradientKey: sunset`, `hero: minimal`, `headerMode: banner`, `logoScale: 1.7`,
`brand_color`, `bg_color`, `bkBgColor`, `profileBgColor`, `profileBg1`, `profileBg2`,
`profileSheetBg`, `heroMediaPlacement: full`, `tickerEnabled: true`, `pricingVisibility: landing`.

**Order is stored in two places:** `businesses.section_order` = `["portfolio","services","about","story"]` (4), and `meta.website.page.blocks` = **8 blocks** with `{type, variant, order, visible}`. Plus `meta.website.profileTabs` = **5 tabs**.

## 8. GENERATED COPY HE HAS NOT OVERRIDDEN

`gen_about` (518), `gen_hero_headline`, `gen_hero_subhead`, `gen_seo_title`, `gen_seo_description`,
`gen_why_choose` (5), `gen_faq` (6). These sit **beside** the `website.*` values he edited — the
model needs somewhere for both, and a rule for which wins.

## 9. CUSTOMER & PIPELINE DATA — inside `meta`, not in a table

`meta.pipeline` (6,672 B): **3 manual CRM entries**, each with **~37–45 fields** — name, phone,
email, address, stage, status, messages, notes, tasks, activity, estimate, follow-up. **These are
real people.** Plus 4 `stageDefs`, 9 `deleted` ids, and 11 `seen` flags.

> This is the single most surprising thing in the inventory: **his customer records are in a JSON
> blob in the business row**, alongside his fonts. Whatever the new structure does, it has to
> either keep them or move them somewhere real — and it cannot lose them.

## 10. STUDIO & STORE

- `meta.studioOs` (5,406 B): **4 projects** (2× "Review Spotlight", 1 instagram post, 1 "Review Highlight"), **2 queue items**, editor UI state, 0 assets, 0 social accounts.
- `meta.storeOs` (298 B): **seeded, enabled, `showOnWebsite: true`, `storePath: /store`, 0 products.** He has the Store switched on with nothing in it — the #66 case exactly.
- `capabilities` — 4 keys.

---

## WHAT IS MISSING FROM THIS EXPORT — stated plainly

Taken with the **publishable (anon)** key; no service role was available.

1. **35 related tables returned `permission denied`** — recorded as DENIED, never as empty.
2. **20 more returned an empty array, which under this credential is NOT proof of zero rows.** RLS filtering and genuine emptiness are the same response. This group includes **`services`, `booking_requests`, `customers`, `jobs`, `memberships`, `review_submissions`, `recurring_schedules`, `stripe_connect_accounts`**. *This export cannot tell you whether Graef has bookings.*
3. **No storage listing** — objects in `brand-assets` not referenced by the row are invisible.
4. **No auth record, no conversation history.**

**To complete it:** `export SUPABASE_SERVICE_ROLE_KEY` (via `read -rs`, nothing on a command line)
and re-run `node scripts/export-business-snapshot.mjs --slug graefs-autocare`. The manifest's
`COMPLETE` field flips to `true` and every `0` becomes a real zero.

## WHY THE SNAPSHOT IS NOT IN GIT

`meta.pipeline.manual` holds three real customers with **name, phone, email, address and message
history**, and `manualReviews` carries reviewer names. `exports/` is gitignored. This document
carries shapes and counts, never values.

---

## `check-graefs-page.mjs` NOW HAS A SECOND JOB

It was written 2026-09-04 as a regression guard: fingerprint his live page — **162 text runs, 8
links, 8 services, 5 why cards, 2 trust pills, 2 membership cards, 2 reviews, 2 social icons** —
and fail if any of it changes.

**That is also, exactly, the acceptance test for a rebuild.** Same fingerprint after the move =
his content survived. Nothing else we have asks that question of the rendered page.

Two things to hold onto when it is used that way:
- It reads his **live record**, so it must be run before the rebuild to capture the baseline, and
  after, with no `--update` in between. `--update` in the middle would record the damage as the
  new truth.
- It renders **this working tree's** `public/`, not production — a green run means "this tree
  does not break his page", never "production is fine".
- Its counts are of the **rendered page**. Things this inventory found that the page does not show
  — the blank trust pill, three empty gallery albums, the unfilled `ourStory`, the `custom*`
  flags, the 3 pipeline customers — **will not be caught by it**. They need checking against this
  document.
