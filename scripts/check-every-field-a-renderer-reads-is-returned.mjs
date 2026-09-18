#!/usr/bin/env node
/**
 * [RULE] EVERY FIELD A RENDERER READS OFF THE PUBLIC BUSINESS ROW IS A FIELD THE READER RETURNS.
 *
 *   node scripts/check-every-field-a-renderer-reads-is-returned.mjs
 *
 * ══ THE REGRESSION THIS EXISTS FOR, AND WHY LUCK FOUND IT THE FIRST TIME ═════════════════════
 *
 * get_public_business used to be `select to_jsonb(b) - 'draft_token'` — every column of the table,
 * including email and phone, to anonymous callers. Replacing it with an explicit allowlist is the
 * right fix and it has now shipped THREE regressions, each invisible:
 *
 *   · seven fields dropped (ig_handle, fb_url, tiktok_handle, google_url, section_order,
 *     account_kind, and the social links, section order and test-page noindex went with them).
 *     Found because Adrian asked an unrelated question about a neighbouring line.
 *   · owner_id dropped, which turned `if(!data.owner_id || …) hcNoIndex()` from a test into a
 *     CONSTANT, and every public Hubly page served robots="noindex, nofollow" — measured on two
 *     live claimed market businesses. Found by the first run of THIS file.
 *   · and a fourth was nearly shipped by the fix for the second: a retyped meta subtree list, 72
 *     entries instead of 55.
 *
 * NOTHING ERRORS for any of them. `undefined === 'test'` is false, `data.ig_handle || ''` is '',
 * `!undefined` is true, a missing section_order skips a call. This is the route-list failure mode:
 * a list decides what is served, the list is hand-maintained, and its failure is silent-undefined.
 *
 * ══ WHY THE CHECK IS A DERIVATION AND NOT A LIST ════════════════════════════════════════════
 *
 * A check holding its own list of expected fields would need updating by the same hand that drops
 * one, at the same moment, and would have passed through all three. So it DERIVES both halves:
 * the reads by parsing both shells (scripts/lib/public-row-fields.mjs — a real parse with real
 * scopes, after four cheaper versions each failed differently), and the returned set by parsing
 * the shipping migration.
 *
 * ══ THE CHAIN, WHICH IS WHAT MAKES LEG 1 MEAN ANYTHING ══════════════════════════════════════
 *
 *   leg 2   the derivation is ALIVE — it found the call in both shells and can still see across
 *           script blocks. Without this, "no fields missing" is indistinguishable from "I looked
 *           for nothing", which is the failure every other lesson in this repo is about.
 *   leg 4   and it has no blind spot on this input: nothing is read by a computed key.
 *   leg 1   every field read is declared by the migration.
 *   leg 3   every key the migration declares is really present in the LIVE function, so leg 1 is
 *           a claim about production and not about the repository (Lesson 100).
 *
 * SCOPED, and these are not small:
 *   · TOP-LEVEL fields only. meta's 55 subtrees are a second derivation and are NOT attempted
 *     here — an unattempted half is honest; a half-attempted one is not.
 *   · the two client shells only. Edge functions and get_draft_business are not covered.
 *   · it cannot see a field read after the row crosses postMessage, JSON round-tripping, or a
 *     template string.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readShell, allowlistFromMigration } from "./lib/public-row-fields.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELLS = ["public/platform-home.html", "public/hubly.html"];
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* THE SHIPPING MIGRATION IS THE LATEST ONE THAT DEFINES THE FUNCTION — found on disk, never named
   in this file. A hard-coded filename is the same hand-maintained set one level up. */
const MIGDIR = join(ROOT, "supabase", "migrations");
const defining = readdirSync(MIGDIR).filter((f) => /\.sql$/.test(f))
  .filter((f) => /create or replace function public\.get_public_business\s*\(/.test(readFileSync(join(MIGDIR, f), "utf8")))
  .sort();
if (!defining.length) { console.error("CANNOT RUN — no migration defines get_public_business"); process.exit(2); }
const SHIPPING = defining[defining.length - 1];
const allow = allowlistFromMigration(readFileSync(join(MIGDIR, SHIPPING), "utf8"));
// The break declarations below name this file as a LITERAL (the ledger parses them statically). If a
// newer migration redefines the function, those breaks would edit a file this check no longer reads
// and register as NOT RED rather than as a mistake — so say it out loud here.
const DECLARED_IN_BREAKS = "20260918160000_public_business_is_claimed.sql";
if (SHIPPING !== DECLARED_IN_BREAKS) {
  console.log("  NOTE: the red-proof breaks in this file name " + DECLARED_IN_BREAKS + ", but the");
  console.log("        shipping migration is now " + SHIPPING + ". Update the two break declarations'");
  console.log("        file/find values — as written they would edit a file this check no longer reads.");
}
console.log(`  reader declared by: supabase/migrations/${SHIPPING}  (latest of ${defining.length} that define it)`);
console.log(`  it declares ${allow.cols.size} top-level key(s)\n`);

const per = SHELLS.map((f) => ({ f, ...readShell(join(ROOT, f)) }));
for (const p of per)
  console.log(`  ${p.f.padEnd(28)} seed(s) ${p.seeds} · row bindings ${String(p.sinks).padStart(2)} ` +
    `[${p.bindings.join(", ")}] · fields read ${String(p.fields.size).padStart(2)} · computed-key reads ${p.computed}`);

/* The union, with every read site, so a finding names where it is read. */
const union = new Map();
for (const p of per) for (const [k, v] of p.fields) {
  if (!union.has(k)) union.set(k, { reads: 0, exempt: 0, where: [] });
  const u = union.get(k);
  u.reads += v.reads.length; u.exempt += v.exempt;
  u.where.push(`${p.f.split("/").pop()}:${v.reads.map((r) => r.line).join(",")}`);
}
const unreturned = [...union].filter(([k]) => !allow.cols.has(k));
const findings = unreturned.filter(([, v]) => v.exempt < v.reads);
console.log(`\n  union of fields read: ${union.size} · declared by the reader: ${union.size - unreturned.length} · ` +
  `not declared: ${unreturned.length} (${unreturned.map(([k, v]) => `${k} ${v.exempt}/${v.reads} marked PUBLIC-READER-OPTIONAL`).join("; ") || "none"})\n`);

/* ── LEG 1 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 every field a renderer reads is declared by the reader",
  why: "drop ig_handle from the allowlist — one of the seven that actually shipped this way. No " +
       "error, no log, no visible difference: the Instagram link on every public page just stops " +
       "rendering, because `data.ig_handle || ''` is ''.",
  // A LITERAL, because the ledger parses this declaration statically and cannot evaluate a
  // template. The CHECK still derives the shipping migration from disk; the two agreeing is
  // asserted below, so a new migration silently makes this break miss instead of lying.
  file: "supabase/migrations/20260918160000_public_business_is_claimed.sql",
  find: "           'ig_handle', b.ig_handle,\n",
  with: "",
});
leg("RULE", "1 every field a renderer reads is declared by the reader",
  findings.length === 0,
  findings.length
    ? `NOT RETURNED and not marked at every read site: ` +
      findings.map(([k, v]) => `${k} (${v.reads} site(s), ${v.exempt} marked — ${v.where.join(" ")})`).join("; ")
    : `all ${union.size} field(s) read across both shells are declared, counting ` +
      `${unreturned.length} deliberately undeclared one(s) whose every read site carries a ` +
      `PUBLIC-READER-OPTIONAL marker naming that exact field. The exemption lives at the read ` +
      `site, not in a list here, so deleting the last such read removes the exemption with it.`);

/* ── LEG 2 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 the derivation is alive and still sees across script blocks",
  why: "give each <script> block its own root scope again — the bug this analyzer shipped with. " +
       "`var currentBusiness` is in one block and `currentBusiness = data` is ~4500 lines later in " +
       "another, so the assignment resolved to nothing, the row stopped escaping the loading " +
       "function, and the analyzer reported a smaller field set WITHOUT SAYING IT HAD FAILED. " +
       "Leg 1 would then pass by looking for less.",
  file: "scripts/lib/public-row-fields.mjs",
  find: "  const root = shared || mk(ast, null);\n  if (shared) scopes.set(ast, shared);",
  with: "  const root = mk(ast, null);",
});
const alive = per.every((p) => p.seeds >= 1 && p.sinks >= 1) &&
  per.some((p) => p.bindings.includes("currentBusiness")) &&
  per.every((p) => p.unresolved === 0);
leg("RULE", "2 the derivation is alive and still sees across script blocks",
  alive,
  `both shells: seed found (${per.map((p) => p.seeds).join(", ")}) and at least one row binding ` +
  `(${per.map((p) => p.sinks).join(", ")}); \`currentBusiness\` is among them, which is the ` +
  `CROSS-BLOCK escape and the thing a per-block scope cannot see; and ${per.reduce((a, p) => a + p.unresolved, 0)} ` +
  `identifier(s) failed to resolve — an unresolved name is a silence, so it is counted, not ignored.`);

/* ── LEG 3 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 every key the migration declares is present in the LIVE function",
  why: "declare a key in the migration that production does not have. The repository is a CLAIM " +
       "about production, not production (Lesson 100) — leg 1 reads the migration, so if the " +
       "migration and the live function disagree, leg 1's pass is about a file.",
  // A LITERAL, because the ledger parses this declaration statically and cannot evaluate a
  // template. The CHECK still derives the shipping migration from disk; the two agreeing is
  // asserted below, so a new migration silently makes this break miss instead of lying.
  file: "supabase/migrations/20260918160000_public_business_is_claimed.sql",
  find: "         || jsonb_build_object('is_claimed', true)",
  with: "         || jsonb_build_object('is_claimed', true)\n         || jsonb_build_object('zz_declared_but_not_live', true)",
});
let live = null, liveErr = null;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    "select string_agg(k, ',' order by k) as keys from jsonb_object_keys(public.get_public_business(" +
    "(select slug from businesses where owner_id is not null order by created_at limit 1))) as k"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 });
  const m = out.match(/"keys":\s*"([^"]*)"/);
  if (m) live = new Set(m[1].split(",").filter(Boolean));
} catch (e) { liveErr = e.message.split("\n")[0]; }
if (!live) {
  leg("RULE", "3 every key the migration declares is present in the LIVE function", false,
    `COULD NOT READ THE LIVE FUNCTION (${liveErr || "no keys came back"}). Reported as a FAILURE, not ` +
    `skipped: this leg is the only thing making leg 1 a statement about production, so not being ` +
    `able to run it is not the same as it passing.`);
} else {
  const absent = [...allow.cols].filter((k) => !live.has(k)).sort();
  leg("RULE", "3 every key the migration declares is present in the LIVE function",
    absent.length === 0,
    absent.length ? `declared by the migration but ABSENT from the live function: ${absent.join(" ")}`
      : `all ${allow.cols.size} declared key(s) came back from the live function (which returned ` +
        `${live.size}). SCOPED to one direction — migration ⊆ live: production holding MORE than the ` +
        `repo declares is check-live-functions-match-their-migrations.mjs's claim, not this one, and ` +
        `asserting both here would make leg 1's break fire this leg too and prove neither.`);
}

/* ── LEG 4 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "4 no field is reached by a computed key, so the derivation is complete on this input",
  why: "count the `row[0]` unwrap as a computed field read again. It makes the derivation report a " +
       "blind spot it does not have — and the point of the leg is that a blind spot must be LOUD, " +
       "so it has to be observable when it is there.",
  file: "scripts/lib/public-row-fields.mjs",
  find: '      else if (n.property.type === "Literal" && typeof n.property.value === "number") return;  // row[0] is the unwrap, not a field',
  with: "",
});
const blind = per.reduce((a, p) => a + p.computed, 0);
leg("RULE", "4 no field is reached by a computed key, so the derivation is complete on this input",
  blind === 0,
  blind === 0
    ? `0 computed-key reads on the row across both shells, so "every field read" is the whole set ` +
      `and not "every field read in a way I can see". A write target (\`currentBusiness[field] = ` +
      `value\`, the editor) is not a read and is excluded; \`row[0]\` is the unwrap, not a field.`
    : `${blind} read(s) of the row by a computed key — the field list is INCOMPLETE and leg 1's ` +
      `pass cannot be taken as "nothing is missing".`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
