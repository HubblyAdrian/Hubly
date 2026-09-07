# STATE — where the build is (2026-09-04)

The current picture, no history. Pairs with `CLAUDE.md` (the rules), `PRODUCT_SHAPE.md`
(decisions), `OPEN_FINDINGS.md` and `SHELL_TERRAIN.md`. **This file is the durable
record; if it disagrees with memory, this wins.**

`evergreen-yard-care` (`c969eb51-684d-4ba8-a58e-2625c90fceea`, `account_kind=test`,
claimed, owner `adriansmithee+evergreen@gmail.com`) is the claimed-owner test business.
It is the only claimed business reachable from here, so it is where everything is proven.

---

## START HERE — orientation for a session with no context

**What Hubly is right now:** a person talks to it, it generates a real website at
`{slug}.myhubly.app`, they claim it with an email code, then they keep editing — by
talking, and by working directly on the page. The claimed shell is
`public/platform-home.html` (**Home** = the conversation; **Website** = the live site as
canvas with chat beside it). The generated page is a single freeform HTML document with
**no async update path**, which is why almost every hard problem here is "how does a
later change find the thing it needs to touch", and why the answer is always **stamp an
anchor at generation, never re-recognise the layout afterward**.

**TWO DEPLOY PATHS, AND THEY ARE SEPARATE.** Edge functions go live via
`supabase functions deploy <fn>`; everything in `public/` goes live ONLY via a git push
to Vercel. Never call a client change live until it is pushed, and say which path each
change took when reporting.

**The database is reachable.** `supabase db query --linked` works from this environment
(use `-f file.sql` for anything containing quotes or comments). **Measure instead of
speculating.** `supabase db push` is NOT safe here — it replays old migrations and one of
them fails; apply a single new function with `supabase db query --linked -f <migration>`.

**The canvas is two frames deep.** builder (`myhubly.app`) → cross-origin iframe
(`{slug}.myhubly.app`, `hubly.html`) → same-origin **srcdoc** iframe holding the generated
page. The editing surface is wired onto that innermost document. Consequences that bite:
the builder cannot read the canvas (different origin — it must be *told*), and in THIS
harness synthetic wheel/hover/keys do not reach two frames down, though clicks and drags
do. One frame down — open `{slug}.myhubly.app/?hcEdit=1&hcEditable=1` and post
`{type:'hcAuthState',authed:true}` — everything is drivable. That is the honest place to
verify interaction work.

---

## What is LIVE as of 2026-09-04

### The assistant can see the business — 2026-09-05 (`hubly-conversation` v236)
The read-only half of #27 ships. On any turn where a **verified owner of that business** is
talking, the system prompt carries live operational state — bookings, upcoming jobs, leads —
read fresh from their own records, plus an `operations.read` capability for detail on demand.
- **A registry of SLICES, not a booking special case** (`_shared/hubly_operational_state.ts`).
  A new slice is one reader and one line; the capability's enum derives from the same
  registry so the two cannot drift.
- **A block, not a tool call** — a capability round costs a round and several seconds of
  silence; a block is simply present. The owner never has to ask if he has bookings.
- **Read-only on purpose.** No accepting, declining, rescheduling or messaging.
- **Gated on `resolveOwnerUid()` + `biz.owner_id === ownerUid`, never on `context`.** Proved
  live: an anonymous caller asking about Graef's bookings gets nothing.
- **Works on classic and freeform**, no client change — it depends on `draftBusiness.id` and
  a verified owner, neither renderer-specific.
- **Never invent**: "none on record" for empty, "could not be read" for a failed query.
- Cost ~423 tokens on the busiest real business, ~49 on a quiet one; four reads run in
  parallel; an anonymous visitor pays nothing.
**NOT yet proved:** an owner signing in and reading the sentence. That leg is Adrian's.

### The classic renderer (`#p-storefront`) — 2026-09-04
Ten of the 34 claimed pages render here, including `graefs-autocare`, our one real
detailer. Four fixes shipped after he reported four visible defects (see `OPEN_FINDINGS`
#23 for why they were four causes and not one):
- **Section headings an owner clicks and types now reach the public page.** `sectionCopy`
  (written by click-to-edit) is read before the flat `w.<sec>Title`/`<sec>Sub` fields, and
  **only when non-blank** — a cleared value falls through to the default rather than
  blanking the section. Same for `footerTagline`. Before this, that editor had **never**
  worked for anyone: it painted instantly and vanished on reload.
- **`whyChooseUs` is read in both shapes** (`{label}` from generate-site, `{icon,title,desc}`
  from the editor), and the generator's array is now MAPPED at the boundary instead of
  assigned across. No business's stored data was rewritten.
- **One empty-item pass** (`wsPruneEmptyCards`) at the tail of `renderWebsite`, plus the
  three side doors that repaint without it. Conservative on purpose: no readable text AND
  no `<img>` AND no `<svg>` AND no background-image, and never in the editor view.
- **The Instagram glyph is `currentColor` where the chip paints Instagram's gradient** —
  it was drawn in the same gradient as its own background.
Protected by `scripts/check-graefs-page.mjs` (one command, PASS or names what changed).

### The editor
- **Drag-to-reorder — one operation at two grains.** Elements and sections are the same
  move; only the grain differs. **The grip lives ON the block** (its left edge), not in
  the toolbar. A drop line shows where it will land, the move is painted optimistically,
  and it saves as one versioned, undoable document. **Arrows (↑ ↓) remain** as the
  keyboard and touch fallback, on the same operation — there is no second system.
- **Addressing covers unlabelled wrappers.** A node is named by its nearest stamped
  ancestor-or-self plus element-child indices, with a fingerprint (tag, child count,
  class, first stamped descendant) that the server re-checks before moving anything. That
  reaches a band, a labelled leaf, AND a whole service card — which carries no stamp of
  its own. `@root` covers nodes with no stamped ancestor.
- **The breadcrumb climbs ONE level** and names it ("Card", "Block", the section name), so
  every wrapper between a leaf and its band is selectable. A wrapper is its own KIND —
  move, background, delete; never a caret.
- **Delete element**, **font as a named dropdown** (system stacks only), **size as a
  number field** (clamped 8–96px, with the scale steps kept beside it), **page
  background** (offered only inside the page's own lightness band), and a **real colour
  picker** — 40 chips: 10 read off the page itself plus 10 hues with a light, base and
  dark of each.
- **No frame re-render on a successful save.** The canvas paints the change and the save
  follows; the frame is re-read only when the server DISAGREES, or when a section move
  reordered the nav server-side (the one thing an optimistic paint cannot know).
- **No chat receipts for direct edits.** Direct manipulation does not produce
  conversation — the page moving is the feedback, and a genuine failure is said ON the
  toolbar ("Didn't save"), never in the thread.
- **Undo walks back.** `restore_business_document_version(business, version)` takes an
  explicit version, so the client holds a cursor and steps back one real change per press
  (the old RPC always restored the second-latest, which made a second press a redo). It
  **refuses any step that would publish a document identical to the live one** rather than
  writing a version and reporting success over a page that does not move. The Undo control
  lives in the canvas bar and stays while there is an earlier version to reach.
- **`+ Add service`** tile at the end of the services grid — name, price, description,
  typed into the page. Writes through the proven `directRecordEdit → applyOwnerRecordEdit`
  route, so it lands in the RECORD and on the PAGE in one undoable version. There is
  deliberately no page-only shortcut: a card a customer can read and cannot book is the
  Hedge Trimming scar (`OPEN_FINDINGS` #17).
- **Select-and-replace works** — double-click a word, triple-click a line, type over it.
- **Direct edits are queued, not dropped.** A second edit made while the first save was in
  flight used to vanish silently; they are serialised now, and a failure takes the queue
  behind it down in one honest sentence.
- **Chrome is not a section** — header/footer are never offered move controls, and the
  writer refuses them.
- **In the editor, a link is not a link** — no anchor navigates the builder away,
  including the inserted `data-hubly-runtime="card-book"` CTAs.
- **The editor keeps your place** — the mode is in the URL (`#website`), so reload and
  browser Back return to the Website editor, and the canvas is restored to the scroll
  position the owner was at.
- **Selected element → chat context — the chip.** *(2026-09-04, shipped both paths.)* Click
  something on the page and a chip appears above the composer naming it in the owner's
  words — "Hero heading", "Basic Mow card", never `hero.headline`. The name is read off the
  page's own STAMPS, never its layout: a band is named by the **shorter** of its
  heading/subheading (a name is short; the model writes the sentence as the heading about
  as often as the eyebrow), a card by the `.title` label of the item its label sits inside.
  With a chip attached the instruction is scoped to that element — **how it LOOKS** →
  `website.restyleElement` (new: size, weight, font, italics, alignment, spacing, corners;
  every field an enum validated twice), **how it READS** → `website.patchDocument`, narrowed
  to the selection's own labels. **A target changes the SCOPE, not the grounding rule** —
  `restyleElement` cannot write text at all, so "add a testimonial here" is still a question
  about who said it. **Nothing the canvas sends is trusted**: the label is looked up in the
  STORED page, the node address re-resolved, the fingerprint re-checked as a drag's is; if
  the page moved underneath the selection is refused and the model is told to say so. The
  model never sees the label (injected like `draftId`) and must say the element's NAME back
  as a checksum before anything is written. An unlabelled wrapper — which is what a service
  card is — is styled by node address. The × on the chip clears the selection on the page
  too; a labelled selection survives a canvas reload (it rides the auth handshake, like the
  scroll position). **NO COLOUR**, the same withholding `setDesignKnob` makes and for the
  same reason — a hex the model picks is a contrast decision against a page it cannot see.

### The page and the pipeline
- **The lazy page upgrade.** The first time an owner opens the Website editor on a page
  without section stamps, the page is re-stamped in place as one undoable version while
  the canvas is held un-mounted (the owner sees only the ordinary "Loading your site…").
  **This fixed a reach of 1 stored page in 138** — before it, only evergreen carried
  section stamps, so section reorder had shipped for one test business. The endpoint reads
  the business row and passes the real name/slug/accent, and **refuses the upgrade if the
  slug is missing** rather than publishing `https://.myhubly.app/?book=1` across the page.
  Bounded at 7s; on failure the page is untouched (the transform runs in memory and the
  save is one atomic insert, so "half-stamped" is not a state that exists).
- **Book Now goes straight to booking** — `bookingOnly` resolves the business and opens
  the wizard without building the site first.
- **Contextual toolbar** — click an element, get only the controls that apply, with a
  breadcrumb to its container. Touch-first: swipeable strip, ≥44px targets, nothing
  revealed by hover.
- **Section containers stamped at generation** (`data-hc-section`), from the bands
  `expandBands()` already computed.
- **The re-stamp path** (`restampFreeformPage`) — strip runtime → sanitise + label →
  re-inject → knobs. Lazy and per-page, never a sweep.
- **Grid-aware booking buttons**, **price typography**, **Back from booking returns to
  the owner's site**.
- Earlier and still live: the Edit-details panel, owner-authorised fact writes, grounding,
  the design knobs (panel + `website.setDesignKnob` in chat).

---

## NOT VERIFIED — say so plainly; do not report these as done

- **Touch.** The drag uses Pointer Events, so touch runs the same code path, but there is
  **no real device here** and no true 390px viewport. **Adrian's phone is the test.** The
  arrows stay as the touch fallback until he has run it.
- **Hover-then-grab in the builder.** The grip's hide timer was removed in favour of
  "persist until the pointer enters a different movable block". That change **could not be
  driven through two nested frames** in this harness; hover was verified one frame deep
  with a real mouse. **Adrian is testing it now.** If it still fails in the builder
  specifically, that is a different cause — get his report rather than assert it works.
- **The chip, as a signed-in owner in the running product.** *(2026-09-04.)* Everything
  below was verified, but none of it in a real session, because Claude Code cannot sign in
  as the owner. What WAS verified, over evergreen's real stored page (v162), with the real
  editor function sliced out of `hubly.html` and the real writers: **54 of 54 labelled
  leaves produce a chip**; every breadcrumb level yields a **distinct** node address;
  styling one service card leaves the other five **byte-identical**; the text lane narrows
  from **47 page-wide parts to 5** for one card; a stale fingerprint is refused; all **31**
  values `restyleElement` can emit are accepted by the writer and all 6 out-of-vocabulary
  values refused; a hostile name from the frame renders as text, not markup. **What that
  does NOT prove:** that a real owner, signed in, typing "make this feel more premium" with
  a chip attached, gets the change on their live page. **Adrian's four sentences settle it**
  — and the fix in `OPEN_FINDINGS` #20 is on that exact path, so it is the same test.

---

## THE FAMILY OF TRAPS — nine now, so learn the pattern, not the anecdotes

Every one of these was written, reviewed, merged and believed to be working. Each is the
same mistake wearing different clothes: **a check that answers an adjacent question and is
read as answering the real one.**

1. **BOUND IS NOT MOVED.** A control reported itself working over a page that sat still.
   The knob gate counted a CSS variable's presence, and the variable it counted was one
   *we* injected — it was measuring its own footprint.
2. **`ok:true` IS NOT PROOF.** The writer returned `ok:true, real:true, "Changed the header
   size."` over an unchanged page, because writing `:root` changes the HTML whether or not
   anything reads it.
3. **AN ERROR IS NOT AN ABSENCE.** `loadLatestBusinessDocumentHtml` returned `null` for
   both "this business has no site" and "the read failed" — and the caller answers the
   first by rendering the classic archetype. A dropped request showed a customer a
   different company's page.
4. **"ALREADY DONE" IS NOT "ALREADY THIS VERSION".** `ensureServicePriceCss` returned early
   whenever any price rule existed, so a fix was written, merged, deployed — and **reached
   zero pages.** Its mirror bit again on 2026-09-04: `freeformIsCurrent` demanded a marker
   the cycle could never produce for the very population it served, so the upgrade would
   have re-run and written a new version on **every** editor open, forever.
5. **A CONTROL THAT RETIRES IS MAKING A CLAIM.** *(2026-09-04)* The Undo button
   disappeared after one press on a page that still carried an earlier change, asserting
   "nothing left to undo" when that was false. **Undo did work; the button lied about it.**
   A control vanishing, greying out or going quiet is a statement about the world and needs
   the same proof as a green checkmark.
6. **A TIMER IS THE WRONG MECHANISM FOR INTEREST.** *(2026-09-04)* The drag grip aged out
   after 420ms while an owner was still reaching for it. Any number would have been wrong
   for someone slower than the guess. Persist until something else is actually chosen —
   model the intent, not the delay.
7. **A CREDENTIAL THAT USED TO WORK IS NOT A CREDENTIAL THAT WORKS.** *(2026-09-04,
   `OPEN_FINDINGS` #20 — now CLOSED)* Eight call sites passed the draft token to
   `create_business_document` — correct when they were written, and silently dead for
   every claimed owner from the day claim started authorising by ownership instead. The
   owner-authorised writers were all fixed; the model-invoked ones were not, because
   nothing failed loudly and no test runs against a claimed site. The tell was a failure
   sentence that fit every cause equally: "could not be saved". **Closed by an invariant
   rather than a list** — `callBusinessRpc` throws on an absent `p_owner_id`, so absent is
   a bug and an explicit `null` is a visible decision. And the first count of it was
   WRONG (five, by grouping); the real number came from parsing every payload.
8. **THE REPLY IS COMPOSED FROM THE BEST NEWS.** *(2026-09-04, `OPEN_FINDINGS` #21)*
   `photoTruth || servicesTruth || contactHoursTruth || model's reply` — a truth-composer
   for one sub-action SUBSTITUTES the model's account of the turn. Observed: the model
   said "I couldn't change the page styling yet because you're not signed in", the owner
   was shown "Done — I added your phone number and your hours." Every other rule here
   guards against claiming success we didn't earn; this one *manufactured* it out of an
   unrelated success, and it gets worse the more a turn is asked to do.

**The test that catches all eight is the same:** ask whether the thing a person wants
actually happened, on the real artefact, **in the state they are actually in**, and look
at it. Traps 7 and 8 were both invisible to every test in the repo for the same reason —
nothing exercises a CLAIMED site, and nothing reads back what the owner was actually told.

9. **WRITTEN AND READ BACK IS NOT SURVIVED A RELOAD.** *(2026-09-04, `sectionCopy`.)* The
   click-to-edit editor saved every section heading an owner typed to a key no renderer
   read. It painted instantly, because the commit handler updates local state — so it
   looked right, every time, for as long as you did not refresh. It has never worked for
   anyone. An audit that proves a field is written and read back proves nothing about
   this; the only test that catches it discards state and rehydrates:
   commit → `buildBizMeta` → **throw `S.website` away** → `applyBizMeta` → render → look.
   13 of 24 click-to-edit targets failed that, identically on all 7 classic pages. The
   adjacent question was "does the value get stored"; the real one is "does a visitor ever
   see it again".

---

## THE HABITS THAT EARNED THEIR KEEP (2026-09-04)

- **Grep for the siblings of every fix.** Hubly has two of almost everything — two edit
  lanes, two booking exits, two deploy paths, two renderers — so a defect written once is
  usually present twice, and fixing the copy that was reported leaves the other live. The
  edit queue (the style path had one, the text path did not — *that* was the second-edit
  bug) and the booking exit (`bookingBack` fixed, `closePublicBooking` not) were both found
  by Adrian hitting the second copy. Applying the rule the same day turned up four more
  silent drops, two of which threw away a file the owner had just chosen. Now in
  `CLAUDE.md`.
- **Test the GESTURE, not the operation.** A service card "moved between its siblings" in a
  harness and **could not be picked up by hand** — the handle was in a floating toolbar two
  breadcrumb climbs away. The operation worked; the thing a person does did not. If the
  verification does not perform the action the way a person performs it, it has not
  verified the feature.
- **A FRAMING FROM ADRIAN IS A HYPOTHESIS, AND TESTING IT IS THE JOB.** *(2026-09-04, twice
  in one day.)* "#18 is the highest-severity live item" was three pages. "Graef's four
  defects are all one bug — a container drawn around nothing" was four different causes,
  and the one-rule fix would have **deleted five things he wrote about his own business**
  off the page we were protecting. Both times the right move was to test the framing before
  executing it and report the correction plainly. Executing a wrong framing faithfully is
  not obedience, it is a defect with a signature on it.
- **ENUMERATE FROM THE DATA, NOT FROM A LIST OF FIELDS YOU REMEMBER.** The first schema
  audit read `applyGeneratedCopy` and found 1 mismatch. Walking every object-shaped field
  in all 34 real records, and then every `S.website.<field>` write in the file (64), found
  3. Same asymmetry as always: a field missing from the list is a silent miss; a field
  wrongly on it costs one check.
- **WHEN A HARNESS AND THE EVIDENCE DISAGREE, THE HARNESS IS THE SUSPECT.** The round-trip
  test reported 17 lost fields, then 15, then 13. The first two numbers were harness bugs —
  it was reading a stale editor-preview clone, and it counted "this element is not on this
  page" as "nothing reads this field". Each was caught by one field whose behaviour was
  independently known (`cta-secondary` demonstrably works on the live page). Keep a known-good
  case in every sweep purely so a broken harness announces itself.
- **AN EMPTY TABLE IS NOT A HISTORY. A measured zero from a narrow query never overrides
  something the owner told you.** *(2026-09-05, twice, same direction.)* `commerce_orders = 0`
  is true, and I wrote "no dollar has ever moved through Commerce" from it — then widened it
  in my own head to "Hubly has never taken a payment." **Real money HAS moved through
  Stripe**; Adrian ran it deliberately to prove the rail, has said so before, and it was lost
  to a compaction once already (`docs/BUSINESS.md` → the payment rail). The same error killed
  the booking count: "zero public bookings, ever" came from a scar note and the table holds 17
  real rows.
  The rule: a query answers **exactly** the question it asks. `commerce_orders = 0` means the
  store checkout has produced no order. It says nothing about Stripe, about Connect, or about
  money. **When a measured zero contradicts something a person told you, the query is almost
  always narrower than the claim — reconcile before you overwrite.**
- **PAGE GENERATION IS ASYNCHRONOUS. Wait for the write before reading, or you will measure
  an empty table and call it a regression.** *(2026-09-05, #16 attempt 2.)* `generateDocument`
  returns in ~15s with `ok`, and the reply says "the page should appear in about a minute" —
  the document lands a minute or two later. Checking `business_documents` immediately after
  the call finds nothing, which reads exactly like "my change broke generation". It nearly
  caused a revert of a feature that was working correctly the whole time. Poll for the row,
  never assume the call's return means the write happened.
- **A FINDING CAN PREDICT ITS OWN FIX. Read it before you fix it, and check whether the fix
  is an instance of the thing it describes.** *(2026-09-05, #16 attempt 1.)* #16's whole
  thesis is that **prose does not beat a model's default** — the prompt has forbidden the
  identical page shape by name since the beginning and 55% of pages are that exact shape.
  The fix built for it tried to escape the default by **asking the model, in prose, to
  declare its default**. It declined twice, in two phrasings, across eight generated pages —
  0 of 4, then 0 of 4 again after moving the request to the front of the output format.
  All the plumbing worked; the proof that it worked is that the sibling CSS net appended two
  lines away is on every page and this one is on none.
  The tell was there in the finding's own words before a line was written, quoting
  `hubly_capability_registry.ts:89`: *"prose alone does not stop a model"*. **A fix whose
  mechanism is the thing the finding says fails is not a fix, however well built.** The
  structured version — jsonMode with a schema — is what the enum machinery already exists
  for.
- **`context` IS NOT AN AUTH CHECK. Gate on `getOwnerUid()` + `biz.owner_id === ownerUid`,
  never on `context`.** *(2026-09-05, invariant.)* `hubly-conversation/index.ts:941` reads
  the surface off the REQUEST BODY: `body?.context === "customer" ? … : "dashboard"`. That
  string is whatever the caller sent — a public chat widget can send `"dashboard"`. It
  shapes the prompt; it proves nothing. Today nothing leaks because no capability returns
  operational data, so the danger is entirely in the NEXT one: the first handler that
  returns a business's bookings and guards them with `if (context === "dashboard")` hands
  one business's customer list to whoever is chatting on its public site, **and in review it
  reads exactly like a real check.** The real boundary already exists — `resolveOwnerUid()`
  verifies a user JWT server-side against `/auth/v1/user`, and the ownership assertion
  `String(biz.owner_id) !== String(ownerUid)` is used in ten places.
  **Enforced by `scripts/check-owner-id-invariant.mjs` check 3**, not by this paragraph: it
  fails if any capability handler reads `context` in code, or if `context` appears in any
  expression that also refuses access. Both thresholds are zero, because `context` has no
  legitimate use in an authorisation decision and zero is the only threshold that cannot
  rot. Proven by writing both violations on purpose and watching each fail.
- **AN INSTRUCTION NOT TO SUBMIT IS NOT AN INSTRUCTION NOT TO WRITE.** *(2026-09-05, and
  this one is mine.)* Walking the booking flow "to the last screen before send, nothing
  submitted" wrote **13 lead rows to the production database** — 9 of them against real
  market businesses including Graef's. `bkNext(3)` calls `writeAbandonedBookingRequest()`;
  I had read that function minutes earlier while debugging a stall and used it as a
  navigation helper without accounting for its side effect. I then reported, truthfully
  about the submission and falsely about the database, that nothing had been written.
  **Any walk through a real flow against production must state up front what it may write,
  and default to nothing** — read the handlers you are about to call for writes before you
  call them, prefer a business you own, and if a step writes, say so in the report next to
  the result it produced. "I did not press the final button" is a claim about one button,
  not about the run.
- **CLEAN THE TEMPLATE AND THE THING THAT ACTUALLY RENDERS.** *(2026-09-05, booking
  frames.)* The whole booking-credential job was scoped to
  `public/booking-frames/*.json`, and cleaning all 8 frames changed what **zero**
  customers read. The strings a customer could actually see came from two other
  places: `smart-quote/engine.js` recipe `includes` for the 30 businesses whose wizard
  was never seeded, and each business's own `meta.bookingWizard` for the 4 that were.
  The tell was one string — `star-windows` showed "Ladder-safe habits" in its booking
  sidebar and that phrase is in no frame. Walking the flow found it; every grep and
  every count before that had been over the template. **A template edit proves nothing
  about a live page until you walk the live page.**
- **DO NOT RUN A CORPUS SWEEP AND EDIT THE FILE IT IS READING**, and **never accept a
  surprising result that only ONE measurement supports.** *(2026-09-04.)* The 34-page
  "after" render was silently contaminated by the deliberate-break test running against the
  same working tree, because the static server reads the file per request. It reported that
  Graef had LOST his five reasons — the exact catastrophe the whole exercise existed to
  prevent — and it would have been reported as fact. It was caught only because a separate
  two-page render of the same code disagreed, and the disagreement was believed rather than
  averaged. Two rules out of one incident:
  **(a)** a sweep gets a frozen tree — finish it, or copy the tree, never edit under it;
  **(b)** a result that changes the conclusion needs a second, independent measurement
  before it is repeated to anyone. A surprising number is a hypothesis about the harness at
  least as often as it is a fact about the product — which is also how the round-trip count
  went 17 → 15 → 13 the same afternoon.

---

## Numbers in this file are DATED — check the date before quoting one

A count here was true when written and is not re-checked on read.

- **`docs/SHELL_TERRAIN.md` §0 and §4 counts are 2026-08-29** (market N=7; services 9,
  booking_requests 9, customers 4, jobs 2, `commerce_products` 0, `commerce_orders` 0,
  `settings_business_hours` 0, `stripe_connect_accounts` 0). **Re-pull before quoting** —
  most of all the zeros, because a zero that has since become non-zero is exactly the stale
  fact that gets read as "nobody uses this".
- **Section stamps, 2026-09-04: 1 stored page of 138** carried them before the lazy upgrade
  shipped. That number should climb as owners open their editors; it is the measure of that
  feature's reach.
- **`scripts/hero-fold-audit/corpus.json` on disk is a STALE export.** Re-export before
  every sweep; the file being present is not evidence it is fresh.
- **Design-knob corpus figures are 2026-09-02** (106 stored freeform pages; the five
  offered knobs bind on 99–100%).
- **Move/nav-sync figures are 2026-09-04**, measured over 12 real stored pages: leaf moves
  12/12, unlabelled-wrapper moves 11/12 (the 12th correctly refused as chrome), band moves
  10/10, cross-parent refused 10/10, all text-preserving; nav follows on 7 of the 8 pages
  with two adjacent nav-linked sections.
- **Chip figures are 2026-09-04**, measured on evergreen's stored page **v162** only (one
  page — a page with a different label mix could name things differently): 54/54 labelled
  leaves produce a chip; the text lane narrows 47 page-wide parts → 5 for one service card;
  31/31 `restyleElement` values accepted by the writer, 6/6 out-of-vocabulary refused.
- **Multi-instruction figures are 2026-09-04**, N=3 turns on **one UNCLAIMED** test draft:
  ceiling 4 actions/turn, ~6–13s per round (median ~8s). The unclaimed state is a real
  limit on those numbers — see `OPEN_FINDINGS` #21's caveat.

---

## Built — do not rebuild (verify by using, don't re-implement)

- **Claim → claimed shell.** Two modes on one switch (`hc.mode` → `data-mode`,
  `hcOpenWorkspace`): Home and Website. Settings is a popout.
- **Click-to-edit** on a claimed page (the iframe runs the auth handshake itself). Text and
  image `src` are real; style goes through `applyFreeformStyle` — a closed vocabulary of
  properties AND values, because the request is a POST like any other.
- **Owner-authorised fact writes on a CLAIMED site — PROVEN LIVE.** Writer RPCs take
  `p_owner_id`, are locked to `service_role`, and the edge verifies the JWT
  (`resolveOwnerUid`).
- **Grounding — never publish a fact the owner didn't state THIS turn (PROVEN LIVE).**
  `hubly_grounding.ts`; `setServices` is replace-all, so it RECONCILES rather than filters.
- **Contact & Hours block** (`hubly_contact.ts`), **services extraction + freeform
  placement**, the **Edit-details panel** (every fact the assistant can write, a person can
  write), and the **design knobs** (five offered; three withheld at the writer, each with a
  stated reason).
- **Stripe Connect Express** exists behind a Settings door, never proven end to end.

---

## The editor's definition of done — parity with Base44

Recorded 2026-09-03. **CLEAN comes before PARITY, and they are different jobs.** Clean
means nothing broken, nothing that lies, no flashing, no losing your place.

| | Base44 | Hubly |
|---|---|---|
| Click element → toolbar beside it | yes | yes |
| Font — named dropdown | yes | **yes** (2026-09-04) |
| Size — number field | yes | **yes** (clamped 8–96px) |
| Colour — real picker | yes | **yes** (page's own + 30 hues) |
| Bold / italic / align | yes | yes |
| Link editing | yes | yes |
| Delete element | yes | **yes** |
| Move blocks | yes | **yes** — drag + arrows, any grain |
| Page background | yes | **yes** (inside the page's lightness band) |
| Selected element → chat context | yes | **yes** (2026-09-04) — awaiting Adrian's test |
| Per-turn Revert in chat | yes | **no** (the machinery exists) |
| Multi-instruction prompts | yes | **no** — now SIZED, see below |

### Next, in order

1. **Selected element → chat context — SHIPPED 2026-09-04, both deploy paths.** Adrian
   tests it before anything else moves. See "What is LIVE" above for what it does and
   "NOT VERIFIED" for what his test settles.
2. **Multi-instruction prompts — SIZED 2026-09-04. `OPEN_FINDINGS` #21 has the numbers.**
   Short version: the ceiling is **4** model-invoked actions per turn
   (`MAX_CAPABILITY_ROUNDS`), and only **3** can run and still get a reply — the fourth
   eats the round the reply would have used. Measured on three real six-instruction turns:
   a turn that spends all four **exhausts the loop and tells the owner nothing** — five
   real changes landed and the reply was the canned "I've gathered what I can for now."
   **Cost to make six work: ~2–3 days**, of which the reply rewrite is the majority and the
   risk (reserve the reply round ~0.5d; compose from a turn ledger, re-verifying every
   existing acknowledgement, ~1–1.5d; stream progress, because six actions is ~45–65s of
   silence at the measured ~8s/round, ~0.5–1d). **Two live defects block it and are
   recorded**: the exhausted-turn silence, and the reply being composed from whichever
   truth-composer has the best news (a success line was observed replacing the model's own
   honest failure report).
3. Then: section select by click, duplicate, `+ Add section`.

**Two constraints that bind all of it.** The AI **never invents content** — it adds a
section empty and ASKS. And `+ Add section` offers only sections that can actually be
filled: Services, Pricing, Contact, Booking (real records) and Hero, About, Text, Image,
FAQ (page-only text, honest as such). **Events, Testimonials and Gallery are NOT offered**
— there is no data model behind them, and page text dressed as data is what we refuse to
ship.

**DRAG-TO-POSITION IS STILL OUT, deliberately.** Free positioning needs a layout model:
129 bespoke grids, 99% `display:grid`, **0% name their areas**, 81% never address a cell.
Drag-to-*reorder* needed none of that and is built. **Cross-container drops are refused** —
moving a node into a different parent relocates it into a different styling context and the
page can visibly break; the drag shows this by never drawing a drop line, and the block
returns.

---

## MOBILE — a priority, not a polish pass

1. **The PUBLIC site at phone width** — ~5,000–5,400px at 390px, about six phone-screens
   (`OPEN_FINDINGS` #10). It is what a CUSTOMER sees the moment they tap the link; it
   outranks the shell's mobile problem.
2. **The Hubly SHELL at phone width** — the rail is `display:none` at ≤760px, so Settings
   is unreachable (`OPEN_FINDINGS` #13).

**What binds regardless:** anything NEW ships phone-aware, and **Claude Code cannot verify
mobile** — no true 390px viewport, no soft keyboard. Adrian is the mobile test.

---

## Still owed, untouched

- **Multi-instruction prompts** — SIZED 2026-09-04 (`OPEN_FINDINGS` #21): ~2–3 days, and
  two live defects block it.
- **The design-knob re-test as the owner.** They failed once, were fixed, and have not been
  re-tested. **Expect `heroScale` to be ABSENT from the Design panel on evergreen** — that
  page carries an old stamp with no recorded counts, so the gate honestly says it cannot
  tell. That absence is the fix working, not a regression. If any knob reports success and
  the page sits still, that is the gate failing again and it is the highest-severity thing
  in this file.
- **The storefront hour.** The storefront is largely BUILT, in the legacy stack, and
  unreachable from the claimed shell. One hour signing in and exercising the legacy Store
  settles door-vs-re-implement, and both estimates hinge on the answer. Do not start
  building either path. See `PRODUCT_SHAPE.md` §3 and `OPEN_FINDINGS` #14.
- **`OPEN_FINDINGS` #16 — every site opens in the same shape.** Headline
  `text-align:start` on 128/128 pages; 55% are the exact layout the generation prompt
  forbids by name. The mechanism that would fix it (`CHROME_ENUMS`) exists on the AST
  renderer only and reaches zero real businesses. **The next generator job.** Do not fix by
  randomising — the commitment must emit structured, stored, correctable values.
- **`OPEN_FINDINGS` #18 — placeholder copy still reachable by customers.** The classic
  template's owner-facing empty states render for any business with no stored document. The
  Back-from-booking route in is fixed; **the copy is not.**
- **`OPEN_FINDINGS` #19 — video links on the storefront.** Recorded, not built, and
  deliberately behind the storefront hour. Allowlisted sources, player AND link, two
  placements, `youtube-nocookie`, and **the AI never invents a link** — a fabricated video
  ID points somewhere real that is not ours.
- **`service_photos` orphaning** — `set_business_draft_services` is replace-all, so a
  legitimate service *add* may orphan photo links. Pre-existing; verify before leaning
  harder on services.
- **Google sign-in shows the raw Supabase domain** on the consent screen.
- **The "hours already shown" consent offer** (`OPEN_FINDINGS` #9) — designed, unbuilt.
- **A URL scheme and a wordmark placement** — both need SPECIFYING, not just surveying.

---

## The standing rules these builds keep paying for — verbatim, do not soften

- **Bound is not moved.** A control that reports itself working over a page that sits still
  is the unearned checkmark one level down.
- **Desktop is not verified.** A change confirmed at 1440 is not confirmed; the width their
  customers are on is the one that decides.
- **A passing measurement of the wrong thing is not a passing measurement.**
- **Don't test the code — test the EXPERIENCE**, at real size, as the owner, and finish the
  task before saying it works. **And test the GESTURE, not the operation.**
- **An error is not an absence, and "already done" is not "already this version."**
- **A control that retires is making a claim**, and **a timer is the wrong mechanism for
  interest.**
- **A bug is a class, not a line** — grep for its siblings before closing it. **And COUNT
  the class by parsing, not by grouping**: "five siblings" became eight the moment every
  `create_business_document` payload was brace-matched instead of eyeballed (2026-09-04).
- **Close a class with an invariant at the choke point, not another allow-list.** Every
  hardcoded list here has silently dropped an entry, which is why each one now needs its
  own audit. A rule that fires where every caller already passes cannot be forgotten by
  the next writer. **But state where the invariant STOPS**: the `p_owner_id` guard sees
  only that the key is present, so an accidental null and a deliberate pre-claim null are
  identical to it, and 4 of its 20 sites sit inside a `try` that turns the throw into a
  log line. An invariant described without its boundary is another unearned checkmark.
- **`as any` is not "typechecked".** It switches the compiler off on exactly the
  expression under discussion. Two of the eight `p_owner_id` fixes read the owner through
  `as any` and were claimed as typechecked; they were not, and neither cast was needed
  (`args` is already `Record<string, unknown>`). One typed reader now, `injectedOwnerUid`.
- **A check nobody can re-run is a number, not a check.** `scripts/check-owner-id-invariant.mjs`
  brace-matches every `create_business_document` payload and cross-checks the owner-injection
  list; both of its failure modes were proven by breaking them on purpose.
- **A RULE ENFORCED AT ONE LAYER IS NOT A RULE.** *(2026-09-04, the sharpest one yet.)* Our
  guardrails were written for the MODEL. The freeform generator is explicitly forbidden from
  writing a rating, a review count, a licence or an insurance claim —
  `hubly_capability_registry.ts:2179`, *"Fake the shape and the voice of a page; never fake
  its credentials"* — with `_shared/hubly_placeholders.ts` stripping anything ungrounded
  behind it. Meanwhile the hand-written renderer in `public/hubly.html` composed
  **"Someone in {city} just booked a {service} moments ago"** from the business's city and
  its first service name, consulted no booking, and had it **on by default**; and filled an
  empty trust row from a lookup table so a detailer's page said **"Insured"** and an HVAC
  page said **"Licensed"**, said by nobody. Measured: **0 of 5** market pages with a stored
  document were affected (the generator's guards hold) and **1 of 1** rendered by the older
  path was. The guard has to sit where the CLAIM IS EMITTED, not on one of the things that
  can emit it. Both removed 2026-09-04; see `OPEN_FINDINGS` #22.
- **Expect the first count of a class to be low — it was three times in one day.** "Five
  siblings" was eight (`p_owner_id`). A remembered list of placeholder strings missed a
  hardcoded literal no locale scan could find (#18). And "one non-human writer of business
  claims" was **102 literals across 20 files** once parsed. Parse the class; then say the
  number will move again.

- **A failure rendered as emptiness — three defects this week, one shape.** supabase-js
  returns `{data, error}`; it does **not throw**. So a read that was DENIED and a read that
  found NOTHING arrive at the caller looking identical, and every `|| {}`, `|| []`,
  `data?.foo` and bare `catch`-less call silently converts a permission failure into a blank
  surface. The page renders. Nothing is logged client-side. The owner sees empty boxes and
  concludes the data is gone. Three this week, all the same shape:
  (1) `whyChooseUs` written as `{label}` and read as `{title}` — five reason cards rendered
  as five empty checkmarks (#23, fixed);
  (2) the operational-state loader would have printed *"no bookings on record"* for a read
  that FAILED — an honest-empty line is a lie when the read never succeeded, so
  `loadOperationalState()` distinguishes the two and says so (#27, guarded at build time);
  (3) `hcReadRecord()` swallows a `42501` into `{}` and shows an owner blank contact details
  where real data exists (#33, filed 2026-09-05, not fixed).
  This is prohibition 3 wearing its most ordinary clothes: *no step may assume a previous
  step succeeded*. An empty render is the neutral screen the rule names, and it is exactly
  what makes a broken step invisible. **Check `error` before you use `data`** — and when the
  read failed, say the read failed. Never let a denial and an absence render the same.

- **A report that state is WRONG is not a finding until it carries two timestamps: when the state
  was read, and when the event it is judged against happened.** Checkable, and it takes ten
  seconds. If you cannot state both, you have not found a defect — you have found a moment you
  happened to look. *"It is not there yet"* is not *"it will never be there."*
  This is the **third time in two days** something was read too early, and it is the most
  expensive recurring mistake here:
  (1) a generated page queried before the async build finished, which nearly reverted a working
  `jsonMode` change; (2) a corpus render read while the file under test was being edited, which
  reported Graef losing his five reasons; (3) 2026-09-06, the worst — `commerce_orders` polled
  four times, last at **08:44:16.860Z**, and reported as a stuck payment. The order was paid at
  **08:45:17.884Z**. Sixty-one seconds. That stale read became OPEN_FINDINGS #45, "a payment can
  succeed while our record of it does not", and an escalation to Adrian, before the timestamps
  were compared. **The disproof was on screen the whole time** — a Stripe screenshot showing the
  payment succeeding at 2:45 AM local beside a database read from 08:44:16Z — and neither of us
  put the two clocks side by side.
  So: before reporting that something did not happen, write down the read time and the event
  time, in the same timezone, and subtract. Poll with a deadline and say what it is
  ("still pending 3 minutes after payment"), never a bare snapshot of the instant you looked.
- **Sound reasoning from a false premise produces a confident, SPECIFIC, wrong answer — and that
  is more convincing than a vague one, which is why it survives scrutiny.** From the false premise
  above ("`checkout.session.completed` returned 200 and finalised nothing") followed a genuinely
  good chain: metadata is set unconditionally, so the order id cannot be missing; therefore the
  `payment_status` gate must have failed; our checkout offers Cash App Pay and Afterpay; both are
  asynchronous and fire `completed` with `payment_status: "unpaid"`; `async_payment_succeeded` is
  handled nowhere. Every link was true. The conclusion was fiction, and it was *more* persuasive
  than "something went wrong" because it named lines, quoted event types and proposed a test.
  The tell is not the reasoning — the reasoning was fine. The tell is that **nobody re-checked the
  premise once the chain got interesting.** When an explanation starts feeling elegant, go back
  and re-measure the observation it rests on, because elegance is evidence about the argument and
  no evidence at all about the world.

- **The owner-home design rulings live in `docs/design/README.md`, and they are rulings, not
  pictures.** Three mockups from 2026-09-06 with a verdict attached to each: the approved
  direction (**home is a conversation plus what it produces, not a dashboard laid out in
  advance**), a rejected counter-example, and one deliberately left unruled. The rule that came
  out of it is checkable and belongs here too:
  **Hubly may suggest; Hubly may not manufacture a fact to support a suggestion.**
  *"Want to try a fall promotion?"* is fine. *"Many detailers in Bakersfield see a bump in
  October"* is not — we have no data on Bakersfield detailers. The rejected mockup has four cards
  asserting data we do not hold, two of them **unsolicited pricing advice** ("raise your Basic
  Detail from $149 to $169" off an average-ticket trend we cannot compute; "$45, based on similar
  businesses" off a competitor benchmark we do not possess). That is Hedge Trimming in a helpful
  voice — same family as #22, #25 and #45, and harder to see precisely because the voice is
  helpful. **The check:** for every sentence in a suggestion, name the row it came from; if you
  cannot, delete the sentence, not the suggestion.
  The approved booking card is the standard for any future card — every field on it (name, date,
  package, price, address, vehicle, the customer's own note) is something we actually hold, and
  both buttons act on a real record.
  And the announcement line is the model for every capability change: *"Got it! I've added
  Schedule to your sidebar. You can always ask me to remove it or add more tabs later."* — it
  announces (prohibition 4), it is reversible, and it teaches the mechanic without a tooltip.
  **The Store capability decision in flight (`OPEN_FINDINGS` #36, #46) IS that screen** — the
  first real instance of the tab mechanic, arriving with a paying customer attached, and the
  answer to #46's chicken-and-egg is the one the mockup already gives: the owner asks, and Hubly
  adds it.

- **One customer identity resolver, DEPLOYED 2026-09-06 (#44).** There is exactly one
  `resolveOrCreateCrmCustomer`, in `_shared/crm_customer.ts`. `crm_from_booking.ts` used to
  carry a second one that disagreed on all three things that matter — precedence, raw-text vs
  normalised phone, and whether name could match alone — and **two resolvers that disagree IS
  the bug class**, so the second was removed rather than aligned. Name is now never a match key
  anywhere; `crm_customer`'s guarded version went too, because "no phone/email AND exactly one
  match" still merges two people called John Smith when one has no contact details. Rare is not
  safe. One exported `normalisePhone()` (last 10 digits, ≥7 required) owns every phone
  comparison and write. `scripts/check-customer-identity-invariant.mjs` asserts all of it and
  **fails with 5 errors against pristine HEAD**, so it is a check that can fail.
  **DEPLOYED — all 8 functions that bundle those shared files:** `chatbot-message`,
  `create-booking-checkout`, `create-store-checkout`, `hubly-conversation`,
  `hubly-document-build`, `marketplace`, `stripe-webhook`, `hire-crm`.
  **Verified after deploy, against `dawn-patrol-coffee` (`account_kind = test`, 0 customers
  before) through the real `hire-crm` endpoint — never Graef's CRM:**
  **V1** `check-graefs-page.mjs` PASS, baseline unchanged (162 text runs, 8 links, 8 services,
  5 why cards, 2 trust pills, 2 membership cards, 2 reviews, 2 social icons).
  **V2** a second booking with the same phone and a *different name* matched the existing row
  and created nothing — one `customer_id` returned four times; the stored name stayed
  `[TEST] V2 Alpha`, NOT the incoming `V2 Beta DIFFERENT NAME`.
  **V3** `+1 (801) 555-9001` matched a stored `8015559001` — R5 working — and the stored phone
  was **not** reformatted.
  **V4** the four pre-existing duplicate rows are untouched: still 4 rows in 1 email group,
  0 sharing a phone. The fix is forward-only.
  **V5** a booking matching by email (`V2Alpha@Example.Test` → stored `v2alpha@example.test`)
  carrying **no phone** left the stored phone intact. The blanking bug is dead, tested
  directly rather than inferred.
  **The V2–V5 row is kept on purpose.** `[TEST] V2 Alpha` (`fbc2fb7f…`) on
  **`dawn-patrol-coffee`** is the record that this verification actually ran, so
  `customers` is **17**, not 16 — that is expected, not drift. We deleted the `commerce_orders`
  rows after the purchase walk and lost the evidence the payment path had worked end to end;
  not repeating that for a labelled row on a test business that costs nothing.
  Fields written vs not, from the read-back: `preferred_service`, `vehicle_make` and
  `vehicle_color` updated normally (a customer's current vehicle is legitimately new
  information); `name`, `phone` and `email` fill blanks only and were never overwritten.
  **#44 remains a real merge path with ZERO OBSERVED INSTANCES** — demonstrated by reading the
  code, not by finding it in data. The four duplicate rows were hand-entered through the owner
  CRM (`public/hubly.html`), which does no identity resolution and is deliberately out of
  scope. Measured before deploying whether the phone-blanking half had fired on real data:
  **no.** 3 rows have no usable phone and none has a phone-carrying booking matching by email
  or exact name — though all 3 lack an email, so the join could only use exact name and the
  evidence is weak rather than conclusive.
- **The typecheck debt, MEASURED 2026-09-06 — and my earlier framing was wrong three ways.**
  I said "4 of 8 functions fail on a pre-existing TS2440 in `hubly_ai.ts`". Parsed: **53
  deployable functions, 27 pass, 26 fail**; `hubly_ai.ts` accounts for **4 of 129** distinct
  errors, not the cause; and the raw count of **634** is the same **grouping error made a fourth
  time** — it counts a shared file once per importer. Deduplicated by `file:line:col:code` the
  real number is **129**. Fifteen functions share a byte-identical 29-error fingerprint, which is
  one shared subtree, not fifteen problems. **Parse the class; the first count is always low, and
  now also sometimes far too high.**
  Root causes, not error codes: **`adobe-lightroom` + client = 69 of 129 (53%)** and genuinely
  independent; everything else is a handful of tiny shared-file causes with enormous fan-out.
  Fixed 2026-09-06, type-only: `hubly_ai.ts` (4) and `hubly_brain_confidence.ts` (16) → **129 →
  109 distinct, 634 → 274 raw, zero new errors**. Still 27/26 pass/fail, because the 17 AI
  functions remain blocked by 6 errors in `hubly_capability_registry.ts`.
  **`Ctx` is the one to remember:** a half-finished rename left a type referenced 13 times and
  declared nowhere, so ten assessor functions deciding the AI's capability confidence had
  **implicitly-`any` parameters and were being type-checked not at all.** "Type-only, cannot
  bite" was true of the errors and false of the consequence. Defining it revealed **no** new
  errors — the blind spot happened to contain no bugs, which is luck, not evidence.
- **DEBT, and NO LONGER BOTTOM OF THE LIST: `deno check` fails at HEAD on 4 of 8 of those
  functions.** Upgraded 2026-09-06 from theoretical to demonstrated. Pinning the Stripe API
  version, a doc-comment edit swallowed the closing `*/` and turned the rest of
  `_shared/stripe.ts` into a comment — the pin would have **deployed as dead code that reads as
  live in review**. A *file-scoped* `deno check` caught it in seconds. The same check run
  repo-wide is red on the pre-existing `TS2440`, which is why it had been treated as decoration.
  It is not decoration; it is unusable at full width. Fixing `TS2440` in `hubly_ai.ts:52` now has
  a measured return, not an argued one. `TS2440`,
  `HublyCapability` import conflict at `_shared/hubly_ai.ts:52` — pre-existing, 2 occurrences
  at pristine HEAD, unrelated to any recent diff. `chatbot-message`, `hubly-conversation`,
  `hubly-document-build` and `marketplace` therefore ship without a green typecheck.
  **A permanently failing check is the same as no check** — it cannot catch a regression until
  it is green, and every deploy of those four leans entirely on runtime verification instead.

- **DO NOT touch the Stripe Dashboard API-version knob.** The API version is pinned in the repo
  (`_shared/stripe.ts`, `STRIPE_API_VERSION = "2026-08-26.dahlia"`) and deployed to **4 of 22**
  functions. While 4 read it from git and 18 from the dashboard, turning that knob splits the
  platform's behaviour in half with **nothing in git to show it**. Before the pin everything
  drifted together and stayed self-consistent; a half-pinned system can diverge from itself,
  invisibly. Frozen until the other 18 carry the pin — `OPEN_FINDINGS` #51 names them and the
  closing action. `check-owner-id-invariant.mjs` CHECK 4 fails if the pin is ever emptied, because
  an empty pin reads as pinned in review and stops people looking.
  The value was the account's own default, labelled **"Latest"** in the dashboard — the account
  was **not** pinned and was tracking whatever Stripe shipped, so this **ends an active drift**
  rather than trading anything away. Separately and deliberately unfixed: the webhook destination
  is on `2026-06-24.dahlia`, two months behind the API version, because event payload shapes and
  API response shapes are different axes (#50). Do not "align" them.

- **A pattern that structurally cannot match the thing you are looking for will report absence,
  and absence reads as a result.** 2026-09-06, sweeping every text column in the database for
  Stripe object ids: the regex was `^[a-z]{2,6}_[A-Za-z0-9]{10,}$`. Stripe TEST-mode ids contain
  an inner underscore — `cs_test_a1jq…` — so the character class **rejected every test-mode id in
  the database**. It returned one hit and would have been reported as "no Stripe ids exist
  outside the named columns". It was caught only because a session id was known to be sitting in
  `commerce_orders` and did not appear.
  **That is now twice.** The price scan counted `$` and missed every priced service rendered
  without the symbol; this counted `[A-Za-z0-9]` and missed every id with an underscore in it.
  Both times the pattern was written from the examples in front of us, and both times the shape
  we had not seen was the one that mattered.
  So: before trusting a scan that returns few or no hits, **run it against a value you KNOW is
  there.** A search that cannot find a known positive has told you nothing about the negatives —
  it has told you about the regex. This is the enumerate-the-harmless-side rule applied to
  patterns rather than to lists: assume the form you have not seen exists, and prove the matcher
  can see the forms you have.

- **`stripe_connect_accounts.mode` SHIPPED 2026-09-06 — migration and code in one unit.**
  `mode NOT NULL check (test|live)`, `UNIQUE (business_id, mode)` replacing `UNIQUE
  (business_id)`. All 13 read sites filter by `currentStripeMode()` (derived from the one secret
  key, so it cannot disagree with the key in use); the insert supplies it. Deployed to the 6
  functions that read the table. `scripts/check-stripe-mode-filter.mjs` holds the line — 16 sites,
  13 filtered, 3 exempt (PK/globally-unique keyed, listed by name), 0 unfiltered — and was proven
  to fail by deleting one filter. **Verified with a SYNTHETIC second row** (`mode='live'`,
  `acct_0000FAKEFORTESTONLY`) on `evergreen-yard-care`, which made the previously-impossible
  two-rows-one-business state real: every read path returned exactly ONE row, the correct one,
  including both Map sites; the same query without the filter returned 2. The fake id was never
  forwarded to Stripe and **the row was deleted** — a fake account id left in that table would
  poison every future count and could reach Stripe later. **The ordering constraint below is now
  SATISFIED and kept only as the record of why it existed:**
  **NO BUSINESS MAY HOLD TWO STRIPE ACCOUNT ROWS UNTIL ALL 13 CALL SITES FILTER BY MODE.**
  The moment the `mode` migration's step 4 lands — `drop constraint
  stripe_connect_accounts_business_unique` — the schema **permits** something the code cannot yet
  handle: two account rows for one business. The 13 sites that read
  `stripe_connect_accounts` do not filter by mode (`OPEN_FINDINGS` #49 M4 lists them). Two of
  them fail **silently** rather than loudly — `mission_control:133` and `marketplace_ops:173`
  build a `Map` keyed by `business_id`, so a second row is not an error, it just overwrites and
  shows an arbitrary mode's status as the business's status. And
  `stripe-connect-onboard:150` updates `.eq("business_id", …)` unfiltered, so it would write one
  mode's capability flags onto the other mode's row.
  **The rule, concretely: after that migration and before the filter work, nobody runs Connect
  onboarding for a business that already has an account row. Today that is exactly two
  businesses — `adrians-lawn-service` (live account) and `evergreen-yard-care` (test account).**
  The window is safe right now only because each holds exactly one row and nothing is trying to
  add a second. **It stops being safe the moment we onboard anyone.** That is why the filter work
  lands **before Bucket**, not after — and why "add the mode column" and "teach the 13 sites to
  filter" are one piece of work with two steps, never two pieces of work.

- **WHEN THIS CODEBASE DOESN'T UNDERSTAND ITS INPUT, IT CREATES A ROW.** Three subsystems, one
  reflex, each invisible until someone counted:
  (1) **`bkNext(3)`** wrote **13 abandoned `booking_requests`** to production because a harness
  stepped a wizard forward — "do not submit" was not "do not write";
  (2) **the old customer resolver** inserted when its lookup ERRORED — `.maybeSingle()` on a
  non-unique column returns `{data:null, error}`, the error was discarded, and "I could not see"
  became "nobody matched" became a new row, forever, for that email (#44);
  (3) **`applyOwnerRecordEdit:4357`** — `if (op === "edit" && id) PATCH; else INSERT`. The `else`
  is every other input, so a service edit with a missing or bogus `op` creates a duplicate
  instead of failing (#52).
  The shape is always the same: **an ambiguous input takes the CREATE branch**, silently, and the
  evidence is a row nobody is looking at. The costs are not symmetric — an unnecessary refusal is
  one annoyed person, an unnecessary row is data corruption that compounds — so **the default for
  input we cannot classify is REFUSE, not create.** That is the same asymmetry argument as never
  discarding a draft, pointed the other way: there, ambiguity must preserve; here, ambiguity must
  not fabricate. Before writing `else { insert }`, ask what reaches that branch that you have not
  named.
- **The typecheck is PARTIALLY usable, not fixed, and must not be described as fixed.** 2026-09-06:
  129 → 40 distinct errors in customer-facing code (20 removed type-only, 69 parked with the
  Adobe exclusion, #53). **22 of 53 functions still fail**, so it is still not usable at full
  width and still catches nothing it is not specifically pointed at. The remaining 40, by file:
  `hubly_capability_registry.ts` (6 — #52), `mission_control.ts` (8), `page-view/index.ts` (5),
  `google-calendar-connection/index.ts` (3), `marketplace_match.ts` (3), `hubly-conversation`
  (3), `hubly_brain_platform.ts` (2), `hubly_brain_builder_expert.ts` (2), `studio-api` (2), and
  four singletons. Also filed and deliberately unopened: **60 `as any`** across edge functions —
  a bigger question than one evening.

## ⬅ TOMORROW STARTS HERE (written 2026-09-06, end of a nine-hour day)

**TOP ITEM, ahead of the flip to live and ahead of #46: service data has THREE homes and the
management UI reads the wrong one. `OPEN_FINDINGS` #54.**

**Bucket is in the database right now with 4 services in `meta.service_catalog` and 0 rows in the
`services` table** — the same position as Graef, who has 8 and 0. Both are market businesses, both
are claimed, and Bucket is the head-to-head against Base44. Their live pages show their services;
their management panel shows a blank Services section with an add form and no explanation.

**The decision is NOT made.** Three writers for one concept is a source-of-truth call made once,
and it was deliberately not made at 9pm. What exists is the measurement that should make it cheap:

- **M1 — the merge is trivial for the two that matter.** Graef 8/0, Bucket 4/0, cotter-aviation
  2/0: the table side is EMPTY, so there is nothing to reconcile, no competing names, no diverging
  prices. Exactly one business has a real conflict (`adrians-lawn-service`, 5 catalog vs 9 table)
  and it is a **test** account.
- **M2 — the readers are 13-ish vs 3, and the intuition inverts.** `meta.service_catalog` is read
  through `_shared/service_engine.ts`, imported by **eleven** files including `booking_price.ts`,
  `booking_job.ts` and `create-booking-checkout` — **the catalog is what booking and pricing
  read**. The `services` table has **three** readers: the manage panel, the editor, and one AI
  summariser. The panel is the minor home, not the real one.
- **M3 — two owner-facing false promises**, both the `not_freeform` fallback in
  `hubly_capability_registry.ts` (`:4365` "it will appear on the next rebuild", `:4347` "may still
  show on the page until the next rebuild"). Both are false for a meta-only business. The removal
  one is worse: it says a deleted service is still public and will stop being public on its own.
- **M4 — the cheap fix is ~6 lines and is a trap on its own.** Reading the catalog in
  `hcReadRecord` makes the panel display correctly while every save still writes the table nothing
  reads. That turns a visibly broken panel into a silently lying one. It is only viable as
  read-AND-write, which is the decision, not a patch.

**The design is written and NOT built — `OPEN_FINDINGS` #57.** Two moves: (1) `service_engine.ts`
becomes the single WRITER as well as the single reader, with optimistic concurrency on
`service_catalog.version` so a colliding write is REFUSED and reported rather than silently
losing one; (2) storage — stay on `text`, migrate `meta` to `jsonb`, or promote the catalog to a
real table — deliberately not chosen, because Move 1 makes it non-urgent.

**CAS on the whole `meta` text is the right guard and CANNOT be done by URL filter — measured.**
A PostgREST `.eq()` value travels in the query string and dies between **24,000 and 26,000
characters** (as a bare `Bad Request`, not a clean 414). **5 of 178 businesses exceed that, and 4
are market**: bucket-mobile-detailing **515,856**, devdetailing661 178,500, graefs-autocare
46,254, aquaspeed 30,341. It fails exactly where #54 lives. **The variant that works is hash-CAS
in an RPC** — guard on `md5(coalesce(meta,''))`, a 32-char value in a POST body — which keeps the
whole-blob semantics (all 11 writers seen) with no column, no `jsonb` migration and no valid-JSON
precondition. **With that, Move 1 closes #54 rather than narrowing it, and Move 2 is optional.**
Not adopted yet: it needs a re-read-and-merge path in `hubly.html`'s 9 whole-meta writers, or CAS
just trades silent loss for a refusal that also drops the owner's typing. **Size that before
adopting.**

**Bucket's public page ships 522KB per visitor, 95% base64 (#60).** Not in the HTML — in the
`get_public_business` API payload every visitor blocks on before first paint, on the site being
compared against Base44. Two writers cause it: `handleProfileHeroImage`/`handleProfileSheetImage`
(`hubly.html:35628`/`:35654`) store `FileReader` base64 straight into `meta` and **have no Storage
path at all**, while the repair pass at `:30800` covers logo/banner/ownerPhotoUrl and **not those
two fields**. `hostBrandImage` already exists and already retries — **the code fix is ~1 hour**,
and the cleanup is **6 images across 3 businesses**, self-healing on next save if the repair pass
is extended.

**DECIDED 2026-09-06 — NARROW.** Certain before unmeasurable: the service failure reproduces every
time for both Graef and Bucket; the meta race is real but has never been counted and *cannot* be,
because a lost update leaves no trace. Unmeasurable is not rare, and that is not being pretended.

> ### 📌 DATED EXPOSURE — accepted 2026-09-06, owed
> **NARROW leaves `hubly.html:33503` (post-render `persist`) and `hubly.html:45783`
> (`persistPipelineSoon`) doing blind whole-blob `meta` writes that can overwrite a service edit.**
> Same exposure as today in kind, with **more traffic on the contested blob**, because service
> writes move from a quiet table into the blob those two contest.
> **Accepted: 2026-09-06. Owed: the CAS gate applied to both sites (#58), which is the 1–2 day
> half of FULL.** This is a decision that was made, not a thing that was forgotten — if it is
> still open when the meta race is next discussed, it was chosen on this date with the exposure
> written down.

**Move 1 priced both ways (#61): FULL 2–3 days closes the meta race; NARROW 1 day gives Graef and
Bucket a working services panel and two honest strings.** NARROW leaves the two autosave sites
able to clobber a service edit — **the same exposure as today in kind, but with more traffic on
the contested blob**, since service writes move from a quiet table into the blob those autosaves
contest. Not chosen. If NARROW is picked, the autosave pair needs a dated entry, not a "later".

**THE GATE (adopted): no write site adopts CAS until it can survive a refusal without losing the
user's input.** Sized — of the 9 whole-meta writers in `hubly.html`: **2 are inserts (exempt), 5
are explicit-save (cheap — re-read and tell the owner), and 2 are AUTOSAVE-shaped** (`:33503`
after a preview render, `:45783` `persistPipelineSoon`, a debounced timer). The autosave pair is
the whole cost: nobody is watching, so a refusal has no dialog and the in-memory edit is the only
copy — each needs a key-scoped read-merge-rewrite loop. **Move 1 is 2–3 days, not one.** And
adopting CAS on only the cheap 7 would leave the most frequent writer as the one that can still
clobber — the same bug with fewer witnesses. `md5` is deliberate (accidental-collision detection,
not forgery defence) and should not be "upgraded" without naming a threat.

**Two things found while designing that change the shape of the work:**
- **The only server-side catalog writer cannot succeed.** `businesses` has **no `updated_at`
  column** (57 columns, `created_at` only), and `marketplace/index.ts:1543` — the live
  `lite_services_save` route — sets it on every write, so PostgREST rejects the update and the
  handler 500s. The same bug sits on the hours write at `:2014`. Production catalogs were written
  by the CLIENT, not by this. Read from code and schema, **not yet confirmed by a request**.
- **The race is wider than services.** `meta` is `text`, so every write replaces the whole ~40-key
  blob — **9 whole-meta writes in `hubly.html` plus 2 server-side**. A service edit can discard a
  storefront edit. Move 1 narrows the race to one key; only Move 2 removes it, and the designed
  invariant check would go **green on a codebase that still loses service edits**. That limit is
  written into the check's own header.

**Tomorrow starts with: decide which home is canonical for service data — knowing the catalog owns
booking and pricing, the table owns the two UI surfaces, and for Graef and Bucket a merge is a
copy rather than a reconciliation.**

Also open and deliberately untouched: #55 (`commerce_products` IS single-home, so #46's Store can
be designed against it), #56 (generation wrote every service twice in an 8-second burst, nine
months unnoticed), #52 (the `else`-inserts service edit, latent), the webhook secret split (#49
M7), and the 18 functions still missing the API-version pin (#51 — dashboard knob stays frozen).

**Today landed, all verified:** the customer identity resolver (#44, one resolver, deployed to 8
functions, V1–V5 green); `stripe_connect_accounts.mode` (migration + 13 filter sites + synthetic
two-row proof, deployed to 6); and the Stripe API version pinned in the repo at
`2026-08-26.dahlia` (deployed to 4, CHECK 4 guards it).

## The anchor-pattern discipline (the through-line)

A freeform page has no async update path, so any fact a later change must touch is stamped
with an anchor at generation, placed by it afterward, inserted into the section when
absent, with a countable row and a read-back. Never re-recognise layout after the fact;
never offer a suggestion whose action can't reach the page; never write a fact not grounded
in the current message.
