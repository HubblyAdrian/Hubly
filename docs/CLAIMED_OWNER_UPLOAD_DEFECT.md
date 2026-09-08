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
