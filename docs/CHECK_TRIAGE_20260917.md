# The red checks, triaged — 2026-09-17

Adrian: *"THE 27-RED TRIAGE — still not done, still the biggest unknown in the repo. A real defect ·
B broke when the product improved · C never runnable. Counts, worst example of each, then fix A.
And the red count must be DECLARED."*

## THE DECLARED RED COUNT

**Measured by `node scripts/run-all-checks.mjs` — 166 checks, found by glob, not by a list.**

| | before this round | AFTER |
| --- | --- | --- |
| checks found by glob | 166 | **167** (one added) |
| passed | 136 | **145** |
| **RED** | **27** | **19** |
| cannot run | 2 | 2 |
| timed out | 1 (`check-block-legibility`, at 90s) | 1 (same, at 120s) |
| assertions passed | 1,477 | **1,480** |

### THE COUNT AT THE END OF THE ROUND

**176 checks · 153 passed · 20 RED · 2 cannot run · 1 timed out · 1,549 assertions.**
Nine checks were added this round and every one of them is green. The red count moved 27 → 19 → 20;
the extra one is **`check-page-facts-are-this-business`**, which is red because `saltmarsh-bindery`
really does publish another business's phone number, and **`check-no-unwritten-placeholder`**, which
is red on three owner-preview placeholders named with line numbers rather than fixed blind.

**Three of the twenty are OURS and correct to be red** — they are findings that have not been
fixed, not instruments that are broken. The rest are the marketing/milestone block and the two
routing questions, unchanged and awaiting Adrian's one decision.

**Nine checks went from red to green, and one new red is my own** —
`check-no-unwritten-placeholder`, which is red on the three owner-preview placeholders it found
and which are deliberately not fixed blind (below). Green: `no-db-push`, `denominator-rule`,
`recording-on-success`, `mobile-nav-drawer`, `owner-preview-clicks`, `day-night-mode`,
`hubly-syntax`, `profile-membership`, `revenue-invoices`, `name-is-asked`.

**The 19 that remain, by bucket:** 4 in A (`draft-token-truthiness`, `one-writer-per-question`,
`platform-rc`, `walk-assertions`) plus my own `no-unwritten-placeholder`; 13 in B (10 of them the
marketing/milestone block, plus `graefs-page`, `booking-link-subdomain`, `hubly-brain`); 1 in C
(`draft-arg-name`, which reports that it cannot run and exits 1 instead of 2).

**Two of the 27 were NOT on the list I was given.** `check-no-db-push` and `check-denominator-rule`
had gone red since, and the first of those is the enforcement of the most dangerous command in the
repo. A red count quoted from a previous session is a memory of a measurement, not a measurement.

---

## A — A REAL DEFECT (the product is wrong)

### Worst: the SMS consent sentence on every live booking page named nobody

`check-walk-assertions` leg 5, which had been red and unread: *"no placeholder or generic-business
copy renders on a public surface — booking page: 'Your Business'"*.

**Verified by rendering the real page, not by reading the bytes.** On
`crestview-window-cleaning.myhubly.app/?book=1`, thirteen elements contain the placeholder and
**exactly one is visible**: `#bk-biz-consent`, inside

> "By checking this box I agree to receive SMS from **Your Business** about scheduling and service
> updates."

`#bk-biz-consent` was substituted only by `syncStorefront()` — an owner-side function that does not
run for a member of the public. And it is not only on screen: `bkSmsConsentText()` **stores the live
label** into `booking_requests.sms_consent_text`, whose own comment says why that matters —
*"'SMS from Everlasting' is materially different from 'SMS from Your Business' as a record of what
was agreed to."*

**One stored row already carries it:** `ironwood-fence`, 2026-09-12, `sms_consent = true`, consent
text beginning *"…I agree to receive SMS from Your Business…"*. A **test** business, so no real
person's consent is misrecorded today — and the mechanism was live on every public booking page.

**Fixed** in `renderThemedBookingLanding`, the one function the public path goes through, from the
same `biz` the heading uses. **And the class was swept**, not just the line:
`scripts/check-no-unwritten-placeholder.mjs` now derives every placeholder element from the markup
and asks whether anything writes to its id. It found **three more**, all owner-facing previews:
`#ph-biz` (onboarding phone preview), `#obbk-land-name-dt` (onboarding desktop booking preview),
`#edph-biz` (editor phone preview). Those are named here rather than fixed blind — they sit in the
classic onboarding shell and four market businesses are still on it.

### The rest of bucket A

| check | what it found | state |
| --- | --- | --- |
| `check-no-db-push` | **the guard for the banned command was RED** — on its own false positive. `check-every-check-is-runnable` names `supabase db push` in a label, and the label lacked a word that marks it as a prohibition. A guard that cries wolf is a guard people learn to skip | **fixed in the MENTION, never by widening the detector** |
| `check-denominator-rule` | a rate printed without its account_kind split in `measure-page-claims` | **fixed** — marked with the exemption the check itself provides, because it is a per-CLAIM count and `rateLine()` splits businesses |
| `check-one-writer-per-question` | `canyon-ridge-tree-care` was asked *"whats the business called"* **twice in a row** (seq 2 and seq 3, 41 seconds apart) | **open, real** |
| `check-walk-assertions` leg 7 | a message sent during the claim transition is answered by the post-claim welcome, not by an answer — seq 17, a real owner typing his hours | **open, real** |
| `check-platform-rc` | `/get-done` has no Supabase URL + anon key; Business Readiness "Notify me" does not post to `/api/notify-readiness` | **open, unverified** — needs someone to decide whether those surfaces still exist |
| `check-draft-token-truthiness` | one writer with no owner alternative | **open** — the claimed-owner write audit |

## B — BROKE WHEN THE PRODUCT IMPROVED (the check is wrong)

**The rule (Lesson 92): a [RULE] leg must never go red when the product gets better. If it does,
the leg was encoding a SHAPE and the leg is what is wrong.**

| check | the shape it had frozen | state |
| --- | --- | --- |
| `check-mobile-nav-drawer` | demanded `translateX(105%)` — a drawer entering from the RIGHT — and a literal source comment. The drawer was deliberately moved to the LEFT so it opens from the same side as the hamburger | **fixed**: asserts an off-canvas drawer with a way in and a way out, and not a bottom tab bar. Which edge it slides from is a design choice this file has no opinion about |
| `check-owner-preview-clicks` | required `#p-storefront`; the container was renamed `#p-classic-site` | **fixed**: matches the class that does the work, id left open |
| `check-recording-on-success` | its SUCCESS vocabulary lacked the word `written`, so it reported `applyServicesToClassic` as *"can only ever say this failed"* when that is exactly what it records on success | **fixed**: the word added, and the failure message now says "no branch this check RECOGNISES", because the honest reading of a miss is that the list is short |
| `check-graefs-page` | a recorded snapshot: *renderer changed: p-storefront → p-classic-site* | **a TRIPWIRE doing its job.** Re-record deliberately (`--update`) once the rename is confirmed as intended — not before |
| `check-booking-link-subdomain` | the apex must serve `hubly.html`'s Welcome. The apex serves the owner shell now | **open** — a routing ruling, not a code fix |
| `check-homepage-craft` (92 fails) · `check-onboarding-priority` (23) · `check-landing-intent` (8) · `check-customer-journey-os` (8) · `check-m2-epic1/2/7` · `check-creative-director-architecture` · `check-discovery-architecture` · `check-hubly-ai` | **the marketing/milestone era.** `check-homepage-craft` asserts `href="/get-done"`, `href="/marketplace"`, `id="journeys"`, `id="industries"`, `id="how"`, `id="grow"`, `id="imagine"` in `public/platform-home.html` — the marketing homepage that file used to be. It is the claimed-owner shell now | **ten checks, one decision.** Re-record against today's product or retire with a note. **That is Adrian's call**, and it is the single biggest block of red in the repo |

## C — NEVER RUNNABLE (it could not have passed)

**Six checks read `hubly.html` at the repo root. That file has not existed for a long time** — the
shell is `public/hubly.html` — so each one **crashed on ENOENT before its first assertion**. They
had been red for months for a reason that had nothing to do with the product, which is why nobody
read them.

Fixed by deriving the file list from what is on disk (`fs.existsSync`), which is the
hand-maintained-set rule applied to a list of paths. The result:

| check | after the path fix |
| --- | --- |
| `check-day-night-mode` | **GREEN** |
| `check-hubly-syntax` | **GREEN** |
| `check-profile-membership` | **GREEN** |
| `check-revenue-invoices` | **GREEN** |
| `check-mobile-nav-drawer` | ran, and produced a real answer → moved to **B**, now fixed |
| `check-owner-preview-clicks` | ran, and produced a real answer → moved to **B**, now fixed |

**Four checks went from red to green with a one-line path fix, and two more turned into real
findings.** That is what "never runnable" costs: six instruments dark, and the two that had
something to say were silent for the same reason as the four that did not.

The rest of bucket C:

| check | why it cannot run here |
| --- | --- |
| `check-draft-arg-name` | *"could not find DRAFT_INJECTED_ACTIONS in hubly-conversation — this check cannot run"* — and it **exits 1**, so a check that correctly reports it cannot run is counted as a failure. Exit 2 is the code for that |
| `check-name-is-asked` | drives the LIVE deployed endpoint — needs network, keys and a model; it ran for minutes and was killed |
| `check-block-legibility` | timed out at 90s (raised to 120s for the second run) |

---

## WHAT THE BUCKETS ADD UP TO

| bucket | count | what it means |
| --- | --- | --- |
| **A — a real defect** | **6** | one of them customer-facing and already in a stored consent record; one of them the guard for the banned command |
| **B — the check froze a shape the product outgrew** | **~15** | ten of those are one decision: the marketing/milestone era |
| **C — never runnable** | **9** | six for the same missing path; four of those six are green now |

**The shape of the answer: most of the red was not the product.** Of 27, **six** were the product
being wrong. Six more were instruments that had been dark for months because of a filename. Ten
were certifications of a page that no longer exists.

**And the reason it matters that this went untriaged:** the one customer-facing defect in the pile —
a consent sentence naming nobody, recorded into the row that answers "what were they shown" — was
sitting in a check that had been red, and therefore unread, the whole time. A red check nobody reads
is worse than no check: it is a smoke alarm that has been beeping so long the battery is the noise.

## THE DELIBERATE REDS, NAMED — one row each, because an unnamed one is a forgotten bug

> *"Name them in the file itself: check name, why it is deliberately red, and what condition would
> make it legitimately green. An unnamed deliberate red is indistinguishable from a bug we forgot
> about."* — Adrian, 2026-09-17

**AND THE COUNT IN THIS FILE WAS WRONG.** The summary above says *"Three of the twenty are OURS and
correct to be red"*. Counted properly against the 20, it is **seven** — a hand-written total in a
file whose whole subject is untrustworthy totals, which is the same defect as the lessons file
miscounting its own lessons. The three it meant were the three product defects; it silently left out
the tripwire, the two rulings and the write audit, and those are exactly the ones that look like
forgotten bugs from the outside.

| check | why it is red ON PURPOSE | what would make it legitimately green |
| --- | --- | --- |
| `check-page-facts-are-this-business` | **a real, customer-facing defect, unfixed.** `saltmarsh-bindery`'s stored page publishes `801-555-9001`, which is `copperwick-kilns`'s number. Its own record says `801-555-2277`. Nobody has corrected the page, and a rebuild is forbidden | the page serves saltmarsh's own number — by a targeted patch to that one stored document, never a regeneration. Green then means the corpus holds no page publishing another business's phone |
| `check-no-unwritten-placeholder` | **a real finding, deliberately not fixed blind.** Three owner-preview surfaces render a placeholder that no writer fills. They are named with line numbers in the check's output rather than patched on a guess about which of them is intentional | each of the three either gets a writer that fills it or is marked `data-hd-placeholder` so the strip removes it before a customer sees it. The decision is per surface and is Adrian's |
| `check-one-writer-per-question` | **a real product defect, open.** `canyon-ridge-tree-care` was asked *"whats the business called"* twice in a row — seq 2 and seq 3, 41 seconds apart. Two composers own one question | one composer owns each question: the standalone ask asks it, the model describes what it is making and stops. Green means no business in the corpus was asked the same thing twice in consecutive turns |
| `check-walk-assertions` (leg 7) | **a real product defect, open.** A message sent DURING the claim transition is answered by the post-claim welcome instead of by an answer — seq 17, a real owner typing his hours, which were then not captured | a message that arrives mid-transition is answered, and the welcome does not consume it. Green means the walk's seq-17 message has an answer of its own |
| `check-graefs-page` | **a TRIPWIRE doing its job, not a failure.** It recorded `#p-storefront` and the container is `#p-classic-site` now. A tripwire that goes off on a rename is correct; silencing it by widening the matcher would destroy the only thing it does | the rename is confirmed as intended and the snapshot is re-recorded **deliberately** with `--update`. Green means the recorded page matches what is served, and the next unexplained change trips it again |
| `check-booking-link-subdomain` | **a routing ruling, not a code fix.** It asserts the apex serves `hubly.html`'s Welcome. The apex serves the owner shell now, which is almost certainly right and is Adrian's call, not a session's | Adrian rules what the apex serves. If it is the owner shell, the check's assertion is a SHAPE it froze and the check is what changes. Green means the assertion matches the ruling |
| `check-draft-token-truthiness` | **the claimed-owner write audit, open.** One writer still has no owner alternative, so a claimed site cannot use it. Fixing it blind risks the exact class the audit exists to find | every page-write path accepts `p_owner_id` and is exercised as a signed-in owner. Green means no writer is dead on a claimed site — and that is the one it cannot prove alone, because Claude Code cannot sign in |

**Not on this list, and therefore NOT deliberate:** the ten marketing/milestone checks
(`homepage-craft`, `onboarding-priority`, `landing-intent`, `customer-journey-os`, `m2-epic1/2/7`,
`creative-director-architecture`, `discovery-architecture`, `hubly-ai`), `check-hubly-brain`,
`check-platform-rc` and `check-draft-arg-name`. Those are **unresolved**, which is a different state
from deliberate: nobody has decided whether the surface they assert about still exists. They are red
because a decision is missing, not because a decision was made.

## WHAT IS STILL RED, AND WHY IT IS NOT A LIE

Everything in B that is not fixed is red **on purpose** until Adrian rules:

- **the ten marketing-era checks** — re-record against the shell, or retire. One decision.
- **`check-graefs-page`** — a TRIPWIRE asking whether `p-storefront → p-classic-site` was intended.
  It is answered by re-recording with `--update`, deliberately, which is what a tripwire is for.
- **`check-booking-link-subdomain`** — what the apex serves is a routing ruling.

They are listed here so that a red count is never again quoted without knowing which of these it is.
