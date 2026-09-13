#!/usr/bin/env node
/**
 * ONE SWEEP, ONE EXPORT, EVERY RATE WITH ITS account_kind SPLIT BESIDE IT.
 *
 *   node scripts/measure-page-corpus.mjs
 *
 * Replaces three ad-hoc scratchpad passes — the sub-AA text census, the dead-nav-link count,
 * and the scoring of the gaps commit c2ff42d recorded when it switched to freeform generation.
 * They belong together: same corpus, same export, one re-pull (a reused export undercounts).
 *
 * EVERY rate goes through `rateLine()`, which throws rather than print a number without its
 * split. On 2026-09-13 a photo rate was quoted off a corpus that is ~96% our own test drafts;
 * this is the structural answer to that.
 *
 * The sub-AA numbers are computed from the DOM in a real mount (see the note in the census
 * section) — a FLOOR, with its blind spots printed beside it.
 *
 * Exit: 0 ok · 2 cannot run
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadKinds, rateLine, subsetLine } from "./lib/kind-split.mjs";
import { mountAndEvaluate } from "./lib/mount-as-product.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require_ = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require_("playwright")); }
catch (e) { console.error("CANNOT RUN — playwright not loadable: " + e.message); process.exit(2); }

let kinds, rows;
try {
  kinds = loadKinds();
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select b.slug, d.rendered_html as html from businesses b
     join lateral (select rendered_html from business_documents where business_id=b.id and rendered_html is not null
                   order by version desc limit 1) d on true`], { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  rows = JSON.parse(out.slice(s, e));
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 160)); process.exit(2); }
if (!rows.length) { console.error("CANNOT RUN — no pages"); process.exit(2); }
const slugs = rows.map((r) => r.slug);

console.log(`\nPAGE CORPUS — re-exported now, ${rows.length} stored pages`);
console.log(`  ${subsetLine("the corpus itself", slugs, kinds)}`);
console.log(`  A rate over this corpus is a rate over OUR OWN TEST DRAFTS unless the market column says otherwise.\n`);

// ── 1. THE BILL FROM c2ff42d, scored ───────────────────────────────────────────
const has = (re) => rows.filter((r) => re.test(r.html)).map((r) => r.slug);
console.log("THE 2026-08-20 GAP LIST (commit c2ff42d), scored against the corpus:");
for (const [label, re] of [
  ["booking link on the page", /book=1/],
  ["an enquiry/contact form", /<form\b/i],
  ["a reviews mention (no component exists)", /\breview/i],
  ["anything map-like", /<iframe[^>]*map|google\.com\/maps|data-hubly-map/i],
  ["the #hubly-logo marker used", /#hubly-logo/],
  ["design knobs stamped", /hubly-type-scale/],
  ["any image at all (stock included)", /<img/i],
]) console.log("  " + rateLine(label, has(re).length, slugs, kinds));

// ── 2. NAV LINKS POINTING AT NOTHING ───────────────────────────────────────────
let totalLinks = 0, deadLinks = 0;
const deadPages = [];
for (const r of rows) {
  const ids = new Set([...r.html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).concat([...r.html.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1])));
  const frags = [...r.html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]).filter((f) => f && f.toLowerCase() !== "top");
  totalLinks += frags.length;
  const miss = frags.filter((f) => !ids.has(f));
  if (miss.length) { deadLinks += miss.length; deadPages.push(r.slug); }
}
console.log(`\nIN-PAGE LINKS: ${totalLinks} total, ${deadLinks} pointing at an id that was never written`);
console.log("  " + rateLine("pages with at least one link to nothing", deadPages.length, slugs, kinds));

// ── 3. SUB-AA TEXT WE DID NOT INSERT ───────────────────────────────────────────
// Computed from the DOM with the compositing effBg the runtime rescue uses — a FLOOR: text
// over a background image cannot be judged this way, and antialiasing moves the real ratio.
const SCAN = () => {
  function chan(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
  function lum(c){return 0.2126*chan(c[0])+0.7152*chan(c[1])+0.0722*chan(c[2]);}
  function parse(s){var m=s&&s.match(/rgba?\(([^)]+)\)/);if(!m)return null;var p=m[1].split(',').map(Number);return{rgb:[p[0],p[1],p[2]],a:p.length>3?p[3]:1};}
  function ratio(a,b){var L1=lum(a),L2=lum(b),hi=Math.max(L1,L2),lo=Math.min(L1,L2);return (hi+0.05)/(lo+0.05);}
  function effBg(el){var layers=[],n=el;while(n&&n.nodeType===1){var cs=getComputedStyle(n);if(cs.backgroundImage&&cs.backgroundImage!=='none')return{image:true};var bg=parse(cs.backgroundColor);if(bg&&bg.a>0){layers.push(bg);if(bg.a>=1)break;}n=n.parentElement;}
    var base=(layers.length&&layers[layers.length-1].a>=1)?layers.pop().rgb:[255,255,255];
    for(var q=layers.length-1;q>=0;q--){var L=layers[q],a=L.a;base=[L.rgb[0]*a+base[0]*(1-a),L.rgb[1]*a+base[1]*(1-a),L.rgb[2]*a+base[2]*(1-a)];}
    return {rgb:base};}
  let text=0, sub=0, skipped=0, worst=99;
  for (const e of document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,span,dt,dd,li,a,address,blockquote,figcaption,td,th,label,strong,em")) {
    if (e.closest("[data-hubly-services-block],[data-hubly-contact-block],[data-hubly-runtime]")) continue;
    if (!(e.textContent||"").trim()) continue;
    if (e.querySelector("h1,h2,h3,h4,h5,h6,p,span,dt,dd,li,a,address,blockquote,figcaption,td,th,label,strong,em")) continue;
    const r = e.getBoundingClientRect(); if (r.width < 12 || r.height < 8) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || Number(cs.opacity) < 0.05) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = effBg(e); if (bg.image) { skipped++; continue; }
    text++;
    const px = parseFloat(cs.fontSize)||16, bold = (parseInt(cs.fontWeight,10)||400) >= 700;
    const need = (px >= 24 || (bold && px >= 18.66)) ? 3.0 : 4.5;
    const have = ratio(fg.rgb, bg.rgb);
    if (have < need) { sub++; if (have < worst) worst = have; }
  }
  return { text, sub, skipped, worst: sub ? worst : null };
};
const browser = await chromium.launch();
let judged = 0, subTotal = 0, skippedTotal = 0, seen = [];
const subPages = [];
for (const r of rows) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    const { value } = await mountAndEvaluate(ctx, r.html, SCAN);
    if (value && value.text) {
      seen.push(r.slug); judged += value.text; subTotal += value.sub; skippedTotal += value.skipped;
      if (value.sub) subPages.push(r.slug);
    }
  } catch { /* a page that will not mount is not a contrast result */ }
  await ctx.close();
}
await browser.close();
console.log(`\nSUB-AA TEXT WE DID NOT INSERT — a floor: ${skippedTotal} more elements sit over a background image and cannot be judged from the DOM`);
console.log("  " + rateLine("pages carrying at least one sub-AA element", subPages.length, seen, kinds));
console.log("  " + subsetLine("of those pages, by kind", subPages, kinds));
// not-a-corpus-rate: an ELEMENT rate, not a page rate; the page rates two lines above carry the split
console.log(`  text elements judged: ${judged} · below AA: ${subTotal} (${judged ? Math.round(subTotal/judged*100) : 0}% of elements — NOT a page rate)`);
console.log("");
