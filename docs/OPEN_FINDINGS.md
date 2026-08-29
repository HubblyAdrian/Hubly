# Open findings — Adrian's 2026-08-28 phone run

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
