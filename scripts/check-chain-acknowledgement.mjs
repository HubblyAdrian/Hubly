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
import { declareBreak } from "./lib/redproof.mjs";

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
const writersMap = block(/var HC_GAP_WRITERS\s*=\s*\{/, "{", "}");
const writesFn = block(/function hcTurnWrites\s*\(/, "{", "}");
if (!gapAsks || !gapDone || !closedFn || !chainFn || !writersMap || !writesFn) {
  console.error("CANNOT RUN — the chain's pieces were not all found (HC_GAP_ASKS, HC_GAP_DONE, HC_GAP_WRITERS, hcTurnWrites, hcClosedGaps, hcChainLine). It may have been renamed or removed.");
  process.exit(2);
}

let api;
try {
  api = new Function(`${gapAsks};\n${gapDone};\n${writersMap};\n${writesFn}\n${closedFn}\n${chainFn}\nreturn { HC_GAP_ASKS, HC_GAP_DONE, HC_GAP_WRITERS, hcTurnWrites, hcClosedGaps, hcChainLine };`)();
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
  const closed = api.hcClosedGaps(ALL_OPEN, ALL_OPEN, ["business.setHours"]);
  const gap = api.HC_GAP_ASKS[0];
  const line = api.hcChainLine(closed, gap);
  say("1 a turn that changed nothing gets no acknowledgement",
    closed.length === 0 && line === gap.say && !PRAISE.test(line),
    JSON.stringify(line).slice(0, 110));
}

// 2. SOMETHING CHANGED. It is named — the actual thing, not a category — and exactly one ask
//    follows it.
{
  const closed = api.hcClosedGaps(ALL_OPEN, HOURS_IN, ["business.setHours"]);
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
  const closed = api.hcClosedGaps(null, HOURS_IN, ["business.setHours"]);
  say("5 with no before-state, nothing is claimed", closed.length === 0, JSON.stringify(closed));
}

// 6. THE ACK MAY ONLY NAME A GAP THAT HAS A DONE-SENTENCE. A key with no sentence is a gap we
//    cannot describe, and describing it anyway is how a generic "nice work" gets back in.
{
  const unknown = api.hcChainLine(["something_we_do_not_track"], null);
  say("6 an unknown key produces no acknowledgement", unknown === "", JSON.stringify(unknown));
}

// ══ A REAL CHANGE MAY NOT BE ATTRIBUTED TO THE WRONG THING ═════════════════════════════
//
// THIS IS ADRIAN'S TRANSCRIPT, 2026-09-15, business hubly-classic-fixture, seq 7-8:
//
//   owner:  "I need a job added: Thursday at 2 to do the driveway, 14 Maple St, 555-0134,
//            we said $180"
//   Hubly:  "Added the driveway job … " and then, from the chain,
//           "Your prices are on your page now."
//
// He had not touched his page. `jobs` is not `services`; a job's price is not a page price.
// The old red-proof (1-6 above) covered the HOLLOW acknowledgement — nothing changed and we
// claimed something. It could not catch this one, because something really did change: the
// observation was true and the CAUSE was false. That is the worse defect, because it survives
// every check that only asks whether a change occurred.

// 7. THE EXACT TRANSCRIPT. A job write, a page-prices gap that closed, and the acknowledgement
//    must be SILENT — the job did not put a price on his page.
{
  const before = { ...ALL_OPEN };
  const after = { ...ALL_OPEN, has_priced_services: true };   // the gap genuinely closed
  const jobTurn = api.hcTurnWrites([{ capability: "business", capabilityAction: "addJob", ok: true, real: true }]);
  const closed = api.hcClosedGaps(before, after, jobTurn);
  const line = api.hcChainLine(closed, null);
  /* ══ L98 — `closed.length === 0 && line === ""` IS WHAT A DEAD FUNCTION RETURNS ══════════════
   * `hcClosedGaps` returning `[]` for any reason — a renamed capability, a changed write shape, a
   * thrown-and-swallowed error — satisfies both clauses, and the leg reports "a job write is not
   * misreported as a price change" having exercised nothing. The positive clause is that the turn it
   * was handed was a REAL write the reader could have acted on: a non-empty writes list, and a
   * before-state that genuinely differs from the after-state on the gap being tested. */
  declareBreak({
    leg: "7 a real job write was read",
    // NARROWED, AFTER THE FIRST ATTEMPT TURNED FOUR LEGS RED. Breaking hcClosedGaps itself fires
    // every leg in this file that asks the reader anything, which proves nothing about any one of
    // them (L98). The precise defect leg 7 guards is ONE WRONG ENTRY in the writer-to-gap map — a
    // job write listed among the things that can close the priced-services gap. That is the shape a
    // careless edit to that table takes, and no other leg reads that entry.
    why: "add `business.addJob` to the writers that can close the priced-services gap — one wrong " +
         "entry in HC_GAP_WRITERS, which is how a job write comes to be announced as a price change",
    file: "public/platform-home.html",
    find: "    has_priced_services: ['business.setServices', 'business.addServicesSection', 'website.patchDocument'],",
    with: "    has_priced_services: ['business.setServices', 'business.addServicesSection', 'website.patchDocument', 'business.addJob'],",
  });
  say("7 a real job write was read, and it is NOT reported as a change to his page prices",
    jobTurn.length > 0 && before.has_priced_services !== after.has_priced_services &&
    closed.length === 0 && line === "",
    `${jobTurn.length} write(s) handed in and the gap genuinely differs between before and after — ` +
    `so the reader had something to get wrong — yet closed=${JSON.stringify(closed)} and it said ` +
    `nothing: ${JSON.stringify(line)}`);
}

// 8. AND THE SAME CLOSE, BY THE WRITER THAT ACTUALLY CLOSES IT, IS STILL SAID. A guard that
//    silences the true case as well as the false one has not fixed anything.
{
  const before = { ...ALL_OPEN };
  const after = { ...ALL_OPEN, has_priced_services: true };
  const svcTurn = api.hcTurnWrites([{ capability: "business", capabilityAction: "setServices", ok: true, real: true }]);
  const closed = api.hcClosedGaps(before, after, svcTurn);
  const line = api.hcChainLine(closed, null);
  say("8 the writer that DOES close it is still acknowledged",
    closed.length === 1 && closed[0] === "has_priced_services" && /price/i.test(line),
    JSON.stringify(line).slice(0, 120));
}

// 9. A WRITER THAT FAILED CHANGED NOTHING, whatever the gaps now say. `ok:false` is not a
//    receipt, and a gap that moved for some other reason may not borrow it.
{
  const before = { ...ALL_OPEN };
  const after = { ...ALL_OPEN, has_priced_services: true };
  const failedTurn = api.hcTurnWrites([{ capability: "business", capabilityAction: "setServices", ok: false, real: true }]);
  const closed = api.hcClosedGaps(before, after, failedTurn);
  say("9 a failed write earns no acknowledgement", failedTurn.length === 0 && closed.length === 0,
    `writes=${JSON.stringify(failedTurn)} closed=${JSON.stringify(closed)}`);
}

// 10. NO RECEIPT IS NOT A LICENCE. A turn we have no actions array for must attribute nothing —
//     the same rule as no before-state, one dimension over. This is the leg that keeps the fix
//     from being quietly undone by a caller that forgets to pass the receipt.
{
  const before = { ...ALL_OPEN };
  const after = { ...ALL_OPEN, has_hours: true };
  say("10 with no receipt for the turn, nothing is attributed",
    api.hcClosedGaps(before, after, undefined).length === 0 && api.hcClosedGaps(before, after, null).length === 0,
    "undefined and null both attribute nothing");
}

// 11. EVERY DECLARED WRITER IS A REAL CAPABILITY ACTION. A map entry naming a writer that does
//     not exist is a gap that can never be acknowledged — silent, and indistinguishable from
//     working. Checked against the code rather than trusted.
//
//     IT LOOKS IN BOTH PLACES, because there are two, and the first version of this leg went
//     red for the right reason with the wrong conclusion: `recordFacts` and `addPhoto` are real
//     writes that emit their own action from hubly-conversation/index.ts rather than being
//     registry entries. A checker that knows about one of the two lanes reports a working
//     writer as missing — the same "Hubly has two of almost everything" rule, applied to the
//     checker.
{
  const readOr = (rel) => { try { return readFileSync(resolve(ROOT, rel), "utf8"); } catch (_) { return ""; } };
  const registry = readOr("supabase/functions/_shared/hubly_capability_registry.ts");
  const edge = readOr("supabase/functions/hubly-conversation/index.ts");
  const declared = [...new Set(Object.values(api.HC_GAP_WRITERS).flat())];
  const missing = (registry && edge)
    ? declared.filter((w) => {
        const action = w.split(".")[1];
        // A registry entry (`name: "setHours"`) or an action emitted directly by the edge
        // (`capabilityAction: "recordFacts"`). Either is a real write.
        return !new RegExp(`name:\\s*"${action}"`).test(registry) &&
               !new RegExp(`capabilityAction:\\s*"${action}"`).test(edge);
      })
    : null;
  say("11 every writer the chain trusts exists in the code",
    missing !== null && missing.length === 0,
    missing === null ? "sources unreadable" : `${declared.length} declared, missing: ${JSON.stringify(missing)}`);
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe chain says what happened, names the gap that actually closed, and asks for one thing.");
process.exit(failed ? 1 : 0);
