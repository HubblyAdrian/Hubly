#!/usr/bin/env node
/**
 * THE BOOKING FORM CAN ASK IF IT REPEATS, AND THE ANSWER REACHES A SCHEDULE.
 *
 *   node scripts/check-wizard-cadence.mjs
 *
 * Measured 2026-09-16: 507 `?book=1` links reach a four-step wizard that collected NO cadence, so a
 * customer who wanted a standing weekly visit could only get one by typing it in chat to the
 * booking assistant — and none ever did. recurring_schedules held 0 rows, and that was the reason,
 * not a missing engine (SETTLED 17).
 *
 * THE ANSWER HAS TO WAIT. The wizard writes a booking_requests row; the owner accepts it later and
 * only then does a job exist. So the cadence rests on booking_requests.requested_frequency between
 * those two moments and becomes a schedule on accept.
 *
 * WHAT THIS GUARDS, IN ORDER OF HOW BADLY IT WOULD HURT:
 *   1. NEVER DEFAULTED — a select arriving pre-set to "Every week" would be the never-infer rule
 *      broken by a widget, and it would bill people for visits nobody asked for.
 *   2. ONE WRITER — accept must call set_job_recurring, the same function the owner's talking and
 *      by-hand doors use. A second path from a cadence to a schedule is the two-of-everything
 *      pattern with money attached.
 *   3. NOT SILENT — a repeat that fails to save must SAY so. An owner told "repeats every week" who
 *      got one job is worse off than one told nothing.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let html, mig;
try {
  html = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8");
  mig = readFileSync(resolve(ROOT, "supabase/migrations/20260916210000_booking_request_cadence.sql"), "utf8");
} catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

// ── 1. THE FIELD EXISTS, AND ITS FIRST OPTION IS A PROMPT, NOT A VALUE. ──────────────────
const sel = html.match(/<select id="bk-repeat"[\s\S]{0,600}?<\/select>/);
say("1 the wizard has a repeat field at all", !!sel, sel ? "#bk-repeat present" : "MISSING — 507 links still reach a form with no cadence");
if (sel) {
  const opts = [...sel[0].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
  say("2 NOTHING IS PRESELECTED — the first option is empty, and nothing is marked selected",
    opts[0] === "" && !/\bselected\b/.test(sel[0]),
    `first=${JSON.stringify(opts[0])} · options: ${opts.join(", ")}`);
  say("2b and the empty option reads as a choice, not as a blank",
    /Just this once/.test(sel[0]), "\"Just this once\"");
}

// ── 3. THE ANSWER TRAVELS, AND AN UNSET FIELD BECOMES NULL — NOT "weekly", NOT "". ───────
say("3 the payload carries the customer's answer, and an empty one as null",
  /requested_frequency:\s*\(document\.getElementById\('bk-repeat'\)\?\.value\|\|''\)\|\|null/.test(html),
  "empty select -> null");

// ── 4. THE COLUMN REFUSES A CADENCE IT CANNOT HONOUR. ────────────────────────────────────
say("4 the column constrains the vocabulary rather than trusting the client",
  /requested_frequency in \('weekly','biweekly','monthly','quarterly','custom'\)/.test(mig),
  "checked at the column");
say("4b and a custom cadence without its interval is refused, not silently weekly",
  /requested_frequency is distinct from 'custom'[\s\S]{0,120}requested_interval_days is not null/.test(mig),
  "custom requires an interval");

// ── 5. ONE WRITER. Accept goes through set_job_recurring, not a second path. ─────────────
say("5 accept turns the answer into a schedule through the SHARED writer",
  /db\.rpc\('set_job_recurring'/.test(html) && /requested_frequency,requested_interval_days/.test(html),
  "acceptBookingRequest -> set_job_recurring");
say("5b and it does not insert into recurring_schedules directly",
  !/from\('recurring_schedules'\)[\s\S]{0,80}\.insert/.test(html),
  "no second path from a cadence to a schedule");

// ── 6. A FAILED REPEAT IS SAID OUT LOUD, and it does not un-accept the booking. ──────────
say("6 a repeat that fails to save says so, in words",
  /the repeat did NOT save, so this is a one-off for now/.test(html),
  "never silent");
say("6b and the booking still stands — the schedule attempt is best-effort",
  /try\{[\s\S]{0,400}set_job_recurring[\s\S]{0,900}\}catch\(e\)\{/.test(html),
  "a failed schedule cannot un-accept a real booking");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe form can ask, the answer waits, and one writer turns it into a schedule.");
process.exit(failed ? 1 : 0);
