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

/* ── MISSING DOOR OR DEAD ROOM — the distinction that is the whole value of this sweep ─────────
 *
 * Adrian, 2026-09-17: *"An unreferenced table with owner RLS on it is a capability somebody MEANT to
 * reach. That distinction is the whole value of the sweep and right now it is not in the output."*
 *
 * `ask_hubly_conversations` is why. It sat here for seven weeks with zero rows and zero references,
 * and it was not dead: it had owner RLS on both tables, which is somebody having decided who is
 * allowed in. The fix was one column and a caller, not a build.
 *
 * READ FROM pg_policy, not guessed:
 *   MISSING DOOR   RLS on, and at least one policy scoped to auth.uid() or owner_id. Somebody
 *                  authorised an OWNER to reach this. Nothing calls it. That is a missing door.
 *   SERVICE-ONLY   RLS on, but no owner-scoped policy — only the service role can touch it. Neither
 *                  a door nor a room: infrastructure, and it is a THIRD answer rather than being
 *                  forced into one of two. Forcing it would be the flattering-default error.
 *   DEAD ROOM      no RLS at all, or no policies. Built, never authorised, never called.
 */
let policyOf = new Map();
try {
  const pol = q(`select c.relname as t, c.relrowsecurity as rls, count(p.polname) as policies,
                        count(*) filter (where p.polqual::text like '%auth.uid()%'
                                            or p.polqual::text like '%owner_id%') as owner_scoped
                   from pg_class c join pg_namespace n on n.oid=c.relnamespace
                   left join pg_policy p on p.polrelid=c.oid
                  where n.nspname='public' and c.relkind='r' group by 1,2`);
  policyOf = new Map(pol.map((r) => [r.t, r]));
} catch (_) { console.log("  pg_policy NOT READABLE — every table below will read as UNKNOWN rather than as a dead room"); }
const doorOf = (name, rows) => {
  // ══ ROWS DECIDE FIRST, AND THIS WAS WRONG UNTIL IT DIDN'T ═════════════════════════════════════
  //
  // The first version tagged `model_calls` (734 rows), `rebuild_outcome_events` (259) and
  // `first_turn_outcomes` (87) as DEAD ROOMS, on the reasoning "RLS on, no policies, no live code
  // reference". Every part of that was true and the conclusion was nonsense: SOMETHING IS WRITING
  // THEM. The writers are RPCs and the service role, and neither mentions the table name in code a
  // grep of public/ and supabase/functions/ can see — so "0 live references" was a fact about my
  // reachability test, for the third time in this file.
  //
  // A table with rows has answered the question. It is reached; only HOW is unknown.
  const n = Number(rows);
  if (Number.isFinite(n) && n > 0)
    return { tag: "REACHED (has rows)", why: `${n} row(s) exist, so something writes it — the zero live ` +
      `references mean the writer is INDIRECT (an rpc, a trigger, the service role), not that it is dead` };
  const p = policyOf.get(name);
  if (!p) return { tag: "UNKNOWN", why: "policies not readable — not called a dead room on a failed read" };
  if (Number(p.owner_scoped) > 0) return { tag: "MISSING DOOR", why: `${p.owner_scoped} of ${p.policies} policy(ies) scoped to an OWNER — somebody authorised a PERSON to reach this, and nothing calls it` };
  if (p.rls && Number(p.policies) > 0) return { tag: "SERVICE-ONLY, unwritten", why: `${p.policies} policy(ies), none owner-scoped — only the service role may touch it, and it never has` };
  return { tag: "DEAD ROOM", why: `rls=${p.rls}, ${p.policies} policy, 0 rows — built, never authorised, never written` };
};

/* ── DIMENSION 2: EDGE FUNCTIONS ─────────────────────────────────────────────────────────────── */
const fnDir = join(ROOT, "supabase/functions");
const fns = readdirSync(fnDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(fnDir, d.name, "index.ts")))
  .map((d) => d.name);

const out = [];
for (const { t } of tables) {
  const r = refs(t);
  out.push({ kind: "table", name: t, rows: rowsOf[t], added: bornTable(t), refs: r.all, live: r.live, where: r.where, ...doorOf(t, rowsOf[t]) });
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
console.log(`  ${"WHAT".padEnd(40)} ${"ROWS".padStart(7)}  ${"ADDED".padEnd(11)} ${"REFS".padStart(5)} ${"LIVE".padStart(5)}  WHICH IS IT`);
for (const o of dead) {
  console.log(`  ${(o.kind + " " + o.name).padEnd(40)} ${String(o.rows ?? "—").padStart(7)}  ${String(o.added).padEnd(11)} ` +
    `${String(o.refs).padStart(5)} ${String(o.live).padStart(5)}  ${o.tag || "(edge fn — a door, by definition)"}`);
}
const tally = {};
for (const o of dead) if (o.tag) tally[o.tag] = (tally[o.tag] || 0) + 1;
console.log(`\n  BY WHICH IT IS: ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(" · ") || "(no tables)"}`);
console.log(`  MISSING DOOR = authorised for an owner and never called. That is the ask_hubly_conversations`);
console.log(`  shape, and it is a REASON TO KEEP: the fix for one of those is a caller, not a build.`);
for (const o of dead.filter((x) => x.tag && x.tag !== "MISSING DOOR").slice(0, 20))
  console.log(`      ${o.name.padEnd(38)} ${o.tag} — ${o.why}`);
/* ══ THE THIRD CALLER CLASS, MADE VISIBLE — 2026-09-17 ═════════════════════════════════════════
 *
 * The header names a caller this sweep cannot see: an external service posting in. Adrian:
 * *"Find out. A function with recent invocations and zero code references is the opposite of an
 * orphan — it is a door with no map."*
 *
 * There is no invocation log reachable from here (`supabase functions list` gives a DEPLOY time, not
 * a call count). But a function that ran LEFT ROWS, and rows are readable. So each unreferenced
 * function is asked the only question that can be answered: do the tables you write hold anything?
 *
 * It found `page-view` immediately: 223 rows in `page_loads`. That function is fully live and the
 * sweep had it in the dead list, because the public page builds its URL at run time and no grep of
 * ours sees it. Fourth time in this one file that "nothing reaches it" was a fact about the test.
 *
 * WHAT THIS STILL CANNOT DO, said rather than implied: a function that ran and wrote NOTHING — a
 * webhook that rejected a signature, a handler that 400'd — is indistinguishable from one that never
 * ran. `no rows anywhere` is "no evidence of an invocation", never "it has never been invoked". */
const writesOf = (fn) => {
  try {
    const src = readFileSync(join(fnDir, fn, "index.ts"), "utf8");
    return [...new Set([...src.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)].map((m) => m[1]))];
  } catch (_) { return []; }
};
const deadFns = dead.filter((o) => o.kind === "edge fn");
if (deadFns.length) {
  console.log(`\nDID THE UNREFERENCED FUNCTIONS EVER RUN? Asked of the tables they write, because there is`);
  console.log(`no invocation log reachable from here. Rows are evidence of a call; no rows is NOT evidence`);
  console.log(`of no call — a rejected webhook writes nothing and looks identical.`);
  // ONLY AN EXCLUSIVE TABLE IS EVIDENCE. The first version credited `booking-confirmed` and
  // `studio-api` with "EVIDENCE OF A CALL" off `businesses:211` — a table almost every function
  // touches. Rows in a shared table say nothing about WHICH writer put them there. A table whose only
  // writer is this one function does.
  const writerCount = {};
  for (const f of fns) for (const t of writesOf(f)) writerCount[t] = (writerCount[t] || 0) + 1;
  for (const o of deadFns) {
    const tabs = writesOf(o.name).filter((t) => rowsOf[t] !== undefined);
    const exclusive = tabs.filter((t) => writerCount[t] === 1);
    if (!exclusive.length) {
      console.log(`  ${o.name.padEnd(26)} UNANSWERABLE — it writes ${tabs.length} table(s) and none is exclusive ` +
        `to it${tabs.length ? " (" + tabs.map((t) => `${t}:${writerCount[t]} writers`).join(", ") + ")" : ""}, so rows prove nothing about THIS function`);
      continue;
    }
    const withRows = exclusive.filter((t) => Number(rowsOf[t]) > 0);
    console.log(`  ${o.name.padEnd(26)} ${withRows.length ? "EVIDENCE OF A CALL" : "NO evidence of a call"} — exclusive table(s): ` +
      exclusive.map((t) => `${t}:${rowsOf[t]}`).join(" · "));
  }
}

console.log(`\nREACHED BY LIVE CODE (not orphans, listed so the count above has a denominator): ${out.length - dead.length}`);
const thin = out.filter((o) => o.live > 0 && o.live <= 2 && (o.rows === 0 || o.rows === "0"));
if (thin.length) {
  console.log(`\n${thin.length} REACHED BUT EMPTY — a door exists and nothing has ever come through it:`);
  for (const o of thin) console.log(`  ${(o.kind + " " + o.name).padEnd(40)} rows ${String(o.rows).padStart(3)}  live refs ${o.live}  in ${o.where.join(", ")}`);
}
console.log(`\nNOTHING WAS DELETED. Each line is "nobody has restated the purpose of this", which is a`);
console.log(`question for Adrian — ask_hubly_conversations sat here for seven weeks and was not dead.`);
