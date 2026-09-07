# THREE FINDINGS FROM THE CLICK-THROUGH — by severity, with root causes

All three found by clicking a clone of Graef's record on 2026-09-07. Clone deleted the same
session. Root causes traced afterwards in code. **None of them is NO_DOC-specific; all three are
broken for everyone.**

---

# #1 — SEVERE: an owner's words, shown on screen, published, and never stored

Typed `TESTEDIT1` into a service's Short description → panel Save → **Save & publish**.
The preview rendered it. The publish rewrote `service_catalog.updated_at`.
**The string is absent from `meta` and absent from the public page after a full reload.**

## Root cause: one fact stored in two fields, and the empty one wins

Hydration writes the description **twice** (`public/hubly.html:14620–14621`):

```js
desc:        s.description || '',
description: s.description || '',
```

For any service with no description, **both become `''`**. The inline panel writes the owner's
typed text to **`desc`** only. Then `buildServiceCatalogFromEditor` (`:14743`) rebuilds the
catalog with:

```js
description: s.description != null ? String(s.description) : (s.desc != null ? String(s.desc) : null)
```

`s.description` is `''`. **`'' != null` is TRUE**, so the empty string wins and `s.desc` — the
owner's words — is never read. The fallback exists, and a `!= null` test makes it unreachable
exactly when it is needed.

## Does the same gap swallow other fields? YES — one more, and the count is small but exact

Grepped the whole catalog builder (`:14667–14772`) for the `A != null ? A : (B != null ? B)` shape:

| site | field | affected |
| --- | --- | --- |
| `:14743` | **service `description`** | **YES** — proven by clicking |
| `:14689` | **add-on `description`** (`pushAddon`) | **YES** — identical code, identical hydration (`:14658` `desc:a.description\|\|''`) |

**Two instances, both `description`.** Every other field in the builder reads a single source
(`name`, `varPrices`, `includes` via `getSvcIncludes`, `photos`, `flags`, `payment`, `ai`), so
this is a description-specific defect, not a systemic one — **but it is present on both the
service panel and the add-on panel**, and the add-on half has not been clicked yet.

**Fix shape:** the pair should not exist. One field, or a truthiness test (`s.desc || s.description || null`)
— and hydration should stop writing the same fact to two keys. This is the two-homes defect
*inside a single object*.

---

# #2 — MEDIUM, and NOT what I first reported: nothing visitor-facing loses images today

`meta.portfolioUrls` went **26 → 16** on the first editor save.

## What reads it? Measured, because that decides the priority.

| reader | line | visitor-facing? |
| --- | --- | --- |
| `port.innerHTML = portfolioUrls.slice(0,6)` | `hubly.html:29720` | **YES — but only the first 6** |
| banner fallback `meta.portfolioUrls[0]` | `:19040` | yes, first item only |
| banner re-pick | `:26727` | yes, from the surviving list |
| package image default `ownerPhotos[i]` | `:24902` | editor-side default |
| `renderPortGrid` / `renderObPhotoGrid` | `:29373`, `:28636` | **editor only** |

**The gallery a visitor scrolls renders from `galleryAlbums`, not from `portfolioUrls`**
(`:27028`, `:30712`). Truncation keeps the *first* 16, so the first 6 — the only ones shown — are
untouched.

> **Verdict: no live harm to Graef today.** `portfolioUrls` is a stale, lossy mirror of the album
> images. **The right fix is to stop writing the duplicate, not to raise the cap.**

## But the same function has a cap that IS live harm, and he is sitting on it

`slimBizPayload` (`hubly.html:19021`) truncates on every save:

```js
meta.portfolioUrls          = ….slice(0, 16);
meta.website.galleryAlbums[].urls = ….slice(0, 12);   // ← per album
```

**Graef's Interior album holds exactly 12. His Exterior album holds exactly 12.** Albums *are*
visitor-facing. **The next photo he adds to either album is silently discarded on save** — no
error, no toast, and invisible to `check-graefs-page.mjs`, which counts text runs.

**That is the finding worth acting on**, and it was found only because the truncation next door
led here. Priority sits with the **12-per-album cap**, not with the mirror.

---

# #3 — SHIPPED FABRICATION: "HUBLY MAY SUGGEST, HUBLY MAY NOT MANUFACTURE A FACT"

On the Reviews dashboard of a business created that morning with **2 manual reviews**.
Every number, with the row it comes from — `public/journey-os/journey.js`:

| shown | source | verdict |
| --- | --- | --- |
| Overall Rating **5.0** | `Math.round((sum/count)*10)/10` over real review rows | **REAL** |
| **2 Reviews** | `count` | **REAL** |
| New Reviews **2** This Month | `newMo`, computed from row dates | **REAL** |
| Response Rate **0%** | `Math.round((replied/count)*100)` | **REAL** |
| 5-star % | `fiveStarPct` | **REAL** |
| **Average 1.8 Hours** | `avgResponseHours: 1.8` — **a hardcoded literal** (`:4113`) | **FABRICATED** |
| **+0.2 This Month** | `ratingDelta: 0.2` — **hardcoded** (`:4114`) | **FABRICATED** |
| **+42%** | `newDeltaPct: 42` — **hardcoded** (`:4115`) | **FABRICATED** |
| **"quality of work (95%), punctuality (92%), and communication (90%). Strengths: professional service, attention to detail, easy booking. Opportunity: respond faster to 4-star reviews…"** | `buildReviewsAiSummary()` (`:4117`) **returns a CONSTANT STRING** for any non-empty review list | **FABRICATED** |

**Four invented figures and one constant sentence presented as analysis** — under an "AI" avatar,
so the owner reads it as their reviews having been read. It is not AI output at all.

**Per the standing rule: anything that cannot name a row gets DELETED, not softened.**
- Delete `avgResponseHours`, `ratingDelta`, `newDeltaPct` and the three tiles/deltas that render them.
- Delete `buildReviewsAiSummary`'s constant branch. If a real summary is wanted later it must be
  generated from the actual review text and say so; until then the panel shows nothing, which is
  honest.
- The no-reviews branch (*"No reviews yet — request feedback after completed jobs"*) is fine and
  should stay.

**Deploy path:** `public/journey-os/journey.js` is client code — it goes live **only** via a git
push to Vercel. Nothing here is deployed yet.


---

# ALL THREE FIXED AND VERIFIED — 2026-09-07

**Order note, stated because it changed:** `public/` ships **only** via a git push to Vercel, so
the browser could not see these fixes before the push. Verification was split rather than faked:
**logic** verified pre-push against Graef's real exported record, **integration** verified
post-push on a clone (`graef-clone3-2026-09-07`, deleted the same session).

## Pre-push, logic (`scripts/lift-editor-fixes.mjs` + `scripts/verify-editor-fixes.mjs`)

The functions under test are lifted **verbatim out of `public/hubly.html` at run time**, so the
verifier cannot drift from what ships. **13 checks, all passing.** And the old expression was
lifted out of `HEAD^` and run against the same cases — **it fails both**, returning `""` where
the owner's words should be and `"OLD TEXT"` when the owner clears the field. **The shipped code
could neither save a description nor clear one.** The fix is not a no-op.

## Post-push, on the clone

| fix | check | result |
| --- | --- | --- |
| **F1** | type `F1PROOF` → panel Save → publish | `_serviceCatalog` carries it (before: stayed `""`) |
| **F1** | → the **record** | `description: "F1PROOF"` |
| **F1** | → **full page reload** | field rehydrates as `F1PROOF` |
| **F1** | → **CLEAR it** → save → publish | record is `""` — **not resurrected.** The bug a truthiness fix would have introduced is not there |
| **F2** | `portfolioUrls` after three publishes | **26** (both earlier clones dropped to 16 on their first publish) |
| **F2** | Interior album pushed to **13** → save | record: `Interior=13` — the old cap would have dropped the 13th |
| **F2** | → the **public page** | **27 gallery `<img>` elements** (13+12+1+1), **0 broken** |
| **F3** | live Reviews dashboard, string check | `quality of work (95%)`, `1.8 Hours`, `+42%`, `+0.2` — **all four absent** |
| **F3** | **looked at the screen** | **FAILED FIRST TIME — see below** |

## F3's deletion left a hole, and only looking found it

With the canned sentence returning `''`, the dashboard rendered **a bordered container with an AI
avatar, an "AI Reputation Summary" heading and two buttons standing over nothing.** The string
check had already passed; it said nothing about the hole. Fixed by making the **whole `<section>`**
conditional, not the paragraph inside it — when there is nothing true to say, the section does not
exist.

> **"The fabrication is gone" and "the screen still looks right" are two checks, and the first one
> passing is what makes it tempting to skip the second.**

## The toast: verified at the logic level, NOT in the product

The new ceilings are 200/100 and nobody uploads 101 photos to an album, so the notification path
cannot be reached by clicking. The harness **can** construct it, and does: exceeding both ceilings
produces exactly one message naming the counts and the album —

> `Saved — but 3 portfolio photos and 2 photos from "Interior" couldn't be included. Remove a few and save again to keep the rest.`

**What remains unverified is whether `toast()` renders that in the app.** `toast` is an existing,
widely-used function, but that is a reason to expect it to work, not evidence that it does.
**Recorded as UNTESTED-IN-PRODUCT**, per the rule: an unclickable control is untested, never
working — including when the control is my own fix.

## The last gate

```
node scripts/check-graefs-page.mjs --slug graefs-autocare
PASS — graefs-autocare: 162 text runs, 8 links, 8 services, 5 why cards,
       2 trust pills, 2 membership cards, 2 reviews, 2 social icons — all match the baseline.
```

**The working tree carrying all three fixes renders Graef's real page identically to its
baseline.** `hubly.html` ships to every owner including him; his page is unchanged.
