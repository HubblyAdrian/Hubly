#!/usr/bin/env node
/**
 * A FIGURE ABOUT THE OWNER'S RECORDS COMES FROM A READER, NOT FROM RECOLLECTION.
 *
 *   node scripts/check-record-claims-audited.mjs
 *
 * THE CLASS, five sentences in five days:
 *   "clay and seal, price 0" as Graef's only service · "there is no services area on your page yet"
 *   "the 1 service you priced" · "your schedule isn't set up on this account yet"
 *   "one paid store order — Store Walk, $24.99, paid"
 *
 * The last one, measured against the record: TWO orders, "[TEST] Pin Check" $12.34 and
 * "[TEST] Mode Filter" $9.99, both PENDING. Four of six fields fabricated. And the seven preceding
 * turns of that conversation were entirely about opening hours, so nothing earlier supplied it
 * either — a `no_reader` case, which is the half a model invents rather than rephrases.
 *
 * REPORT-ONLY. The audit refuses nothing; it returns a verdict that gets recorded. These legs
 * assert the VERDICTS are right, because a verdict that is wrong in report-only mode becomes a
 * refusal that is wrong later.
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
try { M = await import("../supabase/functions/_shared/hubly_record_claims.ts"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }
const { auditRecordClaim, makesRecordClaim, figuresIn } = M;

// ── 1-4. WHAT COUNTS AS A RECORD CLAIM ────────────────────────────────────────────────
say("1 a count claim is detected even with words between the number and the noun",
  makesRecordClaim("The 8 earlier edits we talked about didn't carry across.").includes("count"),
  "the row my first regex missed, which reported 1 count claim across 284 turns");
say("2 a state claim is detected", makesRecordClaim("this is your site, and it's live at x.myhubly.app").includes("state"));
say("3 money and dates are detected",
  makesRecordClaim("$180 on September 17").includes("money") && makesRecordClaim("$180 on September 17").includes("date"));
say("4 a question with no figures claims nothing",
  makesRecordClaim("What are the main weed-pulling jobs people ask you for — and what do you charge?").length === 0 ||
  !auditRecordClaim("What do you charge?", "").claims,
  "an ask is not a claim");

// ── 5-8. THE EVERGREEN CASE, verbatim ─────────────────────────────────────────────────
const STORE_WALK = "No real bookings, jobs, or leads are on record right now. There is one paid " +
  "store order showing, but it’s marked as a test row: Store Walk, $24.99, pickup, paid Sep 6, 2026.";
// The seven preceding turns, which were entirely about opening hours — so nothing earlier could
// have supplied a price, a name or a count.
const HOURS_ONLY = "I couldn’t place that line under Saturday from here. Weekends are by appointment. " +
  "Done — I added your hours note on your page, in the Hours & Contact section at the foot of the page.";
const noReader = auditRecordClaim(STORE_WALK, "", HOURS_ONLY);
say("5 the Store Walk reply IS a record claim", noReader.claims === true, noReader.markers.join("+"));
say("6 with nothing read, the verdict is no_reader", noReader.noReader === true,
  "ungrounded by construction — there is nothing the figure could have come from");
say("7 and the conversation offers no prior evidence either", noReader.priorEvidence === false,
  "seven turns about opening hours");

// The same reply on a turn where the reader DID return those orders: not a claim against us.
const REAL_EV = JSON.stringify({ orders: [{ customer_name: "Store Walk", total: "24.99", status: "paid" }] });
const supported = auditRecordClaim(STORE_WALK, REAL_EV);
say("8 the same sentence is NOT flagged when the reader actually returned it", supported.unsupported.length === 0 && supported.noReader === false,
  `unsupported=${JSON.stringify(supported.unsupported)}`);

// ── 9-11. UNSUPPORTED FIGURES, when a reader did run ─────────────────────────────────
const drift = auditRecordClaim("You have 6 bookings and Maria paid $400.",
  JSON.stringify({ bookings: [{ customer_name: "Maria", amount: 180 }] }));
say("9 a figure the reader did not return is flagged", drift.unsupported.length > 0, JSON.stringify(drift.unsupported));
say("10 a figure the reader DID return is not flagged", !drift.unsupported.includes("Maria"),
  "rephrasing what the handler returned is fine");
say("11 and the verdict is unsupported_figure, not no_reader", drift.noReader === false);

// ── 12-13. THE CAVEAT THAT COULD MAKE no_reader TOO AGGRESSIVE ───────────────────────
// A model may legitimately repeat a figure a reader established EARLIER in the conversation.
// priorEvidence is how that gets MEASURED rather than argued.
const repeat = auditRecordClaim("That's still $180, unpaid.", "", "earlier: the driveway job is $180 and unpaid");
say("12 a figure an earlier reader established is marked as having prior evidence", repeat.priorEvidence === true,
  "so the rows can say whether no_reader needs conversation scope");
say("13 an invented figure has no prior evidence", auditRecordClaim("That's $999.", "", "nothing relevant").priorEvidence === false);

// ── 17-19. THE TWO BUGS THIS FILE'S OWN CHECK CAUGHT, so they cannot come back ───────
// Both were bare short tokens matched as substrings — the same disease as a regex window that
// reaches past its subject.
//
// 17: `includes("5")` finds 5 inside "2500", so an invented $5 looked supported by an unrelated
//     $2500. A number must appear AS A NUMBER.
// 18: `includes("no")` found "no" inside the word "note" in a sentence about opening hours, which
//     made the Store Walk figures look supported by a conversation that never mentioned them.
// 19: "no bookings" is an ABSENCE claim, not a figure with a value. Reporting it as unsupported
//     would flood the table and bury the real cases.
const insideNumber = auditRecordClaim("That comes to $5.", JSON.stringify({ total: 2500 }));
say("17 a number is not matched inside a longer number", insideNumber.unsupported.includes("5"),
  `unsupported=${JSON.stringify(insideNumber.unsupported)} — $5 is not supported by 2500`);
const insideWord = auditRecordClaim("Store Walk paid $24.99.", "", "I added your hours note on your page");
say("18 a short token is not matched inside a longer word", insideWord.priorEvidence === false,
  "'no' must not match inside 'note'");
const absence = auditRecordClaim("No bookings on record this week.", "");
say("19 an absence claim IS a record claim but is not a figure to verify",
  absence.claims === true && absence.unsupported.length === 0,
  `claims=${absence.claims} unsupported=${JSON.stringify(absence.unsupported)}`);

// ── 14-16. FROM SOURCE: wired, and report-only ───────────────────────────────────────
const conv = readFileSync(join(ROOT, "supabase/functions/hubly-conversation/index.ts"), "utf8");
const code = conv.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
say("14 the audit runs at the choke point and records", /auditRecordClaim\(/.test(code) && /record_claim_audit/.test(code));
say("15 the turn's evidence is collected from capability results", /turnEvidence\.push\(String\(result\.summary\)\)/.test(code)
  && /turnEvidence\.push\(JSON\.stringify\(result\.raw\)\)/.test(code));
// REPORT-ONLY IS THE WHOLE POINT. If this ever starts editing the message, this leg goes red.
const auditBlock = (code.match(/const verdict = auditRecordClaim[\s\S]{0,900}?\n      \}/) || [""])[0];
say("16 the audit changes nothing — no assignment to decision.message inside it",
  !!auditBlock && !/decision\.message\s*=/.test(auditBlock), "report only, refuses nothing");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nRecord claims are audited against what was actually read — and nothing is refused yet.");
process.exit(failed ? 1 : 0);
