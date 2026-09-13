# Wiring the assistant to the classic store — costed (2026-09-13)

**Not built. One thing in it needs your word before I write it: a second backend object.**

## The gap, exactly

`setServices` writes `set_business_draft_services` → the relational **`services` table**.
A classic business's page renders **`businesses.meta.service_catalog`**. Nothing the assistant
can call writes that: `service_engine.ts` is its only writer, and it is imported by
`marketplace`, `chatbot-message`, `booking_job`, `marketplace_match` and the context loader —
**not by `hubly_capability_registry.ts` or `hubly-conversation`.**

## What already exists and does the hard part

| function | what it does |
|---|---|
| `getCatalog(business)` | reads the catalogue off a `businesses` row, migrating legacy mirrors on read |
| `catalogFromOwnerServicesPayload(servicesIn, priorCatalog)` | builds a catalogue from an owner payload, **preserving prior services by id** and registering nested addons |
| `buildCatalogWritePayload(catalog, priorMeta)` | returns the whole `meta` object to persist, stamping `version`, `currency`, `updated_at` |

**The merge semantics we need are already written**, including id preservation — which is the
"additive, existing entries survive" requirement.

## The one thing that does not exist — and it is a second backend object

**No writer can persist `meta.service_catalog`.** `patch_business_in_progress` takes
`p_website_meta` and merges it into **`meta.website` only** (`jsonb_set(v_meta,'{website}',…)`).
There is no path to `meta.service_catalog`.

Two options:

| | shape | risk |
|---|---|---|
| **(a) extend `patch_business_in_progress`** | add a parameter → **drop-and-recreate** of a security-definer function with 31 call sites | **the most dangerous migration shape**, against a ledger with 56 unrecorded files |
| **(b) NEW `set_business_service_catalog(p_business_id, p_owner_id, p_catalog jsonb, p_draft_token uuid)`** | pure add, security definer, same owner/draft-token predicate as `set_business_hours` | **new object only** — no table change, no drop, nothing existing altered |

**Recommend (b).** Same reasoning that made `get_business_jobs` safe.

## Full cost

| item | size | migration |
|---|---|---|
| `set_business_service_catalog` RPC | ~40 lines SQL | **1, pure add** |
| `setServices` branches on store: document ⇒ existing path · no document ⇒ catalogue path | ~50 lines, `hubly_capability_registry.ts` | — |
| import the three `service_engine` functions into the registry | 1 line | — |
| a `classic_placed` status so the reply says it IS on the site | ~10 lines, `hubly_owner_replies.ts` | — |
| **the classic fixture** | **done — `hubly-classic-fixture`** | — |

**~100 lines across two files, one pure-add migration.**

## The decision point, named by store and not by guessing

```
setServices
  └── selectLatestBusinessDocument(businessId, "website")
        ├── a document exists  → applyServicesToFreeform   (today's path, unchanged)
        └── no document        → getCatalog → catalogFromOwnerServicesPayload
                                  → buildCatalogWritePayload → set_business_service_catalog
```

The same predicate every other writer already uses. **No branch on "is this a storefront"**
(SETTLED #1) and no guess: the store is read, not inferred.

## Proof plan, before and after, against the fixture only

1. `hubly-classic-fixture` starts with **2 services and 1 addon** in `meta.service_catalog`.
2. Add one service through the assistant path.
3. **Both original services must still be present, by id** — `svc-fixture-1`, `svc-fixture-2` —
   and the addon with them. **Diff in both directions: nothing lost, exactly one gained.**
4. Render the page in a browser before and after; the new card appears, the existing two do not
   move or change.
5. `graefs-autocare` is **read-only throughout**. Nothing is written to his record, ever.
