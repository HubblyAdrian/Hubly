# Hubly — advisory handoff

Written 2026-09-09, end of a ~14-hour session. Paste this into a fresh chat to
restore context cheaply. Everything below is fact as of writing; nothing is a plan.

---

## 1. The role, and the instructions that govern it

Adrian is the solo founder of **Hubly** (myhubly.app) — a platform for home-service
businesses that builds a website from a conversation. **You are the advisory layer.**
Claude Code runs locally on his Mac and does all the work. Your output is analysis
plus copy-pasteable prompts for Claude Code.

**Standing instructions, verbatim:**

> "tell me what to tell claude code I never give it what you said till i say. so dont
> write a summary of what to tell it until i say so."

> "after i give you claude codes respone give me a copy paste detailed what to say abck"

So: no prompt until he asks, **except** after he pastes Claude Code output — then he
is owed a detailed copy-paste reply.

**He corrected this on 2026-09-09:** what he pastes is *Claude Code's* words, not his.
When talking to him, say "it" or "Claude Code" in the third person. Save the second
person for inside the copy-paste block, where it belongs.

**Security rule, verbatim and non-negotiable:**

> "Never reveal a live secret to the terminal."

Keys are named by name and prefix only, never value. `supabase secrets set` is
**banned** — the value lands in shell history (the August 2026 leak). Supabase secrets
are set via the web dashboard. Never put a key on a command line. The approved pattern
is `printf 'secret key: '; read -rs VAR; echo; export VAR`. Never paste a key into
Claude Code. For a one-off script, create a new Supabase secret key, use it, delete it.

---

## 2. How the project is built — the facts that keep mattering

- **Two deploy paths, never mixed.** Edge functions: `supabase functions deploy <name>`.
  Anything in `public/`: **only** via git push to Vercel.
- **`supabase db push` is UNSAFE on this project.** 28–30 migrations have been applied
  and never recorded since 2026-08-23; a re-run would include one setting
  `account_kind = 'real'`, now rejected by constraint. Use `supabase db query --linked -f`
  and sync the migration file **by hand**.
- **Two owner shells.** `public/platform-home.html` serves `/`, `/home`, `/platform`.
  `public/hubly.html` serves `/app`, `/editor`, `/site`, and business subdomains.
- **Routing.** One Vercel catch-all → `api/router.js`, which always serves `hubly.html`.
  Resolution is client-side: `location.hostname`, first label, `get_public_business(p_slug)`.
  No DNS record per business, no lookup table. `businesses.slug` is UNIQUE. **No alias
  or redirect table exists.** An unknown slug falls to `#p-public-unavailable`.
- **Corpus** is ~182 businesses; ~159 have a generated page. Only a handful are `market`.
  Graef (`graefs-autocare`) is the one live business whose site must not be broken.

---

## 3. Where things stand

### Shipped, deployed, and proved on 2026-09-09

- **Services inserter recognises placeholder rows.** `data-hubly-guess` rows are now
  valid targets; the first real service *replaces* the first placeholder rather than
  appending. Working owners went 67 → 77 of 120. The 10 pages with real anchors were
  unchanged.
- **24 pages stamped** `data-hubly-section="services"` — attribute-only, byte-identical
  visible text. **Bucket (b) only**, matched against services on record. The 52 pages
  identifiable only by heuristic were deliberately *not* stamped: a stamp is a fact, and
  a fact may only be written from evidence or from the owner's own answer, never a guess.
- **Truth strings stopped lying.** The rule: a reply may claim *"saved to your record"*
  (justified by a write returning ok) or *"on your page now"* (justified **only** by the
  value being present in the rendered bytes). Never the second on evidence for the first.
  Hero image downgraded (it genuinely never touches the page). `setServices` split into
  record-write and page-placement outcomes. `composeServicesTruth` verifies the bytes.
  Storefront trimmed.
- **Directive leak closed.** `hubly_owner_replies.ts` now owns every string an owner
  reads verbatim, with a *structural* check asserting nothing outside it feeds
  `primaryReply` (a phrase blocklist is kept as a second net). The photo path had been
  shipping its own stage directions to owners — *"do NOT claim it is showing; offer to
  rebuild…"* — live. Only test businesses ever saw it.
- **`business.addServicesSection`** — builds a services area on a page that has none,
  on the `hubly_contact.ts` pattern: server-side, inserted before the last `<footer>`,
  never restructures the model's content, three honest states. It **clones an existing
  content section** rather than inventing styling, which is what makes it readable.
  93 of 96 pages render it correctly; 3 are recorded in KNOWN_UNREADABLE and cannot be
  predicted from the HTML (two hypotheses tested, both failed).
- **The splice at index.ts:634 is fixed** and `rebuildLastResort()` no longer speaks
  anywhere. That closes ruling 5.
- **Naming: never derive. Extract or ask.** The person stated a name → take it. Anything
  else → ask. Never *construct* one: trade + place, trade + owner, trade alone are all
  constructions. The question rides **inside** the build turn, never in front of it —
  line 763 ("someone describing what they do is the go-ahead to BUILD") stands untouched,
  because that moment is the product.
- **Addresses are changeable.** Pre-claim, the slug follows the name silently. Post-claim,
  an explicit rename with the consequence stated **in the confirm** — the old address
  stops working, there is no redirect, and saying otherwise would be false. Old slugs are
  recorded in `business_slug_history` so a future alias table can honour them
  retroactively. Collisions offer the numbered alternative as a choice; silent appending
  is banned for renames (it is the intended mechanism at draft creation, where the
  address is deliberately temporary and ugly).
- **One signup function.** `start_business_unnamed` was written as a parallel path and
  inherited none of the original's work — no palette, no section order, no identity
  patch, no draft grant, no build job, and it skipped the 10-drafts-per-IP rate limit.
  It has been deleted; `start_business_in_progress` accepts a null name.
- **`|| 'Your Business'` removed from code** — 36 instances in `hubly.html`, plus
  `journey.js` and `platform-home.html`. A null name now renders as nothing: no wordmark,
  no monogram (the "YB" monogram derived from the fake string too).

### Shipped but NOT proved

- **A generated page with no business name has never been looked at by a human.** The
  measurement that made it safe: across 40 real pages the name appears in the header
  35 times, the footer 34, but the `h1` only 11 — so it is not load-bearing for content.
  That is a good argument, not a proof.
- **The build rate.** On four live runs, **two of four *named* signups answered with a
  menu instead of building** — close to verbatim what line 763 forbids, on the path
  nobody edited. Four runs is not a rate. This must be measured at n ≥ 20 per case,
  printing raw replies, before anything is tuned. If the true build rate is near 50%,
  that is the most important number in the product.
- **The 32-step test walk** has not been run. Steps 1–4 failed twice today and were the
  reason for everything above.

---

## 4. Parked, recorded, deliberately not built

| # | Finding |
|---|---|
| 9 | **Hero images never reach the page.** Two paths written at different times, never joined. 115 of 120 pages have a real `<img>` in the hero band, so a hero placer is ~96% reachable. Deferred — and the photo placer has succeeded **4 times in 3 weeks across 180 businesses**, so build the cousin of a near-dead feature only after finding out why it's dead. |
| 10 | **Failures write nothing.** No-slot, inserter refusals — none write a row. Every number we have counts successes only, so everything looks like it works until someone clicks it. The rule when we get to it: every refusal branch writes a row. |
| 11 | **`patch_business_in_progress` ignores unknown keys and reports success.** Any future write routed through it can be a silent false green. Wanted: a count of which RPCs behave that way. |
| 12 | Nothing stops a commit while `npm test` is red. |
| — | **No alarm when the endpoint is down.** The OpenAI account ran out of quota on 2026-09-09 and the only reason anyone knew is that Adrian was walking step 1 by hand. Smallest thing that reaches him, not a monitoring system. Unanswered: whether the customer-facing chat and booking flow on live business sites share that function and that account. |
| — | **Alias table** so a renamed address keeps working. Touches the public resolution path that serves Graef's live site. |
| — | **Migration ledger.** Today added `set_business_slug`, `business_slug_history`, `businesses.name DROP NOT NULL`, and the single-function merge — none recorded yet, on top of the existing 28–30. |

Longer-standing and unstarted: invoicing (ruled: build it), the chat-lead notifier
(nothing tells an owner when someone asks and leaves), Graef's page-to-records extraction
("from $85" must keep its *from* meaning), `review_submissions` wiring and Google reviews
as a live badge (`GOOGLE_PLACES_API_KEY` is set in Supabase; reviews and ratings **may not
be cached or stored**, attribution required), storefront measurement S1–S6, Google Calendar
(the integration exists — establish what it does before designing), Stripe live flip,
Bucket's rebuild and the second-seat conversation.

---

## 5. The method, which is the actual asset

`docs/CHECKER_LESSONS.md` holds 15 lessons. The ones that keep earning their place:

- **9 — a check that will not go red is not passing, it is not running.** Every fix gets
  a red-proof: a check that fails before and passes after. Exit code 2 means COULD NOT RUN
  and is neither a pass nor a fail.
- **11 — a truth string must verify the bytes, not the return value.**
- **12 — a contrast check that reads CSS instead of pixels is measuring a form.** It was
  wrong in *both* directions, which is the failure a number cannot warn you about.
- **13 — an instruction inside a refusal branch is invisible to every test of the path
  that succeeds.** Four separate instructions bore on the naming rule; the fourth lived
  in the handler's own refusal branch and fired only when the model behaved correctly.
- **14 — a parallel path inherits none of the original's guards**, and the guards are
  invisible in the diff because they are the code you did not write.
- **15 — when a measurement of model behaviour comes back zero, print the raw output
  before believing it.** A regex allowed 15 characters where the reply had 16, and it
  nearly reported that the model never asks for a name.

Two more that are Adrian's, not the file's:

- **The screenshot beat the metric four times in one night.** A code trace is a
  hypothesis; a click is a finding.
- **Say only what can be established, and say nothing rather than something plausible.**
  An honest gap beats a plausible fabrication, everywhere, including in a wordmark.

---

## 6. The immediate next thing

The OpenAI quota is topped up and the endpoint is answering again.

1. Re-run `check-name-is-asked` — it should go from CANNOT RUN to green on all cases
   including the four outcome assertions (build dispatched, palette not the `#1a3a6e`
   default, section order set, draft grant issued).
2. **Measure the build rate at n ≥ 20 per case**, named and unnamed, printing raw replies.
   That number gates everything.
3. Answer the blast-radius questions about the customer-facing chat and booking flow.
4. Then Adrian re-walks step 1, looking for one thing: a real generated page, designed
   for detailing, with no name in the header until he gives one.

The 32-step walk lives in `docs/TEST_SCRIPT.md` and as a tickable checklist artifact
published 2026-09-09. Three steps are marked must-not-fail-quietly and are reported
first: **14** (the read marker), **24** (a captured job blocking the public booking
widget), **17** (whether the added services block actually reads on the page).
