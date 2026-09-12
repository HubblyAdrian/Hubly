#!/usr/bin/env node
/**
 * `supabase db push` IS BANNED HERE, AND THIS IS WHAT MAKES THAT TRUE.
 *
 * THE INCIDENT, 2026-09-12. `supabase db push --include-all` was run to apply two additive
 * migrations. Because 53 migration files are not recorded in the ledger, push replayed the
 * backlog from 2026-08-23 and died inside `20260823140000_mark_test_accounts.sql` — at
 * statement 6, `set account_kind = 'real'`, a value that stopped existing when the
 * market/test/internal split shipped. The statement immediately before it was:
 *
 *     update public.businesses set account_kind = 'test'
 *       where account_kind <> 'test' and id not in (…9 ids captured 2026-08-23…);
 *
 * One statement earlier and every market and internal business created since August — Graef
 * included — would have been silently relabelled 'test', and every user, adoption and value
 * number computed from that column would have been wrong from that moment on, with nothing
 * to notice it. The file ran in a transaction and rolled back; nothing was changed. That was
 * luck about transaction scope, not a safeguard.
 *
 * The ban had been written in CLAUDE.md and in the standing notes for three weeks. Prose did
 * not stop it. This does (Lesson 42).
 *
 * WHAT IT SCANS: every tracked file that could carry a command — scripts, package manifests,
 * task runners, CI config, docs that are copy-pasted from. A mention inside a PROHIBITION is
 * allowed, because the prohibition has to be able to name the thing it forbids.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMAND = /supabase\s+db\s+push/i;
/** A line that forbids the command is not a line that runs it. */
const FORBIDS = /(never|ban|banned|forbidden|do not|don't|must not|unsafe|prohibit|refuses|instead of|rather than|incident|blocked)/i;
const SCAN_EXT = /\.(mjs|js|ts|json|sh|bash|zsh|yml|yaml|toml|mk|Makefile)$/i;

// ── RED-PROOF, EVERY RUN (Lesson 40) ─────────────────────────────────────────
{
  const RUNS = `  execSync("supabase db push --include-all");`;
  const FORBIDDEN_MENTION = `  // never run: supabase db push — it replays the backlog`;
  const caught = COMMAND.test(RUNS) && !FORBIDS.test(RUNS);
  const allowed = COMMAND.test(FORBIDDEN_MENTION) && FORBIDS.test(FORBIDDEN_MENTION);
  if (!caught || !allowed) {
    console.error("CANNOT RUN — the detector failed its own fixtures:");
    console.error(`  a line that RUNS the command is caught      : ${caught} (expected true)`);
    console.error(`  a line that FORBIDS it is allowed           : ${allowed} (expected true)`);
    process.exit(2);
  }
}

let files;
try {
  files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .split("\n").filter(Boolean).filter((f) => SCAN_EXT.test(f) || /Makefile|justfile|Taskfile/i.test(f));
} catch (e) { console.error("CANNOT RUN — git ls-files failed: " + e.message); process.exit(2); }

const hits = [];
for (const f of files) {
  if (f === "scripts/check-no-db-push.mjs") continue;              // this file names it to forbid it
  let src;
  try { src = readFileSync(join(ROOT, f), "utf8"); } catch { continue; }
  if (!COMMAND.test(src)) continue;
  src.split("\n").forEach((line, i) => {
    if (!COMMAND.test(line)) return;
    if (FORBIDS.test(line)) return;                                 // a prohibition may name it
    hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}

console.log(`files scanned for an executable "supabase db push": ${files.length}  (detector red-proofed this run)`);
if (hits.length) {
  console.error(`\nFAIL — ${hits.length} place(s) that would run it:`);
  for (const h of hits) console.error("  " + h);
  console.error(`
  supabase db push replays every migration the ledger does not know about — 53 files today,
  including one whose backfill would relabel every market business as test. Apply a single
  migration with:  supabase db query --linked -f supabase/migrations/<file>.sql`);
  process.exit(1);
}
console.log("PASS — nothing in the repo runs `supabase db push`.");
process.exit(0);
