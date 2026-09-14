#!/usr/bin/env node
/**
 * RE-TAKE THE TWO NUMBERS THAT ARE CURRENTLY FLOORS.
 *
 * "0 of 119 scrolled before the fix" and "37 of 40 after" justified rewriting 142 stored pages.
 * Both were measured with `waitForTimeout(500)` standing between the click and the check, on
 * pages that carry `html{scroll-behavior:smooth}` — so a link to a distant section could still
 * be in flight when the check looked. The error runs toward FALSE NEGATIVES, which makes both
 * numbers floors rather than measurements (Lesson 70, D-042).
 *
 * This re-takes them under the rig: one page per context (a same-document repeat is not an
 * independent trial), a click that is PROVEN to have landed, and a scroll position POLLED until
 * it stops changing with the stability window printed beside it.
 *
 *   node scripts/measure-fragment-links.mjs [--limit=N]
 *
 * Exit: 0 measured · 2 cannot run.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows":'); if (i < 0) return [];
  let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
}

let rows;
try {
  rows = sql(`select b.slug, b.account_kind, d.rendered_html as html
              from businesses b
              join lateral (select rendered_html from business_documents
                            where business_id=b.id and rendered_html is not null
                            order by version desc limit 1) d on true
              where d.rendered_html like '%href="#%'
              order by b.slug`);
} catch (e) { console.error("CANNOT RUN — database unreachable: " + String(e.message).slice(0, 140)); process.exit(2); }

if (LIMIT) rows = rows.slice(0, LIMIT);
console.log(`pages with at least one in-page link: ${rows.length}${LIMIT ? ` (limited to ${LIMIT})` : ""}\n`);

let rig;
try { rig = await openRig({ quiet: true, width: 1280, height: 900 }); }
catch (e) { console.error(String(e.message)); process.exit(2); }

const dir = mkdtempSync(join(tmpdir(), "hubly-frag-"));
let links = 0, scrolled = 0, navigatedAway = 0, noTarget = 0, didNothing = 0, repaired = 0, unrepaired = 0, keyboardOnly = 0;
const perPage = [];

for (const r of rows) {
  const hasHandler = /data-hubly-runtime="fragment-scroll"/.test(r.html);
  hasHandler ? repaired++ : unrepaired++;
  const file = join(dir, `${r.slug}.html`);
  writeFileSync(file, r.html);
  const frags = [...new Set([...r.html.matchAll(/href="#([^"]+)"/gi)].map((m) => m[1]))].filter((h) => h && h !== "top");
  let pageScrolled = 0, pageLinks = 0;

  for (const id of frags) {
    pageLinks++; links++;
    await rig.load("file://" + file);
    const exists = await rig.page.evaluate((i) => !!document.getElementById(i), id);
    if (!exists) { noTarget++; continue; }
    const before = (await rig.settleScroll({ quiet: true })).final;
    const url0 = rig.page.url();
    // A LINK A MOUSE CANNOT REACH IS NOT A BROKEN LINK.
    //
    // The first run of this counted 21 clicks as "did nothing"; grouping them showed 19 were
    // `<a class="skip-link" href="#main">Skip to content</a>` — the accessibility affordance
    // that is deliberately hidden until keyboard focus. The rig refused to press them, which is
    // correct, and this script recorded the refusal as a page defect, which was not. One shape
    // with twenty faces, and the fix was to the measurement rather than to twenty pages.
    //
    // Counted separately rather than dropped: a page having a skip link is a fact worth
    // knowing, and silently excluding things is how a denominator stops meaning anything.
    const pointerReachable = await rig.page.evaluate((i) => {
      const a = document.querySelector(`a[href="#${CSS.escape(i)}"]`);
      if (!a) return false;
      const r = a.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const cs = getComputedStyle(a);
      if (cs.visibility === "hidden" || cs.opacity === "0" || cs.clipPath !== "none") return false;
      const mid = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return !!(mid && (mid === a || a.contains(mid) || mid.contains(a)));
    }, id);
    if (!pointerReachable) { keyboardOnly++; continue; }
    try { await rig.click({ selector: `a[href="#${id.replace(/"/g, '\\"')}"]` }); }
    catch { didNothing++; continue; }                       // could not press it: not a result
    const after = await rig.settleScroll({ quiet: true });
    if (rig.page.url() !== url0) { navigatedAway++; continue; }
    const onScreen = await rig.page.evaluate((i) => {
      const e = document.getElementById(i); if (!e) return false;
      const t = e.getBoundingClientRect().top;
      return t >= -20 && t < window.innerHeight;
    }, id);
    if (onScreen && after.final !== before) { scrolled++; pageScrolled++; }
    else if (onScreen) { scrolled++; pageScrolled++; }       // already in view = the job is done
    else didNothing++;
  }
  perPage.push({ slug: r.slug, kind: r.account_kind, hasHandler, links: pageLinks, scrolled: pageScrolled });
  process.stdout.write(`  ${r.slug.padEnd(42)} ${hasHandler ? "repaired " : "UNREPAIRED"} ${String(pageScrolled).padStart(3)}/${String(pageLinks).padEnd(3)} scrolled\n`);
}
await rig.close();

const pagesAllGood = perPage.filter((p) => p.links > 0 && p.scrolled === p.links).length;
const pagesWithLinks = perPage.filter((p) => p.links > 0).length;
console.log(`\n── MEASURED UNDER THE RIG (settled reads, proven clicks, one context per click) ──`);
console.log(`  in-page links found   : ${links}`);
console.log(`  keyboard-only (skip links, never a pointer affordance): ${keyboardOnly}`);
console.log(`  clicked with a pointer: ${links - keyboardOnly}`);
const clickable = links - keyboardOnly - noTarget;
console.log(`  brought target into view: ${scrolled}  (${clickable ? Math.round(scrolled / clickable * 100) : 0}% of clickable links)`);
console.log(`  navigated the frame away: ${navigatedAway}`);
console.log(`  target id missing      : ${noTarget}`);
console.log(`  did nothing            : ${didNothing}`);
console.log(`  pages where EVERY link works: ${pagesAllGood}/${pagesWithLinks}`);
console.log(`  pages carrying the repaired runtime: ${repaired} · without it: ${unrepaired}`);
const k = perPage.reduce((a, p) => { a[p.kind] = (a[p.kind] || 0) + 1; return a; }, {});
console.log(`  account_kind split of the pages measured: ${JSON.stringify(k)}`);
process.exit(0);
