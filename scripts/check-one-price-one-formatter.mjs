#!/usr/bin/env node
/**
 * [RULE] A PRICE IS PARSED ONCE, STORED AS A NUMBER, AND RENDERED BY ONE FORMATTER.
 *
 *   node scripts/check-one-price-one-formatter.mjs
 *
 * ══ WHAT WAS MEASURED, AND WHY IT WAS NOT "THREE FORMATTERS" ═════════════════════════════════
 *
 * On evergreen-yard-care, 2026-09-18, one section showed three prices in three formats:
 * `111.222.333`, `$111,222,333` and `50`. The three prices in the SAME section that Adrian had NOT
 * touched read `$130`, `$150`, `$85` — uniform. That is the whole diagnosis: generation has exactly
 * ONE formatter, and the freeform inline-edit path stored raw keystrokes without going near it.
 *
 * Worse than the formatting: `services` held 95 / 220 / 40 for those three while the page said
 * otherwise. The inline edit patched the document's TEXT through `directFreeformEdit` and never wrote
 * the record, so a page and its own record disagreed about what the owner charges — and the page is
 * the half a customer reads.
 *
 * RULED BY ADRIAN: accept what a human types, parse to a number, store the number, render through the
 * one formatter; refuse an unparseable value AT ENTRY rather than storing a string or substituting
 * zero.
 *
 * SCOPED: this covers the SERVICE price path — hcParsePrice, hcPriceText, svcDisplayPrice, and the
 * canvas's price-anchor branch. It does NOT claim every `'$' + n` in a 3MB shell goes through one
 * formatter; invoices, revenue totals and payouts have their own money paths and were not in the
 * ruling. Leg 2 states which surface it is asserting about rather than implying the whole file.
 *
 * Leg 4 reads PRODUCTION. When it cannot, it reports FAILURE, not skip — with a bounded retry first,
 * because a transient is not a disagreement (a flaky live read was recorded as a neighbour's COMPOUND
 * earlier today).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };
const canvas = readFileSync(join(ROOT, "public/hubly.html"), "utf8");

function liveRead(args, tries = 3) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try { return { out: execFileSync("supabase", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 }) }; }
    catch (e) { last = e.message.split("\n")[0]; }
  }
  return { out: null, err: `${tries} attempt(s); last: ${last}` };
}

/* THE REAL MODULE, loaded and run — not reimplemented here. It moved out of hubly.html into a shared
   file the moment platform-home needed the same parse, so this now loads the file both shells load. */
const MODULE = "public/hubly-price.js";
const modSrc = readFileSync(join(ROOT, MODULE), "utf8");
let hcParsePrice, hcPriceText;
try {
  const W = {};
  new Function("window", modSrc)(W);
  hcParsePrice = W.HUBLY_PRICE && W.HUBLY_PRICE.parse;
  hcPriceText = W.HUBLY_PRICE && W.HUBLY_PRICE.text;
} catch (e) { console.error("CANNOT RUN — " + MODULE + " did not evaluate: " + e.message); process.exit(2); }
if (typeof hcParsePrice !== "function" || typeof hcPriceText !== "function") {
  console.error("CANNOT RUN — " + MODULE + " did not define window.HUBLY_PRICE.parse/.text"); process.exit(2);
}
const shells = { "public/hubly.html": canvas, "public/platform-home.html": readFileSync(join(ROOT, "public/platform-home.html"), "utf8") };

/* ── LEG 1 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 an unparseable price is REFUSED, never coerced to a number",
  why: "fall back to parseFloat, which is the obvious implementation and the dangerous one: " +
       "parseFloat('50 dollars') is 50 and parseFloat('call me') is NaN — so a value the owner did " +
       "not type gets stored for the first, silently, on a page a customer reads.",
  file: "public/hubly-price.js",
  find: "    if (!/^\\d+(\\.\\d{1,2})?$/.test(t)) return null;   // anything else is REFUSED, not coerced",
  with: "    t = String(parseFloat(t));",
});
const REFUSE = ["", "call me", "50 dollars", "-5", "abc", "..", "$", "1e5"];
const ACCEPT = [["95", 95], ["$95", 95], ["  95  ", 95], ["111.222.333", 111222333],
                ["$111,222,333", 111222333], ["50", 50], ["1,234.56", 1234.56], ["1.234,56", 1234.56],
                ["12,50", 12.5], ["95.5", 95.5], ["0", 0], ["$1,000", 1000], ["1 000", 1000]];
const badRefuse = REFUSE.filter((v) => hcParsePrice(v) !== null);
const badAccept = ACCEPT.filter(([v, want]) => hcParsePrice(v) !== want);
leg("RULE", "1 an unparseable price is REFUSED, never coerced to a number",
  badRefuse.length === 0 && badAccept.length === 0,
  badRefuse.length || badAccept.length
    ? `refused-set leaks: ${JSON.stringify(badRefuse)}; accepted-set wrong: ` +
      JSON.stringify(badAccept.map(([v, w]) => [v, hcParsePrice(v), "want", w]))
    : `${ACCEPT.length} human spellings parse to the number meant (currency symbols, spaces, and ` +
      `both separator conventions — "1,234.56" and "1.234,56" both give 1234.56), and ${REFUSE.length} ` +
      `unreadable ones return null. null, not 0, because $0 is a PRICE a customer can act on and ` +
      `"I could not read this" is not. The real function is lifted out of the shipping file and run, ` +
      `not reimplemented here.`);

/* ── LEG 2 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 the service price renderer goes through the one formatter",
  why: "put svcDisplayPrice back to building its own '$' + s.price. It renders identically TODAY, so " +
       "nothing looks wrong — and the next change to how a price reads happens in one place and not " +
       "the other, which is how this section came to show three formats at once.",
  file: "public/hubly.html",
  find: "  return s.price?hcPriceText(s.price):'$--';",
  with: "  return s.price?('$'+s.price):'$--';",
});
const disp = canvas.slice(canvas.indexOf("function svcDisplayPrice(s){"));
const dispBody = disp.slice(0, disp.indexOf("\n}\n") + 2);
const ownFormat = /['"]\$['"]\s*\+/.test(dispBody);
leg("RULE", "2 the service price renderer goes through the one formatter",
  /hcPriceText\(/.test(dispBody) && !ownFormat,
  ownFormat ? `svcDisplayPrice still builds its own '$' + … string: ${JSON.stringify(dispBody.replace(/\s+/g, " ").slice(0, 120))}`
    : `svcDisplayPrice calls hcPriceText and builds no '$' string of its own. SCOPED to the SERVICE ` +
      `price renderer — invoices, revenue and payouts have their own money paths and were not in the ` +
      `ruling, so this leg does not claim anything about them.`);

/* ── LEG 3 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 a price anchor edit goes to the RECORD, not a document text patch",
  why: "send the price down the plain text-patch path like any other element. The page changes and " +
       "the `services` row does not — which is exactly the divergence measured on evergreen-yard-care " +
       "(record 95/220/40, page 111.222.333/$111,222,333/50) and invisible from the page alone.",
  file: "public/hubly.html",
  find: "        var priceKey = el.getAttribute && el.getAttribute('data-hubly-price');",
  with: "        var priceKey = null;",
});
const commit = canvas.slice(canvas.indexOf("el.addEventListener('blur', function onBlur(){"));
const commitBody = commit.slice(0, 2600);
const branches = /getAttribute\('data-hubly-price'\)/.test(commitBody);
const posts = /type:'hcFreeformPriceEdit'/.test(commitBody);
const refuses = /hcParsePrice\(now\)/.test(commitBody) && /el\.textContent = before;/.test(commitBody);
leg("RULE", "3 a price anchor edit goes to the RECORD, not a document text patch",
  branches && posts && refuses,
  `the commit path branches on data-hubly-price: ${branches}; posts hcFreeformPriceEdit: ${posts}; ` +
  `parses and restores the old text on refusal: ${refuses}. The service is read off the STAMP ` +
  `(data-hubly-price="<service name>"), not found by walking the DOM — a generated page is patched ` +
  `by an anchor stamped at build time, never by re-recognising layout.`);

/* ── LEG 4 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "4 [SHAPE] every price on the live page equals its own record value, formatted once",
  provenBy: "This leg reads PRODUCTION — the stored document and the services table — so no repo edit " +
            "can move it. PROVEN BY HAND on 2026-09-18 across one correction: BEFORE, three of six " +
            "prices on evergreen-yard-care's page disagreed with their rows and each other " +
            "(111.222.333 vs 95, $111,222,333 vs 220, 50 vs 40) while the untouched three matched; " +
            "AFTER 20260918220000, all six read $95 $220 $40 $130 $150 $85 and every one equals " +
            "hcPriceText(services.price) for its key. That is this assertion observed red and then " +
            "green for the reason it claims to catch.",
});
const r = liveRead(["db", "query", "--linked",
  "with latest as (select d.rendered_html h from business_documents d join businesses b on b.id=d.business_id " +
  "where b.slug='evergreen-yard-care' and d.tag='website' order by d.created_at desc limit 1) " +
  "select coalesce(string_agg(m[1] || '=' || m[2], '|'), '') as pairs from latest, " +
  "regexp_matches(h, 'data-hubly-price=\"([^\"]*)\">([^<]*)', 'g') as m"]);
let pageP = null;
if (r.out) { const m = r.out.match(/"pairs":\s*"([^"]*)"/); if (m) pageP = m[1]; }
const r2 = liveRead(["db", "query", "--linked",
  "select coalesce(string_agg(s.name || '=' || s.price::text, '|' order by s.name), '') as rows from services s " +
  "join businesses b on b.id=s.business_id where b.slug='evergreen-yard-care'"]);
let recP = null;
if (r2.out) { const m = r2.out.match(/"rows":\s*"([^"]*)"/); if (m) recP = m[1]; }
if (pageP === null || recP === null) {
  leg("SHAPE", "4 [SHAPE] every price on the live page equals its own record value, formatted once", false,
    `COULD NOT READ PRODUCTION (${r.err || r2.err || "no rows"}). Reported as FAILURE, not skipped: a ` +
    `leg that cannot run has proved nothing, and calling that a pass is the false green this repo ` +
    `exists to stop.`);
} else {
  const rec = new Map(recP.split("|").filter(Boolean).map((x) => { const i = x.lastIndexOf("="); return [x.slice(0, i), x.slice(i + 1)]; }));
  const page = pageP.split("|").filter(Boolean).map((x) => { const i = x.lastIndexOf("="); return [x.slice(0, i), x.slice(i + 1)]; });
  const wrong = page.filter(([k, shown]) => !rec.has(k) || shown !== hcPriceText(Number(rec.get(k))));
  leg("SHAPE", "4 [SHAPE] every price on the live page equals its own record value, formatted once",
    page.length > 0 && wrong.length === 0,
    page.length === 0 ? `no data-hubly-price anchors on the live page — VACUOUS, not a pass`
      : wrong.length ? `page disagrees with the record: ` +
          wrong.map(([k, v]) => `${k} shows ${JSON.stringify(v)}, record says ${hcPriceText(Number(rec.get(k)))}`).join("; ")
      : `all ${page.length} price anchor(s) on the live page equal hcPriceText(services.price) for ` +
        `their own key: ${page.map(([k, v]) => k + " " + v).join(", ")}. The count is part of the ` +
        `claim — "every one agrees" is trivially true of none.`);
}

/* ── LEG 5 — THE CLASS, ACROSS BOTH SHELLS ─────────────────────────────────────────────────── */
declareBreak({
  leg: "5 no shell parses a typed price with a bare Number() or parseFloat",
  why: "put `Number(priceRaw)` back on the Edit-details ADD row. It is the one control in the owner " +
       "shell that can create a service, and Number('$95') is NaN — so a price an owner typed " +
       "perfectly readably gets stored as NaN, silently, at the moment the service is created.",
  file: "public/platform-home.html",
  find: "      var priceAdd = null;\n      if(priceRaw){",
  with: "      var priceAdd = priceRaw ? Number(priceRaw) : null;\n      if(false){",
});
// COMMENTS STRIPPED FIRST. Every one of these fixes left a comment quoting the defect it removed —
// six lines across the two shells say `Number(priceRaw)` — and a scan that counted those would report
// the fix as the defect. That is the absent-vs-broken direction, aimed at prose.
// HTML comments too. The first version stripped only JS comments and then reported the <head>'s
// `<!-- … Number(priceRaw) … -->` note in BOTH shells as live code — a scan reporting its own
// documentation as the defect.
const stripComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "));
const bareParse = [];
for (const [f, src] of Object.entries(shells)) {
  const code = stripComments(src);
  for (const m of code.matchAll(/(?:Number|parseFloat)\s*\(\s*(price[A-Za-z]*|[a-z]*[Pp]riceRaw)\b/g))
    bareParse.push(`${f}:${code.slice(0, m.index).split("\n").length}  ${m[0]}`);
}
leg("RULE", "5 no shell parses a typed price with a bare Number() or parseFloat",
  bareParse.length === 0,
  bareParse.length
    ? `a price is being coerced rather than parsed: ${bareParse.join("; ")}`
    : `neither shell coerces a typed price. Checked in BOTH, because this is the two-of-everything ` +
      `shape: the parser shipped in hubly.html for the canvas, and the SAME defect was sitting on ` +
      `platform-home's Edit-details add AND edit rows — the control Adrian reported as missing was ` +
      `present and storing NaN for "$95". Comments are stripped first: six lines across the two ` +
      `shells quote \`Number(priceRaw)\` while explaining its removal, and counting those would ` +
      `report the fix as the defect.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
