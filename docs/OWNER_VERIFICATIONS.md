# Outstanding OWNER verifications — things Claude Code structurally cannot do

**These are Adrian's, recorded 2026-09-17 so they survive a context loss.** Every one exists because a
standing rule stops the session doing it, not because it was forgotten or deferred. **A rule beats an
instruction; stopping was correct.** Until each is done, the thing it covers is UNVERIFIED — not
broken, not fine, unverified — and nothing in this repo may report it as proven.

---

## ✅ 5.1 — CLOSED 2026-09-18. Adrian signed in and looked.

**BOTH LIVE BUGS CONFIRMED FIXED ON A REAL SESSION** — real RLS, real business
(`hubly-classic-fixture`), real authenticated load:

- **BUG 1 — the first paint.** `hc-boot-owner` is on `<html>` on an authenticated load. **No landing
  paint.**
- **BUG 2 — a conversation per tab.** The Website tab shows its own conversation: *"This is a separate
  conversation, just about Website. Your main chat is on Home."* **Home's chat is not in it.**

**THIS IS THE FIRST EVIDENCE IN THIS ENTIRE EFFORT FROM THE SURFACE A PERSON ACTUALLY TOUCHES.** Every
browser leg I ran used the declared fake in `scripts/lib/owner-rig.mjs` — real code paths, but no RLS,
no session, no real JWT (limit 2 in that file's own header). Two things follow and both matter:

1. The fake's green legs were not wrong, and they were not sufficient. They said the code does the
   right thing against a declared world. They could not say the world is that.
2. **The three rows below that these two closures cover are now LIVE-CONFIRMED** in
   `docs/UNCONFIRMED_AGAINST_A_LIVE_SURFACE.md`: the first paint and the tab conversations move out of
   RIG-MEASURED. What is still unconfirmed there is everything else, and the list says which.

The section below is kept as the record of what was unverified and why, because the reasoning is what
made the gap findable — not because it is still open.

## 5.1 (the original entry, kept as the record) — Sign in, go to `#website`, refresh

**Why nobody else can do it.** *"Never create an account, never enter a password."* Every browser leg
in the 2026-09-17 rounds ran against the declared fake (`scripts/lib/owner-rig.mjs`), which has **no
RLS, no real session and no real JWT**. The fixture's own header lists that as limit 2.

**What is unverified until he does it** — three things shipped and confirmed in the served bytes, none
of them exercised with a real session:

| shipped | what a real session would prove |
| --- | --- |
| **Bug 1 — the first paint** (`hc-boot-owner`, set in `<head>` from the supabase session in localStorage) | that a REAL session's stored shape is what `HublyBoot.isAuthed()` reads. The fake writes a two-field object; a live supabase session has more, and only the real one settles it |
| **Bug 2 — a conversation per tab** (`hcRenderHome` refuses to paint into another tab; the place loader re-checks after every await) | that `ask_hubly_conversations` / `ask_hubly_messages` are readable and writable **under real owner RLS**. The fake returns whatever it is asked for, whoever asks — the claimed-owner write audit exists for exactly this class |
| **The tab offer** (`hc._tabOfferShown` is per place now, not one boolean per sitting) | that `add_business_place` accepts the real `p_owner_id` from a live JWT, and that the rail repaints for a signed-in owner |

**The exact steps:** sign in · navigate to `#website` · refresh. Watch for (a) any frame of the
landing page — there must be none; (b) the Website tab's own conversation surviving the load — Home's
greeting must not replace it; (c) asking for My Day, accepting the tab, then asking for Jobs in the
same sitting — **both** must be offered.

## 5.2 The pending booking on `adrians-lawn-service`, fired 17:54:32Z

**Adrian presses ACCEPT.** The endpoint (`accept-booking`) is deployed and calls the shared
`createJobFromBookingRequest` writer; nothing about it has been exercised with a real owner JWT.
Report nothing about this booking until he says what happened.

## 5.3 Mobile — the 5th place on a phone

**Why nobody else can do it.** *"Claude Code cannot verify mobile."* There is no true 390px viewport
and no soft keyboard in this environment.

**Why it is newly at risk.** Prohibition 5 caps the phone's bottom bar at 4 places. Until 2026-09-17
`hc._tabOfferShown` was a single boolean, so **at most one place could enter the rail per sitting** —
which made a 5th place practically unreachable. That is fixed, so a 5th place is now reachable in one
sitting, and the overflow ("More") has never been exercised on a real phone with a real 5th place.

**What to check:** earn five places, on a phone. The bar shows 4 and a way to the rest; positions do
not reshuffle; the 5th is reachable and announced rather than silently absent.

---

## Build items named rather than guessed at

These are not verifications — they are things a session deliberately did NOT build because the
alternative was shipping something unverifiable.

- **A working email call-to-action on a full-document page.** `hubly_contact.ts` and the classic
  hero/footer no longer emit `mailto:` (ruled 2026-09-17: fix the writer, keep the ban). The freeform
  equivalent is `<a href="hubly:contact">`, bound by `wireHublyDocumentReserved` **inside
  `#hc-doc-root` only** — so it is live on a mounted AST document and **dead inside the
  full-document iframe renderer**, which is how three of the four patched pages are served. Until the
  iframe path binds the scheme (or stops being used), those pages carry the address as text and no
  email CTA. Shipping a CTA that works on one renderer and silently does nothing on the other is
  worse than the mailto it replaced.
- **`json_schema` + `strict`.** Ruled: collect the baseline first.
  `scripts/check-baseline-before-schema.mjs` fails if anyone flips it while
  `document_generation_events` holds no usable `json_object` baseline. Its `[SHAPE]` leg "the baseline
  is being collected at all" is **RED on purpose today** — the table has zero rows because no page has
  been generated since it was created. It goes green on the first build. That is a named deliberate
  red, in `docs/CHECK_TRIAGE_20260917.md`.
## 5.4 Stripe's webhook delivery log — has `stripe-webhook` ever run?

**Adrian's, 2026-09-18.** Unanswerable from this repo and the database, and the reason is worth keeping
rather than re-deriving: every table `stripe-webhook` writes has other writers
(`stripe_connect_accounts` 6, `booking_requests` 3, `marketplace_bookings` 3, `commerce_orders` 3), so
rows prove nothing about *that* function, and no invocation log is reachable —
`supabase functions list` returns a DEPLOY time, not a call count. `commerce_orders` holds 2 rows and
both are still `pending`, which is suggestive of a webhook that never fired and is not evidence.

**Stripe's own webhook delivery log is the only place the answer lives.** After the 2026-09-18 quoting
fix in the orphan sweep, `stripe-webhook` is one of only THREE edge functions with no caller anywhere
in `public/`, `api/`, cron or a migration — the other two are `commerce-merchandising` and
`mission-control`.

## 5.5 GRAEF'S EXTRA CONTACTS — and the finding changed shape overnight

**Adrian is asking Graef whether he meant to publish these.** The exact values, so they are in front of
him when he asks:

| on his page / in his record | value |
| --- | --- |
| phone, **on his record** | `661-546-2662` |
| phone, also present | `661-493-5289` |
| phone, also present | `661-717-2773` |
| email | `kurash448@gmail.com` |
| email | `lhgraef5@gmail.com` — carries his surname |
| email | `austinjgraef@gmail.com` — carries his surname |

**AND THE 2026-09-17 FRAMING OF THIS WAS WRONG, which changes the question he should ask.** It was
reported as *"his live page carries two extra phone numbers and three personal gmail addresses"*. On
2026-09-18 they were located: they are **three lead records at `meta.pipeline.manual`**, each with a
name, a phone and an email. The classic renderer does not render `meta.pipeline`, so **they are
probably not on his page at all** — they are his own leads, correctly stored.

So the question is no longer "did you mean to publish these". It is **5.6**.

## 5.6 THE ANON READER RETURNS THE WHOLE `businesses` ROW — including that lead list

**What would make this wrong, first.** `get_public_business(slug)` is `SECURITY DEFINER`,
`EXECUTE`-granted to `anon`, and its body is `select to_jsonb(b) - 'draft_token' from public.businesses b
where b.slug = p_slug and b.owner_id is not null`. That is conclusive about **what the function
returns**. It is **NOT** an executed unauthenticated request: making one needs the anon key, and a key
may never reach a command line or a transcript. **That last link is Adrian's to close**, and until he
does, this is "the grant and the body say so", not "I fetched it".

**What it means if it holds.** Every column of `businesses` is public for any CLAIMED business —
including `meta`, and `meta.pipeline.manual` is a lead list. Measured 2026-09-18, counts only, no
values printed: **`graefs-autocare` (market, claimed) has 3 lead records each carrying a name, a phone
and an email**; `adrians-lawn-service` (test, claimed) has 2. Those are the six values in 5.5.

**AND IT IS NOT JUST A NAME AND A PHONE.** The check reports FIELD NAMES (never values). Each of
Graef's three records carries: `name`, `phone`, `email`, `address`, `messages`, `lastMessage`, `notes`,
`notesList`, `activity`, `appointments`, `tasks`, `estimate`, `estimatedValue`, `service`, `source`,
`stage`, `status`, `crmStatus`, `quoteStatus`, `jobStatus`, `tags`, `followUpAt`, `lastContacted`,
`aiScore`, `aiQualified`, `buyingIntent`, `lostReason`, `isReturning`, `isMembershipSignup`. **That is
his whole CRM record for those three people, including the message history and his own notes.**

**And the shape is the problem, not the column.** `to_jsonb(b)` means a column added next month for
something else is public the moment it exists. Nobody has to make a mistake for the next leak.

`scripts/check-no-public-reader-leaks-contacts.mjs` is RED on this today and prints no values. The fix
is a ruling — narrow the reader to the columns a public page actually needs — and it touches a live
reader used by ten market businesses, so it is not something a session should choose alone.

- **`stripe-webhook`: has it ever run?** Unanswerable from here. Every table it writes has other
  writers (`stripe_connect_accounts` 6, `booking_requests` 3, `marketplace_bookings` 3,
  `commerce_orders` 3), so rows prove nothing about *that* function, and no invocation log is
  reachable (`supabase functions list` gives a deploy time). **Stripe's own webhook delivery log is
  the only place the answer lives**, and Adrian is the one who can open it.

## ✅ 5.7 — CLOSED 2026-09-18. The `meta.pipeline` divergence: EXPLAINED, and the explanation is a timestamp

**The observation, as Adrian gave it.** In an incognito window on `graefs-autocare.myhubly.app` he
opened devtools, expanded the `get_public_business` response, and reported that `pipeline` was **not**
in it — the expanded key tree ran alphabetically from `paymentSetting` straight to `portfolioUrls`
with nothing between them, and a response-body search for `pipeline` hit only `app-marketplace.js`,
`design-system.js` and the page HTML, with **no `get_public_business` group at all**. My SQL said the
column holds `pipeline` with 3 records. He asked which of four explanations it was, and said *"still
unexplained is an acceptable answer and a fabricated mechanism is not."*

**Three of the four are refuted by measurement, not by argument.**

| hypothesis | result |
|---|---|
| `pipeline` is not really in his meta | **REFUTED.** Exactly one key matches `%pipe%` and it is literally `pipeline`: an object, 9 subkeys, 3 manual records. |
| the reading counted a key not literally named `pipeline` | **REFUTED** by the same query — one match, exact name. |
| the row was written between the two readings | **REFUTED.** `businesses.updated_at` for that row is **2026-09-09 20:56Z**, months before either reading. Nothing wrote it. |
| the client strips it after receipt, and devtools showed a processed body — *the serious case, because it would mean the raw bytes carried it* | **REFUTED.** Nothing in either shell deletes, omits, or overwrites `meta.pipeline`; and the decisive evidence is below, which rules out the old response shape entirely. |

**What it actually was: he read the post-allowlist function, and the shape of his own screenshot
proves it.** The premise I was asked to test was that his observation *predated* the allowlist
migration. It did not, and the proof does not depend on anyone's memory of when they looked:

- `businesses.meta` is a **TEXT** column. The pre-allowlist function body was
  `select to_jsonb(b) - 'draft_token'`, and `to_jsonb()` of a text value is a **JSON string**.
  Measured directly: `jsonb_typeof((to_jsonb(b) - 'draft_token')->'meta')` returns **`"string"`**,
  and those raw bytes **do** contain the substring `"pipeline"`.
- The post-allowlist function returns `meta` as an **object** — `jsonb_typeof(...)` returns
  **`"object"`** — with `pipeline` filtered out by the 56-subtree allowlist.

Both halves of Adrian's observation are only possible against the **object** version:

1. **An alphabetical, expandable key tree is an object.** Under the old shape devtools would have
   shown `meta` as one long quoted string — not expandable, not alphabetised, no `paymentSetting →
   portfolioUrls` adjacency to notice.
2. **The body search found no hit in that response.** Under the old shape the bytes *did* carry the
   substring `"pipeline"` (measured above), so the search would have hit it.

So there was never a divergence between his reading and the database: **my SQL read the raw column
(which has `pipeline`) and his devtools read the allowlisted function output (which does not).** The
two were measuring different things, and the field-for-field match noted in the previous round — his
24 top-level fields and all 40 meta keys permitted by the live list, none forbidden — is the same
conclusion arriving from the other direction.

**The instrument note, because it is the lesson and not the answer.** Evidence (2) is a *silence* — a
search that found nothing — and on its own it is worth much less than it looks: devtools only searches
response bodies it retained, so "no hit" and "not searched" are indistinguishable from the outside
(Lesson 96). What closed this was evidence (1), which is a **positive** observation: an object tree
was on his screen, and only one version of the function can produce one. Counts: 52 meta keys in
Graef's column, 51 on the wire, exactly one stripped — unchanged after this round's migration.

**No row was written at any point.** `graefs-autocare` remains read-only; two `create or replace
function` statements and zero INSERT/UPDATE/DELETE.

## ✅ 5.8 — CLOSED 2026-09-18. Discovery was the problem. Adrian's four conclusions, each checked

**What Adrian established** (Search Console, a DOMAIN property for `myhubly.app` verified by DNS TXT
that morning — it did not exist before, which is why the noindex window was unmeasurable). URL
Inspection on `https://graefs-autocare.myhubly.app/`: *"URL is not on Google — Page is not indexed:
URL is unknown to Google"*; no referring sitemaps; no referring page; **Last crawl, Crawled as, Crawl
allowed, Page fetch, Indexing allowed — all N/A**. Then Test Live URL on the same URL: *"URL is
available to Google"*, *"Page can be indexed"*, and a rendered screenshot of his real site. He
pressed Request Indexing.

### The four conclusions, verified rather than accepted

| # | conclusion | how it was checked here | verdict |
|---|---|---|---|
| 1 | the noindex bug cost this customer nothing | **corroborated twice, independently of GSC.** The window is measurable from git: the allowlist that dropped `owner_id` was applied at **2026-09-17 22:28:46 -0600** (`74639de`) and the fix at **2026-09-18 00:07:24 -0600** (`62065b4`) — **1 hour 39 minutes**, overnight. Separately, every crawl field reading N/A means Google holds no crawl record for the URL. | **Supported.** See the caveat below. |
| 2 | "Page can be indexed" confirms the noindex fix is live | measured independently in a real browser before he tested: two live claimed market sites carry **no** `data-hc-noindex` tag, and `adrians-lawn-service` (`account_kind='test'`) still **does**. Both directions. | **Confirmed, two ways.** |
| 3 | Googlebot executes the client render; pre-hydration content is not a defect | his rendered screenshot is the direct evidence. Additionally, the **raw** response already carries the business's own `<title>`, `og:title` and `og:description`, injected server-side by `api/router.js` — so even the unrendered document identifies the business. | **Confirmed. Not investigated further, per his instruction.** |
| 4 | the reason customer sites are not findable is DISCOVERY | measured from our side: `/sitemap.xml` returned **HTTP 200 with 3,091,125 bytes of `text/html`** (the catch-all), `robots.txt` had **no `Sitemap:` line**, and the apex homepage contains **3 `<a href>` in total and zero links to any business subdomain**. | **Confirmed, and it was worse than "absent".** |

### The caveat on conclusion 1, stated because an alarming *or* a reassuring number needs one

"URL is unknown to Google" is a statement about Google's index **now**. It cannot prove Google never
fetched the page — only that no crawl record exists for it today. What makes the conclusion safe is
not that field on its own; it is the **1h39m window**, which is measurable here and does not depend on
Google's reporting at all. Had the window been three weeks, the same N/A fields would have been much
weaker evidence. **This holds only if the commit timestamps approximate when each migration was
applied to the remote** — each was applied immediately before its commit in the same session, so they
do, to within minutes.

### What was built

`api/sitemap.js` + `public.get_indexable_business_slugs()` + a `vercel.json` route before the
catch-all + a `Sitemap:` line in `robots.txt`. **13 URLs**: 10 claimed market, 3 claimed internal, out
of 214 businesses (173 unclaimed and 28 claimed-test excluded). Membership is derived from
`get_public_business()`'s own output — the same reader `hcNoIndex()` interrogates — so the sitemap and
the page cannot disagree about a business. Covered by
`scripts/check-the-sitemap-is-the-record.mjs`, 6 legs, 5 RED ALONE and 1 hand-proven.

### Still needs a person

Whether Google actually **fetches** these URLs now. Submitting the sitemap in Search Console, and the
result of the Request Indexing he already pressed, are both his to observe — nothing in this repo can
assert them.

## ✅ 6.1 — CLOSED 2026-09-18. The noindex incident cost ZERO. Measured, not assumed

**The window: 1 hour 39 minutes.** Measured from git, independent of Google entirely:

| | |
|---|---|
| `owner_id` removed from the public reader | `74639de`, **2026-09-17 22:28:46 -0600** |
| the fix, both halves, applied and pushed | `62065b4`, **2026-09-18 00:07:24 -0600** |
| elapsed | **1h 38m 38s**, overnight |

**Google had never fetched the affected pages — not once.** Adrian's URL Inspection on
`https://graefs-autocare.myhubly.app/` (new DOMAIN property for `myhubly.app`, DNS-TXT verified that
morning) returned *"URL is unknown to Google"* with **every crawl field N/A** — Last crawl, Crawled as,
Crawl allowed, Page fetch, Indexing allowed. No referring sitemap, no referring page. A Live Test on the
same URL then rendered his real site and reported *"Page can be indexed"*.

**So the cost was zero**, and it is zero for two independent reasons rather than one: the tag was live
for 99 minutes overnight, and nothing had ever crawled the pages it was on.

**What would make this wrong** — stated because a reassuring number needs a caveat exactly as much as an
alarming one: *"URL is unknown to Google"* describes Google's index **now**; it cannot prove Google never
fetched the page, only that no crawl record exists today. That field alone would be weak evidence. What
carries the conclusion is the **99-minute window**, which is measurable here without Google's
cooperation. Had the window been three weeks, the same N/A fields would have proved much less. The window
itself holds only if each commit timestamp approximates when its migration was applied to the remote —
each was applied immediately before its commit in the same session, so they agree to within minutes.

**And the incident was still worth its cost**, because finding it produced
`scripts/check-every-field-a-renderer-reads-is-returned.mjs`, which found it on its first run, and
Lesson 104.

## 6.3 — OPEN, not done. Canonical tags and JSON-LD. No ruling requested or given

Both were named as discovery-adjacent options. Neither is built. My own assessment of each, offered so
Adrian can rule later:

### `<link rel="canonical">` — currently absent on every page

**Cost: low.** One line in the `<head>` injection `api/router.js` already performs for `og:` tags, so it
is server-side and needs no client change. **Urgency: low, and lower than it first looked.** I checked
for the duplicate-host risk and it does not exist: `graefs-autocare.hubly.app` **does not resolve**
(`http=000`), so there is one live host per business, not two. What remains is variant collapsing —
`?utm_source=…`, a trailing-slash difference, an uppercase host — which Google usually handles unaided.
**My recommendation: do it when something else touches that injection, not as its own task.** The one
thing that would raise its urgency is starting to link business pages from anywhere with tracking
parameters.

### JSON-LD `LocalBusiness` in the raw response

**Cost: low-to-moderate**, and it is the *moderate* part that matters. Emitting the markup is easy —
same injection point, beside the `og:` tags, from the same `get_public_business` row. What is **not**
easy is that structured data is a set of **claims Google will hold the business to**: an address, an
opening-hours block, a price range, an `aggregateRating`. Every one of those is a fact, and this repo's
standing rule is that Hubly never publishes a fact the owner did not state. A `LocalBusiness` block
assembled from whatever the row happens to hold would be exactly the invented-business-hours defect, in
a format designed to be machine-trusted. An `aggregateRating` we cannot substantiate is worse again.

**Urgency: low. Value: genuinely high if done narrowly** — `name`, `url`, `image`, `telephone` and
`address` **only where the record actually holds them**, omitting every absent field rather than
approximating it, and no ratings. **My recommendation: build it only with that constraint written into
the code as a per-field presence test, not as a template with blanks.** The failure mode here is not a
missing feature; it is a confident machine-readable claim nobody made.

**Neither is scoped, estimated, or scheduled. Recorded as open at Adrian's instruction, awaiting a
ruling.**

## 6.2 — STILL ADRIAN'S, carried forward unchanged

Nothing in this repo can assert any of these. Listed so they are not quietly absorbed into "done".

| | what it needs |
|---|---|
| **Submitting the sitemap in Search Console** | doing it today, per Adrian. `https://myhubly.app/sitemap.xml` is live and serves **10** URLs; `robots.txt` names it on every host, so Google will find it unaided eventually — submitting is faster and gives a coverage report. Also: the Request Indexing he pressed on `graefs-autocare.myhubly.app` |
| **Stripe's webhook delivery log** | has `stripe-webhook` ever run? Only Stripe's dashboard knows; rows are evidence of a call, and no rows is not evidence of no call (§5.4) |
| **The mobile preview at 390px on a real device** | there is no true 390px viewport and no soft keyboard in this environment. The preview's mobile path is asserted in a rig, which is evidence about the CODE PATH and not about a phone |
| **The 5th rail tab, and the phone's "More" overflow** | prohibition 5 is a mobile claim. Same limitation |

## 7.2/7.3 — Search Console, and what is still Adrian's (updated 2026-09-18)

### CONFIRMED BY ADRIAN, and it is the only measurement anyone has of what Google knows

| | |
|---|---|
| Domain property for `myhubly.app` | **verified 2026-09-18** by DNS TXT at Vercel. Covers every `*.myhubly.app` subdomain. Did not exist before that day — which is why the noindex window was unmeasurable at the time |
| `https://myhubly.app/sitemap.xml` | **submitted and ACCEPTED** |
| Request Indexing on `graefs-autocare.myhubly.app` | **pressed** |
| Before all of it | *"URL is unknown to Google"*, every crawl field **N/A** — no referring sitemap, no referring page. And the Live Test on the same URL **rendered his real site** and said *"Page can be indexed"* |

So: rendering was never the problem, the noindex fix is confirmed by Google's own tooling, and discovery is now wired at both ends — a sitemap that exists and is submitted, referenced from `robots.txt` on every host.

### The three internal businesses dropped from the sitemap — RULING CONFIRMED

`cotter-aviation`, `lugnutz`, `my-auto-detailing`. Adrian, 2026-09-18: **none is a demo he wants
findable.** Sitemap is **10** URLs (10 claimed market), not 13. The predicate is
`business_is_indexable(owner_id, account_kind)` — one place, read by `hcRowIsIndexable` and by the
sitemap, so this cannot drift into disagreeing with what the page stamps.

### Still Adrian's — OPEN, none of it done

| | note |
|---|---|
| **ACCEPT on `adrians-lawn-service`'s pending booking** | **OPEN — not pressed.** Corrected here: an earlier entry listed this among things to do; it has not been done, and nothing in the repo can assert it |
| Stripe's webhook delivery log | has `stripe-webhook` ever run? Only Stripe's dashboard knows. Rows are evidence of a call; no rows is not evidence of no call |
| The 5th rail tab and the phone's "More" overflow | prohibition 5 is a mobile claim. No true 390px viewport here |
| The mobile preview at 390px on a real device | the mobile path is asserted in a rig — evidence about the CODE PATH, not about a phone |
| The truncated-`meta` write-back candidate | needs an owner session. **Not on `graefs-autocare`, and not on either of the two claimed market businesses that hold real `pipeline` data** |

## ⚠️ 5.4 — THE SAVE TEST IS **PARTIAL**, not done. Steps 1–3 pass; step 4 was blocked

Adrian, 2026-09-18, on `evergreen-yard-care` (freeform, 167 stored document versions):

| step | state |
|---|---|
| 1. edit three service prices inline | **PASS** |
| 2. they saved | **PASS** — three new document versions, 165 → 167, 12–23s apart |
| 3. refresh; they stayed | **PASS** |
| 4. **save again with nothing changed** | **BLOCKED — never reached.** *"I could not edit them again. Not 'the edit failed' — I could not get back into the field at all."* |

### The blocker, named

`wireHcEditingSurface` (public/hubly.html). `data-hc-wired` was set once and **cleared nowhere**, on a
root whose **children** get replaced, while guarding **per-element** listeners. Document-level
listeners survive a re-render (they live on `doc`); the per-element marks do not, because those
elements are gone.

**FIXED for the CLASSIC path** — bind ONCE, mark EVERY TIME. Covered by
`scripts/check-a-second-edit-still-works.mjs`, whose every leg wires, **replaces the content**, wires
again, and asserts on the state after that: 2 marked → 0 after the re-render → 2 after the second
wire. 2 legs, both RED ALONE. Clearing the flag instead would have re-bound the document-level
listeners on every render — the opposite bug.

### Still open, and it is the half Adrian actually hit

**The FREEFORM case is NOT settled.** There the root is the nested `srcdoc` iframe's `body`, and a
save goes through `hcRefreshCanvasFrame()`, which loads a **whole new document** into the standby
frame and crossfades — so that `body` is new and the flag absent, and it *should* rebind. **That is an
argument from the code path, not a measurement.** Settling it needs a real save, which needs an owner
session; this environment may never create an account, so the rig cannot reach it.

**What would settle it, and it needs Adrian:** on `evergreen-yard-care`, edit a price, let it save,
then edit the SAME price again without reloading. If the second edit opens, the freeform half is
clear and step 4 can finally run. If it does not, the frame is not being replaced the way
`hcRefreshCanvasFrame` implies and the finding is there.

**Step 4 has still never been performed.** Nothing in this repo asserts it.
