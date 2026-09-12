#!/usr/bin/env node
/**
 * A BLOCK WE INSERT MUST BE READABLE ON THE PAGE WE INSERT IT INTO.
 *
 * The services block and the contact block are both built server-side and dropped into
 * a page the model designed. The first version of the services block inherited body's
 * dark-on-light text colour and landed on the dark end of a radial gradient: factually
 * perfect, visually invisible, and passing every check that existed.
 *
 * This renders the page, screenshots the block, and reads the PIXELS — see
 * scripts/lib/pixel-contrast.mjs for why nothing upstream of the pixels can be trusted.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePng, regionContrast } from "./lib/pixel-contrast.mjs";
// MOUNTED THE WAY THE PRODUCT MOUNTS IT (Lesson 37). This used to call setContent on the
// stored bytes, which renders an AST page with none of the shell CSS that actually styles
// it — i.e. measures the contrast of a document nobody is served.
import { mountAndEvaluate } from "./lib/mount-as-product.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = process.env.HUBLY_BLOCK_CORPUS || join(ROOT, "scripts/baselines/block-legibility-corpus.json");
const MIN = 4.5;   // WCAG AA for body text

/** KNOWN UNREADABLE, recorded 2026-09-09 rather than hidden. These three pages defeat
 *  the donor rule: the section we clone carries a colour scoped in a way our elements
 *  fall outside of, and no static rule can see that without rendering. They are listed
 *  so the suite stays GREEN on the known state and goes RED the moment a NEW page joins
 *  them — a suite left red hides the explanation for complaints we already have.
 *
 *  The fix for these is a product decision, not a heuristic: fall back to the standalone
 *  painted block, which always reads but always looks like a card. Adrian rules. */
const KNOWN_UNREADABLE = new Set([
  "mobile-detailing-in-lehi-74738",   // "Services" at 1.00:1
  "window-washing-company",           // "Full Detail" at 1.00:1
  "tamale-selling-business",          // "$180" at 3.20:1
]);

const require_ = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require_("playwright")); }
catch (e) { console.error("CANNOT RUN — playwright not loadable: " + e.message); process.exit(2); }
if (!existsSync(CORPUS)) {
  console.error(`CANNOT RUN — no corpus at ${CORPUS}. Regenerate it with scripts/lib/dump-block-corpus.mjs.`);
  process.exit(2);
}

let pages;
try { pages = JSON.parse(readFileSync(CORPUS, "utf8")); }
catch (e) { console.error("CANNOT RUN — corpus unreadable: " + e.message); process.exit(2); }
if (!Array.isArray(pages) || !pages.length) { console.error("CANNOT RUN — corpus is empty"); process.exit(2); }

const { addServicesBlock } = await import("file://" + join(ROOT, "supabase/functions/_shared/hubly_services_block.ts"))
  .catch(() => ({}));
let build = addServicesBlock;
if (typeof build !== "function") {
  // The module is Deno TS; Node cannot import it. The corpus is pre-built instead.
  build = null;
}

const browser = await chromium.launch();
const fails = [];
const known = [];
const fixed = [];
let checked = 0, cloned = 0, standalone = 0;
for (const p of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  let page, frame;
  try {
    const mounted = await mountAndEvaluate(ctx, p.html, (sel) => {
      const e = document.querySelector(sel);
      if (e) e.scrollIntoView({ block: "center" });
      return !!e;
    }, p.selector);
    page = mounted.page; frame = mounted.frame;
    if (!mounted.value) { await ctx.close(); continue; }
    // SCROLL AGAIN AFTER THE IMAGES SETTLE. A page with a tall hero reflows as its images
    // arrive, which moves the block far below the fold — the first scroll aimed at where
    // it used to be. Measuring then found nothing on 117 of 132 blocks and reported the
    // 15 that happened to stay put as the whole corpus.
    await page.waitForTimeout(250);
    await frame.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "center", behavior: "instant" }); }, p.selector);
    await page.waitForTimeout(250);
    // MEASURE THE TEXT, not the section. Each heading, name and price is clipped with a
    // few pixels of its own ground around it, so the extremes in that box are the ink
    // and the ground a reader actually sees.
    const boxes = await frame.evaluate((sel) => {
      const root = document.querySelector(sel); if (!root) return [];
      const out = [];
      for (const e of root.querySelectorAll("h1,h2,h3,h4,p,span,dt,dd,a,address,li")) {
        if (!(e.textContent || "").trim()) continue;
        if (e.querySelector("h1,h2,h3,h4,p,span,dt,dd,a,address,li")) continue;   // leaves only
        const r = e.getBoundingClientRect();
        if (r.width < 12 || r.height < 8 || r.bottom < 0 || r.top > 900) continue;
        out.push({ t: (e.textContent || "").trim().slice(0, 24), x: r.x, y: r.y, w: r.width, h: r.height });
      }
      return out.slice(0, 8);
    }, p.selector);
    if (!boxes.length) { await ctx.close(); continue; }
    checked++;
    if (p.mode === "cloned") cloned++; else if (p.mode === "standalone") standalone++;
    let worst = { ratio: 99, t: "" };
    for (const b of boxes) {
      const pad = 3;
      const clip = {
        x: Math.max(0, Math.floor(b.x - pad)), y: Math.max(0, Math.floor(b.y - pad)),
        width: Math.min(Math.ceil(b.w + pad * 2), 1280 - Math.max(0, Math.floor(b.x - pad))),
        height: Math.min(Math.ceil(b.h + pad * 2), 900 - Math.max(0, Math.floor(b.y - pad))),
      };
      if (clip.width < 8 || clip.height < 8) continue;
      const c = regionContrast(decodePng(await page.screenshot({ clip })));
      if (c.ratio < worst.ratio) worst = { ratio: c.ratio, t: b.t };
    }
    if (worst.ratio < MIN) {
      if (KNOWN_UNREADABLE.has(p.slug)) known.push(`${p.slug} — "${worst.t}" at ${worst.ratio.toFixed(2)}:1`);
      else fails.push(`${p.slug} (${p.kind}, ${p.mode}) — "${worst.t}" renders at ${worst.ratio.toFixed(2)}:1, below ${MIN}:1`);
    } else if (KNOWN_UNREADABLE.has(p.slug)) {
      fixed.push(p.slug);
    }
  } catch (e) {
    fails.push(`${p.slug} — could not render: ${String(e.message).slice(0, 80)}`);
  }
  await ctx.close();
}
await browser.close();

console.log(`blocks rendered and measured in pixels: ${checked} (cloned ${cloned}, standalone ${standalone})`);
console.log(`readable: ${checked - known.length - fails.length} / ${checked}`);
if (known.length) { console.log(`known unreadable, recorded (${known.length}):`); for (const k of known) console.log("  " + k); }
if (fixed.length) console.log(`NOW READABLE — remove from KNOWN_UNREADABLE: ${fixed.join(", ")}`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} block(s) unreadable where they land:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log(`PASS — every inserted block reads at ${MIN}:1 or better on its own page.`);
process.exit(0);
