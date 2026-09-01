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

## First, once oriented — amend CLAUDE.md (Adrian, 2026-09-01)

Before Build A, add the actual lesson of the claimed-owner run as a rule: **verify by using
it, AS THE OWNER, ON THE REAL THING.** Every test that night was green on a *draft*; the bugs
(a week of claimed owners unable to edit by talking; a value the system filled in that nobody
gave it; a filter that would have deleted five live services) all lived on the other side of a
door nobody had walked through. This sharpens the existing "verify by using it" agreement with
the draft-vs-claimed blind spot that hid them. Build A (the manual form) is the same principle
in another form: if the AI route fails, a person needs a way in.

## The two builds, in order (report done; Build A first)

**A. Manual form — make the AI optional.** The rule: every fact the assistant can write, a
person must be able to write themselves. Covers: services (add/edit/remove — name, price,
description); phone/email/address; hours (day grid + the free-text note).
- **Reusable / already built:** the owner-authorised writers (proven tonight); `authGetClient`/
  `hcAccessToken`; the Settings popout (`hcOpenSettings`); `get_my_site_gaps`/`get_my_businesses`.
- **Key decision — the write path (CONFIRMED on the live DB 2026-09-01).** The RPCs are
  `service_role`-only (browser can't call them). The form writes via **direct authenticated
  PostgREST under owner RLS** — and ALL THREE tables already have the policies (earlier
  "services needs a policy" was WRONG): `businesses` "Owners can update their own business"
  (`owner_id=auth.uid()`); `settings_business_hours` `settings_business_hours_owner_all`;
  `services` "owner can manage services" (`owns_business(business_id)` = `exists(… owner_id=
  auth.uid())`). RLS enabled on all three. **No migration needed.** A form field IS the current
  input, so grounding does not apply. Because services has PER-ROW owner RLS, the form writes a
  SINGLE service row (insert/update/delete) directly — never the replace-all RPC — so it can't
  orphan other services' photos.
- **Where it lives:** a panel in **Website mode** (the site-canvas context), NOT Settings — an
  existing deliberate decision keeps business facts out of Settings (`platform-home.html:3683`),
  it sits where you notice the problem, and it writes the same canonical record the chat does
  (no "second source").
- **Genuinely new:** the panel UI (inputs + a 7-row hours grid) and the per-row authenticated
  writes. Nothing at the DB layer.

**B. Real editing controls** ("elite, like the best website editors"). Today click-to-edit changes
TEXT only (`applyDirectFreeformEdit` via `data-hc`), plus color/font swatches already in the editor
overlay (`hubly.html` COLOR_SWATCHES/FONT_OPTIONS ~53384). Missing: font SIZE, image size/crop,
formatting.
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
- **~6 phone-screens per generated page** (public site): ~5,000–5,400px at 390px across market +
  test; cause = generously-sized stacked sections + a prompt silent on phone-width length, not
  broken responsiveness (OPEN_FINDINGS #10).
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
