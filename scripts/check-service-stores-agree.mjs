#!/usr/bin/env node
/**
 * THE TWO SERVICE STORES AGREE — or the business is on a recorded list of ones that do not.
 *
 *   node scripts/check-service-stores-agree.mjs            # source-only: the invariant's guards
 *   node scripts/check-service-stores-agree.mjs --live     # also counts the real divergence
 *
 * WHY. Measured 2026-09-15: 23 of 41 claimed businesses disagree between the `services` table
 * and `businesses.meta.service_catalog`, IN BOTH DIRECTIONS — Graef 1 vs 8, star-windows 9 vs 0,
 * Bucket 0 vs 4. That is not a bug, it is a MISSING INVARIANT, and it is the root of at least
 * three false statements Hubly has made to an owner this month:
 *
 *   "clay and seal, price 0" as Graef's only service
 *   "there is no services area on your page yet"
 *   "the 1 service you priced"
 *
 * Every one of those was fixed at the SENTENCE. The sentence was never the problem.
 *
 * THE BASELINE IS A DEBT AND IT MAY ONLY GO DOWN. A new divergent business means a writer
 * created one, which is the defect this exists to catch.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = process.argv.includes("--live");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** The 23 claimed businesses whose two stores disagreed on 2026-09-15, by slug. Recorded so a
 *  NEW one is visible. Reconciling these is a separate decision that has NOT been taken, and
 *  graefs-autocare is READ-ONLY until Adrian rules. */
const BASELINE = [
  "adrians-lawn-service",
  "aquaspeed",
  "aspen-grove-landscaping",
  "bucket-mobile-detailing",
  "canyon-ridge-tree-care",
  "cotter-aviation",
  "crestview-window-cleaning",
  "dawn-patrol-coffee",
  "detailing-chemicals-equipment-courses",
  "graefs-autocare",
  "home-and-business-cleaning",
  "hubly-classic-fixture",
  "ironwood-fence",
  "larkspur-landscaping",
  "lugnuts-regulators",
  "lugnutz",
  "mobile-detailing",
  "payson-chimney",
  "pike-holloway-tree-service",
  "site-aa7537",
  "star-windows",
  "window-washing",
  "window-washing-3e9c5"
];

// ── 1. THE WRITER THAT CREATED HALF OF THEM IS FIXED. ───────────────────────────────────
//
// business.setServices wrote the services table and, on a freeform page, patched the HTML —
// and skipped the catalogue entirely behind `if (!isFreeform)`. That is why 29 freeform
// businesses read table>0, catalogue=0. Asserted on the source because the alternative is a
// live write to a real business's services.
const reg = readFileSync(resolve(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");
const setSvc = reg.slice(reg.indexOf('name: "setServices"'), reg.indexOf('name: "setServices"') + 12000);
say("1 setServices writes the catalogue on EVERY page kind, not only classic",
  /let classic: ClassicServicesWrite \| null = null;\s*\n\s*try \{ classic = await applyServicesToClassic/.test(setSvc),
  /if \(!isFreeform\) \{\s*\n\s*try \{ classic = await applyServicesToClassic/.test(setSvc)
    ? "the !isFreeform gate is BACK — freeform writes will skip the catalogue again"
    : "unconditional");

// ── 2. AND THE SENTENCE DID NOT FOLLOW THE WRITE. ───────────────────────────────────────
//
// On a freeform page the thing the owner SEES is the patched HTML. Writing the catalogue is a
// record change, not a surface change, and reporting it as "the page shows them now" would be
// the exact split Lesson 11 is about — fixed once, easy to undo by deleting four characters.
say("2 a catalogue write on a freeform page is not reported as a page change",
  /const classicWrote = !isFreeform && classic\?\.status === "written";/.test(setSvc),
  "classicWrote stays gated on !isFreeform");

// ── 3. ONE READER, AND IT IS THE ONE WITH THE STATED RULE. ──────────────────────────────
const readerSql = readFileSync(resolve(ROOT, "supabase/migrations/20260914080000_services_reader_both_stores.sql"), "utf8");
say("3 the one reader reads BOTH stores and states which wins",
  /full outer join|coalesce\(c\.price, t\.price\)/.test(readerSql) && /THE CATALOGUE WINS ON PRICE/.test(readerSql),
  "get_business_services: catalogue wins on price, exact-name join, conflicts surfaced");
say("4 and it surfaces a disagreement rather than quietly resolving it",
  /conflicts/.test(readerSql) && /never quietly resolved/i.test(readerSql), "conflicts column");

// ── 5. LIVE: the count, against the real database. ──────────────────────────────────────
if (!LIVE) {
  console.log("\n(--live not passed: the divergence COUNT was not measured this run.)");
} else {
  let out = "";
  try {
    out = execFileSync("supabase", ["db", "query", "--linked",
      "select b.slug from businesses b where b.owner_id is not null and (select count(*) from services s where s.business_id=b.id) <> coalesce(jsonb_array_length(((b.meta::jsonb)->'service_catalog'->'services')),0) order by b.slug;"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } catch (e) { console.error("CANNOT RUN --live — " + String(e.message).slice(0, 160)); process.exit(2); }
  let slugs = [];
  try { slugs = JSON.parse(out.slice(out.indexOf("{"))).rows.map((r) => r.slug); }
  catch (e) { console.error("CANNOT RUN --live — the query would not parse"); process.exit(2); }

  const known = new Set(BASELINE);
  const added = slugs.filter((s) => !known.has(s));
  say("5 no NEW business has diverged since the baseline", added.length === 0,
    added.length ? `NEW: ${added.join(", ")} — a writer created a divergence` : `${slugs.length} divergent, all recorded`);
  say("6 the divergence count has not gone up", slugs.length <= BASELINE.length,
    `${slugs.length} now, baseline ${BASELINE.length}`);
  const healed = BASELINE.filter((s) => !slugs.includes(s));
  if (healed.length) console.log(`\nNOTE  ${healed.length} baseline entr${healed.length === 1 ? "y no longer diverges" : "ies no longer diverge"} — remove from BASELINE: ${healed.join(", ")}`);
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe writers cannot create a new divergence, and the reader states which store wins.");
process.exit(failed ? 1 : 0);
