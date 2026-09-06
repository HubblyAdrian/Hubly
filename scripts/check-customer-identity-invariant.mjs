#!/usr/bin/env node
/**
 * THE CUSTOMER IDENTITY CHECK.  `node scripts/check-customer-identity-invariant.mjs`
 *
 * Merging two customers is silent and unrecoverable. One person's phone, vehicle,
 * notes and booking history land on another person's record, nothing errors, and
 * the owner sees one customer where there were two. There is no "undo merge".
 *
 * The class that produces it is not a line, it is a SECOND RESOLVER. Two existed
 * (`crm_customer.ts` and `crm_from_booking.ts`) and they disagreed on all three
 * things that matter: precedence, whether phone was normalised, and whether name
 * could match on its own. Aligning them would have left the class open — the third
 * one would have disagreed too. So there is one, and this asserts there is one.
 *
 * THREE CHECKS, because they catch different halves:
 *
 *  1. EXACTLY ONE RESOLVER. `resolveOrCreateCrmCustomer` is defined once and every
 *     other identity decision calls it.
 *  2. NAME IS NEVER A MATCH KEY. No customers lookup filters on `name` at all.
 *     The old guarded version ("only when no phone/email AND exactly one match")
 *     was not sufficient: two people called John Smith, one with no contact
 *     details, merge. Rare is not safe.
 *  3. EVERY PHONE COMPARISON GOES THROUGH `normalisePhone`. A raw-string phone
 *     comparison cannot match "+1 (555) 010-0123" against "5550100123", so it
 *     silently fails to find the person it is looking at and inserts a duplicate.
 *
 * WHERE THIS CHECK STOPS — a rule enforced at one layer is not a rule:
 *
 *  - It reads `supabase/functions/**` ONLY. It does NOT see `public/hubly.html`,
 *    whose owner CRM inserts customers with no identity resolution at all
 *    (deliberately, and out of scope — an owner who types two customers with the
 *    same email chose to keep them apart). If a resolver is ever added there,
 *    this check will not notice.
 *  - It is STATIC. It cannot see an identity decision made in SQL, in an RPC, in
 *    a database trigger, or in a migration. If customer matching moves into
 *    Postgres, this check goes quiet while still passing.
 *  - It matches `.eq("phone"…)`-shaped comparisons. A phone compared by some
 *    other route — a raw `.filter()`, a string built at runtime, an `.or()`
 *    clause, a join — is invisible to it.
 *  - It proves nothing about CORRECTNESS of the resolver, only about its
 *    uniqueness and its inputs. A single resolver that merges wrongly passes
 *    every check here.
 *  - There is NO DATABASE CONSTRAINT behind any of this. `customers` has no
 *    unique index on (business_id, phone) or (business_id, email), and cannot
 *    usefully have one on raw phone text. Two concurrent callers can still both
 *    miss and both insert. This check is a guard against a second resolver, not
 *    a guarantee of one row per person.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const FN_DIR = path.join(ROOT, "supabase/functions");
const RESOLVER = "supabase/functions/_shared/crm_customer.ts";

let failures = 0;
function fail(msg) { failures++; console.error(`  ✗ ${msg}`); }

/** Blank comments and string/template literals so prose can never be read as code. */
function codeOnly(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const j = src.indexOf("\n", i); const k = j < 0 ? src.length : j; out += " ".repeat(k - i); i = k; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); const k = j < 0 ? src.length : j + 2; out += src.slice(i, k).replace(/[^\n]/g, " "); i = k; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      const k = Math.min(j + 1, src.length);
      // keep the quotes so `.eq("phone"` stays matchable, blank the contents only
      out += q + src.slice(i + 1, Math.max(i + 1, k - 1)).replace(/[^\n]/g, (ch) => ch) + (k <= src.length ? q : "");
      i = k; continue;
    }
    out += c; i++;
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}
const FILES = walk(FN_DIR).map((p) => ({ rel: path.relative(ROOT, p), src: fs.readFileSync(p, "utf8") }));
console.log(`scanned ${FILES.length} TypeScript files under supabase/functions/\n`);

// ---------------------------------------------------------------------------
// CHECK 1 — exactly one resolver.
// ---------------------------------------------------------------------------
const defs = FILES.filter((f) => /export\s+async\s+function\s+resolveOrCreateCrmCustomer/.test(f.src));
console.log(`resolveOrCreateCrmCustomer definitions      : ${defs.length} (must be 1)`);
if (defs.length !== 1) {
  for (const d of defs) fail(`resolver defined in ${d.rel}`);
  fail(`there must be exactly ONE customer identity resolver. Two that disagree IS the bug class.`);
} else if (defs[0].rel !== RESOLVER) {
  fail(`the resolver moved to ${defs[0].rel}; expected ${RESOLVER}. Update this check deliberately.`);
}

// A second resolver rarely announces itself by name. Flag any OTHER file that
// both reads `customers` and inserts into it — that is a resolver in all but name.
const shaped = FILES.filter((f) =>
  f.rel !== RESOLVER &&
  /from\(["']customers["']\)[\s\S]{0,400}?\.select\(/.test(f.src) &&
  /from\(["']customers["']\)[\s\S]{0,400}?\.insert\(/.test(f.src)
);
console.log(`other files that both read AND insert customers: ${shaped.length} (must be 0)`);
for (const f of shaped) {
  fail(`${f.rel} looks up a customer and inserts one — that is a second resolver.\n` +
       `      Call resolveOrCreateCrmCustomer() from ${RESOLVER} instead.`);
}

// ---------------------------------------------------------------------------
// CHECK 2 — name is never a match key.
// ---------------------------------------------------------------------------
let nameMatches = 0;
for (const f of FILES) {
  const code = codeOnly(f.src);
  // any customers query that filters on the name column
  const re = /from\(["']customers["']\)([\s\S]{0,400}?)(?:;|\n\s*\n)/g;
  let m;
  while ((m = re.exec(code))) {
    const chain = m[1];
    if (!/\.(eq|ilike|like|match)\(\s*["']name["']/.test(chain)) continue;
    nameMatches++;
    const line = code.slice(0, m.index).split("\n").length;
    fail(`${f.rel}:${line} filters a customers lookup on \`name\`.\n` +
         `      Name is NEVER a match key. Two different people called John Smith, one\n` +
         `      with no contact details, merge into one record — silently, permanently.`);
  }
}
console.log(`customer lookups filtering on \`name\`        : ${nameMatches} (must be 0)`);

// ---------------------------------------------------------------------------
// CHECK 3 — every phone comparison goes through the normaliser.
// ---------------------------------------------------------------------------
let rawPhone = 0;
for (const f of FILES) {
  const code = codeOnly(f.src);
  const re = /\.(eq|ilike|like|match)\(\s*["']phone["']\s*,/g;
  let m;
  while ((m = re.exec(code))) {
    rawPhone++;
    const line = code.slice(0, m.index).split("\n").length;
    fail(`${f.rel}:${line} compares \`phone\` as raw text.\n` +
         `      "+1 (555) 010-0123" and "5550100123" are different strings, so this\n` +
         `      silently fails to find the customer and inserts a duplicate.\n` +
         `      Compare normalisePhone(x) === normalisePhone(y) instead.`);
  }
}
console.log(`raw-text phone comparisons                  : ${rawPhone} (must be 0)`);

// The normaliser itself must exist and be exported exactly once.
const norm = FILES.filter((f) => /export\s+function\s+normalisePhone/.test(f.src));
console.log(`normalisePhone definitions                  : ${norm.length} (must be 1)`);
if (norm.length !== 1) {
  fail(`there must be exactly ONE exported phone normaliser. When five copies of money()\n` +
       `      existed, all five were wrong the same way.`);
}

console.log("");
if (failures) { console.error(`${failures} failure(s).`); process.exit(1); }
console.log("PASS — one resolver, no name matching, no raw phone comparison.");
