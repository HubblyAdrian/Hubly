#!/usr/bin/env node
/**
 * GROUND A PAGE'S CONTACT FACTS IN THAT BUSINESS'S OWN RECORD — targeted patch, never a rebuild.
 *
 *   node scripts/patch-ground-contact-facts.mjs           # dry run
 *   node scripts/patch-ground-contact-facts.mjs --apply
 *
 * ══ THE MECHANISM, TRACED PER PAGE — AND THERE IS NOT ONE ════════════════════════════════════
 *
 * Adrian asked whether a page carrying another business's phone is "a generation that borrowed from
 * the wrong context, or a copy that was never re-derived", and whether all the findings share a
 * mechanism. Read out of the version history, they do not:
 *
 *   saltmarsh-bindery — A PATCH PUT IT THERE, AND A REGENERATION INHERITED IT.
 *     v1 (ai)    neither number.  v2 (PATCH)  copperwick's 801-555-9001 appears 4x.
 *     v3 (ai)    still 4x.        v4 (patch)  still 4x.
 *     Its own recorded number, 801-555-2277, has NEVER appeared on any version.
 *
 *   bucket-mobile-detailing-09616 — A GENERATION BORROWED FROM THE WRONG CONTEXT.
 *     v1 (ai) already carries `bucketmobiledetailing@outlook.com`, which belongs to
 *     `bucket-mobile-detailing` — a DIFFERENT row for the same real business name. Two drafts of one
 *     business, and the second inherited the first's address at generation time.
 *
 *   adrians-lawn-service — NOT ON THE PAGE AT ALL. See the note in
 *     check-page-facts-are-this-business: those values live in `meta.pipeline.manual`, which is a
 *     LEAD LIST, and the classic renderer does not render it. Patching it would have destroyed lead
 *     records. The check was reading a subtree the page never shows.
 *
 * ══ SO THE SHARED FAULT IS NOT HOW IT ARRIVED. IT IS THAT NOTHING EVER RE-DERIVES IT ═════════
 *
 * Two pages, two different entry routes, and one property in common: **the business's OWN recorded
 * contact detail has never been on its page**, and a wrong one survived a patch AND a regeneration
 * without anything noticing. There is no pass that says "the phone on this page must be the phone on
 * this record" — `syncFreeformFacts` swaps a value when asked to, and nothing asks. That is the bug;
 * the two pages are symptoms, and the fix for the CLASS is a grounding pass, which is Adrian's call
 * to schedule. This file corrects the symptoms it can correct safely.
 *
 * WHAT IT WILL NOT DO: invent a value. It only replaces a detail that provably belongs to a
 * DIFFERENT business in the corpus, and only with this business's own recorded one. A business with
 * no recorded phone is left alone and reported — a page with someone else's number and no record of
 * its own is not something a script may guess at.
 *
 * `graefs-autocare` is never touched: it is read-only, and it has no such finding.
 *
 * Exit: 0 ok · 1 a postcondition refused a write · 2 cannot run.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./lib/redproof.mjs";

const APPLY = process.argv.includes("--apply");
const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};
const runFile = (sql, label) => {
  const f = join(mkdtempSync(join(tmpdir(), "hubly-ground-")), label + ".sql");
  writeFileSync(f, sql);
  const out = execFileSync("supabase", ["db", "query", "--linked", "-f", f], { encoding: "utf8", cwd: ROOT });
  if (/"_tag"\s*:\s*"Error"/.test(out)) throw new Error("write failed: " + out.slice(0, 400));
};
const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const digits = (s) => String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

let rows;
try {
  rows = q(`select b.slug, b.id, coalesce(b.phone,'') as phone,
                   (select d.rendered_html from business_documents d where d.business_id=b.id order by d.version desc limit 1) as html,
                   (select d.document::text from business_documents d where d.business_id=b.id order by d.version desc limit 1) as doc,
                   (select d.version from business_documents d where d.business_id=b.id order by d.version desc limit 1) as v,
                   (select d.tag from business_documents d where d.business_id=b.id order by d.version desc limit 1) as tag,
                   (select d.format from business_documents d where d.business_id=b.id order by d.version desc limit 1) as fmt
              from businesses b`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const owner = new Map();
for (const r of rows) { const d = digits(r.phone); if (d.length === 10) owner.set(d, r.slug); }

let done = 0, refused = 0;
for (const r of rows.filter((x) => x.html)) {
  const mine = digits(r.phone);
  const found = new Set([...String(r.html).matchAll(/\(?\d{3}\)?[ .\-]\d{3}[ .\-]\d{4}/g)].map((m) => m[0]));
  const strangers = [...found].filter((f) => { const d = digits(f); return d !== mine && owner.get(d) && owner.get(d) !== r.slug; });
  if (!strangers.length) continue;

  console.log(`\n  ${r.slug}  ${r.tag} v${r.v} (${r.fmt})`);
  for (const f of strangers) console.log(`      publishes ${f} — belongs to ${owner.get(digits(f))}`);
  if (mine.length !== 10) {
    console.error(`      REFUSED — this business has no phone on record (${JSON.stringify(r.phone)}), so there is ` +
      `nothing to ground the page in. A script may not guess a phone number.`);
    refused++; continue;
  }
  let html = String(r.html), doc = String(r.doc || "");
  for (const f of strangers) { html = html.split(f).join(r.phone); html = html.split(digits(f)).join(digits(r.phone)); }
  for (const f of strangers) { doc = doc.split(f).join(r.phone); doc = doc.split(digits(f)).join(digits(r.phone)); }

  const still = [...new Set([...html.matchAll(/\(?\d{3}\)?[ .\-]\d{3}[ .\-]\d{4}/g)].map((m) => digits(m[0])))]
    .filter((d) => d !== mine && owner.get(d) && owner.get(d) !== r.slug);
  const problems = [];
  if (still.length) problems.push(`a stranger's number survived: ${still.join(", ")}`);
  if (!html.includes(r.phone)) problems.push(`the business's own number ${r.phone} is not on the patched page`);
  if (Math.abs(html.length - String(r.html).length) > 200) problems.push(`length moved by ${html.length - String(r.html).length} bytes, too much for a value swap`);
  if (problems.length) { for (const p of problems) console.error(`      POSTCONDITION FAILED — ${p}`); refused++; continue; }
  console.log(`      -> every occurrence replaced with its OWN recorded ${r.phone}; page now names it`);

  if (!APPLY) { console.log(`      (dry run — pass --apply to write v${r.v + 1})`); continue; }
  runFile(
    `-- TARGETED PATCH, ${r.slug}: replace a phone number belonging to another business with this\n` +
    `-- business's OWN recorded number. A NEW VERSION; the old one stays exactly as it was, because\n` +
    `-- history is not rewritten and a rebuild would discard the patch work on 164 of 188 live pages.\n` +
    `insert into public.business_documents (business_id, tag, version, document, rendered_html, created_by, format)\n` +
    `values (${sq(r.id)}, ${sq(r.tag)}, ${r.v + 1}, ${sq(doc)}::jsonb, ${sq(html)}, 'patch', ${sq(r.fmt)});\n`,
    `ground-${r.slug}`);
  const back = q(`select version, (rendered_html like '%' || ${sq(r.phone)} || '%') as has_own
                    from business_documents where business_id=${sq(r.id)} and tag=${sq(r.tag)} order by version desc limit 1`)[0];
  if (Number(back.version) !== r.v + 1 || !back.has_own) { console.error(`      WROTE BUT THE READ-BACK DISAGREES: ${JSON.stringify(back)}`); refused++; continue; }
  console.log(`      WROTE v${back.version} and read it back: the page names its own number`);
  done++;
}

console.log(`\n${done} page(s) grounded · ${refused} refused on a postcondition.`);
if (!APPLY) console.log(`Dry run. Nothing written.`);
process.exit(refused ? 1 : 0);
