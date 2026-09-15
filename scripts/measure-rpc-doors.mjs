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
const defined = new Map();   // name -> { migration, isTrigger, returnsTrigger }
for (const f of migs) {
  const src = stripSql(readFileSync(join(migDir, f), "utf8"));
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns\s+([a-z0-9_ .]+)/gi;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    const returns = (m[3] || "").trim().toLowerCase();
    defined.set(name, { name, migration: f, returnsTrigger: /^trigger\b/.test(returns) });
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
for (const f of callerFiles) {
  let src = ""; try { src = readFileSync(f, "utf8"); } catch { continue; }
  const lane = f.includes("/supabase/functions/") ? "edge" : f.includes("/public/") ? "client" : "script";
  lanes[lane] += "\n" + src;
}
// SQL calls SQL: a function invoked only from another migration is an internal step.
let sqlHay = "";
for (const f of migs) sqlHay += "\n" + stripSql(readFileSync(join(migDir, f), "utf8"));

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
  // Calls from OTHER migrations, not counting this function's own definition(s).
  const ownDefs = (sqlHay.match(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${name}\\b`, "gi")) || []).length;
  const mentions = (sqlHay.match(new RegExp(`\\b${name}\\b`, "g")) || []).length;
  // Each definition also carries revoke/grant/comment lines naming it; 4 is the usual tail.
  const calledFromSql = mentions > ownDefs * 5;
  const scheduled = word.test(cronHay);
  if (scheduled) doors.push("cron");
  rows.push({ name, migration: def.migration, returnsTrigger: def.returnsTrigger, doors, calledFromSql, scheduled });
}

const withDoor = rows.filter((r) => r.doors.length);
// SCHEDULED IS A PROPERTY, NOT A BUCKET. A purge is usually named by a measurement script too,
// so "cron and nothing else" reported 0 while four jobs were running daily. Count the property.
const scheduledOnly = rows.filter((r) => r.scheduled);
const triggers = rows.filter((r) => !r.doors.length && r.returnsTrigger);
const sqlOnly = rows.filter((r) => !r.doors.length && !r.returnsTrigger && r.calledFromSql);
const doorless = rows.filter((r) => !r.doors.length && !r.returnsTrigger && !r.calledFromSql);

if (JSON_OUT) { console.log(JSON.stringify({ rows, doorless }, null, 2)); process.exit(0); }

console.log(`database functions defined in supabase/migrations: ${rows.length}   (migrations scanned: ${migs.length})\n`);
console.log(`  REACHABLE (named by edge, client, a script or cron) ${String(withDoor.length).padStart(4)}`);
console.log(`     scheduled in pg_cron (a cron is the caller)     ${String(scheduledOnly.length).padStart(4)}   <- maintenance, correctly has no UI`);
console.log(`     edge                                           ${String(withDoor.filter((r) => r.doors.includes("edge")).length).padStart(4)}`);
console.log(`     client (public/)                               ${String(withDoor.filter((r) => r.doors.includes("client")).length).padStart(4)}`);
console.log(`     a script only                                  ${String(withDoor.filter((r) => r.doors.length === 1 && r.doors[0] === "script").length).padStart(4)}   <- measured, never used by the product`);
console.log(`  TRIGGERS (correctly have no caller)                ${String(triggers.length).padStart(4)}`);
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
