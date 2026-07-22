# BLOCKER 3A — `Business not found` root cause

**Date:** 2026-07-22T22:30:00Z  
**Status:** Root cause identified → fix in `supabase/functions/_shared/supabase_admin.ts`

## Symptom

`POST /functions/v1/create-booking-checkout` with a valid `business_id` (Aquaspeed / Devdetailing661) returned:

```json
{"error":"Business not found"}
```

HTTP **404**, before the Stripe Connect `not_ready` check.

Anon REST `GET /rest/v1/businesses?id=eq.…` returned the same rows (**200**). So this was **not** missing data, slug routing, or publish state.

## Ruled out

| Hypothesis | Evidence |
|---|---|
| Wrong business id / slug | REST by id returns Aquaspeed + Devdetailing661 |
| Publish / website state | Checkout does not query publish flags |
| Booking lookup | Failure happens on `businesses` select before booking insert |
| RLS blocking anon | Anon REST succeeds; edge uses admin client |
| Missing Stripe Connect | Would return `409 not_ready`, not 404 |

## Root cause

Edge admin client used:

```ts
Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")
```

On projects with the **new API keys**, `SUPABASE_SECRET_KEYS` is a **JSON object**:

```json
{"default":"sb_secret_…"}
```

When the legacy `SUPABASE_SERVICE_ROLE_KEY` is unset, the edge passed the **raw JSON string** into `createClient` as the API key. That is not a valid JWT / secret key, so the admin `businesses` lookup failed and was mapped to “Business not found”.

Supabase docs: parse with `JSON.parse(SUPABASE_SECRET_KEYS)['default']`, and send new `sb_secret_…` keys on the **`apikey` header only** (not `Authorization: Bearer`).

## Fix

`createAdminClient()` in `_shared/supabase_admin.ts`:

1. Parse `SUPABASE_SECRET_KEYS` JSON → `default`  
2. Else fall back to legacy `SUPABASE_SERVICE_ROLE_KEY` JWT  
3. For `sb_secret_…`, strip `Authorization` Bearer so PostgREST accepts `apikey`

Wired into: `create-booking-checkout`, `stripe-webhook`, `stripe-connect-onboard`, `stripe-connect-connection`.

## Proof required after deploy

1. Checkout with Devdetailing661 → expect **409 `not_ready`** (Connect incomplete) **or** **200 `{url}`** if Connect already done.  
2. Must **not** return `Business not found` for a real id.
