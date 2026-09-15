#!/usr/bin/env node
/**
 * EVERY DATABASE FUNCTION WE SHIP, AND WHETHER ANYTHING CAN REACH IT.
 *
 *   node scripts/measure-rpc-doors.mjs            # the summary and the missing-door list
 *   node scripts/measure-rpc-doors.mjs --json     # the rows
 *
 * WHY THIS EXISTS, AND WHY measure-capability-doors.mjs DOES NOT COVER IT.
 *
 * "Look for the missing door before building the room" has now been the right diagnosis FIVE
 * times: the photo upload, the inline image editing, the trade-aware booking wizard and Stripe
 * Connect (all four in one night), and then on 2026-09-15 `update_business_job` — a writer
 * written, applied and live-tested the night before, refusing not_owner / no_job / no_change
 * correctly, and appearing NOWHERE in supabase/functions. The owner typed "change the driveway
 * job to 3 PM" twice and got silence both times.
 *
 * measure-capability-doors.mjs scans exported FUNCTIONS in _shared. It cannot see this class at
 * all: an RPC lives in a migration, and a migration that ships a working function nothing calls
 * is invisible to every check we own. The fifth instance is what makes it a class rather than
 * an anecdote, so it gets a measurement instead of another anecdote.
 *
 * WHAT COUNTS AS A DOOR. A caller anywhere that names the function: an edge function, the
 * browser monolith, or a script. A NAME MATCH IS DELIBERATELY GENEROUS — it over-counts doors
 * and under-counts the problem, which is the safe direction for a list whose whole purpose is
 * "these have nothing". A function reported as doorless here has genuinely no textual caller.
 *
 * WHAT IS NOT A DEFECT. Plenty of these are correctly callerless: triggers, functions called
 * only from other SQL, and helpers a policy invokes. They are SPLIT OUT rather than counted, on
 * the same discipline as the 51-of-62 split in measure-capability-doors — a number that lumps
 * "nothing calls it" together with "nothing should call it" is a number nobody can act on.
 *
 * Exit: always 0. This measures; it does not judge.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");

/** Strip SQL comments so a function named only in a comment is not read as a definition. */
const stripSql = (s) => s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

// ── 1. EVERY FUNCTION WE DEFINE, and where it was defined last. ────────────────────────
const migDir = join(ROOT, "supabase/migrations");
const migs = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
// A FUNCTION THAT WAS LATER DROPPED IS NOT A FUNCTION WE SHIP. Migrations are a LEDGER, read
// in order — `set_business_name_unset` was created on 2026-09-09 and dropped on 2026-09-10, and
// the first version of this file listed it as shipped-with-no-caller. Reporting a function that
// does not exist as a missing door is the same defect as reporting a working cron job as dead:
// it puts noise on a list whose whole value is that every line is worth acting on.
const defined = new Map();   // name -> { migration, returnsTrigger }
const createCount = new Map();  // name -> how many CREATE statements the ledger has for it
for (const f of migs) {
  const src = stripSql(readFileSync(join(migDir, f), "utf8"));
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns\s+([a-z0-9_ .]+)/gi;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    const returns = (m[3] || "").trim().toLowerCase();
    defined.set(name, { name, migration: f, returnsTrigger: /^trigger\b/.test(returns) });
    createCount.set(name, (createCount.get(name) || 0) + 1);
  }
  // ── A DROP IS BY SIGNATURE; THIS TRACKING IS BY NAME, AND THE DIFFERENCE MATTERS ──────
  //
  // `drop function public.update_business_job(uuid,uuid,uuid,text,text,text,uuid)` removes ONE
  // OVERLOAD. The first version of this deletion deleted the NAME, so update_business_job —
  // which exists in pg_proc right now and which the product calls — vanished from the sweep
  // entirely. A sweep that silently forgets a live function is worse than one that lists a dead
  // one: the dead entry is noise you can read past, the missing entry is a door you will never
  // be told about.
  //
  // Comparing signatures properly means normalising Postgres type names on both sides, which is
  // a parser. The rule here is cruder and states its own limit: a drop removes the name only
  // when the ledger has EXACTLY ONE create for it — a single definition being dropped is a
  // removal. Two or more creates means overloads exist and this drop is a cleanup, so the name
  // stands. That is right for every case in this repo today (the _debug_* one-offs and
  // set_business_name_unset each have one create; update_business_job has two), and it is
  // deliberately biased toward KEEPING a name, because a false "dead" is the costlier error.
  const dropRe = /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(/gi;
  let d;
  while ((d = dropRe.exec(src))) {
    const name = d[1].toLowerCase();
    if ((createCount.get(name) || 0) > 1) continue;                 // an overload cleanup
    const recreatedAfter = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${name}\\s*\\(`, "i")
      .test(src.slice(d.index));
    if (!recreatedAfter) defined.delete(name);
  }
}

// ── 2. EVERY PLACE A NAME COULD BE CALLED FROM. ────────────────────────────────────────
function walk(dir, out = [], depth = 0) {
  if (depth > 6) return out;
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git" || e === "backups" || e.startsWith(".")) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out, depth + 1);
    else if (/\.(ts|tsx|js|mjs|html)$/.test(e)) out.push(p);
  }
  return out;
}
const callerFiles = [
  ...walk(join(ROOT, "supabase/functions")),
  ...walk(join(ROOT, "public")),
  ...walk(join(ROOT, "scripts")),
  ...walk(join(ROOT, "api")),
];
// One concatenated haystack per LANE, so the report can say which side reaches it.
const lanes = { edge: "", client: "", script: "" };
// ── THIS SWEEP AND ITS CHECKER ARE NOT DOORS ──────────────────────────────────────────
//
// Both files NAME the functions they report as unreachable — check-rpc-doors.mjs carries them
// in its BASELINE with the reason each is tolerated. Because the sweep scans scripts/, writing
// that baseline gave every entry a "script" door, the doorless list emptied, and the check went
// green while reporting nothing. An instrument that is silenced by being used is worse than no
// instrument: it reads exactly like success.
//
// Naming a thing in order to say it is unreachable must never make it reachable.
const SELF = ["measure-rpc-doors.mjs", "check-rpc-doors.mjs", "RPC_DOORS"];
for (const f of callerFiles) {
  if (SELF.some((x) => f.includes(x))) continue;
  let src = ""; try { src = readFileSync(f, "utf8"); } catch { continue; }
  const lane = f.includes("/supabase/functions/") ? "edge" : f.includes("/public/") ? "client" : "script";
  lanes[lane] += "\n" + src;
}
// SQL calls SQL: a function invoked only from another migration is an internal step.
let sqlHay = "";
for (const f of migs) sqlHay += "\n" + stripSql(readFileSync(join(migDir, f), "utf8"));
const sqlLines = sqlHay.split("\n");

// ── pg_cron IS A CALLER, AND IT LIVES IN THE DATABASE, NOT THE REPO ───────────────────
//
// The first run of this file listed purge_model_calls, purge_placement_outcomes,
// purge_first_turn_text and sweep_stalled_document_builds as having no caller anywhere. All
// four are SCHEDULED — `select cron.job` shows them running daily, and sweep_stalled_document_
// builds every two minutes. A detector that reports four working maintenance jobs as dead is a
// detector that gets muted, and a muted list is worse than no list.
//
// The schedules are created by migrations (`select cron.schedule('name', '...', $$ select
// public.fn(); $$)`), so the caller IS in the repo — it was simply inside the same SQL haystack
// that "called from another migration" already collapses into "an internal step". It is pulled
// out and named, because "a cron runs it daily" and "another function calls it" are different
// facts about a door and only one of them is a product surface.
// ONLY THE COMMAND THE SCHEDULE RUNS, never the rest of the file. The first version split on
// `cron.schedule` and kept everything AFTER it, so any function defined lower in a migration
// that happened to contain a schedule was read as scheduled — it silently rescued
// `append_business_conversation`, which a grep proves has no caller at all. A detector that
// over-matches is not "the safe direction" here: it turns a missing door into a green row.
const cronHay = migs
  .map((f) => stripSql(readFileSync(join(migDir, f), "utf8")))
  .join("\n")
  .match(/cron\.schedule\s*\([\s\S]*?\)\s*;/gi)?.join("\n") || "";

// ── 3. WHO REACHES WHAT. ───────────────────────────────────────────────────────────────
const rows = [];
for (const [name, def] of defined) {
  const word = new RegExp(`\\b${name}\\b`);
  const doors = [];
  if (word.test(lanes.edge)) doors.push("edge");
  if (word.test(lanes.client)) doors.push("client");
  if (word.test(lanes.script)) doors.push("script");
  // ── IS IT CALLED FROM OTHER SQL? COUNTED LINE BY LINE, NOT BY A RATIO. ───────────────
  //
  // This was `mentions > ownDefs * 5` — a guess that each definition drags about five
  // administrative lines with it. It was wrong in both directions and it MISSED FOUR REAL
  // CALLERS: hubly_derive_slug (two trigger functions), hubly_slug_available (set_business_slug,
  // twice), and names_corroborate (the supersede statement in its own migration). All four were
  // reported as having no caller anywhere, which is how a list of six "worth reading" turned out
  // to contain four that were already wired. A heuristic that cannot name WHICH line it counted
  // is a heuristic nobody can check — so the administrative lines are identified and excluded,
  // and what remains is a call.
  const admin = new RegExp(
    `^\\s*(?:create\\s+(?:or\\s+replace\\s+)?function|drop\\s+function|grant\\s|revoke\\s|comment\\s+on\\s+function)` +
    `[^\\n]*\\b${name}\\b`, "i");
  const sqlCallLines = sqlLines.filter((l) => new RegExp(`\\b${name}\\b`).test(l) && !admin.test(l));
  const calledFromSql = sqlCallLines.length > 0;
  const scheduled = word.test(cronHay);
  if (scheduled) doors.push("cron");
  // SQL CALLING SQL IS A DOOR TOO. Without this, hubly_derive_slug (two trigger functions),
  // hubly_slug_available (set_business_slug) and names_corroborate (the supersede statement)
  // were reported under "the product cannot use these" while being invoked on every write that
  // touches a name. calledFromSql was already computed and simply never counted as a door.
  if (calledFromSql) doors.push("sql");
  rows.push({ name, migration: def.migration, returnsTrigger: def.returnsTrigger, doors, calledFromSql, scheduled });
}

// CLASSIFIED IN ORDER, AND A ROW LANDS IN EXACTLY ONE BUCKET. Triggers are identified FIRST:
// once "called from SQL" became a door, every trigger function acquired one (a `create trigger`
// names it), and the TRIGGERS line read 0 while 20 of them existed. A summary whose buckets
// overlap is a summary that can be read three ways.
const triggers = rows.filter((r) => r.returnsTrigger);
const rest = rows.filter((r) => !r.returnsTrigger);
const withDoor = rest.filter((r) => r.doors.some((d) => d !== "sql"));
const scheduledOnly = rest.filter((r) => r.scheduled);
const sqlOnly = rest.filter((r) => !r.doors.some((d) => d !== "sql") && r.calledFromSql);
const doorless = rest.filter((r) => !r.doors.length);

if (JSON_OUT) { console.log(JSON.stringify({ rows, doorless }, null, 2)); process.exit(0); }

console.log(`database functions defined in supabase/migrations: ${rows.length}   (migrations scanned: ${migs.length})\n`);
console.log(`  REACHABLE (edge, client, a script or cron)         ${String(withDoor.length).padStart(4)}`);
console.log(`     scheduled in pg_cron (a cron is the caller)     ${String(scheduledOnly.length).padStart(4)}   <- maintenance, correctly has no UI`);
console.log(`     edge                                           ${String(withDoor.filter((r) => r.doors.includes("edge")).length).padStart(4)}`);
console.log(`     client (public/)                               ${String(withDoor.filter((r) => r.doors.includes("client")).length).padStart(4)}`);
console.log(`     a script only                                  ${String(withDoor.filter((r) => r.doors.length === 1 && r.doors[0] === "script").length).padStart(4)}   <- measured, never used by the product`);
console.log(`  TRIGGERS (a create trigger is the caller)         ${String(triggers.length).padStart(4)}`);
console.log(`  CALLED FROM SQL ONLY (an internal step)            ${String(sqlOnly.length).padStart(4)}`);
console.log(`  NOTHING NAMES THEM, ANYWHERE                       ${String(doorless.length).padStart(4)}   <- the missing-door list\n`);

if (doorless.length) {
  console.log("THE MISSING-DOOR LIST — shipped, applied, and nothing can call them:\n");
  for (const r of doorless.sort((a, b) => b.migration.localeCompare(a.migration))) {
    console.log(`  ${r.name.padEnd(42)} ${r.migration}`);
  }
  console.log("\nA name match is generous on purpose: it over-counts doors, so everything above");
  console.log("genuinely has no textual caller. Read each before calling it dead — some are");
  console.log("deliberate (an operator tool, a one-off repair), and those are worth SAYING so.");
}
// SCRIPT-ONLY IS ITS OWN WARNING. A writer only a measurement script calls is a writer the
// product cannot use — exactly the shape update_business_job was in for a day.
const scriptOnly = withDoor.filter((r) => r.doors.length === 1 && r.doors[0] === "script");
if (scheduledOnly.length) {
  console.log(`\nSCHEDULED MAINTENANCE (${scheduledOnly.length}) — a cron is the caller, which is the right door for these:\n`);
  for (const r of scheduledOnly) console.log(`  ${r.name.padEnd(42)} ${r.migration}`);
}
if (scriptOnly.length) {
  console.log(`\nREACHED ONLY BY A SCRIPT (${scriptOnly.length}) — the product cannot use these:\n`);
  for (const r of scriptOnly.sort((a, b) => b.migration.localeCompare(a.migration))) {
    console.log(`  ${r.name.padEnd(42)} ${r.migration}`);
  }
}
