# Settled

**Facts established, closed, and never to be re-asked.** Each is dated and attributed. If a
line here is wrong, correct it with evidence and re-date it — but do not re-open it with a
question. `npm run brief` prints this file FIRST, before anything else, because prose in a doc
nobody opens is how the `supabase db push` ban survived three weeks while a deploy script ran it.

---

**1. HUBLY IS THREE PATHS FROM THE LANDING PAGE, NOT ONE — AND THEY SHARE ONE PAGE.**

1. **Website + backend** — a service business: bookings, jobs, customers, planner.
2. **Storefront** — someone selling things: products, training videos, digital goods.
   **A storefront IS a website.** Same model call, same freeform generation. **No separate
   generator, no separate product architecture.**
3. **Marketplace** — someone who needs help and wants to hire a Hubly user. The demand side.

**The difference between 1 and 2 is the button and what is behind it.** A service card's
action is **Book Now** and opens the booking panel. A product card's action is **Buy** and
opens a checkout panel. **Same card, same block mechanism, different action, different panel.**

Consequences that bind every piece of work:
- `docs/BLOCK_SPEC.md` is **the block spec**, not the services spec — image tile,
  name, price, action button. A service and a product are one card with a different action.
- Flow step 9, "add services creates blocks", **generalises to products with no new
  mechanism**: the freeform insert path already clones a donor entry.
- **Whatever we build for the booking panel must not assume booking.** Checkout is the same
  slot.
*(Adrian, 2026-09-13 — correcting a day of work that assumed one path)*

**2. THERE ARE TWO WEBSITE STORES, and any claim about "pages" states which one.**

- **`business_documents.rendered_html`** — freeform HTML. One writer
  (`create_business_document`), one reader (`get_public_business_document`), versioned.
  **173 of 174 pages.** Everything built in September targets this store.
- **`businesses.meta`** — the classic renderer's content model (`meta.website`,
  `meta.service_catalog`, `meta.hours`, `meta.portfolioUrls`), read by `get_public_business`,
  **written by many paths**. **This is what the only paying customer serves.**

**"Hubly pages" has meant "freeform pages" all week.** Any claim, count or rate about pages
names its store or it is not a claim — enforced by `rateLine()`, which throws on a page rate
with no `store`. The capability cost of the split is `docs/CLASSIC_VS_FREEFORM_MATRIX.md`.
*(established 2026-09-13)*

**4. Every row in the database is ours.** Not only the pages and the stock photos — the
bookings, the jobs, the customers, the conversations. `graefs-autocare` is the only live
business, and even its **11 `booking_requests` are test bookings we made**; its 2 jobs are the
owner and a relative. **A row count is never usage.** Any claim about usage names its origin or
is not made. *(Adrian, 2026-09-13)*

**3. Manual job entry is a legitimate feature, not a defect.** An owner takes a call and types
the job in. It stays. A job with no `booking_request_id` is that feature working.
*(Adrian, 2026-09-13)*

**5. Jobs and Customers already have design and backend.** Never re-establish whether they are
real features. The open question is only ever which implementation survives.
*(Adrian, 2026-09-13)*

**6. `evergreen-yard-care` is the reference design.** Read it; never re-derive it. Its services
block is transcribed in `docs/BLOCK_SPEC.md`. *(Adrian, 2026-09-13)*

**7. The claimed rail is Home, Website, Settings.** Planner, Jobs and Customers appear only
when earned via `business_places`. *(Adrian, 2026-09-13)*

**8. Every tab is its own conversation.** Home holds everything; a tab holds only what was said
in that tab. *(Adrian, 2026-09-13)*

**9. Booking is a panel on the business's own page, never a separate page.**
*(Adrian, 2026-09-13)*

**10. `hubly-paging-fixture` is a test fixture, not a business.** 250 customers, 250 jobs, 250
booking_requests, owned by evergreen's owner so the existing session can reach it. It exists
because the only live business is smaller than every page limit we ship. **Exclude it from
every corpus count, or say that you did not.** Details and its three first-run findings:
`docs/PAGING_FIXTURE.md`. *(built 2026-09-13)*

**11. THE TAB IS CALLED MY DAY, NEVER PLANNER, in anything user-facing.** The code may still
say `planner` — the rail label, the greeting, the docs and every sentence Hubly speaks say
**My Day**. *(Adrian, 2026-09-13)*

**12. THE PRODUCT CONCEPT, and it settles every future "where does this go" argument:**

> **Home tells you what matters. My Day tells you what you need to do. Chat lets you ask
> anything. Workspace lets you do the work.**

*(Adrian, 2026-09-13)*

**13. THE LAYERING — Home is the entry/context layer; detailed views live in tabs/workspaces.**

A job or lead arrives → it appears on **Home** → the **right side of Home** shows more → a
button there opens the **full tab/workspace**.

**The existence of underlying rows/data does not automatically mean a new navigation tab should
appear.** The tab/capability becomes visible when the owner actually has a reason to use it, or
has entered that workflow. **Do not use the existence of rows, or the `business_places` earning
rule, as the sole reason to paint a tab on the navigation rail.**

Home is where the owner discovers and understands what needs attention; My Day, Jobs, Calendar,
Website and Store are where the owner goes to work in detail. *(Adrian, 2026-09-13)*

**13. `hubly-classic-fixture` is the CLASSIC-store test business.** Its website lives in
`businesses.meta` — `meta.website` plus `meta.service_catalog` with 2 services and 1 addon —
and it has **no `business_documents` row**, the same shape as the only paying customer's.
`hubly-paging-fixture` covers the freeform store; this covers the other one. **Exclude both
from every corpus count**, and **never prove a classic-store change against
`graefs-autocare` — read-only, always.** *(built 2026-09-13)*

## 14. Classic is a SUPPORTED PATH. Every NEW site is freeform — those are different claims

> **SUPERSEDED IN ITS CONCLUSION, 2026-09-16, BY ADRIAN'S RULING. The counts below stand; the word
> "legacy" and everything that followed from it does not.**
>
> **RULED:** *"CLASSIC IS A SUPPORTED PATH, NOT A LEGACY EXCEPTION AWAITING SUNSET."* aquaspeed,
> bucket-mobile-detailing and devdetailing661 stay classic, as does graefs-autocare. **Four market
> businesses serve classic and all four stay.**
>
> **What the counts actually support** is the narrow claim: *nobody NEW is put on classic.* They do
> not support "classic is on its way out", and this entry drew that second conclusion from the first.
> "Work on it is maintenance of a legacy surface, and it should be costed that way" is withdrawn —
> anything new works on **both** paths, is never built freeform-first and retrofitted, and no doc may
> imply a migration. See the rule in CLAUDE.md.
>
> **And the record is corrected:** *"Graef is the only one that will do the old store"* was an
> intention, never a fact (it is flagged as such in `docs/SERVICE_STORES_RESOLVED.md:50`). Four
> market businesses serve classic pages today.

**Settled 2026-09-13, counted from the database, because this question keeps being re-asked
and answered by impression.**

- **174 of 197** businesses have a `business_documents` row with rendered HTML — the freeform
  generator's output. **23 do not**, and those render from `businesses.meta` through the
  classic renderer in `hubly.html` (`#p-classic-site`).
- Of those 23, only **9 serve a real page** — the other 14 have between 0 and 378 bytes of
  `meta.website` and are aborted starts, not websites. **4 of the 9 are `market`**:
  `graefs-autocare`, `bucket-mobile-detailing`, `devdetailing661`, `aquaspeed`.
- **By month created:** July 2026 — 0 freeform, 9 classic. August — 124 freeform, 10 classic.
  September — 50 freeform, 4 classic, and all four of those are two of our own fixtures from
  2026-09-13 plus two empty starts.
- **The newest real classic page anywhere was built 2026-07-25** (internal); the newest
  **market** one, 2026-07-20. **Every business that has actually built a site since late July
  got the freeform generator.**

**So a classic page is not a path anyone is put on; it is where four market businesses already
live, one of whom pays us.** ~~Work on it is maintenance of a legacy surface, and it should be costed
that way~~ — **withdrawn 2026-09-16 (see the banner above): it is a supported path and new work must
serve it.** The `set_business_service_catalog` decision (a pure add rather than a change to a writer
with 31 call sites, D-028) stands on its own merits and did not depend on that conclusion.

**And `hubly-paging-fixture`'s page is thin because its `meta.website` is EMPTY (0 bytes), not
because any generator produced it.** It was seeded as a *paging* fixture — rows for pagination
limits — and never given a website. It is the thinnest possible input to the classic renderer.
Graef's page looks good through the same renderer because his fields are full: 11,809 bytes of
`meta.website`, 8 services, 26 portfolio URLs. **Do not read that fixture as a sample of what
Hubly builds.**

---

**14. THE JOB CREATOR IS NOT "255 ROWS WITH NO WRITER". IT IS NINE REAL JOBS.**
*Measured 2026-09-16; corrects a number that had been repeated for weeks, including by Adrian.*

**250 of the 259 job rows are `hubly-paging-fixture`** — our own paging instrument, created
deliberately on 2026-09-13 at 250 rows per table and documented in `docs/PAGING_FIXTURE.md`.
`account_kind = test`, 250 evenly-spaced create-seconds.

The real corpus of jobs created by anything, ever:

| source | jobs |
|---|---|
| the booking wizard (`graefs-autocare`, **market**) | **2** |
| the model's `business.addJob`, on test businesses | **7** |

**And it DOES have a writer** — `create_business_job`, reached by `business.addJob`. What it does
not have is a **form**. So the doorless-list entry was wrong twice: the writer exists, and the
evidence of heavy silent use was our own fixture.

**A doorless-feature claim that is counting our own test instrument is exactly the rumour Lesson 91
is about.** Anywhere "255" appears against jobs, it is this fixture. Re-measure before quoting it.

---

**15. THE apollo-weeds RENAME BURST WAS NOT KEYSTROKES. A GUESS, CORRECTED BY ROWS.**
*2026-09-16. The hypothesis was Adrian's; the rows disproved it, which is the point of having them.*

The guess was that a rename fires on every keystroke of a name edit. It does not. Three renames,
**three distinct user messages**, each ~5 seconds before its rename:

| he typed | at | slug became | at |
|---|---|---|---|
| "Apollow" | 03:06:59 | `apollow` | 03:07:04 |
| "APOLLOWEEDS" | 03:07:15 | `apolloweeds` | 03:07:20 |
| "change business name to Apollo Weeds" | 03:08:48 | `apollo-weeds` | 03:08:52 |

**He changed his mind three times in under two minutes, which is a person using a product.**

**What the rows found instead is the real defect:** `set_business_slug` REQUIRES `p_confirmed` for a
**claimed** business — the function's own comment says the owner must have "seen and accepted the
cost" — and **skips that gate entirely for a draft, including after we have put the address in
writing.** The promise is what creates the obligation, not the claim. Ruled and built 2026-09-16.

---

**16. HOME RENDERS MY DAY. THIS EXPLICITLY SUPERSEDES THE 2026-09-13 RULING** that put the site
preview in Home. See `docs/design/README.md` for the reversal in full. A superseded ruling that is
only superseded *implicitly* gets restored by a future session reading the older comment.

---

**22. THE TWO SERVICE STORES HOLD 2 REAL CONFLICTS. NOT 83, NOT 23.**
*Measured 2026-09-16, full detail in `docs/SERVICE_STORES_RESOLVED.md`.*

194 businesses · **5** have both stores populated · **2** hold different content:
`adrians-lawn-service` and `graefs-autocare`. The other 81 "disagreements" are an empty store
beside a full one and need no adjudication. **Both earlier figures are retracted: Adrian's
"23 of 41" and my own "83 of 194".** Every doc that repeated them is corrected.

**23. THE DATA IS NOT TRAPPED IN THE PAGE — so the collapse is not blocked on an extraction job.**

37 of 179 stored pages bake prices into their HTML; **35 of those also hold the prices in a store.**
Only 2 do not, and both are unclaimed test drafts (`rell-okonjo-photography`, `wynne-castellan`).
**A page rebuild costs the DESIGN and the owner's edits, not the facts.** It stays forbidden — for
that reason, which is a different reason than the one we had been giving.

**24. CLASSIC IS NOT ONLY GRAEF.** Four **market** businesses have no freeform document and are
served by the classic template: `aquaspeed`, `bucket-mobile-detailing`, `devdetailing661`,
`graefs-autocare`. (Eight more are test/internal.) Retiring classic today would take three market
pages with it. Whether the other three get migrated is **Adrian's open question**.

**25. GRAEF'S 8 SERVICES ARE ALL PRICED, AND ALL PRICED VARIABLE BY VEHICLE SIZE.**
$85 · $130 · $120 · $75 · $150 · $200 · $275 · $400, every one `active` and `website: true`, every
one `pricing.mode = "variable"` with per-vehicle prices.

**THE "GRAEF HAS ONE SERVICE" READING CAME FROM THE WRONG STORE, AND IT HAS BURNED US MORE THAN
ONCE.** His `services` TABLE holds a single stray lowercase row, `clay and seal`. His CATALOG holds
the eight. `getBookingServices()` — the page's and the booking wizard's own reader — prefers the
catalog. **Any reader that prefers the table for Graef is the bug.**

**26. GRAEF'S MEMBERSHIPS ARE REAL LIFE, NOT DATA. HE RUNS THEM AND WANTS TO ADD THEM.**
*Adrian, 2026-09-16.* **There is nothing to model from yet** — do not go looking for rows.
`meta.membership_offers`: 0 businesses. `memberships` table: 0 rows. Corpus-wide there are three
membership-shaped service NAMES, all on test businesses.

**AND THE `memberships` TABLE'S SHAPE IS NOT TO BE TRUSTED.** It has a **single `price` column**,
and every one of Graef's 8 services is priced *variable by vehicle size*. His memberships almost
certainly are too. **Somebody shaped that table with no real example in front of them.** Do not
build on it and do not write rows to it until we have one. See
`docs/MEMBERSHIPS_TABLE_MISMATCH.md`.

**27. 108 OF 194 BUSINESSES HAVE NO SERVICES IN EITHER STORE.**
More than half the corpus never got past the front door. **That is a funnel fact, not a defect** —
and it is probably the most commercially interesting number measured this week.

---

**28. THE BOOKING PATH IS NOT NO-TRACE. Removed from that list.**
`booking_requests` already stores abandoned attempts with contact details — written by
`writeAbandonedBookingRequest()`, `status='abandoned'` — and the leads UI already reads them
(`status==='pending'||status==='abandoned'`).

**The count is still unusable, but for a NEW reason.** 141 abandoned rows exist; **125 are the
paging fixture**, and **13 of the remaining 16 fall inside one 13-minute window on 2026-09-05 across
three different businesses** — a test sweep, not three customers. So the real figure is near-zero
and near-unknowable *because the corpus is ours*, not because nothing is recorded.

**The actual gap is the gate:** the hard path requires name **AND** phone, not reachable
(phone **OR** email).

**29. THE LIST ENGINE ALREADY EXISTS: `hcRoomShell` + `hcRoomRow`.** Adrian was right that there was
one. The list surfaces are contents and a row spec, not a build.

**30. OFFER : MEMBERSHIP :: SERVICE : JOB — established from the column names, not assumed.**
`memberships` carries `customer_id`, `next_due_date` and `source_plan_ref`: the columns of an
INSTANCE pointing at an OFFER. `meta.membership_offers` sits beside `service_catalog.services`,
where a thing-you-sell belongs.

**Therefore TYPE BELONGS ON THE THING YOU SELL**, not on the instance. A job does not need to be
told it is "bookable" — it already happened.

**31. A NEGATIVE ASSERTION NEEDS A SCOPE.**
*Fired three times: `openSmartQuote`, `toggleWsSvcCard`, and inside a check of my own.*

**"This string is gone" over a whole file will always trip on the comment explaining the deletion.**
A negative assertion is anchored to a function body, a block, or a code construct — **never a whole
file, never a bare identifier**. `confirm-served` already refuses bare-identifier absence markers;
`scripts/check-negative-assertions-scoped.mjs` sweeps the checks for the same shape.

---

**32. THREE OF ADRIAN'S PREMISES ABOUT MEMBERSHIPS WERE WRONG. The pattern is the finding.**

1. *"Memberships have no home yet"* → **the offer half was always built and shipping**:
   `ensureMembershipOffers`, `defaultMembershipPlan`, `addMembershipPlan`,
   `renderMembershipEditorList`, `editMembershipFromPreview`, a website section, a profile tab. The
   services `+` was the only surface that could not reach it. **MISSING DOOR, NOT MISSING FEATURE.**
2. *"Graef's memberships are run in real life but not in the data"* → **they are in the data and
   live on his page**: $60/mo and $50/2wk, both with a Join button, both prices his own.
3. *"Write nothing for the membership half"* → **writing nothing was the wrong instruction**, because
   the store exists; the right move was to route to it.

Three for three, all in the same direction: **the capability existed and the door didn't.** When
something in Hubly looks unbuilt, that is now the *second* hypothesis.

**33. QUOTED WAS ALWAYS IN THE DATA MODEL.** `pricingType:'quote'` → `pricing.mode:'quote_required'`
since `buildServiceCatalogFromEditor` was written; `PricingMode` has carried `quote_required` since
the service engine was written. **The editor never offered it** — so an owner whose price depends on
the job had to type a number nobody asked him for. And `if(!vehicleOn) ptype='flat'` silently
converted "ask me" into a flat rate for every non-detailing trade.

**34. A SEEDED DEFAULT HIDES BEHIND ONE NUMBER.** Searching live pages for `$99` would have reported
"no seeded price is live." The seed is **per trade** — 99 detailing, 89 windows, 149 cleaning,
**119 landscaping**, 129 hvac, 99 pressure_washing — and `adrians-lawn-service` publishes exactly
$119. A detector for a per-trade default must read the **table**, not a value; the measurer parses
`membershipDefaultsForTrade` out of `public/hubly.html` at run time.
Measured answer: **zero market businesses publish a price the owner didn't set**, but Graef's
Bi-Weekly plan publishes **all three seeded INCLUDES** — deliverables a customer can hold him to —
under a Join button. See `docs/SEEDED_MEMBERSHIPS_MEASURED.md`.

**35. `confirm-served` COULD REPORT THE WRONG FILE.** `/platform-home.html` is not a route;
`api/router.js` served **hubly.html**, and the bare name `hcDeriveBand` matched a **comment** there.
Three other markers said absent, so it failed loudly — four bare names would have printed
**CONFIRMED for a file never served**, which is the unearned checkmark aimed at a deploy. The
refusal is now **symmetric**: a marker names a code construct in both directions. Routes:
platform-home.html is served at `/`, `/home`, `/platform`, `/platform-home` — **not**
`/platform-home.html`.

**36. THE BOOKING FORM'S TWO LEGAL LINKS WERE BOTH CLAIMS WE CANNOT KEEP** — under a consent
checkbox, which is the worst place in the product for a sentence that is not true.

- *privacy* → *"privacy details are on the website footer"*: Hubly pointing at a control it cannot
  see, at a footer it has not read. **There is no published privacy notice** — the draft is
  `docs/legal/PRIVACY_DRAFT.md` and is explicitly not published.
- *terms* → *"you can reschedule or cancel before your appointment"*: a promise about the
  **business's** policy that the business never made. We have never asked him for it.

Both also fell back to `'this business'`. Each now says only what is true and checkable, and refers
the rest to the business, which is who actually decides it.

**37. `draft_creation_events` KEEPS EVERY IP FOREVER FOR A ONE-HOUR PURPOSE.** The rate limit looks
at the last hour; **no row is ever deleted. 315 rows back to 2026-08-21.** Every row older than an
hour serves no purpose and is still held — and a privacy notice cannot honestly promise a retention
the code does not implement. Fix is small: delete rows older than 24 hours on a schedule. **Not built
this round.**

**38. `hubly_brain_builder_expert.ts` FAILS `deno check` ON MAIN** — 15 errors, starting with
`Cannot find name 'BuilderConfidenceExplanation'`. Confirmed pre-existing by stashing this round's
change and re-running. Recorded so it is not rediscovered as new.

**39. "September 17 at 3:00" WAS NOT A PROMPT PROBLEM.** Adrian's walk, seq 37: *"Driveway is now set
for September 17 at 3:00 — 14 Maple St, $180."* No AM/PM. The model did nothing wrong — it was handed
`2026-09-17 15:00` by `when()` in `hubly_operational_state.ts`, turned the date into prose, and
repeated the time as it found it. **The fix is the single path, not a prompt line:** the model is now
handed `September 17, 2026 at 3:00 PM` and has no 24-hour clock to echo. Same class as
*"on 2026-09-13"*. And the date is parsed BY PARTS — `new Date("2026-09-17")` is UTC midnight and
prints **the day before** in any negative-offset timezone, which would turn a Thursday job into
Wednesday from a change made purely for formatting. `check:human-time` runs under `TZ=America/Denver`
so that trap cannot hide.

**40. A NAME IS CAPITALISED AT DISPLAY, NEVER AT STORAGE.** *"Nice to meet you, austin."* is the first
sentence he ever gets. But rewriting a person's name on the way INTO the record is the same act as
correcting his phone number, and it would destroy "k.d. lang". So the record keeps exactly what he
typed and `hcNameForDisplay` raises first letters only — a title-caser that lowercases the tail turns
**"JT" into "Jt"**, which is worse than the problem it fixes.

**41. `roll_task` HAD NO CALLER.** Written 20260909160000, door opened 2026-09-16. Its own comment
says why it exists — *"NEVER A GROWING PILE OF RED. An undone task is ROLLED, not accumulated as
overdue shame"* — and without a door that is precisely what it became: the only thing an owner could
do with a task he did not get to was tick it or leave it red. **The third roll gets a different
sentence**, because a task that has moved three times is a decision he has not made yet, which is what
the roll count was recorded for.

**42. A HARNESS BUG WORTH KNOWING: `servePublic` served 404 BODIES FOR REAL ROUTES.** It mapped URL
paths straight to filenames, so `/platform-home` — which `api/router.js` answers with
platform-home.html — returned *"not found"*, and the check then reported **"no seam on the page"**.
That is a check failing to find a page and blaming the product. It now knows the router's
extensionless routes (`/`, `/home`, `/platform`, `/platform-home`).

**43. A NEW ROOT-LEVEL SCRIPT UNDER `public/` DID NOT SERVE — AND IT DID NOT 404.**
`api/router.js` served root scripts from a **hand-written list of three**
(`/website-ast.js`, `/landing-intent.js`, `/hubly-session.js`). `public/contact-pick.js` shipped, was
not on the list, and the catch-all answered it with **hubly.html** — 3,064,347 bytes of HTML delivered
where a script was expected.

**The failure mode is the expensive one:** the browser loads a document as a script, the parse fails,
and whatever the script defined is silently `undefined`. `HublyContactPick` was missing in **both**
shells — including `hubly.html`'s own `pickContactInto`, which had just been changed to delegate to it.
**A working feature broken by a file that deployed and did not serve.**

Fixed by deriving: any root-level `.js` that exists under `public/` is served, with a resolved-path
guard confirming it is inside `public/` (the prefixed branches above it never checked). `check:root-scripts`
reads every root script off the DISK and asserts the router would serve each one — so adding a script
makes it green by itself. And platform-home now **logs** when the module is missing, so "the module did
not load" is distinguishable from "this device has no contacts picker".

**44. THE STOREFRONT "BEHIND ?hcEdit=1" FINDING WAS WRONG, and wrong in the flattering direction.**
Measured by opening the page **without** the flag: the Store rail row exists, the tab markup is
present, `openWebsiteEditorHub` never tests `hcEdit`, and `edStoreAiSend` is defined. `?hcEdit=1` gates
the **canvas editing affordance on a generated page**, not the store.

What is true is narrower: `storefront` capabilities live in the `operate` context, so they work in the
**store's own conversation** and not the ordinary one — which the operate prompt states as intent
(*"Only the Store is yours to operate in this conversation"*). **A scoped conversation is not a
missing door.**

**The real gap is in the claimed shell:** `platform-home.html` has no `store` place at all — it is
still a comment. Not built: pointing one shell at the other's workspace is a navigation decision.

Checked alongside: all 7 capabilities (40 actions) in `HUBLY_CAPABILITY_REGISTRY` are named in at
least one context. `CONTEXT_CAPABILITY_ALLOWLIST` is a hand-maintained list with a silent failure —
absent means filtered from the prompt AND blocked at dispatch — but it has **no orphans today**.

**45. `npm test` DID NOT RUN THE CHECKS, AND 59 OF THEM HAD NO COMMAND AT ALL.** 160 `check-*.mjs` on
disk, 105 `check:` entries, no `check:all`, no `verify`, no `.github/workflows`. **`check-no-db-push`
was referenced by nothing** — so CLAUDE.md's *"fails the run if the command reappears"* had no run to
fail. Fixed: `run-all-checks.mjs` globs the directory, `check:all` runs it, and `pretest` runs the ban
guard so the claim is true of the command everybody types.

**Running them all for the first time: 27 of 160 are RED.** That number is the consequence, not a
defect count — `check-hubly-syntax` opens `hubly.html` with a relative path and only works from
`public/`, and several are `[SHAPE]` legs about old milestones. **But `check-rpc-doors` caught this
session's own `set_quote_status` shipping with no caller.** The remaining reds are recorded as work.

**46. NOTHING GROUNDS A GENERATED PAGE. Proven by trying it, 2026-09-17.**
`validateHublyDocument` was handed a shape-perfect page for a real market business containing *"Trusted
by 200 customers"*, *"Rated 4.9 stars from 312 reviews"*, *"Licensed, bonded and insured since 2009"*,
*"$4,999"*, *"guaranteed, or your money back"*, a fabricated address and a fabricated phone. It returned
**`ok: true`, zero errors, zero warnings.**

What it checks is **shape** and **emptiness**. The Content Value Rule rejects a section with no
"concrete content" — *a price, a number, a list…* — and on the first attempt it DID reject the
fabricated hero, **for having no number in it**. Adding *"15 years serving Utah County"*, itself a
fabrication, satisfied the rule and the page passed. **The emptiness rule requires a number; it does not
care whether the number is true.**

Live corpus: **185 pages, 438 detected claims, 73 ungrounded across 21 businesses** — 27 of 27 "years in
business", 20 of 20 availability promises, 13 of 280 phone numbers. **`saltmarsh-bindery`'s page shows
`801-555-9001`, which is `copperwick-kilns`'s number.** All test fixtures; the mechanism is identical on
a market page.

**And "market: 0 ungrounded" must never be quoted as reassurance:** only 6 market businesses have a
generated document and four of those hold under 50 characters. The four market businesses with real
pages are **classic** and have no `business_documents` row at all, so they are invisible to the
measurement. It means "we have almost no market freeform pages", not "the guardrail works".

**47. THE RENDERER ALREADY HAS COMPOSITIONAL PRIMITIVES, NOT SECTIONS.** The closed four-section list
was removed 2026-08-18. `ALLOWED_TAGS` is semantic HTML; layout is real tokens — `grid` + `grid-cols-*`,
`columns-2/3/4` + `break-inside-avoid` (true masonry), `overflow-x-auto` + `snap-*`, `aspect-*`,
`absolute`/`inset-0`. **A "Customer Photo Mosaic" is composable today** as
`section > div.columns-3 > figure > img + figcaption`. Primitives are reachable now, not a later
rewrite — the gap is grounding, not vocabulary.

**48. THE GENERATOR IS JSON-MODE, NOT STRUCTURED OUTPUTS.**
`response_format: { type: "json_object" }`; the shape is enforced afterwards by a hand-written validator
plus one retry that carries the errors back. Moving `document_generate` to `json_schema` + `strict`
would make the shape unrepresentable rather than rejected. Small, safe, **not done**.
