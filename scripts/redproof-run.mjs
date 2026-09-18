#!/usr/bin/env node
/**
 * APPLY EVERY DECLARED BREAK, ONE AT A TIME, AND RECORD WHAT WENT RED.
 *
 *   node scripts/redproof-run.mjs                       # every check that declares a break
 *   node scripts/redproof-run.mjs check-foo.mjs …       # just these
 *   node scripts/redproof-run.mjs --allow-db            # also run breaks that write to the database
 *   node scripts/redproof-run.mjs --dry                 # list what would be applied, touch nothing
 *
 * This is the runner half of the red-proof ledger. `scripts/lib/redproof.mjs` carries the argument
 * for why it exists; the short version is that a break performed in a terminal leaves no evidence,
 * so *"has this leg ever been shown red alone"* was a question with a memory rather than an answer.
 *
 * ══ THE PROCEDURE, AND EVERY STEP OF IT IS THERE BECAUSE OF A FAILURE THIS REPO HAS HAD ══════
 *
 *   1. RUN THE CHECK UNBROKEN FIRST and record which legs are already failing. A check may be
 *      legitimately red (an open finding), and without this baseline every break would be credited
 *      with legs it never moved.
 *   2. SAVE THE FILE'S BYTES, apply ONE break, run, restore, verify the restore. One at a time,
 *      because a break that turns six legs red proves nothing about any one of them (L98).
 *   3. ASSERT THE BREAK ACTUALLY APPLIED. A `find` string that is not present is recorded as
 *      SKIPPED, never as a pass — "a break that never applied tested nothing", and a run that
 *      silently applies nothing and reports green is the exact shape of every false green here.
 *   4. SUBTRACT THE BASELINE. Newly-red legs = broken failures − unbroken failures.
 *   5. EXACTLY ONE newly-red leg, and it must be the declared one -> RED ALONE. More than one ->
 *      COMPOUND, which is recorded as proving nothing. Zero -> NOT RED, which means the leg is
 *      vacuous or the break misses it, and either way it is a finding.
 *   6. RESTORE IS A POSTCONDITION, not a hope. The bytes are compared after; a failed restore aborts
 *      the whole run loudly rather than continuing to break more files.
 *
 * Exit: 0 every declared break produced RED ALONE · 1 any COMPOUND / NOT RED / SKIPPED · 2 cannot run.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join, basename } from "node:path";
import { ROOT, parseBreaks, failedLines, readLedger, writeLedger } from "./lib/redproof.mjs";

const args = process.argv.slice(2);
const ALLOW_DB = args.includes("--allow-db");
const DRY = args.includes("--dry");
const only = args.filter((a) => !a.startsWith("--"));

const SCRIPTS = join(ROOT, "scripts");
// ══ A NAMED FILE THAT DOES NOT RESOLVE IS AN ERROR, NOT AN EMPTY RUN ═══════════════════════
//
// This took a `scripts/check-foo.mjs` argument, joined `scripts/` onto it AGAIN, found nothing at
// `scripts/scripts/check-foo.mjs`, dropped it, and printed "0 break(s) applied · 0 RED ALONE" —
// with exit 0. Which is a green report meaning "I red-proofed nothing", produced by the very tool
// whose job is to catch instruments that find nothing and present it as an answer. A bare name is
// still accepted; a path is now normalised, and anything that still does not exist STOPS the run.
const names = (only.length ? only : readdirSync(SCRIPTS).filter((f) => /^(check|audit)-.*\.mjs$/.test(f)))
  .map((f) => basename(f));
const gone = names.filter((f) => !existsSync(join(SCRIPTS, f)));
if (gone.length) {
  console.error("NOTHING RED-PROOFED — no such check in scripts/: " + gone.join(", "));
  process.exit(2);
}
const files = names;

const run = (f) => {
  try {
    return { out: execFileSync("node", [join(SCRIPTS, f)], { encoding: "utf8", cwd: ROOT,
      maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }), code: 0 };
  } catch (e) { return { out: String(e.stdout || "") + String(e.stderr || ""), code: e.status ?? 1 }; }
};

/* ══ ONE RUNNER AT A TIME, OR THE TREE IS CORRUPTED ══════════════════════════════════════════════
 *
 * THIS HAPPENED, 2026-09-18. Two full passes were launched in the background minutes apart. They
 * overlapped: pass A wrote a break into platform-home.html, pass B read that file as its "before",
 * pass A restored, and pass B then restored ITS stale copy — leaving TWO breaks in the working tree,
 * including a deleted `quotes` room and a reverted identity fix. Nothing warned. It was found only
 * because two later breaks came back `find matched 0 times`, which is the runner reporting that the
 * file no longer says what the check says it says.
 *
 * A tool whose whole method is "edit a file, measure, put it back" cannot be safe to run twice at
 * once, and the honest fix is a lock rather than a convention. The lock carries the pid and the start
 * time so a stale one from a killed run can be identified rather than guessed at.
 *
 * It does NOT protect against an editor saving the file mid-run — nothing here can. What it does is
 * make the one collision that actually happened impossible. */
const LOCK = join(ROOT, "docs", ".redproof-run.lock");
if (existsSync(LOCK)) {
  const held = readFileSync(LOCK, "utf8").trim();
  console.error(`REFUSING TO RUN — another red-proof pass holds the lock: ${held}`);
  console.error(`Two passes overlapping corrupt the working tree: one restores a file the other is`);
  console.error(`still treating as its baseline, and a break is left behind with no warning.`);
  console.error(`If that run is dead, delete ${LOCK.slice(ROOT.length + 1)} and check \`git status public/\` first.`);
  process.exit(2);
}
if (!DRY) {
  writeFileSync(LOCK, `pid ${process.pid} · started ${new Date().toISOString()}`);
  const release = () => { try { if (existsSync(LOCK)) unlinkSync(LOCK); } catch (_) {} };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { release(); process.exit(130); });
}

const ledger = readLedger();
const stamp = new Date().toISOString();
let applied = 0, alone = 0, compound = 0, notRed = 0, skipped = 0;

for (const f of files) {
  const src = readFileSync(join(SCRIPTS, f), "utf8");
  const breaks = parseBreaks(src, f);
  if (!breaks.length) continue;

  const broken = breaks.filter((b) => b.__broken);
  for (const b of broken) {
    console.error(`  ${f}:${b.__line}  DECLARATION UNPARSEABLE — ${b.__broken}`);
    skipped++;
  }

  /* ══ PRUNE THE LEDGER'S MEMORY OF LEGS THAT NO LONGER EXIST ══════════════════════════════════
   *
   * The ledger is keyed `check::leg`, and a leg RENAMED between runs leaves its old key behind with
   * whatever status it had. After one long session it held EIGHT stale entries — five NOT RED and
   * three SKIPPED — all of them legs that had since been renamed and were RED ALONE under their new
   * names. A ledger that accumulates a memory of a leg that is gone is the staleness disease arriving
   * in the thing built to cure it, and it reads as a worse result than the truth.
   *
   * So: for every check this run actually examined, any key whose leg is no longer DECLARED in that
   * check is dropped. Scoped deliberately to checks examined in this run — pruning a check that was
   * not run would delete the record of a leg that still exists. */
  const declaredNow = new Set(breaks.filter((b) => !b.__broken).map((b) => `${f}::${b.leg}`));
  let pruned = 0;
  for (const k of Object.keys(ledger.legs)) {
    if (!k.startsWith(f + "::")) continue;
    if (declaredNow.has(k)) continue;
    delete ledger.legs[k]; pruned++;
  }

  console.log(`\n══ ${f} — ${breaks.length - broken.length} declared break(s)` +
    (pruned ? ` · pruned ${pruned} stale ledger entr(ies) for legs no longer declared here` : ""));
  if (DRY) { for (const b of breaks) if (!b.__broken) console.log(`   would break: leg ${JSON.stringify(b.leg)} via ${b.file || "sql"}`); continue; }

  const base = run(f);
  const baseFails = new Set(failedLines(base.out));
  console.log(`   unbroken: exit ${base.code}, ${baseFails.size} leg(s) already failing`);

  for (const b of breaks) {
    if (b.__broken) continue;
    const key = `${f}::${b.leg}`;
    const rec = { check: f, leg: b.leg, why: b.why || null, at: stamp };

    // ══ A DECLARATION THAT CANNOT BE AUTOMATED AT ALL ═════════════════════════════════════════
    //
    // Gated on `provenBy` ALONE, not on `sql`. The first version required a `sql` break, so a leg
    // that reads PRODUCTION — where no repo edit can change the answer until a git push — matched
    // neither branch, fell through to `join(ROOT, undefined)`, and took the whole runner down with a
    // TypeError. A runner that crashes on a legitimate declaration shape is a runner that stops
    // red-proofing everything after it, which is the loudest possible version of the failure it
    // exists to catch, and the only good thing about it.
    if (b.provenBy && !b.file) {
      rec.status = "DECLARED, PROVEN BY HAND"; rec.note = b.provenBy;
      ledger.legs[key] = rec;
      console.log(`   leg ${JSON.stringify(b.leg)}  DECLARED, PROVEN BY HAND — not re-verified by this runner`);
      continue;
    }
    // No file and no hand-proof is a malformed declaration. SKIPPED and named, never a crash and
    // never silence — an unparseable or unusable declaration is exactly the thing that lets a leg
    // sit in the ledger having never been seen red.
    if (!b.file && !b.sql) {
      rec.status = "SKIPPED"; rec.note = "declaration has neither `file` nor `sql` nor `provenBy`";
      ledger.legs[key] = rec; skipped++;
      console.log(`   leg ${JSON.stringify(b.leg)}  SKIPPED — declaration names no file to break and no hand-proof`);
      continue;
    }
    if (b.sql && !b.file) {
      // A DB BREAK PERFORMED BY HAND IS EVIDENCE, AND IT IS LABELLED AS SUCH. Recording it as an
      // automated proof would put us back where we started — a claim in prose. Recording it as
      // SKIPPED would throw away a real red-proof. So it gets its own status, which nobody can
      // mistake for the machine having checked it.
      if (b.provenBy) {
        rec.status = "DECLARED, PROVEN BY HAND"; rec.note = b.provenBy;
        ledger.legs[key] = rec;
        console.log(`   leg ${JSON.stringify(b.leg)}  DECLARED, PROVEN BY HAND — not re-verified by this runner`);
        continue;
      }
      if (!ALLOW_DB) {
        rec.status = "SKIPPED"; rec.note = "a database break, and --allow-db was not passed";
        ledger.legs[key] = rec; skipped++;
        console.log(`   leg ${JSON.stringify(b.leg)}  SKIPPED (db break, no --allow-db)`);
        continue;
      }
      /* ══ FUNCTION-ONLY DB BREAKS ARE AUTOMATED. ROW WRITES ARE NOT, EVER. ══════════════════════
       *
       * Adrian, 2026-09-18, on the anon-reader leg: *"the declared break is the allowlist reverting
       * to to_jsonb(b), and it must turn that leg RED ALONE, recorded in the ledger."* That break is
       * a database change, so either the runner applies it or the strongest leg in the repo is
       * proven only in prose.
       *
       * IT IS BOUNDED BY A RULE, NOT BY CARE. The sql and its restore must contain nothing but
       * `create or replace function` — no insert, update, delete, drop, truncate or alter table. A
       * function can be swapped and swapped back with no row touched; that is why this one class is
       * safe to automate and why nothing else is. The guard is checked on BOTH statements, because a
       * restore that writes rows is as bad as a break that does. */
      const ROWS = /\b(insert|update|delete|truncate|drop|alter\s+table|grant|revoke)\b/i;
      const FUNC_ONLY = (t) => /create\s+or\s+replace\s+function/i.test(t) && !ROWS.test(t);
      if (!b.restore || !FUNC_ONLY(b.sql) || !FUNC_ONLY(b.restore)) {
        rec.status = "SKIPPED";
        rec.note = "a db break this runner refuses to apply: only `create or replace function` breaks " +
          "with a matching function-only restore are automated, so it can never write a row by accident";
        ledger.legs[key] = rec; skipped++;
        console.log(`   leg ${JSON.stringify(b.leg)}  SKIPPED (db break is not function-only)`);
        continue;
      }
      const sqlFile = (t, label) => {
        const f2 = join(mkdtempSync(join(tmpdir(), "hubly-rp-")), label + ".sql");
        writeFileSync(f2, t);
        const out = execFileSync("supabase", ["db", "query", "--linked", "-f", f2],
          { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
        if (/"_tag"\s*:\s*"Error"/.test(out)) throw new Error(out.slice(0, 300));
        return f2;
      };
      try { sqlFile(b.sql, "break"); } catch (e) {
        rec.status = "SKIPPED"; rec.note = "the break statement failed: " + String(e.message).slice(0, 160);
        ledger.legs[key] = rec; skipped++;
        console.log(`   leg ${JSON.stringify(b.leg)}  SKIPPED — break sql failed`);
        continue;
      }
      const brokeDb = run(f);
      // RESTORE IS A POSTCONDITION. If it fails, stop the whole run rather than leave the database
      // holding a deliberately broken function.
      try { sqlFile(b.restore, "restore"); } catch (e) {
        console.error(`\nABORTING — the restore of ${b.leg} FAILED: ${String(e.message).slice(0, 200)}`);
        console.error(`The database is holding a deliberately broken function. Re-apply it by hand NOW.`);
        process.exit(2);
      }
      applied++;
      const newlyDb = failedLines(brokeDb.out).filter((l) => !baseFails.has(l));
      const hitDb = newlyDb.filter((l) => l.includes(String(b.leg)));
      rec.also = newlyDb.filter((l) => !l.includes(String(b.leg))).map((l) => l.slice(0, 120));
      rec.newlyRed = newlyDb.length;
      rec.note = "a FUNCTION-ONLY database break, applied and restored by the runner; no row was written";
      if (hitDb.length && newlyDb.length === 1) { rec.status = "RED ALONE"; alone++; }
      else if (hitDb.length) { rec.status = "COMPOUND"; compound++; }
      else { rec.status = "NOT RED"; notRed++; }
      ledger.legs[key] = rec;
      console.log(`   leg ${JSON.stringify(b.leg)}  ${rec.status}  (db break, ${newlyDb.length} newly-red leg(s))`);
      continue;
    }

    const target = join(ROOT, b.file);
    if (!existsSync(target)) {
      rec.status = "SKIPPED"; rec.note = `no such file: ${b.file}`;
      ledger.legs[key] = rec; skipped++;
      console.log(`   leg ${JSON.stringify(b.leg)}  SKIPPED — no such file ${b.file}`);
      continue;
    }
    // ══ DOES THE DECLARED LEG EXIST AT ALL? ═════════════════════════════════════════════════════
    //
    // A break names its leg by a SUBSTRING of that leg's printed line, which is right — an index
    // renumbers the moment a leg is inserted, and a renumbered declaration silently points at the
    // wrong leg. But a substring can DRIFT: rename the leg and the declaration quietly matches
    // nothing, the break turns something red, no newly-red line contains the declared text, and it
    // gets recorded as NOT RED — i.e. "your leg is vacuous" when the truth is "your declaration is
    // stale". That happened on the first run of this runner, four times, an hour after it was built.
    //
    // So the declaration is checked against the UNBROKEN output first. A leg that does not appear
    // there is a stale declaration, recorded as its own distinct state.
    if (!base.out.includes(String(b.leg))) {
      rec.status = "SKIPPED";
      rec.note = `declaration names leg ${JSON.stringify(b.leg)}, which appears nowhere in this ` +
        `check's output — the declaration is STALE, which is a different fault from a vacuous leg`;
      ledger.legs[key] = rec; skipped++;
      console.log(`   leg ${JSON.stringify(b.leg)}  SKIPPED — no such leg in the output (stale declaration)`);
      continue;
    }
    const before = readFileSync(target, "utf8");
    // ══ A DECLARATION MUST NOT MATCH ITSELF ═════════════════════════════════════════════════════
    //
    // When a check breaks its OWN source — legitimate, when the leg's claim is about a set the check
    // derives — the `find` text is quoted inside the declaration, and often in `with` too. The naive
    // count then reports 3 occurrences of a line that appears once in the code, and the break is
    // refused. Caught on the first run of this runner against check-every-check-is-runnable.
    //
    // So a same-file break searches the source with every declareBreak(…) span blanked out. Blanked
    // rather than deleted, so byte offsets stay put and the replacement lands where it should.
    const sameFile = target === join(SCRIPTS, f);
    const searchable = sameFile
      ? (() => {
          let out = before;
          for (const d of parseBreaks(before, f)) {
            const lines = out.split("\n");
            // blank the declaration's own lines, from its `declareBreak(` line to its closing `});`
            let k = (d.__line || 1) - 1, depth = 0, started = false;
            for (; k < lines.length; k++) {
              for (const c of lines[k]) { if (c === "(" || c === "{") { depth++; started = true; } else if (c === ")" || c === "}") depth--; }
              const wasLine = lines[k]; lines[k] = " ".repeat(wasLine.length);
              if (started && depth <= 0) break;
            }
            out = lines.join("\n");
          }
          return out;
        })()
      : before;
    const hits = searchable.split(b.find).length - 1;
    if (hits !== 1) {
      // A break that never applied tested nothing. Recorded as SKIPPED, never as anything else.
      rec.status = "SKIPPED"; rec.note = `\`find\` matched ${hits} time(s) in ${b.file}; a break must match exactly once`;
      ledger.legs[key] = rec; skipped++;
      console.log(`   leg ${JSON.stringify(b.leg)}  SKIPPED — find matched ${hits}x (must be exactly 1)`);
      continue;
    }

    // Replace in the SEARCHABLE view's position, i.e. skip any occurrence inside a declaration.
    const at = searchable.indexOf(b.find);
    writeFileSync(target, before.slice(0, at) + (b.with ?? "") + before.slice(at + b.find.length));
    const broke = run(f);
    writeFileSync(target, before);
    if (readFileSync(target, "utf8") !== before) {
      console.error(`\nABORTING — restore of ${b.file} did not reproduce the original bytes.`);
      process.exit(2);
    }
    applied++;

    const now = failedLines(broke.out);
    const newly = now.filter((l) => !baseFails.has(l));
    const hit = newly.filter((l) => l.includes(String(b.leg)));
    rec.also = newly.filter((l) => !l.includes(String(b.leg))).map((l) => l.slice(0, 120));

    if (hit.length && newly.length === 1) { rec.status = "RED ALONE"; alone++; }
    else if (hit.length) { rec.status = "COMPOUND"; compound++; }
    else { rec.status = "NOT RED"; notRed++; }
    rec.newlyRed = newly.length;
    ledger.legs[key] = rec;
    console.log(`   leg ${JSON.stringify(b.leg)}  ${rec.status}` +
      `  (${newly.length} newly-red leg(s)${rec.also.length ? "; also: " + rec.also.length : ""})`);
  }
}

if (DRY) { console.log("\nDry run. Nothing applied, nothing recorded."); process.exit(0); }

ledger.runs.push({ at: stamp, applied, alone, compound, notRed, skipped });
writeLedger(ledger);

console.log(`\n${applied} break(s) applied · ${alone} RED ALONE · ${compound} COMPOUND · ${notRed} NOT RED · ${skipped} SKIPPED`);
console.log(`Ledger written: docs/red-proof-ledger.json + docs/RED_PROOF_LEDGER.md`);
if (compound) console.log(`A COMPOUND proves nothing about its leg — it needs a narrower break (L98).`);
if (notRed) console.log(`A NOT RED leg is VACUOUS or its break misses it. Either way it is a finding.`);
process.exit(compound + notRed + skipped ? 1 : 0);
