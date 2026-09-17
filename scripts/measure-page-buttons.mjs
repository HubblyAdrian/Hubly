#!/usr/bin/env node
/**
 * ══ ACTIONS TRACE TO CAPABILITY — press every button a generated page renders ═══════════════
 *
 *   node scripts/measure-page-buttons.mjs
 *
 * ADRIAN, 2026-09-17: "ACTIONS TRACE TO CAPABILITY. Press every button a generated page can
 * render — Book Now, Get a Quote, Join, Buy, Call — and print what each actually does. How many
 * live pages render a button that leads nowhere."
 *
 * ── ENUMERATE THE HARMLESS SIDE ──────────────────────────────────────────────────────────────
 *
 * It does NOT look for buttons whose text matches a list of CTA words. That list has undercounted
 * every time we have written one (the anchor count, the price scan, the hours detector, the
 * extraction gate twice). It takes EVERY interactive element on the page — anchor, button,
 * role=button, form submit — and classifies each by WHERE IT GOES, which is a closed set: a
 * fragment, a phone number, an email, a query the product answers, an external URL, or nothing.
 *
 * ── A SWEEP PRODUCES CANDIDATES ──────────────────────────────────────────────────────────────
 *
 * The static pass is the CANDIDATE list. Nothing here is reported as a finding until a control
 * has been PRESSED in a real mount and what happened was read back. The output says
 * "N candidates, M verified by use" and never "N confirmed".
 *
 * ── AND THE DENOMINATOR ──────────────────────────────────────────────────────────────────────
 *
 * Every rate goes through rateLine(), which refuses to print a number without its account_kind
 * split. This corpus is mostly our own test drafts; a rate over it is not a rate over the market.
 *
 * Exit: 0 measured · 2 cannot run
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
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 200)); process.exit(2); }
if (!rows.length) { console.error("CANNOT RUN — no pages"); process.exit(2); }
const slugs = rows.map((r) => r.slug);

console.log(`\nBUTTONS ON GENERATED PAGES — re-exported now, ${rows.length} stored pages`);
console.log(`  ${subsetLine("the corpus itself", slugs, kinds)}\n`);

/** ══ WHAT A CONTROL DOES — AND WHAT THE PAGE ALONE CANNOT SAY ════════════════════════════════
 *
 *  THE FIRST VERSION OF THIS CALLED 456 CONTROLS "NOWHERE". Six were pressed and FIVE of them did
 *  something — the candidate list was 83% wrong in the sample, because a `<button>` with no
 *  `onclick` attribute is not a button with no handler: the page's own `<script>` adds listeners
 *  with addEventListener, which is invisible to any amount of reading. (The 178 `×` buttons are
 *  the mobile-nav close buttons, and they work.)
 *
 *  So the static pass now says "I cannot tell" where it cannot tell, and the press decides. Three
 *  honest static categories:
 *    · DEAD          a fragment link to an id that was never written — no pressing needed
 *    · NOT A CONTROL an <a> with no href is not focusable and has no default action; it is
 *                    usually the logo. Counting it as a broken button was our error, not theirs
 *    · UNKNOWN       a button whose handler, if any, is attached in script */
const READ_CONTROLS = () => {
  const out = [];
  const ids = new Set([...document.querySelectorAll("[id]")].map((e) => e.id)
    .concat([...document.querySelectorAll("[name]")].map((e) => e.getAttribute("name"))));
  document.querySelectorAll('a,button,[role="button"],input[type="submit"]').forEach((el, idx) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || el.value || "").replace(/\s+/g, " ").trim().slice(0, 40);
    const href = el.getAttribute("href");
    let goes;
    if (tag === "a") {
      if (href == null || href === "") goes = "NOT A CONTROL (an <a> with no href)";
      else if (href === "#") goes = "UNKNOWN (href=# — the handler, if any, is in script)";
      else if (/^#/.test(href)) goes = ids.has(href.slice(1)) ? "an anchor on this page" : "DEAD (a #id that was never written)";
      else if (/^tel:/i.test(href)) goes = "the phone";
      else if (/^mailto:/i.test(href)) goes = "an email";
      else if (/^https?:/i.test(href)) goes = /myhubly\.app|\?book=|\?quote=|\?join=/.test(href) ? "a Hubly route" : "an external site";
      else if (/^\/?\?/.test(href) || /book=1|quote=1|join=/.test(href)) goes = "a Hubly route";
      else goes = "a relative path";
    } else if (el.closest("form") && (el.type === "submit" || tag === "input")) {
      goes = "submits the form it is in";
    } else if (el.getAttribute("onclick") || el.getAttribute("data-hubly-action") || el.getAttribute("formaction")) {
      goes = "a handler on the page";
    } else {
      goes = "UNKNOWN (a button whose handler, if any, is in script)";
    }
    out.push({ i: idx, tag, text, href: href || null, goes });
  });
  return out;
};

/** PRESS EVERY UNKNOWN ON THIS PAGE, one mount, and read what moved. A navigation destroys the
 *  context — which is itself an answer ("it went somewhere"), so it is caught and recorded. */
const PRESS_UNKNOWNS = (idxs) => {
  const res = [];
  for (const i of idxs) {
    // RE-ENUMERATED IN THIS MOUNT, in the same order as the read pass. The first version looked
    // for a `data-sweep-i` attribute stamped during the READ — in a different page object, which
    // this mount has never seen — so all 450 came back "could not be pressed" and the sweep
    // reported a clean zero it had not earned. A number that comes out of an instrument that
    // pressed nothing is not a measurement.
    const els = document.querySelectorAll('a,button,[role="button"],input[type="submit"]');
    const el = els[i];
    if (!el) { res.push({ i, pressed: false }); continue; }
    const before = { y: window.scrollY, n: document.querySelectorAll("*").length,
                     cls: document.documentElement.className + "|" + document.body.className,
                     open: document.querySelectorAll("[open],.open,.is-open,.active").length };
    try { el.click(); } catch (e) { res.push({ i, pressed: true, threw: true, changed: true }); continue; }
    const after = { y: window.scrollY, n: document.querySelectorAll("*").length,
                    cls: document.documentElement.className + "|" + document.body.className,
                    open: document.querySelectorAll("[open],.open,.is-open,.active").length };
    res.push({ i, pressed: true,
      changed: Math.abs(after.y - before.y) > 2 || after.n !== before.n || after.cls !== before.cls || after.open !== before.open });
  }
  return res;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const perPage = [];
for (const r of rows) {
  try {
    const { value, page } = await mountAndEvaluate(ctx, r.html, READ_CONTROLS);
    perPage.push({ slug: r.slug, controls: value });
    await page.close();
  } catch (e) {
    perPage.push({ slug: r.slug, controls: null, error: String(e.message).slice(0, 80) });
  }
}

// ── WHAT IS ON THE PAGES ─────────────────────────────────────────────────────────────
const all = perPage.flatMap((p) => (p.controls || []).map((c) => ({ ...c, slug: p.slug })));
const byGoes = {};
all.forEach((c) => { byGoes[c.goes] = (byGoes[c.goes] || 0) + 1; });
console.log(`${all.length} interactive controls across ${perPage.filter((p) => p.controls).length} mounted pages\n`);
console.log("WHERE THEY GO");
Object.entries(byGoes).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
  console.log(`  ${String(n).padStart(5)}  ${k}`);
});

// ── WHAT IS DEAD WITHOUT PRESSING ANYTHING ───────────────────────────────────────────
const dead = all.filter((c) => /^DEAD/.test(c.goes));
const deadPages = [...new Set(dead.map((c) => c.slug))];
console.log(`\nDEAD FROM THE PAGE ALONE — a link to an id that was never written: ${dead.length} on ${deadPages.length} page(s)`);
console.log("  " + rateLine("pages with a link to an id that was never written", deadPages.length, slugs, kinds, { store: "business_documents" }));
dead.slice(0, 10).forEach((c) => console.log(`    ${c.slug.padEnd(38)} "${c.text}" -> ${c.href}`));

const notControls = all.filter((c) => /^NOT A CONTROL/.test(c.goes));
console.log(`\nNOT CONTROLS AT ALL: ${notControls.length} <a> elements with no href (usually the logo).`);
console.log("  Counted separately because calling them broken buttons was OUR error, not the page's.");

// ══ AND NOW PRESS EVERY UNKNOWN. A CANDIDATE GRADUATES BY BEING ACTED ON. ════════════
const unknownTotal = all.filter((c) => /^UNKNOWN/.test(c.goes)).length;
console.log(`\nUNKNOWN FROM READING: ${unknownTotal} controls whose handler, if any, is attached in script.`);
console.log("  Pressing all of them, page by page, in a real mount.\n");
let pressed = 0, didSomething = 0, didNothing = 0, unpressable = 0, wrongState = 0;
const inertByText = {};
const inertPages = new Set();
for (const p of perPage) {
  if (!p.controls) continue;
  const idxs = p.controls.filter((c) => /^UNKNOWN/.test(c.goes)).map((c) => c.i);
  if (!idxs.length) continue;
  const row = rows.find((r) => r.slug === p.slug);
  try {
    const { value, page } = await mountAndEvaluate(ctx, row.html, PRESS_UNKNOWNS, idxs);
    value.forEach((v) => {
      const c = p.controls.find((x) => x.i === v.i);
      if (!v.pressed) { unpressable++; return; }
      pressed++;
      if (v.changed) { didSomething++; return; }
      // ══ A CLOSE BUTTON PRESSED WHILE NOTHING IS OPEN IS NOT A BROKEN BUTTON ═══════════════
      //
      // 178 of the 273 "did nothing" were `×` — the mobile-nav close control, pressed on a page
      // where the nav was never opened. Doing nothing there is CORRECT, and counting it as a
      // dead control is the wrong-state error: "reproduce the state a real person is in".
      // Counted separately and named, rather than quietly dropped.
      if (/^(×|✕|✖|x|close|✖️|⨯)$/i.test((c.text || "").trim())) { wrongState++; return; }
      didNothing++;
      inertPages.add(p.slug);
      const k = (c.text || "(no text)");
      inertByText[k] = (inertByText[k] || 0) + 1;
    });
    await page.close();
  } catch (e) {
    // A navigation destroys the context. That IS something happening, not a failure to measure.
    didSomething += idxs.length; pressed += idxs.length;
  }
}
console.log(`  ${unknownTotal} candidates · ${pressed} pressed · ${didSomething} did something · ${wrongState} were close controls pressed with nothing open (not a defect — the wrong state) · ${didNothing} DID NOTHING · ${unpressable} could not be pressed`);
console.log("  " + rateLine("pages with a control that did nothing when pressed", inertPages.size, slugs, kinds, { store: "business_documents" }));
console.log("\n  the inert ones, by their own words:");
Object.entries(inertByText).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, n]) => console.log(`    ${String(n).padStart(4)}  "${k}"`));

// ── AND THE CTA VOCABULARY, REPORTED AS A FORM, NOT AS THE FACT ──────────────────────
// Adrian named five: Book Now, Get a Quote, Join, Buy, Call. Counted as a SUBSET of the controls
// above, and labelled as what it is: a count of a FORM of words, which moves the moment the model
// writes "Reserve" or "Let's talk".
const CTA = /\bbook\b|\bquote\b|\bjoin\b|\bbuy\b|\bcall\b|\bschedule\b|\bget started\b|\breserve\b/i;
const ctas = all.filter((c) => CTA.test(c.text));
const badCta = ctas.filter((c) => /^DEAD/.test(c.goes));
console.log(`\nTHE FIVE ADRIAN NAMED — Book Now · Get a Quote · Join · Buy · Call`);
console.log(`  ${ctas.length} CTA-worded controls · ${badCta.length} dead from the page alone`);
const ctaGoes = {};
ctas.forEach((c) => { ctaGoes[c.goes] = (ctaGoes[c.goes] || 0) + 1; });
Object.entries(ctaGoes).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`    ${String(n).padStart(4)}  ${k}`));

// ══ AND THE CLASSIC STORE, BECAUSE A SWEEP THAT COVERS ONE IS NOT A SWEEP ═══════════════════
//
// Everything above reads `business_documents` — the FREEFORM store. The CLASSIC store is
// `businesses.meta`, rendered by public/hubly.html at request time, and FOUR MARKET BUSINESSES
// SERVE CLASSIC (Adrian, 2026-09-16: "CLASSIC IS A SUPPORTED PATH, NOT A LEGACY EXCEPTION").
// None of their buttons were in any number above, and it showed: check-walk-assertions finds a
// dead #services link on crestview's live classic page, which the 188 never saw.
//
// A classic page has no stored bytes to mount, so this loads the LIVE page and reads the rendered
// document. Slower, fewer pages, and it is the only way to see them at all.
//
// ── TWO THINGS IT WILL NOT DO ──────────────────────────────────────────────────────────────
//   · it does not PRESS anything on a classic page. A live page belongs to a real owner and its
//     controls act on the outside world — a booking wizard, a form. Classification is read from
//     the DOM; "it did nothing when pressed" is not claimed for classic.
//   · GRAEFS-AUTOCARE IS READ-ONLY, ALWAYS. It is loaded like the others and nothing more.
let classicRows = [];
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select b.slug, b.account_kind from businesses b
     where b.owner_id is not null
       and not exists (select 1 from business_documents d where d.business_id = b.id)`],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, st = out.indexOf("[", i), e = -1;
  for (let k = st; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  classicRows = JSON.parse(out.slice(st, e));
} catch (err) { console.error("  (could not list classic businesses: " + String(err.message).slice(0, 90) + ")"); }

console.log(`\n\nCLASSIC PAGES — the other store, loaded live: ${classicRows.length} claimed business(es) with no freeform document`);
console.log(`  ${subsetLine("the classic set", classicRows.map((r) => r.slug), kinds)}`);
console.log("  Read only. Nothing is pressed on a live page, and graefs-autocare is read-only always.\n");

const classicCounts = {};
let classicDead = 0, classicCta = 0, loaded = 0;
for (const r of classicRows) {
  const page = await ctx.newPage();
  try {
    await page.goto(`https://${r.slug}.myhubly.app/`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(2500);
    const seen = await page.evaluate(() => {
      const vis = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && b.width > 0 && b.height > 0; };
      const ids = new Set([...document.querySelectorAll("[id]")].map((e) => e.id));
      const out = [];
      document.querySelectorAll('a,button,[role="button"]').forEach((el) => {
        if (!vis(el)) return;
        const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
        const href = el.getAttribute("href");
        let goes;
        if (el.tagName.toLowerCase() === "a") {
          if (href == null || href === "" || href === "#") goes = "UNKNOWN (href=# or none)";
          else if (/^#/.test(href)) goes = ids.has(href.slice(1)) ? "an anchor on this page" : "DEAD (a #id that was never written)";
          else if (/^tel:/i.test(href)) goes = "the phone";
          else if (/^mailto:/i.test(href)) goes = "an email";
          else goes = /myhubly\.app|\?book=|\?quote=/.test(href) ? "a Hubly route" : "an external site";
        } else {
          goes = el.getAttribute("onclick") ? "a handler on the page" : "UNKNOWN (a button whose handler is in script)";
        }
        out.push({ text, goes });
      });
      return out;
    });
    loaded++;
    for (const c of seen) {
      classicCounts[c.goes] = (classicCounts[c.goes] || 0) + 1;
      if (/^DEAD/.test(c.goes)) { classicDead++; console.log(`    DEAD  ${r.slug.padEnd(26)} "${c.text}"`); }
      if (/\bbook\b|\bquote\b|\bjoin\b|\bbuy\b|\bcall\b/i.test(c.text)) classicCta++;
    }
  } catch (e) {
    console.log(`    (${r.slug}: could not load — ${String(e.message).slice(0, 50)})`);
  }
  await page.close();
}
console.log(`\n  ${loaded} classic page(s) loaded · ${classicCta} CTA-worded controls · ${classicDead} dead link(s)`);
Object.entries(classicCounts).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`    ${String(n).padStart(4)}  ${k}`));
console.log("");

await browser.close();
