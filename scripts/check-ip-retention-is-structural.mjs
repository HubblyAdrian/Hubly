#!/usr/bin/env node
/**
 * [RULE] AN IP ADDRESS IS DELETED WHEN ITS PURPOSE EXPIRES, BY A PROPERTY OF THE TABLE.
 *
 *   node scripts/check-ip-retention-is-structural.mjs
 *
 * ADRIAN, 2026-09-16: "Delete rows once their purpose has expired, and make the deletion STRUCTURAL so
 * it cannot be forgotten — not a job someone remembers to run."
 *
 * THE GAP THAT WAS MEASURED. `draft_creation_events` exists for one purpose — a 10-drafts-per-IP-per-
 * hour limit that only ever reads the last hour — and nothing deleted anything. **315 rows back to
 * 2026-08-21**, every one past its purpose, every one an IP address. And a privacy notice cannot
 * honestly promise a retention the code does not implement.
 *
 * THIS CHECK READS THE MIGRATION, NOT THE DATABASE, AND SAYS SO. It is a source check on purpose:
 * running it must not require credentials, must not be skipped in an environment that has none, and
 * must not write to a real table on every `npm test`. The live behaviour was verified once, by use,
 * against the real database on 2026-09-16 — a row planted 30 hours old did not survive its own
 * insert, and 315 rows became 7 — and that verification is recorded in docs/legal/PRIVACY_DRAFT.md
 * rather than re-run here. **What this check defends is the thing that could silently regress: the
 * trigger being dropped, or the retention being quietly loosened.**
 *
 * [RULE], not [SHAPE]: the legs are "the deletion is attached to the writer", "it is not a cron job",
 * and "the window the notice promises is the window the code enforces". None asserts a row count.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { codeOf } from "./lib/absence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIG = join(ROOT, "supabase/migrations");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// THE LATEST migration that touches the trigger — never a hardcoded filename, so a later migration
// that changes the retention is the one this reads.
const files = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
const touching = files.filter((f) => readFileSync(join(MIG, f), "utf8").includes("draft_creation_events_prune"));
if (!touching.length) {
  console.error("CANNOT RUN — no migration mentions draft_creation_events_prune.");
  console.error("  That is either the trigger never existing or this check looking in the wrong place;");
  console.error("  refusing to report 'no retention' off a reader that found nothing.");
  process.exit(2);
}
const latest = touching[touching.length - 1];
const sql = readFileSync(join(MIG, latest), "utf8");
const code = codeOf(sql).replace(/^--.*$/gm, " ");   // SQL line comments too: this file explains itself at length

console.log(`\nReading ${latest} — the latest migration that defines the retention.\n`);

// THE NAME IS MATCHED WHOLE. The first version tested the bare prefix, so renaming the trigger to
// `draft_creation_events_prune_OFF` — which is how a trigger actually gets disabled by hand — still
// matched and the leg stayed green against a table with no working retention. A prefix is not a name.
say("1 the deletion exists and is a TRIGGER on the table that holds the addresses",
    /create\s+trigger\s+draft_creation_events_prune\b(?!_)/i.test(code) &&
    /on\s+public\.draft_creation_events/i.test(code),
    "trigger draft_creation_events_prune");

say("2 it fires on the WRITE, so a row cannot be added without expired rows being removed",
    /after\s+insert\s+on\s+public\.draft_creation_events/i.test(code),
    "after insert — the same statement that creates the need");

// SCOPED NEGATIVE ASSERTION, comments stripped: this file's own prose explains at length why a cron
// job was rejected, and a file-wide search for "cron" would trip on the explanation.
say("3 it is NOT a scheduled job — a cron entry can be disabled, forgotten after a restore, or stop silently",
    !/cron\.schedule|pg_cron/i.test(code),
    "no scheduler in the migration's code (comments stripped)");

const win = code.match(/interval\s*'(\d+)\s*hours?'/i);
say("4 the window is declared once and is the one the privacy notice promises",
    !!win && Number(win[1]) === 24, win ? `interval '${win[1]} hours'` : "no interval found");

const winCount = (code.match(/interval\s*'\d+\s*hours?'/gi) || []).length;
say("5 the trigger and the one-off backlog delete use the SAME window — not two numbers that agree by luck",
    winCount >= 2 && new Set((code.match(/interval\s*'\d+\s*hours?'/gi) || []).map((s) => s.toLowerCase())).size === 1,
    `${winCount} uses, all "${win ? win[0] : "?"}"`);

// TWO DELETES, AND THEY ARE DIFFERENT DELETES. One lives inside the trigger function and runs
// forever; one runs ONCE in this migration and clears what was already past its purpose. Counting
// "is there a delete" could not tell them apart — removing the backlog delete left the trigger's own
// and the leg stayed green, which is how a promised retention becomes false on the day it ships.
const deletes = (code.match(/delete\s+from\s+public\.draft_creation_events/gi) || []).length;
say("6 the backlog was deleted in the migration TOO, so the promised retention was true the day it shipped",
    deletes >= 2, `${deletes} deletes: the trigger's, and the one-off backlog`);

// THE NOTICE AND THE CODE MUST AGREE. A privacy notice is a promise; this is the leg that keeps it
// one the code actually keeps.
const notice = readFileSync(join(ROOT, "docs/legal/PRIVACY_DRAFT.md"), "utf8");
const said = notice.match(/deleted after (\d+) hours/i);
say("7 the privacy draft promises exactly the window the code enforces",
    !!said && !!win && Number(said[1]) === Number(win[1]),
    said && win ? `notice says ${said[1]}h · code enforces ${win[1]}h` : "could not read one of the two");
say("8 the notice does not claim a schedule the code does not have",
    /structural rather than scheduled/i.test(notice) && !/nightly|cron job runs|scheduled job deletes/i.test(notice),
    "notice describes a trigger, not a job");

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the address expires by a property of the table, and the notice promises what the code enforces.\n");
process.exit(failed ? 1 : 0);
