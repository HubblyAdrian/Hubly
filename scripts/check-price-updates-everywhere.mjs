#!/usr/bin/env node
/**
 * NOBODY REFRESHES TO SEE A PRICE THEY JUST TYPED.
 *
 *   node scripts/check-price-updates-everywhere.mjs
 *
 * The service save used to call two renderers by name — the editor list and the website preview.
 * A service price is rendered in SIX places, every one of them through the single formatter
 * `svcDisplayPrice`. So an owner editing a price with the packages hub open watched the number
 * stay wrong on the surface he was looking at, and the only way to the truth was a refresh.
 *
 * DERIVED, NOT LISTED: this discovers the price-rendering FUNCTIONS from the call sites of
 * svcDisplayPrice and requires each to be covered by the repaint registry. The next surface that
 * starts showing a price cannot quietly go stale — it fails here instead.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let src;
try { src = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

const lines = src.split("\n");
/** A top-level function's body: from its `function name(` to the next line that starts a new
 *  top-level function. Crude, and honest about being crude — it is a containment test, not a
 *  parser, and it errs toward INCLUDING too much rather than too little, which is the safe
 *  direction for "is this renderer reachable from a registered one". */
const bodyCache = new Map();
function bodyOf(name) {
  if (bodyCache.has(name)) return bodyCache.get(name);
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) { bodyCache.set(name, ""); return ""; }
  const nl = src.indexOf("\nfunction ", start + 1);
  const body = src.slice(start, nl < 0 ? src.length : nl);
  bodyCache.set(name, body);
  return body;
}
// Every function that renders a price, discovered from where the one formatter is called.
const renderers = new Set();
lines.forEach((l, i) => {
  if (!/svcDisplayPrice\s*\(/.test(l)) return;
  for (let k = i; k >= 0; k--) {
    const m = lines[k].match(/^function ([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { renderers.add(m[1]); break; }
  }
});
// A FUNCTION THAT READS A PRICE IS NOT A FUNCTION THAT RENDERS ONE. `ccServiceEntryIntent` formats
// a price to CLASSIFY an utterance and paints nothing; requiring it to be repainted is the probe
// reporting a non-defect. A renderer writes innerHTML or returns markup — derived from the body,
// not from a list of exceptions.
for (const fn of [...renderers]) {
  const b = bodyOf(fn);
  const paints = /innerHTML\s*[+]?=/.test(b) || /return\s*`\s*<|>\s*`/.test(b) || /\.textContent\s*=/.test(b);
  if (!paints) renderers.delete(fn);
}
// Everything the repaint registry covers.
const reg = src.slice(src.indexOf("var HC_PRICE_SURFACES"), src.indexOf("function repaintServicePriceSurfaces"));
const covered = new Set([...reg.matchAll(/fn:\s*'([A-Za-z_$][\w$]*)'/g)].map((m) => m[1]));
// A DELIBERATE OMISSION IS DECLARED WHERE THE REGISTRY LIVES, WITH ITS REASON. Read from the same
// block, so an exclusion has to be argued for in the code rather than quietly left out — and a
// reason-less `NOT-REPAINTED:` line does not count.
const excluded = new Map([...reg.matchAll(/NOT-REPAINTED:\s*([A-Za-z_$][\w$]*)\s*[—-]\s*(.+)/g)]
  .map((m) => [m[1], m[2].trim()]));

say("0 [RULE] the scan found price renderers and a registry to compare",
  renderers.size > 2 && covered.size > 2, `${renderers.size} renderer(s) · ${covered.size} registered`);

// Some callers format a price without OWNING a surface (a helper building one card's HTML, or an
// intent classifier). Those are covered by whichever surface renders them, so the leg asks the
// question that matters: is every renderer either registered, or called BY a registered one?
const uncovered = [...renderers].filter((fn) => {
  if (covered.has(fn)) return false;
  if (excluded.has(fn) && excluded.get(fn).length > 20) return false;
  // THE WHOLE FUNCTION BODY, not a fixed window. A 4000-char window reported seven renderers as
  // uncovered when most were HTML builders called by a registered surface further down its own
  // body — a window sized to a guess is not a containment test (the same mistake the schedule
  // card's wiring check made with 900 chars).
  return ![...covered].some((c) => bodyOf(c) && new RegExp(`\\b${fn}\\s*\\(`).test(bodyOf(c)));
});
say("1 [RULE] every surface that renders a price is repainted when a price changes",
  uncovered.length === 0,
  uncovered.length ? `NOT REPAINTED: ${uncovered.join(", ")}` : `${renderers.size} renderer(s), all reachable from the registry`);

say("1b [RULE] every deliberate omission carries a reason, in the registry",
  [...excluded.entries()].every(([, why]) => why.length > 20),
  [...excluded.keys()].map((k) => k).join(", ") || "(none declared)");
say("2 [RULE] the save calls the repaint rather than naming renderers itself",
  /repaintServicePriceSurfaces\(\);\s*\n\s*toast\('Service saved'\)/.test(src)
    && !/renderSvcEditorList\(\);\s*\n\s*renderWebsitePreview\(\);\s*\n\s*toast\('Service saved'\)/.test(src),
  "one call, not a hand-named pair");

// ── 3. [RULE] A SURFACE THAT IS NOT ON SCREEN IS SKIPPED, NOT AN ERROR. The absent-vs-broken
//       direction: repainting a surface that does not exist must be quiet, not a thrown failure
//       that stops the surfaces after it in the loop. ─────────────────────────────────────────
say("3 [RULE] a surface not on screen is skipped, and one that throws does not stop the rest",
  /if\(!document\.querySelector\(sfc\.root\)\) return;/.test(src)
    && /catch\(e\)\{ try\{ console\.warn\('\[price\] repaint failed/.test(src),
  "absent is skipped; broken is caught per surface");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nA price he types updates everywhere it is showing.");
process.exit(failed ? 1 : 0);
