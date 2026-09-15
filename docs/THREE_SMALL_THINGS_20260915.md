# Three findings from the two-store work — measured 2026-09-15

None of these is big. All three are reported rather than acted on where acting would touch a real
customer.

---

## 1. The junk service row belongs to a REAL business. NOT TOUCHED.

```
service  36c4a8ff-35a4-4520-94ce-40df8b9fd8b6
name     "watch adrian smithe and make sure he is  doing his work"
price    $0            created 2026-09-10 19:26:09
business a138b8bf-7f7d-4fdb-afa3-9f15884db888   slug site-aa7537   name: (none)
owner    aeedb3ec-e57e-43bd-8616-2d9cb048e388   display_name "Skylar Thomas"
kind     market
```

**`account_kind = 'market'`, so it was not deleted.** It is this business's **only** service — the
services list is that one row. The business has 3 document versions and 15 conversation rows, so
it was a real session, and **0 bookings and 0 jobs**, so nothing has been booked through it.

**The identity is ambiguous and I am not resolving it.** There are TWO owner profiles named
Skylar Thomas:

| owner_id | display_name | businesses |
|---|---|---|
| `aeedb3ec…` | Skylar Thomas | `site-aa7537` **[market]** |
| `70399f5d…` | skylar thomas | `lugnutz` **[internal]**, `lugnuts-regulators` [market] |

The second is classified **internal** — somebody we know. If these are the same person, this row
is internal messing-about and deleting it is trivially safe. If they are not, it is a real
outside signup and it is his. **A row is not evidence of a person** (CLAUDE.md), and the
flattering reading here is also the convenient one, so it does not get to be the default.

**Exposure while it stands:** the service is unpriced and the page never names it, so a stranger
reaches it only through the booking wizard. Nobody has.

**What I need to delete it:** Adrian confirming the two Skylars are one person, or confirming
this account is not a market signup.

---

## 2. The double-writer is identified, dated, and ALREADY GONE.

**All 8 duplicate pairs are from 17–18 July, in two bursts, and none since.**

| business | services duplicated | when | gap |
|---|---|---|---|
| `adrians-lawn-service` | 4 | 2026-07-17 18:02:44 | **7.8s** |
| `star-windows` | 4 | 2026-07-18 05:10:20 | **7.7s** |

~90 service rows have been written since (13 on 2026-09-12 alone) with **zero** duplicates.

**The writer: `public/hubly.html`, removed by `b3f12ed` on 2026-07-20** — *"Phase 6 freeze: remove
dual-write after Service Engine audit"*, two days after the second burst. The removed code had
**three insert sites and only one of them deleted first**:

```js
if(svcPayload.length)await db.from('services').insert(svcPayload);          // append — no delete
const {error:svcErr}=await db.from('services').insert(svcPayload);          // append — no delete
await db.from('services').delete().eq('business_id',currentBusiness.id);    // replace-all
if(svcPayload.length)await db.from('services').insert(svcPayload);
```

Two save paths appended **the whole payload**. Two saves ~7.7s apart duplicate every service at
once — which is exactly the signature in the data (the entire list doubled, not individual rows).

**It cannot happen again today.** Both surviving writers —
`set_business_draft_services` (`20260804090000`, and again `20260831070000`) — open with
`delete from services where business_id = p_id;` before inserting. There is no append-only path
to the services table anywhere in the tree; the only remaining `/rest/v1/services` references are
reads.

### THIS MATTERS FOR RULING 1, and it is the reason to say it here

**The Phase 6 freeze removed two things at once:** the dual-write that keeps the stores in sync
(whose absence is Graef's 1-vs-8) **and** the append path that created these duplicates. Lifting
the freeze by restoring a client-side write would bring the second one back with the first.

**The one writer must be replace-all.** `set_business_draft_services` already is. Whatever both
paths are routed through, it must not be a new append.

**No data cleaned.** The duplicates stand; `get_public_business_services` collapses them for the
visitor (checked: all 8 pairs agree exactly on price), which is a safety net, not a fix.

---

## 3. What a rebuild would change, for `larkspur-landscaping`, end to end

Chosen because it is one of the three businesses where booking offers a service the page never
names. **Test business.**

### Today

| | |
|---|---|
| page | 3 versions: v1 `ai` 2026-08-22, v2 `patch` +53s, v3 `patch` 2026-09-13 |
| visible text | v1 1914 · v2 1925 · **v3 1891 chars** — the page's words have barely moved |
| bytes | 25.7KB → 25.7KB → **38.9KB** (+13KB is CSS and markup, **not content**) |
| **service anchors** | **0, on every version.** The page has never carried one |
| page names | "Garden design" — but **not** "Lawn care", **not** "Seasonal cleanups" |
| booking offers | Lawn care $0 · Garden design $0 · Seasonal cleanups $0 |

### After a rebuild

The page would be regenerated from the record, so all three services would appear, anchored, and
the split would close for this business. **Every service is $0, so it would publish three
services with no prices.**

### What it risks — and the first risk is that we are forbidden to do it

**1. PROHIBITION 1 SAYS NO, in as many words.** *"No cleanup, validation, or post-processing pass
may ever cause a second generation… Regenerating to 'fix' what a deterministic pass found is
forbidden — it doubles cost, changes the page out from under the person, and hides the original
defect."* A rebuild to reconcile services is precisely that pass. **This is not a close call, and
it is the answer to "what would a rebuild change": it changes a rule we already decided.**

**2. A rebuild discards every patch, and patches are most of what exists.** Corpus-wide:
**403 of 623 document versions were created by `patch`, 200 by `ai`.** For larkspur that is v2 and
v3 — a word change and a restyle, small; for a business like `crestview-window-cleaning`
(9 versions in 1h44m) it is most of the page.

**3. The obvious alternative does not work here either, and it is worth knowing why.**
`applyServicesToFreeform` inserts services into a live page without regenerating — no second
generation, no lost patches. But `markServiceAnchorsInFreeform` stamps anchors **keyed off the
page's own text**, and larkspur's page never says "Lawn care" or "Seasonal cleanups". There is
nothing to stamp. **That is why the anchor count is 0 and why this business drifted in the first
place.**

### So the honest answer

For larkspur, **neither instrument reconciles the page**: a rebuild is forbidden, and the patch
path needs the service name to already be on the page. The gap is real and the tools to close it
in place do not exist yet.

**What would close it without a regeneration** is an insert path that can ADD a service block to
a freeform page that has no anchor for it — which is a build, not a decision, and it is not
started. Recording it here so the next reader does not rediscover that a rebuild is the only
option and then reach for it.
