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
- **The "hours already shown" consent offer** (designed-but-unbuilt; OPEN_FINDINGS #9): when a
  page already shows a schedule we can't anchor, we save + honestly decline, but the page then
  shows stale hours. Fix is a confirmed-target offer via the click-action primitive, not a rebuild.

## The anchor-pattern discipline (the through-line)

A freeform page has no async update path, so any fact a later change must touch is stamped with an
anchor at generation, placed by it afterward, inserted into the section when absent, with a
countable row and a read-back. Never re-recognize layout after the fact; never offer a suggestion
whose action can't reach the page; never write a fact not grounded in the current message.

## Needs Adrian's eyes on the DEPLOYED site (I can't hold a real session)

- Every claimed-owner write flow after a deploy (services/hours/phone landing; grounding asking).
- Home on a real return visit; the suggestion buttons; the optimistic edit + Undo toast.
- Stripe test-mode cycle (I must not enter cards).
