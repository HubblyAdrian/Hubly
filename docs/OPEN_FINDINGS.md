# Open findings — Adrian's 2026-08-28 phone run

## 10. Every generated page is ~6 phone-screens tall (public site) — SEPARATE BUILD

**Severity: high — this is the PUBLIC site, what a customer sees when they tap the
link.** It outranks the shell's mobile problem (that's the owner's view; this is the
customer's). Found 2026-08-31.

**Numbers, measured at a true 390px viewport (in a 390px iframe, images loaded):**

| page | height | screens (÷844) |
|---|---|---|
| Mobile Auto Detailing (market) | 5154px | 6.1 |
| b53382a2 (market) | 5267px | 6.2 |
| 06541aeb (test) | 4959px | 5.9 |
| 0e278d4c (test) | 5386px | 6.4 |
| 11151dc5 (test) | 5334px | 6.3 |

Consistently **~5,000–5,400px, about 6 full phone-screens**, across market and test.

**Cause — NOT broken responsiveness.** Pages carry real breakpoints (1–2 `@media`,
several `max-width`, `clamp()` type, collapsing grids), so the mobile layout is
technically responsive. The length comes from **generously sized stacked sections** —
near-full-height blocks, a big hero, roomy padding — roughly one full screen per
section. And the **generation prompt says nothing about page length or density at
phone width**: its only two mobile rules are `svh` for full-height sections and
landscape hero photos (`hubly_capability_registry.ts` ~1770-1771). There is no
guidance to bound section height, tighten vertical rhythm, or cap total scroll on a
phone.

**What a fix would examine (not now):** a mobile density pass (cap full-height blocks
to content height on small screens, tighten section padding, shorten the hero) and/or
explicit prompt guidance on phone-width length. Verify by re-measuring the table
above and by a real-phone read.

---


Bugs Adrian hit on a real iPhone (Safari) that are **not yet fixed**. Each entry:
what's known, what's been tried, what would close it. The rule that produced this
list: everything here passed a mechanical check and failed a human one — so
"verify by doing it, on a phone-width render" is the close condition for all of
them, and Claude Code cannot run Safari, so Adrian is the mobile test.

Context for the whole list: on 2026-08-28 the editing model changed — **nothing on
a generated page is editable until it is claimed** (see `hcEdit` vs `hcEditable`
split in `platform-home.html`/`hubly.html`). That closed the tap-to-edit trap and
four sub-bugs. The items below survive that change.

---

## 1. Back button → a different site: classic template, editor-only text, fabricated hours

**Severity:** live damage (public-facing), currently contained.

**Symptom (Adrian):** pressing the browser Back button lands on the SAME URL but a
completely different page — the classic template, showing editor-only placeholder
copy ("Add contact info in the editor", "Add your location to show the map") and
business hours **Mon–Sun ~8:00–5:00 that nobody entered**.

**What's known:**
- No stored document contains any of that text or those hours — it is rendered
  **on the fly**, not saved. Confirmed: 0 of all `business_documents` match the
  editor strings or the 8–5 pattern.
- **No market business is currently serving it.** All 7 `account_kind='market'`
  businesses' latest docs are freeform (`format='html'`); the editor strings are in
  0 stored docs. So the live exposure is a render-time artifact, not saved data.
- Mechanism: `api/router.js` serves `public/hubly.html` for every
  `{slug}.myhubly.app`; hubly.html resolves the business **client-side**
  (`loadPublicProfile`). It renders freeform correctly in the normal case, but has a
  **classic-template fallback** that emits the editor placeholders
  (`wsAddContactInfo` @ hubly.html:50557, `wsAreaAddLocation` @ :50546) and
  **fabricated default hours** (`S_hours = S_hours || {Mon–Sat 8–5, Sun 9–5}` at
  hubly.html:18101, :35833, :52272). Those are the exact things Adrian saw.

**What's been tried:** could not reproduce the Back trigger from Claude Code's own
navigation (history just returns to the marketing home). The fix lives in the
52k-line legacy `hubly.html`; editing the hours default or the placeholder render
blind risks breaking the *editor*, which legitimately uses those defaults in its
hours popup.

**What would close it:**
1. Adrian reproduces Back → the broken page and reports **the URL in the address bar
   when it shows**, and whether he was on his **live site** or the **builder** when he
   hit Back. That pins the exact fallback path in `loadPublicProfile`.
2. Then two surgical gates: (a) editor placeholders must render only in the editor
   (behind `hcEditable`/owner-authed), never in a public/preview view; (b) the public
   render must show **no hours** when none were entered — never the fabricated
   default. Verify by rendering the reproduced URL before/after.

---

## 2. Second layout-collapse variant the `li` net doesn't catch

**Severity:** cosmetic but "embarrassing page to send a customer."

**Symptom (Adrian, phone):** a text stacks one word per line — "Request / a / time" —
a different structure from the numbered-steps `li` case already fixed.

**What's known:**
- The fix already shipped (`fixCollapsibleGridColumns` in
  `hubly_capability_registry.ts`) covers ONE variant: a grid `<li>` whose single
  child crams into a narrow fixed number-column
  (`:where(li,dd,dt)>*:only-child{grid-column:1/-1}`), plus a bare-`fr`→`minmax(0,fr)`
  floor. It does NOT cover this second case.
- Adrian named the invariant to build: **"a grid with fewer children than columns
  makes its children span"** — the structural generalization, not a third selector.
- Measurement caveat learned the hard way (2026-08-27, now in CLAUDE.md): **measure
  with images LOADED**. Aborting images makes an `<img>` fall back to its width
  attribute and manufactures min-content collapses that don't happen on the real
  page — a whole false-positive sweep came from that.

**What's been tried:** the `li`-only-child fix (verified on the detailer "Book it"
section, images loaded: text 38px→474px). The "Request a time" variant has NOT been
reproduced or measured yet.

**What would close it:** reproduce "Request a time" stacking on a real page with
images loaded; read the offending element's grid host + child count; implement the
general "grid item count < column count → the items span" invariant deterministically
(post-process or appended CSS); re-render and confirm 0, and confirm it changes
nothing on a correctly-rendered page (Adrian's test: does it alter a good page? if
yes, too broad). Harness: `scripts/hero-fold-audit/measure_squeeze.js` (images now
loaded), and `test_fix.js` for before/after.

---

## 3. Prices are never read back — CLOSED 2026-08-28

**Closed by the item-7 seam.** `servicesTruth` now composes the acknowledgement from
the actual patch result and enumerates every service + price: verified live —
"Cold brew $8, Pour-over $6 and Breakfast tacos $4 are on your page now, in the
services section." A wrong digit is now visible in the read-back before it's live.
(Photo-OCR read-back still wants its own confirming pass, but the setServices path —
typed or from the loop — reads every number back.)

**Severity:** correctness / trust — OCR misreads digits and the read-back is the only
safety net before a wrong price goes live.

**Symptom (Adrian):** after setting prices, Hubly says "Done — I've set those prices"
**without naming a single one**.

**What's known:**
- The prompt (`hubly-conversation/index.ts`, the SERVICES section ~L528) already
  says to read prices back plainly ("Full detail $175, interior only $110 — done").
  So either the model isn't following it, or the acknowledgement is being composed
  somewhere that drops the numbers (client interim line vs model reply — the
  two-composer family; see finding #4).
- Price-list PHOTO OCR (`hcExtractPricesFromImage` → `import-offers`) is the path most
  at risk of a misread digit; the read-back is its only catch.

**What's been tried:** nothing this session.

**What would close it:** confirm which surface says the "Done" line (model reply vs
client interim — grep `platform-home.html` for the interim confirmation on a
setServices turn). Make the acknowledgement enumerate **every service and price**
("Sourdough $8, morning buns $4, custom cakes from $60 — done") so a wrong digit is
visible before it's live. Verify by setting prices (typed AND via a price-list photo)
and confirming every number is echoed.

---

## 4. Two "Done" messages for one action

**Severity:** polish, but persistent (already logged in KNOWN_ISSUES 2026-08-27).

**Symptom:** one action draws two acknowledgements — a client **interim** line
("… — done.") and the model's **reply** ("Done — those services are on the site
now."), both narrating the same capability result. Same two-composers shape as the
account-offer double-speak.

**What's known:** `interimMessages` vs `data.reply` split in `hubly-conversation` /
`showNext` in `platform-home.html`. Already an entry in `docs/KNOWN_ISSUES.md`.

**What's been tried:** nothing this session (logged only).

**What would close it:** one acknowledgement per action — suppress the client interim
confirmation when the model's reply already acknowledges the same action (or
vice-versa). Verify on a setServices turn: exactly one "done" line. Likely fixes the
enumeration point in #3 at the same seam.

---

## 5. "On the site now" doesn't say WHERE — CLOSED 2026-08-28 (desktop); mobile note stands

**Closed by the item-7 seam for services.** Every services acknowledgement now names
the place — "…are on your page now, **in the services section**" — and says so only
because the patch put them there. Verified live. The photo path already did this; the
two highest-frequency "it's on your page" lines (photos, services) now both name the
location. The mobile separate-tab reality (a change is real but on another tab the
person isn't looking at) is a UX point that still wants a real-phone pass, but the
dishonesty of a vague "on the site now" is gone for services.

**Severity:** polish / honesty, mobile-specific.

**Symptom (Adrian, phone):** Hubly says a change is "on the site now" but not where —
and on mobile the site is a **separate tab**, so "now" points at nothing the person
can see.

**What's known:** on desktop the preview is beside the chat; on a phone the builder
and the site are different tabs, so a bare "on the site now" is a claim about a
surface the person isn't looking at. The photo-placement path (FIX 4, 2026-08-27)
already learned to say WHERE ("in the feature section, in place of the stock photo") —
the same discipline needs to extend to every "it's on your page" acknowledgement, and
account for the phone's separate-tab reality.

**What's been tried:** the photo-placement confirmation does this correctly; other
acknowledgements don't.

**What would close it:** every "it's on the page" line names the place, and on mobile
either shows the change inline or tells them how to see it without implying it's
visible right now. Verify on a phone-width render / real phone.

---

## 6. Only one photo can ever be sent

**Severity:** functional — blocks the "3 photos in 157 pages" fix from compounding.

**Symptom (Adrian):** the work-photo ask arms once; after the first photo, a second
attached image has nowhere to go.

**What's known:**
- The ask is armed via `pendingCapture.askedFor='photos'` (set when the model asks,
  once). After the first photo lands, nothing re-arms it, so a second attached image
  falls through the funnel (`hcHandleIncomingFile` in `platform-home.html`) —
  services-pending → price OCR, or nothing-pending → the hold-and-ask, but not a
  second work photo onto the page.
- Placement itself supports more than one (portfolio_photos is a pool; the resolver
  claims work-role markers first, then atmosphere). So the block is the *ask/route*,
  not storage or placement.

**What's been tried:** FIX 2 (2026-08-27) built the single-photo front door and
verified it; multi-photo was out of scope.

**What would close it:** let a second (and third) photo route to storage+placement —
either re-arm the photo ask after each success, or make the hold-and-ask offer "add
this as another work photo" for a subsequent image. Verify by sending two photos in
one session and confirming both land on the page.

---

## 7. VERIFIED: service NAMES reach a freeform page (baked at build); PRICES set AFTER the build do not

**Severity:** correctness / trust — the acknowledgement says a change is "on the site"
when, for anything set after the first build, it is not.

**The answer, with evidence (investigated 2026-08-28):**

- **(a) Do services render on a freeform page at all? YES — the names, at build
  time.** The freeform generator reads services from the record
  (`buildBusinessRecordBlock`) and the model bakes them into the single generation.
  Visual proof: `dawn-patrol-coffee.myhubly.app` renders three service cards — Cold
  brew, Pour-overs, Breakfast tacos — exactly the three named before the build.
  Corpus: across freeform pages whose business has services, **35/42 (83%)** have
  the service names present in their stored HTML.

- **(b) What happens when services/prices are set AFTER the build? The RECORD is
  written; the stored HTML is NOT.** `setServices` calls the
  `set_business_draft_services` RPC (record only) and returns a spoken "now shows N
  real services" — but it runs no HTML patch. Live proof on the same dawn-patrol
  build: prices given after the build (cold brew $5, pour-over $6, tacos $4) were
  read back and acknowledged, but **do not appear on the page cards** (the cards show
  the baked descriptions, no prices). This is the "freeform pages have no update path"
  gap biting a core capability: a `services` recordChange returns `not_applicable` on
  a freeform rebuild. Corpus: only **11/42 (26%)** of those pages have any price text
  in their HTML — the prices set post-build never landed.

- **(c) Does the Book page show them? YES — it reads the RECORD, not the page HTML.**
  The booking landing queries the `services` table directly
  (`db.from('services')...` at hubly.html:15189) and renders `#bkland-services`, so
  services set after the build ARE bookable even though they're invisible on the
  freeform page.

**Net:** the acknowledgement "those services are on the site now" was true for the
NAMES generated at build and true for the BOOK page, but false for the freeform page
when a price/service was set or changed after the initial build. Same shape as the
photo gap that FIX 1–4 closed (2026-08-27).

**FIX — built + deployed 2026-08-28 (mirrors the photo ladder; closes #3 and #5,
one seam):**
- `markServiceHeadingsInFreeform` — a generation-time pass in `generateFreeformPage`
  stamps each service heading `data-hubly-service="<name>"`, the reliable anchor for
  later price patches (the way the hidden photo slot was added).
- `placeServicesInFreeform` ladder in the `setServices` handler, run synchronously
  like `uploadDraftPhoto`: (1) a `data-hubly-price` span a prior patch wrote → update
  its text; (2) a marked or plain service heading → place the price with it
  (text-match covers the ~83% of existing pages with names baked in); (3) name not on
  the page → `missing`, the honest rebuild offer, never a forced card. A scored
  matcher prefers real headings over inline `<strong>` and penalises hero/nav/footer,
  so a price never lands in the hero sentence.
- `servicesTruth` (#3, #5): the reply is the ACTUAL placement — "Cold brew $7 … are on
  your page now, in the services section" — names + prices + where, true only because
  the patch happened; if a service isn't on the page it says so and offers the rebuild.
- Loud + countable: a price that saves and doesn't appear is a `services-placement`
  row in `record_rebuild_outcome`, never a silence.

**CLOSED — verified live end to end 2026-08-28** (on the existing dawn-patrol-coffee
freeform build, changing prices by talking):
- **Page updates with the new figure, in the right card.** Rendered the stored doc:
  the menu section shows Cold brew **$8**, Pour-overs **$6**, Breakfast tacos **$4**,
  each price under its heading in its own card.
- **Read-back names prices + where, true because the patch happened:** "Cold brew $8,
  Pour-over $6 and Breakfast tacos $4 are on your page now, in the services section."
- **Second change updates in place:** cold brew $7 → $8 left exactly one
  `data-hubly-price="Cold brew"` span (value $8), no duplicate.
- **Countable:** two `services-placement` rows in `rebuild_outcome_events`,
  `landed=true` — one `placed`, one `partial` whose `detail` names the missed service.
- **The case that must not work:** a `cortado` with no card was reported honestly
  ("I couldn't find Cortado on the page as it's built … want me to rebuild") and
  never forced — no `data-hubly-price="Cortado"` anywhere in the HTML.
- **Hero/footer check:** all three price spans sit inside `<section id="menu">`
  (`section.1.item.N.title`); none in a hero, header, or footer element.

Two robustness fixes came out of the run:
- **Singular/plural drift** — the model re-sends "Pour-over" vs the page's "Pour-overs";
  the matcher now tolerates trailing punctuation and a plural 's' (commit d96daf7),
  and a TRUE exact match always outscores a normalised one so "Wrap"/"Wraps" don't
  collide.
- **Drift-duplication** (found by the 2026-08-28 re-verification, commit 4f666fe) — the
  existing-span lookup keyed off the model's spelling, so a spelling change nested a
  second `data-hubly-price` span on one card. The span is now keyed off the page
  HEADING TEXT and the lookup is bounded to the card, so a card carries exactly one
  price span however the model words the name. Verified live: two "Pour-over" turns
  onto a "Pour-overs" card → one span, `nested=false`.

**Caveat on the closure — the OWNER view is proven, the PUBLIC view is not.** Every
render above is the stored document as the OWNER sees it in the builder (draft-token
path). A public visitor to an UNCLAIMED draft gets "This page isn't live yet" — drafts
are private until claimed. So "a visitor sees $8" is NOT proven here and can't be on an
unclaimed draft (Claude Code can't claim — account creation is prohibited). The public
serving path itself works (a claimed site renders publicly) with ~0 staleness (the
`hubly.html` shell is `max-age=0, must-revalidate`; the document is a POST-RPC read,
uncacheable). Confirming a placed price on the PUBLIC URL needs a claimed site and a
real phone — Adrian's to do.

---

## 8. Price patch doesn't cover list-menu rebuild layouts — CLOSED 2026-08-29

**The loop:** the item-7 patch anchored on a HEADING, but "rebuild around the full list"
often renders the menu as LIST ROWS (`<li><span>Cold brew</span>…`) where the name is in
a `<span>`. So a price change after a rebuild falsely missed and offered ANOTHER rebuild
— a one-way door: accept once and you lose changing prices by talking, forever, while
Hubly keeps offering the thing that already failed.

**Fixed at the source — a build-time anchor, not a matcher per layout** (commit
`125168c`, `48918b2`):
- `markServiceAnchorsInFreeform` (build): stamps `data-hubly-service` on the service-NAME
  element whatever its shape (`<h3>`, `<dt>`, `<li><span>`, a `<td>`) via a shape-agnostic
  LEAF finder. Keyed off the element's OWN text, so drift-duplication can't return through
  a new shape. This is the ONLY place layout is reasoned about.
- `placeOneServicePrice`: PRIMARY path reads the anchor (`findServiceAnchor`) and places
  the price relative to it — never a heading pattern — so every layout is one code path.
  The window no longer stops at `<strong>`/`<dt>` (in a list row the price IS a `<strong>`),
  so it updates the existing price instead of injecting a duplicate.
- LEGACY fallback kept and marked (`findServiceHeading`, for pages predating the anchor
  pass); `via` (anchor|legacy) is recorded per placement and the `services-placement`
  row's `detail` carries `paths anchor=N legacy=N` so we can watch legacy fall out of use.

**Verified live on a rebuilt LIST-MENU (the exact #8 case), dawn-patrol v11→v13:**
- rebuild stamped **4 anchors on the `<li><span>` rows**;
- "set the cold brew to $15" landed in the RIGHT `<li>`:
  `<li><span data-hubly-service="Cold brew">Cold brew</span><span><span data-hubly-price="Cold brew">$15</span></span></li>`;
- read-back named it; the rendered price list showed **Cold brew $15**;
- a drift turn ("the cold brews are $16") updated **in place** — the rendered list showed
  **Cold brew $16**, one span, `nested=false`, no duplicate row;
- both rows in `rebuild_outcome_events`: `paths anchor=4 legacy=0`, `landed=true`.
- Also verified a HEADING-shaped rebuild (v7→v9) still works: anchor lands on the `<h3>`
  not the hero mention, price updates in place, `paths anchor=4 legacy=0` — the thing that
  already worked was not broken.

**What that verification actually covered — read this before trusting it (added 2026-08-30).**
Every check above was run on **dawn-patrol**, and a corpus sweep on 2026-08-30 found that
dawn-patrol was the **only 1 of 116 freeform pages** carrying a service anchor at all — and it
carried one only because the *insert* path had stamped it, never generation. The build-time
anchor pass reads `record.services`, which is empty at generation (turn 1 is
startDraft→generateDocument; setServices lands on turn 2), so it has always stamped an empty
list. The mechanism was therefore **inert on every other page in the corpus, including all three
market pages** — the placement logic was correct but had nothing to bind to. This does not undo
#8: the anchor design and the placement paths are right. It records that "verified live" here
meant "verified on the single page in the corpus that happened to be anchored," which proved less
than it read. Two fixes closed the gap (2026-08-30, commit 07e4c92): a **retroactive patch-time
stamp** so an already-built page gets anchored when services arrive (proven live on summit:
`retroAnchored=3 paths anchor=3`, v1→v2 patch, three prices rendered), and **services extracted
in the same model pass as the rest of the record** so a fresh build has structured services
*before* generation and the pass finally has something to stamp. The `services-placement` row now
also carries `retroAnchored=N`, so the share of pages reaching placement unanchored is measurable
as it falls, rather than assumed to be zero.

---

## 9. The market corpus cannot verify hours/contact placement — records and pages are disjoint

**Found 2026-08-31, Gate 0 of the hours+contact placement build.** Counts split by
`account_kind` (the standing denominator rule). Market N=7, test N=133, internal N=3.

**Record-level coverage (non-null):** market phone **3/7**, email **4/7**, hours **0/7**,
address **0/7**. test phone 69/133, email 10, hours 20, address 1.

**The blocker:** on the 7 market businesses the record and the page are **disjoint** — the
4 with contact facts have **no freeform page at all**; the 3 with a freeform page have
**empty records** (no phone/email/hours). There is not a single market business where
"record has the fact, page is missing it" can be shown, so **the market corpus cannot
verify this build.** Verification uses the **test** corpus instead: the **9** test pages
that have hours in the record but not on the page (place-into-existing-page path across
layouts we didn't author), plus **evergreen** (empty record → set-by-talking end to end).

**Not a services-style extraction gap.** All four facts are already in extraction (phone/
email as Tier-A patterns, hours/address as required Tier-B schema keys) and all four have
working writers (`applyExtractedFacts`; test proves the pipeline fires: 69 phones, 20 hours
on the record). The emptiness is **gathering**, not schema — hours/address are rarely
volunteered and Hubly never asks. Decision (Adrian, 2026-08-31): the ask is the **post-claim
Home suggestion**, not a new pre-claim generation question — build the page's acceptance and
the suppressed "Set your hours" / "Add a phone number" suggestions turn back on.

**Page-side today:** phone is essentially already placed at generation (test: page has the
phone **57/58** times the record does, via `tel:`→`contact.phone` label). Email/address are
recorded but the model rarely writes them (mailto 1/114) and there's no insert path. Hours
have no anchor, no label (the `hours` token was removed 2026-08-22), and no page home at all.

**Update: the "9 pages missing hours" premise was WRONG — all 9 actually show hours
(2026-08-31).** The per-page scale run (`hubly_contact.ts` `placeContactHoursInFreeform`)
exposed two things the console-only check had hidden:
1. **The SQL that found the 9 undercounts.** It looked for `hours…(am|pm|:digit)` and so
   missed every page whose schedule uses non-time values ("Closed", "Call for hours") or no
   weekday names at all ("Open daily, 7am to 4pm"). Re-checked with two independent signals
   (≥3 weekday names OR a short "Hours"/"Schedule" heading), **9 of 9 already display hours.**
   The corpus genuinely missing hours-with-record is ~0. The build's real value is the insert
   path for pages with NO hours at all (the common POST-build case, hours arriving via the
   Home suggestion) plus the dedup that stops duplicates.
2. **The retro-stamp+rewrite of a model-authored hours list was unsafe and is REMOVED.**
   First cut retro-stamped an existing hours container and replaced it in place. It failed two
   ways, both caught by rendering (not console): (a) it swapped the model's *styled* `<ul
   class="hours">` for a bare `<dl>` outside the block's scoped CSS — an unstyled, misaligned
   list mid-page, and it could contradict the rest of the page (card "Closed" vs hero "Open");
   (b) the recognizer's guard let a **footer `<ul>` mixing address + phone + "open daily"**
   through, and the whole-element replace **destroyed the address and phone** (Tidepool
   Coffee). The only reliable hours anchor is the one stamped on our OWN inserted block;
   a model-authored schedule is now left untouched, recorded as a countable `missed`, and
   (pending) offered a consent-based rebuild. Never a silent rewrite.

**The general pattern — a heuristic that matches ONE encoded form undercounts the fact in
other forms.** Third instance now: (1) the freeform **anchor count** (services present as a
heading one build, a `<li><span>` the next — finding #8's "verified on the 1 anchored page of
116"); (2) the **price scan** (`11/42` "had prices" only counted a `$` in the HTML, missing
priced services rendered without the symbol); (3) this **hours-schedule detector** (formatted
times vs "Closed"/"Call for hours"/"open daily"). The rule: when a SQL/regex heuristic reports
"N pages have/lack X", it is counting a *form*, not the *fact* — state which form, and expect
the count to move once another form is included. A number about a fact needs the fact's forms
enumerated, the same way a ratio needs its denominator.

**Right-population verification (2026-08-31).** The insert path's real population is the
INVERSE of the 9: pages generated with NO hours on record (the prompt forbids printing hours),
where hours arrive later via the Home suggestion. Re-run on **24 such pages (3 market, 1
internal, 20 test): 23 clean inserts, 0 leaks, 0 duplicate sections.** The one non-insert
(market `c003cc48`) is a page where the model **invented a `mon–sun` schedule despite "none on
record"** (the invented-hours scar) — correctly left alone as a countable miss. Rendered on
three distinct layouts incl. a dark-theme market page; the block inherits palette/type
correctly. One robustness fix came out of it: hours dashes are emitted as `&ndash;` entities,
not raw U+2013, so a page WITHOUT a `<meta charset>` renders "Mon–Fri" instead of mojibake.

### DESIGNED-BUT-UNBUILT: the "hours already shown" offer (do not silently decline)

When the owner sets/changes hours and the page already shows a schedule we can't safely anchor,
the current behaviour is an honest **`missed`** — we save the hours to the record and say the
page already shows a schedule. **That decline is safe but not sufficient, and its real severity
must be named: the page is now displaying hours that are WRONG.** The owner updated their hours,
we stored them, the site keeps showing the old ones — a customer drives to a closed shop. That
is worse than absent hours, not a cosmetic gap.

The fix (deferred, not built — needs its own build):
- **NOT a rebuild.** A full regenerate to change two lines is disproportionate and discards
  accumulated edits (the destructive-rebuild we retired). 
- **A confirmed target.** The offer quotes the page back and asks:
  *"I've saved your hours. Your page currently shows Wed–Sun — Closed. Your hours are now
  Mon–Fri 7 AM–6 PM. Want me to update that section?"* The owner's **yes** is what converts our
  guess about which element to touch into a target a human confirmed — the exact guard the
  recognizer lacked. On the Tidepool footer the quote-back would have read "Astoria, Oregon /
  Open daily 7am–4pm / 503-555-7781" and been obviously wrong to the owner before anything moved.
- **Carry the yes with the click-action primitive** (`hcAttachMessageAction`), NEVER natural-
  language parsing across turns. Consent is the click; no click, no change, and we don't
  re-offer.

---

## 11. The anchor pass stamped a service anchor on ANOTHER card's description — RECORDED, NOT FIXED

**Found 2026-09-02, live on evergreen, while adding "Leaf Removal" through the Edit-details
panel.** This is the anchor system failing in the exact way it exists to prevent, so it is
written down in full rather than patched in passing.

**What is on the live page (document v16), verbatim:**

```html
<h2 data-hc="hero.item.3.title" data-hubly-service="Seasonal Cleanup">Seasonal Cleanup</h2>
...
<p data-hubly-service="Leaf removal and a full bed cleanup." data-hc="hero.item.3.body.3">Leaf
   removal and a full bed cleanup.</p>
```

Seasonal Cleanup's **description paragraph** now carries a `data-hubly-service` anchor. It was
stamped by the retroactive pass (`markServiceAnchorsInFreeform`, run from
`placeServicesInFreeform`) when the new service **"Leaf Removal"** arrived: the paragraph's own
text *begins with* "Leaf removal", and the finder accepted it.

**Why it matters more than its current blast radius.** Today it is inert — the anchor is keyed
off the ELEMENT's text, so its key is the whole sentence, and no service is named "Leaf removal
and a full bed cleanup.", so no lookup resolves to it. But:
- `allServiceAnchors` now returns a paragraph as if it were a service entry. `insertService
  IntoFreeform` uses `anchors[0]` as the clone TEMPLATE and `anchors[last]` as the append point;
  on a page where a stray anchor lands first or last, a future insert clones a paragraph or
  appends in the wrong place.
- The whole point of the anchor (finding #8) is that layout is reasoned about **once**, at
  stamp time. A prefix/contains match at stamp time puts the guessing back in, one level up —
  and a wrong anchor is worse than no anchor, because placement trusts it absolutely.
- It fires precisely when a new service's name echoes wording already on the page, which is
  common ("Leaf Removal" on a page that mentions leaf removal; "Detailing" on a detailer).

**What would close it:** the stamp must match a service-NAME element, not any leaf whose text
begins with the name — an exact match on `normServiceKey`, with a prefix accepted only when the
remainder is price/dash-shaped (the rule `findServiceHeading` already applies for scoring), and
never onto an element already carrying `data-hubly-desc` or sitting inside another service's
entry bounds. Verify by re-running the add on a page with a description that starts with the
new service's name and confirming zero new anchors on non-name elements. The stray anchor on
evergreen v16 is still there — it is the reproduction.

---

## 12. Evergreen: 5 services on the record, 6 on the page — RECORDED, NOT FIXED

**Found 2026-09-02, as the owner, in the Edit-details panel (which reads the record over
authenticated PostgREST) against the live page.**

- **Record (panel):** Basic Mow 40, Full Service 95, Seasonal Cleanup 220, Spring Aeration 130,
  Gutter Cleaning 150 — **five**.
- **Page (document v15/v16):** Basic Mow, Full Service, Seasonal Cleanup, Spring Aeration,
  **Hedge Trimming $75**, Gutter Cleaning — **six**.

**Hedge Trimming is on the page and not in the record.** Its card is a clone (minified markup,
`data-hubly-service="Hedge Trimming"`, `data-hubly-price="Hedge Trimming"` = $75), so it was
inserted by the placement path at some point and the record no longer holds it.

**Why this is not cosmetic.** `set_business_draft_services` is **replace-all**: every services
write deletes and re-inserts the whole set from whatever list is passed. So the record is the
authority and the page is downstream — except here the page carries a service the record has
never heard of, which means (a) the panel cannot edit or remove Hedge Trimming (it isn't in the
list), (b) the booking landing reads the `services` TABLE, so a customer can see Hedge Trimming
on the site and **not be able to book it**, and (c) the next replace-all write leaves the
orphan card standing. Untested which write dropped it — a candidate is a `setServices` call
that passed a partial list, replace-all deleting the rest, while the cards stayed on the page.

**What would close it:** first establish which direction diverged (does any code path write
services without the full set?), then decide the reconciliation rule — the page is not allowed
to advertise a service the record cannot book. Related: the `service_photos` orphaning already
open under STATE "Still open" has the same replace-all root.

---

## 13. On a phone, a claimed owner cannot reach SETTINGS AT ALL — RECORDED, NOT FIXED

**Found 2026-09-02 by reading the code during the editor/Home survey. Needs Adrian's
on-device confirmation** — Claude Code has no true 390px viewport (the standing rule in
`CLAUDE.md`), so what follows is a code-level fact, not an observed one.

**The two facts, and there are only two:**

1. **`hcOpenSettings` has exactly one caller** — the rail gear, `platform-home.html:4746`:
   `if(railGear) railGear.addEventListener('click', function(e){ e.stopPropagation(); hcOpenSettings(); });`
   There is no other entry point: no menu item, no chat action, no URL, no keyboard path.
2. **The rail is hidden at phone width** — `platform-home.html:318`:
   `@media (max-width:760px){ .hc-app.hc-claimed .hc-rail{display:none} }`

One caller, and that caller is inside the element the media query removes. So below 760px
the Settings popout is unreachable.

**What is behind that door, and therefore also unreachable on a phone:** Sign out (the
`hcSignOut` button lives in the popout's Account section — the account menu on `navSignin`
is the only other sign-out path), the Stripe Connect status pill and both its actions
(Connect Stripe / Open Stripe), the account email, the notification setting, and the site
address. Stripe is the sharpest one: it is already flagged as never proven E2E, and the
only door to it is shut on the device most owners will be holding.

**Why this is a finding and not a styling nit.** It is the same shape as the defects this
codebase keeps paying for — a capability that exists, works, and has no reachable entry
point (`CLAUDE.md`: "look for the missing door before building the room"). Nothing is
broken; the room is fine and the door is painted onto a wall that is `display:none` on a
phone. It also violates prohibition 4 in spirit: the interface changes shape between
widths, and a control that silently vanishes at a breakpoint is exactly a control that
"silently shows up, vanishes, or relocates between states".

**What would close it:** give Settings a second entry point that survives phone width —
the candidate is the canvas toolbar, which is the one claimed-owner surface confirmed to
render at phone width (`#hcManageBtn` is `display:inline-flex` when claimed and lives in
the bar; the mobile Chat/Site toggle drives that view). Whatever the entry, it must be the
SAME `hcOpenSettings` popout, not a second settings surface that can disagree with the
first. Verify on a real phone: claimed owner, 390px, reach Settings, sign out, and see the
Stripe pill — Adrian's to run, per the standing rule.

**Related, same root, do not fix blindly:** the rail also carries the Home/Website mode
switch, so `hc.mode` is not reachable on a phone either; mobile falls back to the
Chat/Site toggle instead, which is a deliberate choice (`platform-home.html:317`, "v1 keeps
the phone on its Chat/Site toggle — a one-item bottom bar isn't earned yet") and is NOT
part of this finding. Only Settings has no fallback at all. Note the earned-only bottom-bar
rule (`CLAUDE.md` prohibition 5, max 4 places on mobile) constrains any fix here.

---

## 14. The storefront capability is invisible to the model in the claimed shell — and the
## obvious one-line fix makes it WORSE. RECORDED, NOT FIXED

**Found 2026-09-02.** The `storefront` capability is fully built and already registered with
the model (`HUBLY_CAPABILITY_REGISTRY`, ~10 actions over the owner-gated `commerce-api`).
It cannot be reached from the signed-in shell, because
`CONTEXT_CAPABILITY_ALLOWLIST` grants it only in the `operate` context and
`platform-home.html` sends **no `context` at all**, so every shell request defaults to
`dashboard`.

### The naive fix is a trap — do not ship it

Adding `"storefront"` to the `dashboard` array looks like the whole fix. It is one line, and
it would **advertise the capability to the model and guarantee that every call fails.** Three
pieces are missing, none of them supplied by the shell:

1. **`ownerToken`** — the write credential the storefront handlers present to `commerce-api`.
   Declared at `hubly-conversation/index.ts:911` and assigned at **exactly one place, `:937`**,
   inside `if (context === "operate")`. In `dashboard` it is `null`, always.
2. **`businessId`** — read from `body.businessId` at **`:904`**. The claimed shell sends
   `draftBusiness`, never `businessId` (`platform-home.html:2305`, `:3899`). It is `null`.
3. **The injection block is itself guarded on it** — `if (capabilityName === "storefront" &&
   businessId)` at **`:1659`**. With `businessId` null the block never runs, so even
   `_ownerToken` is never attached.

Net effect: the model is told it can operate the store, calls e.g. `listCatalog`,
`sfOwnerCtx` returns `null`, and the owner is told **"The Store isn't available in this
conversation yet."** — on every request, forever. That is the six-knobs-with-no-door defect
wearing a louder coat: instead of failing silently it actively tells the owner their store is
unavailable while the store sits there working.

### Why `context: "operate"` from the shell is worse than the disease

The tempting alternative — have `platform-home.html` send `context: "operate"` — is a
regression, not a fix. `operate` allows **only** `["storefront"]`, so it would strip
`website`, `business` and `online_presence` from the shell: every capability the claimed
owner actually uses today (page edits, record writes, the new design knobs). It trades one
dark capability for three working ones.

### THE ACTUAL OPEN DECISION — and it is not a storefront decision

**Would the `dashboard` context carry a raw owner write credential?**

To call `commerce-api` *as that person*, `dashboard` must hold the owner's raw JWT and pass
it onward. **It has never held one.** Today `dashboard` verifies an owner *uid*
(`getOwnerUid` → `resolveOwnerUid`) and stops there: the uid is handed to writer RPCs that
are locked to `service_role`, so the browser can never forge the owner branch. Holding and
forwarding a raw bearer token to another service is a categorically different posture from
verifying an identity.

**That is a security decision and it needs deciding on its own terms — never as a rider on a
"make the store reachable" task.** It is the kind of change that gets waved through because
the ticket was about something else.

### Size, and the honest caveat

~10–25 lines across two files, plus that decision. **It may not need making at all**: if the
storefront hour (see `PRODUCT_SHAPE.md` §3 and `STATE.md`) finds the legacy store rotted, or
the answer is to re-implement on the new spine, this door is moot. Do not build it before
that hour is spent.

---

## 15. 28 edge functions have no `config.toml` entry; 3 browser-called ones are ALREADY
## enforcing JWT — PARKED, partially measured, needs finishing

**Found 2026-09-02**, immediately after the `hubly-conversation` near-miss (that one is fixed
and recorded in `supabase/config.toml`). **Parked deliberately — real, not today.** Written
down so it isn't lost.

**Why this class matters:** `supabase functions deploy <fn>` applies the CLI default
`verify_jwt = true` for any function with no `config.toml` entry. Hubly's browser clients
present the **publishable key**, which is `sb_publishable_…` — **not a JWT** — so an
enforcing gateway rejects those calls *before* the handler runs. A signed-in owner sends a
real JWT and is unaffected, which makes this the worst-shaped bug there is: **it breaks the
people you cannot see and works perfectly for the person looking.**

**What was measured (2026-09-02):**
- **28 of the functions** in `supabase/functions/` have **no `[functions.<name>]` entry** in
  `config.toml`.
- Of those 28, **4 are called from browser code** (`public/*.html`, `public/journey-os/*.js`):
  `chatbot-message`, `google-calendar-oauth-start`, `hubly-build-business`, `import-offers`.
- Probed production with **no Authorization header**:

| function | gateway today | meaning |
|---|---|---|
| `chatbot-message` | **ENFORCING** (401 `UNAUTHORIZED_NO_AUTH_HEADER`) | already on |
| `google-calendar-oauth-start` | **ENFORCING** | already on |
| `import-offers` | **ENFORCING** | already on |
| `hubly-build-business` | **not enforcing** (400, its own handler error) | **same trap armed as `hubly-conversation` had** |

**The two open questions, NOT answered — do not guess them:**

1. **Is something already broken in production?** Three browser-called functions are
   enforcing JWT *right now*. If any of them is called with the **publishable key** (rather
   than a signed-in owner's real JWT), that path is already dead and has been. `import-offers`
   is the one to check first — it is the **price-list photo OCR** path, and if it is reachable
   from an **unclaimed draft** (pre-claim, no account, publishable key) then photo price
   import is broken for exactly the people the funnel depends on. **This was being checked
   when the work was parked; the credential each client call site sends was NOT determined.**
2. **`hubly-build-business` needs its entry**, matching whatever production actually runs, or
   the next deploy of it flips enforcement on. Probe first, then record — never assume.

**How to answer them, and the method matters more than the answer:** probe the deployed
endpoint rather than reading the config, because `config.toml` describes what a *deploy*
would set, not what production is *running*. That distinction is the whole finding — it is
how the `hubly-conversation` near-miss was caught (no auth header → the function's own
`{"error":"messages_required"}`, not a gateway 401 → proof enforcement was off).

**What would close it:** determine the credential each of the 4 client call sites sends;
fix any path already broken; give every browser-called function an explicit `config.toml`
entry with a comment saying why, in the style the file already uses. Consider a check that
every deployed function's entry matches production, so this stops needing a human to catch.

---

## 16. Every Hubly site opens in the same shape — the prompt forbids it by name and loses.
## RECORDED 2026-09-02, NOT FIXED. Do not fix by randomising.
## RE-RANKED 2026-09-05: COMMERCIALLY BLOCKING. It has a buyer attached now.

**Re-ranked because a paying customer is about to judge it side by side.** Bucket Mobile
Detailing (`bucket-mobile-detailing`, market) is paying Hubly to build his site and store,
he already has a Base44 site that is sleek, and he is running an explicit head-to-head and
picking the winner (`docs/BUSINESS.md` → Prospects).

We do not win a page-aesthetics contest against a Wix-funded specialist and should not try
to. But **the aesthetics half does not have to be won — it has to not be lost so badly that
nobody hears the capability argument.** If our generator hands him a page with the same
skeleton as every other Hubly page while Base44's looks made-for-him, the comparison is
decided in the first three seconds and the thing we are actually better at — running the
business, one customer list behind bookings, memberships and a store — never gets asked
about.

So this stops being unhurried generator work. **The constraint below still holds: do not
fix it by randomising.** A random layout is not a designed one, and a customer comparing
against a real design tool will see the difference immediately. The fix has to make the
shape follow from something true about the business.

### ATTEMPT 1, 2026-09-05 — BUILT, INERT, AND IT FAILED FOR THE REASON THIS FINDING NAMES

The narrow fix (headline alignment + mark position only) is built and deployed. **It changes
nothing on any page**, because the planner will not emit the commitment.

Built and unit-proven in isolation:
- `CHROME_ENUMS` += `headlineAlignment: ["left","centre"]`, `markPosition: ["left","centre","right"]`.
- `applyShapeNet()` — appends `<style id="hubly-shape-net">[data-hc="hero.headline"]{text-align:…}</style>`,
  in BOTH directions so a left page is a decision rather than an accident. Idempotent: a
  re-run replaces rather than stacks, the same "append ONCE" discipline as the price-marker
  style. Rejects a value outside the enum.
- The SHAPE-line parser — 8 realistic planner outputs. **One case earned its keep before
  shipping: the model's likeliest answer is `center`, the CSS spelling, and the enum is
  British to match `logoPlacement`. It was being silently dropped — regressing the page to
  the inherited default, the exact failure the change exists to stop.** Normalised at the
  parser, not by widening the enum.
- Storage via `patch_business_in_progress` → `meta.website.chrome`, the field `setChrome`
  already writes and `chromeOverridesFrom` already re-validates. No new column, no migration.

**And then it failed.** Four trades (bike repair, landscaping, food, gutters) generated on
unclaimed test businesses, twice — once with the SHAPE line requested LAST, once moved FIRST
and declared part of the commitment format. **0 of 4 both times.**

**It is not the plumbing being skipped.** The sibling `hubly-layout-net`, appended two lines
away in the same chain, is present on all four fresh pages; the shape net is absent. So
nothing downstream strips it — `applyShapeNet` ran and returned "no commitment", because the
planner never produced the line. The planner's own prompt ends *"Output ONLY the commitment.
No preamble, no options, no bullet lists of alternatives"*, and the requested line reads as
exactly the addendum that suppresses.

**THE FAILURE IS THIS FINDING'S OWN THESIS, APPLIED TO ITS OWN FIX.** #16 says prose does not
beat a model's default. Attempt 1 tried to escape the default by **asking the model in prose
to declare its default**, and it declined twice. See `STATE.md`.

### ATTEMPT 2, 2026-09-05 — jsonMode. WORKS. 4/4 commitments, 2 distinct values.

The planner now returns `{"shape":{"headlineAlignment","markPosition"},"plan":"…"}` with
`jsonMode: true`. A required field in a JSON response cannot be omitted for brevity, which is
the whole difference from attempt 1.

**Measured, four trades, unclaimed test businesses, clean run:**

| business | trade | commitment | enforced |
| --- | --- | --- | --- |
| tamales-by-the-dozen | food | **centre** | `text-align:center` |
| weekly-lawn-care-and-seasonal… | landscaping | left | `text-align:left` |
| bike-repair-shop | repair | left | `text-align:left` |
| gutter-guard-installation… | cleaning | left | `text-align:left` |

**Commitments emitted: 4 of 4. Distinct values: 2.**

Presence alone would have been a failure — JSON mode guarantees the field exists, not that the
value varies, and 4/4 with one distinct value is exactly what "the model's default" means. The
food business chose centre while the three trades chose left, which is the trade-informed
distinction the fallback would have hardcoded, arrived at by the model instead. **The
trade-informed default is therefore NOT needed and stays unbuilt.**

### TWO HONEST LIMITS — read this before quoting the result

1. **Three of four trades came back `left`. A single generated page is not visibly
   transformed.** What changed is that the alignment is now a DECISION rather than an
   inheritance — written out explicitly in both directions, stored on the business, and
   enforced so prose cannot silently revert it. Variety across a corpus will follow from
   that; one page in isolation may look exactly as it did yesterday. Anyone quoting "#16 is
   fixed" as "our pages look different now" is over-reading it.
2. **Mark position is committed and stored but NOT enforced.** Forcing a brand mark into
   position means reaching into a header whose flex/grid structure the model chose and we
   have not seen, which fails the "cannot make a good page worse" test that justifies every
   other appended rule. It is a recorded decision the generator is asked to honour, not a
   guarantee. Only `headlineAlignment` is guaranteed.

Hero shape and nav mode remain deliberately unbuilt.

**A false alarm worth recording.** Mid-build I reverted `jsonMode` believing it had stopped
pages from landing. It had not: **generation is ASYNCHRONOUS** — the reply literally says
"the page should appear in about a minute" — and every check ran seconds after the call
returned, finding nothing. The pages were landing and carrying the commitment. Two lessons,
both already in `STATE.md` in other forms: wait for the async write before reading, and a
surprising result needs a second measurement before it drives an action — here it nearly
drove a revert of a working feature.

**The acceptance test is VARIETY, NOT PRESENCE.** JSON mode guarantees the field exists; it
does not guarantee the value differs. Four commitments and one distinct value is a FAILURE —
that is precisely what "the model's default" means. Report both numbers.

**If it emits reliably but will not vary, the fallback is NOT randomising.** A trade-informed
default — a spa centred, a repair shop left, a landscaper full-bleed — chosen deterministically
from business type with the model free to override. That is a design opinion rather than a
dice roll, and it is checkable. Not built; not ruled out.

---

**Measured by RENDERING 128 stored freeform pages at 1440×900** — not by reading markup.
Where a logo sits is a layout fact, and DOM order is not screen position.

### The numbers

| | share |
|---|---|
| **hero headline `text-align: start`** | **128 / 128 — 100%** |
| **headline positioned left in the hero** | **127 / 128 — 99%** |
| brand mark left in the header | 106 / 128 — 83% |
| …right | 12 — 9% · …centre | 5 — 4% · …no mark | 4 — 3% |
| hero split, text-left/image-right | 58% |
| …text-only 25% · bg-image 9% · split-text-right 6% · stacked 2% | |
| nav with exactly 4 items | 53% · sticky header 59% · header CTA 86% |
| pages with 4–6 sections | 82% |

**THE HEADLINE IS MORE UNIFORM THAN THE LOGO, and it is the first thing anyone sees.
Not one page in 128 centres it.** The logo at least varies (83/9/4).

**15 distinct shape signatures** (`mark | hero | headline | nav`) across 128 pages; **the top
one covers 71 pages — 55%**; only 6 signatures occur once.

### SPLIT BY account_kind — the pattern holds where it counts

Test n=122, market n=5, internal n=1. **With n=5 the market RATES cannot be compared
meaningfully; the absolute facts can, and none of them contradicts the test set.**

| | test | market |
|---|---|---|
| headline `text-align: start` | 122/122 (100%) | **5/5 (100%)** |
| headline zone left | 121/122 (99%) | 5/5 (100%) |
| mark left | 101/122 (83%) | 4/5 (80%) |
| hero split-text-left | 70/122 (57%) | 3/5 (60%) |
| the dominant signature | 67/122 (55%) | 3/5 (60%) |

One market page breaks the header pattern (`lugnuts-regulators`, motorcycle_rebuilds —
centred mark, text-only hero). **Zero break the headline alignment.**

**AND IT IS NOT SEEDING.** The obvious objection — that the test corpus came from similar
prompts — was checked: **124 distinct briefs across 124 test pages, no two sharing even
their first 200 characters.** Remaining honest limit: distinct brief TEXT is not the same as
diverse brief INTENT; they were all written by one person and may share a voice.

### WHAT IS NOT THE PROBLEM — do not "fix" variety that already exists

- **Colour.** Accent spans **9 hue families** (near-black 23%, orange 18%, red 14%, green
  12%, blue 9%, teal 9%…). Backgrounds: near-white 55%, **near-black 32%**, blue 10%. A
  third of pages are dark. H1 ink spans 7 families. 6 distinct body fonts, 6 heading fonts.
- **Text.** **121 distinct section-heading sequences across 122 pages.**

**The sites say different things in identical shapes.** The sameness is structural only.

### Where it comes from — not the prompt, not a template, the MODEL'S DEFAULT

**The prompt already forbids exactly this, by name:**

> "Do NOT default to 'top nav + hero-with-image-on-the-right + three service cards' unless
> it is genuinely right for THIS trade." — `hubly_capability_registry.ts:1915`

> "How the brand mark and navigation appear is entirely yours to decide: a top nav bar is
> ONE option, not a requirement… Two different trades should not open with the same
> shape." — `hubly_capability_registry.ts:1885`

**55% of pages are the precise pattern the prompt names and prohibits. The instruction
exists and loses.** There is no template on the freeform path to blame — it is a single
generation with no fallback.

**PROSE DOES NOT BEAT A MODEL'S DEFAULT, and this codebase already knew it** —
`hubly_capability_registry.ts:89`, explaining why the capability schema supports `enum`:

> "some arguments genuinely have a closed set of values (header placement, CTA mode) and
> **prose alone does not stop a model** inventing a sixth one."

**The mechanism exists, on the wrong renderer.** `CHROME_ENUMS.logoPlacement =
["left","centre","stack"]` (`:681`) is real and validated — but only reachable through
`setChrome`, which is guarded `latest.format !== "ast"` and returns `wrong_format` for
freeform. **Every AST page can have its logo placement chosen as a structured value; every
freeform page — which is every real business — gets prose and hope. It reaches zero market
businesses.**

### The root cause is the one fixed three times already today

**The commitment pre-pass decides the page's shape in prose and throws the decision away.**
Identical shape to:
- `expandBands` computing the page's sections and discarding them (fixed: `data-hc-section`);
- the knob pass computing bind counts and discarding them (fixed: `data-hubly-bound`);
- the generator inferring the vertical and discarding it (`PRODUCT_SHAPE.md` §5, still open).

**A decision that is not recorded cannot be honoured, inspected, corrected or measured.**

### The fix, when we do it — chosen, not randomised

Left-aligned is right most of the time and it is the convention for a reason. The goal is
the generator **choosing**, per trade, and being accountable for the choice:

- the commitment emits **structured** values — **mark position, hero shape, headline
  alignment, nav mode** — validated against enums, exactly as `CHROME_ENUMS` already does;
- **stored as facts on the business**, so they can be inspected, corrected by the owner, and
  measured against trade;
- honoured by the builder.

**Include headline alignment specifically — it is the most uniform thing we have (128/128)
and it is NOT in `CHROME_ENUMS` today.**

There is already weak trade signal to build on: roofing goes bg-image 57%, bakery text-only
67%, barbershop puts the mark right 50% of the time. The instinct fires; it just loses to
the default. **This is the next GENERATOR job — after the contextual toolbar, not instead
of it.**

---

## 17. THE MODEL INVENTED A SERVICE AND ITS PRICE, AND IT SHIPPED — resolved on the one
## affected page; the mechanism it exposes is recorded

**Found 2026-09-03 by Adrian reading his own live page.** "Hedge Trimming $75" was on
evergreen and NOT in the `services` record — a price a customer could read and not buy.

**IT WAS INVENTED. The evidence, before anything was deleted:**
- **36 conversation turns for evergreen. ZERO contain "hedge". ZERO contain "75".**
- The generation brief names exactly three services: Basic Mow $40, Full Service $95,
  Seasonal Cleanup $220. No hedge.
- `rebuild_outcome_events`, the countable trail: `2026-08-30 06:08:59 services-placement
  placed landed=true paths anchor=0 legacy=0 inserted=1; inserted=Hedge Trimming`.
- **On that date neither guard existed.** Grounding (`hubly_grounding.ts`) shipped
  2026-09-01; the Edit-details panel — the only non-chat way to add a service — shipped
  2026-09-01. On 2026-08-30 the only path was the model's own `setServices`.

So the model produced a service and a price nobody stated, `setServices` wrote it to the
record AND placed a card, and a later replace-all services write dropped it from the
record while the card stayed. That second half is finding #12's mechanism; the first half
is **the grounding rule failing on a live page**, which is the thing `CLAUDE.md` opens with.

**Resolved on the page (2026-09-03):** the card was excised and evergreen is now v86 —
6 priced services on the page, the same 6 in the record, **zero unbookable**. One document
version, so Undo reverses it.

**SIZE, measured corpus-wide:** of pages carrying any price anchor (**4**), exactly **1**
had a service the record could not book — evergreen, `account_kind=test`. **Zero market
pages affected.** Small only because the price-anchor work is recent; the mechanism was
capable of doing this to any of them.

**A correction that matters more than the bug.** The initial report described the price as
"£75 on a Denver business", which read as a strong fabrication tell. **The page says `$75`
— character code 36, and all 7 currency symbols on it are `$`.** The £ was a typo in
Claude's own summary, and it nearly sent the investigation after a phantom
currency-hallucination. A misquoted piece of evidence is worse than none: it is evidence
pointing somewhere real, at nothing.

**What is NOT closed:** whether the grounding guard shipped on 2026-09-01 would refuse this
today. The invention predates it, so this is not proof the guard is working — only that the
failure is older than the fix. Worth a live test: ask for a service with no price given and
confirm it asks rather than inventing one.

---

## 18. A FAILED DOCUMENT READ RENDERED A DIFFERENT WEBSITE, with owner-facing
## placeholder copy, on a public customer route — FIXED 2026-09-03; #1 now explained

**Reported live:** pressing **Back from the booking page** landed on a page that was not
the owner's site — different nav (Services / Reviews / About), a BOOK NOW pill, an ES
language toggle, a "What can Evergreen Yard Care help you with?" search box, and four
empty grey cards under "What we offer" reading **"Add what you do and we will lay it out."**

**What that page is.** `#p-storefront` — the CLASSIC ARCHETYPE RENDERER in `hubly.html`,
which builds a site from the `businesses` columns for businesses that have no stored
document. (Note the naming trap recorded in `PRODUCT_SHAPE.md` §3: `#p-storefront` is the
classic WEBSITE page; the commerce store is `#p-store`.) Its empty states are written for
the OWNER, in the editor — which is why a customer saw build-me copy.

**Why it rendered.** `loadLatestBusinessDocumentHtml` returned **`null` for BOTH "this
business has no document" AND "the read failed"**, and `loadPublicProfile` answers the
first by rendering the classic archetype. So any transient failure — a dropped RPC, a
bfcache restore, a race on Back — silently swapped the owner's real site for a different
template carrying unfinished copy. **This is the mechanism finding #1 was missing**, and
Back-from-booking is the reproduction it asked for.

**Fixed (2026-09-03):**
- The loader now returns `undefined` for a FAILURE and `null` only for a genuine absence.
  *An error is not an absence* — collapsing them is what made a hiccup look like "this
  business has no site".
- `loadPublicProfile` retries once on failure, then shows a plain, honest "This page
  didn't load / Try again" — **never another template**. A business with genuinely no
  document still gets the classic renderer, which is its real site.
- `popstate` on a business subdomain returned immediately, so Back re-resolved nothing.
  It now resolves the only two states a customer can be in — the site, or `?book=1` — and
  a `pageshow` handler covers the bfcache restore, where popstate never fires at all.

**STILL OPEN — the placeholder copy itself.** The classic renderer's empty states
("Add what you do and we will lay it out", "Add contact info in the editor", "Add your
location to show the map") are owner-facing strings on a route any customer can reach,
for any business that legitimately has no stored document. The freeform path already
strips scaffolding for non-owners (`hcStripPlaceholders`, gated on `hcBuilderPreview()`);
**the classic path has no equivalent.** That is a separate fix and it is not done.

**Line numbers, added 2026-09-04 while working #23 — deliberately NOT fixed there, so the
two jobs stay separate.** Two of the three have no `isEditorViewOpen()` gate at all, so they
render to a customer as written:

- `hubly.html:39640` — `if(!phone&&!email&&!city)` appends `t('wsAddContactInfo')`, which
  reads **"Add contact info in the editor"** in the footer of a live public page. It names
  our editor to somebody trying to phone the business.
- `hubly.html:39599` — the `else` branch of the service-area map emits
  `t('wsAreaAddLocation')` = **"Add your location to show the map"**.
- `hubly.html:35888` — `"What makes your business different."`, a hardcoded literal no
  locale scan finds. Recorded here because a blocklist built from remembered strings missed
  it once already.

Confirmed still live on market pages 2026-09-04: `aquaspeed` renders "Add what you do and we
will lay it out."; `devdetailing661` renders "Add photos of real work you have done." and
"Gallery photos will appear here."

The fix is **not** a blocklist of placeholder strings — that was demonstrated incomplete.
Mark the copy editor-only at its source and have the public renderer refuse to emit anything
carrying the mark; then the count stops mattering.

---

## Also noted 2026-08-28

- **Rebuild read-back is vague.** The "yes, rebuild" reply ("a completely new page is
  live … with the full menu in mind") is truthful but does NOT enumerate prices or name
  the service that was added, unlike the patch read-back (#3). The rebuild path should
  read back what actually landed, same discipline.

---

## 19. VIDEO — RECORDED 2026-09-03, NOT BUILT.
## RE-SCOPED 2026-09-05: this is TWO features sharing one word, and they are
## different sizes. Bucket is selling trainings, and a training is video.

### The split, and why it matters more than the feature

**A RENDERING feature: "paste a link and it plays."** Days-scale on the freeform path,
because most of it exists. Measured 2026-09-05:

- `<video>` is **already in `ALLOWED_TAGS`** (`hubly_document.ts:161`), `src` is permitted
  on it (`:200`), it counts as media for the has-content check (`:803`), and the model is
  told it may use it (the tag list at `:1482` is generated from `ALLOWED_TAGS`).
- `src` must pass `isValidMediaSrc` → `ALLOWED_MEDIA_ORIGINS` = our Supabase storage +
  `images.unsplash.com` (`:528`). **The allowlist this finding asks for already exists**,
  drawn tighter than proposed: "files we host", not "YouTube, Vimeo, direct MP4".
- `<iframe>` is **explicitly banned** in the grammar and stays banned (`:1026`, `:1492`),
  with one shell-emitted exception, the service-area map. So YouTube means either widening
  that to a reserved `youtube-nocookie` element the shell emits — the same pattern the map
  already uses — or hosting the file.
- **Never used, not once: 0 of 401 `business_documents` contain `<video>`, 0 contain
  YouTube or Vimeo. The 8 with an `<iframe>` are all service-area maps.** A permitted
  capability with no door.
- **The classic renderer has no video path at all** — there is no `<video>` tag anywhere in
  `public/`. Bucket and Graef are both on classic.

### DECISION 2026-09-05 — YouTube ships as a RESERVED ELEMENT. The grammar never loosens.

Neither of the two options originally posed (widen `ALLOWED_MEDIA_ORIGINS`, or host the
file). **`HublyMap` is already the exact template**: the model places `<HublyMap/>`, the
SHELL emits the iframe from context, and `<iframe>` stays banned in the document grammar
(`hubly_document.ts:1026`). `HUBLY_RESERVED_TAGS` already holds six such elements.

**`HublyVideo` follows it exactly** — the model places the element, the shell emits a
`youtube-nocookie` embed built from a URL the OWNER supplied, and the model never writes an
iframe or a URL of its own. That preserves #19's own constraint that the AI must never
invent a link: a fabricated video ID points at somebody else's real video, which is worse
than a fabricated price. Recorded as the decision; no un-banning, no allowlist widening.

**A LICENSING feature: "the buyer watches what they bought."**
**OUT OF SCOPE as of 2026-09-05 — asked the customer, and it was never the requirement.**
Bucket's "trainings" turned out to be (a) teaching people to detail in person or over a
video call — a **bookable service with a price**, which Hubly already does — and (b)
"available content", which is **video on a page**, i.e. the rendering half above. Nobody
needs to buy access to anything.

**We were one assumption away from building a course platform to sell a service and a video
embed.** The three missing pieces below are recorded because they are true and will matter
if a real gated-content requirement ever appears — not because anything is waiting on them:

1. **No entitlement.** `product_type='digital'` exists but its entire meaning is
   `isStockless` in `commerce_checkout.ts:87` plus a "Digital item" label. `commerce_orders`
   has a `fulfillment` column whose only code path sets it to `"cancelled"`. There is no
   entitlement table, no access grant, no download URL.
2. **No private storage.** `brand-assets` is images-only (5 MB); `business-assets` and
   `site-media` have no MIME or size limits but are **`public: true`**, and no code writes
   to either. A public URL cannot gate anything. Gating needs private objects and signed
   expiring URLs — infrastructure that does not exist.
3. **Video cannot even be uploaded today.** The only two `accept="video/*"` inputs are in
   `photography-projects.js`, and that module's own comment says
   `// brand-assets only allows image/* — skip video/docs for storage previews.` A chosen
   video is dropped: it survives as a browser blob and dies on reload. It renders as the
   word **"Video"** in a `<span>` (`:1803`) — no player, no thumbnail, not selectable.
   `service_engine.ts` carries `media.videos?: string[]` (`:172`) which is parsed,
   round-tripped, always written empty, and read by nothing.

**Conflating these two is the expensive mistake, and this finding as originally written
conflated them.** "YouTube plays on the page" and "Bucket sells a course" share a noun and
nothing else.

### THE QUESTION THAT USED TO SIZE THE STOREFRONT — NO LONGER BLOCKING

**Can a customer authenticate to Hubly at all today, or is every auth path owner-side?**

**Downgraded 2026-09-05: still worth knowing, no longer sizing anything.** It was the floor
for gated delivery, and gated delivery is out of scope (above). Left here unanswered and
explicitly not on anyone's critical path.

Everything traced on 2026-09-05 is owner auth (`getOwnerUid()` resolving a verified owner
from the JWT). `marketplace_customers` and `customer_profiles` exist as tables; whether
either supports a buyer logging in has **not** been traced.

Everything traced is owner auth (`getOwnerUid()`). `marketplace_customers` and
`customer_profiles` exist as tables; whether either supports a buyer logging in is still
untraced. It would be the floor for gated delivery **if** that were ever required.

---

## 19a. ORIGINAL ENTRY — RECORDED 2026-09-03, kept for the design constraints

**The want, from real use.** An owner pastes a YouTube link and it shows as a playable
video. The cases are concrete: a detailer whose every product ships with a how-to
video, and a course made of lessons. Home-service and trade owners already have this
content sitting on YouTube and Instagram doing nothing — this is not asking them to
make something, it is asking them to point at what exists.

**SEQUENCING FIRST, because it decides whether any of the rest is worth writing.**
This is storefront work, and the storefront is still behind a door nobody has opened
(`STATE.md` STOREFRONT, `OPEN_FINDINGS` #14). Building a video field onto products an
owner cannot reach is the six-knobs-with-no-door defect at product scale. **The
storefront hour comes first** — one hour signing in and exercising the legacy Store —
and it may answer this for free: the product record may already have somewhere to put
a video, in which case this is a renderer and a validator, not a schema change.

**Design constraints, each one paid for by something already in this file:**

- **ALLOWLIST THE SOURCES — YouTube, Vimeo, direct MP4, nothing else.** An arbitrary
  URL in an iframe is a caller pointing our page anywhere. Same reasoning as the closed
  style vocabulary in `applyFreeformStyle`: the toolbar is HTML we serve, but the
  request is a POST like any other, and every writer here is built on the assumption
  that anything reachable will one day be called by something we did not write.
- **PLAYER *AND* LINK, never either.** Embed inline, and always keep a visible link
  out. When an embed fails — blocked, deleted, region-locked — a thumbnail plus a link
  is a working fallback; a black rectangle is a dead control, which we already know is
  worse than no control (the mic, the language float, the theme toggle).
- **TWO PLACEMENTS, both in the real brief:** a per-product video (a field on the
  product) and a page-level video block (a section).
- **THE AI NEVER INVENTS A LINK.** "Add a video" with no URL in the current message
  ASKS for the URL and writes nothing — the standing rule at the top of `CLAUDE.md`,
  and this is its sharpest case yet. **A fabricated price is wrong; a fabricated video
  ID points somewhere real that is not ours.** That is Hedge Trimming (#17) with a
  worse blast radius, and it must be refused at the writer, not discouraged in a prompt.
- **Privacy-preserving embeds by default** — `youtube-nocookie`.

**One observation worth keeping.** Base44's own placeholder video, on a live customer
page, is Rick Astley. That is the same class as our "Add what you do and we will lay it
out" (#18): scaffolding left on a public route. Everyone does it. It is still wrong,
and seeing it in someone else's shipped product is not permission.

---

## 20. EVERY PAGE EDIT MADE BY TALKING WAS DEAD ON A CLAIMED SITE — CLOSED 2026-09-04.
## All 8 call sites fixed, and the class is now impossible to write again

**Found 2026-09-04 while wiring the selection chip, by reading both sides of the write —
not by a test, because no test exercises a claimed site.**

`create_business_document` stopped accepting the draft token the moment a business is
claimed (migration `20260822030000`: unclaimed → token, claimed → `p_owner_id` must equal
`owner_id`). Any writer that omits `p_owner_id` therefore returns `not_owner` on every
claimed business — and the claimed business is the only kind a real owner has.

**Proven against the live claimed business (`evergreen-yard-care`), write-free:**
- without `p_owner_id` → `{"ok":false,"error":"not_owner"}`
- with the real `p_owner_id`, and a deliberately invalid `p_created_by` so it fails *after*
  the authorise block → `{"ok":false,"error":"invalid_created_by"}` — i.e. authorisation
  passed
- `business_documents` count **162 before and 162 after** — neither probe wrote a row

**THE COUNT WAS WRONG WHEN FIRST WRITTEN, and that is worth recording.** This entry
originally said "five siblings", because the generation call sites were grouped by
function rather than counted. A brace-matched scan of every
`callBusinessRpc("create_business_document", {…})` payload — parsing the object, not
reading a fixed window of lines — found **8 call sites** missing it, not 5. A count
produced by grouping is a count nobody can check; the scanner is in the verification
below and prints 20/20 today.

**ALL 8 FIXED (2026-09-04):**

| call site | what was broken on a claimed site |
|---|---|
| `applyFreeformInstruction` | **every page edit made by talking** (`website.patchDocument`, freeform) |
| `syncFreeformFacts` | record-change → page fact sync |
| `rebuildDocumentFromRecord` (AST rebuild) | the background rebuild after a record change |
| `rerenderLatestDocument` | re-render after `setChrome` **and after a logo upload** |
| `applyOwnerPhotoToFreeform` | owner photo placement (the name said Owner; it had no owner) |
| `runFreeformGeneration` | a build that finishes after the owner has signed up |
| `runDocumentGeneration` (AST) | same, AST |
| `website.newPage` | **"start over" on a claimed site** |
| `website.patchDocument` (AST) | AST page edits |

The owner is threaded from `getOwnerUid()` in `hubly-conversation` through every chain,
including **across the service boundary** into `hubly-document-build` — a build dispatched
before claim can finish after it. That hop is safe because the receiving function compares
the presented credential against our secret key on both headers before its handler runs,
so anyone able to set the field could already write as `service_role`.

### THE INVARIANT — and, just as important, WHERE IT STOPS

`callBusinessRpc` **throws** when `create_business_document` is called without a
`p_owner_id` key. **Absent is a bug**; an explicit **`p_owner_id: null` is a decision** —
"this path only runs before claim" — that a reader can see and disagree with.

Deliberately not another hardcoded allow-list. Every list here has silently dropped an
entry (`DRAFT_INJECTED_ACTIONS`, `GATED_WEBSITE_ACTIONS`, `CONTEXT_CAPABILITY_ALLOWLIST`),
which is why they each ended up needing an audit. A rule at the single point every writer
already passes through cannot be forgotten by the next writer, who will not have read
migration `20260822030000`.

**THE THROW IS NOT UNIFORMLY LOUD, and "throws in front of whoever wrote it" would be an
over-claim.** Measured by walking outward from each of the 20 call sites:

- **16 sites propagate** to `hubly-conversation`'s outer `catch (err)` → a **502 carrying
  the guard's message in `detail`**. Loud, in production, immediately. This covers every
  capability handler (`newPage`, `patchDocument`, `restyleElement`, the generation paths)
  and every direct owner-edit branch.
- **4 sites are caught** and degrade to a logged failure: `syncFreeformFacts`,
  `rebuildDocumentFromRecord` and `rerenderLatestDocument` each `console.error` and return
  `{status:"failed"}`; `applyOwnerPhotoToFreeform` is caught by `uploadDraftPhoto`'s own
  try and becomes a `failed` placement the reply reports honestly. **On those four the
  invariant degrades to a log line — which is close to the silent failure it exists to
  end.** It is a log rather than nothing, and the owner is told the thing did not land,
  but it does not stop a deploy.

So the invariant's real force is at **development and test time**, plus the 16 loud paths.
For the four caught ones, `scripts/check-owner-id-invariant.mjs` is the thing that
actually catches a regression, not the throw.

### THE GAP THE INVARIANT STRUCTURALLY CANNOT SEE

The guard asks only whether the **key** is present. A handler that reads an owner the
engine **never injects** yields `null`, the key IS present, the guard passes, and the
write is refused on a claimed business exactly as before. **An accidental null and a
deliberate pre-claim null are indistinguishable at the RPC.** That is not a flaw in the
invariant; it is its boundary, and the routinely-hit claimed path — `website.newPage`,
"start over" — sits inside it.

Two things close that boundary, because only "this handler wants an owner" vs "the engine
injects one for this action" can tell the two nulls apart:

- **`auditConversationAllowlists` now audits the owner side too**: every action whose
  handler reads `injectedOwnerUid` must be in `DRAFT_INJECTED_ACTIONS`. Verified by
  removing `website.newPage` from the set and watching it fire, then restoring.
- **`scripts/check-owner-id-invariant.mjs`** runs both checks without deploying.

### "IT TYPECHECKS" WAS NOT EVIDENCE FOR TWO OF THE EIGHT

Six sites take `ownerUid` as a typed parameter, so the compiler enforces them. Two —
`website.newPage` and `patchDocument`'s AST branch — read
`String((args as any)?.ownerUid || "").trim() || null`, and **`as any` switches the
compiler off on exactly the expression that decides whether a claimed owner can write.**

The `as any` was never needed: a handler's `args` is already `Record<string, unknown>`, so
the property read is legal without it. All **9** such reads now go through one typed
reader, `injectedOwnerUid(args)`. The key name `ownerUid` exists **once**; a typo at a
call site is an unknown-function error rather than a silent null; and it is the single
string the two audits above look for.

### VERIFIED — what was executed, and what was not

**Executed, against a stub PostgREST recording every payload, driving the REAL writers:**
- `syncFreeformFacts`, `applyOwnerPhotoToFreeform` (through `uploadDraftPhoto`, on a page
  carrying a real photo slot) and `rerenderLatestDocument` (through `uploadDraftLogo`,
  against a **real stored AST document** pulled from the corpus — a hand-made one was
  rejected by the renderer, which is the point) each **received the owner uid at the
  save**. Two already-correct writers ran as controls, and every path sends an explicit
  `null` when there is no owner, so the unclaimed branch is unchanged.
- The **service-boundary hop**: `dispatchDocumentBuild`'s real body was captured off the
  wire and fed to `hubly-document-build`'s own parsing line — `ownerUid` survives intact.
  A field-name mismatch across an HTTP hop is silent in both directions.
- **Live regression after deploy** (the throw is a new failure mode): a fresh draft built
  end to end and the document saved on the first poll — `runFreeformGeneration`'s save
  works with the new argument, no guard trip, no 502. A record-change turn returned 200.
  Both gateways probed and unchanged.
- **Static:** a brace-matched scan reports **20 of 20** call sites carrying `p_owner_id`,
  and `deno check` shows an identical error profile before and after on both functions.

**THE TWO UNTYPED SITES, PROVEN IN TWO LINKS** (added after the first write-up asserted
them). "It typechecks" was not available as evidence here, so each link was executed:

- **Link 1 — is `ownerUid` injected into `args` at all?** Two turns run against the
  DEPLOYED function, reading `actions[].args` from the response, where the function's own
  redaction already replaces the value: `website.newPage` → keys
  `["draftId","brief","confirm","draftToken","ownerUid","_userMessage"]`, ownerUid
  **PRESENT** (`"[redacted]"`). `website.patchDocument` → ownerUid **PRESENT**. So both
  are on `DRAFT_INJECTED_ACTIONS` in fact, not just in the source. **No ninth instance.**
- **Link 2 — does the value read out of `args` reach `p_owner_id`?** Both handlers run end
  to end with `globalThis.fetch` intercepted, so the real registry, the real reader and
  the real payload are exercised against a stubbed database and model. With
  `args.ownerUid` set, `p_owner_id` **= that value**; with it absent, `= null`. For the
  AST branch the fixture is a **real stored document** from the corpus, minimally pruned:
  it contains two `mailto:` links the CURRENT validator forbids, so the patch was
  correctly rejected until they were removed — a real rejection, not a threading fault,
  and worth recording as a fact about old stored AST documents.

**NOT executed — say so rather than imply otherwise:** the **claimed** branch of any of
it. Claude Code cannot sign in as an owner, so every live run above exercised the
unclaimed path, which is the one that already worked. What the fix does on a claimed site
is proven at the RPC (the write-free probe above) and by the owner uid arriving at each
save, not by a signed-in owner watching their page change. The `setChrome` re-render was
not run at all; it now uses the same typed reader as the two proven above.

---

## 21. WITH SIX INSTRUCTIONS IN ONE MESSAGE, THE WORK HAPPENS AND HUBLY SAYS NOTHING.
## MEASURED 2026-09-04, NOT FIXED — this is the sizing Adrian asked for

**Measured against the deployed function, N = 3 real six-instruction turns on one
unclaimed test draft (`cedar-ridge-lawn`, `account_kind=test`). Unclaimed is a real
limit on this number — see the caveat at the end.**

**The ceiling, from the code:** `MAX_CAPABILITY_ROUNDS = 4`, and each round yields
**either one capability action or the final reply**. So **4 model-invoked actions is the
hard ceiling, and 3 is the most that can run and still get a reply** — the fourth action
eats the round the reply would have used. A server-side extraction pass
(`business.recordFacts`) runs outside the loop and is not round-limited.

**Instructions are not actions.** `website.patchDocument` batched two text instructions
into one action and **both reached the page** (verified on the stored document, v3:
headline and button text present).

| turn | model-invoked actions | rounds | what the owner was told |
|---|---|---|---|
| six, mixed | 1 (failed) | 2 of 4 | **a success line that erased the model's failure report** — see below |
| six, all achievable | 2 | 3 of 4 | honest; named what landed and what didn't |
| six, spanning four capabilities | **4** | **4 of 4 — exhausted** | **"I've gathered what I can for now — what would you like to do next?"** |

**That last row is the finding.** Five real changes landed — a headline, a subheadline, a
service with a price, a header preference, a brand colour — and the reply names **none of
them**. Prohibition 6 at full strength: the operation worked, the database updated, and
the product said nothing.

**And a second, separate defect found in the same run:** the reply is composed from
whichever composer has the best news.
`primaryReply = photoTruth || servicesTruth || contactHoursTruth || deduped.reply`
(`hubly-conversation/index.ts` ~`:2243`) — a truth-composer for ONE sub-action
**substitutes** the model's reply rather than joining it. Observed verbatim: the model's
final message was *"I couldn't change the page styling yet because you're not signed in."*
and the owner was shown *"Done — I added your phone number and your hours on your page."*
A success line replaced a failure report. This is the two-composers family (#4) with the
worst possible tie-break, and it gets worse as instructions per turn rise.

**THE COST OF MAKING SIX WORK — the number, not a guess. ~2–3 days, in three parts:**

1. **Reserve the reply; raise the action budget.** The reply currently competes with
   actions for rounds. Always run a final compose round, and lift the action budget from 4.
   **~40–60 lines, one file.** Half a day.
2. **Compose the reply from a TURN LEDGER — what every action actually did.** This is
   `servicesTruth` generalised: collect each action's `summary`/`humanNote` and compose
   once, honestly, naming per instruction what landed and what did not. The three truth
   composers become *inputs*, not substitutes. **~80–120 lines — and this is the risk**,
   because it touches every acknowledgement path Adrian has already paid to get right
   (photo, services, contact/hours); each needs re-verifying. 1–1.5 days.
3. **Progress while it runs.** Measured latency **~6–13s per round (median ~8s)**: 18s /
   22s / 38s / 31s for the four turns above. Six actions plus a reply ≈ **45–65 seconds on
   one turn with nothing on screen.** The `interimMessages` machinery exists but batches at
   the end; streaming it per action is **~60–100 lines across client and server**, and it
   is the difference between "works" and "usable". 0.5–1 day.

Partial failure (some of six will fail — `setChrome` is a no-op on a freeform page and
said so honestly) needs no separate work: it falls out of (2) done properly.

**CAVEAT ON THE DENOMINATOR.** All three turns are an **unclaimed draft**. A claimed owner
has a different action mix — design knobs and the owner-authorised writers become
available, and `setDesignKnob` was refused (`not_signed_in`) in the first turn purely
because the draft was unclaimed. So the round count on a claimed site could be **higher**
than 4, not lower. Confirming the claimed number needs a signed-in owner and is Adrian's.

---

## Related, already-tracked

- **Freeform pages have no update path** — the structural finding under #3/#5/#7. See
  `docs/KNOWN_ISSUES.md` ("Freeform pages have NO update path"). A record change
  no-ops except `contact`; photos/logo now place via targeted placement (2026-08-27),
  but services/hours/area/logo-on-page still don't have a post-build path.
- **Post-claim editor** — deferred investigation. The 2026-08-28 direction (editing
  turns on at claim; a shell is "the next build") makes this the decisive open
  question: after claiming, can an owner actually change copy, swap a photo, fix a
  price, delete a section? Run read-only before building the shell. CORRECTION
  (2026-08-29, `docs/PRODUCT_SHAPE.md` §1): the Website Editor is NOT a universal
  tab — the left rail renders per entitlement, and Website Editor exists only for an
  account that has a site (a marketplace-only provider has none). Do not treat it as
  the one shell tab everyone gets.

---

## 22. HUBLY COMPOSED A BOOKING THAT NEVER HAPPENED, AND ASSERTED BUSINESSES WERE
## INSURED — FIXED 2026-09-04. The rating/review count is a separate, OPEN decision

**Found 2026-09-04 while rendering live market pages for #18.** Three fields, and the
important thing is that they have **three different authors**. Smearing them together
would have produced a wrong fix and a wrong severity.

### OURS — removed

- **The activity ticker.** `hubly.html` composed
  `⚡ Someone in {city} just booked a {service} moments ago` from the business's `city`
  and its first service name (locale keys `wsTickerSomeone`/`wsTickerBooked`/`wsTickerAgo`,
  and the Spanish set). **No booking record was consulted**, and `tickerEnabled` defaulted
  to `true`. Hubly has never received a booking from a member of the public, so every one
  was an event that did not happen, published under a real business's name. Removed — the
  owner's own line, or nothing. Not made conditional on a real booking (a booking is a
  customer's private business, not a marketing asset) and not softened. Default flipped to
  `false`: 9 of 34 claimed businesses had `true` stored, which is the default being written
  down, not nine people choosing.
- **The trust-row auto-fill.** An empty row was filled from the trade blueprint's
  `trustSignals` — detailing `["Insured","Mobile","Pro products"]`, hvac
  `["Licensed","Insured","24/7 emergency","Financing"]`, house-cleaning
  `["Background-checked",…]`, window-cleaning `["No-streak guarantee"]`. Regulated claims
  about someone else's business, said by nobody. Empty means empty now.
- **`WS_TRUST_DEFAULTS`** `['Mobile Service','Fully Insured','Satisfaction Guaranteed']` —
  referenced nowhere, so it never reached a page. Deleted anyway: a ready-made "Fully
  Insured" default beside the code we just stopped auto-filling.

### THE OWNER'S — untouched, and Adrian's decision

`rating` and `reviewCount` are written by **two editor form fields only**
(`ed-ws-rating`, `ed-ws-review-count` → `onReviewsFieldChange`). No generator, migration,
backfill or edge function writes them; the generation prompts forbid the model from
producing them. **One stored rating is `"6"` on a five-star scale** — a value no generator
emits and the strongest single tell for a human typing into an unvalidated field. So this
is a validation/policy question, not a fabrication bug. `addManualReview`'s
`{author:'Verified Customer', stars:5}` scaffold is likewise untouched.

### THE NUMBERS, denominator stated

**34 claimed (publicly reachable) businesses: market 9, internal 3, test 22.**
Before: **1** displayed the ticker (graefs-autocare, market — stored `tickerText` empty, so
Hubly's composition); **1** displayed a star rating/review count (aquaspeed, market, with
**0** rows in `review_submissions` — which has **0 rows across the entire database**).

### VERIFIED BY WHAT A VISITOR SEES

All 34 rendered before and after, full `innerText` diffed:

- `graefs-autocare` [market] lost exactly one line: `"⚡ Someone in Bakersfield just booked
  a Full Detail moments ago"`. Nothing else.
- `star-windows` [test] lost `"Insured"`, `"Ladder-safe"`, `"No-streak guarantee"`.
- **32 of 34 pages byte-identical.** Trust pills went 3 → 0 on `bucket-mobile-detailing`
  (market) and `star-windows`; **owner-written stats survived intact on `aquaspeed` and
  `graefs-autocare`**, which was the over-deletion risk.
- The three #18 pages still show their placeholder copy, unchanged — different bug, not
  blurred.

An empty ticker would have left visible furniture: `.ws-ticker-force` is `display:block`,
so clearing the text alone leaves a padded, bordered strip on `obsidian-gold` — the layout
the one affected page uses. Caught by reading the CSS after writing the first version.

### STILL OPEN — do not read this entry as "the class is closed"

- **3 businesses carry PERSISTED auto-fill** — the blueprint values were saved to
  `meta.website.trustStats` before this fix, so the code change cannot reach them:
  `my-auto-detailing` (internal), `adrians-lawn-service` (test), `my-photography` (test).
  **Zero market**, so live customer exposure is nil. They are distinguishable by signature
  (every `label` empty; values exactly match the trade's `trustSignals`) if we ever want a
  data cleanup — which is a write to real businesses and was not authorised here.
- **`public/booking-frames/*.json` is the same class, LIVE, and larger.** 47 credential
  literals across 8 files — `"Licensed & Insured"`, `"Background-checked cleaners"`,
  `"100% Satisfaction Guarantee"`, `"Trusted by homeowners in your area."` — loaded via
  `hubly.html:13105` and rendered into the **booking wizard** (`bk-review-trust` at
  `:42379`, package trust lines at `:25058`). That is the page a customer reaches to book.
  **Not investigated further and not touched** — it needs its own pass.
- The full parsed class is **102 credential/activity literals across 20 files**. Most of
  the `hubly.html` hits are *advice to the owner* ("Publish licensed & insured language"),
  which is a different thing and fine. The count will move again.

---

## #23 — Two writers, one reader: owner copy stored under a key nothing renders

**Found 2026-09-04, on `graefs-autocare` — our one real detailer. FIXED (reader-side); the
class is now the thing to keep watching, not the three instances.**

Adrian looked at his live site and reported four visible defects, with the framing "I believe
they are all one bug: the renderer draws a container even when it has nothing to put in it."
That framing was right about one of the four and wrong about the biggest one, and acting on it
unmodified would have **deleted five things Graef wrote about his own business**. Recording the
shape, because the next version of this will arrive wearing the same clothes.

### What the four actually were — four causes, not one

| symptom on his page | underlying data | cause |
| --- | --- | --- |
| "Why Choose Us": 5 cards, a ✓ and no text | **present, non-empty** | writer emits `{label}`, renderer reads `{icon,title,desc}` |
| hero trust row: 1 of 3 blank | **empty** (`{label:"",value:""}`) | empty item rendered anyway — the only one that WAS the reported bug |
| "Full Detail": no description | **empty** (`description:""`) | not a rendered box at all; `<p>` is correctly omitted, the blank is grid stretch. Left alone |
| Instagram chip: no logo | n/a | glyph filled `url(#ig-grad)` on a chip painted the same gradient |

### The class: a field written under a name the public renderer does not read

Counted two ways. Parsing every `S.website.<field>` assignment in `hubly.html` (**64 fields**)
against whether anything reads that name back, and running the round trip on all 24
click-to-edit targets across 7 classic pages. Three instances:

1. **`why_choose` → `whyChooseUs`.** `generate-site/index.ts:40` asks the model for
   `why_choose:[{label}]`; `hubly_brain_website.ts:147` builds the same; the renderer reads
   `{icon,title,desc}`. `applyGenerateSitePayload` assigned the array across with no mapping.
   **15 items, 3 businesses, all `market`** (graefs-autocare, devdetailing661,
   bucket-mobile-detailing); visible on 1 page — the other two use the tabbed profile layout
   that does not show the Why section.
2. **`sectionCopy` — the worst of the three.** `commitWsPeInlineValue`, `pe==='sec-title'` /
   `'sec-sub'` (`hubly.html:34725`) writes `S.website.sectionCopy[sec].{title,sub}`. Every
   renderer read the flat `w.<sec>Title` / `w.<sec>Sub`. **Nothing read `sectionCopy`.** So an
   owner clicking a heading on their own page and typing had it saved and never shown again —
   and it has never worked for anyone. Graef lost "my port", "nruh", and a real pricing term:
   *"(Some Higher Level Services may require Deposits and Quotes)"*.
   There is a naming trap under it: the **blueprint** also has a `sectionCopy`, and it is a
   FLAT shape (`servicesTitle`, `galleryTitle`, …) read at `:19109`, while the editor's is
   NESTED (`{gallery:{title,sub}}`). Same name, different structure.
3. **`footerTagline`.** Same handler block, three lines earlier (`:34718`, `pe==='footer-tag'`).
   The identifier appeared **exactly once in the whole file — at its own write**. 0 of 34
   records had used it, so this one was closed before it cost anybody anything.

### THE SIGNATURE, and why nothing caught it

**It works until you refresh.** The edit lands in local state and paints instantly, so every
test that does not reload passes. An audit proving a field is *written* and *read back* does
not prove it *survives a save and a reload* — and that gap is the whole bug.

The round trip that does prove it: `commitWsPeInlineValue` → `buildBizMeta` → **discard
`S.website` entirely** → `applyBizMeta` → `renderWebsite` → is the value on the page.
Before the fix: **13 of 24 click-to-edit targets failed, identically on all 7 classic pages.**
After: 22 of 24 survive.

### The fix, and why reader-side

Reader-side (`wsSectionCopy`, `wsFooterTagline`, `wsWhyTitleOf`), because it rescues copy
already sitting in records without writing to anyone's business data. Non-blank wins only —
a cleared or whitespace value falls through to the existing default rather than blanking a
section, since losing a heading is worse than keeping a stale one.

Plus **one** empty-item pass (`wsPruneEmptyCards`) at the tail of `renderWebsite`, not a guard
in each of the 36 places this renderer emits a repeated element (**0 of which filtered**). It
is deliberately conservative — an element goes only when it has no readable text, no `<img>`,
no `<svg>`, and no background-image, and never in the editor view, because an owner has to see
an empty slot to fill it. The deliberate-break test proved the `<svg>` guard is load-bearing:
removing it eats the TikTok icon.

### STILL OPEN

- **`store-title` / `store-sub`** (`pe`, `hubly.html:34692`) fail the same round trip on all 7
  pages. Their reader exists (`:39737`) but sits inside `sf.loadPublic(bizId).then(...)` and
  needs a business with an active store product — **unprovable with the current corpus**, so
  not counted as broken and not fixed. Check it the day one exists.
- **`footer-cta`** failed the round trip on 2 of 7 pages (aquaspeed, cedar-ridge-plumbing) and
  survived on 5. Layout-dependent; not the clean class; not investigated.
- **`_trustClearedByOwner`** — dead state I created that morning in `22fda62`: its only reader
  was the trust auto-fill that commit removed. The write is now gone too. Records that already
  carry the flag are harmless.

---

## #24 — `site_mode` does not route. Do not trust it.

**Found 2026-09-04. Not a defect to fix — a trap for the next reader.**

The `businesses.site_mode` column reads `classic` for **all 34** claimed businesses, including
the **24 that actually render on the freeform document renderer** (`#p-hubly-document`). Only
**10** render `#p-storefront`. What routes is whether `get_public_business_document(slug,'website')`
returns HTML — not the column.

I would have reported "all 34 are on the classic renderer" if I had read the column instead of
rendering the pages. The check that costs nothing: load the page and read which `.page.active`
you got.

The 10 genuinely on the classic renderer, which is where every defect in #23 lives:
`adrians-lawn-service, aquaspeed, bucket-mobile-detailing, cedar-ridge-plumbing, cotter-aviation,
devdetailing661, graefs-autocare, my-auto-detailing, my-photography, star-windows`.

---

## #25 — Booking-frame credentials: cleaned, seeding stopped, 4 businesses left holding

**Found 2026-09-04, fixed 2026-09-05. The unfinished half of #22.**

`public/booking-frames/*.json` supplies the booking wizard's copy. It carried
credential claims Hubly has no way to know — `"Licensed & Insured"`,
`"Background-checked cleaners"`, `"100% Satisfaction Guarantee"`,
`"Trusted by homeowners in your area."` — on the screen where a customer decides
to let a stranger into their home.

### The count moved twice, both times because the first list was of SHAPES

- First pass: **47** "credential literals", from a regex over raw file text. Wrong
  method — the enumerate-the-valuable-side mistake, fifth instance.
- The files actually hold **332 strings** (300 customer-capable, 32 `ownerTips`).
  Sorting the six fields that can carry a credential gives **121**: **A=34 remove,
  B=72 keep, C=15 ambiguous**. Verified by script: 0 unsorted, 0 sorted-but-absent.
- Then, mid-fix, a **second file of the same class** turned up — and it is the one
  that actually renders (below).

### WHAT ACTUALLY REACHES A CUSTOMER — walked, not grepped

Walking the real flow to the Review screen (nothing submitted):

- **`sidebarIncludes`** — the booking summary, visible on **every** step. Customer-facing.
- **`reviewTrust`** — the Review screen. Customer-facing.
- **`whereOptions`, `infoFields`** — customer-facing.
- **`trustLines`, `benefitOptions`, `cancelBlurb`, `helpBlurb`, `ownerTips`** — never
  appeared on a customer screen. `benefitOptions` is the owner's preset menu;
  `trustLines` renders only in the owner's package preview (see #26).

And the source depends on whether the business has been seeded:

| | source of the booking sidebar |
| --- | --- |
| 4 businesses with a seeded `meta.bookingWizard` | their own record — a JSON edit cannot reach them |
| the other 30 | **`public/smart-quote/engine.js`** recipe `includes` — NOT the frames |

So the frames' claims were a template for the future; the claims a customer could
read *today* came from `engine.js`. Proven on `star-windows`, whose sidebar showed
`"Interior & exterior options · Ladder-safe habits · No-streak standard"` — that is
`engine.js:64`, and none of it is in `windows.json`.

### What was done

1. **All 8 frames cleaned** — 49 edits. Bucket A removed. Bucket C per ruling:
   guarantee-welded-to-a-policy split (keep the policy, drop "guaranteed"),
   character adjectives stripped ("Upfront, Honest Pricing" → "Upfront Pricing"),
   safety promises removed, "Eco-friendly products" / "Local crews you recognize" /
   "Premium Products" removed. Every field outside the six is byte-identical, and
   all 72 bucket-B strings are still present — both checked by script.
2. **Seeding stopped** for `trustLines` and `sidebarIncludes`, in both paths
   (`booking-frames/registry.js` `frameDefaults`, and `booking-wizard/ui.js`). These
   are the business's own assertions to a customer; copying a template's values into
   a real record makes Hubly the author of a claim nobody made — the #22 auto-fill
   defect one level over. `benefitOptions` still seeds ON PURPOSE: it is the preset
   menu the owner picks from, and nothing reaches a customer until they select it.
3. **`smart-quote/engine.js`** — the same rulings applied verbatim to the identical
   strings in the file that actually renders: `'Satisfaction guarantee'` and
   `'Pro products'` (detailing), `'Ladder-safe habits'` (windows),
   `'Background-checked crew'` (cleaning), `'Licensed techs'` (hvac),
   `'Licensed practitioners'` (spa).

### STILL OPEN — do not read this as "the class is closed"

- **4 businesses carry a PERSISTED `meta.bookingWizard`**, seeded before this change,
  so no code change reaches them. **2 are market.** Same shape as #22's three:
  - `graefs-autocare` (**market**) — `sidebarIncludes` includes `"5-star rated service"`,
    live on his booking sidebar. `trustLines: ["100% Satisfaction Guarantee",
    "Convenient & Hassle-Free","Premium Products"]`.
  - `bucket-mobile-detailing` (**market**) — `"Insured & background-checked"`,
    `"5-star rated service"`, `"Fully insured mobile service"`.
  - `adrians-lawn-service` (test), `cotter-aviation` (internal, empty).
  **HANDLED BY CONVERSATION, 2026-09-05 — not by a write.** Adrian spoke to **both** Austin
  Graef and Bucket Mobile Detailing about the claims Hubly had written into their records.
  **Both said they would update the values themselves.** No write to their data by us, and
  that stays the rule: these are owner-editable fields and the owners have been told. The
  code path that created them is closed (seeding stopped in `registry.js` `frameDefaults`
  and `booking-wizard/ui.js`), so the set cannot grow. `adrians-lawn-service` (test) and
  `cotter-aviation` (internal, empty) need nothing.
  This is the honest end-state for a class like this: **the defect is closed in code, the
  data is the owner's, and the owner has been told.** It is not "still open", and it is not
  "fixed" either — recording it as handled-by-conversation is the only description that is
  true.
- **Three strings left unruled in `engine.js`**, deliberately not guessed:
  `'Reliable routes'` (landscaping — the adjective rule applies but "Routes" alone
  reads wrong), `'Careful around plants'` (pressure_washing), `'No-streak standard'`
  (windows).
- **One string in the frames was never ruled on** and was removed by the same logic
  as the safety promises: `pressure_washing.reviewTrust` =
  `"Powerful results. Property care you can see."` One line, easily put back.
- **Two claims Hubly composes in code, not in a template**, both live and both out of
  scope here: `hubly.html:42587` prefixes the Review screen with
  `"✓ We take care of your property"`, and `smart-quote/booking.js:445` writes
  `"Trusted by customers who book online."` under the rating. Same principle, different
  file.
- **`modern-landscaping-business` (market)** renders `"Add services to show them here."`
  on its booking landing — #18 family, on a market page.

---

## #26 — "Add trust lines customers see on review." No customer sees them.

**Found 2026-09-05 while working #25. NOT FIXED — recorded with both possibilities named,
because which one it is decides the fix.**

`public/booking-wizard/ui.js:544` tells an owner, above a "+ Add trust line" button:

> **"Add trust lines customers see on review."**

`w.trustLines` is written by `updateTrustLine` (`:182`), `addTrustLine` (`:195`) and
`removeTrustLine` (`:204`), and persisted. **No customer-facing code reads it.** Parsed
across `hubly.html`, `smart-quote/*.js` and `booking-wizard/*.js`, `trustLines` has
exactly one reader outside the editor: `isPkgPreviewTrustLines()` (`hubly.html:24735`),
which paints into `#is-pkg-preview` — a mockup shown to the OWNER, labelled
`"Edit packages on the left — this is how customers will see them."` (`:25071`).

Two lies stacked, not one:

1. The editor says these lines appear on the customer's review screen. They do not. The
   review screen (`#bk-review-trust`, `hubly.html:42587`) renders `reviewTrust` and falls
   back to `cancelBlurb` — a different field entirely.
2. The one surface that draws trust lines reads **`frame.trustLines`**, not the owner's
   `w.trustLines`. So even in the owner's own preview, their edits never show — and that
   preview is labelled as what customers see.

**The two possibilities, both plausible, neither confirmed:**

- **(a) Broken feature.** Trust lines were meant to render on the customer's review
  screen and the render was never wired, or was lost when `reviewTrust` was added. Fix:
  wire `w.trustLines` into the review screen and make the preview read the owner's value.
- **(b) False label.** Trust lines were only ever owner-preview chrome and `reviewTrust`
  superseded them. Fix: correct the editor copy, and have the preview read the owner's
  value or stop claiming to be the customer's view.

Evidence tilts to **(b)** — the review screen has a dedicated trust slot fed by a
dedicated field — but that is a reading, not proof.

**This is the same family as Graef's stranded headings (#23):** the editor telling
someone their work landed somewhere it did not. Different mechanism (there, a writer with
no reader; here, a reader that reads the wrong source and a label that overclaims), same
cost to the person typing.

---

## #27 — The assistant cannot see the business it runs. BUILT 2026-09-05 (read-only half).

**STATUS: the read path ships. `hubly-conversation` v236.** The assistant now receives live
operational state — bookings, upcoming jobs, leads — on every turn where a **verified owner**
of **that** business is talking, and can also read it on request via a new `operations.read`
capability. Read-only by design: it reports, and cannot accept, decline, reschedule or
message anyone. Operational *action* is a separate, deliberate decision.

**Shape (`_shared/hubly_operational_state.ts`): a registry of SLICES, not a booking special
case.** Each slice is a named reader returning rows plus an honest empty line. Adding
invoices or memberships or revenue is one reader and one line in `SLICES` — the capability's
argument enum is derived from that same registry, so a new slice cannot silently drift out of
the list the model is offered. This is step one of chat-plus-generated-views; the tab
machinery and view system are deliberately absent, and this only had to avoid making them a
rewrite.

**A BLOCK, NOT A TOOL CALL.** A capability round costs a round out of
`MAX_CAPABILITY_ROUNDS` and several seconds of silence; the block is simply present. The
owner never has to ask whether he has bookings.

**Security — the settled rule and nothing else.** `resolveOwnerUid()` (a real user JWT,
verified server-side against `/auth/v1/user`) plus `loadOperationalState` re-checking that the
uid owns THIS business. `context` is never consulted, and `check-owner-id-invariant.mjs`
check 3 fails the build if anyone reaches for it. `operations.read` is on
`DRAFT_INJECTED_ACTIONS`, so check 2 covers it too — the scanner reports 9 owner-reading
actions now, all on the list.

**Never invent.** An empty slice prints "none on record"; a failed read prints "could not be
read — say you could not check, not that there are none". A count is never estimated and a
customer is never named who is not in a row.

### Proved

- **The block says true things.** Rendered from Graef's real rows: 6 bookings with real
  names, dates, services, statuses and contact details; "UPCOMING JOBS: none on record".
- **The empty case is honest and calm** — `window-washing` renders three "none on record"
  lines and nothing else, at a cost of 49 tokens.
- **The gate refuses, live, on the deployed function.** An anonymous caller carrying only the
  publishable key asked "do I have any bookings?" against Graef's business id and got **no
  operational data** — the assistant said it had no connected booking records. Graef's six
  real bookings were not leaked.
- **Cross-business reads are refused** by `biz.owner_id === ownerUid`; a verified owner of one
  business does not match another's owner id.

### NOT proved, and it is the acceptance test

**An owner signing in and reading the sentence.** I cannot authenticate as a real person's
account, and doing so to produce a screenshot would be exactly the fabricated-state defect
this repo has a rule against. **Adrian runs this leg.** Everything up to the JWT is proved
above; the JWT is the one link I cannot supply.

### Cost per turn

**Tokens:** ~423 for Graef (6 bookings + 5 leads, the busiest real business), ~49–56 for a
quiet one. The block scales with rows and is capped at 8 per slice.
**Latency:** the four reads now run in parallel, so the added cost is one round trip, not
four. Measured from outside the datacenter before parallelising: ~790ms for four sequential
reads; the edge function sits beside the database, so the real figure is well under that.
**An anonymous visitor pays nothing** — `getOwnerUid()` short-circuits and no query runs.
If it ever becomes material, `buildOperationalSummaryLine()` is already there: counts only,
no names, no amounts.

### Renderer

**It works for classic and freeform alike, and needed no client change.** The block lives in
the conversation function and depends only on `draftBusiness.id` plus a verified owner —
neither is renderer-specific. The client already sends both on every turn (`hcFreshToken()`
plus `draftBusiness`). Confirmed against data: the block renders identically for
`graefs-autocare` (classic) and `window-washing` (freeform). **Bucket and Graef are both
covered.**

### A consequence worth naming

The first thing this feature would have told Austin Graef is that he has **five leads from
"Test Customer"** — the rows my own verification harness wrote on 2026-09-05. The `[TEST]`
note tag only started that day, so those rows carry no tag. `isTestRow` therefore also
recognises the **NANP reserved-for-fiction range** (555-0100…555-0199), which can never
belong to a real person. That is a general rule rather than a hack about one harness, and it
is the cheapest form of #29's `test_actors` idea. **A feature that surfaces operational data
inherits every piece of junk in that data** — the marking problem stopped being cosmetic the
moment the assistant could read.

---

## #27a — ORIGINAL FINDING, kept for the measurement that produced it

**Measured 2026-09-05 by parsing the capability registry and the prompt assembly, not by
reading the prompt and inferring. NOT FIXED — sized here because it decides what Hubly is.**

### What the assistant can DO — 4 capabilities, 23 actions

| capability | actions |
| --- | --- |
| `storefront` (11) | listCatalog, createProduct, updateProduct, setProductVisibility, addVariant, updateVariant, createCollection, addProductsToCollection, configureStore, generateStorefront, patchStorefront |
| `website` (7) | analyze, generateDocument, newPage, patchDocument, setChrome, setDesignKnob, restyleElement |
| `business` (4) | create, startDraft, updateDraft, setServices |
| `booking` (1) | **getAvailability** |

**22 of 23 actions BUILD the presentation. One reads anything, and it reads free slots —
not bookings received.** There is no action for leads, jobs, customers, memberships,
orders or revenue. Note also that the 11 storefront actions exist against a
`commerce_products` table with **0 rows** — a fully-built room whose door nobody has
opened.

### What the assistant can SEE — 18 fields, none operational

`BusinessRecord` (`hubly_capability_registry.ts:274`) is titled to the model as
*"everything Hubly actually knows about this business"*. In full: services, photos,
reviews, hours, hoursNote, areaCities, city, state, travelRadiusMiles, yearsInBusiness,
phone, email, address, logoUrl, businessType, about, tagline.

**Every field is a presentation fact. Not one is operational.**

And it is worse than that, in the codebase's own words
(`hubly-conversation/index.ts:174`):

> *"the conversation model never sees the business record (buildBusinessRecordBlock is only
> ever assembled for document GENERATION)"*

So in an ordinary chat turn the assistant does not even have the presentation record. Every
table the conversation path touches, parsed: `create_business_document`,
`patch_business_in_progress`, `document_build_jobs`, `set_business_hours_in_progress`,
`start_business_in_progress`, `set_business_draft_services`, `record_planner_fallback`,
`document_vocabulary_rejections`. **Every one is about building a page.** It reads
`services` once, narrowly, so the post-build ask does not re-ask for prices it already has.

**Corroborated by the owner.** Austin Graef, 2026-09-05: when a booking comes in he gets an
email; *the Hubly assistant does not tell him.* He finds out from email only. The code says
it cannot.

### Is there any notification surface in the product at all?

**No.** Grepping every owner surface for a badge, an unread count, an inbox or a
"since you last logged in": the only hits are `journey-os/ceo-demo.js`, a seed-data fixture
full of invented names — a mock of the feature, not the feature.

The nearest real thing is a realtime subscription (`hubly.html:15873`) on `jobs`,
`booking_requests` and `customers` — but its handler only **re-renders dashboard views that
are already open**. No badge, no toast, no persistent marker. If the owner is not looking at
the dashboard, nothing tells them. **Email is the only channel that ever informs an owner.**

And that channel has a hole: of the 7 businesses that have received a booking, **2 have no
owner email on file**, and on 2026-09-01 the only market booking since the notify trigger
was built (`lugnuts-regulators`) had its owner notification **skipped — "no recipient
address"** while the customer's confirmation sent fine.

### Sizing: what would read access take?

**Mostly a capability-registry addition, not a structural build.** The three things it
needs already exist:

1. **A template.** `booking.getAvailability` is exactly the shape — an argsSchema, an
   admin client, a business-scoped query, and an honest `real: false` when it cannot
   answer. `booking.listRecent`, `leads.list`, `memberships.list` are the same shape.
2. **An auth floor.** `getOwnerUid()` resolves a verified owner from the JWT, and #20
   closed the class where an action forgot to use it. A read that returns someone's
   bookings **must** be owner-gated, and the gate is already built and already audited by
   `scripts/check-owner-id-invariant.mjs`.
3. **A context slot.** `buildBusinessRecordBlock` is the pattern for handing the model data
   as DATA rather than prose, including its "none on record" discipline.

**Rough size: days, not weeks, for read access to bookings, leads and memberships** — three
actions plus an operational block in the chat turn's prompt.

### THE SAFETY QUESTION — ANSWERED 2026-09-05, and it unblocks this finding

The concern was that the same assistant serves the **public customer chat** and the **owner
builder**, so a capability returning a booking list could be reachable from the wrong side.
Traced:

- **`context` is caller-declared and is NOT a boundary.** `hubly-conversation/index.ts:941`:
  `body?.context === "customer" ? "customer" : body?.context === "operate" ? "operate" :
  "dashboard"`. Anyone POSTing to the function can send `"dashboard"`. It shapes the prompt
  and the understanding adapter. **It proves nothing about who is calling.**
- **`resolveOwnerUid()` IS a boundary** (`:1548`): it rejects anything that is not a user
  JWT (the anon/publishable key fails the `eyJ` test) and **verifies the token server-side
  against `/auth/v1/user`**.
- **The ownership assertion already exists** in ten places:
  `String(biz.owner_id) !== String(ownerUid)` → refuse.

**So the function CAN tell an owner from a customer, reliably — just not with the field that
looks like it does.** The rule for every operational read capability:

> **Gate on `getOwnerUid()` AND on that uid owning THIS business. Never on `context`.**

That is a design rule plus a scanner, not a build. **Enforced by
`scripts/check-owner-id-invariant.mjs` check 3**: zero capability handlers may read
`context` in code, and zero refusals may be decided from it. A hardcoded list of forbidden
handlers would go stale the first time someone added one — every hardcoded list in this
codebase has silently dropped an entry — so it scans. Proven by writing both violations on
purpose (a `listRecentBookings` handler gated on `context === "dashboard"`, and a
`context`-decided 401 in the conversation function) and watching each fail.

The remaining unknown is the one in #19 — whether a customer can authenticate at all — and
as of 2026-09-05 that is **no longer blocking either**: gated digital delivery turned out not
to be the requirement, so nothing is sized by it.

### Why this may be the highest-leverage gap in the product

The claim against Base44 is that **Hubly runs the business rather than presenting it.**
Measured against that claim: 22 of 23 capabilities present, 1 reads free slots, the context
is 18 presentation fields, and the owner finds out about his own bookings by email.

**An assistant that cannot tell an owner about his own bookings is a chat box beside a
website editor — which is a thing Base44 also has.** Everything that makes the pitch true
is on the other side of read access. This is not a feature request; it is the difference
between the product we describe and the product that exists.

---

## #28 — A booking arrived and nobody could be told. The address was never missing.

**Found 2026-09-05 in the `notification_deliveries` ledger. FIXED the same day.**

On 2026-09-01 a booking reached `lugnuts-regulators` (market). The customer's confirmation
sent fine. The owner notification was **skipped — "no recipient address"** — and the only
trace was a ledger row nobody reads. *(The booking itself was Adrian's own test; the defect
is real regardless, and was found because the row looked like it wasn't.)*

### The address was there the whole time

All 5 market businesses with a null `businesses.email` have an owner with a working address
in `auth.users` — the address they signed up with. `lugnuts-regulators` →
`kaptn.awesome@gmail.com`. **The notifier read one column and gave up.**

### THE ROOT CAUSE — this is the actual bug; the fallback is the mitigation

**Exactly one code path in the entire product ever sets `businesses.email`:**
`claim-draft-business/index.ts:151` — `.update({ owner_id: user.id, email })`.

**Every other route to an owned business sets `owner_id` and never touches `email`.** The
column is nullable with no default, so a business claimed by any other path is born
unreachable and nothing notices. Measured: **141 of 159 businesses have no
`businesses.email`; 24 of those are claimed; 5 are market.**

Deliberately NOT fixed with `NOT NULL` or by gating signup on an email — that trades a
silent miss for a blocked signup, and the claim path already captures the address, it just
does not propagate it. The propagation gap is still open and should be closed at the source.

### The class, counted by parsing

A first scan said 23 and was wrong — it counted `return jsonRes({error}, 400)`, which is a
*visible* failure. Narrowed to paths that actually notify:

| site | on a missing recipient | who could see it |
| --- | --- | --- |
| `booking-notify/index.ts:139` | ledger row `status='skipped'` | a table no product surface reads |
| `booking_notifications.ts:116` — `notifyBookingCreated`, provider branch | `if (input.business.email) {…}`, **no else** | nothing |
| `booking_notifications.ts:150` — customer branch | same shape | nothing |
| `booking_notifications.ts:206` — `notifyCustomerMessage` | `return false` | caller's choice |

And **3 of 4 callers discarded the answer**: `booking_engine.ts:804` and `:1000` threw the
result away entirely; `hubly_booking_execution.ts:447` read `.customer` and ignored
`.provider`. Only `marketplace/index.ts:1502` returned it. **The function was honest; its
callers were not listening.**

### The fix, three layers

1. **Resolve the recipient properly** — `businesses.email` → the owner's `auth.users.email`
   → nothing (`booking-notify/index.ts`). No write to anyone's data; the address already
   exists.
2. **Stop the discards** — both `booking_engine.ts` sites now capture the result, and
   `hubly_booking_execution.ts` now reads `.provider`. All three log an UNREACHABLE OWNER
   error naming the business.
3. **Make it loud** — after the fallback, an unreachable owner is rare and abnormal, so it
   emails the operator at `PLATFORM_OWNER_EMAIL` (already configured). The person who needs
   to know is us; the owner is unreachable by definition.

### Proof, measured against the real database (read-only)

Running the same two lookups the function now runs, in the same order, over all 34 claimed
businesses:

- **10** resolved from `businesses.email` — worked before, still does.
- **24 recovered by the fallback** — could not be notified before, can be now. Including all
  5 market: `lugnuts-regulators`, `window-washing`, `modern-landscaping-business`,
  `mobile-auto-detailing-in-los-angeles`, `detailing-chemicals-equipment-courses`.
- **0 genuinely unreachable.**

**Honest limit on that last line:** because no business in the corpus is unreachable, the
loud-failure branch **could not be exercised against real data**. Forcing it would mean
writing to a business's record or sending mail, neither of which was authorised. It
typechecks (`deno check`), the branch is present, and `PLATFORM_OWNER_EMAIL` is configured —
but **it has not been run.** That is the one claim here that is read, not executed.

---

## #29 — Nothing in the data distinguishes a real event from our own test of it

**Recorded 2026-09-05. STOPGAP APPLIED; the durable answer is designed here and NOT built.**

### ESCALATED the same day: this stopped being a convenience and became a USER-FACING cost

It was filed as something that wasted *our* time — three findings escalated as incidents,
all three Adrian's own testing. Then #27 shipped and the assistant could read operational
data, and the calculation changed: **a feature that surfaces operational state inherits every
piece of junk in that state.**

Concretely, and measured: the first thing the new operational block would have told Austin
Graef is that he has **five leads from "Test Customer"** — rows our own harness wrote that
morning, before the `[TEST]` tag existed. Not a report we read; a sentence the product says
to a paying customer about his own business.

That was patched by teaching `isTestRow` the **NANP reserved-for-fiction range**
(555-0100…555-0199), which can never belong to a real person — general enough to be honest,
and the cheapest possible form of the `test_actors` idea below. But the patch only covers
rows whose phone happens to fall in that range. **Every future surface that reads operational
data — the schedule view, the jobs view, any generated view, any notification digest —
inherits the same exposure, and each one will need its own version of this guard unless the
classification lives in the data.**

So the priority changes: **not now, but no longer optional.** The derived view (below) is
what makes it stop being a per-surface problem, because it classifies once and every reader
gets the same answer.

**Three separate findings in one session were escalated as customer-facing incidents and all
three turned out to be Adrian's own testing:** Graef's six bookings, the seeded booking-wizard
records, and the `lugnuts-regulators` skipped notification. Each cost real time and, twice,
alarm.

**The cause is not carelessness, it is the column.** `account_kind = 'market'` means *"not
labelled test"* — and Adrian tests on market-labelled businesses, because testing on
Bucket's site is the only way to test Bucket's site. So **every inference drawn from that
column has been shakier than it was stated to be**, including several in this file. The
business-level flag cannot answer a row-level question.

This gets sharply more expensive when Bucket is live and judging us: **we will need to tell
his real booking from our test of his site in one glance, and right now nobody can** — not
Adrian, not Claude Code, not a query.

### STOPGAP, applied 2026-09-05 — option A

A `[TEST]` marker in `booking_requests.notes`, following the convention that column already
uses (`[SMS_CONSENT:yes]`, `[RETURNING:yes]`, `[RPJOB:…]`, `[source:…]`). The verification
harness now stamps it. **Cost near zero; greppable; not enforceable, and only covers
bookings.** It is a stopgap and should be read as one.

### THE REAL ANSWER — option C, designed, not built

**A `test_actors` table keyed on phone/email, plus a derived view.** The discriminator is
**who acted**, not which business — which is the property actually required, because it
**survives a real booking arriving at a business we also test on**. Test identities are
already half-conventional in the data: `@hublytest.dev` addresses and `adriansmithee+tN@`
aliases both appear in `auth.users` today.

Rejected alternatives and why:

- **B — an `is_test boolean` column per event table.** A writer that forgets it defaults to
  "real", which is the wrong direction: per the `account_kind` scar, the honest default is
  the unflattering one. If ever built it wants `null` = unknown, not `false` = real.
- **D — a dedicated test business per trade.** Zero code and fails the requirement outright:
  we specifically need to test *Bucket's* site.

**Derived first, stamped later.** A view over known test identities **classifies history**,
including the 13 rows the harness wrote on 2026-09-05, and needs no migration and no writer
changes. Stamping at insert is more trustworthy long-term because it is immutable and cannot
be broken by an actor later changing their address — but it only works going forward. Build
the view first for the retroactive answer, add the stamp when there is a reason to trust it
over time. **Not built now, deliberately: it saves time, and time is not what is scarce this
week.**

---

## #30 — A remote service cannot be booked today. The wizard demands an address.

**Measured 2026-09-05 by walking the live flow on `graefs-autocare` (detailing, classic —
the same blueprint and renderer Bucket is on). Nothing written: the only write in the
booking flow is `writeAbandonedBookingRequest()`, called from `bkNext(3)`, and the walk
stopped at step 3 without calling it. READ-ONLY. NOT FIXED.**

Bucket's trainings are a bookable service delivered over a video call
(`docs/BUSINESS.md` → Prospects). So the question is whether the existing wizard can sell
one as-is. It cannot, for two reasons, both observed rather than inferred:

**1. Every location option demands a street address.** `addressMode` has exactly two values
in the whole codebase — `"studio"` and `"customer"` — resolved at three consumers
(`hubly.html:41773`, `:42179`, `:42204`). Walked on Graef's site, all three where-options
resolve to `addressMode: "customer"`, `hasRemoteMode: false`, and advancing step 2 with the
address blank is refused:

> **"Enter your service address"**

A remote training would therefore either demand the customer's home address for a video
call, or borrow `studio` mode and show the *business's* address. Both are wrong in a way a
customer notices.

**2. It would ask for their car.** `bookingNeedsVehicle()` returns `blueprintHas('vehicleDetails')`
— a **per-BUSINESS-TYPE** flag, consulted at 11 call sites and **never per-service**.
`detailing.json` has `vehicleDetails: true`, and the walk confirms `bookingNeedsVehicle()`
is `true`. So a training sold by a detailer asks the buyer for year/make/model/colour.

### The shape of the fix, since the finding is "impossible without code"

Smaller than it sounds, and both halves are narrow:

- **A third `addressMode`** — `"remote"` (or `"none"`) that skips the address requirement,
  labels the location as the call rather than a place, and leaves the `.ics`/calendar
  location empty or set to the meeting link. Three consumers, all named above.
- **Make the vehicle question per-service, not per-trade.** This is the sharper of the two
  because it touches 11 sites and is a real behaviour change for existing detailers. The
  cheap version is a per-service opt-out flag consulted alongside the blueprint; the honest
  version is that "what this service needs to know" belongs on the service, not the trade.

Neither needs a meeting link to exist first — a training can be booked and the link sent in
the confirmation. **Auto-generating a meeting link is a separate, later feature and should
not be allowed to inflate this one.**

---

## #31 — `design_rationale` stores a conversation decorator, not the plan

**Found 2026-09-05 while debugging #16 attempt 1. Recorded, NOT chased.**

`business_documents.design_rationale` is documented in `hubly_capability_registry.ts` as the
plan the freeform planner committed to, and specifically as *"the cheapest debugging artifact:
when a page comes out wrong we can read what it MEANT to build."*

On at least some builds it is not that. Every one of the four pages generated on 2026-09-05
stores a rationale ending:

> `… Nice work — this is a real milestone.`

That string is `hubly_brain_experience_director.ts:413` — a **conversation reply decorator**,
appended to a chat response. The stored text is also truncated with a literal `…` at ~558
characters, so it is neither the whole plan nor only the plan.

**Why it matters beyond tidiness:** this field is the designated instrument for exactly the
investigation that was running. Reading it, the plan looked complete and simply lacked the
SHAPE line — which pointed at the planner ignoring an instruction. The real answer was the
same, but confirming it took an extra pass through the render chain to prove nothing
downstream was stripping the CSS net. **A debugging artifact that is unreliable costs most
precisely when it is being relied on.**

Not chased: the four pages went through `runFreeformGeneration` (confirmed by the stored
document's key shape — `brief,images,generatedAt`), which sets
`p_design_rationale: gen.plan`. So either `gen.plan` itself carries the decorator, or a
second write overwrites the row's rationale afterwards. **Both are one query away and neither
was on tonight's path.** It will pay for itself the next time the generator misbehaves.

---

## #32 — A sale told nobody. Built 2026-09-05, unproven until the first real order.

**Traced 2026-09-05 while sizing physical goods. FIXED (built), NOT YET EXERCISED.**

Grepping `notify|sendEmail|resend|twilio|notification_deliveries` across
`_shared/commerce_checkout.ts`, `create-store-checkout/index.ts` and
`commerce-api/index.ts` returned **zero hits**. `finalizePaidCommerceOrder` marked the
order paid, linked a customer, deducted inventory, converted the cart — **and told
nobody.** Not the owner, not the buyer.

**Worse than the booking defect it mirrors (#28).** `booking-notify` at least tries and
writes a `notification_deliveries` row when it skips. Commerce had **no notifier to
skip**: nothing to log, nothing to count, and no way to discover afterwards that a sale
had gone unheard. A silent failure you cannot even measure is the worst version of it.

Built before the first purchase deliberately — `commerce_orders` is 0, so there was
exactly one chance to have this in place *before* a sale rather than after one went
missing.

### `_shared/commerce_notify.ts`, following what already works

- **Recipient resolution** — `businesses.email` → the owner's `auth.users.email` → a
  loud operator alert to `PLATFORM_OWNER_EMAIL`. The same fallback built for #28, where
  the address was never missing: 141 of 159 businesses have a null `businesses.email`
  because exactly one code path ever sets it.
- **`notification_deliveries` on every path** — `sent` with the provider receipt,
  `failed` with the reason, `skipped` with "no recipient address". `subject_type` is
  `commerce_order`, so store notifications are queryable separately from bookings.
- **The buyer gets a HUBLY confirmation**, not a reliance on Stripe's receipt — that
  depends on dashboard settings we neither control nor can see, and a confirmation that
  exists only if a setting happens to be on is not one we can promise.
- **No reply-to-a-dead-inbox**: the buyer email points them at the business, per the
  notification standard.

### A double-send this uncovered

`stripe-webhook` calls `finalizePaidCommerceOrder` from **both**
`checkout.session.completed` *and* `payment_intent.succeeded` — and Stripe retries
deliveries. So for one ordinary purchase the function runs more than once. The existing
`.neq("status","paid")` guard made the WRITE safe but told the caller nothing, and the
read at the top only catches the sequential case. Now the update does `.select("id")`
and the notification fires **only for the delivery that actually flipped the row** —
one "You sold $X" per sale, not one per webhook.

### Proven, and not

**Proven** by exercising the decisions against a stub with `RESEND_API_KEY` unset, so
nothing was sent: business-email present → used; business-email empty → **auth email
used**; neither → `skipped` ledger row **plus** the operator alert row; no `owner_id` →
same. Every path writes a ledger row.

**NOT proven:** no email has actually been sent, because no order exists. `commerce_orders`
is 0 and the Connect account is live-mode, so a real checkout was correctly not run.
**This gets verified against the first test-mode order, in the same pass.** Until then it
is built and deployed, not demonstrated.

### The orders slice

`hubly_operational_state.ts` gains an `orders` slice — the registry is now
`bookings, jobs, orders, leads`, and the capability's argument enum derives from that
list so it picked the new key up with no second edit. **Deliberately not verified against
an empty table**: proving "STORE ORDERS: none on record" says nothing. It is wired and
waits for the first real order.

---

## #33 — The Edit-details panel renders blank contact fields when the session is dead

**Found 2026-09-05 while attributing a burst of `42501` in the Postgres logs. FILED, NOT
FIXED. Second symptom of the stale-token root cause already noted at
`platform-home.html:5380` (found 2026-09-01).**

### What happens

`hcReadRecord()` — `platform-home.html:4265`, behind the **"Edit details"** button:

```js
var c = await authGetClient();   // anon key + persisted session; ANON if the session is gone
var biz = await c.from('businesses').select('phone,email,address,hours_note').eq('id', id).maybeSingle();
...
hcManage.contact = (biz && biz.data) || {};
hcManage.note    = (biz && biz.data && biz.data.hours_note) || '';
```

`authGetClient()` builds a client on `SUPA_ANON_KEY` with `persistSession`. With a live
session it sends the owner JWT; **with a dead one it sends the anon key**, and anon's grant
on `businesses` is exactly `id` and `slug` — verified:

```
select=id ALLOWED   select=slug ALLOWED   select=id,slug ALLOWED
select=name DENIED  select=phone DENIED   select=email DENIED
select=owner_id DENIED   select=meta DENIED
```

So the read returns `401 / 42501 permission denied for table businesses`. supabase-js
returns `{data:null,error}` rather than throwing, so `|| {}` swallows it, the `catch` at
`:4395` never fires, and **the owner sees blank phone, blank email, blank address and blank
hours where real data exists, with no error anywhere.**

### Reachability — precisely

- **Claimed business only.** The button is CSS-gated: `#hcManageBtn{display:none}` and
  `.hc-app.hc-claimed #hcManageBtn{display:inline-flex}` (`:391`, `:395`). An unclaimed
  draft cannot reach it.
- **Dead session.** `hc.draftClaimed` is still true in page state while the refresh token
  has expired, been revoked, or been cleared — a tab left open overnight is the ordinary
  case.
- Reproduced against a real business id with the publishable key; both denials confirmed.

### What limits it

**A save cannot write the blanks back.** `hcRecordEdit()` (`:4272`) calls `hcFreshToken()`
first and returns *"You need to be signed in to edit this."* when there is no token. So this
is a **display** defect, not a destructive one — it is NOT the `sectionCopy` shape (#23),
where an owner's real work was discarded.

### THE TWO-DENIAL SIGNATURE — for whoever reads the logs next

One click of "Edit details" produces **two** `42501`s in the same instant:

| table | result |
| --- | --- |
| `businesses` (`select=phone,email,address,hours_note`) | **401 / 42501** |
| `settings_business_hours` (`select=weekday,...`) | **401 / 42501** |
| `services` | 200 `[]` — RLS filters rather than denying |

**That pairing is the tell.** `businesses` denials *without* a matching
`settings_business_hours` denial in the same window are not this panel — they are a script
probing with the publishable key. That distinction settled the 2026-09-05 burst: fifteen
`businesses` denials, zero `settings_business_hours`, therefore probing, not the product.

### The fix, when it is done

Check the session before reading, and surface the failure instead of rendering blanks —
"couldn't load your details, sign in again" is honest; four empty boxes are not. The same
check belongs anywhere `authGetClient()` reads an owner-only table.

---

## #34 — BLOCKING: Stripe refuses Accounts v1, so NO new owner can connect Stripe

**Found 2026-09-05 by clicking "Connect Stripe" as a signed-in owner, in test mode.
This blocks the physical-goods purchase walk at step zero, and it would block Bucket
in live mode too.**

`stripe-connect-onboard` creates the connected account with `POST /v1/accounts`
(`_shared/stripe.ts:150`, `createExpressAccount`, `type: express`). Stripe now rejects
that call on this platform account. Reproduced deterministically against **both** test
businesses, HTTP 500 both times, with the same message. Stripe's reply, quoted as data:

> "Stripe no longer recommends Accounts v1 for new Connect integrations. Create connected
> accounts with `POST /v2/core/accounts` instead… If your integration requires v1 account
> creation for a supported compatibility scenario, enable Accounts v1 support in the
> Dashboard: `https://dashboard.stripe.com/settings/features/feat_accounts_v1_support`."

**Nothing is written when it fails** — `stripe_connect_accounts` was 0 before and 0 after
two attempts. The failure is clean, just total.

**Consequences, in order of how much they cost:**

1. **`create-store-checkout` requires `connect.charges_enabled`** (`index.ts:63`) and
   returns `503 / not_configured / "Stripe Connect is not ready for this business"` without
   it. That refusal is honest — there are no fake payments — but it means the store cannot
   take a single dollar until a connected account exists. **The purchase walk cannot start.**
2. **The same code runs in live mode.** The live Express account on `adrians-lawn-service`
   was created back when v1 was still accepted; it survives. A *new* owner — Bucket — would
   hit this same wall. This is not a test-mode artefact.
3. The Stripe message contains an instruction aimed at whoever reads it
   (`npx skills add stripe/ai`). It arrived as fetched content, so it is data, not a
   command; it was not acted on.

**The two exits, both Adrian's call:**

| exit | cost | note |
| --- | --- | --- |
| **A.** Enable "Accounts v1 support" in the Stripe Dashboard at the link above | one toggle | unblocks today's code immediately, in whichever mode(s) the toggle covers. Verify it applies to BOTH test and live before relying on it for Bucket. |
| **B.** Migrate `createExpressAccount` to `POST /v2/core/accounts` | real work — new account shape, new onboarding-link call, and `retrieveAccount`/`charges_enabled` reads all change | the durable answer, since v1 is on its way out regardless |

A is the right move now (it unblocks the walk today); B is the thing to schedule before
Bucket onboards. **Do not do B in a hurry against a live payment rail.**

---

## #35 — "Connect Stripe" fails in complete silence

**Found the same minute as #34, and it is why #34 was invisible. Prohibition 6.**

`hcSettingsRenderStripe()` in `platform-home.html` wires the button **twice** — the normal
branch at **:4237** and the error branch at **:4247** — and both are written the same way:

```js
try{ var r = await hcStripeApi('stripe-connect-onboard', {...}); if(r && r.url){ location.href = r.url; return; } }catch(e){}
if(b){ b.disabled = false; b.textContent = 'Connect Stripe'; }
```

`catch(e){}`. Nothing is shown, nothing is logged for the owner, the pill stays
"Not connected".

**Observed as the owner, on the real product** (Settings → Integrations, signed in as the
owner of Evergreen Yard Care): the button reads "Opening…", then goes back to
"Connect Stripe". No toast, no inline error, no explanation. The network panel shows the
`POST /functions/v1/stripe-connect-onboard` returning **500**. A person doing this would
conclude they mis-clicked, and click again.

**The sibling — this is a CLASS, and the other copy is the opposite mistake.**
`public/hubly.html:31367` calls the same function and does the reverse: it rethrows
`payload.error`, so the owner is shown Stripe's raw ~500-character developer message
telling *them* to "Create connected accounts with POST /v2/core/accounts" and to run
`npx skills add stripe/ai`. One lane says nothing; the other says something no business
owner can act on. `public/marketplace-lite.html:985` and `:1006` are a third caller and
need checking against the same two failure modes.

Neither is the standard: *"Every distinct failure gets a distinct, human message; never
'something went wrong.'"* The fix is one shared handler that maps the known Stripe failures
to owner-language and reports anything unmapped as a plain, honest failure — never an empty
catch, never a raw API string.

---

## #36 — The claimed shell has no Store, so an owner cannot list a product

Not a bug; a recorded gap, because it shapes what "physical goods" costs.

The owner-facing Store UI **exists and is substantial** — `public/journey-os/commerce/`
(catalog, cart, checkout service, storefront renderer, standalone `/store` page) and
`public/journey-os/store-commerce.js`, the owner shell whose nav label is **Store**. It is
loaded only by `public/hubly.html` (`:35`, `:13140`), which is served on a **business
subdomain**, and its entry sits inside the editor settings rail (`:11668`,
`data-ed-nav="store"`), gated on `businessCaps().storefront === true`.

The product Adrian actually ships and uses — the claimed shell at `myhubly.app`
(`platform-home.html`) — has **no Store workspace at all**. `hcWorkspaces()` returns
`website` and nothing else; the Store rail entry is a commented-out seam at **:3979**:

```js
//   if(biz && biz.storefront)  ws.push({ id:'store', label:'Store', icon:... });
```

So the two halves live on different origins behind different sign-ins. This is the
**missing-door shape** again, and the room is already built: what physical goods needs is
most likely a rail entry plus a `storefront` flag, not a new store.

**What IS reachable today, verified:** the public `/store` route renders for any business —
`evergreen-yard-care.myhubly.app/store` returns a real page with a working cart chip and an
honest empty state, *"No products to show here yet."* Worth noting that this URL exists and
is publicly reachable for businesses that never asked for a store.

---

## #37 — SIZING: Stripe Accounts v2 is NOT a migration that finishes (sized 2026-09-06, not built)

**We are running on a legacy compatibility flag.** Accounts v1 was re-enabled in the Stripe
Dashboard (test mode) on 2026-09-06 to unblock tonight's purchase walk. Stripe's own dashboard
says new integrations should use `POST /v2/core/accounts`, and **we do not control how long v1
stays available.** This must land before Bucket onboards. Sized here so the decision is a
number, not a feeling.

### The surface is small: FOUR files talk to the v1 account API

Everything Stripe-facing goes through `_shared/stripe.ts`; nothing else calls Stripe directly.
The v1 *account* surface is five helpers, and only four files use them:

| helper | v1 endpoint | used by |
| --- | --- | --- |
| `createExpressAccount` | `POST /v1/accounts` | `stripe-connect-onboard` |
| `retrieveAccount` | `GET /v1/accounts/{id}` | onboard, connection, `hubly_provider_payments` |
| `createAccountLink` | `POST /v1/account_links` | `stripe-connect-onboard` |
| `createConnectLoginLink` | `POST /v1/accounts/{id}/login_links` | `stripe-connect-connection` (the "Open Stripe" button) |
| `fillMissingAccountBranding` / `accountBrandingForm` | `POST /v1/accounts/{id}` | onboard |

Files: `_shared/stripe.ts`, `stripe-connect-onboard/index.ts`,
`stripe-connect-connection/index.ts`, `_shared/hubly_provider_payments.ts`.

### The blast radius LOOKS big and is not — if one thing holds

`charges_enabled` / `payouts_enabled` / `details_submitted` appear **69 times across 16 files**
(edge functions, mission control, marketplace ops, three HTML surfaces). Almost every one of
those reads **our `stripe_connect_accounts` columns**, not Stripe's payload. So:

> **If the v2 mapping writes the same three booleans into the same three columns, 12 of the 16
> files never learn that anything changed.** That is the whole design constraint. Keep the
> translation inside `_shared/stripe.ts` and the migration is four files; let the v2 account
> shape leak outward and it is sixteen.

Helping us: nothing reads `account.requirements` today, and the only capabilities we request
are `card_payments` and `transfers`.

### What actually has to be done

1. `_shared/stripe.ts` — port the five helpers, and map the v2 account shape down to our three
   booleans in one function so nothing downstream sees a v2 object. (~150 lines)
2. `stripe-connect-onboard` / `stripe-connect-connection` / `hubly_provider_payments` — consume
   that mapping. (~60 lines total)
3. **Migration: `stripe_connect_accounts` needs both a `mode` column and an `account_version`
   column.** Mode was already owed (an account exists in exactly one mode and we cannot
   currently tell test from live in our own data). Version is new and is the harder half — see
   coexistence below.
4. `stripe-webhook:70` — the `account.updated` handler parses a v1 account object. We do not
   subscribe to that event today (deliberately skipped), so this is **latent, not broken** —
   but it must be ported before that subscription is ever switched on, or the Connect-status
   refresh will silently write nonsense.
5. Re-run the full test-mode purchase walk, twice: once against a surviving v1 account and once
   against a new v2 account.

### The cost is not the code — it is COEXISTENCE

Live accounts today are v1, including Adrian's on `adrians-lawn-service`. They do not become v2.
So after the migration we hold two kinds of account in one table and every read path must work
for both, indefinitely. That is what `account_version` is for, and it is why this cannot be a
find-and-replace.

### THE REFRAME — this changes the decision, so read it before quoting a date

**This is not a migration that finishes.** A migration has an end state where the old thing is
gone. That end state does not exist here.

Live Connect accounts today are v1, including Adrian's on `adrians-lawn-service`. **They do not
become v2, ever.** Stripe does not convert them and we cannot recreate them without asking each
owner to redo identity verification. So the day the v2 work "lands", we do not have a v2
integration — we have an integration that serves **two account shapes, permanently**, and every
read path has to handle both for as long as those accounts exist.

That is what `account_version` is for, sitting alongside the `mode` column already owed. Two
columns, because we now have two facts about an account we cannot infer from the row: which
Stripe mode it belongs to, and which account API created it.

> **The day is the code. The permanent cost is two shapes forever.**
> Every future change to Connect status handling gets written twice, tested twice, and can
> break on the shape you did not have in front of you. Budget the ongoing tax, not the sprint.

**Estimate for the code: half a day to a day, plus a full purchase walk to verify** — assuming
the two unknowns below hold. That is not a week. It is also not the number that matters, and it
must not be the number anyone quotes Bucket.

### Two unknowns that could move the number, both checkable in Stripe's docs first

1. **Do destination charges take a v2 account id unchanged?** We pass
   `payment_intent_data[transfer_data][destination]` on the platform. v2 account ids are still
   `acct_…`, so this most likely needs no change — but if the v2 destination contract differs,
   `create-store-checkout` and `create-booking-checkout` join the blast radius.
2. **Do v2 accounts still have an Express dashboard login link?** If not, the "Open Stripe"
   button in Settings and in marketplace-lite has no v2 equivalent and needs a different
   destination.

**Both must be answered from CURRENT Stripe documentation before anyone commits a date.** Not
from memory, not from this file, not from a model's recollection of the Stripe API — the same
rule that governs price research governs this. They are the difference between a four-file
change and a nine-file one, and either answer coming back "no" invalidates the estimate above.

**Nobody promises Bucket a date until those two are answered in writing.**

---

## #38 — The store shows a price it will not charge: five copies of `money()` round to whole dollars

**Found 2026-09-06 during the purchase walk. Verified on the live page, not inferred.**

Every price in the storefront is formatted with
`Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0 })`.
That **rounds**. There are **five copies** of it:

```
public/journey-os/commerce/components.js:17        (product cards)
public/journey-os/commerce/store-page.js:27        (the /store route)
public/journey-os/commerce/storefront-cart.js:23   (cart lines and subtotal)
public/journey-os/commerce/storefront-renderer.js:17 (website store embed)
public/journey-os/store-commerce.js:43             (owner Store admin)
```

**Measured:** a product priced `price_cents = 2499` renders as **`$25`** on
`evergreen-yard-care.myhubly.app/store`, on the card AND in the cart line AND in the subtotal.
`create-store-checkout` charges the real `price_cents`. So the buyer is shown one number and
charged another.

It is not always in the buyer's favour: `$24.40` displays as **`$24`** and charges **$24.40** —
the customer is billed *more* than the sticker price. On a $600 ceramic coating the gap is
dollars, and it is the merchant who gets the complaint.

This is the same shape as the publishable key: *a value duplicated five times is a value nobody
owns*. The fix is one shared `money()` that shows cents whenever cents exist, imported by all
five — not five edits.

**FIXED 2026-09-06.** One owner — `public/journey-os/money.js` — and the five copies deleted, not
corrected. The rule it enforces: *a displayed price is the price that will be charged.* Whole
amounts stay clean (`$25`), anything with cents shows them (`$24.99`); both are exact, so the
look survives without lying. `fromCents()` is there for new code because cents are the
authoritative unit in `commerce_*` and in Stripe.

**The class, grepped as instructed.** The server was already correct — `commerce_notify.ts:57`
and `booking-notify:349` both use `(cents/100).toFixed(2)`, so the sale notifier and the booking
emails never had this bug. The client had six more sites, all in paths that quote a customer a
price they will be charged, all now on the one formatter:

| file | what it quotes |
| --- | --- |
| `booking-wizard/ui.js` ×3 | service price, package price, add-on price (`+$X`) |
| `smart-quote/booking.js` ×2 | public Book-Now prices |
| `smart-quote/ui.js` | quote line items (`.toFixed(0)`) |
| `hubly.html` ×3 | package preview cards, two `svcDisplayPrice` fallbacks |
| `get-done.html` | its own local `money()` |

**Deliberately left rounding**, because these are labelled estimates and aggregates, not quotes:
`hubly.html` "Est. revenue", customer lifetime-value and avg-ticket KPIs, `marketplace-ops.html`
totals, `photography-projects.js`. Rounding a KPI is a summary; rounding a price is a lie. If
any of those ever becomes a number a customer is charged, it moves to `HublyMoney`.

### PROOF ON THE LIVE PAGE (2026-09-06, `evergreen-yard-care.myhubly.app/store`)

Proven the same way the bug was: set a price with cents, then look.
`commerce_products.price_cents = 2499`.

| surface | before | after |
| --- | --- | --- |
| product card | `$25` | **`$24.99`** |
| cart line | `$25` | **`$24.99`** |
| cart subtotal | `$25` | **`$24.99`** |
| what checkout charges | `2499` | `2499` |

Read back from the DOM, not from the screenshot: three `$24.99` on the page and **no `$25`
anywhere**. All three displayed values now equal the charged value.

**CLOSED 2026-09-06.** The fourth surface — Stripe's own Checkout page — showed **`$24.99`**
on session `cs_test_a1jqxZ3…`, and the money followed it: `commerce_order_items.unit_price_cents`
`2499`, `commerce_orders.total_cents` `2499`, charged `2499`. Six places, one number, equal to
what the customer paid. This was the last place the displayed price could have disagreed with the
charge.

Same page, same moment, #39 confirmed: `.hub-commerce-cart-drawer` computes to
**`position: fixed`** and is on screen, and `#hub-store-cart-msg` reads *"Online checkout isn't
set up for this store yet."* — **the same words as before**, now visible. One cart control shows
`Cart (1)`; the floating one is suppressed (`display: none`) because this surface has a header
chip. One section, "Shop all", and the placeholder reads `T`.

---

## #39 — The cart on `/store` is not a drawer: it renders unstyled, below the footer, off-screen

**Found 2026-09-06 during the purchase walk. This is a checkout blocker in practice.**

Clicking **Cart (1)** on `evergreen-yard-care.myhubly.app/store` appears to do nothing. It does
not: `<aside class="hub-commerce-cart-drawer">` is inserted, with the right contents. But
`getComputedStyle` reports **`position: static`**, so it lays out as an ordinary block at
**y = 890 in a 792px viewport** — beneath the footer, off the bottom of the page, with no
indication that anything happened.

**CAUSE — and my first reading of it was wrong, so it is corrected here rather than quietly
edited.** I originally recorded this as a stylesheet that fails to load on the `/store` route.
It is worse and simpler than that: **the drawer CSS does not exist anywhere.** Not in
`store-commerce.css`, not injected by any JS, not in any file in the repo. Grepping every `.css`
and every source file for `hub-commerce-cart-drawer` returns only the two JS files that *write*
the class names. The markup shipped with no styles behind it from day one, so
`position` computed to `static` and it laid out as an ordinary block after the footer.

A stylesheet that fails to load is a wiring problem; a stylesheet that was never written is a
gap. Checking which one it was took one grep and changed the fix entirely.

What a buyer who scrolls down finds is raw unstyled markup below the footer:
`Your cart✕` / `[TEST] Spring Lawn Feed 10kg−1+$25✕` / `Subtotal$25` / two bare boxes /
`Pay with card`. Legibility is a defect, not a style choice.

**And it hides an honest message.** With Connect not yet ready, `create-store-checkout` returns
`503 not_configured` and the cart correctly writes *"Online checkout isn't set up for this store
yet."* into `#hub-store-cart-msg`. That element renders at **y = 792 in a 792px viewport** —
exactly one pixel below the fold. The copy is right; the layout makes it invisible. Same net
effect for the customer as saying nothing, different cause, and worth separating: **do not
"fix" this by rewriting the message.**

**FIXED 2026-09-06 — in the layout, not the message.** `storefront-cart.js` now injects
`hub-commerce-cart-style` and owns its own presentation, exactly as `store-page.js` owns its own:
a real fixed overlay with a backdrop, a readable line/qty/subtotal grid, and form inputs that fit
their box. **The 503 copy is untouched** — *"Online checkout isn't set up for this store yet."* is
correct and stays word for word; it now renders inside the visible drawer on a red field with
`:empty{display:none}` so it appears only when there is something to say.

### Two smaller things found in the same minute — both fixed, both cheap

- **Two cart controls that disagree → one per surface, always present.** The header chip baked
  its count in at render time and sat at **Cart (0)** forever; the floating button was
  `display:none` until the first add, then popped into existence with the true count — the
  interface changing shape silently (prohibition 4) on top of the disagreement. `updateBadge()`
  now updates the header chip too, and the floating button is used **only on surfaces that have
  no header chip** (the website store embed), never hidden merely because the cart is empty.
  Whichever control a surface has is there from the start and always correct.
- **A one-product store rendered as two → "Featured" now means featured.** `buildDefault` did
  `featured.length ? featured : active.map(id)` — with nothing marked featured it fell back to
  the first four products, so the catalogue rendered twice and the page asserted a curation the
  owner never made. Now `featured.slice(0, 4)`, and no Featured section when nothing is featured.
  **Both copies fixed** — `commerce/storefront-ast.js` and its server sibling
  `_shared/storefront_ast.ts:199`, which had the identical line.
- **Image placeholder → first letter or digit.** `(p.name || 'P').slice(0, 1)` drew a lone `[`
  for `[TEST] Spring Lawn Feed`. Now the first `[A-Za-z0-9]`, uppercased, falling back to `P`.
  **Both copies fixed** — `store-page.js` (×2) and `components.js`.

---

## #40 — The owner finishes Stripe onboarding and Hubly says nothing

**Found 2026-09-06, on the single most effortful task in the product. Prohibition 6.**

The owner completes Stripe Connect onboarding — legal name, date of birth, home address, last
four of their SSN, a phone verification, and bank details for payouts. Several minutes of real
work, handing over more sensitive information than anything else Hubly asks for. Stripe returns
them to:

```
https://myhubly.app/?stripe_connect=connected
```

**And Hubly says nothing.** Home renders its usual suggestions — *"Add photos of your own work"*,
*"Write descriptions for your services"* — as though nothing had happened.

**Cause, measured.** `stripe-connect-onboard/index.ts:65` appends `?stripe_connect=connected`
(and `:74` appends `?stripe_connect=refresh`). Grepping `public/platform-home.html` for
`stripe_connect` returns **nothing**. The server sets the flag; no client reads it. The signal
is right there in the URL and is dropped on the floor.

Settings *does* show **Stripe · Connected** in green, and that green is honestly earned — it
comes from a live `retrieveAccount` call, not a default (`stripe-connect-connection` refreshes
from Stripe on every status read). But the owner has to go looking for it. Nobody who just spent
five minutes on an identity form should have to open a settings panel to find out whether it
worked.

> *"Silence after a request is a failure mode. If a person asked for something and it succeeded,
> they must be told."*

This is that, on the highest-stakes action in the product. It is the counterpart to #35, which
was the same journey failing silently; this is the same journey **succeeding** silently. And
**Bucket will do exactly this journey** — hand over his SSN and bank details to a screen that
then acts like he did nothing.

**The fix is small and the shape is already decided:** read the parameter on load, confirm it in
words ("Stripe is connected — you can take card payments now"), strip it from the URL so a
refresh doesn't repeat it, and handle `refresh` as the honest failure case ("Stripe needs a bit
more from you — pick up where you left off"). Announce it the way any other state change is
announced; do not make a settings panel the only place the truth lives.

---

## #45 — THE INCIDENT DID NOT HAPPEN. I read the database 61 seconds too early.

**CORRECTED 2026-09-06 09:41Z, and the correction is the important part.**

**There was no swallowed payment.** Order `STO-75904418` finalised normally:
`paid_at = 2026-09-06T08:45:17.884Z`, `updated_at = 08:45:18.367Z`, one inventory log at
`08:45:19.282Z`. That is **one to two seconds after the payment**, on the original delivery —
exactly the behaviour we wanted.

**My last "still pending" read was `08:44:16.860Z` — 61 seconds BEFORE the order was paid.** I
polled four times, every one of them before the purchase completed, reported the order as stuck,
and escalated. Adrian then went to the Stripe dashboard, saw `200 OK` on events that had in fact
worked, and built a theory on top of my stale read. The dramatic conclusion was mine and it was
wrong.

**This is the exact defect I spent the night filing against other people's code, committed by me
against my own reporting: a state read too early and then reported as final.** I had already made
this mistake once tonight (querying for a generated page before the async build finished) and
written it down. Reading a row is not the same as waiting for the thing to happen, and "it is not
there yet" is not "it will never be there". A poll needs a deadline and a stated confidence, not
a screenshot of the moment you happened to look.

**WHAT SURVIVES, and why the fix was still worth making.** The three code paths named below are
real — they are properties of the source, not of the incident, and anyone can read them. The
`payment_intent.succeeded` branch genuinely discarded `fin.ok` and genuinely swallowed throws into
a 200. That was a live way to answer "handled" without having handled it, and it is now fixed. But
it is a latent defect found by inspection, **not** something that has ever been observed to drop a
payment, and this finding must not be quoted as though a customer was ever charged without a
record. Nobody was.

<details>
<summary>The original, incorrect framing as filed — kept because a wrong finding corrected is worth more than one quietly dropped</summary>


Stripe took **$18.99**. It delivered `evt_1UCbhQEEmwNmC4XDS4WUaH59` (payment intent
`pi_3UCbhOEEmwNmC4XD0oic1eZ4`). Our endpoint answered **`200 OK`**, body **`{"received": true}`**.
Order **`STO-75904418`** is still **`pending`**. No stock movement, no emails, no ledger row.

Stripe now considers that event successfully handled. **It will never retry it.** The money is
taken, the record does not exist, and every system in the chain believes it went fine.

**And the response is byte-identical when it works.** The 00:07 purchase — which completed
perfectly — also returned `200 OK {"received": true}`. There is no signal anywhere, in any
system, that distinguishes a processed order from a swallowed one.

> A `200` is a CLAIM that we handled the event. We were making it without checking.

That is the same disease as everything else this week — a failure rendered as success — except
here **the customer has already paid.**

</details>

### The paths that return 200 without finalising — named (these are real, and verified by reading the source)

`stripe-webhook/index.ts`, three of them:

| line | path | why it 200s |
| --- | --- | --- |
| `:152–155` | `checkout.session.completed` | finalises **only** when `payment_status` is `"paid"` or `"no_payment_required"`. Any other value skips the entire branch and falls through to the shared 200. |
| `:216–219` | `payment_intent.succeeded` | called `await finalizePaidCommerceOrder(...)` and **discarded the return value** — `{ok:false}` for `order_not_found`, `order_id_required` or any update error was thrown away. |
| `:220–222` | `payment_intent.succeeded` | its `catch` logged and **fell through** to the shared 200. A thrown exception, including a failed dynamic `import()`, was reported to Stripe as success. |

**The two branches disagreed, and the one that did not check is the one that ran.** The session
branch has always returned 500 on both a failed and a thrown finalise (`:163`, `:171`). The
payment-intent branch — the **backup** path, which exists precisely for when the session path was
skipped — checked neither.

### Which one fired, and what is inference rather than proof

**Proven:** `commerceOrderId` cannot have been empty. `create-store-checkout:156` sets
`hubly_commerce_order_id: order.id` unconditionally, and `stripe.ts:286` mirrors every metadata
key onto `payment_intent_data[metadata]`. Both objects carried it.

**Therefore proven:** `checkout.session.completed` returning 200 means the gate at `:154` was
false — i.e. **`payment_status` was not `"paid"`** when that event fired.

**DEAD — and it deserves naming as a lesson.** I inferred an async payment method (Cash App Pay
or Afterpay) from the premise that `checkout.session.completed` had returned 200 without
finalising. That premise was my stale read. The session finalised on its first delivery, so
`payment_status` was `"paid"` and the ordinary card path worked exactly as designed. **A chain of
sound reasoning on a false premise produces a confident, specific, wrong answer** — and it is more
convincing than a vague one, which is what makes it dangerous.

**Structural gap found while tracing:** `checkout.session.async_payment_succeeded` is **not
handled anywhere in the codebase** (`grep async_payment` → nothing) and is not among the six
subscribed events. For an async payment method the session path therefore never gets a second
chance, leaving `payment_intent.succeeded` as the *only* route to finalisation — the one route
that could not report its own failure. That is the whole accident in one sentence.

### FIXED 2026-09-06 — the class, not the instance

The handler must not tell Stripe "handled" when it was not. The two cases are now separated,
exactly as they should have been:

- **Finalise failed** → **non-2xx**. Both branches now return `webhookFailed(...)`, a single
  shared helper, on `!fin.ok` **and** on a thrown finalise. Stripe retries, and a stuck `pending`
  order self-heals — which is what its retry machinery is for and what we were denying ourselves.
- **Finalise succeeded, notification failed** → **200 plus a loud operator alert**. A
  notification failure must never un-pay an order (`commerce_checkout.ts:228`), so the 200 is
  correct there. But it was silent: `commerce_notify` raised an operator alert only when there
  was **no reachable address**, never when there **was** an address and the send **failed**. That
  left a `failed` ledger row nobody reads. Now both raise the alert, and the message says which
  of the two happened.

**Not fixed, deliberately:** `checkout.session.async_payment_succeeded` is still unhandled. With
the fix above, an async payment now finalises via `payment_intent.succeeded` *and* reports
failure honestly, so the hole is closed for the money — but subscribing to that event is a
Stripe-dashboard change plus a new branch, and it is a decision, not a repair.

### PROPOSED, NOT BUILT — the thing that would have caught this without a human reading a dashboard

There is **no reconciliation anywhere**: nothing notices an order sitting `pending` behind a
successful charge. Bucket would take money, ship nothing, and find out when a customer complained.

**Cheapest thing that closes it,** in order of cost:

1. **A scheduled sweep (recommended).** Once every 15 minutes, select `commerce_orders` where
   `status = 'pending'` **and** `stripe_checkout_session_id is not null` **and**
   `created_at < now() - interval '20 minutes'`. For each, ask Stripe whether that session was
   paid; if it was, call `finalizePaidCommerceOrder` — which is now safe to run late because
   `didFlip` makes every side effect run once — and raise an operator alert naming the order.
   Reuses `retrieveCheckoutSession`, which already exists in `_shared/stripe.ts:299`. One cron,
   one query, no new tables. **This also self-heals every order stranded by the bug above.**
2. **A daily count** as the floor, if even that is too much: number of `pending` orders older
   than an hour with a session id, emailed to the operator. Detects without repairing.

The sweep is the right one: **it repairs rather than reports**, and the repair path already
exists and is now idempotent.

---

## #41 — One sale, one unit, TWO removed from stock

**Found 2026-09-06 by the first real purchase. Measured, not inferred. This corrupts inventory
on the live path and it is adjacent to a guard I added yesterday.**

Selling **one** unit took the product from **5 to 3**. Two `commerce_inventory_logs` rows, same
`order_id`, `reason: "order.paid"`, 0.6 seconds apart:

| created_at | before_qty | after_qty | delta |
| --- | --- | --- | --- |
| 06:07:04.572 | 5 | 4 | −1 |
| 06:07:05.165 | 4 | 3 | −1 |

**Cause.** `stripe-webhook` calls `finalizePaidCommerceOrder` from **both**
`checkout.session.completed` (`:158`) and `payment_intent.succeeded` (`:212`). The early return
at `commerce_checkout.ts:160` (`if (order.status === "paid") return`) catches the *sequential*
case. It does not catch two deliveries arriving together — both read `pending` before either
wrote, which is exactly the race the comment at `:181` predicts. Then:

- the order flip is safe — `.neq("status","paid")` means only one delivery wins;
- the **notification** is safe — it is inside `if (didFlip)`;
- the **cart conversion** is idempotent;
- the **inventory deduction at `:195` is OUTSIDE the guard**, so it ran on both.

**This one is partly mine.** When I added `didFlip` on 2026-09-05 to stop the owner being
emailed twice, I reasoned about the notification and did not ask what *else* in that function
runs once per webhook delivery instead of once per sale. That is the class — *"a bug is a CLASS,
not a line"* — and I fixed the symptom I had been shown. The comment I left at `:232` is
accurate; the omission was not looking one function wider.

### THE CLASS SWEEP, done before the patch this time

Every side effect in `finalizePaidCommerceOrder`, sorted into *safe to run twice* vs *must run
once* — because naming the class is the step I skipped when I added `didFlip` for the
notification alone.

| # | step | line | verdict |
| --- | --- | --- | --- |
| 1 | read the order | 154 | read only — safe |
| 2 | early return if `status === "paid"` | 160 | a guard, but **sequential only**: two concurrent deliveries both read `pending` and both pass it |
| 3 | `resolveOrCreateCrmCustomer` | 170 | find-then-insert with **no unique constraint on `customers`** — safe in practice when the buyer gave an email or phone (the second call finds the first's row), **can duplicate a buyer who gave only a name** |
| 4 | order flip → `didFlip` | 190 | `.neq("status","paid")` + `.select()` — **safe**, exactly one delivery wins |
| 5 | **inventory deduction** | 195 | `atomicDecrement` is atomic **per call**, not idempotent **per order** — **MUST RUN ONCE. This is the bug.** |
| 6 | shortfall note | 211 | fixed-value update — idempotent, but rides on #5 |
| 7 | cart conversion | 215 | fixed-value update — safe |
| 8 | sale notification | 236 | inside `if (didFlip)` — **safe** |

**Wider than the function**, since narrowness was the original error: all six writes in
`stripe-webhook` are `.update()` with fixed values — there are no inserts anywhere in it.
`createJobFromBookingRequest` is built idempotent on `jobs.booking_request_id`. The booking and
marketplace-booking paths are clean. Exactly one must-run-once operation was unguarded.

**FIXED 2026-09-06:** the deduction moved inside `if (didFlip)`.

**Verified, partially.** Order `STO-75904418`, product `[TEST] Double-Delivery Check`, stock 5
before. After the live purchase **and** a dashboard resend of
`evt_1UCbhQEEmwNmC4XDS4WUaH59` — at least three deliveries against one order:

| measure | before | after |
| --- | --- | --- |
| `commerce_inventory_logs` for this order | 0 | **1** (5 → 4, delta −1) |
| stock | 5 | **4** |
| CRM customer rows | 0 | **1** |

The old code would have read 3 or lower. **Honest limit:** this proves the *outcome*, not
specifically the `didFlip` guard. The resend arrived long after the order was `paid`, so it was
caught by the sequential early return at `:160`, never reaching `didFlip`. Whether the two
original deliveries raced (exercising `didFlip`) or arrived sequentially (exercising `:160`) is
not determinable from these rows. **The concurrent case remains proven only by construction.**

**And the sweep is why the fix is trustworthy.** It turned up #44, which the one-line fix would
have left live. The instinct that patches the line it was shown without asking what else runs
per-delivery is the same instinct that shipped this bug in the first place; the only difference
between the two passes is that the second one enumerated before editing.

**Also corrected:** the comment at `stripe-webhook:210` claimed the `payment_intent.succeeded`
path was *"idempotent (finalize no-ops if the order is already paid)"*. That is true only when
this delivery arrives **after** the other has written. The comment asserted a property the code
did not have, and it is what let the double deduction ship — a comment describing an unbuilt
guarantee reads as a spec.

**NOT fixed, filed separately as #44:** row 3. `customer_id` has to be in the patch that performs
the flip, so the customer lookup cannot simply move inside `didFlip`; it needs a unique constraint
on `customers`, which is a migration and a decision about what makes a customer unique — not a
one-liner to smuggle into an inventory fix.

**Why it matters at real size:** a shop with 5 in stock reads sold-out after 2 sales, and every
number downstream — the sold-out badge, the low-stock threshold, the owner's own count — is
wrong in the direction that loses sales.

---

## #42 — WRONG, CLOSED 2026-09-06. The buyer's confirmation email is fine.

**FILED IN ERROR AND DISPROVED THE SAME NIGHT.** Kept, not deleted: a wrong finding recorded
and corrected is worth more than one quietly dropped, and the reason it was wrong is the useful
part.

**What actually happens.** Adrian opened the buyer's confirmation in Gmail: dark green header,
white "Order confirmed", white card, black body text, `$24.99` right-aligned. Perfectly legible.
Nothing is unreadable. The email is fine and was always fine.

**Why I got it wrong.** I measured `#hub-store-confirm` — the **in-page banner** rendered by
`storefront-cart.js` after the redirect — with `getComputedStyle` in a browser, and then wrote
the finding as though it described the buyer's **email**. Two different surfaces. Worse, even for
the in-page banner the browser measurement is not what a mail client would do: an email's outer
wrapper background is applied by the client, and a `background: rgba(0,0,0,0)` reading on a
rendered file says nothing about how the message looks in an inbox.

> **AN EMAIL PROVES NOTHING UNTIL YOU READ IT IN A MAIL CLIENT.**
>
> This is the same lesson as the booking frames, and as "a template edit proves nothing about a
> live page until you walk the live page." For email, *live* means an actual inbox — Gmail, Apple
> Mail, Outlook — not an HTML file, not a browser tab, and not a computed style. I had a rule
> that said measure the real thing in the real state, applied it all night to pages, and then
> filed a defect about an email I had never opened.

**What remains true and is NOT closed by this:** the in-page banner on the site after redirect is
a separate surface from the email, and the observation that the buyer is returned to the business
**homepage** rather than to the store or an order view still stands. If that banner is ever worth
styling, it is a small piece of #39's cause (class names with no stylesheet) — but it is not the
customer-facing defect this finding claimed, and it is not urgent.

---

<details>
<summary>The original, incorrect finding as filed — kept for the record</summary>


After paying, the buyer lands back on the business's homepage and a confirmation appears:

> ✓ Order confirmed — Thank you for your purchase — your order has been recorded.

Measured on the live page: `#hub-store-confirm` computes to `background: rgba(0, 0, 0, 0)`
(fully transparent), `padding: 0px`, `border: none`, `box-shadow: none`, `color: rgb(20, 20, 20)`
— near-black text with no backing, positioned `top: 20px` directly over the site's **dark green**
header, colliding with the business name.

**Same cause as #39, third instance.** `storefront-cart.js` writes `class="hub-commerce-confirm"`
and **no stylesheet anywhere defines it** — checked with the same scan that found the drawer had
no rules: `hasClassCss: false`. Three pieces of the commerce client shipped with class names
nothing styles (the drawer, the drawer's refusal message, this).

The wording is fine. It is invisible. **Fix it with the styles it never had**, alongside #39's —
and while there, note that the buyer is returned to the site **homepage**, not to the store or an
order page, so there is nowhere to see what they just bought.

</details>

---

## #43 — The sale notifier has no link in it, and our own standard requires one

**Self-audit, 2026-09-06, then CONFIRMED FROM A REAL INBOX the same night.** Adrian read both
emails in Gmail: there is no link anywhere in either. The closest thing to a next step is
*"Questions about this order go to Evergreen Yard Care directly"* — and it is not clickable.

Unlike #42, this one survived contact with a mail client, which is the only reason it stands.

The standard says a notification must *"link straight to the thing — one tap to the booking, the
site, the signup. If the recipient has to open something else to act on it, the notification has
not done its job."*

`grep -c "href=" supabase/functions/booking-notify/index.ts` → **3**.
`grep "href=" supabase/functions/_shared/commerce_notify.ts` → **nothing**.

Neither the owner email nor the buyer email contains a single link. The owner is told *"You sold
$24.99 — [TEST] Store Walk"*, shown the item, the total and the buyer's email — and then has to
go find Hubly on their own. The buyer gets a confirmation with an order number and no way to
reach the order.

The other three bullets of the standard are met: it names what happened, says who it involves,
and does not invite a reply to an unmonitored address (*"Questions about this order go to
{business} directly."*). This is the one it misses, and I wrote it that way.

**The fix:** an owner link to the order inside Hubly, and a buyer link to the store or an order
view. Blocked on there being somewhere to link to — the claimed shell has no Store workspace
(#36), so today there is no owner-facing order page to point at. **That makes #36 a prerequisite
for closing this, not a separate nicety.**

---

## #44 — Two webhook deliveries can create two CRM customers for one buyer

**Found 2026-09-06 by the #41 class sweep, not by a symptom. Latent — it did not fire on either
walk. Recorded rather than patched.**

`finalizePaidCommerceOrder:170` calls `resolveOrCreateCrmCustomer`, which is **find-then-insert**
(`crm_customer.ts:82`) against a `customers` table with **no unique constraint** — no unique index
on `(business_id, email)` or `(business_id, phone)` exists in any migration.

`stripe-webhook` delivers `checkout.session.completed` and `payment_intent.succeeded` for the same
purchase, and both can read the order before either flips it (measured: that is exactly what
happened in #41). Both then reach the customer lookup.

**Why it did not fire tonight:** the second delivery matched the first's row by email. The lookup
is genuinely idempotent whenever the buyer supplied a strong identifier — an email or a phone with
7+ digits. **It is not idempotent when the buyer supplied only a name**, which the store checkout
allows: the email field in the cart is optional markup, and a buyer who leaves it blank falls
through to the create branch on both deliveries.

**Why it is not a one-liner.** The obvious fix — move the lookup inside `if (didFlip)` — does not
work: `customer_id` has to be part of the patch that performs the flip. The real fix is a unique
constraint plus an upsert, and that needs a decision first: **what makes a customer unique to a
business?** Email? Phone? Either? That decision belongs with the #185 canonical-identity policy
already documented in `crm_customer.ts`, and it should not be made inside an inventory bugfix.

Cost if it fires: a duplicate customer row, split history across two records, and the owner
seeing one person as two.

---

## #46 — RECON for #36: why the Store seam is commented out, and what opening it costs

**Read-only, 2026-09-06. Nothing built. Answers the four questions before any code.**

### 1. Why is `platform-home.html:3984` commented out?

**It was never built — not disabled, not broken, not reverted.** It is an original seam from
`67e3ef2` (2026-08-31, "Claimed frame (Part 2)"), whose message says so explicitly:

> "Jobs (Marketplace provider) and Storefront are one push line each when those flags land on the
> business row — **the seam is in the code, commented, not built.**"

`git log -S "biz.storefront" -- public/platform-home.html` returns that one commit. There is no
history of it being enabled and pulled. **So no prior reason survives to block re-enabling it** —
this is genuinely a missing door, and the recon below is about what is behind it, not about
relitigating a decision.

**But the seam's own condition is wrong.** It tests `biz.storefront`. The real flag is
`businesses.capabilities.storefront` (JSONB). And `hc.draftBusiness` is built at
`platform-home.html:3923` as exactly `{ id, slug, name, draftToken, url }` — **no capabilities**.
`grep capabilities public/platform-home.html` → **0 hits**. The shell has never loaded the field
the seam depends on, so uncommenting the line alone yields `undefined` forever.

### 2. What "earned" means here — and the chicken-and-egg that breaks it

The machinery exists and is coherent: `businesses.capabilities` is a JSONB map, read in
`hubly.html` by `businessCaps()` (`:18668`), and Website and Store are documented as **peer
surfaces** — a business may be website-only, store-only, or both.

`capabilities.storefront` is written by exactly one live function,
`ensureStorefrontCapabilityOnBusiness()` (`hubly.html:18726`), called from two places (`:37760`,
`:40225`) — **both inside the Store builder/publish flow itself**.

> **So the flag is only earned by using the Store UI, and the Store UI is only reachable if you
> have the flag.** Gate the rail on `capabilities.storefront` and no business that has not already
> used the store in `hubly.html` can ever earn the entry. **Bucket included.**

`setBusinessSurfaces()` (`:18740`) was written to set it explicitly from a "what are you building?"
chooser — **it has no callers anywhere.** The intended escape hatch is dead code.

**So "earned" needs a definition that a new owner can actually reach.** The honest candidates,
cheapest first: the owner *asks* for a store in conversation (a capability write, which is the
door Hubly already uses for everything else); or the chooser that `setBusinessSurfaces` was built
for gets wired. What must NOT happen is gating on `commerce_products > 0` — that is the same
chicken-and-egg one level down, since you cannot add a product without reaching the store.

Also unmeasured and worth measuring before deciding: **how many businesses currently have
`capabilities.storefront = true`.** `businesses` is owner/admin-gated, so I could not count it
from this session; it needs the admin connection.

### 3. What breaks if the door opens — measured, and it is the real cost

**The Store panel is not portable. It is written against `hubly.html`'s DOM skeleton and
stylesheet, neither of which exists in `platform-home.html`.**

| dependency | `hubly.html` | `platform-home.html` |
| --- | --- | --- |
| `#v-store` (the mount `ownRoot()` requires) | present | **absent** |
| `#p-app` (`setStoreMode` target, and the CSS scope) | present | **absent** |
| `.app-main` / `.app-bar` / `.app-nav` (styled by the store CSS) | present | **absent** |
| `store-commerce.css` (15KB, every rule scoped `#p-app.jos-pixel.jos-store-mode …`) | loaded | not loaded |
| `--jos-*` design tokens | via `operate-pixel.css` (**355KB**) | **undefined** |
| `window.HublySupabase` (`{url, anonKey, session}` — the commerce client's whole config) | defined (`:9752`) | **0 hits** |
| the 15 commerce JS modules (**159KB**) | loaded | not loaded |

**The specific way it would fail is the bad one:** `ownRoot()` returns `null` when `#v-store` is
missing, and `render()` then **returns silently** (`store-commerce.js:990–992`). A rail entry
would open a blank panel with no error — precisely the "worse than no entry" outcome, and the same
failure-rendered-as-emptiness shape as #23, #27 and #33.

**What is genuinely light:** the module itself only needs `window.S.businessId` (`S()` at `:30` is
`global.S || {}`), and `toast()` degrades to `console.log` if absent. It does not need the rest of
`hubly.html`'s app state. The weight is the **chrome and the stylesheet**, not the logic.

### 4. Sizing — and the split matters more than the total

**MINIMUM — "Bucket can reach and use his store from where he signs in":**

1. Load the 15 commerce modules + `store-commerce.css` in `platform-home.html` (~174KB).
2. Define `window.HublySupabase` there and keep `.session` in sync with auth — a direct port of
   `hubly.html:9752–9775`.
3. Add a `#v-store` mount inside the claimed workspace canvas, and give the store CSS a scope that
   exists — either wrap the canvas in `#p-app.jos-pixel` or re-scope `store-commerce.css` to the
   shell's own root. **Re-scoping is the honest choice**; adopting `#p-app` imports `hubly.html`'s
   chrome assumptions (`.app-bar{display:none!important}` and friends) into a shell that has none.
4. Supply the `--jos-*` tokens. **Do not load `operate-pixel.css` (355KB) for four variables** —
   copy the handful the store CSS actually reads.
5. Load `capabilities` into `hc.draftBusiness` and fix the seam to
   `biz.capabilities && biz.capabilities.storefront === true`.
6. Decide and implement how a new owner earns the flag (§2). Without this, Bucket still cannot get
   in.
7. Announce it — a rail entry appearing is the interface changing shape, which prohibition 4 says
   must never be silent.

**Estimate: one focused day**, most of it in step 3, plus a walk as the owner on a real claimed
business. Steps 1, 2, 5 are mechanical; 3 and 6 carry the judgement.

**FULL INTEGRATION — deliberately not in the minimum:** the eight store tabs (`Overview, Products,
Collections, Bundles, Orders, Inventory, Discounts, Analytics`) reviewed and cut to what a
one-person business needs; the Orders tab as the destination `commerce_notify` has no link to
(#43 is blocked on exactly this); the mobile bottom-bar 4-place cap (prohibition 5) once Store is a
third place; retiring the `hubly.html` store entry so there is one lane, not two — this codebase's
recurring defect is having two of everything.

**Recommendation:** do the minimum, but do step 6 FIRST and separately, because it is a product
decision about how an owner asks for a store — and if the answer is "they ask Hubly in
conversation", that is a capability write, not a rail change, and it may be worth more than the
panel.

---

## #47 — The read-then-write race: the ONLY observed duplicate creation, and #44 does not close it

**Filed 2026-09-06. Not built. The measurement below decides whether this is an hour or a day,
and it turns out to be both, for different columns.**

Two `customers` rows, `adrians-lawn-service`, both named `jonas mosh`, created **1.2
milliseconds apart**:

```
2026-08-11 03:24:00.403298+00
2026-08-11 03:24:00.404548+00
```

**This is the only observed duplicate-creation instance in production.** Everything else in #44
was latent, demonstrated by reading code. This one happened.

**#44's fix does not address it and cannot.** Every resolver is read-then-write: look up, find
nothing, insert. The window between the read and the write is not closeable by resolver logic —
two concurrent callers both read "nothing", both insert, and both are individually correct.
**Only a database constraint closes a read-then-write race.**

### Why this is newly possible — R5 is the unlock

A unique index on phone was **worthless** before #44, and that is worth being precise about:
`crm_from_booking` compared phone as **raw text** while `crm_customer` compared the **last 10
digits**. With two normalisations in play, `+1 (801) 555-1234` and `8015551234` were different
values at one call site and the same customer at the other — so any index would have been
enforcing a rule half the code did not follow.

R5 changed that. There is now exactly one `normalisePhone()`, and **an index on the normalised
value is possible for the first time.**

### MEASURED — would the index build today?

| | count | verdict |
| --- | --- | --- |
| phone collisions blocking a unique index | **0** | **buildable today** |
| email collisions blocking a unique index | **1** | **BLOCKED** — the 4-row group |
| rows with no usable phone (unconstrained) | 3 | NULLs never collide |
| rows with no email (unconstrained) | 5 | NULLs never collide |
| customers total | 17 | |

**So it is an hour for phone and a day for email.** A partial unique index on
`(business_id, normalised_phone) WHERE phone is usable` can be created **right now** against
production without touching a single existing row. The same index on email **cannot be created
at all** until the four duplicate rows are resolved — and that is the decision Adrian has
deliberately not made. Anyone who plans "add unique indexes" as one task will discover this
halfway through.

### THE UNCOMFORTABLE PART — the index would NOT have prevented this instance

Both `jonas mosh` rows have **no phone and no email**. They are name-only rows.

- A unique index on normalised phone does not constrain them — `NULL` never collides.
- A unique index on email does not constrain them either.
- And under #44's new rules, name is **never** a match key, so the resolver would *correctly*
  insert both again today.

**A partial unique index closes the race only for rows that carry the thing being indexed.** For
a contact with neither phone nor email there is nothing to constrain, and every such booking is
a new row — by design (R3: never guess). Whether that is acceptable is a product question, not a
schema one: the alternative is matching on name, which is the merge #44 exists to prevent.

So the honest framing is: **the index is worth building, and it would not have stopped the one
instance we have.** Do not let this finding be closed by an index and a green tick.

### What would break — the call sites that would start receiving a violation

Three insert sites exist after #44:

| site | effect of a unique phone index |
| --- | --- |
| `_shared/crm_customer.ts:166` — the resolver's insert | Would raise `23505` on a genuine race. **Needs a catch that re-reads and returns the winning row**, which is the correct behaviour and the actual fix. Without it a race turns into a user-visible booking failure — worse than the duplicate. |
| `public/hubly.html:44883` — owner CRM insert | **Would start throwing at owners**, mid-typing, for a case they are entitled to: an owner deliberately entering two customers who share a phone (a household, a business line, a couple). This surface is out of scope by ruling and does no identity resolution at all. A constraint would override that ruling from underneath. |
| `public/hubly.html:44911` | comment only, not a live insert |

**That second row is the real cost.** The database does not know about the owner-UI exemption,
so a constraint enforces the resolver's policy on a surface we deliberately excluded from it.
Any index work has to answer that first: either the owner UI gets an explicit conflict path, or
the index cannot be unconditional.

### Q1–Q4, 2026-09-06: does `mode` belong on more than this table? NO — and here is the limit

Every column in the database holding a Stripe object identifier, found by scanning column NAMES
**and** by scanning column VALUES across every `text`/`varchar` column in `public` (names alone
would miss an id in a generically-named column):

| table.column | non-null rows | sent back to Stripe? | verdict |
| --- | --- | --- | --- |
| `stripe_connect_accounts.stripe_account_id` | **2** | **yes, constantly** — `retrieveAccount`, `createConnectLoginLink`, and as `connectedAccountId` on every destination charge | **BREAKS on a mode flip** |
| `commerce_orders.stripe_checkout_session_id` | 1 | no | inert |
| `commerce_orders.stripe_payment_intent_id` | 0 | no | inert |
| `booking_requests.stripe_checkout_session_id` | 0 | no | inert |
| `booking_requests.stripe_payment_intent_id` | 0 | no | inert |
| `photography_project_invoices.stripe_invoice_id` | 0 | no writer, no reader | inert |

**Three non-null Stripe ids exist in the entire database.** `retrieveCheckoutSession` is exported
at `_shared/stripe.ts:334` and has **zero callers**; nothing calls `payment_intents` or
`/refunds` anywhere. Session and payment-intent ids are used **only as local lookup keys**
(`.eq("stripe_checkout_session_id", sessionId)`, matching a webhook's own id against our row) —
both sides come from the same event, so mode never enters. They are audit trail, not handles.

**So `mode` goes on `stripe_connect_accounts` and nowhere else.** The cost of a mode column is
not the backfill — it is the call sites that must learn to filter, which is per-column,
permanent, and does not shrink with row count. On the account id that buys correctness on the
money path. On orders it would be **inert by construction**, and an inert column is worse than
none: it must be written at four sites, filtered at zero, and it *looks* like something enforces
it.

#### THE DERIVABILITY FALLBACK COVERS SESSIONS AND SILENTLY FAILS FOR PAYMENT INTENTS

The argument for not adding the column elsewhere is that mode is recoverable from the id itself.
**That is true for checkout sessions and FALSE for payment intents. Checked, not assumed:**

| id kind | example (leading tokens only) | carries mode? |
| --- | --- | --- |
| checkout session | `cs_test_a1jq…` | **YES** — `_test_` segment |
| payment intent | `pi_3UCbhO…`, `pi_3UCZEE…` | **NO** |
| connected account | `acct_1TwA…`, `acct_1UCY…` | **NO** |

Both payment intents above are **real ids from the two real test-mode purchases** on 2026-09-06,
and both are `pi_3` + base62 — structurally identical to a live-mode id. Exactly like `acct_`,
which we already proved carries nothing.

> **A payment intent id in our database cannot be attributed to a mode by inspection, ever.**

Inert today because nothing reads a PI back, and there are **zero** non-null PI rows — so this is
free to get right now and expensive later. **The condition that makes it live:** the
reconciliation sweep proposed in **#45** calls `retrieveCheckoutSession`, and any refund or
dispute feature would call `payment_intents`. The moment either exists, those columns become
read-back ids in the account id's category, and the derivability fallback will cover the session
half while quietly failing on the payment-intent half. **Revisit this table then — do not assume
the "mode is in the value" argument still holds, because for `pi_` it never did.**

### If it is built

Sketch only, not a plan: a generated/stored normalised column (a `text` column written through
`normalisePhone`, or a `generated always as` expression matching it exactly — the two must not
drift, which is the same duplicated-rule problem R5 just solved), a **partial** unique index over
it scoped to `business_id`, a `23505` catch in the resolver that re-reads and returns the winner,
and a decision about the owner UI. The email index waits on the four rows.

---

## #48 — A failed account read writes the error and leaves the green standing

**Filed 2026-09-06. Not built. Mode-independent — a mode switch is one instance, not the class.**

`stripe-connect-connection`'s status action refreshes a connected account from Stripe and, when
that read **fails**, does this (`index.ts:114–133`):

```ts
let charges = !!conn?.charges_enabled;      // seeded from the LAST successful read
let payouts = !!conn?.payouts_enabled;
let details = !!conn?.details_submitted;
try {
  const acct = await retrieveAccount(conn.stripe_account_id);
  charges = !!acct.charges_enabled;  /* … */  lastError = null;
  await admin.from("stripe_connect_accounts").update({ charges_enabled: charges, /* … */ });
} catch (e) {
  lastError = (e as Error)?.message || "Could not refresh Stripe status";
  console.warn("stripe status refresh", e);
}
```

**On failure only `last_error` is set. `charges_enabled`, `payouts_enabled` and
`details_submitted` keep their values from the last successful read, and the response still
returns them.** The Settings panel renders **Stripe · Connected** in green off `charges_enabled`.

So the green badge does not mean "this account can take a payment". It means **"this account
could take a payment the last time we successfully asked, whenever that was."** Nothing on the
surface distinguishes those, and `updated_at` is only written on success, so the row cannot even
say how stale it is.

### The class, not the instance

This fires on **any** failed read:

- a Stripe outage or a network blip;
- an account deauthorised or rejected by Stripe;
- a revoked or rotated secret key;
- an account being read under the wrong mode's key.

Only the last is about mode. I originally scoped this as "test mode makes
`adrians-lawn-service` stale", and that was too narrow — mode is how we noticed it, not what it is.

**Same family as the booking ticker (#22), the invented trust badges, and #45: a surface
asserting a fact the underlying data no longer supports.** The tell is identical each time —
something renders confidently from a value nobody re-established.

### What the correct behaviour would be — recorded, NOT built

Either of these closes it; the second is better:

1. **Clear the capability flags on a failed read.** `charges_enabled` etc. become false and the
   badge stops being green. Honest, but loses the distinction between "not connected" and "we
   could not check", which are different things an owner would want worded differently.
2. **Mark the row stale with a read timestamp.** Add `last_checked_at` (written on every attempt,
   success or failure) and have every consumer treat a stale row as unknown rather than
   connected. Then *"Connected"* can never outlive the last successful check, and the UI can say
   *"we couldn't reach Stripe just now"* instead of implying either extreme.

Whichever is chosen, the invariant is: **no capability flag may be rendered as current unless the
read that produced it succeeded.** That is prohibition 2 — green is earned, never the default —
applied to a value that was earned once and then inherited forever.

### PREDICTION, untested — the status action writes, so it was not run

`adrians-lawn-service` holds a **live**-mode account (`acct_1TwA…`) and its row was last updated
**2026-08-20**, before the platform switched to test keys on 2026-09-06. Its
`charges_enabled = true` and `last_error = (none)` are therefore values from live mode that have
**never been re-read under the current test key**.

I expect that opening that Store screen now would call `retrieveAccount` with the test key, get
"No such account", set `last_error`, leave `charges_enabled` true, and render **Connected** for an
account that cannot take a payment. **This is a prediction and nothing more** — verifying it means
calling the status action, which writes the row, and this was a read-only pass.

---

## #49 — DESIGN: the `mode` column on `stripe_connect_accounts` (proposed, not run)

> ### ⛔ ORDERING CONSTRAINT — READ BEFORE RUNNING ANYTHING HERE
>
> **NO BUSINESS MAY HOLD TWO ACCOUNT ROWS UNTIL ALL 13 CALL SITES FILTER BY MODE.**
>
> Step 4 of the migration drops `UNIQUE (business_id)`. From that instant the schema permits two
> rows per business while the code still assumes one — and two of the readers fail *silently*
> (a `Map` keyed by `business_id` keeps whichever row arrives last), while
> `stripe-connect-onboard:150` would write one mode's flags onto the other mode's row.
>
> **So: after this migration and before the filter work, nobody runs Connect onboarding for a
> business that already has an account row — today that is `adrians-lawn-service` (live) and
> `evergreen-yard-care` (test).**
>
> The window is safe today only because each holds exactly one row and nothing is adding a
> second. It stops being safe the moment we onboard anyone, which is why the filter work lands
> **before Bucket**.

**2026-09-06. Read-only measurement + a migration to review. Nothing executed, nothing deployed.**

Rulings taken as given: **M1** `mode NOT NULL`, values `'test' | 'live'`, no default. **M2**
`UNIQUE (business_id, mode)`. **M3** every read filters by the current platform mode.

### M4 — 16 read/write sites across 8 files, and 13 of them need to change

| site | op | keyed by | needs the M3 filter? |
| --- | --- | --- | --- |
| `stripe-connect-onboard:103` | select | business_id | **yes** |
| `stripe-connect-onboard:122` | insert | — | **must SET mode** |
| `stripe-connect-onboard:150` | update | business_id | **yes — and this one BREAKS without it** |
| `stripe-connect-connection:73` | select | business_id | **yes** |
| `stripe-connect-connection:82` | delete | id (PK) | no |
| `stripe-connect-connection:122` | update | id (PK) | no |
| `create-store-checkout:59` | select | business_id | **yes — money path** |
| `create-booking-checkout:108` | select | business_id | **yes — money path** |
| `stripe-webhook:101` | update | stripe_account_id | no (globally unique) |
| `marketplace:1296` | select | business_id | **yes** |
| `marketplace_ops:173` | select | `.in(business_id)` | **yes — see below** |
| `marketplace_ops:298` | select | business_id | **yes** |
| `mission_control:133` | select | *(unfiltered scan)* | **yes — see below** |
| `mission_control:474` | select | charges_enabled | **yes** (a count) |
| `mission_control:866` | select | — | **yes** |
| `mission_control:914` | select | charges_enabled | **yes** (a count) |

Three are safe because they key on a primary key or on the globally-unique `stripe_account_id`.
**Thirteen are not.**

**Two of them fail silently rather than loudly, which is worse.** `mission_control:133` and
`marketplace_ops:173` both read many rows and build a **`Map` keyed by `business_id`**. With two
rows per business, the map keeps whichever row arrives last — no error, no duplicate warning, an
arbitrary mode's status shown as the business's status. That is finding #48 arriving by a third
route.

**And `stripe-connect-onboard:150` is the dangerous one:** it updates `.eq("business_id", …)`
with no mode filter. The moment a business has both rows, that statement updates **both** —
writing the live account's capability flags onto the test row and vice versa.

### M5 — the three bypass reads can and should use the accessor

`mission_control.ts:760, 761, 763` call `Deno.env.get("STRIPE_SECRET_KEY")` directly to render a
health tile. `_shared/stripe.ts` already exports `stripeConfigured()` and `stripeLivemode()`, and
`mission_control.ts` currently imports nothing from it — **there is no obstacle, only an import.**

Once mode selection depends on the key, those three reads are wrong by construction: they ask
"is a key set" when the question has become "which mode is this platform in". This is the five
copies of `money()` again — a rule that lives in one place and is consulted in another.

**The tile should also state the mode.** "Stripe: healthy" without saying *test* or *live* is the
same unearned green as #48.

### M6 — mode CANNOT be determined from our data. This changes the migration.

- Stripe account ids carry **no mode signal**: both rows are `acct_` + 21 characters. Unlike keys
  (`sk_test_` / `sk_live_`), there is nothing to parse.
- No column records it (that is the finding).
- `connected_at` allows an **inference**, not a determination: `adrians-lawn-service` connected
  2026-07-23, while the platform ran live keys; `evergreen-yard-care` connected 2026-09-06 05:28,
  after the switch to test keys that morning.

**The only authoritative check is to call Stripe under each key** — `retrieveAccount` succeeds
under the owning mode and 404s under the other.

So the backfill cannot be a pure SQL migration and also be *proven*. With exactly two rows, the
honest options are:

1. **Hand-assert in the migration, recording how it was established.** `adrians-lawn-service` =
   `live`, `evergreen-yard-care` = `test`, **stated by Adrian**, corroborated by `connected_at`
   against the key-switch date. Cheapest, and the provenance is written down rather than implied.
2. A one-off script that calls Stripe under both keys and reports before anything is written.
   Proof rather than assertion, but it is code that touches live Stripe to migrate two rows.

**Recommended: option 1 for these two rows, because they are ours and known.** Option 2 becomes
correct the moment there are rows we did not personally create — and that is before Bucket.

### M7 — the webhook secret needs to become two

`STRIPE_WEBHOOK_SECRET` is one variable with one read site (`stripe-webhook/index.ts:77`). Test
and live are separate endpoints with separate signing secrets, so live operation needs both, and
verification must try the one matching the current mode.

Proposed: `STRIPE_WEBHOOK_SECRET_TEST` and `STRIPE_WEBHOOK_SECRET_LIVE`, selected by
`stripeLivemode()`, with the existing `STRIPE_WEBHOOK_SECRET` kept as a fallback so the change
does not break the current deployment before the new values exist.

> **FOR THE RECORD: these values go into the Supabase web dashboard, entered by Adrian. Never
> `supabase secrets set`.** That command puts the value in shell history, in scrollback, and in
> any transcript that is later shared. That is the August leak, and the rule is that a key which
> has appeared in terminal output is compromised — the appearance itself is the breach.

### The migration — PROPOSED, NOT RUN, AND DELIBERATELY NOT IN `supabase/migrations/`

**It lives here, in a document, on purpose.** A file under `supabase/migrations/` is picked up by
`supabase db push` — it would be one absent-minded command away from running.

**And that has a cost that must not be left implicit: a migration that lives only in a markdown
finding is NOT in the schema history.** A database rebuilt from `supabase/migrations/` will not
have this column, so from the moment this runs until the file moves, **the repo can no longer
reproduce production.** That is the same defect as an unpinned API version — the authority
living somewhere other than the repo.

> **THE RULE: it stays in the finding until it runs, and it MOVES INTO `supabase/migrations/`
> the moment it does — same commit, not "later".** Running it and leaving it here is not a
> cautious half-step; it is the worst of both.

```sql
-- stripe_connect_accounts.mode — PROPOSED 2026-09-06. NOT RUN.
--
-- ONE TRANSACTION. Between the DROP at step 4 and the CREATE at step 5 there is
-- NO uniqueness on this table at all — a concurrent onboard could insert a
-- second row for the same business+mode and the index would then fail to build,
-- leaving the table with no constraint and the migration half-applied. Wrapped,
-- that window does not exist.
--
-- Plain CREATE UNIQUE INDEX, not CONCURRENTLY: CONCURRENTLY cannot run inside a
-- transaction, and with 2 rows the lock is irrelevant.
begin;

-- 1. add nullable, so the backfill has something to write into.
--    (NOT NULL with no default cannot be added to a table with existing rows.)
alter table public.stripe_connect_accounts add column mode text;

-- 2. backfill the two existing rows.
--    PROVENANCE: stated by Adrian, corroborated by connected_at against the
--    2026-09-06 key switch. Mode CANNOT be derived from an acct_ id (both are
--    acct_ + 21 chars, no marker) or from any column — the only proof is calling
--    Stripe under each key, which is what scripts/verify-stripe-account-modes.mjs
--    does. These two rows are hand-asserted because WE created both and can
--    vouch for them; that allow-list is deliberately tiny and the script exits
--    non-zero for any row not on it.
update public.stripe_connect_accounts a set mode = 'live'
  from public.businesses b
 where b.id = a.business_id and b.slug = 'adrians-lawn-service';

update public.stripe_connect_accounts a set mode = 'test'
  from public.businesses b
 where b.id = a.business_id and b.slug = 'evergreen-yard-care';

-- 3. refuse to continue if anything is unaccounted for. A migration that
--    silently leaves a NULL is the exact bug this column exists to fix.
do $$
declare n int;
begin
  select count(*) into n from public.stripe_connect_accounts where mode is null;
  if n > 0 then
    raise exception 'stripe_connect_accounts: % row(s) have no mode - backfill is incomplete', n;
  end if;
end $$;

-- 4. enforce. NO DEFAULT, deliberately: a default is how a row that cannot say
--    which mode it belongs to gets one anyway.
alter table public.stripe_connect_accounts alter column mode set not null;
alter table public.stripe_connect_accounts
  add constraint stripe_connect_accounts_mode_chk check (mode in ('test','live'));

-- 5. the old constraint is the blocker: UNIQUE (business_id) means a business can
--    NEVER hold both a test and a live account, so the first dual-mode onboard
--    fails with 23505 at insert. Dropped and replaced, in that order, inside this
--    transaction. stripe_connect_accounts_stripe_unique UNIQUE (stripe_account_id)
--    STAYS — an account id is globally unique in reality too.
alter table public.stripe_connect_accounts
  drop constraint stripe_connect_accounts_business_unique;

--    NOT `if not exists`, deliberately: if that index name already existed on
--    DIFFERENT columns, IF NOT EXISTS would silently do nothing and the
--    migration would COMMIT with no uniqueness at all — a silent no-op in the
--    one place nobody would think to check. Let it error.
create unique index stripe_connect_accounts_biz_mode_uniq
  on public.stripe_connect_accounts (business_id, mode);

commit;
```

**M-C2 checked before running — nothing depends on the dropped constraint for conflict
resolution.** No `.upsert()` or `onConflict` on `stripe_connect_accounts` anywhere in the
codebase (every one of the 16 sites is select/insert/update/delete), and **no database function
references the table at all** (`pg_get_functiondef` scan over every `public` routine → 0 rows).
The many `onConflict: "business_id"` hits in the repo are on other tables —
`workspace_memories`, `hubly_app_connections`, `commerce_store_settings`, `business_memories`.
This mattered because a broken `onConflict` fails at **runtime** and no schema diff would show it.

### THE ROLLBACK — written BEFORE the migration runs

```sql
-- ROLLBACK for the mode migration. Write it first; an untested rollback is a wish.
begin;

drop index if exists public.stripe_connect_accounts_biz_mode_uniq;

-- THIS IS THE STEP THAT CAN FAIL. If any business acquired a SECOND account row
-- while `mode` existed, restoring a single-row-per-business constraint is
-- impossible without deleting one — and choosing which mode's account to erase
-- from our records is a decision, not a rollback.
alter table public.stripe_connect_accounts
  add constraint stripe_connect_accounts_business_unique unique (business_id);

alter table public.stripe_connect_accounts
  drop constraint stripe_connect_accounts_mode_chk;

alter table public.stripe_connect_accounts drop column mode;

commit;
```

**What the rollback CANNOT undo — stated plainly:**

1. **A second account row.** If one exists, step 2 above fails and the rollback stops. Recovery
   means deleting a row first, which permanently drops our only record of one mode's account id
   (the account survives at Stripe; see the disconnect note above).
2. **Stripe-side objects.** Any Connect account created during the window still exists at Stripe.
   The rollback touches our schema only; it un-creates nothing.
3. **The backfilled provenance.** `drop column mode` destroys the hand-asserted mode values. Re-
   running the migration means re-asserting them — cheap for two rows we created, not cheap once
   there are rows we did not.
4. **Deployed code.** Any function shipped with a `.eq("mode", …)` filter breaks immediately
   against a table with no `mode` column. **The rollback is only safe if the code deploy is
   reverted in the same operation** — and reverting a Supabase function deploy is a redeploy of
   the old source, not an automatic step. Rolling back the schema alone converts a working system
   into a broken one.

**Because of (4), the schema and the code are one unit in both directions.** That is the same
constraint as the ordering rule at the top of this finding, seen from the other end.

**Existing constraints, measured — this was the open question and it is now answered:**

| constraint | keep? |
| --- | --- |
| `stripe_connect_accounts_pkey PRIMARY KEY (id)` | keep |
| `stripe_connect_accounts_business_unique UNIQUE (business_id)` | **DROP — it is the blocker** |
| `stripe_connect_accounts_stripe_unique UNIQUE (stripe_account_id)` | keep |
| `business_id` / `owner_id` foreign keys, `owner_idx` | keep |

**`UNIQUE (business_id)` is why M2 is not additive.** Today the schema enforces *one account per
business, full stop* — so a business physically cannot hold both a test and a live account, and
the first owner to onboard in the second mode gets a `23505` at insert, not a helpful message.
Dropping it and adding `(business_id, mode)` is strictly a widening, and the ordering matters:
**drop before create, both inside the same migration**, or there is a window where either two
accounts are impossible or two of one mode are.

**Deliberately NO default on `mode`.** A default is how a row that cannot say which mode it
belongs to gets one anyway, which is the defect being fixed.

### WHY THIS IS URGENT RATHER THAN TIDY — checked, and the news is mixed

**`stripe-connect-onboard:150` does NOT write `stripe_account_id`.** Quoted in full it writes six
columns — `charges_enabled`, `payouts_enabled`, `details_submitted`, `email`, `updated_at`,
`last_error`. The insert at `:122` is the only writer of the account id and is unreachable for a
business that already has a row (`stripe_account_id` is `NOT NULL`, so the `else` branch always
runs). Onboarding `adrians-lawn-service` under a test key fails with a 500 at `createAccountLink`
and writes nothing.

**Nor has that row been touched since the switch.** `connected_at 2026-07-23 00:11:50`,
`updated_at 2026-08-20 02:36:00` — three weeks before the 2026-09-06 key switch. Every write path
sets `updated_at` explicitly, so `touched_since_mode_switch = false`.

**But `stripe-connect-connection:82` deletes the row outright**, and with `UNIQUE (business_id)`
that row is the ONLY record of the live account id in our database:

```ts
if (action === "disconnect") {
  if (conn?.id) await admin.from("stripe_connect_accounts").delete().eq("id", conn.id);
}
```

The adjacent comment notes the remote Stripe account is deliberately left alive "for reuse" — but
reuse requires knowing the id, and after this statement nothing on our side does.

**Sized honestly: this is RECOVERABLE, not permanent.** The account continues to exist in Stripe
and its id can be read from the Stripe dashboard, so the loss is of *our* record, not of the
account. It is also owner-initiated rather than silent. So it is **an argument for the mode
column, not an emergency** — with `mode`, a disconnect scopes to the current mode and the other
mode's row survives untouched. Without it, an owner who disconnects while the platform is in the
other mode has to go find the id by hand to get back.

**Open before this runs:** whether a `business_id`-only unique constraint already exists (it would
have to be dropped, and I have not checked); and that all 13 call sites land in the same change
as the migration — a mode column with unfiltered readers is worse than no column, because
`stripe-connect-onboard:150` would begin writing across modes.

---

## #50 — The API version and the webhook version are two months apart, and that is not a bug to fix

**Documented 2026-09-06. Pre-existing. DO NOT "align" these by changing the webhook version.**

| axis | version | governs |
| --- | --- | --- |
| Stripe API (`Stripe-Version` header, now pinned in `_shared/stripe.ts`) | **`2026-08-26.dahlia`** | the shape of **responses** to our outbound calls |
| Webhook event destination (set in the Stripe Dashboard) | **`2026-06-24.dahlia`** | the shape of **event payloads** Stripe sends us |

**Two months apart, and the divergence predates the pin.** We are recording it, not creating it.

They are genuinely different axes. `stripe-webhook` parses **event payloads**, whose shape comes
from the destination's version — nothing it reads is affected by the API header. Everything else
(`create-store-checkout`, `create-booking-checkout`, `stripe-connect-*`) reads **responses**,
governed by the API version.

**Why this is filed rather than fixed:** changing the destination's version changes the shape of
every event `stripe-webhook` parses, on a path that has been carrying real payments for two days
and was only stabilised on 2026-09-06 (#45, #41). That is a payment-path change wearing a
tidiness costume. The fields we actually read — `payment_status`, `amount_total`,
`payment_intent`, `metadata`, `id` — are long-stable across both versions, so the divergence is
**inert today**.

**What would make it live:** reading a field whose shape changed between the two versions, in a
handler, without noticing which axis it came from. If anyone touches `stripe-webhook`'s parsing,
check the field against `2026-06-24.dahlia`, not against the API version pinned in code.

---

## #51 — OPERATIONAL RULE: the dashboard API-version knob is FROZEN until all 22 functions carry the pin

**2026-09-06. Not a defect — a rule with an expiry condition, recorded where it will be seen.**

> **DO NOT touch the API version knob in the Stripe Dashboard.**

As of today the pin is deployed to **4** functions — `create-booking-checkout`,
`create-store-checkout`, `stripe-connect-onboard`, `stripe-connect-connection`. Those read the
version **from the repo**. Every other function that can reach `api.stripe.com` still reads it
**from the dashboard**.

**While that split exists, changing the dashboard knob changes behaviour for one half of the
system and not the other, with nothing in git to show it happened.** That is worse than the
original problem: before the pin, everything drifted together and at least stayed consistent
with itself. A half-pinned platform can diverge from itself, and the difference is invisible to
code review because the changed value does not live in the repo.

**The closing action** — after which the knob is free again: deploy the pin to the remaining
**18** functions that transitively bundle `_shared/stripe.ts` via `hubly_provider_payments.ts`:

```
ai-advisor, analyze-photos, chatbot-message, creative-director, draft-customer-message,
generate-site, hubly-ai-status, hubly-brain, hubly-build-business, hubly-conversation,
hubly-daily, hubly-document-build, hubly-find-pro, hubly-intent-classify, import-offers,
lead-extract, marketplace, scratch-freeform
```

They are deliberately NOT deployed today, because the pin is today's one variable and 18 extra
deploys is a second one. Note the honest caveat: those 18 only *reach* Stripe through the
payments provider, and **whether that provider is ever actually invoked at runtime has not been
established** — so the practical exposure may be zero. That trace is the cheap thing to do
before deciding whether the 18 need a dedicated deploy or can pick the pin up whenever they next
ship for their own reasons.

**`stripe-webhook` is not on either list**: it imports only `verifyStripeWebhook`, which is local
HMAC with no outbound call. The pin cannot affect it.

---

## #52 — `as OwnerRecordEdit` on a request body: one unhandled kind, and a catch-all that INSERTS

**Measured 2026-09-06, read-only. NOT FIXED — the fix needs a runtime guard, which emits JS.**

The `design` case is the instance. **The cause is a cast on client-supplied input**
(`hubly-conversation/index.ts:1551`):

```ts
const directRecordEdit: OwnerRecordEdit | null =
  body?.directRecordEdit && typeof body.directRecordEdit === "object" &&
  typeof body.directRecordEdit.kind === "string"
    ? (body.directRecordEdit as OwnerRecordEdit)   // <- asserts a shape we do not control
    : null;
```

The only validation is *"`kind` is a string"*. The cast then asserts the entire union member —
every field, every literal — on a payload from the network. Same family as `as any`: it silences
the checker rather than establishing the fact.

### 1–2. The union vs the branches

| union member | branch in `applyOwnerRecordEdit` |
| --- | --- |
| `{ kind: "contact", … }` | ✅ `:4305` |
| `{ kind: "hours", … }` | ✅ `:4321` |
| `{ kind: "service", op: "add"\|"edit", … }` | ✅ fallthrough at `:4340` |
| `{ kind: "service", op: "remove", … }` | ✅ `:4343` |
| `{ kind: "design", knob, … }` | ❌ **none — falls into the service path** |

**5 members, 4 kinds, 2 explicit branches plus one implicit fallthrough.** One kind unhandled,
not three — the branch count is misleading because `service` is handled by falling off the end.

### 3. What actually happens — and the worse one is not `design`

**`design` is benign, as reported:** `String(edit.name || "")` is `""`, so `:4342` returns
`no_name` — *"A service needs a name."* No write.

**The catch-all at `:4357` is the real finding.** After the `remove` branch, the code does:

```ts
if (edit.op === "edit" && edit.id) { …PATCH… }
else { row.business_id = draftId; await adminWrite("POST", "services", "", row); }   // :4357
```

`else` is **everything that is not exactly `op === "edit"` with an `id`**. So a `service` edit
that carries a name and a **missing, misspelled, or bogus `op`** — `"delete"`, `"update"`, or
simply omitted — **INSERTS a new service row** instead of erroring. An edit intended as an update
silently becomes a duplicate.

**Severity, honestly:** the auth gate at `:4297–4304` runs first and requires a verified
`ownerUid` that owns this business, so this is not a security hole — it is an authenticated owner
writing to their own business, something they may do anyway. It is a **correctness** defect: a
malformed request from our own UI, or any future caller, creates a duplicate service instead of
failing. Given that services are what the pages are built from, a silent duplicate is not
cosmetic.

### 4. How widespread is the pattern — narrower than feared

**19 casts of a request-body value to a type across all edge functions:**

| cast target | count | verdict |
| --- | --- | --- |
| `as Record<string, unknown>` | **17** | **honest** — it asserts only "this is an object", forcing field-by-field reads with their own coercion |
| `as unknown as BodyInit` | 1 | a `fetch` body, not a request payload |
| **`as OwnerRecordEdit`** | **1** | **the outlier — the only cast to a discriminated domain union** |

So this is **one site, not a class**. Worth stating plainly because the instinct after finding one
is to assume twenty. (Separately: **60 `as any`** across edge functions — a different and larger
question, not measured here.)

### WHO SETS `op` — traced, and it lowers the priority

**`op` is set by client form code, as a literal. The model never composes a
`directRecordEdit`.** Three constructors, all in `public/`:

| site | what it sends |
| --- | --- |
| `platform-home.html:4387` | `{ kind:'service', op:'add', name, price, description }` |
| `platform-home.html:4395` | `{ kind:'service', op:'edit', id: data-id, prevName, name, … }` |
| `platform-home.html:4400` | `{ kind:'service', op:'remove', id: data-id, name }` |
| `platform-home.html:4693` | `{ kind:'service', op:'add', … }` (add-from-canvas) |

`hubly-conversation:1546` says so in as many words — *"The MANUAL FORM edit — a signed-in owner
changing a fact through a form, not the assistant."* The model's service changes go through
capability actions, a different path entirely. **So this is not "our own AI's output fires it
during normal use."**

**And `op:'edit'` always ships an `id`.** The id comes from `data-id` at `:4325`, rendered from
`hcManage.services`, which is a direct read of the `services` table (`:4296`) where `id` is the
primary key — never null. So the edit-without-id path is **not** reachable from our own UI today.

**What that leaves:** the `else` fires only for a caller that sends a `service` edit with a
missing or misspelled `op`. Nothing in the product does that. It is a latent trap for the next
caller — and the endpoint accepts a raw JSON body from any signed-in owner.

### HAS IT FIRED? Measured — and the answer is no, with one caveat worth keeping

**8 duplicate service names exist, and none of them came from this path:**

| business | kind | duplicates | span |
| --- | --- | --- | --- |
| `adrians-lawn-service` | test | 4 names × 2 | **8 seconds**, 2026-07-17 |
| `star-windows` | test | 4 names × 2 | **8 seconds**, 2026-07-18 |

Both are **8-second bursts** in July — a double-write during generation, not an owner editing a
form. Clustered, not chronic; two sessions, nine months of operation between them and now.

**Market businesses: 12 service rows, ZERO duplicate groups.**
**`graefs-autocare`: ZERO rows in `services` at all** — his eight services live in the generated
document, not the table, which is why the live page is unaffected either way.

**So: an honest zero for this defect.** It has never fired. That is a reason to schedule it
rather than rush it — but it does not make it safe, because the reason it has not fired is that
every current caller happens to be well-formed, not that anything checks.

### The fix, when it is done — not tonight

A `default`/exhaustiveness guard at the end of the `kind` dispatch (`kind: never` forces the
compiler to prove every member is handled, so a sixth union member becomes a compile error rather
than a silent fallthrough), and an explicit `op` check instead of `else`. Both emit JavaScript,
which is why they are recorded here rather than done in a type-only batch.

---

## #53 — Adobe/Lightroom excluded from the repo-wide typecheck. RULING: exclude, do not delete.

**2026-09-06. Reversible on purpose.**

**Zero usage, measured across every table that could hold it:**

| | count |
| --- | --- |
| `hubly_app_connections` (any provider) | **0** |
| adobe/lightroom connections | **0** |
| `photography_project_workspaces` | **0** |
| `photography_projects` | **0** |
| businesses with `capabilities.lightroom = true` | **0** |
| all five adobe edge functions | v31, last deployed **2026-08-19** |

**But it is NOT dead code, and that is why this is an exclusion rather than a deletion.**
`public/hubly.html:13147` loads `adobe-lightroom-service.js`, and `hasBusinessCapability()`
returns true for `lightroom` on any photo-led trade **even without the flag** — so the door can
open for the 9 businesses with `projects: true`. It is an **unused live feature**. Deleting a
built feature is a product decision; excluding it from a checker is not.

**THE NAMED FILES** — a list, never a glob or a directory, so that adding one is a deliberate act
that shows up in a diff:

```
supabase/functions/adobe-lightroom/index.ts              (64 distinct errors)
supabase/functions/adobe-oauth-disconnect/index.ts       (3)
supabase/functions/_shared/adobe_lightroom_client.ts     (1)
supabase/functions/_shared/hubly_provider_lightroom.ts   (1)
```

**Why:** 69 of 109 distinct errors — 63% of the remaining debt — in a feature with no users. The
point of the check is to cover code with customers, and this has none.

**What the exclusion is knowingly hiding.** Two of those 69 are genuine logic bugs, not inference
gaps: `TS2783` *"'x' is specified more than once, so this usage will be overwritten"* and
`TS2785` *"this spread always overwrites this property"*. There is also a
`Uint8Array → BodyInit` mismatch that could fail at runtime, and 26 `SupabaseClient` generic
conflicts. **These are not fixed and not forgotten — they are parked with the feature.**

> **THE CONDITION THAT BRINGS IT BACK: the first business that actually connects Lightroom.**
> At that moment this stops being unused code and the exclusion must be removed and the 69 fixed
> — including the two real bugs above, which will then be sitting in a live path.

**Result: 22 of 53 functions still fail with the adobe files excluded** — so the exclusion alone
does not make the check green. It removes the largest *unowned* block; the remaining 40 distinct
errors are in code with customers and are worth fixing on their merits.

---

## #54 — Service data has THREE homes, the manage panel reads one, and our anchor customer is in another

**Measured 2026-09-06, read-only. Nothing fixed.** Filed because it was found as a half-sentence
("Graef has zero rows in `services`") and is much larger than that.

### Correction first: I said his services live in the generated document. They do not.

`graefs-autocare` has **0 rows in `services`** AND **0 rows in `business_documents`**. His eight
services live in a **third** place: **`businesses.meta` — a `text` column holding JSON — at
`meta.service_catalog.services`**, an array of exactly **8**, matching the live page.

### The three homes

| home | what reads it | what writes it |
| --- | --- | --- |
| **`services` table** | the manage panel (`hcReadRecord` → `hcManage.services`), `applyOwnerRecordEdit` | the manage panel, capability actions |
| **`business_documents`** (freeform HTML) | the public freeform page | `create_business_document`, `applyServicesToFreeform` |
| **`businesses.meta.service_catalog`** | the **classic renderer**, the AI context loader (`hubly_conversation_context_loader.ts:132` — *"listServices → getCatalog reads meta.service_catalog"*), `marketplace:1518` | `hubly.html:15051` (`buildServiceCatalogFromEditor`), `hubly_brain_website.ts:460/487` |

**Nothing synchronises them.** `grep service_catalog` in `hubly_capability_registry.ts` returns
**zero** — the capability registry, which is what the assistant and the manage panel both write
through, has never heard of the catalog.

### 1. What the owner actually sees

`hcRenderManageBody` (`platform-home.html:4324`) builds service rows from `hcManage.services`,
which is a direct read of the `services` table (`:4296`). For Graef that array is empty, so
`svcRows` is `""` and the panel renders:

> **Services**
> *(nothing)*
> `[ New service name ] [ Price ] [ Short description ] [ Add ]`

**There is no empty state and no explanation** — just the heading, then the add-a-new-one row. An
owner whose live page shows eight priced services opens the panel and sees a blank Services
section with an add form. The reasonable reading is *"Hubly has lost my services"*, and the
reasonable next action is to retype all eight — which would create eight `services` rows that
**still do not appear on his page** (see §4).

### 2. The corpus split — measured across all three homes

| account_kind | businesses | in `services` | in `meta.service_catalog` | has document | **meta-only (panel blind)** | none anywhere |
| --- | --- | --- | --- | --- | --- | --- |
| test | 166 | 65 | 1 | 151 | 0 | 101 |
| **market** | **9** | **4** | **2** | 5 | **2** | 3 |
| internal | 3 | 1 | 1 | 1 | 1 | 1 |

**Market, by name:**

| business | `services` | `meta.service_catalog` | documents | `commerce_products` |
| --- | --- | --- | --- | --- |
| aquaspeed | 3 | 0 | 0 | 0 |
| **bucket-mobile-detailing** | **0** | **4** | 0 | **0** |
| detailing-chemicals-…-courses | 4 | 0 | 1 | 0 |
| devdetailing661 | 0 | 0 | 0 | 0 |
| **graefs-autocare** | **0** | **8** | 0 | **0** |
| lugnuts-regulators | 3 | 0 | 1 | 0 |
| mobile-auto-detailing-in-los-angeles | 0 | 0 | 1 | 0 |
| modern-landscaping-business | 0 | 0 | 1 | 0 |
| window-washing | 2 | 2 | 2 | 0 |

**So it is 2 of 9 market businesses — and they are the two that matter most: Graef, our anchor
customer, and Bucket, the paying one.** Both are meta-only. Both would see a blank Services
panel. `meta.service_catalog` is rare overall (4 businesses) but it is not randomly distributed.

### 3. Where the split comes from — NOT what I guessed

I expected it to track the renderer (classic vs freeform). **It does not.** All four of these are
`site_mode = 'classic'`, and so is everything else — that column has never routed anything.

The split tracks **which writer last touched the business**:

- built through the **editor** in `hubly.html` → `buildServiceCatalogFromEditor()` (`:15051`)
  writes `meta.service_catalog`;
- built/edited through the **capability registry** (the assistant, the manage panel) → rows in
  `services`;
- built as a **freeform document** → services baked into the stored HTML.

They are three independent lineages, not three modes of one system. A business ends up wherever
its last writer happened to live.

### 4. What an edit does for a meta-only business — traced, and it is worse than a no-op

`applyOwnerRecordEdit` for `kind:"service"`:

1. writes a row to the **`services` table** (`:4352` PATCH or `:4359` POST);
2. calls `applyServicesToFreeform` (`:4361`), which begins
   `const latest = await selectLatestBusinessDocument(draftId, "website"); if (!latest …) return { status: "not_freeform" }`.

For Graef there is **no document**, so step 2 returns `not_freeform` immediately and **the page is
never touched**. Nothing anywhere writes `meta.service_catalog`. So:

> **The owner types a service, it is saved to a table his page does not read, and his page does
> not change.** The function returns `ok: true, real: true` — and the summary it composes for the
> `not_freeform` case is *"Saved {name} to your list. I couldn't place it on the page — it will
> appear on the next rebuild."*

That last clause is **not true for this business**: a rebuild reads the catalog, not the table, so
the service will never appear. It is a promise the product cannot keep — the same defect family as
naming a control that does not exist.

**This is also why retyping the eight would be actively harmful**: eight new rows, a page that
still shows the original eight from the catalog, and two sources of truth diverging silently.

### M1 — what is actually IN each home (2026-09-06). The merge is trivial for the ones that matter.

Item shape is `meta.service_catalog.services[]`, keyed `{ name, pricing:{mode, price_cents,
show_price}, status, sort_order, description, duration_minutes, … }` — a far richer record than
the `services` table's `{name, price, description, sort_order}`.

| business | catalog | table | conflict? |
| --- | --- | --- | --- |
| **graefs-autocare** (market) | **8** | **0** | **none — table side empty** |
| **bucket-mobile-detailing** (market) | **4** | **0** | **none — table side empty** |
| cotter-aviation (internal) | 2 | 0 | none — table side empty |
| adrians-lawn-service (test) | 5 | **9** | **REAL CONFLICT — both populated, different counts** |

**Graef** (all `mode: "variable"`, `show_price: true`): Full Detail 8500, Premium Detail 13000,
Shampoo Detail 12000, Clay & Seal Package 7500, Paint Enhancement 15000, All-in-One Paint
Correction 20000, Single Stage 27500, 2 Stage 40000 — cents.

**Bucket** (all `mode: "fixed"`): Ceramic Coating 69900, Paint Correction 44900, Full Detail
24900, Interior Detail 14900.

**This is the important half: for both market businesses the table side is EMPTY.** There is
nothing to reconcile — no competing names, no diverging prices, no "which one is right". A merge
is a copy. The only genuine conflict is one **test** business.

### M2 — READERS, parsed. The two homes are not remotely equal.

**`services` table — 3 readers:**

| file:line | what |
| --- | --- |
| `public/platform-home.html:4293` | the manage panel |
| `public/hubly.html:15231` | the editor |
| `_shared/hubly_conversation_context_loader.ts:143` | AI context |

**`meta.service_catalog` — read through ONE module, `_shared/service_engine.ts`
(`getCatalog:541`, `listServices:624`, `getService:644`, `toBookingDto:664`,
`listBookingServices:696`, `toMatchDto:705`, `toAiSummary:728`), which is imported by ELEVEN
files:**

```
_shared/booking_job.ts          _shared/booking_price.ts
_shared/hubly_booking_execution.ts   _shared/hubly_conversation_context_loader.ts
_shared/marketplace_document.ts _shared/marketplace_lite.ts
_shared/marketplace_match.ts    _shared/marketplace_provider.ts
_shared/marketplace_score.ts    chatbot-message/index.ts
create-booking-checkout/index.ts
```

Plus client-side `hubly.html:15126` (`hydrateEditorFromServiceCatalog`) and
`journey-os/hubly-studio.js:143`.

> **The catalog is what BOOKING and PRICING read.** `booking_price.ts`, `booking_job.ts`,
> `create-booking-checkout` — the money path — all go through `service_engine`, i.e. through
> `meta.service_catalog`. The `services` table is read by two UI surfaces and one AI summariser.
>
> **That inverts the intuition.** The manage panel is not "the real one that Graef is missing from"
> — it is the *minor* home. The catalog is where the product actually operates.

**Cost of changing which is canonical, parsed rather than assumed:** making the table canonical
means re-pointing 11 importers plus the money path. Making the catalog canonical means changing 3
readers, one of which (`platform-home.html:4293`) is the broken panel itself. **The counts are
13-ish versus 3.**

### M3 — the false promises: TWO strings, both in the same function

| file:line | string |
| --- | --- |
| `hubly_capability_registry.ts:4365` | *"Saved {name} to your list. I couldn't place it on the page — **it will appear on the next rebuild**."* |
| `hubly_capability_registry.ts:4347` | *"Removed {name} from your list. **It may still show on the page until the next rebuild**."* |

Both are the `not_freeform` fallback in the service branch. **Both are false for a meta-only
business** — a rebuild reads `meta.service_catalog`, so an added service will never appear and a
removed one will never disappear. The removal string is the worse of the two: it tells the owner a
service he deleted is still publicly visible **and will stop being visible on its own**. It will
not.

Three other "until the next reload" comments exist (`platform-home.html:4739`,
`journey-os/journey.js:16875`, `:21968`) — those are code comments about client cache, not owner-
facing copy. **The owner-facing set is exactly these two.**

### M4 — the cheap fix is real, and it is ~6 lines, but it moves the split rather than closing it

`hcReadRecord` (`platform-home.html:4290`) already reads `businesses` on the very next line
(`:4294`). Adding `meta` to that existing `select`, parsing `meta.service_catalog.services`, and
falling back to it when the table read is empty is roughly:

```
+ 1 line   add `meta` to the existing businesses select
+ 4 lines  parse + map {name, pricing.price_cents/100, description} -> the panel's shape
+ 1 line   use it when hcManage.services is empty
```

**But it makes the panel READ-only-correct and WRITE-still-wrong.** Every save still goes to
`hcRecordEdit` → `applyOwnerRecordEdit` → the `services` table, which no rebuild and no booking
path reads. So Graef would see his eight services, edit one, get "Saved", and nothing would change
anywhere — **which is worse than the blank panel**, because a blank panel is obviously broken and
a populated one that silently discards edits is not.

**So the cheap fix is a real option only as half of a pair** (read the catalog AND write the
catalog). Reading alone converts a visible bug into an invisible one. That is the whole reason
this is a source-of-truth decision and not a patch.

### Not fixed. The decision this needs is which home wins

There are three, nothing syncs them, and picking one is a product decision with a migration
behind it. What must NOT happen is a fourth reader being added to whichever is convenient.

---

## #55 — `commerce_products` IS the single home for goods. The service split does not repeat.

**Measured 2026-09-06 in answer to: does #46's Store assumption hold given #54?**

**It holds.** Unlike services, product data has exactly one home:

- **`commerce_products` is the only table**, read by `commerce-api` for both the owner Store admin
  and the public `/store` route, and by `create-store-checkout`, which **re-prices from it
  server-side** and never trusts client prices.
- `businesses.meta` carries `storefront`, `storefrontDraft` and `storeOs` keys — but those are
  **presentation** (the Storefront AST: layout, theme, which products are featured), not the goods
  themselves. `commerce/store-page.js:7` states it: *"no second catalog, cart, or checkout, and no
  S.storeOs. commerce_products is the SSOT."*
- **All 9 market businesses have `commerce_products = 0`**, including Bucket — so there is no
  legacy product data anywhere to reconcile. The table is empty and uncontested.

**So #46 can be designed against `commerce_products` without inheriting #54's problem.** Two
caveats worth carrying:

1. **Bucket has 4 services in `meta.service_catalog` and 0 products.** Services and goods are
   different things, so this is not a conflict — but the business we are building a Store for
   already has its *service* data in the home the manage panel cannot see (#54). Whatever we ship
   for products, his services stay broken until #54 is decided.
2. The Storefront AST lives in `meta`, so **presentation** for the store follows the same
   blob-in-a-text-column pattern that produced #54. That is a smaller risk (it is layout, not
   facts a customer acts on) but it is the same shape, and it is worth not adding to.

---

## #56 — Generation wrote every service twice, in an 8-second burst, and nothing noticed for nine months

**Filed 2026-09-06, NOT investigated, per instruction. Member of the create-on-ambiguity family
(`STATE`).**

Eight duplicate service names exist in production, and they are not from the owner-edit path:

| business | account_kind | duplicates | window |
| --- | --- | --- | --- |
| `adrians-lawn-service` | test | 4 names × 2 | **8 seconds**, 2026-07-17 18:02:44 → 18:02:52 |
| `star-windows` | test | 4 names × 2 | **8 seconds**, 2026-07-18 05:10:20 → 05:10:27 |

Every service the business had, written twice, 8 seconds apart, in a single session. That is a
**generation path firing twice** — a retry, a double-dispatch, or a second write with no
idempotency key — not a person clicking twice.

**Both are test businesses and no market business is affected**, which is why this is filed rather
than urgent. But it went **nine months** without anyone noticing, and it was found only because a
different question happened to count duplicate names. The write path that did it has not been
identified.

Same family as #52 and #44: **the system created rows when it should have recognised it had
already done the work.**

---

## #57 — DESIGN for #54: `service_engine.ts` as the single owner. Two moves. NOTHING BUILT.

**2026-09-06, design only. No writes, no migration, no code. Recommendation stands — catalog
canonical — but see the blocker first, which was found while designing and changes Move 1's
opening step.**

### ⛔ BLOCKER FOUND WHILE DESIGNING: the only server-side catalog writer cannot succeed

`businesses` has **57 columns and `updated_at` is not one of them** (`created_at` is). Verified
against `information_schema`: `has_updated_at: 0`.

Both server-side meta writers set it anyway:

```ts
// marketplace/index.ts:1543  (handleLiteServicesSave — the catalog write)
// marketplace/index.ts:2014  (the hours write)
.update({ meta, updated_at: new Date().toISOString() }).eq("id", businessId);
```

PostgREST rejects an update naming a column that does not exist, so `upErr` is set and the
handler returns **500** every time. `handleLiteServicesSave` is reachable and live —
`marketplace-lite.html:772` posts `action: 'lite_services_save'`, routed at
`marketplace/index.ts:2333`.

> **So the one server-side path that writes `meta.service_catalog` has been returning 500. The
> catalogs in production were written by the CLIENT (`hubly.html` `buildBizMeta`), not by this.**

Unverified by execution — calling it writes, and this was a design pass. It is a code-and-schema
reading, and it should be confirmed by one request before Move 1 depends on it. **It also means
the hours save at `:2014` is broken the same way.** Filed here rather than as its own item because
it lands inside the code Move 1 replaces.

### THE RACE IS WIDER THAN SERVICES

`meta` is `text`. Every write is read-parse-modify-serialize-write of the **entire blob** —
Graef's is 46KB across ~40 top-level keys (`storefront`, `storeOs`, `bookingWizard`, `hours`,
`pipeline`, `quoteConfig`, …). `.update({ meta })` replaces all of it.

So the collision is not "two service edits". It is **"a service edit silently discards a
storefront edit"** — any two writers touching *any* two keys. Counted: **9 whole-meta writes in
`public/hubly.html`** plus the 2 server-side ones. Eleven doors onto one blob, no locking, no
version.

**And there is no version column to build optimistic concurrency on.** No `updated_at`, no
`meta_version`. That is a Move-1 requirement, not an optional refinement.

---

## MOVE 1 — one door in and out of service data

The same move that worked five times today: one customer resolver (#44), one money formatter
(#38), one phone normaliser (#44/R5), one Stripe mode deriver (#49), one service owner.

### The interface

`service_engine.ts` already owns every READ (`getCatalog:541`, `listServices:624`,
`getService:644`, `toBookingDto:664`, `listBookingServices:696`, `toMatchDto:705`,
`toAiSummary:728`) and already has the *shape* of a write (`buildCatalogWritePayload:803`,
`catalogFromOwnerServicesPayload:830`) — but those are pure functions that hand a blob back to
the caller, and the caller does the `.update()`. **That is the gap: there is no write DOOR, only
a write HELPER.**

Proposed additions — the only functions permitted to persist service data:

```ts
// Every mutation goes through one of these three. Each takes the admin client,
// performs read-modify-write inside a single guarded operation, and returns what
// ACTUALLY landed — never what was requested.
export async function applyServiceChange(
  admin: Admin,
  businessId: string,
  change:
    | { op: "add";    service: ServiceInput }
    | { op: "edit";   id: string; patch: Partial<ServiceInput> }
    | { op: "remove"; id: string }
    | { op: "replaceAll"; services: ServiceInput[] },   // the Lite/editor bulk save
  opts: { ownerUid: string; expectedVersion?: number },
): Promise<ServiceWriteResult>;

export type ServiceWriteResult = {
  ok: boolean;
  catalog: ServiceCatalog;        // the catalog as it now stands, read back
  applied: string[];              // names that actually changed
  conflict?: { expected: number; actual: number };  // set when the write was refused
  error?: string;
};

// Read-back, so a caller never composes a summary from what it asked for.
export function catalogVersion(business: Record<string, unknown>): number;
```

**Ownership is checked inside the door**, not by each caller — `ownerUid` is required and the
function asserts `businesses.owner_id === ownerUid`, the settled rule (never `context`).

### Who has to change

| caller | file:line | today | under Move 1 |
| --- | --- | --- | --- |
| manage panel read | `platform-home.html:4293` | reads `services` table | reads the catalog (via a thin edge read, since the client cannot import Deno modules) |
| manage panel write | `platform-home.html:4307` → `hcRecordEdit` | posts `directRecordEdit` | unchanged wire format; the server side re-points |
| `applyOwnerRecordEdit` | `hubly_capability_registry.ts:4340–4366` | writes `services` table + `applyServicesToFreeform` | calls `applyServiceChange` |
| Lite bulk save | `marketplace/index.ts:1538–1545` | inline read-modify-write (**and 500s**) | calls `applyServiceChange({op:"replaceAll"})` |
| editor bulk save | `hubly.html:15051` `buildServiceCatalogFromEditor` | client composes whole `meta` and PUTs it | posts services to the door; stops writing `meta` wholesale |
| the other 8 whole-meta writes | `hubly.html` (9 total) | replace the blob | **out of scope for Move 1** — they do not touch services, but they are the same race (see Move 2) |

**Note the honest edge:** Move 1 makes *service* writes safe. It does not make `meta` safe. A
storefront write at `hubly.html:24581` can still clobber a service write that landed a second
earlier, because it replaces the whole blob. **Move 1 narrows the race to one key; only Move 2
removes it.** That must not be described as fixed.

### The race, concretely — optimistic concurrency, last-writer-REFUSED

There is no version column today, so Move 1 must add one. Cheapest that works:
`service_catalog.version` already exists **inside** the catalog JSON (`buildCatalogWritePayload`
stamps `version: 1` — currently a constant, never incremented).

```
1. read businesses.meta -> parse -> catalog, v = catalog.version
2. apply the change in memory -> catalog', version = v + 1
3. write, guarded:  UPDATE businesses SET meta = :newMeta
                    WHERE id = :id
                      AND (meta::jsonb -> 'service_catalog' ->> 'version')::int = :v
                    RETURNING id
4. zero rows returned  ->  somebody else wrote between 1 and 3.
                           DO NOT retry blindly and DO NOT overwrite.
                           Re-read, and return { ok:false, conflict:{expected:v, actual} }.
```

**Which write wins: the FIRST one to commit. The second is refused, not silently dropped.** The
caller is told, and the owner sees *"Someone else changed your services while you were editing —
here they are now."* That is the opposite of today, where the second write wins and the first
vanishes with nothing said.

The guard is one `AND` on the UPDATE and requires no schema change (the version lives in the JSON
we are already writing). It works on a `text` column because the cast happens in the predicate.

**What it does not cover:** two writes to *different* meta keys still clobber, because the
predicate only guards the catalog version. Move 2.

### `applyServicesToFreeform` under Move 1

Today it is the dead end: `selectLatestBusinessDocument(...)` → no document → `not_freeform` →
the page is never touched and the caller emits a promise it cannot keep.

Under Move 1 it stops being the page-update path and becomes **one of two placement strategies
chosen by what the business actually has**:

- **freeform business** (a `business_documents` row): unchanged — stamp the anchors, save a
  version. Placement is real and reportable.
- **classic/catalog business** (Graef, Bucket): there is nothing to patch, because the page is
  rendered from the catalog at request time. **The write to the catalog IS the page update.**
  Placement is not "not_freeform" — it is *already done*.

That reframing is what makes the two strings honest, below. `not_freeform` stops being a failure
and becomes "this business does not use documents", which is a fact, not an error.

---

## CAS ON THE WHOLE META TEXT — TESTED, AND IT BREAKS. The hash variant survives.

**Adrian's proposal:** `.update({meta:next}).eq("id",id).eq("meta",priorText)` — guard on the
entire prior blob so all 11 writers are seen, not just the ones touching `service_catalog`.
**The idea is right and the mechanism does not work.** Measured, not reasoned:

### 1. Does PostgREST filter on a ~46KB text equality? NO.

A `.eq()` filter travels in the **query string**, so the value hits the request-line limit.
Probed read-only against `businesses` with values of increasing length:

| filter value | result |
| --- | --- |
| 500 – 24,000 chars | **OK** |
| 26,000 chars | **Bad Request** |
| 32,000 / 46,254 chars | **Bad Request** |

**The ceiling is between 24,000 and 26,000 characters.** And it is not a clean `414 URI Too
Long` — it comes back as a bare `Bad Request` with no message, which is its own problem: a caller
could not distinguish "your CAS failed" from "your URL was too long".

### 2. It fails for exactly the businesses this is about

| business | account_kind | `meta` length | CAS-by-URL |
| --- | --- | --- | --- |
| **bucket-mobile-detailing** | market | **515,856** | **impossible** |
| **devdetailing661** | market | **178,500** | **impossible** |
| **graefs-autocare** | market | **46,254** | **impossible** |
| **aquaspeed** | market | **30,341** | **impossible** |
| my-auto-detailing | internal | 9,478 | works |
| everything else | — | avg **4,795** | works |

**5 of 178 businesses exceed the limit — and 4 of them are market businesses**, including both
businesses in #54. The proposal fails precisely where it is needed and works everywhere it is not.
Bucket's `meta` is **half a megabyte**, which is worth noticing on its own.

### 3. The variant that survives: CAS on a HASH, in an RPC

Keep the semantics — guard the whole blob, see all 11 writers — and stop putting the blob in a
URL:

```sql
-- create_business_meta_cas(p_business_id uuid, p_expected_hash text, p_next_meta text)
update public.businesses
   set meta = p_next_meta
 where id = p_business_id
   and md5(coalesce(meta,'')) = p_expected_hash
returning id;
-- zero rows -> somebody wrote in between. Re-read, refuse, report. Never retry blindly.
```

The guard value is **32 characters** against a ~24,000 ceiling — three orders of magnitude of
headroom — and in an RPC it travels in the **POST body** anyway, where no such limit applies.
Verified: `md5(meta)` over Bucket's 515,856 chars and Graef's 46,254 both return 32-char digests.

This also matches a pattern already in the codebase — `create_business_document` is an RPC that
takes its payload in the body for the same reason.

**Cost:** one migration (a `security definer` function, ownership asserted inside it, same shape
as the existing business RPCs). No column, no `jsonb` conversion, no valid-JSON precondition —
so it keeps every advantage Adrian's version had over the version-key design.

**Residual risk, stated:** `md5` is a collision-resistant-enough check for accidental concurrent
writes; it is not a security boundary and is not being used as one. Two *different* metas hashing
equal is not a threat model here — the adversary would have to be our own writer.

### 4. Writers that need to win unconditionally

Three, and each needs an explicit escape hatch rather than a silent bypass:

- **Generation** (`hubly_brain_website.ts:460/487` writes `service_catalog` during a build). A
  build legitimately replaces what was there. It should pass the hash it read, and on conflict
  **fail loudly** — a build racing an owner edit is exactly the case we want to hear about, not
  paper over.
- **Migrations and backfills.** Out of band, no CAS, by definition.
- **A retry after a network timeout.** The first write may have succeeded; CAS then refuses the
  retry. That is *correct*, but the caller must distinguish **"conflict — someone else wrote"**
  from **"conflict — I already applied this"**, or it will report a false failure to the owner.
  The result object needs enough information to tell them apart (compare the current catalog to
  what was being written).

### 5. Does contention make it worse than the loss it prevents? Probably not — with one caveat

Average `meta` is 4,795 bytes and writes are overwhelmingly one owner at a time; genuine
concurrency is rare. The real exposure is **`hubly.html`'s 9 whole-meta write sites**, some of
which are autosave-shaped: if the editor autosaves while the assistant writes, refusals could
become frequent.

**The caveat is the honest one:** CAS converts *silent loss* into *visible refusal*, which is
strictly better by our own rules (prohibition 6) — **but only if the caller re-reads and merges.**
A refusal that surfaces as "couldn't save, try again" and drops the owner's typing has traded one
data loss for another. **So CAS is not complete without a re-read-and-merge path in the client**,
and that is real work in `hubly.html`, not a one-liner. It should be sized before adoption rather
than discovered during it.

### Verdict

**Adopt the semantics, reject the mechanism.** CAS on the whole blob is the right guard and does
close #54 rather than narrowing it. It must be implemented as **hash-CAS inside an RPC**, because
the URL form is impossible for 4 of 9 market businesses. With that change, Move 2 becomes
genuinely optional — as Adrian said it would.

---

## MOVE 2 — storage. NOT NOW, and the point of Move 1 is that it stops being urgent.

Behind one door the backing store is swappable. Options, with costs, **not chosen**:

| option | cost | what it buys | what it does not |
| --- | --- | --- | --- |
| **A. Stay on `text`** | zero | nothing changes | the whole-blob race stays for all ~40 keys; 11 writers keep clobbering each other |
| **B. `meta` → `jsonb`** | one migration (`alter column meta type jsonb using meta::jsonb`), plus auditing every reader that does `JSON.parse(meta)` and every writer that sends a string. Risk: any row whose `meta` is not valid JSON fails the cast — **must be counted first** | enables `jsonb_set(meta, '{service_catalog}', …)`, so a service write touches ONE key and stops clobbering the other 39. Kills the wide race | still one row per business; no per-service constraints, no indexes on service fields |
| **C. promote to a real `service_catalog` table** | largest — new table with the catalog's richer schema (pricing mode, `show_price`, duration, status, sort_order, addons, ai), backfill 4 businesses, re-point 11 `service_engine` importers, and decide what happens to the legacy `services` table | per-row constraints, a unique index on (business, name), real concurrency, queryability | a migration with a live booking path behind it |

**Sequencing note:** B is a strict prerequisite for nothing and a strict improvement for
everything; C subsumes B. The decision is not urgent **once Move 1 lands**, which is the argument
for doing Move 1 first.

---

## THE TWO STRINGS, AFTER MOVE 1

| today | after |
| --- | --- |
| `:4365` *"Saved {name} to your list. I couldn't place it on the page — it will appear on the next rebuild."* | **"Added {name} to your services, at {price}. It's on your page now."** — for a catalog business the write IS the placement; for a freeform business the anchor pass ran and reported. |
| `:4347` *"Removed {name} from your list. It may still show on the page until the next rebuild."* | **"Removed {name}. It's off your page."** |

**Neither needs a hedge**, because both are composed from `ServiceWriteResult` — what landed, read
back — rather than from what was requested. That is the `servicesTruth` pattern already used
elsewhere.

**The one case that still needs a sentence, and it is not a hedge:** the conflict path.
*"Someone else changed your services while you were editing. Here's the current list — try again."*
That is a true statement about a real event, which is the opposite of a hedge.

**Where Move 1 does NOT finish the job, stated because you asked:** a freeform business whose
anchor pass genuinely fails (the page has no services section to place into) still needs
*"Saved — I couldn't place it on the page."* That is honest and reportable; what it must never
again say is **"it will appear on the next rebuild"**, because nothing guarantees that. The hedge
that remains is a real uncertainty; the one being removed was a false promise.

---

## THE INVARIANT — `scripts/check-service-data-owner.mjs` (designed, not written)

In the style of `check-owner-id-invariant`, `check-customer-identity-invariant`,
`check-stripe-mode-filter`:

1. **`meta.service_catalog` is written in exactly one place.** Scan every `.ts`/`.js`/`.html`
   under `supabase/functions/` and `public/` for an assignment to `service_catalog` or a
   `.update(`/`PATCH` on `businesses` whose payload mentions `meta`. Exactly one file may match:
   `_shared/service_engine.ts`. **Today that count is 11** (2 server, 9 client).
2. **The `services` table is written in exactly one place** — or zero, once the catalog is
   canonical. Today: `hubly_capability_registry.ts:4352/:4359` plus the client editor.
3. **No caller composes a service summary from its own input.** Flag any `summary:` template
   literal in the service branch that interpolates a variable not derived from a
   `ServiceWriteResult` — the `servicesTruth` rule, mechanised.
4. **Proven to fail:** run it against `HEAD~1` and require a non-zero exit, the same
   deliberate-break test used on the other three.

**Where it stops — and this list matters more than the checks:**

- **It cannot see the whole-meta race.** Every one of the 9 client writers replaces `meta`
  wholesale; a check that only looks for the literal `service_catalog` will pass them all while
  they silently clobber it. **This check would go green on a codebase that still loses service
  edits.** Only Move 2 (B or C) closes that, and until then the check is guarding one key while
  the blob is unguarded.
- It is static and text-based: a write assembled at runtime, or reached through a variable
  holding the table name, is invisible.
- It cannot see SQL, an RPC, or a trigger — the same limit as the other three.
- It proves *where* writes happen, never that they are *correct*. A single owner that computes
  the wrong catalog passes every check here.
- It cannot verify the two strings are true; it can only check they are composed from the result
  object. Truth is still a walk-the-product question.

---

## #58 — THE CAS GATE: sizing the 9 whole-meta write sites in `hubly.html`

**Ruling adopted 2026-09-06:** hash-CAS in a `security definer` RPC, guarded on
`md5(coalesce(meta,''))`.

> **`md5` is deliberate and must not be "upgraded" without a reason.** We are detecting
> ACCIDENTAL concurrent writes between our own writers, not defending against a forger. There is
> no adversary who benefits from colliding a hash here. Swapping it for sha256 costs bytes and
> buys nothing; if someone changes it, they should be able to name the threat first.

> ### ⛔ THE GATE
> **NO WRITE SITE ADOPTS CAS UNTIL IT CAN SURVIVE A REFUSAL WITHOUT LOSING THE USER'S INPUT.**
> A refusal that drops the owner's typing is the same data loss with better manners.

### The nine sites, classified by what a refusal would cost

| # | line | trigger | error handling today | shape | conflict-safe cost |
| --- | --- | --- | --- | --- | --- |
| 1 | `13896` | `markM2ExperienceHome()` — a UI flag | `.then(()=>{})` **swallows** | **fire-and-forget** | **trivial** — retry once on conflict; there is no user input to lose |
| 2 | `18470` | business **creation** (`buildBizMeta()` in the insert) | n/a | **INSERT, not update** | **exempt** — no prior row, no CAS |
| 3 | `24581` | import-offers apply (`pkg-hub`/`svc-editor`) | `.then(({error})` | **explicit save**, already behind a `confirm()` | **cheap** — the payload is in memory; on conflict re-read and re-show the confirm |
| 4 | `28814` | onboarding submit | n/a in this path | **INSERT/first save** | **cheap** |
| 5 | `28957` | hero-headline choice | `await`, error checked | **explicit save**, single field | **cheap** — re-read, re-apply one field |
| 6 | `33445` | logo-scale button | `.then(({error})` | **fire-and-forget UI setting** | **trivial** — retry once |
| 7 | `33503` | generic `persist` after a preview render | `.then(({error})` | **AUTOSAVE-SHAPED** ⚠ | **expensive** — see below |
| 8 | `45783` | `persistPipelineSoon()` — **debounced timer** | `await`, error checked | **AUTOSAVE-SHAPED** ⚠ | **expensive** |
| 9 | `49811` | `approvePendingReview()` | `await`, error checked | **explicit action** | **cheap** — re-read, re-apply the approval |

**Counts: 2 autosave-shaped, 5 explicit-save-shaped, 2 inserts (exempt).**

### Why the two autosave sites are the whole cost

`persistPipelineSoon` (`:45777`) is a `setTimeout` debounce and `:33499`'s `persist` fires after a
preview render. In both, **nobody is watching**: a refusal has no dialog to appear in, and the
in-memory state the owner has been editing is the only copy. Retrying blindly is exactly what the
CAS design forbids (it would clobber the other writer). So these two need a **read-merge-rewrite**
loop: re-read `meta`, re-apply *this site's own keys* onto the fresh blob, recompute the hash,
write again — and give up loudly after N attempts rather than silently.

**That is per-site work and it is the honest reason this is not a one-day change.** The other
seven are hours; these two are the day.

### The estimate

- **7 sites (2 exempt + 5 explicit): ~half a day.** Mostly "on conflict, re-read and tell the
  owner", and five of them already destructure `error`, so the plumbing exists.
- **2 autosave sites: ~1–2 days**, because each needs a key-scoped merge, and `persistPipelineSoon`
  in particular writes the whole blob on a timer while the owner is still typing elsewhere.
- **Plus the RPC + `service_engine` door itself.**

> **So Move 1 is 2–3 days, not a day — and the two autosave sites are the reason.** Worth knowing
> now: the alternative is adopting CAS on the 7 cheap sites and leaving the 2 autosave sites
> unguarded, which would mean the loudest, most frequent writer in the product is the one that can
> still clobber. **That is not a partial win, it is the same bug with fewer witnesses.**

---

## #59 — Bucket's `meta` is half a megabyte because base64 images are inlined into the JSON

**Measured 2026-09-06.** This is why the CAS-by-URL mechanism was impossible, and it is a defect
on its own.

`bucket-mobile-detailing.meta` = **515,856 bytes**, and it decomposes as:

| key | bytes |
| --- | --- |
| `website` | **503,598** |
| `service_catalog` | 5,423 |
| `bookingWizard` | 3,601 |
| everything else (~37 keys) | < 2,000 combined |

Inside `website`:

| key | bytes |
| --- | --- |
| **`website.profileSheetImage`** | **420,855** |
| **`website.ownerPhotoUrl`** | **60,779** |
| **`website.profileHeroImage`** | **14,803** |
| all real content (`faq`, `ourStory`, `ownerBio`, `galleryAlbums`, `page`) | ~4,700 |

**Three `data:image/…` base64 URIs stored inside a `text` column.** Confirmed by counting
occurrences of `data:image/` in the raw meta: **3**.

**It is not just Bucket:**

| business | account_kind | meta | inlined images |
| --- | --- | --- | --- |
| bucket-mobile-detailing | market | 515,856 | 3 |
| devdetailing661 | market | 178,500 | 2 |
| aquaspeed | market | 30,341 | 1 |

**3 of 9 market businesses**, and they are 3 of the 4 that blow the PostgREST URL ceiling.

### Why this matters beyond size

1. **Every whole-meta write re-transmits the images.** Nine client write sites each PUT the entire
   blob — so toggling a logo-scale button on Bucket's business uploads 516KB. On a phone, on a
   detailer's data plan, repeatedly.
2. **It makes the read-modify-write window longer**, which makes the race #57 addresses *more*
   likely for exactly these businesses.
3. **Hubly has Supabase Storage and uses it elsewhere** (`uploadDraftLogo`, `uploadDraftPhoto`,
   `uploadAndPatchDocumentImage` all produce URLs). These three images took a different path and
   nobody noticed.
4. There is a real ceiling ahead: Postgres will tolerate this for a long time, but a row that
   grows with every uploaded image has no natural bound.

**Not investigated: which writer inlines them.** `profileSheetImage` and `profileHeroImage` are
profile-sheet fields; `ownerPhotoUrl` is named `…Url` and holds base64, which suggests a path that
was meant to store a URL and stores the data instead. **That trace is the next step and was not
taken tonight.**

**Do not fix this by shrinking the images.** The fix is to put them in Storage and keep a URL in
`meta`, which is what the rest of the product already does.
