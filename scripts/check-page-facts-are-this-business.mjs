#!/usr/bin/env node
/**
 * [RULE] A PAGE MAY NOT PUBLISH ANOTHER BUSINESS'S CONTACT DETAILS — ON EITHER STORE.
 *
 *   node scripts/check-page-facts-are-this-business.mjs
 *
 * ══ WHY THIS FILE WAS REWRITTEN, 2026-09-17 ═════════════════════════════════════════════════
 *
 * It read `business_documents.rendered_html` and nothing else. **The four market businesses serve
 * from the classic store, `businesses.meta` — Graef among them.** So the check whose stated job is
 * "a PAGE may not publish another business's contact details" did not look at the page of the only
 * business running real work through Hubly, while its own title claimed every page.
 *
 * That is Lesson 97 — a check that covers one instance of a surface covers none of them — and it was
 * found by the audit written for L97, then confirmed by opening the file.
 *
 * ══ THE STORE LIST IS DERIVED FROM CONTENT, NOT TYPED IN ════════════════════════════════════
 *
 * A hand-written `["rendered_html", "meta"]` would be the hand-maintained-set disease arriving in the
 * fix for the hand-maintained-set disease. So the stores are DISCOVERED: every text/jsonb column on
 * the two tables a public page reader selects from is examined, and a column is a PAGE STORE if its
 * values carry page-shaped content — markup, or a structured document. A scalar record field
 * (`phone`, `city`) never qualifies, because it holds a fact rather than a rendering of one.
 *
 * Gating on CONTENT rather than on our bookkeeping about content is Lesson 86: "does this column hold
 * page-shaped content" cannot be wrong about an owner the way "is this business on the new store" can.
 * A third store appearing tomorrow is covered tomorrow, with no edit here.
 *
 * ══ AND THE CLASSIC STORE IS READ AS WHAT IT RENDERS ════════════════════════════════════════
 *
 * `businesses.meta` is jsonb, and its raw text contains INTEGERS — epoch-seconds timestamps and ids.
 * An epoch-seconds value in 2026 is exactly ten digits, so a ten-digit matcher over raw JSON reads
 * timestamps as phone numbers. Measured 2026-09-17: that manufactured four false contradictions out
 * of seven in a neighbouring sweep. Only STRING VALUES are searched, and a phone needs a separator or
 * a `tel:` href — the cost of which is stated: a page writing `8015559001` bare is not counted.
 *
 * READ-ONLY. Every statement is a SELECT. `graefs-autocare` is read and never written.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};

/* ── THE DERIVATION, IN TWO TESTS THAT MUST BOTH HOLD ─────────────────────────────────────────
 *
 * A PAGE STORE is a column that is
 *   (a) RETURNED BY A PUBLIC READER — so a customer is actually served it, and
 *   (b) PAGE-SHAPED — it carries markup or a nested document rather than a scalar fact.
 *
 * Neither test alone is enough, and the first version of this rewrite used only (b). It derived FOUR
 * stores and two of them were wrong: `business_documents.document` (the AST, which no public reader
 * returns — so every finding on it was a duplicate of the same finding on its own render) and
 * `business_documents.design_rationale` (the MODEL'S REASONING TEXT, which no customer ever sees).
 * A check that reports a stranger's phone number found in a design rationale is reporting on a
 * surface nobody is served, and it would have been acted on as if a customer could dial it.
 *
 * Test (a) alone is not enough either: `get_public_business` is `select to_jsonb(b) - 'draft_token'`,
 * so EVERY column of `businesses` is public, `phone` and `email` included. Those are the RECORD — the
 * truth this check compares against — not the page. (b) is what separates them.
 *
 * Both tests are asked of the live database. A third store appearing tomorrow is covered tomorrow. */
let cols, fnDefs;
try {
  cols = q(`select table_name, column_name from information_schema.columns
             where table_schema='public' and table_name in ('businesses','business_documents')
               and data_type in ('text','jsonb','json','character varying')
             order by table_name, column_name`);
  fnDefs = q(`select p.proname, pg_get_functiondef(p.oid) as def
                from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.proname like 'get\\_public%'`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }
if (!fnDefs.length) {
  console.error("CANNOT RUN — no get_public_* reader was found, so 'what is a customer served' could not be derived. " +
    "Guessing the store list here is the defect this check was rewritten to remove.");
  process.exit(2);
}

/** Is this column returned by a public reader? `to_jsonb(<alias>)` means the WHOLE row. */
const publicCols = new Set();
for (const f of fnDefs) {
  const def = String(f.def);
  const wholeRow = /to_jsonb\s*\(\s*[a-z_]+\s*\)/i.test(def);
  const from = [...def.matchAll(/from\s+public\.([a-z_]+)/gi)].map((m) => m[1]);
  for (const c of cols) {
    if (wholeRow && from.includes(c.table_name)) { publicCols.add(`${c.table_name}.${c.column_name}`); continue; }
    if (from.includes(c.table_name) && new RegExp(`\\b${c.column_name}\\b`).test(def))
      publicCols.add(`${c.table_name}.${c.column_name}`);
  }
}

/* PAGE-SHAPED, asked in ONE query rather than one per column. The first version issued a round trip
   per candidate and had to be killed at two minutes. */
const shapeTests = cols.map((c) =>
  `select '${c.table_name}.${c.column_name}' as k, count(*) as n from public.${c.table_name}
     where "${c.column_name}" is not null
       and ( "${c.column_name}"::text like '%<%>%'
             or ( "${c.column_name}"::text like '{%' and length("${c.column_name}"::text) > 80 ) )`).join(" union all ");
let shaped;
try { shaped = q(shapeTests); }
catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }
const shapedRows = new Map(shaped.map((r) => [r.k, Number(r.n)]));

const isPageStore = cols
  .map((c) => ({ table: c.table_name, col: c.column_name, key: `${c.table_name}.${c.column_name}` }))
  .filter((c) => publicCols.has(c.key) && (shapedRows.get(c.key) || 0) > 0)
  .map((c) => ({ ...c, rows: shapedRows.get(c.key) }));

const excluded = cols
  .map((c) => ({ key: `${c.table_name}.${c.column_name}`, pub: publicCols.has(`${c.table_name}.${c.column_name}`), shaped: (shapedRows.get(`${c.table_name}.${c.column_name}`) || 0) > 0 }))
  .filter((c) => c.shaped && !c.pub);

if (isPageStore.length < 2) {
  console.error(`CANNOT RUN — derived ${isPageStore.length} page store(s) from ${cols.length} candidate column(s). ` +
    `This product has at least two — a document store and the classic archetype — so a derivation ` +
    `answering fewer than two has FAILED, and scanning one store while claiming every page is exactly ` +
    `the defect this rewrite removes. Do not let it pass as a narrow green.`);
  process.exit(2);
}
console.log(`DERIVED PAGE STORES — public-reader-exposed AND page-shaped (${isPageStore.length} of ${cols.length} candidate columns):`);
for (const s of isPageStore) console.log(`  ${s.key}  (${s.rows} row(s) carry page-shaped content)`);
if (excluded.length) {
  console.log(`  EXCLUDED, page-shaped but NOT served to a customer — a finding here would be about a`);
  console.log(`  surface nobody sees: ${excluded.map((e) => e.key).join(", ")}`);
}
console.log(`  public readers consulted: ${fnDefs.map((f) => f.proname).join(", ")}`);
console.log();

/* ── STEP 3: THE CORPUS, with every derived store per business ────────────────────────────────── */
const bizCols = isPageStore.filter((s) => s.table === "businesses").map((s) => `b."${s.col}"::text as store_${s.col}`);
const docCols = isPageStore.filter((s) => s.table === "business_documents").map((s) =>
  `(select d."${s.col}"::text from business_documents d where d.business_id=b.id order by d.version desc limit 1) as store_${s.col}`);
let rows;
try {
  rows = q(`select b.slug, b.account_kind, b.claimed_at is not null as claimed, coalesce(b.phone,'') as phone,
                   coalesce(b.email,'') as email${bizCols.length ? ", " + bizCols.join(", ") : ""}${docCols.length ? ", " + docCols.join(", ") : ""}
              from businesses b`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const digits = (s) => String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
/** The string values of a JSON document, or the text itself. Never raw JSON: its integers are not facts. */
const renderable = (text) => {
  const t = String(text || "");
  if (!/^\s*[{[]/.test(t)) return t;
  let o; try { o = JSON.parse(t); } catch (_) { return t; }
  const out = [];
  const walk = (v) => { if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(o);
  return out.join("\n");
};
/** Phones on a page: a separator or a tel: href required — see the header. */
const phonesIn = (text) => new Set([
  ...[...text.matchAll(/\(?\d{3}\)?[ .\-]\d{3}[ .\-]\d{4}/g)].map((m) => digits(m[0])),
  ...[...text.matchAll(/tel:\+?([\d .()\-]{10,20})/gi)].map((m) => digits(m[1])),
].filter((d) => d.length === 10));
const emailsIn = (text) => new Set([...text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)]
  .map((m) => m[0].toLowerCase()));

/* WHOSE CONTACT DETAIL IS THIS, across the whole corpus? */
const phoneOwner = new Map(), emailOwner = new Map();
for (const r of rows) {
  const d = digits(r.phone); if (d.length === 10) phoneOwner.set(d, r.slug);
  const e = String(r.email || "").toLowerCase().trim(); if (e.includes("@")) emailOwner.set(e, r.slug);
}

let failed = 0, scanned = 0, pagesSeen = 0;
const perStore = {};
for (const r of rows) {
  let any = false;
  for (const s of isPageStore) {
    const raw = r["store_" + s.col];
    if (!raw) continue;
    any = true;
    const label = `${s.table}.${s.col}`;
    perStore[label] = (perStore[label] || 0) + 1;
    const text = renderable(raw);
    const mine = digits(r.phone), myEmail = String(r.email || "").toLowerCase().trim();
    for (const d of phonesIn(text)) {
      if (d === mine) continue;
      scanned++;
      const who = phoneOwner.get(d);
      if (who && who !== r.slug) {
        console.error(`FAIL  [${label}]  ${r.slug} (${r.account_kind}${r.claimed ? ", claimed" : ""}) publishes ${d}`);
        console.error(`      that number belongs to ${who}; its own record says ${r.phone || "(no phone)"}`);
        failed++;
      }
    }
    for (const e of emailsIn(text)) {
      if (e === myEmail) continue;
      scanned++;
      const who = emailOwner.get(e);
      if (who && who !== r.slug) {
        console.error(`FAIL  [${label}]  ${r.slug} (${r.account_kind}${r.claimed ? ", claimed" : ""}) publishes ${e}`);
        console.error(`      that address belongs to ${who}; its own record says ${r.email || "(no email)"}`);
        failed++;
      }
    }
  }
  if (any) pagesSeen++;
}

console.log(`${pagesSeen} businesses with a page in at least one derived store — by store: ` +
  Object.entries(perStore).map(([k, n]) => `${k} ${n}`).join(" · "));
console.log(`${phoneOwner.size} businesses with a phone on record, ${emailOwner.size} with an email · ` +
  `${scanned} contact detail(s) on a page that were not that page's own`);
console.log(`A detail nobody in the corpus claims is LEFT ALONE: a supplier or a partner is not ours to judge.`);

/* THE MARKET FOUR, REPORTED BY NAME WHETHER OR NOT THEY FAIL. The whole reason for the rewrite was
   that these were invisible, and "no failures" is only meaningful if their pages were actually read. */
const market = rows.filter((r) => r.account_kind === "market");
console.log(`\nTHE MARKET BUSINESSES, AND WHICH STORE EACH WAS READ FROM (${market.length}):`);
for (const r of market) {
  const mineStores = isPageStore.filter((s) => r["store_" + s.col]);
  const has = mineStores.map((s) => s.key);
  const text = mineStores.map((s) => renderable(r["store_" + s.col])).join("\n");
  const ph = [...phonesIn(text)], em = [...emailsIn(text)];
  console.log(`  ${r.slug.padEnd(38)} ${has.length ? has.join(" + ") : "NO PAGE IN ANY DERIVED STORE"}`);
  console.log(`      record phone ${r.phone || "(none)"} · page phones ${JSON.stringify(ph)} · page emails ${JSON.stringify(em)}`);
}

if (failed) {
  console.error(`\nFAIL — ${failed} finding(s): a page publishing a contact detail that belongs to a DIFFERENT business.`);
  console.error("A fabricated detail reaches nobody. A real one belonging to someone else reaches THEM.");
  process.exit(1);
}
console.log(`\nPASS — no page in any derived store publishes another business's contact details.\n`);
