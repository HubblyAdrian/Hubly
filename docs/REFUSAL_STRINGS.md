# Refusal strings that misstate their own reason

First inventory 2026-09-08 (23 sites, before the `operations.read` fix).
**Re-measured the same day, after it** — because a refusal that names the wrong cause
and a handler that reads the wrong argument name look identical from outside, and the
question "how many of these are copy, and how many are code" could not be answered
until the code half was closed.

Wording is NOT changed here. The branch split is ruled and happens as one deliberate
pass over whatever survives this measurement.

---

## The re-measure, in one table

| class | sites | argument-name bug | live defect of another kind | wording only |
|---|---|---|---|---|
| A — "No draft business exists yet…" | 10 | **0** | **4** (token-only guard, see below) | 6 |
| B — "No business was specified." | 2 | **1** (`operations.read`, now fixed) | 0 | 1 |
| C — "The Store isn't available…" | 12 | **0** | unknown (see below) | 12 |
| D — accurate | 10 | 0 | 0 | 0 |

**Class B did not collapse entirely — it collapsed by half, and the other half was
never this bug.** `booking.getAvailability` reads `args.businessId` because `booking`
is on the *other* injection branch (`hubly-conversation/index.ts`:
`if (capabilityName === "booking" && businessId)`), which supplies exactly that name.
`scripts/check-draft-arg-name.mjs` check 2 confirmed this structurally across all 13
booking + storefront actions: **0 read the wrong name.** Nothing is broken there, and
changing it to `draftId` would have *created* the bug we were fixing.

`booking` is also allowlisted in the `customer` context only, so an owner in the
dashboard cannot reach `getAvailability` at all — a reachability question, not this one.

---

## Class A — 10 sites, "No draft business exists yet…"

None is an argument-name bug: the checker verified all 10 draft-injected actions read
`args.draftId`. But the guard collapses three conditions into one sentence, and for
four of them the third condition is **live**:

| guard | sites | verdict |
|---|---|---|
| `!draftId \|\| (!draftToken && !ownerId)` | `applyDirectDocumentPatch`, `applyDirectFreeformEdit`, `uploadAndPatchFreeformImage`, `uploadAndPatchDocumentImage`, `business.updateDraft`, `business.setServices` | accepts a verified owner — **wording only** |
| `!draftId \|\| !draftToken` | `website.generateDocument`, `website.newPage`, `website.patchDocument`, `website.setChrome` | **live defect** |

### The four token-only guards are reachable, and they are refusing real owners

Established by trace (`hubly-conversation/index.ts:1093–1111`), not yet by a click:

- The draft predicate was widened on 2026-09-07 to accept **a valid draft token OR a
  server-verified owner of the row**, because a claimed business often has
  `draft_token = null`.
- When it resolves by ownership, it still sets `draftToken: _draftTok`, which is `""`.
- The engine injects that empty string. These four guards test `!draftToken`.
- So a signed-in owner of a claimed business with a null `draft_token` is told
  **"No draft business exists yet"** by generateDocument, newPage, patchDocument and
  setChrome — the same door that was fixed for uploads, still shut for these four.

**Denominator, measured 2026-09-08:** 34 claimed businesses; 9 have a null `draft_token`
— by `account_kind`: market 4 of 9, internal 2 of 3, test 3 of 22. So **4 market owners**
are in this state today.

*This corrects a number in our own comment.* `index.ts:1071` says the null token covers
"9 of 34 claimed rows, **including every real market business**". The 9/34 is right; the
parenthetical is not — it is 4 of 9 market businesses, not all of them.

The fix is the same one already applied to the predicate: accept a verified owner.
It is a code change, not a wording change, and it is listed here only because it has
been hiding behind a wording complaint.

### One string is wrong on its own terms

`website.setChrome` refuses with **"No draft business exists yet to restyle."**
It is **not** a copy-paste from `restyleElement`: that handler's own refusal reads
"Changing how the page looks needs the owner signed in…", and `setChrome`'s is the only
occurrence of "restyle" in a summary anywhere in the file. It is an independent
inaccuracy. `setChrome` changes header layout — logo placement and size, solid vs
transparent bar, nav on/off, book vs call. Telling the owner it cannot "restyle"
points them at the look-and-feel vocabulary, which routes a retry to `restyleElement`
or `setDesignKnob` — two different capabilities that will not touch the header.

(`setDesignKnob` and `restyleElement` both guard on `!draftId || !ownerUid` and are
correct. They are not in the four.)

---

## Class B — 2 sites, "No business was specified."

- **`operations.read` — was the argument-name bug. Fixed 2026-09-08.** It read
  `args.businessId` while sitting on `DRAFT_INJECTED_ACTIONS`, which injects `draftId`.
  The guard fired on every call from the day `operations` shipped (2026-09-05). Observed
  live on an owned business: *"I can't read bookings or customers yet because no business
  is connected to this conversation."* The business was connected, owned, and named in
  the message. Now reads `args.draftId`; held by `check-draft-arg-name.mjs`.
- **`booking.getAvailability` — not this bug.** See above. Its string is a wording
  question only, and only in the case where the public widget genuinely sends no
  `businessId`.

## Class C — `SF_NO_CTX`, 12 call sites

> "The Store isn't available in this conversation yet."

**Not an argument-name bug.** `sfOwnerCtx` reads `args._ownerToken` and `args.businessId`
— exactly the two names the storefront branch injects. The guard is correct; the sentence
is not.

What the sentence does is tell an owner that a built, deployed, working feature does not
exist, because a credential did not arrive. That is the same substitution that made
"not built" our first hypothesis for four working features on 2026-08-31 — we did it to
ourselves then and this does it to owners now. Whether the token actually fails to arrive
in practice is a separate, unmeasured question; the string is wrong either way, because
it describes a product state to explain a plumbing state.

## Class D — accurate, no change

`:493`, `:3943` (`no_business_row`, internal detail strings), `index.ts:1822`
(`no_draft_to_edit`, guarded on exactly `!draftBusiness`), and the seven `no_business`
400s at `index.ts:1640–1806` (same guard). These name their real cause.

---

## What the branch split looks like, for the ruled pass

Each guard already knows which condition failed. Reporting the cheapest one to say is a
choice, and it is always the choice that blames the owner:

- `!draftId` → "there is no business in this conversation yet" — the only owner-caused case.
- `draftId && !draftToken && !ownerId` → an internal error naming the action. It means the
  engine did not hand this action its credentials. Loud, not a sentence the owner reads as
  their own fault.
- Class C → say the credential is missing, never that the Store is unavailable.

## Known gap in the guard

`check-draft-arg-name.mjs` compares `draftId` against `businessId` only. A third injected
name, `_ownerToken` (storefront), is read inside the shared helper `sfOwnerCtx` rather
than in any handler's own literal, so the checker structurally cannot see it. It is
correct today; nothing would report it if it stopped being.
