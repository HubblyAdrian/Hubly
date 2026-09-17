#!/usr/bin/env node
/**
 * WHAT IS STILL HERE THAT NOBODY CAN RESTATE THE PURPOSE OF.
 *
 *   node scripts/audit-orphans.mjs
 *
 * Adrian, 2026-09-17: *"tasks and code nobody can restate the purpose of. For each: what it is,
 * when it was added, how many references, whether anything live reaches it. Sort by zero
 * references, oldest first — `ask_hubly_conversations` from July is the archetype. DO NOT DELETE
 * ANYTHING."*
 *
 * ══ AND THE ARCHETYPE IS THE WARNING, NOT THE MODEL ═════════════════════════════════════════
 *
 * `ask_hubly_conversations` had zero rows and zero references from 2026-07-27 to 2026-09-17, which
 * is exactly what this sweep looks for — and it was not dead. It was BUILT, AUTHORISED (owner RLS
 * on both tables) and UNREACHABLE, and the fix was one column plus a caller. Deleting it would have
 * destroyed the storage for conversation identity, a feature Adrian had wanted since the beginning.
 *
 * So the output of this file is **"nobody has restated the purpose of this"**, which is a QUESTION
 * for Adrian, not a verdict. "Look for the missing door before building the room" applies in
 * reverse too: an unreferenced capability is more often a missing door than a dead room. Nothing
 * here is deleted, and nothing here recommends deletion without saying which of the two it is.
 *
 * Exit: 0 always. It is a sweep.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};

/* ── THE SEARCHABLE SURFACE. Everything that could REACH a thing. ────────────────────────────── */
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.name === "node_modules" || f.name === ".git" || f.name.startsWith(".")) continue;
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(ts|mjs|js|html|sql|json)$/.test(f.name)) out.push(p);
  }
  return out;
};
const FILES = walk(ROOT).map((p) => ({ p, rel: p.slice(ROOT.length + 1), text: readFileSync(p, "utf8") }));
/* "LIVE" means code a person or a request can reach: the two shells, the edge functions, the api
   router. A reference from scripts/ or docs/ is a reference from our OWN tooling and does not make
   anything reachable by a user — that distinction is the whole point of the last column. */
const isLive = (rel) => rel.startsWith("public/") || rel.startsWith("supabase/functions/") || rel.startsWith("api/");
const refs = (needle) => {
  const rx = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  let all = 0, live = 0, where = [];
  for (const f of FILES) {
    if (f.rel.startsWith("supabase/migrations/")) continue;      // a table's own DDL is not a caller
    if (f.rel === "scripts/audit-orphans.mjs") continue;         // this file names them all
    const n = (f.text.match(rx) || []).length;
    if (!n) continue;
    all += n; if (isLive(f.rel)) { live += n; where.push(f.rel); }
  }
  return { all, live, where: [...new Set(where)].slice(0, 3) };
};
/** WHEN IT WAS ADDED, READ FROM THE THING THAT ALREADY RECORDS IT.
 *
 *  The first version ran `git log -S <name>` per table. Sixty tables × the whole history × a 3MB
 *  HTML file in every diff, and it produced ZERO BYTES of output in several minutes before it was
 *  killed. The date was available without searching history at all: a migration filename IS a
 *  timestamp, and the earliest migration that names the table is when the table arrived. An
 *  instrument that has to be killed answers nothing, which is worse than answering approximately. */
const MIGRATIONS = readdirSync(join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql")).sort()
  .map((f) => ({ f, when: f.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
                 text: readFileSync(join(ROOT, "supabase/migrations", f), "utf8") }));
const bornTable = (t) => {
  const rx = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?"?${t}"?`, "i");
  const hit = MIGRATIONS.find((m) => rx.test(m.text)) || MIGRATIONS.find((m) => m.text.includes(t));
  return hit ? hit.when : "—";
};
const bornFn = (f) => {
  try {
    const out = execFileSync("git", ["log", "--diff-filter=A", "--format=%ad", "--date=short", "-1",
      "--", `supabase/functions/${f}/index.ts`], { encoding: "utf8", cwd: ROOT }).trim();
    return out || "—";
  } catch (_) { return "—"; }
};

/* ── DIMENSION 1: TABLES ─────────────────────────────────────────────────────────────────────── */
const tables = q(`select c.relname as t, coalesce(s.n_live_tup,0) as est
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  left join pg_stat_user_tables s on s.relid=c.oid
  where n.nspname='public' and c.relkind='r' order by c.relname`);
// ONE ROUND TRIP, NOT SIXTY. n_live_tup is an ESTIMATE and is labelled as one below; an exact
// count per table is sixty queries and the question here is "is this empty", which the estimate
// answers for everything except a table that was just vacuumed. The zero-row claims are re-read
// exactly, in one union, because zero is the claim that decides whether a line is an orphan.
const rowsOf = {};
for (const { t, est } of tables) rowsOf[t] = Number(est);
try {
  const zeros = tables.filter((x) => Number(x.est) === 0).map((x) => x.t);
  if (zeros.length) {
    const union = zeros.map((t) => `select '${t}' as t, count(*) as n from public."${t}"`).join(" union all ");
    for (const r of q(union)) rowsOf[r.t] = Number(r.n);
  }
} catch (_) {}

/* ── DIMENSION 2: EDGE FUNCTIONS ─────────────────────────────────────────────────────────────── */
const fnDir = join(ROOT, "supabase/functions");
const fns = readdirSync(fnDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(fnDir, d.name, "index.ts")))
  .map((d) => d.name);

const out = [];
for (const { t } of tables) {
  const r = refs(t);
  out.push({ kind: "table", name: t, rows: rowsOf[t], added: bornTable(t), refs: r.all, live: r.live, where: r.where });
}
/* ── AND A TRIGGER OR A CRON JOB IS A CALLER. ────────────────────────────────────────────────
   The first run of this sweep reported NINE edge functions as "nothing live reaches", and two of
   them — `ops-alert` and `hubly-recurring-maintain` — are on cron in this database RIGHT NOW,
   every 10 and every 30 minutes. `signup-notify` is invoked by a trigger. The sweep had defined
   "live" as public/ + functions/ + api/, which excludes the two callers that are not code we grep:
   a `net.http_post` inside a migration, and `cron.job.command` in the database.

   That is the empty-reader rule pointed at a sweep: an unreachable-looking function had told me
   about MY DEFINITION, not about itself — and this list's whole purpose is to be shown to Adrian as
   "can you restate why this exists". A cron job answers that question on its own. */
let cronFns = new Set();
try {
  for (const r of q(`select substring(command from 'functions/v1/([a-z0-9-]+)') as fn from cron.job`))
    if (r.fn) cronFns.add(r.fn);
  console.log(`  cron.job invokes ${cronFns.size} edge function(s): ${[...cronFns].join(", ") || "(none)"}`);
} catch (_) { console.log(`  cron.job NOT READABLE — edge functions invoked only by cron will read as orphans below`); }
const migrationCalls = new Set();
for (const m of MIGRATIONS)
  for (const hit of m.text.matchAll(/functions\/v1\/([a-z0-9-]+)/g)) migrationCalls.add(hit[1]);
console.log(`  migrations invoke ${migrationCalls.size} edge function(s) via net.http_post: ${[...migrationCalls].join(", ")}\n`);

for (const f of fns) {
  const r = refs(`functions/v1/${f}`);
  const r2 = refs(`"${f}"`);
  const byCron = cronFns.has(f), byTrigger = migrationCalls.has(f);
  const how = [byCron ? "cron.job" : null, byTrigger ? "a migration's net.http_post" : null].filter(Boolean);
  out.push({ kind: "edge fn", name: f, rows: null, added: bornFn(f),
             refs: r.all + r2.all, live: r.live + r2.live + (byCron ? 1 : 0) + (byTrigger ? 1 : 0),
             where: [...new Set([...r.where, ...r2.where, ...how])].slice(0, 3) });
}

/* ── SORT: ZERO REFERENCES FIRST, OLDEST FIRST ───────────────────────────────────────────────── */
out.sort((a, b) => (a.refs - b.refs) || String(a.added).localeCompare(String(b.added)) || a.name.localeCompare(b.name));

const dead = out.filter((o) => o.live === 0);
console.log(`ORPHAN SWEEP — ${tables.length} tables, ${fns.length} edge functions.\n`);
console.log(`${dead.length} thing(s) NOTHING LIVE REACHES. "Live" = public/, supabase/functions/, api/,`);
console.log(`plus cron.job and a migration's net.http_post. A reference from scripts/ or docs/ is our`);
console.log(`own tooling and does not make anything reachable by a person.`);
console.log(``);
console.log(`ONE CALLER CLASS IS STILL INVISIBLE HERE, and it is named rather than left to be`);
console.log(`discovered: AN EXTERNAL SERVICE POSTING TO A FUNCTION. \`stripe-webhook\` is called by`);
console.log(`Stripe, not by us; an OAuth redirect is called by the provider. Nothing in this repo or`);
console.log(`this database records those, so a function below may be fully live and reached only from`);
console.log(`outside. Check the provider's dashboard before treating any webhook-shaped name as dead.\n`);
console.log(`  ${"WHAT".padEnd(40)} ${"ROWS".padStart(7)}  ${"ADDED".padEnd(11)} ${"REFS".padStart(5)} ${"LIVE".padStart(5)}`);
for (const o of dead) {
  console.log(`  ${(o.kind + " " + o.name).padEnd(40)} ${String(o.rows ?? "—").padStart(7)}  ${String(o.added).padEnd(11)} ` +
    `${String(o.refs).padStart(5)} ${String(o.live).padStart(5)}` +
    (o.rows === 0 || o.rows === "0" ? "   ← zero rows AND nothing live reads it" : ""));
}
console.log(`\nREACHED BY LIVE CODE (not orphans, listed so the count above has a denominator): ${out.length - dead.length}`);
const thin = out.filter((o) => o.live > 0 && o.live <= 2 && (o.rows === 0 || o.rows === "0"));
if (thin.length) {
  console.log(`\n${thin.length} REACHED BUT EMPTY — a door exists and nothing has ever come through it:`);
  for (const o of thin) console.log(`  ${(o.kind + " " + o.name).padEnd(40)} rows ${String(o.rows).padStart(3)}  live refs ${o.live}  in ${o.where.join(", ")}`);
}
console.log(`\nNOTHING WAS DELETED. Each line is "nobody has restated the purpose of this", which is a`);
console.log(`question for Adrian — ask_hubly_conversations sat here for seven weeks and was not dead.`);
