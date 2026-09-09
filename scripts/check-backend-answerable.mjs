#!/usr/bin/env node
/**
 * ANYTHING HUBLY STORES ABOUT A BUSINESS, ITS OWNER MUST BE ABLE TO ASK ABOUT.
 *
 * Every table classified `owner` in docs/backend-answerable.json must be read by a
 * slice in hubly_operational_state.ts, and every slice must resolve to at least one
 * real table. A new owner-facing table with no reader fails the build — the eighth
 * missing door prevented instead of discovered.
 *
 * ── WHY THIS IS NOT A GREP ───────────────────────────────────────────────────
 *
 * The inventory that produced this rule was built by grepping table names out of
 * application code, and that undercounted by eleven: a table written only by a
 * SECURITY DEFINER function or a trigger names itself in SQL and nowhere else.
 * Counting a NAME IN A FILE counts a form, not a fact — the same failure as counting
 * a `$` and missing every priced service without one.
 *
 * So a slice's tables are resolved through the indirection, structurally:
 *
 *   1. Bracket-match the SLICES array, then brace-match each slice object. No regex
 *      over the whole file, which would attribute one slice's tables to its neighbour.
 *   2. Inside a slice, collect direct reads — .from("customers") — AND the RPC names
 *      it calls, rpc(admin, "get_business_customers", …).
 *   3. Resolve each RPC name to its definition in supabase/migrations/, brace-match
 *      the function body, and collect the tables it reads there. That is the step a
 *      grep cannot take, and it is the whole point.
 *
 * Comments and string literals are blanked before any of this, so a table named in
 * prose (and this file's own comments are full of them) can never satisfy the check.
 *
 * DATABASE ACCESS: the core check needs none and runs inside `npm test`. `--live`
 * additionally asks the database whether any table exists that the classification has
 * never heard of; it needs `supabase db query --linked` and is NOT part of npm test.
 *
 * Exit codes:  0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE = join(ROOT, "supabase/functions/_shared/hubly_operational_state.ts");
const CLASS = join(ROOT, "docs/backend-answerable.json");
const MIGDIR = join(ROOT, "supabase/migrations");
const LIVE = process.argv.includes("--live");

const cannot = (m) => { console.error("CANNOT RUN — " + m); process.exit(2); };

let src, classification, migrations;
try {
  src = readFileSync(STATE, "utf8");
  classification = JSON.parse(readFileSync(CLASS, "utf8"));
  migrations = readdirSync(MIGDIR).filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(MIGDIR, f), "utf8")).join("\n");
} catch (e) { cannot(e.message); }

/** Blank comments and string literals, preserving offsets so brace-matching still works.
 *  A table named in a comment must never satisfy this check. */
function blank(text, sqlMode = false) {
  const out = text.split("");
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (!sqlMode && two === "//") { while (i < text.length && text[i] !== "\n") out[i++] = " "; continue; }
    if (sqlMode && two === "--") { while (i < text.length && text[i] !== "\n") out[i++] = " "; continue; }
    if (two === "/*") { const e = text.indexOf("*/", i + 2); const end = e < 0 ? text.length : e + 2;
      for (; i < end; i++) if (text[i] !== "\n") out[i] = " "; continue; }
    const q = text[i];
    if (q === '"' || q === "'" || q === "`") {
      // Keep the quotes and contents: a table name only counts inside a read call, and
      // those are matched on the ORIGINAL text after the structure is established.
      i++;
      while (i < text.length && text[i] !== q) { if (text[i] === "\\") i++; i++; }
      i++; continue;
    }
    i++;
  }
  return out.join("");
}

// ── 1. Bracket-match the SLICES array ───────────────────────────────────────
const blanked = blank(src);
const decl = blanked.search(/\bSLICES\s*:\s*SliceDef\[\]\s*=\s*\[/);
if (decl < 0) cannot("SLICES array not found in hubly_operational_state.ts");
// NOT indexOf("[", decl): the declaration is , and the first
// bracket after it belongs to the TYPE. Matching that pair closes immediately and the
// array reads as empty — which is how this check first reported "no slice objects".
const eq = blanked.indexOf("=", decl);
let d = 0, arrStart = blanked.indexOf("[", eq), arrEnd = -1;
for (let i = arrStart; i < blanked.length; i++) {
  if (blanked[i] === "[") d++;
  else if (blanked[i] === "]") { d--; if (d === 0) { arrEnd = i; break; } }
}
if (arrEnd < 0) cannot("SLICES array literal is unterminated");

// ── 2. Brace-match each slice object inside it ──────────────────────────────
const slices = [];
for (let i = arrStart + 1; i < arrEnd; i++) {
  if (blanked[i] !== "{") continue;
  let b = 0, end = -1;
  for (let j = i; j < arrEnd + 1; j++) {
    if (blanked[j] === "{") b++;
    else if (blanked[j] === "}") { b--; if (b === 0) { end = j; break; } }
  }
  if (end < 0) cannot("a slice object is unterminated");
  const body = src.slice(i, end + 1);
  const key = /\bkey:\s*"([a-z_]+)"/.exec(body)?.[1];
  if (!key) cannot(`a slice object has no key: ${body.slice(0, 80)}`);
  slices.push({ key, body });
  i = end;
}
if (!slices.length) cannot("no slice objects parsed");

// ── 3. Resolve each slice's tables, THROUGH the RPC indirection ─────────────
/** Tables a SQL function body reads. Brace/dollar-matched to that function only. */
function tablesOfSqlFunction(name) {
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, "i");
  const m = re.exec(migrations);
  if (!m) return null;                       // unresolvable — reported, never assumed empty
  const from = migrations.indexOf("$$", m.index);
  const to = from < 0 ? -1 : migrations.indexOf("$$", from + 2);
  if (from < 0 || to < 0) return null;
  const body = blank(migrations.slice(from, to), true);
  const found = new Set();
  for (const t of body.matchAll(/\b(?:from|join|into|update)\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    found.add(t[1].toLowerCase());
  }
  return found;
}

const unresolved = [];
for (const s of slices) {
  const tables = new Set();
  for (const m of s.body.matchAll(/\.from\(\s*"([a-z_]+)"/g)) tables.add(m[1]);
  for (const m of s.body.matchAll(/\brpc\(\s*admin\s*,\s*"([a-z_]+)"/g)) {
    const via = tablesOfSqlFunction(m[1]);
    if (via === null) { unresolved.push(`${s.key} calls ${m[1]}(), which is not defined in supabase/migrations/`); continue; }
    for (const t of via) tables.add(t);
  }
  s.tables = tables;
}

// ── 4. The rules ────────────────────────────────────────────────────────────
const known = new Set(Object.keys(classification.tables || {}));
const owner = Object.entries(classification.tables).filter(([, v]) => v.bucket === "owner").map(([t]) => t);
const readSomewhere = new Set();
for (const s of slices) for (const t of s.tables) if (known.has(t)) readSomewhere.add(t);

const fails = [];
for (const t of owner) if (!readSomewhere.has(t)) fails.push(`owner-facing table "${t}" has no slice that reads it`);
for (const s of slices) if (![...s.tables].some((t) => known.has(t))) fails.push(`slice "${s.key}" names no table in the classification`);
for (const [t, v] of Object.entries(classification.tables)) {
  if (v.bucket === "internal" && !String(v.reason || "").trim()) fails.push(`"${t}" is internal with no reason given`);
  if (!["owner", "internal"].includes(v.bucket)) fails.push(`"${t}" has an unknown bucket "${v.bucket}"`);
}
for (const u of unresolved) fails.push(u);

console.log(`slices: ${slices.length} · classified tables: ${known.size} · owner-facing: ${owner.length}`);
for (const s of slices) console.log(`  ${s.key.padEnd(15)} reads ${[...s.tables].filter((t) => known.has(t)).join(", ") || "(nothing classified)"}`);

if (LIVE) {
  let live;
  try {
    const out = execFileSync("supabase", ["db", "query", "--linked",
      "select string_agg(table_name, ',' order by table_name) as t from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"],
      { encoding: "utf8", cwd: ROOT });
    live = /"t":\s*"([^"]+)"/.exec(out)?.[1]?.split(",");
  } catch (e) { cannot("--live could not reach the database: " + e.message); }
  if (!live) cannot("--live got no table list back");
  const missing = live.filter((t) => !known.has(t));
  console.log(`\nlive tables: ${live.length}`);
  for (const t of missing) fails.push(`table "${t}" exists in the database and is not classified — say which bucket it is in`);
}

if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("PASS — every owner-facing table has a reader, and every slice names one.");
process.exit(0);
