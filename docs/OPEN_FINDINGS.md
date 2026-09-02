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

## Also noted 2026-08-28

- **Rebuild read-back is vague.** The "yes, rebuild" reply ("a completely new page is
  live … with the full menu in mind") is truthful but does NOT enumerate prices or name
  the service that was added, unlike the patch read-back (#3). The rebuild path should
  read back what actually landed, same discipline.

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
