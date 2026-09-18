#!/usr/bin/env node
/**
 * [RULE] AN ANON-READABLE READER MAY NOT RETURN A THIRD PARTY'S CONTACT DETAILS.
 *
 *   node scripts/check-no-public-reader-leaks-contacts.mjs
 *
 * ══ STATE WHAT WOULD MAKE THIS WRONG, BEFORE THE NUMBER ═════════════════════════════════════
 *
 * This check reports that a public reader exposes people's names, phone numbers and email addresses.
 * That is the kind of finding that gets acted on immediately, so the things that would make it wrong
 * come first:
 *
 *  1. IT HOLDS ONLY IF `anon` CAN ACTUALLY INVOKE THE FUNCTION. That is read from
 *     `has_function_privilege('anon', oid, 'EXECUTE')` and from the function body, which is
 *     conclusive about what the function RETURNS. **It is NOT an executed anon request**: making one
 *     needs the anon key, and a key may never reach a command line. So the last link — an actual
 *     unauthenticated HTTP call returning those bytes — is UNVERIFIED here and is Adrian's to close.
 *  2. IT HOLDS ONLY FOR A CLAIMED BUSINESS. `get_public_business` requires `owner_id is not null`, so
 *     an unclaimed draft returns nothing whatever its meta holds.
 *  3. THE RECORDS MUST BE REAL PEOPLE. A row is not evidence of a person. This check counts records
 *     and says which business they belong to; whether each is a customer, a family member or a test
 *     entry is not something it can determine, and it does not claim to.
 *  4. SOME OF `meta` IS MEANT TO BE PUBLIC — the classic page renders from it. The finding is about
 *     ONE SUBTREE inside a column that is otherwise legitimately served.
 *
 * ══ WHAT IT CHECKS ══════════════════════════════════════════════════════════════════════════
 *
 * `get_public_business` is `select to_jsonb(b) - 'draft_token' from businesses b` — the WHOLE ROW,
 * EXECUTE granted to anon. Anything anyone ever puts in any column of `businesses` is therefore
 * public, including columns added later for something else entirely. `meta.pipeline.manual` is a lead
 * list, and it is inside that row.
 *
 * A CONTACT RECORD COLLECTION IS DETECTED BY SHAPE, never by key name: an array of objects each
 * carrying a name plus a phone or an email. A key-name list would be a hand-maintained set and would
 * miss the next one, which is how this went unnoticed in the first place.
 *
 * NO VALUE IS EVER PRINTED. Counts, paths and slugs only — a check that leaks the details it is
 * complaining about has made the problem worse, and a transcript is a place data goes to stay.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { declareBreak, ROOT } from "./lib/redproof.mjs";

const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* ── WHICH READERS ARE PUBLIC, AND WHICH RETURN A WHOLE ROW ─────────────────────────────────── */
let fns;
try {
  fns = q(`select p.proname,
                  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
                  pg_get_functiondef(p.oid) as def
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'get\\_public%'`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const anonReaders = fns.filter((f) => f.anon_exec);
const wholeRow = anonReaders.filter((f) => /to_jsonb\s*\(\s*[a-z_]+\s*\)/i.test(String(f.def)));
console.log(`${fns.length} get_public_* reader(s) · ${anonReaders.length} EXECUTE-granted to anon · ` +
  `${wholeRow.length} return a WHOLE ROW\n`);

declareBreak({
  leg: "no anon-readable reader returns a collection of contact records",
  why: "plant a contact-record collection into a TEST business's meta and confirm this leg alone goes red",
  sql: "update public.businesses set meta = jsonb_set(meta, '{pipeline,manual}', " +
       "'[{\"name\":\"Plant\",\"phone\":\"801-555-0000\",\"email\":\"plant@test.invalid\"}]'::jsonb) " +
       "where slug = 'hubly-classic-fixture';",
  restore: "restore hubly-classic-fixture's meta from the bytes read before the write",
  provenBy: "NOT NEEDED YET — this leg is RED ON REAL DATA as of 2026-09-18 (graefs-autocare, 3 " +
            "records; adrians-lawn-service, 2). A leg observed failing for the reason it claims to " +
            "catch is red-proofed by observation. The planted break above becomes the proof once the " +
            "exposure is closed and the leg turns green.",
});

/* ── THE DATA, BY SHAPE, WITHOUT PRINTING ANY OF IT ─────────────────────────────────────────── */
const isContactRecords = (v) =>
  Array.isArray(v) && v.length > 0 &&
  v.every((e) => e && typeof e === "object" && !Array.isArray(e) &&
    typeof e.name === "string" && (typeof e.phone === "string" || typeof e.email === "string"));

/* ══ AND THE FIRST VERSION OF THIS CHECK PASSED WITH ZERO FINDINGS — L98, HERE, IN THIS FILE ═════
 *
 * It filtered candidate columns by `data_type in ('jsonb','json')`. **`businesses.meta` is a TEXT
 * column.** So it selected no columns, examined no rows, and reported "0 contact-record collections
 * reachable" — while its own detail line said "1 whole-row anon reader(s) examined", which was true
 * and measured the wrong thing. The positive clause I had written counted READERS, not DATA.
 *
 * It was caught because I already knew the answer: graefs-autocare has three such records, the check
 * said none, and the check was wrong. That is the whole method — use the output, do not re-read the
 * code — and it happened in the file written to demonstrate the lesson about exactly this.
 *
 * Fixed twice over: candidate columns are any text-ish column whose value PARSES AS JSON (content,
 * not declared type — Lesson 86), and the leg now requires rows and columns to have been examined. */
let colsExamined = 0, rowsExamined = 0;
const findings = [];
for (const f of wholeRow) {
  const tables = [...new Set([...String(f.def).matchAll(/from\s+public\.([a-z_]+)/gi)].map((m) => m[1]))];
  const claimedOnly = /owner_id\s+is\s+not\s+null/i.test(String(f.def));
  for (const t of tables) {
    let cols, rows;
    try {
      // TEXT-ISH, NOT "DECLARED JSONB". `businesses.meta` is TEXT and holds JSON; gating on the
      // declared type read it as "no candidate columns" and made this leg vacuous.
      cols = q(`select column_name from information_schema.columns
                 where table_schema='public' and table_name='${t}'
                   and data_type in ('jsonb','json','text','character varying')`)
        .map((c) => c.column_name);
      if (!cols.length) continue;
      rows = q(`select slug, account_kind, (owner_id is not null) as claimed, ` +
               cols.map((c) => `"${c}"::text as col_${c}`).join(", ") +
               ` from public.${t}`);
    } catch (_) { continue; }
    for (const r of rows) {
      if (claimedOnly && !r.claimed) continue;                 // this reader would return nothing
      rowsExamined++;
      for (const c of cols) {
        let o; try { o = JSON.parse(r["col_" + c] || "null"); } catch (_) { continue; }
        if (!o || typeof o !== "object") continue;             // not a JSON document, nothing to walk
        colsExamined++;
        const walk = (v, path) => {
          if (isContactRecords(v)) {
            findings.push({ fn: f.proname, table: t, col: c, path, slug: r.slug,
                            kind: r.account_kind, n: v.length,
                            fields: [...new Set(v.flatMap((e) => Object.keys(e)))].sort() });
            return;
          }
          if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
          else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
        };
        walk(o, `${c}`);
      }
    }
  }
}

leg("RULE", "no anon-readable reader returns a collection of contact records",
  wholeRow.length > 0 && rowsExamined > 0 && colsExamined > 0 && findings.length === 0,
  `${wholeRow.length} whole-row anon reader(s) · ${rowsExamined} row(s) and ${colsExamined} JSON ` +
  `document(s) actually READ — counting readers was not enough: the first version of this leg counted ` +
  `them, read no data at all, and passed — and ${findings.length} contact-record collection(s) ` +
  `reachable through them` +
  (findings.length ? ":\n" + findings.map((x) =>
    `          ${x.fn}() -> ${x.table}.${x.path}  ·  ${x.slug} [${x.kind}]  ·  ${x.n} record(s) ` +
    `carrying ${x.fields.join(", ")}`).join("\n") : ""));

leg("SHAPE", "the whole-row readers are named, so the blast radius is knowable",
  wholeRow.length > 0,
  `${wholeRow.map((f) => f.proname).join(", ") || "(none)"} return every column of their table, which ` +
  `means a column added later for something else is public the moment it exists. That is the shape ` +
  `of the problem, not a defect in any one column.`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
if (bad.length) {
  console.log(`\nNO VALUES WERE PRINTED. Counts, paths and field NAMES only.`);
  console.log(`UNVERIFIED, AND IT IS ADRIAN'S TO CLOSE: an actual unauthenticated HTTP call. This is`);
  console.log(`established from the EXECUTE grant and the function body, not from a request made with`);
  console.log(`an anon key — a key may never reach a command line.`);
}
process.exit(bad.length ? 1 : 0);
