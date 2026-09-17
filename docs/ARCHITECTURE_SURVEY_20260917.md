# The architecture survey — Adrian's twelve, answered with rows

**2026-09-17.** *"Each ACTED ON, not read. Rows, not opinions. Insufficient evidence → UNRESOLVED —
DO NOT IMPLEMENT. Do not turn an assumption into architecture."*

**The twelve were recovered from this session's own transcript**, not reconstructed from memory —
`docs/WEBSITE_ARCHITECTURE.md` §10 had recorded that they were missing and refused to invent them.

Every count below was read from the live database today. `account_kind` split beside anything that
describes adoption, because the corpus is ~96% our own test drafts.

---

## 1. Where business capabilities currently live

`supabase/functions/_shared/hubly_capability_registry.ts` — one file, ~5,000 lines. It holds the
capability list, the value roles (`contact.phone`, `contact.email`, `contact.address`,
`hero.headline`, `business.name`…), the appliers (`applyServicesToClassic`,
`applyServicesToFreeform`, the contact/hours placer) and the placement recorder. **It is the only
place a capability is declared**, and the edge functions call into it.

## 2. Where services currently live — TWO STORES, and they disagree

| store | rows | businesses |
| --- | --- | --- |
| `services` table | **281** | **92** (market 5 · internal 1 · test 86) |
| `businesses.meta.service_catalog` | — | **18** businesses carry the key |

This is the known two-store split (`docs/OPEN_FINDINGS.md`: *"the two service stores disagree on 23
of 41 claimed businesses"*). `get_business_services` is the union reader that already exists and is
what any new work must use.

## 3. Whether products already exist anywhere — YES, AND ALMOST NOTHING USES THEM

| table | rows | businesses |
| --- | --- | --- |
| `commerce_products` | **2** | 1 (test) |
| `commerce_orders` | **2** | 1 (test) |
| `commerce_order_items` | 2 | — |
| `commerce_store_settings` | **0** | 0 |

**The tables are built and the store is empty.** Two products and two orders, on one test business.
`commerce_store_settings` has never been written at all.

## 4. How the existing website decides which sections to render — TWO DIFFERENT ANSWERS

- **CLASSIC:** a closed list of five, `SECTION_DEFS` in `public/hubly.html:51786` —
  portfolio · services · about · story · reviews (reviews `visible:false` by default). Order and
  visibility are owner-editable (drag to reorder) and persisted through `section_order`
  (migration `20260817040000`).
- **FREEFORM:** **there is no section list.** The four-section cap was removed
  (`hubly_document.ts:833` — *"The old rule capped the page at four sections… The real defect was
  never the COUNT. It was sections that carry nothing."*). The model decides the structure and must
  justify each reserved Hubly element in a `designRationale` field; the validator rejects a section
  that carries nothing usable rather than one that is not on a list.

## 5. Hard-coded or data-driven — **BOTH, one per path.** Classic: a hard-coded set of five whose
ORDER and VISIBILITY are data. Freeform: neither — it is model-decided, constrained by a validator.
**Confirmed that nothing replaced the closed four-section list**, which was Adrian's open half of
this question.

## 6. Whether multiple pages already exist — **NO. `website_pages` holds ZERO ROWS.**

The table exists, `page_type` exists, and **nobody has ever written to it**. Multi-page is a table
and nothing else. (This is the question Adrian flagged as "nobody has looked". Now someone has.)

## 7. What payment infrastructure already exists

| | |
| --- | --- |
| `stripe_connect_accounts` | **2 rows, 2 businesses, both test** |
| edge functions | `stripe-connect-onboard`, `stripe-connect-connection`, `stripe-webhook`, `create-booking-checkout`, `create-store-checkout`, `customer-portal` |
| the webhook's job | creates a job from a paid booking, through `_shared/booking_job.ts` |

**The plumbing is real and connected end to end** — the Stripe webhook is the only caller of the
shared job writer, with `reason: "payment"`. What is missing is not infrastructure: it is anyone
using it.

## 8. What revenue information exists — **almost none, and that is the answer to the CTA question**

| | |
| --- | --- |
| paid jobs | **0** across every business |
| commerce orders | 2 (test) |
| booking_requests with a payment | 0 paid outside test |

Adrian flagged Q8 as the one that decides *"the one non-derivable cell: hero CTA prominence for a
business that does both."* **The rows cannot decide it.** There is no business with both product
revenue and service revenue — there is no business with revenue. → **UNRESOLVED. DO NOT IMPLEMENT
a revenue-weighted CTA rule.** The honest default is the one the owner states.

## 9. What the "AI Creative Director" actually is

**A system prompt plus a hand-written validator, in JSON mode.** `hubly_ai.ts:819` sets
`response_format = { type: "json_object" }` when `jsonMode` is on — the untyped mode, with no
schema. `validateHublyDocument` then checks SHAPE and EMPTINESS in TypeScript: allowed tags,
allowed attributes, class tokens, no `mailto:` CTA, no section that carries nothing. **It checks
nothing about truth.** The name implies a role the code does not have, and saying so plainly is
part of the answer.

## 10. Which decisions can already be derived

- which services exist, and their prices — `get_business_services` (the union reader)
- whether a business can be booked — services + hours
- whether it has photos, a logo, a service area, a phone/email/address — all on the record
- which places it has earned — `business_places` + the earning predicate
- whether two things on a day overlap — `hcMarkClashes`, from start + duration
- what its page currently says — the stored document, readable and diffable

## 11. Which decisions currently require owner input

- the business NAME (extracted or asked — never constructed; `check-name-is-asked` drives the live
  endpoint to prove it)
- prices, hours, service area, phone — every fact write requires a value from the current turn
- whether a place becomes a tab (the offer, and the accept)
- brand colour and logo
- **whether a booking is accepted** — and as of today that can be done from either shell

## 12. Which decisions have no supporting data yet — **the UNRESOLVED register**

| decision | why there is no data |
| --- | --- |
| hero CTA prominence for a business that does both | zero businesses have revenue of either kind (Q8) |
| whether multi-page is wanted | `website_pages` has never held a row (Q6) |
| what a storefront should look like | 2 products, 1 business, 0 store settings (Q3) |
| whether a section type is "worth it" | nothing measures whether a section earned attention — §7 of `WEBSITE_ARCHITECTURE.md` says nothing catches "this is a boring website" |
| how often the model omits a service | `price_extraction_miss_events` exists; nothing reads it here yet |

---

## The additions (a–d)

**(a) LAYER LEAKAGE — the sweep is in `docs/WEBSITE_ARCHITECTURE.md` §9 and is NOT repeated here.
RENDERER INTO RULES — Adrian's "THE BIG ONE" — has one confirmed instance in this survey:** classic's
five-section list is a RENDERER fact (the template has five slots) that behaves as a RULE (those are
the sections a business may have). Freeform has already left it behind; classic has not.

**(b) THE THREE FREEFORM QUESTIONS — derived-vs-baked is answered first, as instructed:**
**a freeform page CANNOT have a section inserted after the build.** The patch path is a value-swap
and an anchor stamp (`markServiceAnchorsInFreeform`, `placeOneServicePrice`, `syncFreeformFacts`);
there is no INSERT. It has never inserted one. The three options and their costs are NOT chosen
here — that is §8 of `WEBSITE_ARCHITECTURE.md` and it stays UNRESOLVED.

**(c) HYBRID IS THE UNION — not testable today.** One test business has both a product and a
service; there is no market business with both, and the storefront rules do not exist yet, so a
red-proof would be measuring a fixture. **UNRESOLVED, with the reason.**

**(d) NO INVENTED THRESHOLDS.** Q8 and (c) are the two places this round would have produced one.
Both are recorded as UNRESOLVED instead.
