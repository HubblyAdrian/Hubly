# THE `p_owner_id` INVARIANT IS ENFORCED AT ONE RPC AND ABSENT AT THREE

**Correcting myself first:** the rail spec said *"five live writers already lack it."* I took that
from a scar note and **repeated a remembered count instead of re-running it** — the exact failure
that note itself records (*"I wrote 'five siblings'; brace-matching every payload found eight"*).
Re-measured below by parsing every call site.

## The shape of the gap

**Four RPCs authorise a claimed business by `p_owner_id`:**
`create_business_document`, `patch_business_in_progress`, `set_business_hours_in_progress`,
`set_business_draft_services`.

**Both enforcement mechanisms cover exactly one of them:**

| mechanism | covers |
| --- | --- |
| the runtime throw in `callBusinessRpc` | `if (fn === "create_business_document" && !("p_owner_id" in payload)) throw` |
| `scripts/check-owner-id-invariant.mjs` | `create_business_document` payloads only |

**So the invariant is enforced at one layer and absent at the others — which is the lesson we
recorded, and we are sitting inside it.** It is a scanner gap, not a different class.

## How big — parsed, 38 call sites

`create_business_document`: **21 live call sites, all pass it.** The three apparent misses are the
scanner's own source (`check-owner-id-invariant.mjs:99,105`) and two comments
(`registry:810`, `hubly-conversation:1357`) — my matcher counts strings, so each was read.
One real one: `scripts/rerender-business-document.ts:162`, a maintenance script, not a live path.

`set_business_hours_in_progress` (2 sites) and `set_business_draft_services` (1 site): **all pass
it. Clean.**

**`patch_business_in_progress` — 5 sites omit it. Two are legitimate, four are live gaps:**

| site | what it does | verdict |
| --- | --- | --- |
| `registry:2844` | `uploadDraftLogo` → `logo_url` | **DEAD for a claimed owner** |
| `registry:4382` | `uploadDraftHeroImage` → `banner_url`, `header_mode` | **DEAD for a claimed owner** |
| `registry:5334` | `setChrome` → header preference | **DEAD for a claimed owner** |
| `registry:4778` | freeform chrome/shape | **DEAD, and worse — see below** |
| `registry:5974` | inside `startDraft`, creating the row | **legitimate** — pre-claim by construction |
| `claim-draft-business/index.ts:171` | the claim itself | **legitimate** — pre-claim by construction |

**Why "dead" is a measurement, not an inference** — the RPC body
(`20260902000000_patch_business_hours_note.sql`):

```sql
else
  if p_owner_id is null or v_row.owner_id is distinct from p_owner_id then
    return jsonb_build_object('ok', false);
  end if;
```

Claimed + no `p_owner_id` → **`ok:false`**, and it *returns* rather than throwing, so the caller
reports *"the draft may have already been claimed"* — a sentence that fits every cause equally.
Exactly #20, in a different RPC.

### A second defect at `registry:4778`, found on the way

That call passes **`p_business_id`**. The function's parameters are
`p_id, p_draft_token, p_patch, p_website_meta, p_owner_id` — **there is no `p_business_id`**, so
PostgREST cannot resolve the overload and the call fails for *every* business, claimed or not.
It is wrapped in a `try/catch` that only `console.error`s, and the message already says *"page is
live and correct, the decision was not recorded"* — so the symptom was known and the cause was
not. **This call has never worked.**

## What to do (not done here — this is the report)

1. **Move the guard from a name check to the set.** `callBusinessRpc` should throw for any RPC in
   `{create_business_document, patch_business_in_progress, set_business_hours_in_progress,
   set_business_draft_services}` missing `p_owner_id`. One line, closes the class.
2. **Widen `check-owner-id-invariant.mjs` to the same set**, so it fails the build rather than
   waiting for a claimed owner to find it.
3. **Fix the four live sites** — thread the verified uid, or pass `p_owner_id: null` with a
   comment saying why the path is pre-claim.
4. **Fix `p_business_id` → `p_id` at `:4778`.**
5. **Verify as an owner on a clone**, not by reading — a claimed owner uploading a logo is the
   test, and it is precisely the state no test in this repo exercises.

**And the rail spec's `add_business_place` inherits rule 1 rather than repeating the mistake:
`p_owner_id` non-optional, enforced at the choke point, covered by the scanner from day one.**
