#!/usr/bin/env node
/**
 * [RULE] A CHECK THAT READS A PATH THAT DOES NOT EXIST SAYS "CANNOT RUN" — IT NEVER CRASHES.
 *
 *   node scripts/check-a-missing-file-says-cannot-run.mjs
 *
 * ══ WHY, 2026-09-17 ═════════════════════════════════════════════════════════════════════════
 *
 * SIX checks read `hubly.html` AT THE REPO ROOT. That file has not existed for a long time — the
 * shell is `public/hubly.html` — so each one threw ENOENT **before its first assertion** and had
 * been red for months for a reason that had nothing to do with the product. Nobody read them.
 * Four went green the moment the path was derived from what is on disk; two had real findings that
 * had been silent for the same reason as the four that did not.
 *
 * Adrian: *"Make it impossible: a check that reads a path which does not exist must say CANNOT
 * RUN, never crash before its first assertion."*
 *
 * ══ HOW IT IS MADE IMPOSSIBLE ═══════════════════════════════════════════════════════════════
 *
 * Not by asking every author to remember. Every `check-*.mjs` is RUN with a poisoned filesystem —
 * a wrapper that makes one real file appear missing — and the check must exit 2 (CANNOT RUN) or
 * 1 (a normal failure), never throw an unhandled ENOENT. A crash is the one outcome that carries
 * no information at all.
 *
 * DERIVED, NOT A LIST: the files come from a glob, and the readers come from the source. A new
 * check is covered the day it is written.
 *
 * SOURCE-LEVEL, BY DESIGN. Actually running 160 checks under a poisoned filesystem would take
 * twenty minutes and half of them need a browser. What is asserted instead is the property that
 * makes the crash impossible: every literal path a check reads is either guarded by existsSync,
 * or wrapped in try/catch, or resolved through a helper that does one of those. That is checkable
 * from the source and it is exactly the thing the six were missing.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "scripts");
const files = readdirSync(DIR).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
if (!files.length) { console.error("CANNOT RUN — no check scripts found"); process.exit(2); }

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** A read of a literal path. Both shapes: join(ROOT, <path>) and a bare string.
 *  (The example paths that used to be in this comment were themselves matched by the scan —
 *  a check finding its own documentation, which is the smallest possible version of measuring
 *  yourself instead of the thing.) */
const READ_JOIN = /\b(?:readFileSync|readFile|createReadStream)\s*\(\s*join\(\s*[A-Za-z_$][\w$]*\s*,\s*["'`]([^"'`]+)["'`]/g;
const READ_BARE = /\b(?:readFileSync|readFile|createReadStream)\s*\(\s*["'`]([^"'`]+)["'`]/g;

// ══ THE ASSERTION THAT ACTUALLY PREVENTS IT ═════════════════════════════════════════════════
//
// The first version of this tried to detect a "guard" in a window of lines around each read. It
// produced false positives on reads of files that certainly exist and false negatives on clever
// ones — measuring the SHAPE of the code instead of the thing that matters.
//
// A check cannot crash on a file that EXISTS. So the rule is exact and has no heuristic in it:
// every literal path a check reads must be on disk right now, or the read must be guarded by
// existsSync. That catches the six that were dark — they read `hubly.html` at the repo root, which
// has not existed for a long time — the day the path stops resolving, not months later.
const missing = [];
let reads = 0;
for (const f of files) {
  if (f === "check-a-missing-file-says-cannot-run.mjs") continue;   // this file's own regexes
  const src = readFileSync(join(DIR, f), "utf8");
  const lines = src.split("\n");
  for (const re of [READ_JOIN, READ_BARE]) {
    const r = new RegExp(re.source, re.flags);
    let m;
    while ((m = r.exec(src)) !== null) {
      const rel = m[1];
      if (/^[./]*$/.test(rel) || rel.startsWith("http")) continue;
      // A path built from a variable is not a literal and is not judged here.
      if (/\$\{/.test(rel)) continue;
      reads++;
      const lineNo = src.slice(0, m.index).split("\n").length;
      const candidates = [join(ROOT, rel), join(DIR, rel), rel];
      if (candidates.some((c) => existsSync(c))) continue;
      // Absent — which is allowed, but only if the check said so first.
      const window = lines.slice(Math.max(0, lineNo - 8), lineNo + 2).join("\n");
      if (/existsSync/.test(window)) continue;
      missing.push(`${f}:${lineNo}  reads "${rel}", which is not on disk, with no existsSync guard`);
    }
  }
}

// ══ AND THE SHAPE THE SIX ACTUALLY USED ═════════════════════════════════════════════════════
//
// RED-PROOFING CAUGHT THIS CHECK BEING USELESS. Pointing check-hubly-syntax back at the repo-root
// path — the exact defect — produced NOTHING, because that check reads `fs.readFileSync(path)`
// where `path` is a PARAMETER. Every one of the six that were dark had that shape:
// `const files = ['hubly.html', 'public/hubly.html']` and then a read of the variable. A scan that
// only looks at the read site cannot see any of them, and would have shipped green while missing
// the entire class it was written for.
//
// So the second pass judges the STRINGS: any literal in a check that looks like a repo source path
// must resolve. A comment may name a dead path (they often explain one); code may not hold one.
const SOURCE_PATH = /["'`]((?:[\w.-]+\/)*[\w.-]+\.(?:html|mjs|js|ts|sql|json|css))["'`]/g;
const deadStrings = [];
let strings = 0;
for (const f of files) {
  if (f === "check-a-missing-file-says-cannot-run.mjs") continue;
  const src = readFileSync(join(DIR, f), "utf8");
  const lines = src.split("\n");
  const re = new RegExp(SOURCE_PATH.source, SOURCE_PATH.flags);
  let m;
  while ((m = re.exec(src)) !== null) {
    const rel = m[1];
    const lineNo = src.slice(0, m.index).split("\n").length;
    const line = lines[lineNo - 1] || "";
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;             // a comment may name a dead path
    if (/https?:\/\//.test(line)) continue;                     // part of a URL, not a path
    // A path a check CREATES or SERVES is not a path it expects to find: a temp file it writes, a
    // proof it emits, a route it asks a local server for. Judging those would report every
    // scratch file as a missing dependency — the probe must know ABSENT from BROKEN.
    if (/write|mkdir|unlink|\btmp\b|cache|outDir|\.url\(|rmSync/.test(line)) continue;
    // …and a path joined to a temp DIRECTORY is a scratch file too, even when the write is on the
    // next line. `mkdtempSync` is the tell, and it is the only one in the repo.
    if (/join\(\s*dir\s*,/.test(line) && /mkdtempSync/.test(src)) continue;
    // A PATH USED AS A NEEDLE IS NOT A PATH TO A FILE. Several checks assert that the shell's
    // markup REFERENCES an asset — `has(hubly, "journey-os/journey.js")` — which is a string
    // search inside a file that is already open, not a read of a second one.
    if (/\b(has|includes|inOrder|match|test|indexOf|search|expect)\s*\(/.test(line)) continue;
    // A FALLBACK INSIDE A try/catch IS THE GUARD, not a missing dependency: `catch { file =
    // join(PUBLIC,'hubly.html') }` is a check that already handled absence. So is a path joined
    // onto a directory the code just proved exists.
    if (/\bcatch\b|\bstat\(|isDirectory/.test(line)) continue;
    if (!/[/.]/.test(rel)) continue;
    strings++;
    // …and it may be joined to a directory variable the scan cannot resolve. public/ is tried
    // ONLY when the line itself names that directory — `path.join(PUBLIC, 'hubly.html')`.
    // An unconditional public/ fallback made every bare shell filename resolve, which is exactly
    // the six-dark-checks defect made invisible; red-proofing caught it returning NOTHING.
    const nearPublic = /\bPUBLIC\b|publicDir|["'`]public["'`]/.test(line);
    // ══ AND ANY OTHER DIRECTORY THE LINE ITSELF NAMES, not just public/ ═════════════════════════
    //
    // The public/ case above is right and was too narrow: public/ was simply the directory that had
    // bitten us. `join(ROOT, "api", "sitemap.js")` and
    // `join(ROOT, "supabase", "migrations", "20260918200000_….sql")` name their directories on the
    // same line in exactly the same way, and this scan reported all three as "not on disk" — three
    // false positives on files that exist, while leg 2 (the strong per-read-path test) passed on all
    // 59. A detector that produces flattering-looking findings about real files gets believed, and
    // then ignored.
    //
    // Derived from the line: every quoted bare segment on it, in order, tried as a directory prefix.
    // Not a list of directory names — the same reason the router stopped listing filenames.
    const segs = [...line.matchAll(/["'`]([A-Za-z_][\w.-]*)["'`]/g)].map((m) => m[1])
      .filter((x) => x !== rel && !/[./]/.test(x));
    // EVERY PREFIX, because the quoted segments on a line are not all directories: the first attempt
    // took the whole list and got ["supabase","migrations","utf8"] — the encoding argument of
    // readFileSync — and reported a real file as missing. Trying prefixes means the right one is
    // found without my having to know which arguments are path segments.
    const segCandidates = [];
    for (let i = segs.length; i > 0; i--) segCandidates.push(join(ROOT, ...segs.slice(0, i), rel));
    const candidates = [join(ROOT, rel), join(DIR, rel), rel]
      .concat(nearPublic ? [join(ROOT, "public", rel)] : [])
      .concat(segCandidates);
    if (candidates.some((c) => existsSync(c))) continue;
    const window = lines.slice(Math.max(0, lineNo - 10), lineNo + 10).join("\n");
    // ANY existence test, not just the node builtin. Several checks assert a file is ABSENT — a
    // deleted module that must stay deleted — through a local `exists()` helper. That is the
    // opposite of the defect and must not be reported as it.
    // A CALL, NOT THE WORD. `/exists/i` matched prose — "THE LESSON THIS FILE EXISTS FOR" in a
    // header comment switched the assertion off for the whole file, which red-proofing caught by
    // producing NOTHING when a path was deliberately broken.
    if (/\bexists(Sync)?\s*\(/.test(window)) continue;
    // …and a path may be ASSIGNED here and existence-tested forty lines later — check-m25-cutover
    // builds `rootTwin` at the top and asserts `!existsSync(rootTwin)` at the bottom, which is the
    // opposite of this defect: a file that must STAY deleted. Follow the variable, not the window.
    const assigned = (line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/) || [])[1];
    if (assigned && new RegExp(`exists(Sync)?\\(\\s*${assigned}\\b`).test(src)) continue;
    deadStrings.push(`${f}:${lineNo}  names "${rel}", which is not on disk — ${line.trim().slice(0, 62)}`);
  }
}
say("0 the string scan found repo paths — a zero here means the pattern moved, not that it is clean",
    strings > 0, `${strings} source-path literal(s)`);
say("1b [RULE] no check NAMES a source path that is not there — the shape all six dark checks used",
    deadStrings.length === 0,
    deadStrings.length ? `${deadStrings.length} dead path(s)` : `${strings} path literals, all resolvable`);
for (const d of deadStrings) console.error("      " + d);

say("1 the scan found literal file reads — a zero here means the pattern moved, not that it is clean",
    reads > 0, `${reads} literal read path(s) across ${files.length} check scripts`);
say("2 [RULE] every path a check reads EXISTS — or the check checked first and can say CANNOT RUN",
    missing.length === 0,
    missing.length ? `${missing.length} read(s) of a path that is not there` : `${reads} paths, all resolvable`);
for (const u of missing) console.error("      " + u);

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — a missing file can only produce CANNOT RUN, never a crash before the first assertion.\n");
process.exit(failed ? 1 : 0);
