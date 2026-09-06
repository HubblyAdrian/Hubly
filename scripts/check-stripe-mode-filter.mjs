#!/usr/bin/env node
/**
 * THE STRIPE MODE FILTER CHECK.  `node scripts/check-stripe-mode-filter.mjs`
 *
 * A connected Stripe account exists in EXACTLY ONE mode. `stripe_connect_accounts`
 * now carries `mode NOT NULL` and `UNIQUE (business_id, mode)`, so a business may
 * legitimately hold two rows — one test, one live.
 *
 * Every read of that table must therefore filter by the CURRENT platform mode. A
 * read that does not:
 *   - returns the other mode's row and renders "Connected" for an account that
 *     cannot take a payment (OPEN_FINDINGS #48, second route); or
 *   - feeds a Map keyed by business_id that keeps whichever row arrived LAST —
 *     silently, with no error, showing an arbitrary mode's status as the truth.
 *
 * The second is why this check exists rather than a code review note: it does not
 * fail loudly, so nothing would ever surface it.
 *
 * WHERE THIS CHECK STOPS — a rule enforced at one layer is not a rule:
 *
 *  - It scans `supabase/functions/**` only. It cannot see SQL, an RPC, a view, or
 *    a database trigger. If a mode decision moves into Postgres this goes quiet
 *    while still passing.
 *  - It is STATIC and shape-based: it looks for `.eq("mode"` within the query
 *    chain following `from("stripe_connect_accounts")`. A filter applied some
 *    other way — a `.or()`, a `.filter()`, a chain built at runtime — reads as
 *    missing; a filter with the WRONG value reads as present. It proves a filter
 *    exists, never that it is correct.
 *  - It cannot judge the three PK/unique-keyed sites it exempts. Those are listed
 *    explicitly below and were verified by hand.
 *  - The DATABASE does not enforce this at all. `UNIQUE (business_id, mode)` stops
 *    two rows of the same mode; nothing stops a query from reading both rows.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const FN_DIR = path.join(ROOT, "supabase/functions");

/**
 * Sites that legitimately do NOT filter by mode, each with the reason it is safe.
 * Keyed by `file:matchedText` so a change to the query re-raises it.
 */
const EXEMPT = [
  { file: "supabase/functions/stripe-webhook/index.ts", why: "keyed on stripe_account_id, which is globally unique across modes" },
  { file: "supabase/functions/stripe-connect-connection/index.ts", key: '.eq("id"', why: "keyed on the row's primary key, already mode-specific" },
];

let failures = 0;
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };

function codeOnly(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const j = src.indexOf("\n", i); const k = j < 0 ? src.length : j; out += " ".repeat(k - i); i = k; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); const k = j < 0 ? src.length : j + 2; out += src.slice(i, k).replace(/[^\n]/g, " "); i = k; continue; }
    out += c; i++;
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const files = walk(FN_DIR);
let total = 0, filtered = 0, exempted = 0;

for (const abs of files) {
  const rel = path.relative(ROOT, abs);
  const code = codeOnly(fs.readFileSync(abs, "utf8"));
  const re = /from\(["']stripe_connect_accounts["']\)/g;
  let m;
  while ((m = re.exec(code))) {
    total++;
    // the query chain = up to the terminating ; or a blank line
    const rest = code.slice(m.index, m.index + 700);
    const chain = rest.split(/;\s/)[0];
    const line = code.slice(0, m.index).split("\n").length;

    const isInsert = /\.insert\(/.test(chain);
    if (isInsert) {
      if (!/\bmode\b/.test(chain)) {
        fail(`${rel}:${line} INSERTs into stripe_connect_accounts without supplying \`mode\`.\n` +
             `      \`mode\` is NOT NULL with no default — this insert fails at runtime.`);
      } else filtered++;
      continue;
    }
    if (/\.eq\(["']mode["']/.test(chain)) { filtered++; continue; }

    const ex = EXEMPT.find((e) => e.file === rel && (!e.key || chain.includes(e.key)));
    if (ex) { exempted++; continue; }

    fail(`${rel}:${line} reads stripe_connect_accounts without \`.eq("mode", …)\`.\n` +
         `      It will see the OTHER mode's row. If it feeds a Map keyed by business_id,\n` +
         `      it fails SILENTLY — keeping whichever row arrived last. See OPEN_FINDINGS #49.`);
  }
}

console.log(`stripe_connect_accounts query sites          : ${total}`);
console.log(`  carrying a mode filter / supplying mode    : ${filtered}`);
console.log(`  exempt (PK- or unique-keyed, listed)       : ${exempted}`);
console.log(`  UNFILTERED                                 : ${total - filtered - exempted} (must be 0)`);
console.log("");
if (failures) { console.error(`${failures} failure(s).`); process.exit(1); }
console.log("PASS — every stripe_connect_accounts read filters by mode, and every insert supplies it.");
