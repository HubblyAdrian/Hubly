# Decisions

One entry per path we chose. Five fields, no padding. **`- [ ]` is outstanding, `- [x]` is
closed and must carry its evidence.** `node scripts/decisions-open.mjs` prints every open line
across every decision; that is what gets read at the start of a session, not this file.

Backfilled from `git log` on 2026-09-13. **A decision taken without a recorded reason is
listed as such** — that absence is itself a finding, not an oversight to be papered over.

---

## D-001 — Freeform generation, over the AST/component renderer
- **Date / commit:** 2026-08-20 · `c2ff42d`
- **Reason given at the time:** *"Every session so far made freeform possible. None made it the default, so a freeform page only ever existed when the AST build FAILED — not a path anyone could choose, just where you landed on a timeout. This flips it."* Measured at the time: *"input tokens down ~5x, build time roughly halved, and the p90 no longer sits 4.6s under a hard timeout."*
- **Gave up:** the commit listed its own bill — no booking, no enquiry form, no reviews, no map, no photographs, no logo in the header, no structural editing, no styling controls, no design rationale — plus *"a freeform page renders in an iframe, so nothing the shell wires to `#hc-doc-root` can reach inside it"*, and the note that the bakery's three priced items never reached the record. **Not measured, then or since: quality, consistency, editability.** `git log` has zero commits comparing the two paths on any of them.
- **Outstanding:**
  - [x] no booking — CLOSED: the runtime stamps `?book=1` and per-card book links; 162 of 172 stored pages carry one; the wizard writes `booking_requests`
  - [x] no enquiry form — CLOSED BY PRESENCE: 161 of 172 pages carry a `<form>`. Whether every one routes into Hubly is NOT verified here
  - [x] no styling controls — CLOSED: design knobs (`setDesignKnob`, `--hubly-type-scale` et al). Stamped on only 37 of 172 stored pages; older pages predate them
  - [x] prices never reaching the record — CLOSED 2026-08-29: extraction is one model pass and calls `setServices` (`registry:1050`); misses are countable
  - [ ] no reviews — OPEN: 29 of 172 pages mention the word, none has a reviews component or any review data
  - [ ] no map — OPEN: 5 of 172 pages carry anything map-like
  - [ ] no structural editing — OPEN, and the live one: the prompt tells the model layout/structure changes *"CANNOT be done as a small edit"* and routes them to a full rebuild
  - [ ] the iframe / `#hc-doc-root` isolation — OPEN: worked around twice (a URL-based booking entry, the fragment-scroll handler) but the isolation itself remains, and it is the root of both defects
  - [ ] photographs — PARTIAL: 139 of 172 pages carry images, but they are stock; the owner's own photos have an upload path whose only affordance is a sparkle glyph
  - [ ] logo in the header — PARTIAL: the prompt supports `#hubly-logo`, and **0 of 172 pages use that marker**. Of the 2 businesses that have both a logo and a page, 1 shows it. Denominator 2
  - [ ] design rationale — PARTIAL: the planner commits to a shape in 3–5 sentences, read from structured output; nothing records it against the page afterwards

## D-002 — The services block clones a section from the page, over inventing one
- **Date / commit:** 2026-09-09 · `a45b4fb`
- **Reason given at the time:** the inserted block should look like the page it lands in rather than a foreign card.
- **Gave up:** the ability to know our own block's structure in advance. Everything downstream had to re-recognise it.
- **Outstanding:**
  - [x] SUPERSEDED 2026-09-13 by D-008 (the fixed Hubly component). Cancellation list: `docs/CANCELLED_BY_THE_FIXED_BLOCK.md`

## D-003 — Typing in the home box continues the draft, over starting a new one
- **Date / commit:** 2026-08-26 · `ff8f9f1`
- **Reason given at the time:** *"the same default that cost Andres four builds"* — losing an unfinished draft is unrecoverable; a second site is one sentence away.
- **Gave up:** the ability to start fresh by the most obvious gesture.
- **Outstanding:**
  - [ ] no measured count of owners who WANTED a new site and got their old one continued

## D-004 — Host profile images, over storing base64
- **Date / commit:** 2026-09-06 · `77ba728`
- **Reason given at the time:** recorded in the subject — host them *"and fail loudly when it can't"*.
- **Gave up:** self-contained documents; a hosted asset can 404 later.
- **Outstanding:**
  - [ ] nothing checks stored pages for dead image URLs

## D-005 — `supabase db push` is banned and enforced
- **Date / commit:** 2026-09-12 · Lesson 42, `scripts/check-no-db-push.mjs`
- **Reason given at the time:** it replays every migration the remote ledger does not know about; on 2026-09-12 it came one statement from relabelling every market business as a test account.
- **Gave up:** a single-command migration path. Every schema change is applied by hand, one file at a time.
- **Outstanding:**
  - [ ] the ledger is still unreconciled — 56 unrecorded of 222 (2026-09-12), which is what makes push dangerous in the first place

## D-006 — TAKEN WITHOUT A RECORDED REASON: `setHours` was owner-only
- **Date / commit:** 2026-09-08, inside a commit about READERS
- **Reason given at the time:** **none.** The guard was added with no stated reason in a commit about something else, and it refused every unclaimed draft for four days.
- **Gave up:** unknown — nobody wrote down what the guard was for.
- **Outstanding:**
  - [x] reverted 2026-09-12 (D-011); `scripts/check-draft-capable-writers.mjs` now fails any caller that refuses a draft its writer would accept

---

# This week's decisions (Adrian's partner, 2026-09-08 → 13)

## D-007 — Booking becomes a panel over the business's own page, over a separate page
- **Date / commit:** 2026-09-13 · ruled in conversation, not yet built
- **Reason given at the time:** *"this is not a booking page, this is a website that needs to be taken out from customer view."* A customer who clicks Book must not leave the site they are reading; closing returns them exactly where they were.
- **Gave up:** the standalone themed landing (`renderThemedBookingLanding`, `#bkland-*`), and with it whatever that page was doing for SEO or shareability as a destination.
- **Outstanding:**
  - [ ] the panel does not exist; the wizard (`submitBooking`, `complete_abandoned_booking`) is the part that survives
  - [ ] `?book=1` must keep working — 507 links across 162 pages, plus emails and QR codes
  - [ ] the panel must offer ALL services, not assume the one whose button was clicked
  - [ ] UNKNOWN: what the second website is currently doing for anyone — nothing has measured traffic to it

## D-008 — The services block is a fixed Hubly component read from evergreen-yard-care, over donor-cloning
- **Date / commit:** 2026-09-13 · `docs/BLOCK_SPEC.md`
- **Reason given at the time:** *"evergreen slug has how the services should look like… we went off on a beaten path and didn't have to."* The design already exists; we render it rather than infer it.
- **Gave up:** visual continuity with whatever section happens to be on the page — our block will no longer imitate the model's cards. And the donor machinery (census, chain clone, inset and box-match measurements) is cancelled.
- **Outstanding:**
  - [ ] not built; the spec is transcription only
  - [ ] the reference's own card 1 renders its image at the BOTTOM (image after `.card-body` under `flex-direction:column`) — spec says image-first, unruled
  - [ ] `describesASequence()` must NOT be deleted with the rest of the donor work: Lesson 48 has `hasHoursHeading` consuming it
  - [ ] UNKNOWN: how a fixed card reads on the ~20 pages with a dark or photographic ground. The contrast rescue covers legibility, not taste

## D-009 — In-page self-links become relative, over absolute
- **Date / commit:** 2026-09-12 · `8e02e30`, repair `scripts/repair-fragment-links.mjs`
- **Reason given at the time:** a `srcdoc` iframe has no URL of its own, so its base is the parent's; `/?book=1` is then correct forever and `href="#x"` never scrolls.
- **Gave up:** nothing intended — but the repair's byte-exact inverse proof refuses pages the injector whitespace-normalises.
- **Outstanding:**
  - [ ] 18 pages refused, all whitespace-only, including `crestview-window-cleaning` — the walk gate's own default page still has dead nav links
  - [ ] the fix belongs in the injector (make it whitespace-neutral), not in loosening the proof

## D-010 — Hours are writable on an unclaimed draft
- **Date / commit:** 2026-09-12 · migration `20260912210000`, commit `050f29c`
- **Reason given at the time:** most businesses are an unclaimed draft when they first say "we open at 8"; the writer authorises a draft by token and the caller was refusing before it could.
- **Gave up:** the simplicity of one authorisation rule per writer — `set_business_hours` now carries two.
- **Outstanding:**
  - [ ] the write works and the page still shows nothing: placement dies four ways (`docs/OPEN_FINDINGS.md`), 135 of 172 pages in a branch with no code in it
  - [ ] two writers still act on hours in one turn, and the reply is composed from only one of them

## D-011 — The rail reads the earning set, over a fixed list
- **Date / commit:** 2026-09-13 · re-affirmed in conversation; the earning rule itself pre-dates this record (prohibition 5)
- **Reason given at the time:** prohibition 5 — a place appears only once the business has earned it, on every device, positions stable.
- **Gave up:** the ability to show an owner what Hubly could do for them before they have done it.
- **Outstanding:**
  - [ ] new owners should see Home, Website, **Settings** — Settings is today an unlabelled gear opening a modal
  - [ ] Jobs/Customers not switching the pane is UNVERIFIED: unreachable on evergreen because unearned; needs a session on a business that has earned them
  - [ ] `#jobs` in the URL survives the fallback to Home — the address claims a room the app is not in

## D-012 — Photos are movable before AND after claiming
- **Date / commit:** 2026-09-13 · ruled in conversation, not yet built
- **Reason given at the time:** *"that is the moment they are deciding whether to trust us and it needs to work then."*
- **Gave up:** the simplification of gating all editing behind claim.
- **Outstanding:**
  - [ ] no drag-to-place affordance found pre-claim; unverified post-claim
  - [ ] the attach control is a sparkle glyph labelled "Attach a photo or file" — the path exists and is not discoverable
  - [ ] UNKNOWN: where a photo goes on a freeform page with no slot — the current answer is the honest-but-useless *"There's no open spot for it on the page as it's built"*

## D-013 — The nine-step flow is an internal checklist, never shown as one
- **Date / commit:** 2026-09-13 · ruled in conversation, not yet built
- **Reason given at the time:** *"our ai should be smart and know okay they haven't done this they still need to. we can have an internal checklist but they don't need to feel like it's a checklist."*
- **Gave up:** the legibility of a visible progress indicator — the owner cannot see what remains.
- **Outstanding:**
  - [ ] nothing durable records per-business completion state; today it is `hc.*` flags that die with the tab
  - [ ] walked 2026-09-13: step 2 (claim-or-services) absent, step 5 (ask hours) absent, step 7 (ask photos) absent, step 8 (move photos) not found
  - [ ] the claim questions — the person's name and logo, asked once — were designed and never built; the greeting still reads "Good evening. / Evergreen Yard Care"

## D-014 — Every corpus rate prints its account_kind split, in the same line
- **Date / commit:** 2026-09-13 · `scripts/lib/kind-split.mjs`, `scripts/check-denominator-rule.mjs`
- **Reason given at the time:** *"Then neither of us can quote a behavioural rate off a synthetic corpus, because the denominator is standing right there."* CLAUDE.md had ruled this since August; it kept not happening because the denominator lived in the record and the rate lived in the output.
- **Gave up:** the ability to print a quick rate. `rateLine()` needs the denominator's ITEMS, not a count, so a caller must keep the population around.
- **Outstanding:**
  - [ ] the rule is enforced in `scripts/` only — nothing stops a bare rate in a commit message, a doc, or a chat reply, which is where the 2026-09-13 photo rate was actually quoted
  - [ ] 7 statements are declared exempt; each carries a reason, none has been argued with

## D-015 — One command prints the brief, over four files nobody opens
- **Date / commit:** 2026-09-13 · `scripts/brief.mjs`, `npm run brief`
- **Reason given at the time:** the facts we keep relearning were already written down — the db push ban lived in prose while a deploy script ran it, the 2026-08-20 gap list died in a commit message. *"A document nobody opens is what caused this."*
- **Gave up:** nothing yet — but a brief is a summary, and a summary can go stale against the files it summarises.
- **Outstanding:**
  - [ ] the walk line is a RECORDED result, not a live one, unless `--walk <slug>` is passed — it is labelled as a memory, which is the honest form, not a fix
  - [ ] the instrument count is a proxy: it greps for the WORD "red-proof", not for a proof
  - [ ] nothing makes the brief run — it is a command, not a hook

## D-016 — Home shows the site again at claim, REVERSING a stated design
- **Date / commit:** 2026-09-13 · `98dbb69` (reverses the rule written at `platform-home.html:290`)
- **Reason given at the time:** the ORIGINAL choice was deliberate and argued, in its own comment: *"HOME (default): the conversation IS the screen — a comfortable centred column, the way an owner arrives and returns. The site is not shown here; you are talking to Hubly."* It was the claimed-shell author's call, made when the mode switch was introduced. **Adrian overruled it** on the strength of what it does to a real owner: the preview they have been watching build disappears at the exact moment the site becomes theirs, and the first screen of ownership is a full-width chat with no product in it. *"The website goes back on the right side, as it is before claiming."*
- **Gave up:** the calm, centred, single-column Home the original design was aiming at. The thread is now a 380px sidebar on a claimed account with a page, so the greeting, the suggestion chips and every Home card live in a narrow column instead of a comfortable 720px measure. That is a real cost and it was the whole point of the rule being reversed.
- **Outstanding:**
  - [x] RETRACTED 2026-09-13: "a returning owner may not see this today" was MY verification error, not a cache defect — same-document navigation, not staleness (Lesson 51). Headers are max-age=0/must-revalidate, revalidation 304s, no service worker, and a fresh tab shows the fix.
  - [ ] Home's cards and chips were laid out for a 720px centred column and have NOT been re-checked at 380px
  - [ ] the original argument — "you are talking to Hubly, not looking at a site" — is untested either way; nobody has measured what an owner does on arrival
  - [ ] a claimed account with NO page still gets the centred column (bound to `.hc-has-draft`); that branch is unverified in a browser

## D-017 — The two booking exits stay two functions, for now
- **Date / commit:** 2026-09-13 · `98dbb69`
- **Reason given at the time:** `bookingBack()` and `closePublicBooking()` have now been the same three-line mistake TWICE — once on the classic-storefront fall-through, once on the `?book=1` deep-link case. Both were fixed together this time rather than one being reported and the other left live.
- **Gave up:** nothing yet — the duplication is intact, which is the point of the entry. Two exits from one screen is two writers of one fact in a new costume.
- **Outstanding:**
  - [ ] decide and do at the next boundary: ONE function with a parameter, or a check asserting both exits leave by the same route. Smaller is the check — the two have different callers, different in-app branches (owner preview, slide-over) and different post-conditions, so merging them is a refactor of live booking code, while the check is ~40 lines and self-red-proofs by reverting either exit

## D-018 — The 18 unclassified operator destinations are deferred, not settled
- **Date / commit:** 2026-09-13 · `docs/NAV_AUDIT.md`, `12ca812`
- **Reason given at the time:** they need a signed-in walk through a shell that the intended path no longer routes to. The claimed rail is Home, Website, Settings — Planner, Jobs and Customers appear only when earned via `business_places` — so the 18 sit inside a shell no owner reaches on the intended path.
- **Gave up:** knowing what they are.
- **Outstanding:**
  - [ ] 18 operator destinations remain unclassified; a view rendering from client state is statically indistinguishable from one rendering from a constant, and classifying them requires a signed-in walk. Deferred because the claimed rail does not route to them. **Cost: if any is later promoted to the rail, it ships unverified.**

## D-019 — Leaving the retired shell is gated on WHO arrives, not on which view was restored
- **Date / commit:** 2026-09-13 · `public/hubly.html` `openOperateHome()`
- **Reason given at the time:** the previous condition (`_target === 'dashboard'`, added 2026-09-08) asked which view was restored. `readPersistedOwnerAppView()` restores whatever the owner last opened, so the redirect fired for owners who had never been anywhere and never for the ones who had — one visit to jobs or leads pinned an owner inside the retired 25-item shell permanently, because the stale value restored itself on every arrival.
- **NARROWS A DELIBERATE CHOICE, and the cost is real.** The 2026-09-08 comment argued the opposite on purpose: *"Deliberately NOT a blanket /app redirect — jobs, calendar, leads, customers, chats and the rest are working surfaces the front door does not have yet, and removing them would cost more than the fabrications did."* That argument still holds on its facts. Every operator surface other than the three earned rail places becomes unreachable by this route.
- **Outstanding:**
  - [x] CORRECTED 2026-09-13: the claimed rail shows recent leads via the activity feed, **capped at 100 events**. It has **no leads list**. An owner past 100 events cannot reach older unanswered bookings by any route. A feed shows what just happened; a list is something you work through until it is empty — leads are a list. The retirement still stands: the operator Leads screen reads the same client state, not a deeper source
  - [ ] leads, calendar, chats, money, reports, reviews, memberships, pipeline and photo-projects are now unreachable for an owner by this route, and the claimed rail has no equivalent for any of them
  - [ ] NOT REPRODUCED IN A BROWSER: setting a persisted view requires running script in the page, which is blocked here. The defect is established from the code and the fix is proved by `scripts/check-retired-shell-exit.mjs` (both halves red independently), not by a live walk
  - [ ] the redirect fires for any signed-in visitor on this path, including the owner-preview and editor entries — those already redirected under the old condition, so nothing new breaks, but it has not been walked

## D-020 — Money, Reports and Pipeline own no data. The retired shell is a view layer.
- **Date / commit:** 2026-09-13 · `docs/RAIL_COVERAGE.md`
- **Reason given at the time:** established by reading the renderers, not by inference. `renderRevenue` and `renderReportsPageInner` reach no table; **`DS()` is `HublyDS` — the DESIGN SYSTEM (`public/journey-os/design-system.js`), not a data source** — and `ensurePipelineOsState()` initialises `st.pipeline = {manual:[], stages:{}, edits:{}}`, local edits with no table behind them. `journey.js`, which renders all 25 operator destinations, touches only `jobs` and `recurring_schedules`; the other 20 tables are read by `hubly.html` into client state.
- **Gave up:** nothing. This is the finding that makes the merge direction safe — there is no operator data path to preserve, so moving UI onto the claimed shell's readers cannot lose a reader.
- **Outstanding:**
  - [x] AMENDED 2026-09-13, my own correction: **"the retired shell is a view layer" is TOO BROAD.** `store` and `marketplace` sit inside that shell and are backed by **25 tables and five edge functions** (`commerce-api`, `commerce-merchandising`, `create-store-checkout`, `stripe-webhook`, `marketplace`). The claim holds for Money, Reports and Pipeline specifically — not for the shell
  - [ ] measured on a denominator of ONE live business whose cells are mostly zero. **Revisit when a live business has non-zero rows in `review_submissions`, `memberships`, any pipeline-owning table, or any money-owning table**
  - [ ] `photography_project_invoices` DOES exist and is vertical-specific; it was not audited

## D-021 — The two Home count queries were deleted, not repaired
- **Date / commit:** 2026-09-13 · `platform-home.html` `hcLoadHomeCounts`
- **Reason given at the time:** both were second readers of facts `get_business_events` already owns, arriving in the claimed shell before the merge that exists to remove second readers. *"Fixing them in place would make the claimed shell a working second reader, which is worse than a broken one."*
- **Gave up:** a pending-booking count on Home. If Home needs one it derives from `hcEvents.list`, already in memory and already filtered by kind at `:5383` — no new query.
- **Outstanding:**
  - [ ] Home shows no count of the 2 people waiting on Graef; the event feed shows the bookings themselves but nothing says "2 are waiting"
  - [ ] deleted in the repo, NOT yet deployed — `public/` ships only by git push

## D-022 — The Google Calendar merge into Jobs is cut, and not because the data is thin
- **Date / commit:** 2026-09-13 · `docs/MERGE_COSTING.md`
- **Reason given at the time:** NOT "Graef has zero calendar events" — that is a
  denominator-of-one argument and it would be the wrong reason. **The reason is that carrying
  it requires a fifth union in `business_events`, a view we have just proved reconciles
  row-for-row with its sources** (11 booking_requests → 11 events, plus one job via the
  `booking_request_id IS NULL` guard). Adding a source to a reconciling view is how that
  property is lost silently: nothing fails, the counts simply stop matching, and the next
  person to check finds a feed that no longer maps onto rows.
- **Gave up:** calendar events in the merged Jobs list. An owner who connects Google Calendar
  sees their jobs and their bookings, not their calendar.
- **Outstanding:**
  - [ ] build it when a business actually connects a calendar — and when it is built, the
        reconciliation must be re-run and recorded, because that is the property being risked
  - [ ] `google_calendar_events` stays readable only from `hubly.html`, which is a second
        reader by the merge's own rule

## D-023 — "Active in range" is not built, and the drop-and-recreate is not taken
- **Date / commit:** 2026-09-13 · ruled in conversation
- **Reason given at the time:** three, in order. (1) **Nobody asked for it** — it is not in Adrian's spec and no owner has requested it. (2) Buying it costs a **drop-and-recreate on a security-definer function** — the most dangerous migration shape available — against a database with **56 unrecorded migrations of 222** and a banned `db push`. We do not take that risk for a nice-to-have. (3) Its value today would be computed over **4 test rows**.
- **Gave up:** a date-range customer KPI. The merge ships with zero migrations.
- **Outstanding:**
  - [ ] revisit when a live business has enough customers for a date-range filter to mean anything, and **bundle the drop-and-recreate with another change that already requires one**

## D-024 — No aggregate is rendered from a paginated result, at any size
- **Date / commit:** 2026-09-13 · `docs/MERGE_COSTING.md`
- **Reason given at the time:** `get_business_customers` has `p_limit integer DEFAULT 8`. A total summed from its rows is a total over A PAGE. Graef has 4 customers so it reads correctly for him and would be **silently wrong for anyone real** — no error, just a wrong number. Passing a bigger limit from the client was rejected explicitly: *"that is a guess that becomes wrong at a size we cannot predict, and it fails the same way."*
- **Gave up:** total billed and total visits on the Customers screen. Counts come from `get_business_customer_count`, which counts server-side; anything else is left out.
- **Outstanding:**
  - [ ] total billed / total visits are unbuilt. When they are wanted, they come from an RPC that AGGREGATES server-side — never from a client sum
  - [ ] the client already passes `p_limit: 200` at `platform-home.html:4814`; that is a list read, and it must not become the basis of any total

## D-025 — Every decision that cited the inbound column, re-checked against the verified count
- **Date / commit:** 2026-09-13 · `docs/NAV_AUDIT.md`
- **Reason given at the time:** the inbound-link column was produced by a regex assuming one call shape. Three rulings cited it. Each is re-checked here rather than assumed to survive.
- **Gave up:** nothing — this is an audit of prior rulings.
- **Outstanding:**
  - [x] **Customers retirement (ruled safe at "0 inbound")** — the real count was **2**. **The ruling SURVIVES but the execution changed**: both call sites were repointed at the merged room in the same commit rather than left to fall through to `goDash()`. Had it shipped on the original number, booking-for-a-customer would have landed on the front door.
  - [x] **Jobs repoint (3 inbound)** — **unchanged. The original number was right**, by luck rather than method: `.ni[data-v="jobs"]` happens to be the shape all three use.
  - [x] **`projects` "already broken, two inbound links"** — **VOID.** Zero inbound. The two hits were one fallback selector, `.ni[data-v="photo-projects"],.ni[data-v="projects"]`, at `:18890` and `:32568`, both resolving via `photo-projects`. Nothing reaches `projects`, nothing is broken, and the ruling has no subject.
  - [ ] no DECISIONS entry quoted an inbound figure directly — the numbers lived in `NAV_AUDIT.md` and `TWO_IMPLEMENTATIONS.md`, which is why the corrections land there

## D-026 — A storefront page is a freeform website, not a separate AST
- **Date / commit:** 2026-09-13 · ruled by Adrian (`docs/SETTLED.md` #1)
- **Reason given at the time:** *"A storefront IS a website. Same model call, same freeform generation. No separate generator, no separate product architecture."* The difference between a service business and a storefront is **the button and what is behind it**: a service block's action is Book and opens the booking panel; a product block's action is Buy and opens checkout.
- **THE EVIDENCE THAT MAKES IT SAFE, and it is the whole justification:** `commerce_documents` — the separate storefront-AST store that `KNOWN_ISSUES.md:2323` documents — has **0 rows**. It was built and never used. **A direction that contradicts a documented design is safe exactly when nothing depends on that design**, and nothing does.
- **Gave up:** the storefront AST path (`commerce_documents`, `HublyStorefrontAst`, the block catalogue). Not deleted — superseded, and it keeps whatever value it has as prior art for the block catalogue.
- **Outstanding:**
  - [ ] `KNOWN_ISSUES.md:2323` now points here; the two documents no longer disagree
  - [ ] the storefront-AST code paths still exist and are unreferenced by the new direction; nothing has been deleted
  - [ ] **no code in the flow work may branch on "is this a storefront"** — the block carries an action, and path 2 is a new action value

## D-027 — `#p-storefront` renamed to `#p-classic-site`
- **Date / commit:** 2026-09-13 · `public/hubly.html`
- **Reason given at the time:** it is the CLASSIC RENDERER — the template page a business with no stored document falls back to, and **the impostor site the booking-Back defect landed customers on**. It has nothing to do with selling. With storefront now meaning commerce, one identifier named two unrelated things, and it was the most confusing identifier in the repo.
- **Gave up:** nothing. 59 lines changed in one file, id-only.
- **Outstanding:**
  - [ ] **the collision is only half killed.** ~40 OTHER identifiers still say Storefront while meaning the classic website: `saveStorefront`, `publishStorefront`, `revertStorefrontDraft`, `storefrontAst`, `HublyStorefrontAst`, `renderEdStorefrontPreview`, `isStorefrontOnlyBusiness`, `syncStorefront` and more. Renaming functions is a larger, riskier change that was not ruled; the element was

## D-028 — The classic store gets a writer of its own, not a parameter on an existing one

- **Ruled:** 2026-09-13, by Adrian. The pure add: `set_business_service_catalog`, the same shape
  as `set_business_hours`, with its owner/draft-token predicate copied verbatim (quoted in the
  migration so a reader can compare without opening the other file).
- **Rejected:** adding `p_service_catalog` to `patch_business_in_progress` — a drop-and-recreate
  of a security-definer function with 31 call sites, against a ledger holding 56 migrations the
  remote does not know about, taken to avoid writing one new function.
- **Applied:** `supabase db query --linked -f supabase/migrations/20260913220000_…sql`. Never
  `db push`. Verified pure: `pg_proc` shows exactly one new signature and both
  `set_business_hours(uuid,uuid,jsonb,uuid)` and
  `patch_business_in_progress(uuid,uuid,jsonb,jsonb,uuid)` unchanged.

## D-029 — The ruled pipeline was destructive; the merge is additive by construction

- **Ruled:** `getCatalog → catalogFromOwnerServicesPayload → buildCatalogWritePayload`.
- **Measured, before writing anything:** feeding a canonical catalogue's own services back
  through `catalogFromOwnerServicesPayload` returns `price_cents 12000 → null`,
  `mode variable → quote_required`, `variable_prices 6 → 0`. `migrateLegacyService` reads
  `raw.price` / `raw.varPrices` — the owner-EDITOR shape — while a stored canonical service keeps
  those under `pricing`. And a payload of one service returns a catalogue of one, with the
  positional id `svc-0`. **Run as ruled against Graef, tonight's fix would have blanked all eight
  of his prices and dropped seven of his services.**
- **Decided:** `catalogFromOwnerServicesPayload` is used for exactly what is safe — shaping ONE
  NEW entry, with an explicit id — and never to re-derive a service that already exists.
  `mergeClassicCatalog` carries untouched services through as the SAME objects, so
  "byte-identical" is a property of the code rather than a result checked afterwards, and it is
  exported so the proof runs the real merge instead of a copy of it.
- **Proved** on `hubly-classic-fixture`: `diff PRE POST` adds one service block and removes one
  line — the catalogue's own `updated_at`.

## D-030 — The sentence ships in the same commit as the capability, with a check that ties them

- **Ruled:** "or tonight's fix becomes tomorrow's lie." `composeServicesTruth`'s classic branch
  said *"I can't add them to it from here yet"* — true for about four hours.
- **Built:** `scripts/check-classic-claim.mjs` (`npm run check:classic-claim`), three legs, each
  red-proofed independently: **wired** (every call site passes the classic outcome), **reachable**
  (no caller may gate on `status !== "not_freeform"`), **truthful** (the composer is executed and
  its written-classic sentence must contain no negation marker), plus **3b** (an empty list must
  return `""`).
- **Leg 2 caught a live defect in my own fix from four hours earlier:** `hubly-conversation`
  gated the composer on `placement.status !== "not_freeform"`, so the classic branch deployed at
  22:18 was **dead code and never once executed.** A gate written when only one store existed kept
  the other store's owners in silence.
