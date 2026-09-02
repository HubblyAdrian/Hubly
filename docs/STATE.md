# STATE — where the build is (2026-09-01)

The current picture, no history. Pairs with `CLAUDE.md` (the rules), `PRODUCT_SHAPE.md`
(decisions), `OPEN_FINDINGS.md` and `SHELL_TERRAIN.md`. This file is the durable record;
if it disagrees with memory, this wins. Evergreen-yard-care (`c969eb51-…`, account_kind=test,
claimed, owner `adriansmithee+evergreen@gmail.com`) is the claimed-owner test business.

## Built — do not rebuild (verify by using, don't re-implement)

- **Claim → claimed shell.** Two modes on one switch (`hc.mode`→`data-mode`, `hcOpenWorkspace`):
  **Home** (chat is the screen) and **Website** (site = canvas, chat = assistant panel). Rail
  beneath a slim solid header. Settings is a popout (Account/Notifications/Website/Integrations).
- **Click-to-edit** on a claimed page (the iframe runs the auth handshake itself). Direct edits
  are optimistic; **Undo** = `restore_prev_business_document`. NOTE: click-to-edit changes TEXT
  only, plus color/font swatches — no size/image/formatting yet (Build B below).
- **Home is an assistant**: calm greeting, transcript reachable, gaps recap from
  `get_my_site_gaps`, earned-by-state suggestions, silent when nothing's due.
- **Owner-authorised fact writes on a CLAIMED site — PROVEN LIVE (2026-09-01).** The draft-token
  writers refuse a claimed row; the fix mirrors `create_business_document`: `patch_business_in_progress`,
  `set_business_hours_in_progress`, `set_business_draft_services` each take `p_owner_id`
  (unclaimed→token, claimed→`owner_id=p_owner_id`), and are **locked to `service_role` only** so
  the browser can't forge it. Edge verifies the JWT (`resolveOwnerUid`, lazy+memoized) and passes
  the uid; the client sends the owner token on typed/post_build/direct sends. Threaded through
  BOTH extraction AND the model-invoked dispatch (`dispatchArgs.ownerUid`). Proven: phone + hours
  + a service saved on the claimed site.
- **Grounding — never publish a fact the owner didn't state THIS turn (PROVEN LIVE).** A value is
  grounded only if it appears in the current message (`hubly_grounding.ts`: phone by 10-digit key
  over a digit-normalised message incl. spelled-out; price as a standalone figure; email/address
  verbatim). `updateDraft` grounds phone/email. `setServices` is **replace-all**, so it
  RECONCILES instead of filtering: keep an entry grounded OR already-on-record-unchanged, drop only
  a genuinely new/changed lift; a hallucinated price change preserves the RECORD's value; if
  nothing real changed and a lift was dropped, write NOTHING and ask. Proven live: "add my phone
  number" (no number) → asked instead of lifting `801-888-8888`; "gutter cleaning $150" saved and
  the existing five survived.
- **Contact & Hours block** (`hubly_contact.ts`): post-build home for hours/phone/email/address,
  inserted when absent / updated in place / deduped by one key per fact, free-text `hours_note`,
  `&ndash;` entities, countable, per-fact read-back. NO re-recognition of a model-authored hours
  list (it clobbered a footer — removed). Heading **re-derives** from contents (a contact-first
  block that gains hours reads "Hours & Contact" — CONFIRMED LIVE on evergreen).
- **Services extraction + freeform placement**: model-pass extraction, build + retroactive anchor
  stamp, insert-by-clone, card-grid labelling.
- **Stripe Connect Express** exists behind a Settings door, deprioritized, never proven E2E.

## BROKEN — found on the 2026-09-01 claimed-owner run (report done, fixes pending)

1. **Cloned service card copies the sibling's image.** `buildClonedServiceEntry`
   (`hubly_capability_registry.ts:2856`) re-keys name/price/desc, blanks text, strips the `book=1`
   CTA — but **never touches the `<img>`**, so a new card inherits the neighbour's photo (Gutter
   Cleaning shipped with Basic Mow's logo; same root as Spring Aeration/Hedge Trimming sharing a
   stock photo). Fix: strip the image like the CTA — but DECIDE FIRST what a new card shows
   (empty slot / neutral placeholder / no-image layout); an empty box on a live site is its own bug.
2. **Cloned cards don't match originals** (flagged 3×). Diff on evergreen: original Basic Mow has
   `<span>per visit</span>` (unit), a `<p>` description, and an inner `<a>` Book CTA; the Gutter
   clone has an **empty unit span** (line 2880 `>[^<]*<` blanks ALL text, including the fixed
   "per visit" LABEL — not per-service data), a hidden empty desc, and **no CTA** (line 2879
   strips it by design — capped page-level CTAs). Root cause: blank-all-text is too aggressive
   (kills fixed labels) and the CTA-strip makes clones visually asymmetric with originals.
3. **Free-text hours note never lands + read-back announces before doing.** "Weekends are by
   appointment" (evergreen seq 24) → reply "On it." and `hours_note` is still `null`. Extraction
   DID run (`worthAPass` true — evergreen has state/address/radius/years null → `gaps.missing`),
   so the model-pass extraction did not classify it as `hoursNote` despite the schema example
   being nearly identical (`hubly_extract.ts` EXTRACTION_SCHEMA). Two defects: (a) extraction
   unreliably captures the note; (b) "On it." is announce-before-doing — nothing announced before
   it happens. Needs a live extraction trace to pin (a).
4. **"See what a customer sees" opens the booking form, not the site.** The three Home buttons
   (`platform-home.html:3794-3796`): "Visit your site"→`url`, **"See what a customer sees"→
   `url/?book=1` (the booking flow)**, "Start editing"→`hcOpenWorkspace('website')`. Both first
   labels describe a customer's view; nothing says one is the booking form. A button must say
   where it goes — relabel (e.g. "Preview the booking form") and/or fix the destination.
5. **Contact & Hours block type doesn't match the page** (flagged 2×; same root as the service
   cards). The scoped CSS uses `font: inherit`, so the block takes type from whatever it's nested
   inside, not the page's real typography. Fix likely reads the page's own font declarations
   (`body`/`:root`/dominant heading) at insert time and writes them EXPLICITLY, instead of `inherit`.
6. **Heading fix — CONFIRMED FIXED LIVE** (evergreen block reads "Hours & Contact").

## The recurring pattern — state it as a pattern, not anecdotes

**Compiled clean, deployed clean, did nothing — three times now, always the same shape: the
failure is in the WIRING between working parts, and only using it AS THE OWNER, ON THE REAL
THING found it.** (1) The write path locked for every claimed owner for a week — draft-only
tests were all green. (2) The "✎ Edit details" button did nothing — an inline `onclick` on a
function inside the app's IIFE (not global). (3) Every manual save failed — a chat-turn guard
(`messages_required`) rejected structured edits ~530 lines before the handler, AND the raw
stored token expired (~1h) while the read path auto-refreshed, so the panel LOADED and every
save died. CLAUDE.md now carries the rule (verify as the owner, on the real thing); this is the
evidence for why. Reproduce in the real STATE (signed-in owner, claimed business), read the
actual network response / console — never diagnose from source.

## Build A — the manual "Edit details" panel: BUILT + PROVEN LIVE (2026-09-01)

Every fact the assistant can write, a person can write here: services (add/edit/remove — name,
price, description), phone/email/address, hours (7-row day grid + the free-text note). Lives in
**Website mode** as **✎ Edit details** in the canvas toolbar (address · Desktop/Mobile · Edit
details), claimed owners only. NOT in Settings (business facts stay out of Settings by decision).
- **Write path (as SHIPPED, superseding the earlier client-PostgREST plan):** the panel does NOT
  write PostgREST directly — that would update the record but not the PAGE and skip versioning.
  It POSTs `directRecordEdit` to `hubly-conversation` (owner-verified via `resolveOwnerUid`, NO
  model), which runs the SAME placement the chat runs (`applyOwnerRecordEdit` →
  `applyContactHoursToFreeform` / `applyServicesToFreeform` / guarded `removeServiceCard`) and
  `create_business_document`. So a save reaches the page AND is undoable. Services write PER-ROW
  (no replace-all → no photo orphaning). Reads use authenticated PostgREST (owner RLS) on open
  and re-read after any assistant action.
- **PROVEN as the owner on evergreen:** add a service → `200 {ok:true,"Added … on your page, in
  the services section."}`, DB row present; remove → `200`, page card gone (guard held), DB clean;
  other services untouched. Honest read-back throughout — a failed save says so, never a green tick.
- **Two upstream bugs fixed to get here** (see the pattern above): `messages_required` now exempts
  any direct edit; the write path uses `hcFreshToken()` (SDK refresh) instead of the raw token —
  applied at ALL authed write sends (typed send, post_build, click-to-edit, image/doc edits, the
  panel), so talking/editing no longer dies ~1h into an open tab. A stale token can NOT silently
  downgrade a claimed write to the draft path: the writer RPCs take the OWNER branch when
  `owner_id` is set (requires the verified uid) and the draft-token branch is only reachable for
  an unclaimed row — so it fails loudly (ok:false, reported), never falls through.
- **Fallback role:** the panel is the guaranteed way in and the only route for a page with no
  services/contact section to anchor to; in-place editing (Build B) is the primary route and runs
  through this same proven pipe.

**B. In-place editor — NEXT (runs through Build A's now-proven pipe).** First slice: double-click
the hours block → a day-grid + note overlay ON the block (type-aware, keyed off the anchors:
`data-hubly-hours` → grid, `data-hubly-hours-note` → text, `data-hubly-price` → number), saving via
`directRecordEdit` (the proven path). Then the **+ buttons** (add a service at the section end via
`data-hubly-service` anchors; add a missing phone/email on the contact block). Editor chrome carries
`data-hc-editor` and never reaches a saved page — structural (client-only, saves are server-side
transforms) plus the belt `stripEditorChrome` (already added). No-section pages fall back to the panel.
Then the fuller "elite editor": today click-to-edit changes TEXT only (`applyDirectFreeformEdit` via
`data-hc`) + color/font swatches (`hubly.html` COLOR_SWATCHES/FONT_OPTIONS ~53384); missing font SIZE
(constrain to the page's type scale, not a number box), image size/crop, formatting.
- **Same path?** A style change can ride the same seam as a text edit — an inline `style` on the
  labelled element, saved as a new document version, undoable — without breaking anchors
  (`data-hubly-*`/`data-hc` are separate attributes; adding `style` doesn't remove them). Worth a
  focused check that `applyFreeformEdit` can carry a style op.
- **Constraint (from the start):** the generator designs a per-page type scale. A free numeric
  font-size box lets an owner wreck the layout in one click. Constrain to a FEW STEPS inside the
  page's own scale, not a number. Same for image size.
- **Smallest real-editor set:** size (scale steps), image size/crop (steps), basic formatting, in
  the contextual inspector on the selected element.
- **Order:** A before B — facts not reaching the page was a correctness failure; editing controls
  are a capability gap.

## Still open (not forgotten)

- **`service_photos` orphaning:** `set_business_draft_services` is replace-all (delete + re-insert
  service rows); `service_photos.service_id` references `services.id`, so a legitimate service
  *add* may orphan photo links on the existing services. Pre-existing (not introduced by the
  reconcile work). Verify before leaning harder on services.
- **Google sign-in shows the raw Supabase domain** instead of Hubly on the consent screen.
- **The "hours already shown" consent offer** (designed-but-unbuilt; OPEN_FINDINGS #9): when a
  page already shows a schedule we can't anchor, we save + honestly decline, but the page then
  shows stale hours. Fix is a confirmed-target offer via the click-action primitive, not a rebuild.

## Design knobs — BUILT + VERIFIED AS THE OWNER (2026-09-02)

The anchor pattern applied to design instead of facts. A generated page carries its own
model-written CSS, so "make the header bigger" used to mean finding an unpredictable value
in an unpredictable stylesheet — layout re-recognition, the failure this codebase repeats.
Now the page's design is named CSS variables and a control sets one.

**The mechanism: MULTIPLY, DON'T REPLACE.** Twenty-four font-sizes are a designed scale;
each becomes `calc(<what the model wrote> * var(--knob, 1))`. The scale survives, one knob
moves all of it, and the `, 1` fallback means an unstamped page renders byte-identically —
**129 of 129 stored pages keep a fallback on every substitution**. Scoping is free, because
custom properties inherit: `[data-hc^="hero"]{--hubly-type-scale:var(--hubly-hero-scale,1)}`
makes "bigger header" resolve differently in the hero, against labels already stamped at
generation. The knob VALUE lives in the stored page's `:root`, so a change is a document
version and Undo reverses it with no new machinery; Reset deletes an override rather than
restoring a backup. Steps only, never a raw pixel field.

**Six knobs ship, offered only where they bind** (corpus of 129: test 123, market 5,
internal 1). A control appears only when its count is > 0 — a knob that binds nothing is a
checkmark we did not earn.

| knob | pages | avg declarations |
|---|---|---|
| text size | 128 (99%) | 33 |
| header size | 128 (99%) | 11 |
| spacing | 128 (99%) | 61 |
| content width | 128 (99%) | 7 |
| corner rounding | 127 (98%) | 12 |
| image shape | 82 (64%) | 2 |

Image shape is 64% because only 82 pages use `aspect-ratio` at all — the gate working.

**Verified as the owner on evergreen, every change at 1440 AND 390, each undone and reset:**
header 66→85px desktop / 43→56 phone; spacing 22→18 both; image ratio 1.60→1.00 desktop
and 1.78→1.00 phone. No horizontal overflow at either width. Undo and Reset each returned
every metric to the generator's original exactly (66/43, 22, 1.60/1.78, doc height
2744/4418), including on a page that stays stamped.

### BACKGROUND and INK are withheld — refused at the writer, not merely hidden

The binding works and the contrast maths is right. What is missing is knowing WHICH text
sits on the page background. A generated page paints text in many colours (**16 on
evergreen**), scoped to sections: dark copy on the light body, white copy inside a dark
band. Checking only the body's ink passed a dark background at a genuine, measured 5.1:1
**while the h1 rendered invisible at 390px**. Checking all sixteen is correct and
unsatisfiable — no single background clears both the dark copy and the white copy,
including the page's CURRENT background.

**Decision (Adrian, 2026-09-02): the LIGHTNESS BAND, not render-and-measure.** Rendering
answers the question for one instant — insert a card or move the type scale and the answer
changes, so it becomes a forever re-check in a runtime with no layout engine. The band
holds by construction: stay inside the page's own lightness family and every existing
text-on-background relationship survives untouched. Make the bad state impossible rather
than detect it afterwards. It also matches the real want — "a warmer cream", "a deeper
green" is nearly all of it. **"Turn my light page dark" is a redesign, and its honest home
is asking Hubly to rebuild it dark, which is the generator's job. A knob may not perform a
redesign.** Hidden-only was rejected: a hidden control is still reachable by anything that
calls the writer, so `setDesignKnob` refuses a withheld knob outright.

### The pattern the three defects share — all three passed the code and failed the page

1. **Bound is not moved.** `border-radius: var(--radius)` has no literal to multiply (the
   literal is in `:root`, where the pass must not go), so radius and width counted as BOUND
   and moved nothing. A control that reports itself working over a page that sits still is
   the unearned checkmark one level down.
2. **Desktop is not verified.** `@media` bodies were skipped wholesale by an at-rule guard,
   so the image knob worked on desktop and did nothing on a phone — the width their
   customers are on. Only the 390px measurement caught it.
3. **A passing measurement of the wrong thing is not a passing measurement.** The contrast
   check returned a true 5.1:1 for the body while the heading disappeared. The number was
   real; the thing it measured was not the thing that mattered.

### Open on knobs (designed, not built)

- **Re-stamp when the pass improves.** A page stamped by an older pass keeps the older
  binding; evergreen was stamped and its binding fixed twice in one day. UNWRAPPING is
  ruled out by measurement — a regex inverse round-tripped only 4 of 129 pages
  byte-identically, because nested `clamp(calc(...))` defeats it. The shape instead is
  **upgrade in place, never unwrap**: re-run the pass over the stamped page, relying on the
  idempotence guard already there (a value containing `--hubly-` is skipped), so previously
  wrapped declarations are untouched and previously MISSED ones get wrapped. Owner values
  live in `:root` and are not rewritten. Gate it on a version marker on the knob style block
  and run it lazily on the next knob read/write, never as a sweep, so each upgrade is one
  owner's page and one undoable version.
- **The image knob's mobile cost.** Measured at 390px on evergreen (7 cards, so it
  compounds): 16/9 = 4,418px, 16/10 = 4,574, 3/2 = 4,677, 4/3 = 4,885, **1/1 = 5,508 —
  6.5 phone screens, +1,090px**. Worse, the knob OVERRIDES the generator's per-breakpoint
  choice: evergreen deliberately uses 16/9 on phones and 16/10 on desktop, so even picking
  "16/10" costs +156px on a phone. Direction: drop the square step AND make the ratio
  per-breakpoint so the page keeps its own phone choice — constrain the step set rather
  than warn, since the owner choosing on desktop cannot see the phone consequence.

## MOBILE — a priority, not a polish pass (not being built now; binds everything new)

Two distinct pieces. Neither is scheduled yet; both are named here so neither gets filed
under "responsive tidy-up later", which is what they are not.

1. **The PUBLIC site at phone width — this is the one that decides whether anyone books.**
   ~5,000–5,400px at 390px, about six phone-screens, consistent across market AND test
   (OPEN_FINDINGS #10). Cause is generously-sized stacked sections plus a generation prompt
   that says nothing about phone-width length — not broken responsiveness. It outranks the
   shell's mobile problem because it is what a CUSTOMER sees the moment they tap the link;
   the shell is the owner's view, and an owner will find their way around a cramped screen
   in a way a stranger deciding whether to book never will.
2. **The Hubly SHELL at phone width.** The rail and the Home/Website mode switch are
   desktop-shaped; on a phone an owner cannot reach Home, Website or Settings. **Cannot be
   verified from here** — Claude Code has no true 390px viewport and no soft keyboard, so
   this one is Adrian's to check on a real phone (the standing rule in CLAUDE.md).

**What binds from here, whether or not either is scheduled:** anything NEW ships
phone-aware. Every design knob is verified at 390px as well as desktop before it ships — a
type scale that reads well wide can overflow on a phone, and the phone is where their
customers are. Every editor control is designed for TOUCH from the first line, not
mouse-and-hover with a mobile pass promised afterwards. Retrofitting an inspector built
around hover is a rebuild; building it touch-first costs nothing today. This is cheaper
than the two items above precisely because it is a constraint on new work rather than a
repair of old work.

## The anchor-pattern discipline (the through-line)

A freeform page has no async update path, so any fact a later change must touch is stamped with an
anchor at generation, placed by it afterward, inserted into the section when absent, with a
countable row and a read-back. Never re-recognize layout after the fact; never offer a suggestion
whose action can't reach the page; never write a fact not grounded in the current message.

## Needs Adrian's eyes on the DEPLOYED site (I can't hold a real session)

- Every claimed-owner write flow after a deploy (services/hours/phone landing; grounding asking).
- Home on a real return visit; the suggestion buttons; the optimistic edit + Undo toast.
- Stripe test-mode cycle (I must not enter cards).

## Still owed — the survey, which has not moved

Named in full so it does not quietly shrink. None of this is started:

- **Editor wiring** — what colour, font, size, images and add-service actually do today
  versus what they appear to do, and where **memberships and events** belong.
- **The Home redesign** — logo pinned top, Chats removed, no search bar, light and dark,
  and whether the four action cards have real destinations (a card that goes nowhere is
  the same unearned promise as a control that binds nothing).
- **Storefront** — verify what exists rather than assuming; `PRODUCT_SHAPE.md` §3–4 is
  direction, not an inventory.
- **The URL scheme** and **the wordmark placement**.
- **Retiring the Edit-details button** once in-place editing covers it.
- **Touch-first control design for the knobs** — the six that ship have no owner-facing
  control yet; only the endpoint. Per the mobile rule above, those controls are designed
  for touch from the first line, not retrofitted.
