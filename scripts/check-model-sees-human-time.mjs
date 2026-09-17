#!/usr/bin/env node
/**
 * [RULE] THE MODEL IS NEVER HANDED A 24-HOUR CLOCK OR AN ISO DATE.
 *
 *   node scripts/check-model-sees-human-time.mjs
 *
 * THE DEFECT, VERBATIM, FROM ADRIAN'S OWN WALK (2026-09-15 20:28, seq 37):
 *
 *     "Driveway is now set for September 17 at 3:00 — 14 Maple St, $180."
 *
 * No AM/PM. The model did nothing wrong: it was handed `2026-09-17 15:00` in the operational-state
 * block, turned the date into prose, and repeated the time as it found it. A detailer reading that
 * aloud to a customer has to guess whether it is morning or afternoon.
 *
 * WHY THIS IS A CHECK AND NOT A PROMPT LINE. A prompt instruction to add AM/PM is something the model
 * follows most of the time. A record block containing no 24-hour clock is a defect it CANNOT make.
 * Same lesson as "on 2026-09-13": **the fix is the single path, not the careful edit.**
 *
 * THE TIMEZONE TRAP IS THE OTHER HALF, and leg 5 is the one that matters. `new Date("2026-09-17")`
 * reads a bare date as UTC midnight, so in any negative-offset timezone it prints **the day before** —
 * a Thursday job described as Wednesday, from a change made purely for formatting. The date is parsed
 * by PARTS, and this check runs the legs under an explicit TZ to prove it.
 *
 * [RULE]: the legs are "no 24-hour time reaches the model", "no ISO date reaches the model", and "the
 * day does not shift". None asserts a phrasing the model produces — that is the model's to write.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { writeFileSync, mkdtempSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const dir = mkdtempSync(join(tmpdir(), "humantime-"));
const runner = join(dir, "run.ts");
writeFileSync(runner, `
import { humanDate, humanTime } from "${join(ROOT, "supabase/functions/_shared/hubly_operational_state.ts")}";
const dates = ["2026-09-17", "2026-01-01", "2026-12-31", "2026-09-17T00:00:00Z", "not a date", ""];
// "99:99" and "25:00" MATCH THE SHAPE and are still not times. They are here because "nope" does not
// reach the range check at all — it fails the pattern and returns early — so a break that made the
// range check guess "12:00 PM" went undetected. A leg about a guard must feed it something that
// reaches the guard.
const times = ["15:00", "00:00", "00:30", "12:00", "12:45", "09:05", "23:59", "3:00", "nope", "", "99:99", "25:00", "12:75"];
console.log(JSON.stringify({
  dates: dates.map((d) => [d, humanDate(d)]),
  times: times.map((t) => [t, humanTime(t)]),
}));
`);
let out;
try {
  // AN EXPLICIT NEGATIVE-OFFSET TIMEZONE. The UTC-midnight trap is invisible in UTC, which is where a
  // CI box usually runs — so the check chooses a timezone where it would show.
  out = JSON.parse(execFileSync("deno", ["run", "--allow-read", "--allow-env", "--no-check", runner],
    { encoding: "utf8", env: { ...process.env, TZ: "America/Denver" } }).trim());
} catch (e) {
  console.error("CANNOT RUN — the formatter would not run under Deno: " + String(e.message).slice(0, 200));
  process.exit(2);
}

const dmap = new Map(out.dates), tmap = new Map(out.times);
say("1 a 24-hour time becomes a 12-hour time WITH a meridiem",
    tmap.get("15:00") === "3:00 PM" && tmap.get("09:05") === "9:05 AM" && tmap.get("23:59") === "11:59 PM",
    `15:00 -> ${tmap.get("15:00")}`);
say("2 midnight and noon are the two that catch a naive modulo, and both are right",
    tmap.get("00:00") === "12:00 AM" && tmap.get("00:30") === "12:30 AM" &&
    tmap.get("12:00") === "12:00 PM" && tmap.get("12:45") === "12:45 PM",
    `00:00 -> ${tmap.get("00:00")} · 12:00 -> ${tmap.get("12:00")}`);
say("3 a value it cannot read returns null — including one that LOOKS like a time and is not",
    tmap.get("nope") === null && tmap.get("") === null && dmap.get("not a date") === null &&
    tmap.get("99:99") === null && tmap.get("25:00") === null && tmap.get("12:75") === null,
    `nope/99:99/25:00/12:75 -> ${JSON.stringify([tmap.get("nope"), tmap.get("99:99"), tmap.get("25:00"), tmap.get("12:75")])}`);
say("4 an ISO date becomes prose, month named, year kept",
    dmap.get("2026-09-17") === "September 17, 2026" && dmap.get("2026-01-01") === "January 1, 2026" &&
    dmap.get("2026-12-31") === "December 31, 2026",
    `2026-09-17 -> ${dmap.get("2026-09-17")}`);
say("5 THE DAY DOES NOT SHIFT — run under America/Denver, where new Date(\"2026-09-17\") prints the 16th",
    dmap.get("2026-09-17") === "September 17, 2026",
    `TZ=America/Denver gives ${dmap.get("2026-09-17")}`);
say("6 a timestamp with a time part still yields its own calendar day",
    dmap.get("2026-09-17T00:00:00Z") === "September 17, 2026",
    String(dmap.get("2026-09-17T00:00:00Z")));

// AND THE BLOCK THE MODEL ACTUALLY READS. A scoped absence: the `when` helper must not concatenate a
// raw date and a raw time any more.
import { readFileSync } from "node:fs";
import { codeOf, bodyOf } from "./lib/absence.mjs";
const src = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_operational_state.ts"), "utf8");
const body = codeOf(bodyOf(src, "const when = (d: unknown, t: unknown): string =>"));
say("7 `when` no longer hands the model a raw date and a raw time (scoped to its own body)",
    !!body && !/\$\{date\}\s+\$\{time\}/.test(body) && /humanDate\(/.test(body) && /humanTime\(/.test(body),
    body ? `scope = when(), ${body.length} chars of code` : "could not slice when()");

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the model is handed a time a person can read, so it cannot echo a 24-hour clock.\n");
process.exit(failed ? 1 : 0);
