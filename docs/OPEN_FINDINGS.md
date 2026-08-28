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

## 3. Prices are never read back

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

## 5. "On the site now" doesn't say WHERE — worse on mobile

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

## 7. UNVERIFIED: do service cards actually appear on a freeform page?

**Severity:** unknown — could be a silent hole under everything.

**What's known / not known:** `setServices` is called and the model reads prices
back, and the builder's step list says "services are on the page." But **nobody has
confirmed, by looking at a rendered freeform page, that the service cards/prices the
owner entered actually render on it.** The freeform generator reads services from the
record (`buildBusinessRecordBlock`), but a freeform page is a single generation — if
the model omits a services section, or setServices updates the record without a
rebuild that shows them, the prices could be set-but-invisible. This is exactly the
"freeform pages have no update path" gap (see KNOWN_ISSUES): a `services`
recordChange returns `not_applicable` on a freeform rebuild, and services only
"appear" because `setServices` patches through its own inline path — which has not
been visually verified end to end.

**What's been tried:** nothing directly — every test this week set services during
the FIRST build (so they were generated in), never added/changed after the page
existed and confirmed the page updated.

**What would close it:** on a real freeform build, (a) confirm the entered services +
prices are visibly on the rendered page after the initial build, and (b) change a
price by talking AFTER the page exists and confirm the page updates to show it (not
just the record). If (b) fails, that's the freeform-immutability finding biting a
core capability, and it's bigger than a cosmetic bug.

---

## Related, already-tracked

- **Freeform pages have no update path** — the structural finding under #3/#5/#7. See
  `docs/KNOWN_ISSUES.md` ("Freeform pages have NO update path"). A record change
  no-ops except `contact`; photos/logo now place via targeted placement (2026-08-27),
  but services/hours/area/logo-on-page still don't have a post-build path.
- **Post-claim editor** — deferred investigation. The 2026-08-28 direction (editing
  turns on at claim; the shell/Website Editor tab is "the next build") makes this the
  decisive open question: after claiming, can an owner actually change copy, swap a
  photo, fix a price, delete a section? Run read-only before building the shell.
