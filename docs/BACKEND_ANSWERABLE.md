# What Hubly stores vs what an owner can ask about

Recorded 2026-09-08, against the live database read through `supabase db query --linked`.

**The ruling this serves:** anything Hubly stores about a business, its owner must be able
to ask about. This is the map of where that is true and where it is not.

**131 base tables + 1 view (`business_events`).** Every one is in exactly one bucket
below, so the list is closed and a future reader can disagree with a specific placement
rather than with a gap. Row counts are exact `count(*)`, not `n_live_tup`.

---

## STATUS 2026-09-08 — the gap is closed, and closing it found four more things

All 28 owner-facing tables now have a reader. `docs/backend-answerable.json` is the
machine-readable form of this document and `scripts/check-backend-answerable.mjs`
fails the build if an owner-facing table has no slice — resolved THROUGH the SQL
functions, not by grepping names. What building it turned up:

1. **There are three stores for opening hours, not one.** This document originally
   named `settings_business_hours` (23 businesses). There is also
   `businesses.meta.hours` (10 businesses, and the shape a CLASSIC page renders from)
   and `businesses.hours_note` (free text). Only 1 business is in both of the first
   two. **Graef is in the meta group**, so a reader built on the table alone would
   have told the one customer we are saving "no hours on record" while his own page
   showed them — and `get_my_site_gaps.has_hours`, which decides whether to suggest
   setting them, had the same blind spot and would have offered him a fix for a gap
   he does not have. Both now read all three.

2. **Graef has almost no records at all.** His live page shows 8 services, 2
   membership cards, 2 reviews, 5 why-cards. His records hold **1 service** ("clay and
   seal") and **4 customers**. Memberships 0, reviews 0, own photos 0, placed images
   0, before/after pairs 0, service photos 0, site versions 0, rooms 0. Every one of
   those cards is text he typed. "Graef has memberships" is false in every sense the
   product can act on, and the same is true of seven of his eight services. The
   `page_records` slice exists so this is askable rather than assumed.

3. **A job can attach to nobody.** A customer with an email and no phone, whose jobs
   carry neither `customer_id` nor any contact detail, read back as "never had a job"
   while two of her jobs sat in the table. Matching her by NAME would fix the display
   and break the rule that two people called Chris Alvarez are two customers. The
   count of unattributable jobs is surfaced instead of the guess.

4. **The migration ledger diverged on 2026-08-23.** Thirty migrations are applied to
   the database and unrecorded in `supabase_migrations`, so `supabase db push` tries
   to re-run all of them — including one that sets `account_kind = 'real'`, a value
   the constraint now rejects. It failed on that statement, which is the only reason
   nothing worse happened. **Do not run `db push` on this project** until the ledger
   is repaired; apply with `supabase db query --linked -f <file>`.

---

## How "live" was decided, and where that reasoning is weak

A table is reached by live code if its name appears in `supabase/functions/` or `public/`.
**That is counting a FORM, not the fact** — a table written only by a `SECURITY DEFINER`
function or a trigger names itself in SQL and nowhere else. Grepping the application for
table names said 48 tables were untouched; eleven of those are written by SQL in
migrations (`business_event_reads`, `capture_miss_events`, `draft_creation_events`,
`price_extraction_miss_events`, `rebuild_outcome_events`, and the six `campaign_*` seed
tables).

**Expect this number to move again, and treat it as a floor rather than a count.** Every
time we have written a list of "the places a thing can be", the list has undercounted —
the hours finding above is the same failure inside this very document, one day later:
it named one store for hours and there were three. A view, a foreign table, a
`SECURITY DEFINER` function that builds its query with `execute`, or a table reached
only through PostgREST's embedded-resource syntax would all be missed by the same
reasoning. `scripts/check-backend-answerable.mjs` therefore does NOT rely on grep: it
brace-matches each slice and resolves its RPC names to those functions' own bodies. Its
`--live` mode asks the database directly whether a table exists that the classification
has never heard of, which is the only form of this question that cannot silently
undercount.

---

## Bucket A — owner-facing and readable today (6 tables, 6 slices)

`loadOperationalState` is the one reader. Everything here inherits its guarantees:
owner-authorised, honest on an empty business, no invented figures.

| Table | Rows | Slice |
|---|---|---|
| `booking_requests` | 30 | `bookings` (status ≠ abandoned) **and** `leads` (status = abandoned) |
| `jobs` | 3 | `jobs` — upcoming only (`scheduled_date >= today`) |
| `commerce_orders` | 2 | `orders` |
| `chatbot_conversations` | 12 | `chat_leads` |
| `chatbot_messages` | 24 | joined into `chat_leads` for the question they asked |
| `page_loads` | 137 | `traffic` (bots and owner previews excluded) |

Two limits already visible here, before any new slice: `jobs` reads **only the future**, so
"what did I make last month" cannot be answered from it at all; and every slice is capped
at `MAX_ROWS` with no marker saying so.

---

## Bucket B — owner-facing and NOT readable (23 tables)

Each is a question an owner asks about his own business that Hubly currently cannot answer.

| Table | Rows | Businesses | The question it would answer |
|---|---|---|---|
| **`customers`** | **17** | 6 | *Who are my regulars? When did I last see Dana?* Holds name, phone, email, vehicle (year/make/model/colour), preferred service, recurring service/amount/cadence/next date, SMS consent. **14 have a phone, 12 an email, 3 have neither.** |
| **`services`** | **253** | 179 | *What do I charge for a full detail? Which services have no description?* Name, description, price, duration, includes, is_popular. Writable by talking; **not askable.** |
| **`businesses`** | **179** | — | *What phone number is on my site? What's my service area? What deposit do I take?* 58 columns including `phone, email, city, address, zip, state, service_area_cities, hours_note, deposit_type/value, timezone, buffer_before/after_min, travel_radius_miles, years_in_business, business_type`. |
| **`settings_business_hours`** | **126** | **23** | *What are my opening hours?* Structured per-weekday open/close/closed. **Stored for 23 businesses, readable by none of them, and no capability writes it either** — this is the table behind the "Set your hours" suggestion that was removed. A double gap: unreadable AND unwritable. |
| `business_documents` | 427 | — | *When did my site last change? What did it look like before?* Versioned documents with `design_rationale`. |
| `placed_images` | 362 | — | *Which photos are on my site, and where did they come from?* Provider, photographer, licence, slot. |
| `notification_deliveries` | 25 | — | *Did my customer actually get the confirmation?* Channel, provider, status, error. |
| `portfolio_photos` | 3 | — | *What photos of my own work have I uploaded?* |
| `stripe_connect_accounts` | 2 | — | *Can I take payments yet?* `charges_enabled`, `payouts_enabled`, `details_submitted`, `last_error`. |
| `commerce_products` | 2 | — | *What's in my store? What's out of stock?* |
| `commerce_order_items` | 2 | — | *What was actually in that order?* |
| `commerce_product_variants` | 0 | — | sizes/options per product |
| `commerce_collections` | 0 | — | store collections |
| `commerce_collection_products` | 0 | — | collection membership |
| `commerce_store_settings` | 0 | — | *Is my store open? What do I charge for shipping?* |
| `business_places` | **0** | — | *What rooms do I have?* The reader fails open to the full rail when there are no rows, which is correct and deliberate — but the backfill is parked, so **no business has a row and `places.add` has never written one.** |
| `memberships` | 0 | — | built, empty, no reader |
| `recurring_schedules` | 0 | — | built, empty, no reader — overlaps `customers.recurring_*` |
| `review_submissions` | 0 | — | built, empty, no reader |
| `google_calendar_events` | 0 | — | *What's on my calendar?* Connections table has rows-worth of plumbing; events has none |
| `gallery_items` | 0 | — | before/after pairs per job |
| `service_photos` | 0 | — | photos per service |
| `settings_business` | 0 | — | *Duplicates* `businesses` (name/address/city/logo/contact). Empty. Probably should be deleted rather than read — flagged, not decided. |

### The three that matter most, in order

1. **`customers`** — a home-service business *is* its customer list. Hubly holds it and
   shows him none of it.
2. **`settings_business_hours`** — 23 businesses have hours in the database that neither
   they nor Hubly can see, and the one suggestion that offered to fix it was removed
   because nothing writes it. The data is already there.
3. **`services`** — 253 rows, every claimed business. He can change them by talking and
   cannot ask what they currently are.

---

## Bucket C — internal, never surfaced (102 tables)

Named explicitly so the list is closed. Nothing here is a question an owner would ask.

- **Instrumentation and telemetry (13):** `draft_creation_events`, `rebuild_outcome_events`,
  `capture_miss_events`, `price_extraction_miss_events`, `postbuild_fallback_events`,
  `planner_fallback_events`, `document_vocabulary_rejections`, `image_slot_probe`,
  `document_build_jobs`, `hubly_brain_executions`, `hubly_execution_runs`,
  `hubly_reasoning_events`, `studio_analytics_snapshots`.
- **Auth, OAuth and token plumbing (9):** `adobe_oauth_states`, `adobe_lightroom_connections`,
  `google_calendar_oauth_states`, `google_calendar_connections`, `hubly_app_connections`,
  `portal_access_tokens`, `draft_claims`, `settings_oauth_tokens`, `settings_api_keys`.
- **Memory and derived understanding (9):** `business_memories`, `business_memory_changes`,
  `workspace_memories`, `workspace_memory_changes`, `hubly_conversation_memories`,
  `customer_memories`, `customer_profiles`, `business_dna`, `business_conversations`.
- **Read state (1):** `business_event_reads`. **0 rows** — see the finding below.
- **Reference data (8):** `zip_centroids` (40,979), `campaign_goals`, `campaign_industries`,
  `campaign_plans`, `campaign_playbooks`, `campaign_playbook_assets`,
  `campaign_seasonal_calendar`, `campaign_triggers`.
- **Marketplace, a separate product surface (9):** `marketplace_bookings`,
  `marketplace_conversations`, `marketplace_customers`, `marketplace_messages`,
  `marketplace_ops_flags`, `marketplace_ops_notes`, `marketplace_providers`,
  `marketplace_requests`, `addons`.
- **Studio, dead (11):** `studio_assets`, `studio_brand_kit`, `studio_project_exports`,
  `studio_project_pages`, `studio_project_versions`, `studio_projects`,
  `studio_publish_queue`, `studio_settings`, `studio_social_accounts`, `studio_templates`,
  `website_pages`.
- **Photography vertical, dead (13):** all `photography_project_*` plus `photography_projects`.
- **Ask Hubly, legacy (5):** all `ask_hubly_*`.
- **Store scaffolding, all empty and unreachable (9):** `commerce_bundles`,
  `commerce_bundle_products`, `commerce_carts`, `commerce_cart_items`,
  `commerce_discounts`, `commerce_documents`, `commerce_gift_cards`,
  `commerce_inventory_logs`, `commerce_merchandising_recs`, `commerce_product_images`,
  `commerce_shipping_profiles`.
- **Settings scaffolding, all 0 rows with no live reader (12):** `settings_ai`,
  `settings_audit_logs`, `settings_billing`, `settings_branding`, `settings_integrations`,
  `settings_notifications`, `settings_organization`, `settings_permissions`,
  `settings_roles`, `settings_security`, `settings_subscriptions`, `settings_team_members`.
- **Table/UI preferences (2):** `business_table_config`, `user_table_preferences`.

### Two placements to disagree with

- **`business_memories` (6 rows) and `business_dna`** are in C, and the case for B is real:
  *"what do you know about my business?"* is a question an owner asks. It is in C because
  the answer is derived, not stated — surfacing it invites him to correct a paraphrase
  rather than a fact. Worth revisiting; not decided here.
- **`business_conversations` (312 rows)** is his own conversation with Hubly. In C because
  it is already reachable on the surface it belongs to ("See earlier conversation"), not
  because it is internal.

---

## A finding this inventory turned up on the way past

**`business_event_reads` has 0 rows.** It is the per-owner high-water mark that makes the
home screen's "since you last looked" mean anything, and it shipped 2026-09-08 — today.
So 0 rows is consistent with "no owner has loaded the new home yet" and equally consistent
with "`mark_business_events_seen` never lands". **Those two are not distinguishable from
here**, and the failure mode is invisible either way: every event stays `is_new` forever
and the greeting keeps announcing bookings the owner has already read. First real owner
session settles it; until then it is unproved, not working.
