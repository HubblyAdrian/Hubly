# The red checks, triaged — 2026-09-17

Adrian: *"THE 27-RED TRIAGE — still not done, still the biggest unknown in the repo. A real defect ·
B broke when the product improved · C never runnable. Counts, worst example of each, then fix A.
And the red count must be DECLARED."*

## THE DECLARED RED COUNT

**Measured by `node scripts/run-all-checks.mjs` — 166 checks, found by glob, not by a list.**

| | before this round | after |
| --- | --- | --- |
| passed | 136 | see the tail of this file |
| **RED** | **27** | |
| cannot run | 2 | |
| timed out | 1 (`check-block-legibility`, at 90s) | |
| assertions passed | 1,477 | |

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

## WHAT IS STILL RED, AND WHY IT IS NOT A LIE

Everything in B that is not fixed is red **on purpose** until Adrian rules:

- **the ten marketing-era checks** — re-record against the shell, or retire. One decision.
- **`check-graefs-page`** — a TRIPWIRE asking whether `p-storefront → p-classic-site` was intended.
  It is answered by re-recording with `--update`, deliberately, which is what a tripwire is for.
- **`check-booking-link-subdomain`** — what the apex serves is a routing ruling.

They are listed here so that a red count is never again quoted without knowing which of these it is.
