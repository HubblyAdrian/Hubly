# A claimed owner cannot edit their site by talking. Measured by clicking, 2026-09-08.

Found by accident: the `operations.read` measurement printed the injected args, and
`draftToken` came back as the empty string. Four website actions test `!draftToken`
with no ownership branch. This is what that costs.

**Nothing is fixed here.** The guard touches an authorisation check on the write path
for claimed businesses; the measurement comes first.

## D1 — who is in this state

`draft_token IS NULL AND owner_id IS NOT NULL`: **9 businesses** (not 9 guards — each
of these nine hits all four guards).

| account_kind | n | slugs |
|---|---|---|
| market | 4 | `aquaspeed`, `bucket-mobile-detailing`, `devdetailing661`, `graefs-autocare` |
| internal | 2 | `cotter-aviation`, `my-auto-detailing` |
| test | 3 | `adrians-lawn-service`, `my-photography`, `star-windows` |

## D2 — Graef is one of them

`graefs-autocare` — claimed, `draft_token IS NULL`, `account_kind = 'market'`. **Yes.**

## D3 — what the four actions actually do

Run as the signed-in owner (`adriansmithee+evergreen@gmail.com`) against
`graef-d3-clone`: a clone of Graef's row with `draft_token` null, `account_kind='test'`,
`meta.pipeline.manual` (three real customers) stripped, and no operational rows copied.
Graef's own row was never written to; his fingerprint passed before and after. Clone
deleted the same session; corpus back to 179.

| ask | action dispatched | injected | result | string the owner sees |
|---|---|---|---|---|
| "Put my logo in the middle of the header and make it bigger." | `website.setChrome` | `draftId=set`, `draftToken=EMPTY` | `ok=false` | **"I couldn't change the header yet because there isn't a draft site here to edit."** |
| "Change the headline at the top of my page to …" | `website.patchDocument` | `draftId=set`, `draftToken=EMPTY` | `ok=false` | **"I couldn't change it yet because there isn't a draft site connected here."** |
| "Rebuild my whole website page from scratch…" | `website.newPage` | `draftId=set`, `draftToken=EMPTY` | `ok=false` | **"I can rebuild it, but there isn't a draft site connected here yet. Send me your current website link, or tell me the business name and what you do, and I'll start from there."** |
| "Add a new page about our fleet servicing…" | `business.recordFacts` (never reached newPage) | — | `ok=true` | "I can't add a separate new page and menu link yet. The closest real change I can make right now is adding a Fleet Servicing section…" |

**Three of the four refuse on the guard.** The action IS dispatched — so
`HUBLY_DOCUMENT_GENERATION_ENABLED` is on and the feature flag is not the cause; the
guard is. In every case `draftId` is set and `draftToken` is the empty string, which is
exactly what the ownership-resolved branch produces.

### generateDocument is worse than a refusal: it creates a second business

Asked plainly ("Generate my website page now.") the model does not call it at all — it
replies **"Absolutely — what kind of business is it, and what city or area do you
serve?"**, asking an owner for facts already on their own record.

Given those facts, it routed around the dead action by calling `business.startDraft`
first and generating against the NEW draft:

```
business.recordFacts       draftId=MISSING            ok=true
business.startDraft        draftId=MISSING            ok=true
website.generateDocument   draftId=set draftToken=set ok=true   <- a different business
reply: "The page is being generated now…"
```

Confirmed in the table: a new row `graef-s-autocare` appeared, **unclaimed**, with its
own draft token. An owner asking to regenerate their own page gets a duplicate site and
is told it worked. That is the duplicate-site vector (Andres, four builds in forty
minutes) reached through a different door, and it is a false success — prohibition 2.

## D4 — does this explain AI_CANNOT_BUILD.md?

**No. Zero of the fourteen.** Checked against the real registry rather than the
document: 7 capabilities, 28 actions —

```
operations: read
website: analyze, generateDocument, newPage, patchDocument, setChrome, setDesignKnob, restyleElement
online_presence: analyze_facebook, analyze_instagram, analyze_google_business
booking: getAvailability, create
business: startDraft, updateDraft, setServices
places: add
storefront: (11 actions)
```

No action name matches any of the fourteen content types (why-cards, FAQ, social links,
memberships, trust pills, gallery albums, Our Story, deposit terms, booking wizard,
per-vehicle pricing, service `includes`, per-service photos, owner photo, service-area
radius, manual reviews). The document's central claim — no action AND, for twelve of
them, no field on `BusinessRecord` — is independently confirmed. It is an inventory
gap, and the guard is a separate, additive defect.

Two corrections to that document, neither affecting its conclusion:

1. Its header says "the registry: 5 capabilities, 16 actions". It is now **7 and 28**
   (`places`, `operations` and `storefront` since). The fourteen are unchanged.
2. Its closing claim — "Graef is the proof… he entered by hand exactly the twelve things
   the generator cannot conceive of" — now has a competing explanation for part of it.
   Graef is in the D1 set, so the assistant's four general editing actions have been
   refusing him. Whether he hand-built because the generator lacked the concepts, or
   because the assistant refused him generally, or both, is **not established** — it is a
   hypothesis and should not be written down as a finding.

Adjacent, unfixed: `set_business_hours_in_progress` exists and is called from two places
in the registry, but no capability ACTION writes hours. That is a missing door, not a
missing feature — the shape the document's own "cheapest fix" note predicts.

## The fix, when it is ruled

Same shape as the branch split in `docs/REFUSAL_STRINGS.md`: where a token is absent,
accept the server-verified owner, exactly as the draft predicate at
`hubly-conversation/index.ts:1093` already does and as the six sibling guards
(`applyDirectDocumentPatch`, `applyDirectFreeformEdit`, the two image uploads,
`business.updateDraft`, `business.setServices`) already do. The four are the ones that
were not updated when the predicate was widened on 2026-09-07.

---

# E1 — forensics before the fix (2026-09-08)

Run BEFORE widening the guards, because the fix destroys the evidence: once
`generateDocument` works on the bound business, the route-around stops happening and a
shadow row can no longer be distinguished from an ordinary draft.

**Nothing found that this path can explain. Nothing deleted.**

| net | shadows | window |
|---|---|---|
| identical normalised NAME, claimed parent + unclaimed shadow with a token | 7 | 2026-08-10 → 2026-08-23 |
| normalised SLUG prefix (the `graefs-autocare` / `graef-s-autocare` shape) | 9 | 2026-08-10 → 2026-08-28 |

Shadows: `bucket-mobile-detailing-09616`, `bucket-mobile-detailing-55e3c`,
`detailing-chemicals-equipment-courses-1c692`, `mobile-detailing-in-lehi`,
`mobile-detailing-in-lehi-849a2`, `mobile-detailing-in-lehi-5410f`,
`mobile-detailing-in-lehi-f207e`, plus `mobile-detailing-company` and
`window-washing-company` on the wider net (prefix hits on the generic claimed slugs
`mobile-detailing` / `window-washing`; probably coincidence, listed anyway).

All 7 carry generated documents. Rows created after 2026-09-07 with no owner: exactly one,
`photography-website`, which namesake-matches nothing claimed.

**None of them can be this vector.** The route-around needs a conversation BOUND to a claimed
business, which only became possible in `b0f26fe` (2026-09-07). Every shadow predates it by
two to four weeks, and the four-row `mobile-detailing-in-lehi` cluster on 2026-08-22/23 matches
the recorded Andres home-input duplicate incident by date and shape.

What is stated: dates and shapes. What is NOT stated: provenance. The nine remain listed and
untouched.

**Are they publicly reachable or indexable? No — three layers.** `get_public_business` carries
`owner_id is not null -- a public address requires an owner`, so an unclaimed draft returns
nothing to an anonymous caller: the page is dead to a stranger, not merely unindexed. On top,
`hcNoIndex()` stamps `noindex, nofollow` when `owner_id` is null AND again when
`account_kind === 'test'`. All nine are unclaimed and all nine are `test`. Bucket does not have
duplicate copies of his site competing with him in search.

## The irony, recorded

**`b0f26fe` is what opened this door.** Widening the draft predicate so a claimed owner could
upload also BOUND the conversation to a claimed business — and that binding is precisely what
makes the route-around reachable. A fix created the hazard. One day of exposure, zero real
instances.

And the only reason we found it in a day is that a measurement for an unrelated question
(`operations.read` reading the wrong argument name) printed the injected args, and `draftToken`
came back as the empty string. Nobody was looking for this. **That is the argument for printing
the injected args**: the action log is the only surface where a structural value the model never
sees becomes visible, and it is where two separate defects surfaced in one session.

---

# E2/E4/E5 — the widening, and what it was proved against (2026-09-08)

Four guards changed from `!draftId || !draftToken` to `!draftId || (!draftToken && !ownerUid)`:
`runDocumentGeneration`, `website.newPage`, `website.patchDocument`, `website.setChrome`.
Token-only guards remaining in the file: **0**.

All four already threaded `ownerUid` into their downstream `create_business_document` /
`patch_business_in_progress` calls as `p_owner_id`. The write path was already owner-authorised;
only the entry guard was not. `deno check`: 18 errors before and 18 after — the pre-existing
baseline, no new error kinds.

**Authorisation, exactly.** Presence of a uid is not the test at any layer:
1. `ownerUid` is set only by the engine, from `getOwnerUid()` → `resolveOwnerUid()` → the
   caller's JWT resolved against `/auth/v1/user`. A client cannot assert it.
2. `draftId` only reaches the handler when `draftBusiness` resolved, which requires a valid
   draft token OR `ownsBusiness(id, uid)` — a service-role re-read of `businesses.owner_id`.
3. The RPC re-checks `owner_id = p_owner_id` in SQL.

## Red-proofs, clicked as the signed-in owner

| case | result |
|---|---|
| **Non-owner**, signed in, naming a claimed business they do not own (`clearwater-kayak-rentals`) | **REFUSED.** `ok=false`. The engine never injected: `draftToken` and `ownerUid` absent, and `draftId` was the model's own placeholder string `"current"`, not the real uuid. `draftBusiness` echoed back null. The write path is not open. |
| **Unbound conversation → `startDraft`** (the signup path) | **WORKS, unchanged.** Created `northgate-gutter-cleaning` with a token. |
| **Owner editing a draft that HAS a token** | **WORKS, unchanged.** `website.setChrome ok=true real=true` — "Saved — the logo will sit centered and larger when the page is built." |
| **Owner of a claimed business with a NULL token** | **NOW WORKS.** See below. |

## E5 — the same four asks from D3, re-clicked on a Graef clone

| ask | before (D3) | after |
|---|---|---|
| logo to the middle | `setChrome ok=false` — "there isn't a draft site here to edit" | **`setChrome ok=true real=true`** — "Saved — I'll use that when I build the page." |
| change the headline | `patchDocument ok=false` — "there isn't a draft site connected here" | `patchDocument ok=false` — **"there isn't a page to edit yet"**. Guard PASSED; this is the `no_document` check behind it. Graef is the archetype-renderer case with no `business_documents` row, so this is correct and honestly worded. |
| rebuild my page | `newPage ok=false` — "there isn't a draft site connected here yet" | **`newPage ok=true real=true`** — "Here's a completely new page: https://graef-e5-clone.myhubly.app" — **his own site.** |
| generate my page | model asked "what kind of business is it" | unchanged — still asks. See below. |

**Business count: 181 before, 181 after.** The page landed on the clone itself
(`business_documents`: 1 row, version 1). No second business. The route-around did not fire,
because the action it was routing around now works.

Clone deleted the same session; corpus back to 179. Graef's own row never written; his
fingerprint passed before and after (162 text runs, 8 links, 8 services, 5 why cards, 2 trust
pills, 2 membership cards, 2 reviews, 2 social icons).

## Still open after this

1. **`generateDocument` on a bare "generate my page" still asks the owner what business it is**
   — `actions: []`, no capability called. Unchanged by this fix and NOT the guard: it is the
   "never ask for what you were told" defect. The facts are on the record and it asks anyway.
2. **E3, the duplicate-site guard, is NOT built** — see below. The widening removes the
   *trigger* (the edit no longer fails, so the model has nothing to route around) but not the
   *hazard*: `business.startDraft` is still callable in a conversation bound to a business the
   user owns.

## E3 — why this was not built, and the design question

The proposed guard was "startDraft refuses when it follows a refused edit in the same turn."
**That would not have caught the reproduction.** Re-reading the D3 trace: it was a single
message and the actions were `recordFacts | startDraft | generateDocument` — there was no
refused edit in that turn. The model simply preferred `startDraft`. The signal is not there.

Nor can "owner wants a second business" be separated from "model routed around a failure" by
structural signals at the dispatch layer, because in the failing case the model never announces
which it is doing. A guard that counted businesses would break the detailer who also runs a
window-washing company — a worse bug than the one it fixes.

**Recommended shape, pending a ruling:** when the conversation is bound to a business this user
verifiably owns, `startDraft` requires `confirm: true`. The first call returns "you already have
<name> here; do you want a second, separate business?", and only an explicit yes creates it.
This is the protocol `website.newPage` already uses before a destructive rebuild, so it is the
codebase's own precedent rather than a new mechanism, and it decides intent by ASKING the owner
instead of inferring it. Its limitation is real and should be stated when it ships: it rests on
the model honouring the confirm handshake.

Whatever shape is chosen needs a red-proof both ways — the deliberate second business still
works, and the route-around is blocked.
