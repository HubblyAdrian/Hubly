#!/usr/bin/env node
/**
 * [RULE] json_schema MAY NOT BE TURNED ON UNTIL THE json_object BASELINE EXISTS.
 *
 *   node scripts/check-baseline-before-schema.mjs
 *
 * ══ RULED BY ADRIAN, 2026-09-17 ═════════════════════════════════════════════════════════════
 *
 *   "document_generation_events has zero rows, so there is no 'before.' Flipping now means the change
 *    gets credited with an improvement nobody measured. Build the guard that FAILS if someone flips
 *    json_schema while the baseline table is empty. That guard is the thing worth having."
 *
 * ══ WHY A GUARD AND NOT A NOTE ══════════════════════════════════════════════════════════════
 *
 * The flip is ONE LINE in hubly_ai.ts. It is the kind of change that gets made in thirty seconds by
 * someone who does not know a measurement was waiting on it, and the cost is not a bug — it is the
 * permanent loss of the only chance to know whether it helped. You cannot collect a "before" after
 * the fact. Prose next to the line would not have stopped it; the `db push` ban lived in prose for
 * three weeks and prose did not stop that either (Lesson 42).
 *
 * ══ WHAT IT CHECKS, AND WHAT COUNTS AS A BASELINE ═══════════════════════════════════════════
 *
 *   LEG 1  If no code enables json_schema, this is vacuously satisfied and SAYS SO. It does not
 *          report a green as if it had verified something.
 *   LEG 2  If code DOES enable it, the baseline must be USABLE, not merely non-empty:
 *            · at least MIN_ROWS rows at schema_mode='json_object'
 *            · spanning more than one `tag`, so it is not one page's peculiarity
 *            · with at least one FAILED first attempt recorded — a baseline of nothing but successes
 *              cannot show an improvement in failures, which is the entire claim being made
 *          Those three together are what makes the after-comparison possible. One row is not a
 *          baseline and neither are thirty identical ones.
 *   LEG 3  And the split must be there: `error_kinds` populated on the failures. A strict schema can
 *          only prevent shape/tag/attr; it cannot touch class_token, hollow_section or false_claim.
 *          Without the split the "after" number is unattributable and the comparison is a story.
 *
 * SCOPED: "no code enables json_schema" is measured over supabase/functions/ only, by looking for a
 * response_format of type json_schema being CONSTRUCTED. A json_schema enabled from outside this repo
 * — a dashboard setting, a provider-side default — is invisible here and is stated rather than
 * implied.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_ROWS = 30;
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* ── IS json_schema ENABLED ANYWHERE? Constructed, never merely mentioned — this file mentions it
      a dozen times and so does the doc that explains the decision. ──────────────────────────── */
const files = [];
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
  if (f.name === "node_modules" || f.name.startsWith(".")) continue;
  const p = join(d, f.name);
  if (f.isDirectory()) walk(p); else if (/\.ts$/.test(f.name)) files.push(p);
} };
walk(join(ROOT, "supabase/functions"));
const ENABLES = /response_format\s*[=:]\s*\{[^}]*type\s*:\s*["'`]json_schema["'`]|type\s*:\s*["'`]json_schema["'`]\s*,\s*json_schema/;
const enablers = [];
for (const p of files) {
  const src = readFileSync(p, "utf8");
  src.split("\n").forEach((L, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) return;                 // a comment is not an enabler
    if (ENABLES.test(L)) enablers.push(`${p.slice(ROOT.length + 1)}:${i + 1}`);
  });
}

/* ── THE BASELINE, read live. ─────────────────────────────────────────────────────────────── */
let stats;
try {
  stats = execFileSync("supabase", ["db", "query", "--linked",
    `select coalesce(schema_mode,'(null)') as mode, count(*) as n,
            count(distinct tag) as tags,
            sum((not first_attempt_ok)::int) as failures,
            sum((array_length(error_kinds,1) is not null)::int) as with_kinds
       from public.document_generation_events group by 1 order by 2 desc`],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const i = stats.indexOf('"rows"'); let d = 0, s = stats.indexOf("[", i), e = -1;
  for (let k = s; k < stats.length; k++) { if (stats[k] === "[") d++; else if (stats[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  stats = JSON.parse(stats.slice(s, e));
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const row = stats.find((r) => r.mode === "json_object") || { n: 0, tags: 0, failures: 0, with_kinds: 0 };
const n = Number(row.n), tags = Number(row.tags), failures = Number(row.failures), withKinds = Number(row.with_kinds);
const all = stats.map((r) => `${r.mode} ${r.n}`).join(" · ") || "(table empty)";

console.log(`document_generation_events by schema_mode: ${all}`);
console.log(`json_schema constructed in ${enablers.length} place(s)${enablers.length ? ": " + enablers.join(", ") : ""}\n`);

leg("RULE", "json_schema is not enabled while the baseline is unusable",
  enablers.length === 0 || (n >= MIN_ROWS && tags > 1 && failures > 0),
  enablers.length === 0
    ? `NOTHING enables json_schema today, so this leg is VACUOUSLY satisfied and says so rather than ` +
      `reporting a green it did not earn. It becomes a real assertion the moment one line in ` +
      `hubly_ai.ts changes — which is the only moment it needs to.`
    : `json_schema IS enabled (${enablers.join(", ")}) and the json_object baseline has ${n} row(s) ` +
      `across ${tags} tag(s) with ${failures} recorded first-attempt failure(s). Needed: >= ${MIN_ROWS} ` +
      `rows, > 1 tag, > 0 failures. You cannot collect a "before" after the fact.`);

leg("SHAPE", "the baseline is being collected at all",
  n > 0,
  n > 0 ? `${n} json_object row(s) across ${tags} tag(s) · ${failures} first-attempt failure(s)`
        : `ZERO json_object rows. recordAttempt is wired (hubly_capability_registry) but no document ` +
          `has been generated since the table was created on 2026-09-17, so the baseline does not ` +
          `exist yet. This is a [SHAPE] leg: it goes green when the first page is built, and it is ` +
          `red now because the measurement has not started — not because anything is broken.`);

leg("RULE", "every recorded failure carries its error kinds, or the comparison is unattributable",
  failures === 0 || withKinds >= failures,
  failures === 0 ? `no failures recorded yet, so there is nothing to attribute — vacuous and said so`
    : `${withKinds} of ${failures} failure(s) carry error_kinds. A strict schema can only prevent ` +
      `shape/tag/attr and cannot touch class_token, hollow_section or false_claim; without the split ` +
      `an improvement cannot be attributed to the schema rather than to anything else that changed.`);

// CODE LINES ONLY. The first version of this leg searched the whole file and matched the COMMENT that
// explains the literal was removed — so it reported the fix as the defect. Third time in one sitting
// that a matcher found prose ABOUT the thing instead of the thing, and the reason
// confirm-served.mjs refuses a bare-identifier absence marker at all.
const regSrc = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8")
  .split("\n").filter((L) => !/^\s*(\/\/|\*|\/\*)/.test(L)).join("\n");
leg("SHAPE", "schema_mode is read from the call, not written as a literal",
  !/schema_mode:\s*["'`]json_object["'`]/.test(regSrc),
  `It WAS the literal "json_object" under a comment claiming it was recorded — so flipping the flag ` +
  `would have left every row saying json_object and made the whole comparison silently wrong. It now ` +
  `comes from HublyAIResult.schemaMode, which is read off the request body that was actually sent.`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
