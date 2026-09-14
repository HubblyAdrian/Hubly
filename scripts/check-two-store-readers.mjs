#!/usr/bin/env node
/**
 * A FACT THAT LIVES IN TWO STORES MAY NOT BE READ FROM ONE.
 *
 * Hubly keeps several business facts in two places at once (docs/SETTLED.md #2). A reader
 * built on one of them does not return less — it returns a CONFIDENT WRONG ANSWER, and when
 * that reader feeds the assistant's context the model repeats it with no reason to doubt it.
 *
 * Measured 2026-09-14: `get_business_services` read `public.services` alone. Graef had ONE row
 * there and EIGHT in `meta.service_catalog`, so on every owner turn the model was told the
 * paying customer has one unpriced service while his page showed eight priced ones.
 *
 * The fix already existed. `get_business_hours` reads both and says so in its own comment:
 *
 *     "A reader built on the first alone would have told Graef 'no hours on record' while his
 *      own page showed them."
 *
 * **That lesson was written once, in a comment, and not carried across — which is why this is
 * a check.** A rule that lives only in a comment is a preference.
 *
 *   node scripts/check-two-store-readers.mjs
 *
 * Exit: 0 every two-store fact is read from both · 1 a one-store reader · 2 cannot run.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIG = join(ROOT, "supabase/migrations");

/**
 * THE TWO-STORE FACTS, and this list is the thing to keep current.
 *
 * Enumerated explicitly rather than inferred: a fact is "two-store" because of a decision
 * somebody made, not because of anything visible in a query. Each entry names the reader, the
 * two stores, and a marker that must appear in the reader's body for each.
 */
const TWO_STORE_FACTS = [
  {
    fact: "opening hours",
    reader: "get_business_hours",
    stores: [
      { name: "settings_business_hours", marker: /settings_business_hours/ },
      { name: "businesses.meta.hours", marker: /meta::jsonb\)->'hours'|->'hours'/ },
    ],
  },
  {
    fact: "services and their prices",
    reader: "get_business_services",
    stores: [
      { name: "public.services", marker: /from public\.services\b/ },
      { name: "businesses.meta.service_catalog", marker: /service_catalog/ },
    ],
  },
];

let failed = 0, checked = 0;
let files;
try { files = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

/** The LAST definition of a function across the migration ledger is the one in force. */
function latestDefinition(fnName) {
  let body = null, from = null;
  for (const f of files) {
    const src = readFileSync(join(MIG, f), "utf8");
    const re = new RegExp(`create or replace function public\\.${fnName}\\s*\\(`, "gi");
    let m;
    while ((m = re.exec(src))) {
      const end = src.indexOf("$$;", m.index);
      if (end < 0) continue;
      body = src.slice(m.index, end);
      from = f;
    }
  }
  return { body, from };
}

console.log(`two-store facts declared: ${TWO_STORE_FACTS.length}   migrations scanned: ${files.length}`);
for (const f of TWO_STORE_FACTS) {
  const { body, from } = latestDefinition(f.reader);
  checked++;
  if (!body) { console.log(`FAIL  ${f.reader.padEnd(26)} no definition found in the ledger`); failed++; continue; }
  const missing = f.stores.filter((s) => !s.marker.test(body));
  if (missing.length) {
    failed++;
    console.log(`FAIL  ${f.reader.padEnd(26)} reads ${f.stores.length - missing.length} of ${f.stores.length} stores for "${f.fact}"`);
    for (const s of missing) console.log(`        missing: ${s.name}`);
    console.log(`        latest definition: ${from}`);
  } else {
    const saysSource = /\bas source\b/.test(body);
    const saysConflict = /conflicts/.test(body);
    console.log(`ok    ${f.reader.padEnd(26)} both stores · reports source: ${saysSource} · reports conflicts: ${saysConflict}  (${from})`);
    if (!saysSource || !saysConflict) {
      failed++;
      console.log(`FAIL  ${f.reader} reads both but does not report which store a row came from, or whether they disagree.`);
      console.log(`        Picking a winner silently is how a two-store fact becomes a one-store answer again.`);
    }
  }
}

console.log(failed
  ? `\n${failed} of ${checked} two-store readers are wrong. A one-store reader does not return less — it returns a confident wrong answer.`
  : `\nPASS — all ${checked} two-store facts are read from both stores, with source and conflicts reported.`);
process.exit(failed ? 1 : 0);
