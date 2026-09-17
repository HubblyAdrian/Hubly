#!/usr/bin/env node
/**
 * A DATABASE FUNCTION MAY NOT SHIP WITH NO CALLER.
 *
 *   node scripts/check-rpc-doors.mjs
 *
 * ADRIAN, 2026-09-15: "A function shipped with no caller should fail a check on the day it
 * lands, not be discovered six times by accident."
 *
 * Six times is the real count. The photo upload, the inline image editing, the trade-aware
 * booking wizard and Stripe Connect — four in one night. Then `update_business_job`: written,
 * applied, live-tested, and unreachable, so "change the driveway job to 3 PM" got silence
 * twice. Then `get_task_progress`, found by the sweep rather than by a person.
 *
 * THE BASELINE IS A DEBT, NOT A TARGET. The number may not go UP without the new entry being
 * named here and justified. It going DOWN is the point; lower it when you close one.
 *
 * Exit: 0 PASS · 1 FAIL
 */
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * THE RECORDED BASELINE — every database function that today has no caller anywhere, each with
 * the reason it is tolerated. A name here is a promise that somebody looked at it.
 *
 * Both were read on 2026-09-15:
 *
 *   get_task_progress   "N of M done today" for My Day. Shipped with the tasks migration
 *                       (20260909160000) and never called — the SIXTH instance of built-and-
 *                       doorless. It is (i) SOMETHING AN OWNER WOULD WANT AND CANNOT REACH,
 *                       and it is deliberately NOT wired yet: Adrian is choosing the next few
 *                       days of work from this list rather than having it chosen for him.
 *
 *   mark_business_test  Flips account_kind to 'test' for a draft, authorised by its draft
 *                       token. The migration's own comment says "our test tooling calls this";
 *                       no such caller exists in the repo any more. (iii) DEAD — account_kind
 *                       is set at claim time now (20260825130000). Left in place rather than
 *                       dropped, because dropping a function is a migration and this is a
 *                       measurement, not a cleanup.
 *
 *   append_business_conversation
 *                       The ORIGINAL service-role writer for business_conversations, from the
 *                       day the edge persisted the transcript. (ii) SUPERSEDED — the write moved
 *                       to the client, which calls append_my_business_conversation (claimed) or
 *                       append_draft_business_conversation (draft); both are live and carry all
 *                       the rows. Verified by grep, not assumed: the 16 rows of the 2026-09-15
 *                       walk were written by the client pair.
 */
// get_task_progress CAME OFF THIS LIST 2026-09-16 — it has a caller now (My Day's completion line).
// THE BASELINE IS A DEBT AND THE DEBT SHRANK, so it shrinks here too: leaving it would let a future
// change quietly re-doorless the function and stay green, which is the whole failure this file exists
// to prevent, pointed at its own record of the past.
const BASELINE = new Set(["mark_business_test", "append_business_conversation"]);

let out = "";
try {
  out = execFileSync(process.execPath, [join(ROOT, "scripts/measure-rpc-doors.mjs"), "--json"], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  });
} catch (e) {
  console.error("CANNOT RUN — the sweep would not run: " + String(e.message).slice(0, 200));
  process.exit(2);
}

let data;
try { data = JSON.parse(out); }
catch (e) { console.error("CANNOT RUN — the sweep's JSON would not parse: " + String(e.message).slice(0, 160)); process.exit(2); }

const found = new Set((data.doorless || []).map((r) => r.name));
const byName = new Map((data.doorless || []).map((r) => [r.name, r]));

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// ── 1. NOTHING NEW. The one that matters: a function landing today with no caller. ──────
const added = [...found].filter((n) => !BASELINE.has(n)).sort();
say("1 no database function has shipped with no caller since the baseline",
  added.length === 0,
  added.length
    ? `NEW AND UNREACHABLE: ${added.map((n) => `${n} (${byName.get(n).migration})`).join(", ")} — wire it, or add it to BASELINE in this file with the reason`
    : `${found.size} doorless, all accounted for`);

// ── 2. AND THE DEBT IS NOT QUIETLY GROWING. ─────────────────────────────────────────────
say("2 the doorless count has not gone up", found.size <= BASELINE.size,
  `${found.size} now, baseline ${BASELINE.size}`);

// ── 3. A BASELINE ENTRY THAT GOT FIXED SHOULD LEAVE THE LIST. ───────────────────────────
//
// Not a failure — closing one is the point. But a stale name is a promise nobody is keeping,
// and a list that only ever grows stops being read.
const closed = [...BASELINE].filter((n) => !found.has(n)).sort();
if (closed.length) {
  console.log(`\nNOTE  ${closed.length} baseline entr${closed.length === 1 ? "y is" : "ies are"} no longer doorless — remove ${closed.length === 1 ? "it" : "them"} from BASELINE: ${closed.join(", ")}`);
}

// ── 4. THE SWEEP ITSELF STILL SEES THE WHOLE POPULATION. ────────────────────────────────
//
// A detector that silently stops finding functions reports zero doorless and looks like
// success. It has been wrong in both directions already: it forgot every function a later
// migration dropped an overload of, and it counted working cron jobs as dead.
const total = (data.rows || []).length;
say("4 the sweep still sees the whole population", total > 90,
  `${total} functions tracked (a collapse here means the detector broke, not that the debt cleared)`);

console.log(failed
  ? `\n${failed} assertion(s) failed.`
  : "\nNo database function has shipped without a caller.");
process.exit(failed ? 1 : 0);
