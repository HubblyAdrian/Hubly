#!/usr/bin/env node
/**
 * A WARNING IN A PATH THAT PROCEEDS ANYWAY IS NOT A GUARD — IT IS A CONFESSION (Lesson 41).
 *
 * `renderThemedBookingLanding` logs "called without biz — use renderBookingLanding('pub')"
 * and then paints the booking page anyway. On 2026-09-12 that warning fired FIVE times on a
 * single customer load, and the page rendered an empty business name, a hardcoded "BR"
 * monogram, a placeholder tagline and an instruction addressed to the owner. The code knew
 * it was wrong, said so, and rendered.
 *
 * IT IS A CENSUS AND A CANDIDATE LIST, NOT A VERDICT — and the limit is stated because it
 * was measured. "Warns and then renders" cannot be decided by looking a few statements ahead:
 * in the known instance the warning is at the top of the function and the first innerHTML is
 * forty lines below it, past a dozen getElementById calls. Widening the window until that one
 * case appears would be tuning a check to pass, so it is not done.
 *
 * What IS decidable: a warning whose own message admits a missing precondition, outside a
 * catch, with no stop after it. That is a list for a person to read — the known instance is
 * on it — not a number to gate on. Plenty of warnings correctly continue: telemetry that must
 * never fail a build, a best-effort cache write, a cleanup that does not matter.
 *
 *   node scripts/check-warning-then-proceed.mjs            # census, always exit 0
 *   node scripts/check-warning-then-proceed.mjs --strict   # exit 1 if the second list grew
 *
 * Exit: 0 · 1 only with --strict and a new entry · 2 cannot run
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

/** Statements that mean "this path stopped". */
const STOPS = /^\s*(return\b|throw\b|process\.exit|Deno\.exit|location\.replace|location\.href\s*=|break\b|continue\b)/;
/** Evidence the path went on to put something in front of a person. */
const RENDERS = /(innerHTML|textContent\s*=|showP\(|appendChild|render[A-Z]\w*\(|\.submit\(|fetch\(|hcAppendMessage|classList\.add\('active'\))/;

function analyse(src, file) {
  const lines = src.split("\n");
  const diagnostic = [], proceeds = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/console\.(warn|error)\s*\(/.test(lines[i])) continue;
    // The next few real statements after the warning, in the same block.
    let stop = false, renders = false, seen = 0;
    for (let j = i + 1; j < Math.min(lines.length, i + 12) && seen < 6; j++) {
      const t = lines[j].trim();
      if (!t || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
      // Closers are not statements. Counting them burned the six-statement budget before
      // the scan reached the render — the third tokenising bug of this family in two days
      // (Lesson 39), and it made this check report zero.
      if (/^[})\];,]+$/.test(t)) continue;
      seen++;
      if (STOPS.test(t)) { stop = true; break; }
      if (RENDERS.test(t)) renders = true;
    }
    // Same line stop: `console.warn(x); return;`
    if (/console\.(warn|error)[^;]*;\s*(return|throw)\b/.test(lines[i])) stop = true;
    // IS THIS A CATCH, OR A PRECONDITION? A `try{…}catch(e){console.warn(e)}` around a
    // best-effort sub-render is the correct shape: the catch IS the guard, and the code
    // going on to render other things is the point. The Lesson 41 shape is different — an
    // explicit test for a missing precondition, a warning about it, and then the very
    // render that needed it. Only the second kind belongs on the second list.
    const window3 = lines.slice(Math.max(0, i - 3), i + 1).join(" ");
    const inCatch = /catch\s*\(/.test(window3) || /\.catch\s*\(/.test(lines[i]);
    const precondition = /\bif\s*\(\s*!|\bif\s*\([^)]*(===?\s*(null|undefined|''|""))|\bif\s*\([^)]*\.length\s*===?\s*0/.test(window3);
    // The message ITSELF admitting a missing precondition. This is the decidable half: a
    // developer wrote "called without biz" because the caller broke a contract, and the
    // function carried on anyway.
    const confesses = /without |missing|no biz|not found|unavailable|never |should not|shouldn't|expected /i.test(lines[i]);
    const entry = { file, line: i + 1, text: lines[i].trim().slice(0, 110), inCatch, precondition };
    if (stop) diagnostic.push(entry);
    else if (!inCatch && (confesses || precondition)) proceeds.push(entry);
    else diagnostic.push(entry);
  }
  return { diagnostic, proceeds };
}

// ── RED-PROOF, EVERY RUN (Lesson 40) ─────────────────────────────────────────
{
  const STOPS_FIXTURE = `function a(){ if(!biz){ console.warn('no biz'); return; } el.innerHTML = biz; }`;
  const PROCEEDS_FIXTURE = `function b(){\n  if(!biz){ console.warn('called without biz'); }\n  el.innerHTML = paint(biz);\n}`;
  const CATCH_FIXTURE = `function c(){\n  try{ sub(); }catch(e){ console.warn('sub failed', e); }\n  el.innerHTML = paint(biz);\n}`;
  const good = analyse(STOPS_FIXTURE, "(f)").proceeds.length === 0;
  const bad = analyse(PROCEEDS_FIXTURE, "(f)").proceeds.length === 1;
  const catchOk = analyse(CATCH_FIXTURE, "(f)").proceeds.length === 0;
  if (!good || !bad || !catchOk) {
    console.error("CANNOT RUN — the detector failed its own fixtures:");
    console.error(`  warn-then-return classified as proceeding : ${!good} (expected false)`);
    console.error(`  warn-then-render caught                   : ${bad} (expected true)`);
    console.error(`  catch-then-render NOT flagged             : ${catchOk} (expected true)`);
    process.exit(2);
  }
}

let files;
try { files = readdirSync(PUBLIC).filter((f) => f.endsWith(".html")); }
catch (e) { console.error("CANNOT RUN — cannot read public/: " + e.message); process.exit(2); }

let diagnostic = [], proceeds = [];
for (const f of files) {
  const r = analyse(readFileSync(join(PUBLIC, f), "utf8"), f);
  diagnostic = diagnostic.concat(r.diagnostic);
  proceeds = proceeds.concat(r.proceeds);
}

console.log(`console.warn/error sites in public/: ${diagnostic.length + proceeds.length}  (detector red-proofed this run)`);
console.log(`  diagnostic — stops, or renders nothing after : ${diagnostic.length}`);
console.log(`  CANDIDATES — admits a broken precondition, outside a catch, no stop: ${proceeds.length}`);
console.log(`  (read these; the classifier cannot tell you whether the render below them needed it)`);
for (const p of proceeds) console.log(`     ${p.file}:${p.line}  ${p.text}`);
process.exit(0);
