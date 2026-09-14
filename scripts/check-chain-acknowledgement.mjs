#!/usr/bin/env node
/**
 * AN ACKNOWLEDGEMENT NAMES SOMETHING THAT ACTUALLY CHANGED, OR IT IS NOT SAID.
 *
 *   node scripts/check-chain-acknowledgement.mjs
 *
 * The chain is "what you just did, then one next thing": *"Your hours are on your page now.
 * One more thing that would help: what do you charge for your services?"* It is the difference
 * between a reply that answers and a partner that carries the thread.
 *
 * IT IS ALSO THE EASIEST PLACE IN THE PRODUCT TO SHIP AN UNEARNED CHECKMARK. "Great work!"
 * costs nothing to emit and reads well in a demo, and an owner who gets praised for a turn in
 * which nothing happened learns to skip the line — including the times it was true. So the
 * acknowledgement is computed from the DIFFERENCE between the gaps before the turn and the
 * gaps now, and this check RUNS that composition (Lesson 83: assert the behaviour, not the
 * shape) against the four states that matter.
 *
 * Extracted from public/platform-home.html and executed, so it is the product's own functions
 * being tested and not a copy of them.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = resolve(ROOT, "public/platform-home.html");
let src;
try { src = readFileSync(FILE, "utf8"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

/** A named declaration (var/function), brace- or bracket-matched from its opening token. */
function block(startRe, openCh, closeCh) {
  const m = startRe.exec(src);
  if (!m) return null;
  const from = src.indexOf(openCh, m.index);
  if (from < 0) return null;
  let d = 0;
  for (let k = from; k < src.length; k++) {
    if (src[k] === openCh) d++;
    else if (src[k] === closeCh) { d--; if (!d) return src.slice(m.index, k + 1); }
  }
  return null;
}

const gapAsks = block(/var HC_GAP_ASKS\s*=\s*\[/, "[", "]");
const gapDone = block(/var HC_GAP_DONE\s*=\s*\{/, "{", "}");
const closedFn = block(/function hcClosedGaps\s*\(/, "{", "}");
const chainFn = block(/function hcChainLine\s*\(/, "{", "}");
if (!gapAsks || !gapDone || !closedFn || !chainFn) {
  console.error("CANNOT RUN — the chain's pieces were not all found (HC_GAP_ASKS, HC_GAP_DONE, hcClosedGaps, hcChainLine). It may have been renamed or removed.");
  process.exit(2);
}

let api;
try {
  api = new Function(`${gapAsks};\n${gapDone};\n${closedFn}\n${chainFn}\nreturn { HC_GAP_ASKS, HC_GAP_DONE, hcClosedGaps, hcChainLine };`)();
} catch (e) {
  console.error("CANNOT RUN — the chain would not execute: " + String(e.message).slice(0, 140));
  process.exit(2);
}

let failed = 0;
const say = (n, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${detail ? " — " + detail : ""}`); if (!ok) failed++; };

const ALL_OPEN = { has_phone: false, has_hours: false, has_priced_services: false, own_photos: 0, services_no_desc: 0 };
const HOURS_IN = { ...ALL_OPEN, has_hours: true };
const PRAISE = /\b(great|nice|well done|good (job|work)|awesome|amazing|congrat)/i;

// 1. NOTHING CHANGED. The ask alone, with not one word of praise attached to it.
{
  const closed = api.hcClosedGaps(ALL_OPEN, ALL_OPEN);
  const gap = api.HC_GAP_ASKS[0];
  const line = api.hcChainLine(closed, gap);
  say("1 a turn that changed nothing gets no acknowledgement",
    closed.length === 0 && line === gap.say && !PRAISE.test(line),
    JSON.stringify(line).slice(0, 110));
}

// 2. SOMETHING CHANGED. It is named — the actual thing, not a category — and exactly one ask
//    follows it.
{
  const closed = api.hcClosedGaps(ALL_OPEN, HOURS_IN);
  const gap = api.HC_GAP_ASKS.find((a) => a.key === "has_phone");
  const line = api.hcChainLine(closed, gap);
  const namesIt = /hours/i.test(line);
  const asks = (line.match(/\?/g) || []).length;
  say("2 a closed gap is named, and exactly one ask follows",
    closed.length === 1 && closed[0] === "has_hours" && namesIt && asks === 1,
    JSON.stringify(line).slice(0, 150));
}

// 3. NOTHING LEFT TO ASK. The acknowledgement stands alone rather than reaching for a weaker
//    item — the same rule hcPickNextGap already holds one level up.
{
  const line = api.hcChainLine(["has_hours"], null);
  say("3 with nothing to ask, the acknowledgement stands alone",
    /hours/i.test(line) && !/\?/.test(line), JSON.stringify(line).slice(0, 110));
}

// 4. NOTHING AT ALL. Silence is the correct output.
{
  const line = api.hcChainLine([], null);
  say("4 nothing changed and nothing to ask: nothing is said", line === "", JSON.stringify(line));
}

// 5. NO BASELINE IS NOT A CHANGE. The first turn of a session has nothing to compare against,
//    and "we have no record of what was true before" must never become "you just did that".
{
  const closed = api.hcClosedGaps(null, HOURS_IN);
  say("5 with no before-state, nothing is claimed", closed.length === 0, JSON.stringify(closed));
}

// 6. THE ACK MAY ONLY NAME A GAP THAT HAS A DONE-SENTENCE. A key with no sentence is a gap we
//    cannot describe, and describing it anyway is how a generic "nice work" gets back in.
{
  const unknown = api.hcChainLine(["something_we_do_not_track"], null);
  say("6 an unknown key produces no acknowledgement", unknown === "", JSON.stringify(unknown));
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe chain says what happened, or says nothing — and it asks for one thing.");
process.exit(failed ? 1 : 0);
