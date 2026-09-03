# STATE — where the build is (2026-09-01)

The current picture, no history. Pairs with `CLAUDE.md` (the rules), `PRODUCT_SHAPE.md`
(decisions), `OPEN_FINDINGS.md` and `SHELL_TERRAIN.md`. This file is the durable record;
if it disagrees with memory, this wins. Evergreen-yard-care (`c969eb51-…`, account_kind=test,
claimed, owner `adriansmithee+evergreen@gmail.com`) is the claimed-owner test business.

## Numbers in this file are DATED — check the date before acting on one

A count here was true when it was written and is not re-checked on read. Two specific ones,
because they are the ones most likely to be quoted as current:

- **`docs/SHELL_TERRAIN.md` §0 and §4 counts are 2026-08-29** (market N=7; services 9,
  booking_requests 9, customers 4, jobs 2, `commerce_products` 0, `commerce_orders` 0,
  `settings_business_hours` 0, `stripe_connect_accounts` 0). They were **not** re-verified on
  2026-09-02 — that session had no database credentials (`.env.local` carries only a Vercel
  OIDC token; the linked CLI's pooler URL has no password). Re-pull before quoting.
- **`scripts/hero-fold-audit/corpus.json` on disk is a STALE export: 114 rows**, where the
  design-knob sweep the same week used **129**. It is untracked scratch from the squeeze audit,
  not a current corpus. The standing rule (that folder's README, and memory) is to re-export
  before every sweep; the file being present is not evidence it is fresh.

## Built — do not rebuild (verify by using, don't re-implement)

- **Claim → claimed shell.** Two modes on one switch (`hc.mode`→`data-mode`, `hcOpenWorkspace`):
  **Home** (chat is the screen) and **Website** (site = canvas, chat = assistant panel). Rail
  beneath a slim solid header. Settings is a popout (Account/Notifications/Website/Integrations).
- **Click-to-edit** on a claimed page (the iframe runs the auth handshake itself). Direct edits
  are optimistic; **Undo** = `restore_prev_business_document`. What it actually changes on a
  claimed FREEFORM page — **text and the image `src`, and nothing else**:
  - **Text** — real. Leaf-only (`hubly.html:53537` returns when `children.length > 0`), keyed on
    `[data-hc]`, optimistic paint, `hcFreeformInlineEdit` → `applyDirectFreeformEdit`.
  - **Image replace** — real. Click an `<img>` → file picker → optimistic blob paint →
    `hcFreeformInlineImageEdit` → `uploadAndPatchFreeformImage`.
  - **CORRECTION (surveyed 2026-09-02): colour and font are DEAD on a freeform page, and the
    earlier note here — "changes TEXT only, plus color/font swatches" — read like a working
    capability.** They are dead two ways, not one: the swatch row is hidden by CSS
    (`hubly.html:53428`, `if(hc) styleRow.style.display='none'`) AND `applyDirectFreeformEdit`
    accepts only `{label, text, src, prevText}` — there is no attribute/class/style op on the
    freeform path at all, so the control is *structurally impossible*, not merely unwired. It
    works on AST pages only. **Every market page is freeform**, so colour/font reach no real
    business: in `scripts/hero-fold-audit/corpus.json` (114 pages) the split is market 3 html,
    internal 1 html, test 103 html + **7 ast — all seven AST pages are `test`.** (That export is
    stale — see the dating note under "Numbers in this file"; treat the ratio as directional and
    "all AST are test" as true of that export only.)
  - **Size / crop / formatting** — do not exist anywhere: no control, no client op, no server
    support (Build B below).
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
Then the fuller "elite editor": today click-to-edit changes TEXT and the image `src` only
(`applyDirectFreeformEdit` via `data-hc`) — the COLOR_SWATCHES/FONT_OPTIONS row (`hubly.html`
~53333) is AST-only and never renders on a freeform page (see the correction above); missing font SIZE
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

## Design knobs — DEPLOYED 2026-09-02, NOT YET PROVEN BY AN OWNER

**READ THIS BEFORE TOUCHING THE KNOBS.** Status, precisely, because two different things
here have two different levels of proof and conflating them is how a green checkmark gets
earned by the wrong step:

- **The MECHANISM** (stamping, multiply-don't-replace, the writer, Undo/Reset) was verified
  as the owner on evergreen on 2026-09-02 — header 66→85px desktop / 43→56 phone, spacing
  22→18, each change undone and reset to the generator's exact original. That happened.
- **The CONTROLS** (the `Design` panel and the `website.setDesignKnob` chat action) were
  built and deployed later the same day and **have never been touched by a signed-in
  owner.** Built and deployed is not proven. Until someone opens the panel on a claimed
  site and watches the page move, the correct description is "deployed, unproven".

**FIVE knobs are offered:** `typeScale`, `heroScale`, `spaceScale`, `measureScale`,
`radiusScale`. **Three are withheld, each with a stated reason** (`offered:false` +
a `withheld` sentence the refusal speaks aloud): `mediaRatio` — it overrides the
generator's per-breakpoint choice, so even "16/10" costs +156px on a phone and 1/1 costs
+1,090px, invisible from the desktop where the owner chooses; `background` and `ink` —
no way to know WHICH text would land on a new background. **`mediaRatio` binds nothing on
43 of 106 stored pages**, which is why the gate below matters.

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

**CORRECTION (surveyed 2026-09-02): the knobs have NO DOOR OF ANY KIND — not "no owner-facing
control".** Two facts, both checked: (1) zero client callers — `designKnobs|designEdit|designKnob`
across `public/` and `scripts/` returns nothing; (2) **the model cannot reach them either** —
`designKnob` is not registered in `HUBLY_CAPABILITY_REGISTRY` (the only occurrences in that file
are the import and the action-log label), so "make my headings bigger" in chat does nothing at
all. The only way in was a hand-built POST. Saying "only the endpoint" implied talking still
worked; it did not. (Both closed by the control build below.)

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

### The CONTROLS — DEPLOYED 2026-09-02, UNPROVEN BY AN OWNER. Five knobs, and a chat door

**Two doors where there were none.** Both reach the same owner-verified, versioned,
undoable writer.

1. **`Design` in the canvas toolbar** (`platform-home.html`, `#hcDesignBtn` beside
   `Edit details`). That position is deliberate: the canvas bar is the one claimed-owner
   surface that survives phone width — the rail is `display:none` at ≤760px
   (OPEN_FINDINGS #13), so a control living there would vanish on a phone.
2. **`website.setDesignKnob` in the capability registry** — so "make my headings bigger"
   now works in chat. It takes a **`direction` (up/down), not a value**, and the server
   steps from the page's CURRENT setting (`stepKnob`): a model cannot see the stored value,
   so a guessed value is often a change that does nothing and still reports success. At the
   end of the steps it says so ("already as large as I can set it") rather than clamping
   silently. Registered in `DRAFT_INJECTED_ACTIONS` (needs draftId+draftToken+ownerUid) and
   `GATED_WEBSITE_ACTIONS`; the boot audit reports no action missing from either.

**FIVE, not six — image shape is withheld,** at the writer (`offered:false` + a `withheld`
sentence), not merely left out of the UI. Its cost is invisible from where the owner
chooses: it overrides the generator's per-breakpoint choice, so even "16/10" costs +156px
on a phone and 1/1 costs +1,090px. It returns when the ratio is per-breakpoint. The
refusal now explains itself — `background` and `ink` carry the same treatment, so a
withheld knob says why instead of "I can't change that one yet."

### THE BINDING GATE — why it exists, and do not remove it

`setDesignKnob` stamps the page and then writes the knob's value into `:root`. **It does
not check that anything on the page actually reads that variable**, and writing `:root`
changes the HTML either way — so the "did the HTML change?" no-change guard cannot catch
it. On a page where a knob bound zero declarations, the writer returned:

> `ok: true, real: true, "Changed the corner rounding."`

**over a page that sat perfectly still.** That is the unearned checkmark, one level down
from the UI — the same defect as "bound is not moved" below, wearing the writer's clothes.

It was survivable only while the single caller was `readOwnerDesignKnobs`, which filters to
knobs with `bound > 0`. **The model changed that**: it picks the knob from the owner's
words, not from a filtered list, so the gate had to live at the WRITER, exactly as the
withheld-knob refusal already does. `applyOwnerDesignEdit` now refuses `not_bound` before
writing anything.

**One shared source — and be precise about what that buys.** The read and the write both go
through `knobBinding()` (was `boundKnobsFor()`). That guarantees they cannot **disagree**. It
guarantees **nothing** about whether they are **right** — and on 2026-09-02 they agreed
perfectly on a wrong answer for `heroScale` for as long as the predicate was wrong. Sharing
a mistake is still better than keeping two copies of it, but a shared source is not a
correctness argument and must never be read as one.

Measured: `mediaRatio` binds nothing on **43 of 106** stored freeform pages — a real
population, not a theoretical one.

### THE GATE ITSELF WAS CAUGHT LYING — 2026-09-02, on a real owner's page

**Symptom:** `heroScale` on evergreen returned `ok:true, real:true, "Changed the header
size."` The preview reloaded. The page was identical. **The check built to enforce "bound is
not moved" was itself measuring the wrong thing.**

**Cause.** `heroScale` is the only knob that binds through a *scope rule* rather than
declarations of its own — and that rule, `[data-hc^="hero"]{--hubly-type-scale:var(--hubly-hero-scale,1)}`,
**is one WE inject at stamp time.** The read-time predicate matched our own footprint, so it
reported "bound" on every page we had ever stamped, whether or not one hero-scoped
`font-size` existed. Attribution, measured: strip our injected block and heroScale's count
goes **106 → 0** across the corpus, while the other four hold at **106 → 106** because they
are anchored to declarations **the generator wrote**.

**Four predicates were tried. Three were wrong.** Recording them because the pattern is the
lesson, not the bug:

| | predicate | said | why it was wrong |
|---|---|---|---|
| P1 | does `var(--hubly-hero-scale)` appear? | 106/106 bound | matched our own injected rule |
| P2 | does an element match `[data-hc^="hero"]`? | 106/106 | matching the scope ≠ anything inside it carries a wrapped font-size |
| P4 | P3, but under jsdom | "nothing moves", every knob | jsdom returns `calc(16px * var(--s,1))` verbatim and never resolves it — it cannot tell a working knob from a dead one |
| **P3** | **flip the variable, diff COMPUTED styles** | **the truth** | it asks what the owner asks |

**And a fourth trap that nearly hid it:** the first P3 run over the corpus said all five
knobs move on 106/106 — because it **stamped every page in memory with the current code**.
Evergreen is stamped **on disk by an older pass**, and `hasDesignKnobs()` short-circuits so
it is never re-stamped. A run over freshly-stamped pages **structurally cannot** see a
stale-stamp bug. Always measure both populations.

**THE FIX — the anchor pattern applied to the gate itself.** Everything needed to answer
"does this bind" is in hand at stamp time, while the stylesheet is being rewritten and the
hero labels counted. It was being thrown away and re-derived later by regex — re-recognition
after the fact, the thing this codebase forbids everywhere else. Now `stampDesignKnobs`
**records the counts** onto the block (`data-hubly-bound="typeScale:33;heroScale:11;…"`,
zeros included so "missing" unambiguously means "older pass") and `knobBinding()` reads them.

**THE FALLBACK RULE — decide this before changing the gate, it is where the value is.**
A page with **no recorded counts** (evergreen; every page stamped before this change) must
**never silently fall back to the old predicate** — that would change nothing for exactly the
pages that have the bug. What it does instead differs **per knob**, and the difference was
measured, not assumed:

- **The four declaration-anchored knobs keep their count.** Their predicate counts
  `var(--hubly-x-scale)` in declarations the *generator* wrote, and on the stale repro they
  were truthful: type 0/moved 0, space 0/moved 0, measure 5/moved 8, radius 4/moved 8.
  Blanket-refusing all five would have broken four working controls for every existing owner.
- **`heroScale` becomes UNKNOWN — never bound, and never a confident zero.** Reporting 0
  would let the writer say "there's nothing on your page that header size would change",
  which is *also* a claim we cannot support. The owner is told **"I can't tell what header
  size would change on your page — it was built before I could check that properly, so I've
  left it alone rather than move something and hope."** An unknown knob is not offered in the
  panel either.

Verifying it properly needs a layout engine; the edge runtime has no DOM. That is exactly
why the count is recorded at stamp time now.

**Re-stamping an old page is the real repair** ("upgrade in place, never unwrap", below) and
is deliberately NOT built yet.

**P3 IS NOW PERMANENT: `scripts/knob-bind-audit/`.** A browser harness, for the same reason
`hero-fold-audit` is one. **If you change the gate, you have to beat it.**
`tests/design-knobs-bound-means-moved.test.mjs` covers the *contract* in `npm test` and
deliberately does **not** attempt the movement check, because jsdom cannot do it (P4).

**Re-verified against the fix, both populations, both widths — 0 violations at 1440:**

| | fresh-stamped (claimed → moved) | stale-stamped (claimed → moved) |
|---|---|---|
| typeScale | 106 → 106 | 0 → 0 |
| heroScale | 106 → 106 | **106 UNKNOWN, refuses** |
| spaceScale | 106 → 106 | 2 → 2 |
| measureScale | 106 → 106 | 43 → 43 |
| radiusScale | 105 → 105 | 75 → 75 |

Nothing moved that was reported unbound, at either width — so no hidden controls either.

### A LIMIT OF ANY STATIC GATE — found by the 390 run, recorded not fixed

At **390** the same audit found **2 stale-stamped pages** (`redhill-roofing`,
`pike-sons-tree-service`) where `spaceScale` was correctly *bound* and still moved nothing.
Not the heroScale class — the declaration is real. It is
`padding: … max(20px, calc((100vw - calc(var(--max) * var(--hubly-space-scale,1))) / 2))`,
which **saturates against the 20px floor at phone width**, so the scale cannot move it there
though it moves it at 1440.

**The general shape: a knob can bind a real declaration and still be inert at a given width**
— via `max()`/`min()`/`clamp()` saturation, or a rule that only applies inside a media query.
The gate answers "does this bind *anywhere*", which is not "does this move at the width
you're looking at", and no server-side check can close that gap without a layout engine. Not
observed on any freshly-stamped page (all five move at 390 on 106/106), so it is a limit to
know about rather than a live defect — it would bite only if a page's *sole* binding for a
knob were clamp-saturated at the owner's width. **This is also the argument for the harness
being permanent: 1440 alone reported zero violations.**

### THE STALE-STAMP POPULATION IS UNMEASURED — Adrian's to run

How many stored pages carry an old stamp is **not known**, and it decides whether the
re-stamp path stays deferred. It could not be measured here (no database credentials). It is
one query — a stale-stamped page is one with `data-hubly-knobs` but **no** `data-hubly-bound`:

```sql
select
  count(*) filter (where rendered_html like '%data-hubly-knobs%'
                     and rendered_html not like '%data-hubly-bound%') as stale_stamped,
  count(*) filter (where rendered_html like '%data-hubly-bound%')     as recorded,
  count(*) filter (where rendered_html not like '%data-hubly-knobs%') as never_stamped,
  count(*) as total
from (select distinct on (business_id) business_id, rendered_html
      from business_documents
      where rendered_html is not null and length(rendered_html) > 0
      order by business_id, version desc) t;
```

Reasoning that narrows it without the count: `stampDesignKnobs` runs at generation, so every
page generated **since** this fix records counts, and every **never-stamped** page gets a
fresh, correct stamp on first knob use. The exposed population is therefore only pages
stamped in the window between the knob pass going live and this fix — plus evergreen. Likely
small, **but that is an argument, not a measurement.** If it turns out to be most of them,
the re-stamp path stops being deferred work.

### WHAT HAS AND HAS NOT BEEN VERIFIED — do not blur these

**Verified (offline, 2026-09-02), over 106 real stored freeform pages from the corpus:**
- all five offered knobs bind on **99–100%** of pages;
- the three withheld knobs are refused **at the writer**, each with its own reason;
- `stepKnob` walks the steps from the page's real current value and reports the end of the
  range honestly instead of clamping;
- **Reset is byte-identical** to the pre-change HTML;
- the `, 1` fallback survives on **106/106** pages;
- the capability is registered, present in `DRAFT_INJECTED_ACTIONS` and
  `GATED_WEBSITE_ACTIONS`, and its three refusals (`not_signed_in`, `unknown_knob`,
  `missing_direction`) fire with no database;
- panel geometry at 1440 **and** 390: every touch target ≥44px, no clipped labels, no row
  or page overflow.

**NOT verified — nothing has been tested as a signed-in owner.** That session had **no
database credentials** (`.env.local` carries only a Vercel OIDC token; the linked CLI's
pooler URL has no password) and no way to hold a real session. So none of this is proven:
opening the panel on a claimed site; a knob actually moving the live page; Undo; Reset;
the same at 390px on a real phone; and the chat sentence "make my headings bigger" reaching
`website.setDesignKnob`. **Deployed is not proven. This is the open item.**

Also note what the panel screenshots from that session are and are not: an **isolated
component render with a stubbed payload**, labelled as such in-frame. They prove geometry
and nothing about a session, the writer, or the live page.

**Touch-first, and measured rather than asserted.** The page's own edit affordance is a
`:hover` outline, which does not exist on touch — so the invitation here never depends on
hover: every control is a permanently visible button, steps are a segmented row (never a
slider — wrong for a thumb, and it implies a continuum the mechanism does not have), the
current value is a marked chip plus `aria-pressed`, and the panel becomes a full-width
bottom sheet under 560px. Measuring caught two targets under 44px that assertion would
have missed: `.hc-set-x` at **25×26** (shared chrome — so Settings and Edit details were
affected too, now fixed for all three) and `.hc-dsg-reset` at **42×32**. After the fix, at
both 1440 and 390: **every target ≥44px, no clipped labels, no row overflow, no horizontal
page overflow**, panel 520px wide on desktop and full-width 390 on the phone.

**Deployed 2026-09-02** — edge function via `supabase functions deploy hubly-conversation`,
client via a git push to Vercel (the two-path rule: they are different deploys). Verified
live after the push: the apex serves `hcDesignBtn`, and the knob read endpoint answers
`401 not_signed_in` to an unauthenticated caller rather than 404/500. See the verification
split below for what that does and does not prove.

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

## STOREFRONT — the decision, sized (surveyed 2026-09-02; NOTHING started)

Do not treat this as greenfield and do not start building. `PRODUCT_SHAPE.md` §3 reads as
direction; the storefront is **largely built, in the legacy stack, and unreachable from the
claimed shell**. What the survey established:

- **The SERVER is common to both paths.** `commerce-api` (739 lines), `create-store-checkout`,
  `commerce_checkout.ts`, `hubly_commerce_inventory.ts`, `storefront_ast.ts` — ~1,607 lines
  of edge functions over HTTP. They do not know which client calls them. **Neither option
  rebuilds them.**
- **The customer-facing half already works** and is unaffected by the choice.
  `{slug}.myhubly.app/store` renders from `businesses.meta.storefront` + the public
  `commerce-api` endpoint, and a storefront-only business (`capabilities.storefront &&
  !capabilities.website`) already serves the store at `/`.
- **So the decision is only ~2,810 lines of OWNER-SIDE CLIENT** — `store-commerce.js`
  (1,027, the ten-tab admin) plus `journey-os/commerce/*.js` (1,783) — plus 300 lines of
  namespaced CSS (`jos-store-*`, `hub-commerce-*`, 147 selectors, no collision risk).
- **Four globals to shim** — the whole coupling to the legacy app:
  `window.HublySupabase` (`{url, session, anonKey}`), `window.S` (only `.businessId` and a
  role that defaults to `'owner'`), `window.toast` (41 calls), and — both already optional
  and guarded — `window.HublyEvents.publish` and `window.HublyJourneyOS`.
  `store-commerce.js` reads the global through **one accessor** (`function S(){ return
  global.S || {} }`, line 30) and its header states it no longer reads or writes the legacy
  `S.storeOs` blob; `store-page.js` says "no `S.storeOs`. `commerce_products` is the SSOT."
- **THE NAMING TRAP — read this before opening either file.** In `hubly.html`,
  **`#p-storefront` is the CLASSIC WEBSITE page** (`showP('p-storefront')` →
  `renderWebsite()`). **The actual store is `#p-store` / `HublyStorePage`.** Two meanings of
  "storefront" in one file.
- **The door has an open decision attached — `OPEN_FINDINGS.md` #14.** Making the store
  reachable is ~10–25 lines across two files *plus* an unmade security decision: whether the
  `dashboard` context carries a raw owner write credential, which it never has. **It may not
  need making at all**, depending on what the storefront hour finds.

**Everything above is code-reading, not exercising.** The legacy store has NOT been run as an
owner. The cheapest next step by a wide margin is one hour: sign in, reach the Store tab,
create a product, see it on `/store`. Both cost estimates hinge on that answer. Usage numbers
(`commerce_products` 0 / `commerce_orders` 0) are dated 2026-08-29 — see "Numbers in this
file are DATED".

## The standing rules these builds keep paying for — verbatim, do not soften

- **Bound is not moved.** A control that reports itself working over a page that sits still
  is the unearned checkmark one level down.
- **Desktop is not verified.** A change confirmed at 1440 is not confirmed; the width their
  customers are on is the one that decides.
- **A passing measurement of the wrong thing is not a passing measurement.** The contrast
  check returned a true 5.1:1 for the body while the heading disappeared. The number was
  real; the thing it measured was not the thing that mattered.

## The anchor-pattern discipline (the through-line)

A freeform page has no async update path, so any fact a later change must touch is stamped with an
anchor at generation, placed by it afterward, inserted into the section when absent, with a
countable row and a read-back. Never re-recognize layout after the fact; never offer a suggestion
whose action can't reach the page; never write a fact not grounded in the current message.

## Needs Adrian's eyes on the DEPLOYED site (I can't hold a real session)

- **THE DESIGN KNOB CONTROLS — deployed, and the gate FIXED after failing this exact test
  once (2026-09-02).** First attempt: `heroScale` said "Changed the header size." over a
  still page. Diagnosed, fixed, re-verified offline. **Re-test on evergreen — same knob,
  same page:** sign in, open `Design`, set each offered knob, watch the page actually move,
  then Undo and Reset — at 1440 **and** on a real phone. Then type "make my headings bigger"
  in the chat.
  - **Expect `heroScale` to be MISSING from the panel on evergreen**, because evergreen
    carries an old stamp with no recorded counts, so the gate now honestly says it cannot
    tell. That absence is the fix working, not a regression. If you reach it another way it
    must say *"I can't tell what header size would change on your page…"* — never "Changed
    the header size."
  - If any knob reports success and the page sits still, that is the gate failing again and
    it is the highest-severity thing here.

- Every claimed-owner write flow after a deploy (services/hours/phone landing; grounding asking).
- Home on a real return visit; the suggestion buttons; the optimistic edit + Undo toast.
- Stripe test-mode cycle (I must not enter cards).

## The survey — DONE 2026-09-02 (read-only). What it found

Findings are folded into the sections above and into `OPEN_FINDINGS.md`; this is the index.

- **Editor wiring — answered.** See "Click-to-edit" above: text and image `src` are real;
  colour and font are structurally impossible on freeform and reach no market business;
  size/crop/formatting do not exist; add-service is panel-or-chat only, no `+` on the page.
- **Memberships and events — answered, and the code agrees they are NOT editor work.**
  `memberships` (`schema.sql:3997`) is keyed `customer_id NOT NULL` with a UNIQUE constraint
  on it, so a row is one CUSTOMER'S ENROLMENT, not a plan the business offers — there is no
  plan-catalogue table, and `customer_membership.ts` names the real source of truth: "a read
  projection of the browser's `[RP]` notes-tag maintained by `upsertCustomer()`". No Stripe,
  no charge scheduling (`recurring_schedules`' migration is emphatic that scheduling and
  billing are "deliberately not connected"). **Events do not exist at all** — of 119 tables
  none is a class, session, ticket or dated offering (`business_timeline_events` is an audit
  log, `google_calendar_events` is calendar sync, `hubly_reasoning_events` is AI telemetry).
  So memberships are billing objects hanging off a customer, and events are greenfield with a
  date dimension AND inventory (seats). Both are transaction-layer work, not editor work.
- **Home redesign — answered.** There is **no Chats tab to remove** (`hcWorkspaces()` returns
  Website only) and **no search bar** (zero matches); both asks are no-ops. **Logo pinned top
  is not built** and the comment that claimed it was has been corrected (`hcRenderRail`).
  **Dark is new for this surface but the pattern is in the repo**: `platform-home.html` has one
  `:root` (warm cream, no `prefers-color-scheme`, no `data-theme`, nothing switches), while
  `hubly.html` has a complete working token-based night theme (`html[data-theme="night"]`, boot
  script honouring `localStorage.hubly_theme` then `prefers-color-scheme`) — though its toggle
  is force-hidden on the app/landing/storefront pages, and the `-on-dark` wordmark asset is
  hardcoded per dark SECTION, never theme-switched. **The four action cards: no cards exist**;
  what exists is the 3-button arrival row (`:3977`) and up to 4 gap suggestions in `hcRenderHome`
  (photos / hours / phone / service descriptions). The four suggestions DO have real
  destinations — each fills `#hcInput` and calls `hcSend`, and each is gated on
  `get_my_site_gaps`, so the earned-only rule is already correct. The arrival row's "See what a
  customer sees" is still the BROKEN #4 above (it opens `/?book=1`, the booking form).
- **Storefront — answered, and it reframes the work.** It is not direction and not greenfield:
  18 `commerce_*` tables, `commerce-api` (739 lines), a public store route already live, and a
  1,027-line owner UI — all in the LEGACY stack, all unreachable from the claimed shell. Full
  inventory and the naming trap (`#p-storefront` is the classic WEBSITE page) are in
  `PRODUCT_SHAPE.md` §3. **The open question is door-vs-re-implement, not build-vs-not.**
  Not started; Adrian's call.
- **URL scheme — surveyed; NOT specified anywhere in the record.** What exists: apex
  `myhubly.app/` serves `platform-home.html` and is BOTH the marketing landing and the entire
  claimed owner shell; `{slug}.myhubly.app/` → `hubly.html`; `/?book=1` → booking;
  `/store` → store (or `/` if storefront-only). **The gap: the owner's workspace has no URL** —
  `hc.mode` is memory only (`:3547/:3598/:3618/:4707`), never written to URL, hash or storage,
  so there is no deep link to Website mode, a refresh always lands on Home, and Back does not
  move between modes. Sharper on a phone, where Back is the system gesture.
- **Wordmark — surveyed; NOT specified anywhere in the record.** Two implementations exist and
  the claimed shell uses the one that is not the asset: `platform-home.html` renders a CSS text
  lockup (`:907` header, `:1059` footer), while `hubly.html` uses the real
  `assets/hubly-wordmark*.{svg,png}` via `.hubly-mark` in 18 places.

## Still owed

- **Adrian: prove the knob controls as the owner** — the one thing above that is built and
  unproven. Sign in on evergreen, open `Design`, set each of the five, watch the page move,
  Undo, Reset; at 1440 and on a real phone. And type "make my headings bigger" in the chat.
- **Retiring the Edit-details button** once in-place editing covers it.
- **A decision on storefront** — door on the legacy store, or re-implement on the new spine.
  **Buy the information before deciding**: one hour signing in and exercising the legacy
  Store settles it, and both estimates hinge on the answer. See the STOREFRONT section
  above and `OPEN_FINDINGS.md` #14. Do not start building either path.
- **A URL scheme and a wordmark placement** — both need SPECIFYING, not just surveying.
