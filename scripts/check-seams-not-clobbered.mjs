#!/usr/bin/env node
/**
 * NO TEST SEAM IS ASSIGNED TWICE.
 *
 *   node scripts/check-seams-not-clobbered.mjs
 *
 * 2026-09-16. My Day was given a seam and wrote `window.hublyDayUI = { render, hours, ... }` as a
 * FRESH assignment — three thousand lines below an existing `window.hublyDayUI = { add, line,
 * addRow }`. The second assignment won, `check-day-add-by-hand` went to CANNOT RUN, and the only
 * reason it was caught is that CANNOT RUN is loud. Had the two seams shared even one key name,
 * the check would have gone GREEN against the wrong functions — which is the silent direction,
 * and the one Lesson 89 says to guard first.
 *
 * It is the two-of-everything pattern arriving in the harness: two owners of one global, and the
 * one that loads second silently wins. The fix is `Object.assign(window.X || {}, ...)`; this is
 * the check that makes forgetting it visible.
 *
 * DERIVED, NOT A LIST (definition-of-done 7). It finds every `window.hubly*UI` assignment in the
 * source and counts the fresh ones per name. Adding a seam needs no edit here; clobbering one
 * fails here.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["public/platform-home.html", "public/hubly.html"];
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let total = 0;
for (const f of FILES) {
  let src;
  try { src = readFileSync(resolve(ROOT, f), "utf8"); }
  catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

  // A FRESH assignment replaces whatever was there. `Object.assign(window.X || {}, …)` extends it.
  //
  // ══ COUNTING FRESH ASSIGNMENTS WAS NOT THE RULE. Corrected 2026-09-17. ══════════════════
  //
  // This counted `= {` per name and failed only at TWO. `hublyDayUI` had exactly one — at line
  // 7955, THREE THOUSAND LINES BELOW an `Object.assign` that had registered `inThread`,
  // `offerTab`, `tabDeclined` and `rememberDeclined` on the same global. One fresh assignment,
  // arriving second, wiped all four; the check stayed green and the seam was silently missing
  // for anything that reached for it. Found by hitting it, not by the check — which is the
  // whole failure mode this file exists to prevent.
  //
  // THE RULE IS ORDER, NOT COUNT: a fresh assignment must be the FIRST thing that touches the
  // name. Anything after an earlier touch — fresh or extend — replaces work already done.
  const touches = new Map();
  for (const m of src.matchAll(/window\.(hubly[A-Za-z0-9_]*UI)\s*=\s*(\{|Object\.assign)/g)) {
    const [, name, kind] = m;
    if (!touches.has(name)) touches.set(name, []);
    touches.get(name).push({ kind: kind === "{" ? "fresh" : "extend", at: m.index,
                             line: src.slice(0, m.index).split("\n").length });
  }
  total += touches.size;
  const clobbered = [];
  for (const [name, list] of touches) {
    list.slice(1).forEach((t) => {
      if (t.kind === "fresh") clobbered.push(`${name} replaced at line ${t.line} (first set at line ${list[0].line})`);
    });
  }
  say(`${f} — no seam is REPLACED after it has been set`, clobbered.length === 0,
    clobbered.length ? `CLOBBERED: ${clobbered.join("; ")}` : `${touches.size} seam(s), every replacement is the first touch`);
}
say("the scan found seams to check — a zero here means the pattern moved, not that it is clean",
  total > 0, `${total} seam name(s) across ${FILES.length} file(s)`);

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nNo seam is assigned twice; a second owner must extend, not replace.");
process.exit(failed ? 1 : 0);
