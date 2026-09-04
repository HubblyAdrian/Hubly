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

## THE FAMILY OF TRAPS — eight now, so learn the pattern, not the anecdotes

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
  the next writer.

## The anchor-pattern discipline (the through-line)

A freeform page has no async update path, so any fact a later change must touch is stamped
with an anchor at generation, placed by it afterward, inserted into the section when
absent, with a countable row and a read-back. Never re-recognise layout after the fact;
never offer a suggestion whose action can't reach the page; never write a fact not grounded
in the current message.
