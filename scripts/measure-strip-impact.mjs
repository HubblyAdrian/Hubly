#!/usr/bin/env node
/**
 * WHAT THE PUBLIC STRIP WOULD NOW REMOVE — measured on every stored page before it ships.
 *
 * hcStripPlaceholders' section sweep had never run (it selected `.hd-doc-body > section`, a class
 * no mounted page has) and the whole function had never reached a full-document page (187 of 188).
 * Both are fixed — which means a function that removed NOTHING now removes something on every
 * public page load. Before that ships, the question is not "does it work" but "what does it take
 * away from a page that was fine".
 *
 * A section is removed only when it has no image, video, link, form or Hubly element AND no text
 * beyond its own headings. This prints every section that would go, with its heading, so a false
 * positive is visible as a sentence rather than as a number.
 *
 * Exit: 0 measured · 2 cannot run
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

const shell = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
const at = shell.indexOf("function hcStripPlaceholders(root)");
if (at < 0) { console.error("CANNOT RUN — hcStripPlaceholders not found"); process.exit(2); }
const stripSrc = shell.slice(at, at + shell.slice(at).indexOf("\n}\n") + 3);

let kinds, rows;
try {
  kinds = loadKinds();
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select b.slug, d.rendered_html as html from businesses b
     join lateral (select rendered_html from business_documents where business_id=b.id and rendered_html is not null
                   order by version desc limit 1) d on true`], { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let dd = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") dd++; else if (out[k] === "]") { dd--; if (!dd) { e = k + 1; break; } } }
  rows = JSON.parse(out.slice(s, e));
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 180)); process.exit(2); }

const slugs = rows.map((r) => r.slug);
console.log(`\nWHAT THE PUBLIC STRIP WOULD REMOVE — ${rows.length} stored pages`);
console.log(`  ${subsetLine("the corpus itself", slugs, kinds)}\n`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const hit = [];
let totalSections = 0, removedSections = 0, removedMarked = 0;
for (const r of rows) {
  try {
    const { value, page } = await mountAndEvaluate(ctx, r.html, (src) => {
      const before = { sections: document.querySelectorAll("section, article").length,
                       marked: document.querySelectorAll("[data-hd-placeholder], .is-placeholder").length };
      const headings = [...document.querySelectorAll("section, article")].map((s) => ({
        el: s, h: (s.querySelector("h1,h2,h3,h4,h5,h6") || {}).textContent || "(no heading)" }));
      // eslint-disable-next-line no-new-func
      new Function(src + "; hcStripPlaceholders(document.body);")();
      const gone = headings.filter((x) => !x.el.isConnected).map((x) => String(x.h).replace(/\s+/g, " ").trim().slice(0, 48));
      return { before, after: document.querySelectorAll("section, article").length, gone };
    }, stripSrc);
    totalSections += value.before.sections;
    removedSections += value.gone.length;
    removedMarked += value.before.marked;
    if (value.gone.length || value.before.marked) hit.push({ slug: r.slug, gone: value.gone, marked: value.before.marked });
    await page.close();
  } catch (e) { /* a page that will not mount is a different finding; the button sweep counts those */ }
}
await browser.close();

console.log(`${totalSections} sections across the corpus · ${removedSections} would be removed · ${removedMarked} marked placeholders would be removed`);
console.log("  " + rateLine("pages the strip would change at all", hit.length, slugs, kinds, { store: "business_documents" }));
console.log("\n  EVERY SECTION IT WOULD TAKE, with its heading — a false positive is a sentence, not a number:");
if (!hit.length) console.log("    (none)");
for (const h of hit) {
  console.log(`    ${h.slug.padEnd(40)} ${h.marked} marked · removes: ${h.gone.length ? h.gone.map((g) => JSON.stringify(g)).join(", ") : "(no section)"}`);
}
console.log("");
