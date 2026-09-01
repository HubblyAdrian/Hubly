# STATE — where the build is (2026-08-31)

The current picture, no history. Pairs with `CLAUDE.md` (the rules), `PRODUCT_SHAPE.md`
(decisions), `OPEN_FINDINGS.md` and `SHELL_TERRAIN.md`. This file is the durable record;
if it disagrees with memory, this wins.

## Built — do not rebuild (verify by using, don't re-implement)

- **Claim → claimed shell.** Two modes on one generic switch (`hc.mode` → `data-mode`,
  `hcOpenWorkspace`): **Home** (chat is the screen) and **Website** (site = large canvas,
  chat = assistant panel). Rail beneath a slim solid header (full "hubly" wordmark). Settings
  is a popout (Account / Notifications / Website / Integrations; Billing omitted).
- **Click-to-edit** on a claimed page (was a missing auth-handshake door; the iframe now runs
  the handshake itself). **Direct edits are optimistic** — painted at the click, no reload
  (the reload was the ~2-min latency), no spoken chat line (self-evident), a transient Undo
  toast instead. **Undo** = `restore_prev_business_document` (step back one version).
- **Home is an assistant**: calm greeting, transcript reachable not dumped, a "what your site
  needs" recap from real empty fields (`get_my_site_gaps`). Suggestions are earned-by-state,
  their action runs, silent when nothing's due. NO activity recap (bookings/customers/revenue
  are zero everywhere). Only proven-placement suggestions are offered (photos, descriptions).
- **Services extraction + freeform placement**: model-pass extraction, anchor-stamp at build,
  retroactive patch-time stamp, insert-by-clone, labelling of card grids as items. Verified.
- **Hours + contact freeform placement (the Contact & Hours block)**: hours, phone, email,
  address placed post-build via an anchor on our OWN inserted block — inserted when absent,
  updated in place after, deduped by one normalization key per fact, free-text `hours_note`
  captured verbatim, countable, read back per fact. NO re-recognition of a model-authored
  hours list (it clobbered a footer + stripped styling — removed). Verified 23/24 on the right
  corpus (pages built without hours), light + dark layouts. `hubly_contact.ts`. The two Home
  suggestions ("Set your hours", "Add a phone number") are re-enabled.
- **Stripe Connect Express** (onboard/webhook/fee=0) exists with a door in Settings, but is
  **deprioritized** and **never proven end-to-end** (0 paid bookings ever; test cycle owed).

## Pending, in order

1. **The "hours already shown" consent offer (designed-but-unbuilt).** When an owner sets hours
   and the page already shows a schedule we can't safely anchor, we save + honestly decline
   today — but the page is then displaying WRONG hours (a customer drives to a closed shop).
   The fix is a confirmed-target offer (quote the page back, "want me to update that section?",
   carry the yes with the click-action primitive), NOT a rebuild. Spec in OPEN_FINDINGS #9.
2. **Mobile shell.** The rail/modes are desktop; the phone keeps the old Chat/Site toggle.
   Claude Code cannot verify mobile — needs a real phone.
3. **Storefront** (the third mode; must reuse the generator/chat/claim/shell, not fork).

Deprioritized / later: Stripe test-mode proof + wider door; price-comparison retrieval
(chosen: OpenAI web search, guardrails in CLAUDE.md); booking-wizard palette inheritance;
demoting `HublyBlueprints` to per-vertical defaults.

## The anchor-pattern discipline (the through-line)

A freeform page has no async update path, so any fact a later change must touch is **stamped
with an anchor at generation**, then **placed by that anchor afterward**, **inserted into the
existing section when absent**, with a **countable row** and a **"name what actually happened"
read-back**. Proven for services; hours + contact are the next instances. Never re-recognize
layout after the fact; never offer a suggestion whose action can't reach the page.

## Needs Adrian's eyes on the DEPLOYED site (I can't hold a real session)

- Click-to-edit end to end (done once; keep confirming after deploys).
- Home on a real return visit (greeting + real gaps, not the old scroll) and the suggestion
  buttons starting their tasks.
- The optimistic edit *feeling* instant and the transient Undo toast.
- Stripe test-mode cycle (connect → book → test card → paid → refund) — I must not enter cards.
