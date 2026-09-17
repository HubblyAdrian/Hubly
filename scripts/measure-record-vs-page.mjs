#!/usr/bin/env node
/**
 * HOW MANY BUSINESSES HAVE A RECORD FIELD THAT DISAGREES WITH WHAT THEIR PAGE SERVES?
 *
 *   node scripts/measure-record-vs-page.mjs
 *
 * A MEASUREMENT, NOT A FIX. Adrian, 2026-09-17, asked for the count, the distribution by field and
 * the worst single example, explicitly without a repair pass.
 *
 * ══ WHAT WOULD MAKE THIS NUMBER WRONG — STATED BEFORE THE NUMBER ════════════════════════════
 *
 * On 2026-09-15 "nine businesses quote a price the page never shows" was reported off two detectors
 * that agreed because they shared a broken formatter. The real answer was zero, and it reached a
 * customer as fact. So, before any number below is quoted:
 *
 *  1. **A "disagreement" here is A FORM NOT FOUND, never a proven contradiction.** The page is
 *     searched for the record's value in the forms we know how to write; a page that states the
 *     same fact in a form this script cannot recognise counts as a disagreement and IS A FALSE
 *     POSITIVE. That is the whole reason phone matching is done on DIGITS (which has no formatting)
 *     and the reason the per-field counts are reported separately rather than summed into a score.
 *  2. **THE OPPOSITE DIRECTION IS NOT MEASURED AT ALL.** "The page says something the record does
 *     not" — a phone on the page that no record holds — is a different question, answered by
 *     check-page-facts-are-this-business. Nothing here counts it.
 *  3. **ABSENCE IS NOT DISAGREEMENT AND IS COUNTED SEPARATELY.** A record field the page simply
 *     never mentions is `missing`, not `wrong`. Conflating them is how "nine businesses" happened.
 *     Only `wrong` — the page shows a DIFFERENT value of the same kind — is a contradiction.
 *  4. **BOTH STORES, OR THE ANSWER IS ABOUT OUR SETUP AND NOT ABOUT THEM.** 188 businesses serve
 *     from `business_documents.rendered_html`; the classic path serves from `businesses.meta`, and
 *     four market businesses including Graef are on it. A sweep over one store reports a hole in
 *     our coverage as a fact about the owners (Lesson 86, and the confirmed L97 candidate).
 *
 * Exit: 0 always — it is a measurement. 2 if it could not read.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rateLine, subsetLine, withoutFixtures } from "./lib/kind-split.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let rows;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select b.slug, b.account_kind, b.claimed_at is not null as claimed,
            coalesce(b.phone,'') as phone, coalesce(b.email,'') as email,
            coalesce(b.address,'') as address, coalesce(b.city,'') as city,
            coalesce(b.state,'') as state, coalesce(b.name,'') as name, b.meta::text as meta,
            (select d.rendered_html from business_documents d where d.business_id=b.id
               order by d.version desc limit 1) as html
     from businesses b`], { encoding: "utf8", cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  rows = JSON.parse(out.slice(s, e));
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const digits = (s) => String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ── THE SERVED TEXT OF A PAGE, FROM WHICHEVER STORE SERVES IT ───────────────────────────────
   Not "the freeform store, and classic if we get round to it". Both, or the number is about us. */
function served(r) {
  const parts = [];
  if (r.html) parts.push({ store: "business_documents", text: String(r.html) });
  if (r.meta && r.meta !== "null") parts.push({ store: "businesses.meta", text: String(r.meta) });
  return parts;
}

/* ── THE FIELDS, AND HOW EACH ONE IS LOOKED FOR ──────────────────────────────────────────────
   Each `find` returns the values of that KIND present on the page, so "missing" (none of that kind
   anywhere) is distinguishable from "wrong" (that kind present, this value not among them). */
const FIELDS = [
  { name: "phone", get: (r) => digits(r.phone), ok: (v) => v.length === 10,
    // A SEPARATOR OR A tel: HREF IS REQUIRED. A bare ten-digit run is not counted as a phone,
    // because an epoch-seconds timestamp in 2026 IS a bare ten-digit run, and reading one as a phone
    // is what manufactured the first run's seven "contradictions" (1787241682, 1601362840 …). The
    // cost of the choice is stated rather than hidden: a page writing `8015559001` with no
    // punctuation and no tel: link counts as NOT STATING a phone, not as contradicting one. For a
    // detector whose output gets acted on, the false positive is the expensive error.
    find: (t) => [...new Set([
      ...[...t.matchAll(/\(?\d{3}\)?[ .\-]\d{3}[ .\-]\d{4}/g)].map((m) => digits(m[0])),
      ...[...t.matchAll(/tel:\+?([\d .()\-]{10,20})/gi)].map((m) => digits(m[1])),
    ].filter((d) => d.length === 10))] },
  { name: "email", get: (r) => String(r.email || "").toLowerCase().trim(), ok: (v) => v.includes("@"),
    find: (t) => [...new Set([...t.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0].toLowerCase()))] },
  { name: "business name", get: (r) => norm(r.name), ok: (v) => v.length > 2,
    // A NAME HAS NO CLOSED SET OF FORMS on a page, so "which names does this page state" is not
    // answerable. Only presence is: the record's own name, normalised, either appears or does not.
    find: null },
  { name: "city", get: (r) => norm(r.city), ok: (v) => v.length > 2, find: null },
  { name: "street address", get: (r) => norm(r.address), ok: (v) => v.length > 6, find: null },
];

const byField = {};
const offenders = new Map();
const consideredRows = [];
for (const r of rows) {
  const pages = served(r);
  if (!pages.length) continue;
  consideredRows.push(r);
  const all = pages.map((p) => p.text).join("\n");
  for (const f of FIELDS) {
    const v = f.get(r);
    if (!f.ok(v)) continue;                                    // nothing recorded to disagree with
    byField[f.name] = byField[f.name] || { recorded: 0, wrong: 0, missing: 0, agrees: 0 };
    byField[f.name].recorded++;
    if (f.find) {
      const onPage = f.find(all);
      if (!onPage.length) { byField[f.name].missing++; continue; }
      if (onPage.includes(v)) { byField[f.name].agrees++; continue; }
      byField[f.name].wrong++;
      const e = offenders.get(r.slug) || { slug: r.slug, kind: r.account_kind, claimed: r.claimed, fields: [] };
      e.fields.push(`${f.name}: record ${JSON.stringify(v)}, page shows ${JSON.stringify(onPage.slice(0, 3))}`);
      offenders.set(r.slug, e);
    } else {
      const present = norm(all).includes(v);
      if (present) byField[f.name].agrees++; else byField[f.name].missing++;
    }
  }
}

console.log(`RECORD vs SERVED PAGE — ${rows.length} businesses, ${consideredRows.length} with a page in either store\n`);
console.log(`READ THE CAVEATS AT THE TOP OF THIS FILE BEFORE QUOTING ANY NUMBER HERE.`);
console.log(`"wrong" = the page states a value OF THE SAME KIND that is not the record's.`);
console.log(`"missing" = the page states no value of that kind at all — NOT a contradiction.`);
console.log(`Only phone and email have a closed enough form to tell those apart; name/city/address`);
console.log(`can only be asked "is the recorded string present", so they have no "wrong" column.\n`);

for (const [name, c] of Object.entries(byField)) {
  const tell = c.recorded ? `${((c.wrong / c.recorded) * 100).toFixed(1)}%` : "—";
  console.log(`  ${name.padEnd(16)} recorded ${String(c.recorded).padStart(4)}  ` +
    `agrees ${String(c.agrees).padStart(4)}  ${FIELDS.find((f) => f.name === name).find ? `WRONG ${String(c.wrong).padStart(3)} (${tell})  ` : "".padEnd(19)}` +
    `not stated ${String(c.missing).padStart(4)}`);
}

const list = [...offenders.values()];
console.log(`\n${list.length} business(es) with AT LEAST ONE field the page contradicts.`);
// FIXTURES OUT OF THE DENOMINATOR. hubly-paging-fixture and hubly-classic-fixture are ours, built
// to make checks runnable, and counting them as businesses inflates the base of a rate that is
// supposed to describe real records.
const base = withoutFixtures(consideredRows);
const real = list.filter((o) => base.some((b) => b.slug === o.slug));
console.log("  " + rateLine("businesses whose page contradicts a recorded field", real.length,
  base, real.map((o) => ({ account_kind: o.kind })), { store: "both" }));
// THE RATE LINE SPLITS THE DENOMINATOR. Who the OFFENDERS are is a different question and the one
// that decides whether this matters — a contradiction on a test draft is a note, the same
// contradiction on a market business is a customer dialling a stranger.
console.log("  " + subsetLine("of those, by account_kind", real.map((o) => ({ account_kind: o.kind }))));
console.log(`\nWORST SINGLE EXAMPLE — most contradicted fields, then a claimed site over a draft:`);
list.sort((a, b) => b.fields.length - a.fields.length || (b.claimed ? 1 : 0) - (a.claimed ? 1 : 0));
for (const o of list.slice(0, 8)) {
  console.log(`  ${o.slug}  [${o.kind}${o.claimed ? ", claimed" : ""}]  ${o.fields.length} field(s)`);
  for (const f of o.fields) console.log(`      ${f}`);
}
if (!list.length) console.log(`  none — and that is a claim about the FORMS above, not proof every page is right.`);
