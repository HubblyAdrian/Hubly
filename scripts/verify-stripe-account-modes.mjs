#!/usr/bin/env node
/**
 * WHICH MODE DOES EACH CONNECTED ACCOUNT BELONG TO?
 *
 *   node scripts/verify-stripe-account-modes.mjs        # report only
 *   node scripts/verify-stripe-account-modes.mjs --sql  # also print the backfill SQL
 *
 * WHY THIS EXISTS. `stripe_connect_accounts.stripe_account_id` carries no mode
 * signal at all: both a test and a live account are `acct_` + 21 characters.
 * Unlike keys (`sk_test_` / `sk_live_`) there is nothing to parse, no column
 * records it, and `connected_at` supports an inference, not a determination.
 *
 * THE ONLY AUTHORITATIVE CHECK IS TO ASK STRIPE UNDER EACH KEY. An account
 * resolves under exactly one mode and 404s under the other. That is what this
 * does: GET /v1/accounts/{id} with the test key, then with the live key.
 *
 * THE GATE (the point of the script):
 *
 *   A row WE created and can personally vouch for may be hand-asserted, with
 *   the provenance written into the migration. A row we did not create may NOT.
 *   `KNOWN_ROWS` below is that allow-list, and it is deliberately tiny. Any
 *   account id not on it must be resolved by this script before a mode is
 *   assigned — and the script EXITS NON-ZERO if it finds one that has not been.
 *
 *   That gate fires before Bucket, which is exactly the point. Two rows we made
 *   ourselves are a special case, not a policy.
 *
 * SECRETS. Keys are read from the environment and NEVER printed, echoed, or
 * written anywhere. Accounts are reported by PREFIX and first four characters
 * only. Set them in your shell for the length of one run:
 *
 *   STRIPE_SECRET_KEY_TEST=… STRIPE_SECRET_KEY_LIVE=… node scripts/verify-stripe-account-modes.mjs
 *
 * Do NOT put them in a file, and do NOT use `supabase secrets set` — that puts
 * the value in shell history, which is the August leak.
 */

/** Accounts we personally created and can vouch for. Nothing else may be hand-asserted. */
const KNOWN_ROWS = {
  "adrians-lawn-service": { mode: "live", basis: "created by Adrian 2026-07-23, while the platform ran live keys" },
  "evergreen-yard-care":  { mode: "test", basis: "created 2026-09-06 05:28, after that morning's switch to test keys" },
};

const TEST_KEY = (process.env.STRIPE_SECRET_KEY_TEST || "").trim();
const LIVE_KEY = (process.env.STRIPE_SECRET_KEY_LIVE || "").trim();

/** Never returns or logs the key — only what it is for. */
function keyKind(k) {
  if (!k) return "(unset)";
  if (k.startsWith("sk_test_") || k.startsWith("rk_test_")) return "sk_test_…";
  if (k.startsWith("sk_live_") || k.startsWith("rk_live_")) return "sk_live_…";
  return "(unrecognised prefix)";
}

function head(acctId) {
  const [p, rest = ""] = String(acctId).split("_");
  return `${p}_${rest.slice(0, 4)}…`;
}

async function resolves(acctId, key) {
  if (!key) return null; // unknown, not false
  const res = await fetch(`https://api.stripe.com/v1/accounts/${encodeURIComponent(acctId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  const body = await res.json().catch(() => ({}));
  // A 401/403 is NOT "the account is not in this mode" — it is "we could not ask".
  throw new Error(`HTTP ${res.status} for ${head(acctId)}: ${body?.error?.message || "unknown"}`);
}

const rows = JSON.parse(process.env.ROWS_JSON || "[]");
if (!rows.length) {
  console.error("No rows supplied. Pipe them in as ROWS_JSON, e.g.:");
  console.error("  ROWS_JSON='[{\"slug\":\"…\",\"stripe_account_id\":\"acct_…\"}]' node scripts/verify-stripe-account-modes.mjs");
  console.error("(Read them with: supabase db query --linked \"select b.slug, a.stripe_account_id from ...\")");
  process.exit(2);
}

console.log(`test key: ${keyKind(TEST_KEY)}   live key: ${keyKind(LIVE_KEY)}\n`);

let ungated = 0, conflicts = 0;
const resolved = [];

for (const r of rows) {
  const known = KNOWN_ROWS[r.slug];
  let inTest = null, inLive = null, err = null;
  try {
    inTest = await resolves(r.stripe_account_id, TEST_KEY);
    inLive = await resolves(r.stripe_account_id, LIVE_KEY);
  } catch (e) { err = e.message; }

  let mode = null;
  if (inTest === true && inLive === true) { mode = null; conflicts++; }
  else if (inTest === true) mode = "test";
  else if (inLive === true) mode = "live";

  const asserted = known?.mode || null;
  const line = `${r.slug.padEnd(24)} ${head(r.stripe_account_id).padEnd(14)}`;

  if (err) {
    console.log(`${line} COULD NOT ASK — ${err}`);
    if (!known) ungated++;
    continue;
  }
  if (mode) {
    const agree = !asserted || asserted === mode;
    console.log(`${line} stripe says: ${mode.toUpperCase()}${asserted ? `   hand-asserted: ${asserted}${agree ? "  ✓ agree" : "  ✗ CONFLICT"}` : "   (not hand-asserted)"}`);
    if (asserted && !agree) conflicts++;
    resolved.push({ slug: r.slug, mode });
  } else {
    console.log(`${line} UNRESOLVED — resolves under ${inTest === true && inLive === true ? "BOTH keys (impossible; check the keys)" : "neither key"}`);
    if (!known) ungated++;
    else console.log(`${" ".repeat(40)}hand-asserted ${asserted} on the basis: ${known.basis}`);
  }
}

if (process.argv.includes("--sql")) {
  console.log("\n-- backfill, from what Stripe actually answered:");
  for (const r of resolved) {
    console.log(`update public.stripe_connect_accounts a set mode = '${r.mode}'\n  from public.businesses b where b.id = a.business_id and b.slug = '${r.slug}';`);
  }
}

console.log("");
if (conflicts) {
  console.error(`${conflicts} conflict(s): Stripe disagrees with a hand-assertion, or an account`);
  console.error(`answered under both keys. Do not migrate until this is understood.`);
  process.exit(1);
}
if (ungated) {
  console.error(`${ungated} account(s) are NOT on the KNOWN_ROWS allow-list and could not be`);
  console.error(`resolved against Stripe. A mode may not be hand-assigned to a row we did not`);
  console.error(`create. Supply both keys and re-run.`);
  process.exit(1);
}
console.log("OK — every account has a mode established by Stripe or a vouched-for assertion.");
