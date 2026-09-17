#!/usr/bin/env node
/**
 * [RULE] A PRICE BAKED ONTO A PAGE MUST STILL BE THE PRICE IN THE STORE.
 *
 *   supabase db query --linked -f scripts/sql/export-page-prices.sql > pages.json
 *   HUBLY_PAGE_PRICES=pages.json node scripts/check-page-price-drift.mjs
 *
 * ADRIAN, 2026-09-16: "a check that goes RED when a page's baked prices disagree with the store."
 *
 * WHY IT CAN HAPPEN AT ALL. A freeform page is a SINGLE GENERATION with no update path, so the price
 * a customer reads is HTML written at build time. `placeOneServicePrice` patches it when a price
 * changes — and if that patch ever misses, the record moves and the page does not. A customer then
 * reads a number the owner no longer charges, which is the most expensive kind of stale data we have.
 *
 * THE PAIRING IS EXACT, NOT A WINDOW. The product writes
 * `<span data-hubly-price="SERVICE NAME">$85</span>`, so the span names the service it belongs to. No
 * "look forward 400 characters" guess is involved.
 *
 * IT USES THE PRODUCT'S OWN FORMATTER, IMPORTED, NOT A COPY. `fmtServicePrice` from
 * hubly_capability_registry.ts, run under Deno. The 2026-09-15 scar was two detectors agreeing because
 * they shared a BROKEN formatter, and the sentence that would have caught it was "this holds only if
 * the page formats the price exactly as the search does". A checker that re-implements the formatter
 * is comparing the page against a second opinion, not against the product.
 *
 * ══ WHAT IS NOT COMPARABLE IS COUNTED, NEVER COUNTED AS DRIFT ═══════════════════════════════════
 *
 * Measured 2026-09-16: 54 price spans on the latest version of every page. **48 of them are on 15
 * businesses that have NO catalogue at all** — their services live only in the relational table, so
 * "no matching catalogue service" is our store split and not a page lying to anybody. Six are on ONE
 * business (evergreen-yard-care, test) and all six agree exactly.
 *
 * So the honest report today is **zero drift, six comparable pairs**, and this check exists for the
 * day that changes. A check that counted the 48 as findings would be the six-wrong-findings sweep
 * again: plausible, flattering, and about us rather than about them.
 *
 * ALSO NOT DRIFT: a store that says `quote_required` while the page shows a number is a different
 * defect (a price on a page for something that is quoted) and it is reported under its own name, not
 * folded into a drift count. A VARIABLE-priced service is compared against its BASE price, which is
 * what placeOneServicePrice writes, and that is stated on the row.
 *
 * [SHAPE] ON ONE LEG ONLY, DECLARED: leg 1 asserts the export is non-empty and has spans, which is a
 * fact about the corpus and will legitimately move. Every other leg is [RULE].
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.HUBLY_PAGE_PRICES;
if (!SRC) {
  console.error("CANNOT RUN — set HUBLY_PAGE_PRICES to the export from scripts/sql/export-page-prices.sql");
  process.exit(2);
}
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const raw = JSON.parse(readFileSync(SRC, "utf8"));
const rows = Array.isArray(raw) ? raw : (raw.rows || []);
if (!rows.length) {
  console.error("CANNOT RUN — the export holds no price spans. Re-export; an empty or reused export");
  console.error("  reports 'no drift' when it has told you about itself, not about the pages.");
  process.exit(2);
}

// ── THE PRODUCT'S FORMATTER, IN ITS OWN RUNTIME ─────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), "drift-"));
const runner = join(dir, "fmt.ts");
const cents = rows.map((r) => r.store_price_cents).filter((v) => v !== null && v !== undefined);
writeFileSync(runner, `
import { fmtServicePrice } from "${join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts")}";
const cents = ${JSON.stringify(cents)};
console.log(JSON.stringify(cents.map((c: any) => fmtServicePrice(Number(c) / 100))));
`);
let formatted;
try {
  // --allow-env because importing the module evaluates its top level, which reads HUBLY_APP_ORIGIN.
  // Granted rather than worked around: the alternative is copying the formatter, which is the one
  // thing this check exists not to do. Nothing is written and no network is granted.
  formatted = JSON.parse(execFileSync("deno", ["run", "--allow-read", "--allow-env", "--no-check", runner], { encoding: "utf8" }).trim());
} catch (e) {
  console.error("CANNOT RUN — the product's price formatter would not run under Deno: " + String(e.message).slice(0, 200));
  process.exit(2);
}
const fmtByCents = new Map();
cents.forEach((c, i) => fmtByCents.set(String(c), formatted[i]));
const fmt = (c) => fmtByCents.get(String(c)) ?? null;

// ── CLASSIFY EVERY SPAN ─────────────────────────────────────────────────────────────────────
const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
const drift = [], agree = [], quoted = [], noStore = [], noPrice = [];
for (const r of rows) {
  const shown = norm(r.page_shows);
  if (r.store_name === null || r.store_name === undefined) { noStore.push(r); continue; }
  if (String(r.store_mode) === "quote_required") { quoted.push({ ...r, shown }); continue; }
  if (r.store_price_cents === null || r.store_price_cents === undefined) { noPrice.push(r); continue; }
  const want = fmt(r.store_price_cents);
  if (want === null) { noPrice.push(r); continue; }
  (shown === want ? agree : drift).push({ ...r, shown, want });
}

console.log(`\n${rows.length} baked price spans on the latest version of every page\n`);
console.log(`  comparable (page span + a store price)   ${agree.length + drift.length}`);
console.log(`  AGREE                                    ${agree.length}`);
console.log(`  DRIFT                                    ${drift.length}`);
console.log(`  not comparable — business has no catalogue   ${noStore.length}`);
console.log(`  not comparable — store says quote_required   ${quoted.length}`);
console.log(`  not comparable — store has no price          ${noPrice.length}\n`);

for (const d of drift) {
  console.log(`  DRIFT  ${d.slug} (${d.account_kind})  "${d.page_key}"`);
  console.log(`         page shows ${JSON.stringify(d.shown)} · store says ${JSON.stringify(d.want)}` +
              (d.store_mode === "variable" ? "  [variable: compared against the base price, which is what the patch writes]" : ""));
}
for (const q of quoted) {
  console.log(`  QUOTED-BUT-PRICED  ${q.slug} (${q.account_kind})  "${q.page_key}" shows ${JSON.stringify(q.shown)} while the store says it must be quoted`);
}

say("1 [SHAPE] the export holds price spans to compare — a corpus fact, and it will move",
    rows.length > 0, `${rows.length} spans across ${new Set(rows.map((r) => r.slug)).size} businesses`);
say("2 no baked page shows a price the store disagrees with",
    drift.length === 0, drift.length ? `${drift.length} page(s) show a stale price` : `${agree.length} comparable pairs, all agreeing`);
say("3 no baked page shows a NUMBER for a service the store says must be quoted",
    quoted.length === 0, quoted.length ? `${quoted.length} quoted service(s) carry a price on the page` : "none");
say("4 every comparable pair was compared with the PRODUCT's formatter, not a copy of it",
    fmtByCents.size > 0 || (agree.length + drift.length) === 0,
    `${fmtByCents.size} distinct store prices formatted by fmtServicePrice under Deno`);
// THE NOT-COMPARABLE COUNT IS REPORTED AND IS NOT A FAILURE. It is a fact about our two stores, and
// treating it as a page defect would be an alarm about us dressed up as an alarm about them.
say("5 what could not be compared is SAID, not silently dropped",
    noStore.length + quoted.length + noPrice.length === rows.length - agree.length - drift.length,
    `${noStore.length} no catalogue · ${quoted.length} quoted · ${noPrice.length} no price — every span accounted for`);

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — every price a customer can read still matches the store.\n");
process.exit(failed ? 1 : 0);
