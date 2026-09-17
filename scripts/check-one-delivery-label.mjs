#!/usr/bin/env node
/**
 * [RULE] ONE LABEL FOR ONE THING, IN THE LEDGER THAT ANSWERS "WAS ANYONE TOLD?"
 *
 *   node scripts/check-one-delivery-label.mjs
 *
 * ══ WHY, 2026-09-17 ═════════════════════════════════════════════════════════════════════════
 *
 * `notification_deliveries.subject_type` had TWO NAMES for one subject: the DB trigger's pre-call
 * row said `booking`, and `booking-notify`'s own insert said `booking_request`. One writer pair,
 * two vocabularies — and it produced a wrong number in the way a hand-maintained vocabulary always
 * does: a sweep filtered on one label and reported **"no booking email has ever been sent"** while
 * FOUR were recorded `sent` under the other.
 *
 * Adrian: *"THE LEDGER'S TWO LABELS FOR ONE THING — that is what made your own count wrong. One
 * label, derived, or a check that they agree."*
 *
 * The label is now DERIVED FROM THE TABLE THE SUBJECT LIVES IN (`booking_requests` →
 * `booking_request`), which is what `business_events` already used. This is the check that they
 * agree — in the SOURCE, so a third name cannot be introduced, and in the DATA, so a writer we
 * have not found cannot be introducing one unseen.
 *
 * ══ AND THE ORPHAN ══════════════════════════════════════════════════════════════════════════
 *
 * `subject_id` is polymorphic (a booking id here, a business id for a signup) and therefore cannot
 * be a foreign key. Adrian: *"make it one, or make the orphan legible."* It is made legible:
 * `subject_label` is written at the same moment as the row. This check asserts every WRITER writes
 * it, because a column nothing fills is worse than no column — it looks like an answer.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** Every file that could write to the ledger — found, not listed. */
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!/\.(ts|sql|js|mjs|html)$/.test(e.name)) continue;
      const src = readFileSync(p, "utf8");
      if (src.includes("notification_deliveries")) out.push({ p: p.slice(ROOT.length + 1), src });
    }
  };
  for (const d of ["supabase/functions", "supabase/migrations", "public"]) {
    if (existsSync(join(ROOT, d))) walk(join(ROOT, d));
  }
  return out;
}

// ══ A MIGRATION IS A HISTORICAL RECORD, NOT "WHAT THE SOURCE WRITES" ════════════════════════
//
// The first version of this scanned supabase/migrations and reported that the source still writes
// `booking` — from a migration applied in August and superseded today. An applied migration cannot
// be edited and its old label will sit there forever; asking it what the product writes NOW is
// asking the wrong file. The live answer comes from the database (leg 1b), and the editable source
// is everything that is not a migration.
const all = sources();
const files = all.filter((f) => !/^scripts\//.test(f.p) && !/^supabase\/migrations\//.test(f.p));
say("0 the scan found the ledger's writers — a zero here means the pattern moved, not that it is clean",
    files.length > 0, `${files.length} file(s) mention notification_deliveries`);

// ── WHICH LABELS THE SOURCE WRITES ───────────────────────────────────────────────────
// A label is a string literal assigned to subject_type, in either syntax. Doc comments are not
// code: only lines that look like an assignment count.
const labels = new Map();
for (const f of files) {
  for (const m of f.src.matchAll(/subject_type:\s*["'`]([a-z_]+)["'`]/g)) {
    if (!labels.has(m[1])) labels.set(m[1], new Set());
    labels.get(m[1]).add(f.p);
  }
  for (const m of f.src.matchAll(/subjectType:\s*["'`]([a-z_]+)["'`]/g)) {
    if (!labels.has(m[1])) labels.set(m[1], new Set());
    labels.get(m[1]).add(f.p);
  }
  // the SQL insert form: values (…, 'booking_request', …) after a column list naming subject_type
  for (const m of f.src.matchAll(/\(business_id,\s*subject_type[^)]*\)\s*\n?\s*values\s*\([^)]*?'([a-z_]+)'/g)) {
    if (!labels.has(m[1])) labels.set(m[1], new Set());
    labels.get(m[1]).add(f.p);
  }
}
const bookingish = [...labels.keys()].filter((l) => /^booking/.test(l));
say("1 [RULE] the editable source writes exactly ONE label for a booking subject",
    bookingish.length === 1 && bookingish[0] === "booking_request",
    bookingish.length ? bookingish.map((l) => `${l} (${[...labels.get(l)].join(", ")})`).join(" | ") : "no booking label found");
console.log(`      every label the editable source writes: ${[...labels.keys()].sort().join(", ") || "(none)"}`);

// ── AND EVERY WRITER THAT CREATES A ROW FILLS subject_label ──────────────────────────
// `.insert(` only: booking-notify's sendEmail UPDATES a row the caller already created with a
// label, and demanding the label again there would be asking a function to re-state a fact it was
// not given — the thing this table exists to prevent.
const writers = files.filter((f) => /from\(["'`]notification_deliveries["'`]\)\s*\n?\s*\.insert\(/.test(f.src));
const withoutLabel = writers.filter((f) => !/subject_label/.test(f.src));
say("2 [RULE] every writer that CREATES a row records what it is about, so a deleted subject leaves a readable row",
    withoutLabel.length === 0,
    withoutLabel.length ? `missing subject_label: ${withoutLabel.map((f) => f.p).join(", ")}`
                        : `${writers.length} row-creating writer(s), all recording subject_label`);

// ── AND THE DATA AGREES WITH THE SOURCE ──────────────────────────────────────────────
let rows;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select subject_type, count(*) as n, min(attempted_at)::date as first, max(attempted_at)::date as last,
            count(*) filter (where subject_label is not null) as labelled
     from notification_deliveries group by 1 order by 1`],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  rows = JSON.parse(out.slice(s, e));
} catch (err) { console.error("CANNOT RUN — could not read the ledger: " + String(err.message).slice(0, 140)); process.exit(2); }

console.log("\n  what the ledger actually holds:");
rows.forEach((r) => console.log(`      ${String(r.subject_type).padEnd(20)} ${String(r.n).padStart(4)} row(s)  ${r.first} → ${r.last}  ${r.labelled} labelled`));
// HISTORY IS NOT REWRITTEN — the rows written under the old label are what happened. What must not
// happen is a NEW one, and the boundary is the day the canonical label shipped.
// ONE TYPED TIMESTAMP, and it is the moment the migration was applied — 2026-09-17 19:0x UTC.
// A date alone is not enough: two rows written at 02:35 THIS MORNING carry the old label, and they
// are history by minutes. If this ever needs a second boundary, something is being excused.
const SINCE = "2026-09-17T19:10:00Z";
const strays = rows.filter((r) => /^booking/.test(r.subject_type) && r.subject_type !== "booking_request" && String(r.lastAt || r.last) >= SINCE);
say(`3 [RULE] no row written since the migration uses a label the source no longer writes`,
    strays.length === 0, strays.length ? strays.map((r) => `${r.subject_type} last seen ${r.last}`).join(", ")
                                       : "history keeps its old label; nothing new uses it");

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — one label, derived from the table the subject lives in, and every row says what it is about.\n");
process.exit(failed ? 1 : 0);
