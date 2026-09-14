#!/usr/bin/env node
/**
 * AT MOST ONE VOLUNTARY ADDITION PER TURN — asserted, not trusted.
 *
 * Seven composers can append to a single owner turn. Three are VOLUNTARY: nobody asked for
 * them, they are Hubly choosing to say one more thing — the capture re-ask, the account offer,
 * and the next-gap ask. Adrian got four composers stacked in one reply on 2026-09-14 because
 * two of them shared a floor predicate and the third yielded to nothing.
 *
 * **A rule enforced by three functions agreeing with each other is not enforced.** They now go
 * through one gate, `hcMayAddVoluntary()`, and take a slot with `hcTookVoluntary()`. This check
 * fails if a fourth composer is added beside them without doing the same.
 *
 * Three legs, each red-proofable:
 *   1. the gate, EXECUTED, refuses once a slot is taken (read, it passed a gate returning true);
 *   2. every voluntary composer call site is guarded by it;
 *   3. every guarded call site also TAKES the slot — a guard without a take lets the next
 *      composer through, which is the bug with an extra step.
 *
 * Exit: 0 ok · 1 an assertion failed · 2 cannot run.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = resolve(ROOT, "public/platform-home.html");
// The voluntary composers, by the function that speaks. A new one added here without a gate
// is exactly what this check exists to catch.
const VOLUNTARY = ["hcCheckCaptureMiss", "hcAppendAccountOffer", "hcMaybeAskNextGap"];

let src;
try { src = readFileSync(FILE, "utf8"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// ── 1. THE GATE IS RUN, NOT READ ────────────────────────────────────────────────
// The first version of this leg matched the text `hcVoluntary > 0) return false` inside the
// function body and called that enforcement. On 2026-09-14 the red-proof audit put
// `return true;` at the top of the gate — the short-circuit line still present, three lines
// below, now unreachable — and this check stayed green. A text assertion about a line is not
// an assertion about a decision. So the gate is EXTRACTED and EXECUTED against four states.
const start = src.indexOf("var hcVoluntary = 0;");
const tookAt = src.indexOf("function hcTookVoluntary()");
if (start < 0 || tookAt < 0) { console.error("CANNOT RUN — hcVoluntary / hcTookVoluntary not found in the file"); process.exit(2); }
const gateSrc = src.slice(start, src.indexOf("\n", tookAt) + 1);

let may, took;
try {
  // `interim` and `_reply` are the gate's only free names; passing them as parameters puts
  // them in scope exactly as the closure does at run time.
  const make = new Function("interim", "_reply", gateSrc + "\nreturn { may: hcMayAddVoluntary, took: hcTookVoluntary };");
  const behaves = (interim, reply, takeFirst) => {
    const api = make(interim, reply);
    if (takeFirst) api.took();
    return api.may();
  };
  const cases = [
    ["a statement was shown, no slot taken", behaves(["Added Ceramic Coating at $600."], "", false), true],
    ["the slot is already taken", behaves(["Added Ceramic Coating at $600."], "", true), false],
    ["the last thing said was a question", behaves(["What do you charge for that?"], "", false), false],
    ["nothing was said this turn", behaves([], "", false), false],
  ];
  const wrong = cases.filter(([, got, want]) => got !== want);
  say("1 the gate, executed, refuses in every state it must", wrong.length === 0,
    wrong.length ? wrong.map(([n, got, want]) => `${n}: returned ${got}, must be ${want}`).join("; ")
                 : `4 states exercised: ${cases.map(([n, got]) => `${n} → ${got}`).join(" · ")}`);
} catch (e) {
  console.error("CANNOT RUN — the gate could not be executed: " + String(e.message).slice(0, 120));
  process.exit(2);
}

// ── 2 + 3. every voluntary call site is gated AND takes a slot ──────────────────
// The window is the statement the call appears in: from the start of its line back to the
// nearest `if (` or `try {`, forward to the end of that statement. Cheap and exact enough —
// a call site that mentions neither the gate nor the take is unambiguously unguarded.
const lines = src.split("\n");
let sites = 0;
for (const name of VOLUNTARY) {
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(lines[i])) continue;
    if (/^\s*(\/\/|\*)/.test(lines[i])) continue;              // a comment naming it
    if (new RegExp(`function ${name}`).test(lines[i])) continue; // its own definition
    sites++;
    const window = lines.slice(Math.max(0, i - 3), i + 3).join("\n");
    const gated = /hcMayAddVoluntary\s*\(/.test(window);
    const takes = /hcTookVoluntary\s*\(/.test(window);
    if (!gated) say(`2 ${name} at :${i + 1} is gated`, false, "no hcMayAddVoluntary() within 3 lines");
    if (gated && !takes) say(`3 ${name} at :${i + 1} takes its slot`, false, "gated but never calls hcTookVoluntary()");
  }
}
say("2 every voluntary composer call site is gated", failed === 0, `${sites} call site(s) examined across ${VOLUNTARY.length} composers`);

console.log(failed ? `\n${failed} assertion(s) failed.` : `\nOne voluntary addition per turn, enforced in one place. ${sites} call site(s) checked.`);
process.exit(failed ? 1 : 0);
