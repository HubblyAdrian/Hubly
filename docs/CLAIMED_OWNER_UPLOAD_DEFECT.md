# A CLAIMED OWNER CANNOT UPLOAD A LOGO BY TALKING — observed, 2026-09-07

**Reproduced on a clone of Graef's record** (`graef-clone4-2026-09-08`, claimed, `draft_token`
NULL — confirmed identical to `graefs-autocare` before anything was tried; clone deleted after).

## What the owner gets

| action | result |
| --- | --- |
| **Logo upload** (chat) | `setLogo` → `ok:false, real:false`. Reply: **"I can't attach the logo yet because there isn't a business draft to put it on."** |
| **Hero image** (chat) | **HTTP 400**, body `{"ok":false,"error":"no_draft_to_edit"}`. No reply at all — a raw error code. |
| **Logo & brand panel** (website editor) | **WORKS** — writes `logo_url` via `dbClient.from('businesses').update(...)`, a direct table write under the user's JWT and RLS. **It never touches the RPC.** |

> **The owner's experience depends on which button they press.** The same intent — "change my
> logo" — succeeds in the editor and fails in the chat with a sentence that contradicts what they
> can see: they have a live website, and Hubly says there is no business.

**Live for every real market business:** `graefs-autocare`, `bucket-mobile-detailing`,
`aquaspeed`, `devdetailing661` — the 4 market businesses among the 9 claimed rows whose
`draft_token` is NULL.

## One cause, not two — `hubly-conversation/index.ts:1030`

```js
let draftBusiness = body?.draftBusiness && typeof body.draftBusiness === "object" &&
  body.draftBusiness.id && body.draftBusiness.draftToken && body.draftBusiness.slug
    ? { id, slug, draftToken, url } : null;
```

**`draftBusiness` is null unless `draftToken` is truthy.** A claimed business has none, so:

- the `directImageEdit` branch hits `if (!draftBusiness) return 400 no_draft_to_edit`;
- the logo branch calls `uploadDraftLogo(draftBusiness?.id || "", draftBusiness?.draftToken || "", …)`,
  whose own first line is `if (!draftId || !draftToken) return "No draft business exists yet…"`.

The comment directly above calls it *"the real, **unclaimed** businesses row"* — the concept
predates claiming, and nothing widened it when claiming arrived. **This is deeper than the
`p_owner_id` gap:** those calls never even reach an RPC.

## The fix — designed, NOT built

**Adrian's read is right and I cannot find a reason the guard must stay.** A draft token
authorises an unclaimed draft; **ownership is strictly stronger**, the RPCs already accept either
(`owner_id is null → token, else → p_owner_id`), and after today's D3 work `p_owner_id` is
threaded through every one of them.

```js
//                                     ↓ either credential, not the token alone
body.draftBusiness.id && body.draftBusiness.slug &&
  (body.draftBusiness.draftToken || await getOwnerUid())
```

**Three things the implementation has to get right:**

1. **Ordering.** `getOwnerUid()` is resolved *after* this block today (its own comment says so).
   The predicate needs the uid, so the resolve moves above — it is memoised, one call per turn.
2. **`draftToken` becomes optional downstream.** `uploadDraftLogo` and `uploadDraftHeroImage`
   both open with `if (!draftId || !draftToken)`. That must become
   `if (!draftId || (!draftToken && !ownerUid))` — the same shape `applyExtractedFacts:848`
   already uses. **`uploadDraftHeroImage` gained its `ownerUid` parameter in today's D3 work**, so
   both now have one.
3. **The refusal message must stop lying.** "There isn't a business draft to put it on" is wrong
   for an owner with a live site. If the write genuinely cannot proceed, say which credential was
   missing — never a sentence that contradicts the page they are looking at.

**Verification when it is built:** the same clone, the same two requests, both returning `ok:true`
with the logo actually on the record — and the editor path re-checked, because a fix that makes
the chat work and breaks the panel has moved the defect rather than closed it.


---

# FIXED AND VERIFIED — 2026-09-07

## Where the authorisation check lives — before the branch, not inside it

`hubly-conversation/index.ts`, in the block that builds `draftBusiness`, which every branch reads.
The predicate is now:

```
_draftIdsPresent && (_draftTok || _verifiedOwnerOfDraft)
```

`_verifiedOwnerOfDraft` is computed **only** when ids are present and there is no token, and it is
two server-side steps, **neither client-supplied**:

1. `getOwnerUid()` → `resolveOwnerUid()` resolves the caller's `Authorization` JWT against
   `/auth/v1/user`. A client cannot assert a uid; a publishable key returns null (not a JWT).
2. `ownsBusiness(id, uid)` re-reads `businesses.owner_id` **through the service role** and compares
   it to that verified uid.

**Presence of a uid is explicitly not the test.** `getOwnerUid` moved above the predicate to make
this possible; the ownership read runs only on the claimed path, so anonymous and unclaimed-draft
traffic pays nothing.

## The second cause, which the predicate fix alone did not solve

After widening the gate the hero reached the write and still failed. Measured the RPC directly:

| `p_draft_token` | result |
| --- | --- |
| `NULL` + correct owner | **`ok: true`** |
| `''` (what the code sent) | **`ERROR 22P02: invalid input syntax for type uuid`** |

An empty string **aborts the whole call before any authorisation runs** — which is why the caller
reported "the draft may have already been claimed" for a business that is simply claimed. Fixed as
a class: **all 31** `p_draft_token: draftToken` sites now send `draftToken || null`.

## The four verifications, on a clone in Graef's exact state

| # | test | result |
| --- | --- | --- |
| 1 | **Logo via chat** | `setLogo ok:true, real:true` — *"Your logo is saved."* Record carries `logo-1788833256712.png` |
| 2 | **Hero via chat** | `setHeroImage ok:true, real:true` — *"Done — that's your new header image."* Record carries `hero-1788833261930.png` |
| 3 | **Logo via the editor panel** | **still works** — column and `meta.logoUrl` both updated by `saveStorefront` |
| 4 | **A business the owner does NOT own** | **refused.** Logo: *"I couldn't attach that logo — this needs a draft in progress, or you signed in as the owner of this business."* Hero: **HTTP 400**. **And Graef's real record was re-read afterwards: untouched**, still his July assets |

**Gate:** `check-graefs-page.mjs --slug graefs-autocare` → **PASS**, 162 text runs / 8 links /
8 services / 5 why cards / 2 trust pills / 2 membership cards / 2 reviews / 2 social icons.
Clone deleted; zero remain.

## A NEW finding, seen while running test 3 — not fixed

When the editor loaded, `S.logoUrl` was the **old** logo, not the one the chat had just written.
The editor resolves via `resolveBrandCol(S.logoUrl, currentBusiness.logo_url, priorMeta?.logoUrl)`
and prefers **`meta.logoUrl`**; the chat's `patch_business_in_progress` writes the **`logo_url`
column**. So:

> **A logo set by talking does not appear in the editor, and the next editor save writes the stale
> `meta.logoUrl` back over the column — silently undoing it.**

Same two-homes shape as services (`meta.service_catalog` vs the `services` table) and the shadowed
`meta.logoUrl` from the image migration. **Not fixed here** — it is a separate change and this one
was scoped to the upload paths. Filed so it is not rediscovered by an owner.


---

# THE TWO-HOMES TRAP — CLOSED, verified by the sequence

The upload fix was a trap without this: the owner heard *"your logo is saved"* and the next
editor save silently restored the old one. **A confirmation followed by a quiet revert is worse
than the refusal it replaced.**

## It took three attempts, and only step 3 ever showed the truth

| attempt | what it fixed | what step 3 said |
| --- | --- | --- |
| 1. RPC mirrors `logo_url`/`banner_url` into `meta` | the two homes agree at write time | **still reverted** — the overwrite comes from a stale CLIENT, not from the resolver choosing the wrong home |
| 2. Omit the brand COLUMN when the session never changed it | column survives | **revert moved to `meta`** — `buildPersistableBizMeta` writes the whole meta from the same stale `S.logoUrl`, and the public page renders from meta |
| 3. Re-read the row before the save and adopt what this session did not change | both | **PASS** |

**Writing both homes and checking the row proved nothing**, exactly as predicted. Each time, the
row looked half-right and would have read as progress if step 3 had checked only the home that
was fixed.

## And attempt 3 silently did nothing at first

`brandUnchanged` was declared **50 lines below** the refresh block that called it — a
`ReferenceError` from the temporal dead zone on every save, **swallowed by the refresh block's own
`try/catch`.** The row looked exactly as it had after attempt 2. Declaration hoisted; the catch is
now `console.error` plus a toast naming the consequence.

> **A catch that hides the failure of the thing it wraps is the same silent-failure defect the
> change exists to close** — written an hour after recording that rule.

## The verified sequence

1. Logo set **by chat** → `setLogo ok:true`
2. **Unrelated** editor save (FAQ title) in the same already-loaded tab
3. Read back:

```
column_logo         .../logo-1788836286097.png    column_has_chat_logo: true
meta_logo           .../logo-1788836286097.png    meta_has_chat_logo:   true
homes_in_sync       true
unrelated_saved     "FAQ (unrelated edit)"
```

**Gate:** `check-graefs-page.mjs --slug graefs-autocare` → **PASS**. Clone deleted, 0 remain,
179 businesses intact.

## STILL FILED, NOT DONE

Neither change fixes **having** two homes. `businesses.logo_url` and `meta.logoUrl` are still the
same fact stored twice, kept in step by an RPC mirror and a pre-save refresh. **The real fix is
one resolver both paths call — the #54 job, same shape as `meta.service_catalog` vs the `services`
table.** Recorded here so this is not mistaken for closed.
