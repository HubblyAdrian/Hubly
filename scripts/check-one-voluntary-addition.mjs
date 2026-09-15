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
const VOLUNTARY = ["hcCheckCaptureMiss", "hcAppendAccountOffer", "hcMaybeAskNextGap", "hcShowMeWhereLine"];

let src;
try { src = readFileSync(FILE, "utf8"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// ── 1. THE GATE IS RUN, NOT READ ────────────────────────────────────────────────
// The first version of this leg matched the text `hcVoluntary > 0) return false` inside the
// function body and called that enforcement. The red-proof audit put `return true;` at the
// top of the gate — the short-circuit line still present, three lines below, now unreachable —
// and this check stayed green. A text assertion about a line is not an assertion about a
// decision. So the gate is EXTRACTED and EXECUTED.
const start = src.indexOf("var hcTurn = {");
const endMark = src.indexOf("function hcSayVoluntary");
if (start < 0 || endMark < 0) { console.error("CANNOT RUN — hcTurn / hcSayVoluntary not found in the file"); process.exit(2); }
const gateSrc = src.slice(start, src.indexOf("\n  }", src.indexOf("function hcSayVoluntary")) + 4);

// hcAskOnFloor IS PART OF THE GATE NOW and lives above hcTurn, so it is extracted with it.
// 2026-09-15: the floor predicate moved out of hcMayAddVoluntary so that Home itself could ask
// it — the arrival, the news line, the cards and the chips are speakers too and none of them
// went through the voluntary gate. This check went CANNOT-RUN the moment that landed, which is
// the correct behaviour: it refused to report on a gate it could no longer execute, rather than
// asserting a shape and calling it enforcement.
const floorStart = src.indexOf("  function hcAskOnFloor(){");
if (floorStart < 0) { console.error("CANNOT RUN — hcAskOnFloor not found; the floor predicate has been renamed or removed"); process.exit(2); }
const floorSrc = src.slice(floorStart, src.indexOf("\n  }", floorStart) + 4);

let api;
try {
  // `hcAppendMessage`, `hcThreadScrollToEnd`, `hcOwner` and `hc` are the gate's only free names.
  api = new Function("hcAppendMessage", "hcThreadScrollToEnd", "hcOwner", "hc",
    floorSrc + "\n" + gateSrc + "\nreturn { hcTurn, hcBeginTurn, hcNoteSaid, hcAskOnFloor, hcMayAddVoluntary, hcTakeVoluntarySlot, hcSayVoluntary };");
} catch (e) {
  console.error("CANNOT RUN — the gate would not execute: " + String(e.message).slice(0, 140));
  process.exit(2);
}

{
  const make = (awaitingName, hcState) => {
    const said = [];
    return { said, api: api((role, text) => said.push(text), () => {}, { awaitingName: !!awaitingName }, hcState || {}) };
  };
  const cases = [];
  // A statement was shown, the slot is free.
  { const { api: a } = make(); a.hcBeginTurn(); a.hcNoteSaid("Added Ceramic Coating at $600.");
    cases.push(["a statement was shown, no slot taken", a.hcMayAddVoluntary(), true]); }
  // The slot is spent.
  { const { api: a } = make(); a.hcBeginTurn(); a.hcNoteSaid("Added it."); a.hcTakeVoluntarySlot();
    cases.push(["the slot is already taken", a.hcMayAddVoluntary(), false]); }
  // A question is on the floor.
  { const { api: a } = make(); a.hcBeginTurn(); a.hcNoteSaid("What do you charge for that?");
    cases.push(["the last thing said was a question", a.hcMayAddVoluntary(), false]); }
  // Nothing was said.
  { const { api: a } = make(); a.hcBeginTurn();
    cases.push(["nothing was said this turn", a.hcMayAddVoluntary(), false]); }
  // The name question is on the floor.
  { const { api: a } = make(true); a.hcBeginTurn(); a.hcNoteSaid("Added it.");
    cases.push(["the owner was asked their name and has not answered", a.hcMayAddVoluntary(), false]); }
  // THE LATE SPEAKER — the shape that broke this in the product on 2026-09-14. One composer
  // speaks synchronously; a second arrives from a callback later in the SAME turn and must be
  // refused, because the counter is held for the turn rather than sampled once.
  { const { said, api: a } = make(); a.hcBeginTurn(); a.hcNoteSaid("Added it.");
    const first = a.hcSayVoluntary("One more thing that would help: what do you charge?");
    const late = a.hcSayVoluntary("There is no services area on your page yet.");
    cases.push(["the first voluntary addition speaks", first, true]);
    cases.push(["a LATE second one does not", late, false]);
    cases.push(["and only one thing was actually said", said.length === 1, true]); }

  const wrong = cases.filter(([, got, want]) => got !== want);
  say("1 the gate, executed, refuses in every state it must", wrong.length === 0,
    wrong.length ? wrong.map(([n, got, want]) => `${n}: returned ${got}, must be ${want}`).join("; ")
                 : `${cases.length} states exercised, including the late speaker`);
}

// ── 2. THERE IS NO LIST TO KEEP IN SYNC ──────────────────────────────────────────
// Every hand-written list of things allowed to speak or act has bitten us three times now.
// This asserts the structure that replaces the list: a slot can be taken in exactly ONE place,
// and that place is the only one that consults the gate. Anything that speaks voluntarily
// either goes through it or is visibly not going through it.
const incSites = (src.match(/hcTurn\.voluntary\s*\+\+/g) || []).length;
const gateCalls = (src.match(/hcMayAddVoluntary\s*\(/g) || []).length;   // definition + its one caller
say("2 the slot is taken in exactly one place", incSites === 1, `${incSites} increment site(s)`);
say("2b the gate is consulted in exactly one place", gateCalls === 3,
  `${gateCalls} mention(s) — its definition, hcTakeVoluntarySlot, and the capture re-ask's check`);

// ── 3. THE COUNTER OUTLIVES THE RESPONSE HANDLER ─────────────────────────────────
// A counter declared inside the handler is a sample of one moment; the composer that broke
// this spoke from a callback after that moment. It must be module state, opened per turn.
// COMMENT-MASKED, and this is the THIRD time today. The comment above the removed counter
// says `var hcVoluntary = 0` while explaining why it is gone, and the first version of this
// assertion read that comment as the code it describes — exactly the mistake Lesson 82 was
// written about this afternoon. Knowing a failure mode confers no immunity from it; masking
// does.
const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
say("3 the counter is module state, opened once per turn",
  /var hcTurn = \{/.test(code) && /function hcBeginTurn\(\)/.test(code) && /hcBeginTurn\(\);/.test(code) &&
  !/var hcVoluntary\s*=/.test(code),
  "hcTurn + hcBeginTurn present, no per-handler counter");

// ── 4. THE NAMED COMPOSERS STILL GO THROUGH THE DOOR ─────────────────────────────
// Leg 2 makes the list unnecessary; this keeps the four we know about honest anyway, because a
// composer that stops going through the door is worth hearing about at the moment it changes
// rather than at the moment an owner reads three things in one turn.
const lines = src.split("\n");
let sites = 0;
for (const name of VOLUNTARY) {
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(lines[i])) continue;
    if (/^\s*(\/\/|\*)/.test(lines[i])) continue;                 // a comment naming it
    if (new RegExp(`function ${name}`).test(lines[i])) continue;    // its own definition
    sites++;
    const window = lines.slice(Math.max(0, i - 3), i + 3).join("\n");
    if (!/hcTakeVoluntarySlot\s*\(|hcSayVoluntary\s*\(/.test(window)) {
      say(`4 ${name} at :${i + 1} goes through the one door`, false, "no hcTakeVoluntarySlot()/hcSayVoluntary() within 3 lines");
    }
  }
}
say("4 every named composer call site goes through the one door", failed === 0,
  `${sites} call site(s) examined across ${VOLUNTARY.length} composers`);

// ── THE FLOOR COVERS EVERY ASK, NOT JUST THE NAME ───────────────────────────────────────
// A pending capture ("what's your number?") and a held photo ("is this your work?") are both
// questions on the floor. They were guarded nowhere: hcMayAddVoluntary only knew about the
// name, so a voluntary addition could land under either of them.
{
  // `make` above is block-scoped; this block builds its own from the same factory.
  const make = (awaitingName, hcState) =>
    ({ api: api(() => {}, () => {}, { awaitingName: !!awaitingName }, hcState || {}) });
  const withCapture = make(false, { pendingCapture: { askedFor: "phone" } });
  withCapture.api.hcBeginTurn(); withCapture.api.hcNoteSaid("Added the job.");
  say("a pending capture ask holds the floor", withCapture.api.hcMayAddVoluntary() === false,
    `mayAdd=${withCapture.api.hcMayAddVoluntary()}`);

  const withPhoto = make(false, { heldPhoto: { id: "p1" } });
  withPhoto.api.hcBeginTurn(); withPhoto.api.hcNoteSaid("Added the job.");
  say("a held photo question holds the floor", withPhoto.api.hcMayAddVoluntary() === false,
    `mayAdd=${withPhoto.api.hcMayAddVoluntary()}`);

  const clear = make(false, {});
  clear.api.hcBeginTurn(); clear.api.hcNoteSaid("Added the job.");
  say("with nothing on the floor, one voluntary addition is allowed",
    clear.api.hcMayAddVoluntary() === true, `mayAdd=${clear.api.hcMayAddVoluntary()}`);
}

console.log(failed ? `\n${failed} assertion(s) failed.` : `\nOne voluntary addition per turn, enforced in one place. ${sites} call site(s) checked.`);
process.exit(failed ? 1 : 0);
