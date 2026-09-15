#!/usr/bin/env node
/**
 * THE INTERNAL CHECKLIST STAYS INTERNAL.
 *
 * Adrian's ruling, in his own words (docs/SETTLED.md): "our ai should be smart and know okay
 * they haven't done this they still need to. we can have an internal checklist but they don't
 * need to feel like it's a checklist."
 *
 * What stood before 2026-09-13 emitted "A few things would make your page stronger:" and then
 * one '• '-prefixed message per gap with a button attached — the checklist, rendered as a
 * checklist, in the greeting. `get_my_site_gaps` is untouched; the TELLING is what changed.
 *
 * Three assertions, and the third is the one that will be violated quietly:
 *
 *   1. NO BULLETS. No owner-facing message is composed with a '• ' prefix.
 *   2. ONE ASK. hcMaybeAskNextGap says exactly one thing.
 *   3. NO FALLBACK. hcPickNextGap returns null when nothing is outstanding, with no reaching
 *      for a weaker item so there is something to say. The temptation is real and the failure
 *      is invisible: a page with nothing outstanding gets an ask anyway, and nobody notices
 *      because it reads like helpfulness.
 *
 *   node scripts/check-one-ask-not-a-list.mjs
 *
 * Exit: 0 all hold · 1 an assertion failed · 2 cannot run.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = resolve(ROOT, "public/platform-home.html");
let src;
try { src = readFileSync(FILE, "utf8"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

let failed = 0;
const say = (n, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${detail ? " — " + detail : ""}`); if (!ok) failed++; };

/** The body of a named function, brace-matched. */
function body(name) {
  const m = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`).exec(src);
  if (!m) return null;
  let d = 0, i = m.index + m[0].length - 1;
  for (let k = i; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i + 1, k); }
  }
  return null;
}

// ── 1. NO BULLETS ────────────────────────────────────────────────────────────────
// The failing shape was hcAppendMessage('hubly', '• ' + n.text …). Match the bullet in an
// appended message, in either quote style, however it is concatenated.
const bulletCalls = [...src.matchAll(/hcAppendMessage\s*\([^)]*['"`]\s*[••]/g)];
// THE DENOMINATOR FIRST. "No bullets" is an absence, and an absence is satisfied just as well by
// the scan finding NOTHING TO SCAN — rename hcAppendMessage and this leg goes green over a file
// full of bullets. A check that only proves the bad thing is gone cannot prove the good thing
// arrived; this is the half that says the search was real. (Adrian's rule, 2026-09-15.)
const allAppends = [...src.matchAll(/hcAppendMessage\s*\(/g)];
say("0 the scan found owner-facing message calls at all", allAppends.length > 5,
  `${allAppends.length} hcAppendMessage call(s) in the file — a count near zero means the scan is looking at the wrong name, not that the file is clean`);
say("1 no bullets in owner-facing messages", bulletCalls.length === 0,
  bulletCalls.length ? `${bulletCalls.length} hcAppendMessage call(s) composing a '•' line` : `none, across ${allAppends.length} call(s)`);

// ── 2. ONE ASK ───────────────────────────────────────────────────────────────────
const ask = body("hcMaybeAskNextGap");
if (!ask) { console.error("CANNOT RUN — hcMaybeAskNextGap not found"); process.exit(2); }
const appends = (ask.match(/hcAppendMessage\s*\(/g) || []).length;
say("2 hcMaybeAskNextGap says exactly one thing", appends === 1, `${appends} hcAppendMessage call(s)`);

// ── 3. NO FALLBACK ───────────────────────────────────────────────────────────────
const pick = body("hcPickNextGap");
if (!pick) { console.error("CANNOT RUN — hcPickNextGap not found"); process.exit(2); }
// Everything after the loop's closing brace is the tail. The only return there may be `null`.
const loop = /for\s*\([^)]*\)\s*\{/.exec(pick);
let tail = pick;
if (loop) {
  let d = 0, i = loop.index + loop[0].length - 1;
  for (let k = i; k < pick.length; k++) {
    if (pick[k] === "{") d++;
    else if (pick[k] === "}") { d--; if (!d) { tail = pick.slice(k + 1); break; } }
  }
}
const tailReturns = [...tail.matchAll(/return\s+([^;]+);/g)].map((m) => m[1].trim());
const onlyNull = tailReturns.length > 0 && tailReturns.every((r) => r === "null");
say("3 no fallback when nothing is outstanding", onlyNull,
  tailReturns.length ? `returns after the loop: ${tailReturns.join(" | ")}` : "no return after the loop at all");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nAll three hold: an internal checklist, told as one ask.");
process.exit(failed ? 1 : 0);
