# One-Off Sessions — Deployment Runbook

**Production status:** ⛔ **NOT DEPLOYED — blocked on the gates below.**
**Database layer:** ✅ verified against a real PostgreSQL 17 staging database
(see `scripts/staging/README.md`).

Everything in this file was measured against the real Hubly project
(`rtwxxkxpkqdrhclkozma`) on 2026-08-15 using read-only commands. Nothing has
been written to production.

---

## ⛔ Blocker 1 — staging cannot be built from this repository alone

`supabase db push` **cannot create a Hubly database.** `businesses`, `jobs`,
`customers`, `booking_requests` and `owns_business()` were created outside
version control, and the first migration (`20260710010000`) opens with
`alter table booking_requests`. A blank Supabase project fails on statement one —
so "just make a staging project" would not have worked.

`scripts/staging/bootstrap_hubly_core.sql` closes that gap and gets **119 of 125**
migrations applying. It is a reconstruction, not production: building it already
exposed two production columns absent from the whole repo
(`customers.customer_type`, plus the `jobs` columns later migrations add).
The authoritative route remains `pg_dump --schema-only` of production into a
fresh project — which needs the production DB password.

**What this bought us:** the entire database layer is now genuinely verified —
52/52 schema/constraint/RLS checks and 71/71 engine-against-real-Postgres checks.
See `scripts/staging/README.md`.

## ⛔ Blocker 2 — there is no *cloud* staging environment

```
$ supabase projects list
rtwxxkxpkqdrhclkozma  "Hubly"                      ACTIVE_HEALTHY  us-east-1  linked
gotqctfgrmptvbeztsbm  "adrian@brnno.com's Project" INACTIVE        us-west-1
```

The only healthy project **is** production — it's the one hardcoded in
`hubly.html`, `portal.html`, `session.html` and `api/router.js`. The second
project is paused and has none of the Hubly schema (`businesses`, `jobs`,
`customers`, `stripe_connect_accounts`, `owns_business()`), so it cannot host
this feature without rebuilding Hubly inside it.

Local Supabase isn't available either: **Docker is not installed**, which is why
`supabase db dump`, `db diff` and `supabase start` all fail here.

**Therefore Phases 7–17 of the live-verification plan (real Stripe, real Google
Calendar, real availability, live AI) cannot be run without either standing up a
staging project or deliberately testing in production.** Deploying was not done.

Two ways forward — this is your call, not mine:

| Option | What it costs | What it gets you |
|---|---|---|
| **A. Stand up staging** (recommended) | a new Supabase project + `supabase db push` of all 124 migrations + secrets + a test Stripe key | every live phase runs safely, repeatable forever |
| **B. Controlled production canary** | ~15 min, real DB write | ship it, then verify with `--post --smoke` against a Hubly-owned test business only |

If you choose B, the migration is additive and the feature is inert until a
session is created (see "Blast radius" below).

---

## ⛔ Blocker 3 — Stripe mode is unknown, and it gates all payment testing

`STRIPE_SECRET_KEY` exists but is a single project-wide secret; I can't read it,
and the endpoint that reports its mode (`stripe-connect-connection`) needs an
owner JWT.

**Before any payment test, confirm the mode.** Open Hubly → Settings → Payments
(that screen calls `stripe-connect-connection`, which returns `livemode`).

* `livemode: false` → safe to run the Phase 7 Stripe flow.
* `livemode: true` → **a "test" booking would be a real charge on a real card.**
  Do not run Phase 7 against this project. Use staging with a `sk_test_` key.

---

## ✅ Resolved — the "unrelated" migration, investigated (Phase 17)

```
$ supabase migration list        # local-only, i.e. NOT yet applied
20260813000000   backfill_website_capability   (commit 7680b73, Storefront Builder Phase 1)
20260815120000   one_off_sessions              (this release)
```

**It is not cruft — it is a safety backfill**, and here is why it matters. The
public site reads:

```js
const storefrontOnly = pubCaps.storefront === true && pubCaps.website !== true;
if (isStoreRoutePath() || storefrontOnly) { /* render the STORE as the whole site */ }
```

A business that gains `storefront: true` (the client sets it automatically via
`ensureStorefrontCapabilityOnBusiness`) but never had `website: true` would have
its **public website replaced by its store**. The backfill prevents that.

**Measured impact on production** (counts only, `limit=0`, no rows read):

| | count |
|---|---|
| businesses visible to anon | 17 |
| missing `capabilities.website` | **0** |
| `storefront=true` AND `website` missing (the at-risk case) | **0** |

**Verdict: safe, and currently a no-op.** Verified on staging that it merges
rather than overwrites (`{"marketplace":true}` → `{"marketplace":true,"website":true}`),
handles `NULL` capabilities, and is idempotent (`where capabilities->>'website' = ''`).

**Recommendation: apply it.** It changes nothing today and closes the gap for any
business RLS hides from an anon count.

## Blast radius (why this is a low-risk migration)

* **Additive only.** No `DROP TABLE/COLUMN/CONSTRAINT`, no `TRUNCATE`, no
  `DELETE`, no type changes, no backfill. Enforced by a test —
  `tests/one-off-sessions.test.mjs` → *"is additive"*, *"is idempotent"*,
  *"only touches its own tables plus one additive column on jobs"*.
* **Re-runnable.** Every object uses `IF NOT EXISTS`, or a matching
  `DROP … IF EXISTS` for policies/triggers. A retried push is safe.
* **Touches exactly three tables:** two new ones, plus `jobs.one_off_session_id`
  (nullable, defaults NULL, indexed). Every existing job keeps `NULL` and
  behaves exactly as before.
* **Inert until used.** No existing code path reads these tables. Normal booking,
  availability, calendar and payments are unchanged until somebody creates a session.

**Rollback:** the feature is off if you take the Edge Function away
(`supabase functions delete one-off-sessions`) — the tables are then unreachable.
A true schema rollback is `drop table public.one_off_session_bookings;
drop table public.one_off_sessions; alter table public.jobs drop column
one_off_session_id;` — destructive, only if no session has been created.

---

## Deployment artifacts

### 1. Database (1 migration)

```
supabase/migrations/20260815120000_one_off_sessions.sql
sha256 bf868c3090d29db4619c13b315f3f564580f8c3276aefe1b18a97c318ab377dc
```

### 2. Edge Functions

Measured production versions **before** this release:

| Function | Current | Action |
|---|---|---|
| `one-off-sessions` | **absent** | **deploy (new)** |
| `create-booking-checkout` | v24 | **redeploy** — adds the session checkout branch |
| `stripe-webhook` | v24 | **redeploy** — adds session finalize + `checkout.session.expired` |
| `hubly-conversation` | v69 | **redeploy** — adds the `sessions` capability + storefront patch routing |

> Deploying only the new function is the most likely mistake: payments and AI
> would silently do nothing. All four must go.

Shared files ride along in the bundle (verified with `deno info` — the graph
resolves `_shared/one_off_session_core.mjs`, which is the first `.mjs` in
`_shared`): `one_off_session_core.mjs`, `one_off_session_engine.ts`,
`hubly_capability_registry.ts`, `storefront_ast.ts`, `stripe.ts`.

`supabase/config.toml` gains `[functions.one-off-sessions] verify_jwt = false`
(public actions resolve the opaque token; owner actions re-check the JWT
in-function). The CLI reads this at deploy time.

### 3. Frontend (Vercel, via the GitHub remote)

`public/session.html` (new) · `public/journey-os/one-off-sessions.js` (new) ·
`public/hubly.html` · `public/journey-os/journey.js` ·
`public/journey-os/commerce/{store-page.js,storefront-ast.js}` · `api/router.js`

Deployment is **inferred** from `vercel.json` + the `origin` GitHub remote
(no Vercel CLI or token is present here, so I could not confirm the project
wiring). Confirm that pushing this branch/merging to `main` triggers the deploy
you expect.

### 4. Secrets — all required ones are present ✅

Verified by name only via `supabase secrets list` (no values read):
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `HUBLY_APP_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, `PORTAL_SESSION_SECRET`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`.

Absent but **optional, with safe defaults in code**:
`STRIPE_APPLICATION_FEE_PERCENT` (→ 0, no platform fee),
`HUBLY_PUBLIC_DOMAIN` (→ `myhubly.app`), `HUBLY_APP_ORIGIN` (→ `myhubly.app`).

**Stripe webhook events:** `checkout.session.expired` must be enabled on the
endpoint, or an abandoned checkout never releases its seat.
`checkout.session.completed` is already used by existing flows.

---

## Procedure

```bash
# 0 · gates
#    - staging exists, OR you have accepted a production canary
#    - Settings → Payments reports livemode:false (if you intend to test payments)
#    - you have decided what to do about migration 20260813000000
#    - Stripe endpoint has checkout.session.expired enabled

# 1 · record the baseline (read-only, safe to run anytime)
node scripts/check-one-off-sessions-deploy.mjs --pre

# 2 · database
supabase db push                       # applies 20260813000000 AND 20260815120000 — see Blocker 3

# 3 · functions — ALL FOUR
supabase functions deploy one-off-sessions
supabase functions deploy create-booking-checkout
supabase functions deploy stripe-webhook
supabase functions deploy hubly-conversation

# 4 · confirm the versions moved
supabase functions list | grep -E "one-off-sessions|create-booking-checkout|stripe-webhook|hubly-conversation"
#    expect: one-off-sessions present; create-booking-checkout >24; stripe-webhook >24; hubly-conversation >69

# 5 · frontend
git push origin one-off-sessions        # then merge / promote per your Vercel setup

# 6 · verify the deployment (read-only)
node scripts/check-one-off-sessions-deploy.mjs --post

# 7 · live lifecycle smoke — on a Hubly-owned TEST business only
OWNER_JWT=<owner access token> \
OWNER_BUSINESS_ID=<test business id> \
FOREIGN_BUSINESS_ID=<a business that owner does NOT own> \
  node scripts/check-one-off-sessions-deploy.mjs --post --smoke
```

`--smoke` creates one draft, publishes it, opens the private link
logged-out, closes it and cancels it. It never takes a payment. It leaves the
cancelled session behind on purpose — sessions are never deleted.

---

## What `--post` proves

| Check | Why it matters |
|---|---|
| both tables exist | migration actually applied |
| anon reads return **no rows** | RLS is real, not just in the test harness |
| anon insert is rejected | a hostile caller can't write sessions |
| unknown token → clean 404 | private-by-default holds; nothing leaks |
| owner action with no JWT → 401 | §17 |
| owner + foreign business → 403 | cross-business isolation on live RLS |
| `stripe-webhook` rejects unsigned | it's live and verifying signatures |
| draft is not publicly readable | §4 |
| publish → `calendar_blocked: true` | the block job was really written |
| public payload hides business + session ids | §25 |
| close → `calendar_blocked: false` | the window really went back |

---

## Still unverified after a successful `--post --smoke`

These need a real card, a real calendar, or a real conversation — they are not
covered by any automated check:

1. **Stripe end-to-end** — checkout renders $50, webhook confirms, job created once, repeat webhook is inert, `checkout.session.expired` frees the seat. *(Requires test mode.)*
2. **Google Calendar** — one block event, no duplicate on republish, event updates when the window moves, no orphan after cancel. *(Requires a connected test calendar.)*
3. **Live AI** — the natural-language phases (13–17). Structurally verified: the capability is registered, allow-listed for `operate`, the runtime injects the verified `businessId` (the model's is always overwritten), and website promotion is one action. Model *behavior* is unverified.
4. **Normal booking blocked in the live app** — the block is an ordinary `jobs` row, which `get_busy_windows` and `jobBlocks()` already read; proven in the engine harness, not yet on a live calendar.
