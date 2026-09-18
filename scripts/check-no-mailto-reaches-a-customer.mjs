#!/usr/bin/env node
/**
 * [RULE] NO STORED PAGE MAY CARRY A mailto:, AND NO SHARED MODULE MAY EMIT ONE.
 *
 *   node scripts/check-no-mailto-reaches-a-customer.mjs
 *
 * ══ RULED BY ADRIAN, 2026-09-17 ═════════════════════════════════════════════════════════════
 *
 *   "Fix hubly_contact.ts. Do not lift the ban. An enquiry sent by email never reaches Hubly, so no
 *    booking, no lead, no record, and it lands in an inbox an owner may not watch."
 *
 * THE BAN EXISTED AND COULD NOT ENFORCE ITSELF. `hubly_document.ts:648` rejects a mailto href in an
 * AST — and `hubly_contact.ts` EMITTED one, in HTML, at two separate places, on the freeform path.
 * One module wrote what another refused, so THREE of the four stored pages carrying a mailto were
 * written AFTER the ban went in on 2026-08-17. A validator that guards one representation of a page
 * does not guard the page.
 *
 * ══ TWO LEGS, BECAUSE THE DEFECT HAD TWO HALVES ═════════════════════════════════════════════
 *
 *   LEG 1  THE RECORD — no latest stored version in EITHER derived store carries a mailto. Both
 *          stores, derived the same way check-page-facts-are-this-business derives them (a column a
 *          public reader returns, carrying page-shaped content), because a check that scans one store
 *          while claiming every page is the defect L97 is about.
 *   LEG 2  THE WRITER — no shared module emits one. Leg 1 goes green the moment the pages are
 *          patched, and would stay green for exactly as long as it takes the writer to run again.
 *          Fixing the stored pages without fixing the emitter is treating a symptom.
 *
 * BOTH ARE NEGATIVE ASSERTIONS, which per Lesson 98 means each needs a break aimed at IT ALONE — a
 * compound break proves nothing about either. The two breaks are named in the header of the commit
 * that shipped this: plant a mailto in a stored document (leg 1 alone), and restore the emit in
 * hubly_contact.ts (leg 2 alone).
 *
 * LEG 2 IS NOT A GREP FOR THE WORD. A file may legitimately MENTION mailto — this file does, the
 * validator's error message does, and hubly_contact.ts's own comment explaining the removal does. It
 * looks for a mailto being CONSTRUCTED into markup or a URL: `href="mailto:` / `href='mailto:` /
 * `mailto:${`. The 2026-09-16 scar is exactly this — an absence marker matched the comment explaining
 * a deletion and reported NOT CONFIRMED against a correct deploy, twice.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
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
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* ══ LEG 1 — THE RECORD, ON EVERY DERIVED STORE ══════════════════════════════════════════════ */
let stores, hits;
try {
  const cols = q(`select table_name, column_name from information_schema.columns
                   where table_schema='public' and table_name in ('businesses','business_documents')
                     and data_type in ('text','jsonb','json','character varying')`);
  const fns = q(`select pg_get_functiondef(p.oid) as def from pg_proc p
                   join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname like 'get\\_public%'`);
  const publicCols = new Set();
  for (const f of fns) {
    const def = String(f.def);
    const whole = /to_jsonb\s*\(\s*[a-z_]+\s*\)/i.test(def);
    const from = [...def.matchAll(/from\s+public\.([a-z_]+)/gi)].map((m) => m[1]);
    for (const c of cols) {
      if (whole && from.includes(c.table_name)) { publicCols.add(`${c.table_name}.${c.column_name}`); continue; }
      if (from.includes(c.table_name) && new RegExp(`\\b${c.column_name}\\b`).test(def))
        publicCols.add(`${c.table_name}.${c.column_name}`);
    }
  }
  const shape = q(cols.map((c) =>
    `select '${c.table_name}.${c.column_name}' as k, count(*) as n from public.${c.table_name}
       where "${c.column_name}" is not null and ( "${c.column_name}"::text like '%<%>%'
         or ( "${c.column_name}"::text like '{%' and length("${c.column_name}"::text) > 80 ) )`).join(" union all "));
  const shaped = new Map(shape.map((r) => [r.k, Number(r.n)]));
  stores = cols.map((c) => `${c.table_name}.${c.column_name}`)
    .filter((k) => publicCols.has(k) && (shaped.get(k) || 0) > 0);
  if (stores.length < 2) {
    console.error(`CANNOT RUN — derived ${stores.length} page store(s). This product has at least two, ` +
      `so a derivation answering fewer has failed and must not pass as a narrow green.`);
    process.exit(2);
  }
  const docStores = stores.filter((k) => k.startsWith("business_documents."));
  const bizStores = stores.filter((k) => k.startsWith("businesses."));
  const clauses = [];
  for (const k of docStores) clauses.push(
    `select b.slug, '${k}' as store from business_documents d join businesses b on b.id=d.business_id
      where d.version = (select max(v.version) from business_documents v where v.business_id=d.business_id and v.tag=d.tag)
        and d."${k.split(".")[1]}"::text like '%mailto:%'`);
  for (const k of bizStores) clauses.push(
    `select b.slug, '${k}' as store from businesses b where b."${k.split(".")[1]}"::text like '%mailto:%'`);
  hits = q(clauses.join(" union all ") + " order by 1");
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

leg("RULE", "no latest stored page carries a mailto:, in any derived store",
  hits.length === 0,
  `${stores.length} derived store(s) scanned — ${stores.join(", ")} · ` +
  (hits.length ? `FOUND: ${hits.map((h) => h.slug + " [" + h.store + "]").join(", ")}`
               : "no page in any of them carries one. SCOPED: this is the LATEST version per (business, tag); " +
                 "older versions keep theirs, because history is not rewritten"));

/* ══ LEG 2 — THE WRITER ══════════════════════════════════════════════════════════════════════ */
const shared = [];
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
  if (f.name === "node_modules" || f.name.startsWith(".")) continue;
  const p = join(d, f.name);
  if (f.isDirectory()) walk(p); else if (/\.(ts|js|mjs|html)$/.test(f.name)) shared.push(p);
} };
walk(join(ROOT, "supabase/functions"));
walk(join(ROOT, "public"));
/* ══ WHAT LEG 2 IS ABOUT, AND THE SIGNAL THAT SCOPES IT ══════════════════════════════════════
 *
 * The first version of this leg flagged SIXTEEN hits and most of them were correct code: Hubly's own
 * `support@myhubly.app` footer link, the owner emailing a lead from his CRM, an invoice sent from the
 * jobs board, a signup notification's Reply-To. A mailto is only the defect when it is **a business's
 * enquiry path on a page a customer sees** — the ban's reason is that such an enquiry reaches nobody
 * in Hubly. A mailto that opens the OWNER'S mail client to write to HIS customer is a tool working
 * exactly as intended.
 *
 * SO THE SIGNAL IS WHOSE ADDRESS IS BEING LINKED, and it is read from the expression:
 *
 *   IN SCOPE      the address is the BUSINESS's own — facts.email, S.email, biz.email, or a local
 *                 `email` assigned from one of those within the preceding lines. That is the page's
 *                 contact detail, and a customer is the one who clicks it.
 *   OUT OF SCOPE  a literal address (Hubly's own support), or a CUSTOMER/LEAD/OWNER-recipient address
 *                 (lead.email, j.email, card.email, reach.email, ownerEmail, customer_email) — a
 *                 person writing to someone else, from a tool, on purpose.
 *
 * Every hit is PRINTED with its classification, in scope or not, so the scoping is visible rather
 * than buried in a regex. An out-of-scope list nobody can read is an exception list, which is the
 * hand-maintained set this repo keeps paying for.
 *
 * AND IT IS CONSTRUCTED, NOT MENTIONED: `href="mailto:`, `mailto:${`, `'mailto:' +`. Never the bare
 * word — every comment about the ban contains it, this file included, and hubly_contact.ts's comment
 * explaining the removal does too. The 2026-09-16 scar is exactly that: an absence marker matched the
 * comment that explained a deletion and reported NOT CONFIRMED against a correct deploy, twice.
 *
 * A REWRITE OF AN EXISTING HREF IS NOT AN EMIT. hubly_freeform.ts's syncedHref only runs when the
 * element ALREADY has a mailto, and it keeps that href truthful when the owner edits the visible
 * address; making it return null would produce a page that shows one address and mails another. It is
 * recognised by the `/^mailto:/i.test(href)` guard above it, not by being named here. */
const EMIT = /href\s*=\s*["'`\\]{0,2}\s*mailto:|mailto:\$\{|['"`]mailto:['"`]\s*\+|'mailto:'\s*\+/i;
const BUSINESS_EMAIL = /\b(facts|S|biz|business|record|page|site)\.email\b|\bbusinessEmail\b/;
const SOMEONE_ELSE = /\b(lead|j|card|reach|row|cust|customer|contact|person|inv|invoice|quote|msg)\.(email|customer_email)\b|\bownerEmail\b|\bcustomer_email\b|mailto:[a-z0-9._%+-]+@/i;

const hitsW = [];
for (const p of shared) {
  const src = readFileSync(p, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*(\/\/|\*|\/\*|--)/.test(L)) continue;                    // a comment is not an emitter
    if (!EMIT.test(L)) continue;
    const guard = lines.slice(Math.max(0, i - 3), i).join(" ");
    if (/\/\^mailto:\/i\.test\(\s*href/.test(guard)) {
      hitsW.push({ at: `${p.slice(ROOT.length + 1)}:${i + 1}`, scope: "out", why: "rewrites an EXISTING mailto href to keep it truthful; it cannot create one", L });
      continue;
    }
    if (/\.match\(|matchAll\(|\.test\(|includes\(|indexOf\(|\breplace\(|\bregexp/i.test(L)) {
      hitsW.push({ at: `${p.slice(ROOT.length + 1)}:${i + 1}`, scope: "out", why: "reads or matches a mailto, does not write one", L });
      continue;
    }
    // ══ MARKUP OR NAVIGATION? The structural distinction, and it beats every name pattern ═══════
    //
    // `href="mailto:…"` written INTO A TEMPLATE is a LINK A VISITOR SEES on a page. `location.href =
    // 'mailto:' + …` or `window.open('mailto:' + …)` is a TOOL ACTION — an owner clicking to compose
    // a message to someone. Only the first can be a business's enquiry path, and the difference is in
    // the construct rather than in whether I recognised the variable name. Four hits were classified
    // "unclassifiable, therefore in scope" until this test existed, and three of them were
    // `location.href = 'mailto:' + c.email` in the owner's operations app.
    const navigates = /\b(?:location\s*\.\s*href|window\s*\.\s*open|\w+\s*\.\s*href)\s*=\s*['"`]?\s*(?:mailto:|['"`]mailto:)/.test(L);
    if (navigates) {
      hitsW.push({ at: `${p.slice(ROOT.length + 1)}:${i + 1}`, scope: "out", why: "imperative navigation, not markup — a tool composing a message, never a link on a page", L });
      continue;
    }
    // WHOSE ADDRESS? The line first, then a short window for a local assigned from the business.
    const win = lines.slice(Math.max(0, i - 12), i + 1).join("\n");
    const localFromBusiness = /\b(?:const|let|var)\s+email\s*=\s*[^;\n]*(?:facts|S|biz|business|record)\.email/.test(win);
    if (SOMEONE_ELSE.test(L) && !BUSINESS_EMAIL.test(L)) {
      hitsW.push({ at: `${p.slice(ROOT.length + 1)}:${i + 1}`, scope: "out", why: "a literal address, or someone else's — a tool writing TO a person, not a page's enquiry path", L });
      continue;
    }
    if (BUSINESS_EMAIL.test(L) || localFromBusiness) {
      hitsW.push({ at: `${p.slice(ROOT.length + 1)}:${i + 1}`, scope: "IN", why: "links the BUSINESS's own address — this is a customer-facing enquiry path", L });
      continue;
    }
    hitsW.push({ at: `${p.slice(ROOT.length + 1)}:${i + 1}`, scope: "IN", why: "could not establish whose address this is, so it counts — an unclassifiable contact link is not given the benefit of the doubt", L });
  }
}
const inScope = hitsW.filter((h) => h.scope === "IN");
leg("RULE", "no module constructs a mailto: for a BUSINESS's own address on a customer-facing page",
  inScope.length === 0,
  `${shared.length} file(s) under supabase/functions/ and public/ scanned · ${hitsW.length} constructed ` +
  `mailto(s) found, ${inScope.length} in scope. An unclassifiable one counts as in scope.` +
  (inScope.length ? "\n        IN SCOPE: " + inScope.map((h) => h.at).join(", ") : ""));

console.log(`\n        every constructed mailto and why it is or is not in scope:`);
for (const h of hitsW.sort((a, b) => (a.scope === b.scope ? 0 : a.scope === "IN" ? -1 : 1)))
  console.log(`          [${h.scope === "IN" ? "IN SCOPE" : "out     "}] ${h.at}  — ${h.why}`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
if (bad.length) console.log(`An enquiry sent by email never reaches Hubly: no booking, no lead, no record.`);
process.exit(bad.length ? 1 : 0);
