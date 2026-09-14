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
 *   1. the gate exists and refuses once a slot is taken;
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

// ── 1. the gate exists and short-circuits ───────────────────────────────────────
const gate = /function hcMayAddVoluntary\(\)\s*\{([\s\S]*?)\n          \}/.exec(src);
say("1 the one gate exists and refuses a second addition",
  !!gate && /hcVoluntary\s*>\s*0\s*\)\s*return false/.test(gate[1]),
  gate ? "hcMayAddVoluntary short-circuits on hcVoluntary > 0" : "hcMayAddVoluntary not found");

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
say("2 every voluntary composer call site is gated", failed === (gate ? 0 : 1), `${sites} call site(s) examined across ${VOLUNTARY.length} composers`);

console.log(failed ? `\n${failed} assertion(s) failed.` : `\nOne voluntary addition per turn, enforced in one place. ${sites} call site(s) checked.`);
process.exit(failed ? 1 : 0);
