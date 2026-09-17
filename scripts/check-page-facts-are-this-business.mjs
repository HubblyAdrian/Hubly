#!/usr/bin/env node
/**
 * [RULE] A PAGE MAY NOT PUBLISH ANOTHER BUSINESS'S CONTACT DETAILS.
 *
 *   node scripts/check-page-facts-are-this-business.mjs
 *
 * ══ THE DEFECT, MEASURED 2026-09-17 ═════════════════════════════════════════════════════════
 *
 * `saltmarsh-bindery`'s page publishes **801-555-9001**. That is `copperwick-kilns`'s phone
 * number. Saltmarsh's own record says 801-555-2277.
 *
 * Adrian: *"THE CROSS-BUSINESS LEAK … is a page built from another business's record — its own
 * defect, worse than fabrication."* He is right about the ordering. An invented number reaches
 * nobody; a REAL number belonging to someone else reaches THEM — a stranger's customers ring a
 * business that never heard of them, and the business whose page it is never gets the call.
 *
 * ── WHAT THE ROWS SAY, AND WHAT THEY DO NOT ─────────────────────────────────────────────────
 *
 *   · exactly ONE page in 188 carries another business's phone. It is not systemic.
 *   · it entered at VERSION 2 (2026-08-20 19:14:56) carrying `data-hc="contact.phone"` — so it
 *     was placed by the FACT WRITER, not written as prose by the model.
 *   · copperwick's own page was generated five minutes earlier, at 19:07, in the same window.
 *   · it has survived three versions since, INCLUDING A REBUILD ON 2026-09-13. Four weeks later
 *     the page is still wrong, and nothing noticed.
 *   · both are `account_kind='test'`, so no real person's number is published today.
 *
 * **HOW it happened is NOT established.** The renderer takes its facts as a parameter and holds
 * no module state, and the writer has changed since August. Guessing a mechanism and writing it
 * down as the cause is how a plausible story becomes folklore with a citation. What is certain is
 * the last bullet above: a wrong fact on a stored page is never re-checked against the record.
 *
 * THIS IS THAT RE-CHECK. Every phone on every stored page is either this business's own, or a
 * number no business in the corpus claims (a supplier, a partner — not ours to judge), or it is
 * SOMEBODY ELSE'S and that is a failure.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let rows;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select b.slug, b.account_kind, coalesce(b.phone,'') as phone,
            (select rendered_html from business_documents d where d.business_id=b.id
              order by version desc limit 1) as html
     from businesses b`], { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  rows = JSON.parse(out.slice(s, e));
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 200)); process.exit(2); }

const digits = (s) => String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
/** Whose number is this, across the whole corpus? */
const owner = new Map();
for (const r of rows) { const d = digits(r.phone); if (d.length === 10) owner.set(d, r.slug); }

const pages = rows.filter((r) => r.html);
let failed = 0, scanned = 0;
for (const r of pages) {
  const found = new Set();
  for (const m of String(r.html).matchAll(/(\(?\d{3}\)?[ .\-]?\d{3}[ .\-]?\d{4})/g)) {
    const d = digits(m[1]);
    if (d.length === 10) found.add(d);
  }
  const mine = digits(r.phone);
  for (const d of found) {
    if (d === mine) continue;
    scanned++;
    const who = owner.get(d);
    if (who && who !== r.slug) {
      console.error(`FAIL  ${r.slug} (${r.account_kind}) publishes ${d} — that number belongs to ${who}`);
      console.error(`      its own record says ${r.phone || "(no phone)"}`);
      failed++;
    }
  }
}

console.log(`\n${pages.length} stored pages · ${owner.size} businesses with a phone on record · ${scanned} page numbers that are not the page's own`);
console.log("A number nobody in the corpus claims is left alone: a supplier or a partner is not ours to judge.");
if (failed) {
  console.error(`\nFAIL — ${failed} page(s) publishing a number that belongs to a DIFFERENT business.`);
  console.error("A fabricated number reaches nobody. A real one belonging to someone else reaches THEM.");
  process.exit(1);
}
console.log("PASS — no page publishes another business's phone number.\n");
