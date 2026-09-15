#!/usr/bin/env node
/**
 * WHICH ROW DID HE MEAN — the matcher, run.
 *
 *   node scripts/check-which-job-he-meant.mjs
 *
 * THE DEFECT (2026-09-15): "change the driveway job to 3 PM" -> "I couldn't find a job matching
 * "driveway job." Which job do you mean?" He had ONE job, printed three lines above.
 *
 * The old rule required EVERY query word of >=3 chars to appear in the row's text, and that text
 * never contains "job" because "job" is OUR noun for the row. Of six natural phrasings, bare
 * "driveway" was the only one that worked — "the driveway" failed too, because "the" is three
 * characters and was therefore required.
 *
 * THE RULE NOW: a word counts in proportion to how FEW OF HIS OWN ROWS contain it, and each row
 * scores by its single best-discriminating word. No stopword list — "job", "the", "appointment"
 * and "booking" all weigh nothing by the SAME mechanism, so there is nothing to keep in sync
 * (Lesson 87, shape 2: make membership structural, here applied to vocabulary).
 *
 * THE FOUR CONDITIONS on shipping it, each its own leg:
 *   1 THE ONE-ROW CASE, asserted not inferred. With a single row every word appears in 100% of
 *     rows so NOTHING discriminates — the common early case, and Adrian's own business. Any
 *     phrasing must ACT.
 *   2 WHEN IT ACTS IT NAMES WHAT IT ACTED ON. The matcher chooses the row from his words; if it
 *     ever chooses wrong, seeing which job moved is his only protection.
 *   3 THE SCORE IS OVER HIS OWN ROWS ONLY. A shared denominator would let one owner's wording
 *     decide another owner's match.
 *   4 THE DOCUMENTED EXAMPLE WORKS. "the Maple St one is $200 now" is in the capability's own
 *     description and fails today on "one".
 *
 * AND MAX NOT SUM (leg 9), found by inventing the adversarial case rather than waiting for it:
 * summing weights let "the driveway job" score a row named "The job" above "Driveway wash" and
 * would have changed a job he never meant.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let M;
try { M = await import("../supabase/functions/_shared/hubly_match.ts"); }
catch (e) { console.error("CANNOT RUN — could not load hubly_match.ts: " + e.message); process.exit(2); }
const { matchRows, requireCandidates, describeRow } = M;

const PHRASINGS = ["driveway job", "the driveway job", "driveway", "the driveway",
                   "driveway appointment", "my driveway booking"];

// ── 1. THE ONE-ROW CASE ────────────────────────────────────────────────────────────────
// ASSERTED, NOT INFERRED. With one row every word has df === 1 === rows.length, so nothing
// discriminates; the arithmetic happens to reach "act", but "it happens to work" is not a promise.
const ONE = [{ customer_name: "", service_name: "driveway", address: "14 Maple St" }];
const oneResults = PHRASINGS.map((w) => matchRows(w, ONE));
say("1 with ONE job, every phrasing ACTS", oneResults.every((r) => r.kind === "act"),
  PHRASINGS.map((w, i) => `${w}=${oneResults[i].kind}`).join(" "));
say("1b and it acts on the only row there is", oneResults.every((r) => r.kind === "act" && r.row === ONE[0]));

// ── 2. HIS REAL ROWS, read from the database 2026-09-15 22:11Z ─────────────────────────
const REAL = [
  { customer_name: "", service_name: "driveway", address: "14 Maple St", scheduled_time: "15:00:00", scheduled_date: "2026-09-17" },
  { customer_name: "", service_name: "doctor’s appointment", address: "" },
];
const realOut = Object.fromEntries(PHRASINGS.map((w) => [w, matchRows(w, REAL)]));
say("2 'driveway job' acts on the driveway", realOut["driveway job"].kind === "act" && realOut["driveway job"].row === REAL[0]);
say("3 'the driveway job' acts (the article does not kill it)", realOut["the driveway job"].kind === "act");
say("4 'the driveway' acts — the phrasing that failed today", realOut["the driveway"].kind === "act");
say("5 'my driveway booking' acts", realOut["my driveway booking"].kind === "act");
// This one ASKS on his real corpus and that is CORRECT: his other job is literally "doctor's
// appointment", so "appointment" genuinely discriminates here. The query names one word from each
// row, so asking with both named is the honest answer.
say("6 'driveway appointment' ASKS on his real rows, naming both", realOut["driveway appointment"].kind === "ask" &&
  realOut["driveway appointment"].candidates.length === 2, "his other job IS an appointment");

// ── 7. THE DOCUMENTED EXAMPLE (condition 4) ───────────────────────────────────────────
const maple = matchRows("the maple st one", REAL);
say("7 the capability's OWN documented example works: 'the maple st one'",
  maple.kind === "act" && maple.row === REAL[0], `kind=${maple.kind}`);

// ── 8-9. THE CASES THAT MUST NOT REGRESS ──────────────────────────────────────────────
const TWO_DRIVEWAYS = [
  { customer_name: "Adrian", service_name: "Driveway wash", address: "1 Maple St" },
  { customer_name: "Bev", service_name: "Driveway seal", address: "9 Elm St" },
];
say("8 two driveways ASK, naming both — never a coin flip",
  PHRASINGS.every((w) => { const r = matchRows(w, TWO_DRIVEWAYS); return r.kind === "ask" && r.candidates.length === 2; }));

// MAX NOT SUM. The invented transcript: summing would score "The job" (the+job = 2.0) above
// "Driveway wash" (driveway = 1.0) and change a job he never meant.
const THE_JOB = [
  { customer_name: "Adrian", service_name: "Driveway wash", address: "" },
  { customer_name: "Odd Co", service_name: "The job", address: "" },
];
const tricky = matchRows("the driveway job", THE_JOB);
say("9 two weak words never outvote one strong one (MAX, not SUM)", tricky.kind === "ask",
  tricky.kind === "act" ? `ACTED ON "${tricky.row.service_name}" — the wrong-row bug` : "a tie is a question");

// ── 10. ZERO SAYS WHAT HE DOES HAVE ───────────────────────────────────────────────────
const NO_DRIVEWAY = [
  { customer_name: "Maria", service_name: "Window clean", address: "12 Oak St" },
  { customer_name: "Sam", service_name: "Gutter clear", address: "3 Ash Rd" },
];
say("10 no match at all returns 'none', never a candidate", matchRows("driveway job", NO_DRIVEWAY).kind === "none");

// ── 11-13. NAMING THE CANDIDATES IS A PRECONDITION (c) ────────────────────────────────
const threw = (n) => { try { requireCandidates(new Array(n).fill({})); return false; } catch { return true; } };
say("11 a disambiguation CANNOT be composed with zero candidates", threw(0));
say("12 nor with one", threw(1));
say("13 two or more is fine", !threw(2) && !threw(4));

// ── 14. CONDITION 3: HIS OWN ROWS ONLY ────────────────────────────────────────────────
// The same query against the same row must not change answer because ANOTHER business exists.
const mine = [{ customer_name: "", service_name: "driveway", address: "" }];
const withStranger = [...mine, { customer_name: "", service_name: "driveway", address: "" }];
say("14 the score is over the rows passed in, and nothing else",
  matchRows("driveway", mine).kind === "act" && matchRows("driveway", withStranger).kind === "ask",
  "adding a row changes the answer; nothing outside the list can");

// ── 15-17. FROM SOURCE ────────────────────────────────────────────────────────────────
const reg = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");
const code = reg.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
say("15 updateJob uses the shared matcher, not its own words.every", /matchRows\(which/.test(code) && !/words\.every\(/.test(code),
  /words\.every\(/.test(code) ? "words.every is still in the registry" : "one matcher");
say("16 the zero branch names what he DOES have", /The only job they have is|The jobs they have are/.test(code));
say("17 the success sentence is told to name WHICH job", /say WHICH job/.test(code));

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe matcher finds the job he meant, asks only when it truly cannot tell, and names what it touched.");
process.exit(failed ? 1 : 0);
