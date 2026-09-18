/**
 * THE RED-PROOF LEDGER — somewhere for the evidence to live.
 *
 * ══ WHY THIS EXISTS ═════════════════════════════════════════════════════════════════════════
 *
 * Measured 2026-09-17: **252 negative assertions across 64 check files, and not one of them has a
 * recorded red-proof** — because nothing in this repo records one. A break happens in a terminal and
 * survives, if at all, as prose in a commit message. Adrian:
 *
 *   *"Every round we perform breaks, they prove something real, and the evidence evaporates. 252 legs
 *    with no recorded red-proof is not 252 unbroken legs — it is a repo with nowhere to put the
 *    evidence. Until that exists, L98 is a lesson we re-read, not a rule the repo holds."*
 *
 * So: **"has this leg ever been shown red alone" becomes a question with an answer instead of a
 * question with a memory.** The ledger is the memory, because the session has none.
 *
 * ══ THE FOUR RULES OF THE DESIGN ════════════════════════════════════════════════════════════
 *
 * 1. **A BREAK IS DECLARED IN THE CHECK ITSELF, BESIDE ITS LEG.** `declareBreak({...})` is a real
 *    call in the check's own source, so it is syntax-checked, it moves when the leg moves, and it
 *    cannot describe a leg that is no longer there without someone seeing it. A break list in a
 *    separate file would be a hand-maintained set and would go stale — that is the disease this repo
 *    pays for most.
 *
 * 2. **ONE BREAK, ONE LEG.** A break that turns six legs red is recorded as a COMPOUND and proves
 *    nothing about any one of them. The runner records which legs went red, which stayed green, and
 *    whether exactly the declared leg fired.
 *
 * 3. **THE BASELINE IS SUBTRACTED.** A check may legitimately be red already. What counts is the
 *    legs that went red *because of the break* — broken-run failures minus unbroken-run failures.
 *    Without this, a check with a real open finding would credit every break with a leg it did not
 *    move.
 *
 * 4. **THE RESULT IS STORED IN THE REPO.** `docs/red-proof-ledger.json` is the machine truth;
 *    `docs/RED_PROOF_LEDGER.md` is generated from it so the two cannot drift.
 *
 * ══ HOW A CHECK DECLARES ONE ════════════════════════════════════════════════════════════════
 *
 *   import { declareBreak } from "./lib/redproof.mjs";
 *
 *   declareBreak({
 *     leg: "6",                                  // matched against the leg's own output line
 *     why: "a day holding rows must not be called 'not set up'",
 *     file: "public/platform-home.html",
 *     find: "if(rows.length) return renderDay(rows);",
 *     with: "if(false) return renderDay(rows);",  // omit `with` to delete the found text
 *   });
 *   say("6 a day holding rows is NOT reported as 'not set up on this account'", …);
 *
 * `leg` is a SUBSTRING of the leg's printed line, not an index: indices renumber when a leg is
 * inserted, and a renumbered declaration silently points at the wrong leg.
 *
 * A break that cannot be expressed as a file edit — planting a row, revoking a grant — declares
 * `sql` and `restore` instead, and the runner runs those only under `--allow-db`, because a red-proof
 * must never be the thing that writes to a real table by accident.
 *
 * AT CHECK RUNTIME THIS IS A NO-OP. It records into a module array so a check could self-report, and
 * returns nothing. The runner reads the declarations STATICALLY, out of the source, so collecting
 * them never requires running anything.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEDGER_JSON = join(ROOT, "docs/red-proof-ledger.json");
export const LEDGER_MD = join(ROOT, "docs/RED_PROOF_LEDGER.md");

const declared = [];
/** Called from inside a check, beside the leg it belongs to. A no-op at check runtime. */
export function declareBreak(spec) { declared.push(spec); return spec; }
/** What this process declared — for a check that wants to print its own contract. */
export function declaredBreaks() { return declared.slice(); }

/* ── STATIC COLLECTION. Balanced-brace scan for declareBreak({ … }), then evaluate the literal.
      `new Function` on our own repo source is fine and is the only thing that reads a JS object
      literal correctly — a regex would mangle a `find:` string containing braces, and every
      interesting break contains code. ─────────────────────────────────────────────────────────── */
export function parseBreaks(src, file) {
  const out = [];
  const marker = "declareBreak(";
  let i = 0;
  for (;;) {
    i = src.indexOf(marker, i);
    if (i < 0) break;
    // Skip a mention inside a comment or a string — a declaration is code, not prose about code.
    const lineStart = src.lastIndexOf("\n", i) + 1;
    const before = src.slice(lineStart, i);
    if (/^\s*(\/\/|\*|\/\*)/.test(before) || /["'`]\s*$/.test(before)) { i += marker.length; continue; }
    // ══ STRINGS ARE SKIPPED, AND THE FIRST VERSION DID NOT ═════════════════════════════════════
    //
    // A naive brace count found ZERO declarations the first time this ran, silently, because one
    // `find:` value was `"function hcHomePromises("` — an unbalanced `(` inside a string literal.
    // The depth went up and never came back, the scan ran to EOF, and the parser reported "no
    // declarations" for a file holding four. Every interesting break contains code, and code
    // contains unbalanced brackets in strings, so this is the normal case rather than an edge one.
    //
    // It is also the exact failure the ledger exists to catch, arriving in the ledger's own parser:
    // an instrument that finds nothing and says so as if that were an answer.
    let d = 0, end = -1, q = null, esc = false;
    for (let k = i + marker.length - 1; k < src.length; k++) {
      const c = src[k];
      if (q) {
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { q = c; continue; }
      if (c === "/" && src[k + 1] === "/") { k = src.indexOf("\n", k); if (k < 0) break; continue; }
      if (c === "/" && src[k + 1] === "*") { k = src.indexOf("*/", k); if (k < 0) break; k += 1; continue; }
      if (c === "(" || c === "{" || c === "[") d++;
      else if (c === ")" || c === "}" || c === "]") { d--; if (d === 0) { end = k + 1; break; } }
    }
    if (end < 0) break;
    const literal = src.slice(i + marker.length, end - 1);
    try {
      // eslint-disable-next-line no-new-func
      const spec = Function(`"use strict"; return (${literal});`)();
      spec.__line = src.slice(0, i).split("\n").length;
      spec.__check = file;
      out.push(spec);
    } catch (e) {
      out.push({ __broken: String(e.message), __line: src.slice(0, i).split("\n").length, __check: file });
    }
    i = end;
  }
  return out;
}

/* ── WHICH LEGS FAILED, ACROSS EVERY OUTPUT FORMAT THIS REPO USES ─────────────────────────────
      Three styles are in the tree: `  FAIL [RULE] name`, `FAIL  7 name`, and `FAIL: message`.
      A runner that understood one of them would silently score the other two as "no legs red",
      which is the manufactured-silence failure this repo keeps paying for. */
export function failedLines(stdout) {
  return stdout.split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => /^\s*(FAIL|✗|RED)\b|^\s*FAIL[: ]/.test(l))
    // A SUMMARY IS NOT A LEG. `FAIL — 2/4 legs` and `3 FAILED` are a check's own tally, and counting
    // one as a newly-red leg makes every break on such a check report COMPOUND — so no check using
    // that output style could ever record a red-proof. Found the first time this runner met one.
    .filter((l) => !/^\s*FAIL\s*[—–-]/.test(l) && !/^\s*FAIL\s*$/.test(l))
    .map((l) => l.trim());
}

export function readLedger() {
  if (!existsSync(LEDGER_JSON)) {
    // THE RATCHET DATE IS BORN WITH THE LEDGER AND NEVER MOVES. Adrian: "Ratchet it: the failure
    // applies to legs added or modified from today." Stored here so it survives a context loss —
    // a date recomputed as "today" every run would exempt every leg, forever.
    return { ratchetSince: new Date().toISOString().slice(0, 10), runs: [], legs: {} };
  }
  return JSON.parse(readFileSync(LEDGER_JSON, "utf8"));
}

export function writeLedger(ledger) {
  writeFileSync(LEDGER_JSON, JSON.stringify(ledger, null, 2) + "\n");
  writeFileSync(LEDGER_MD, renderLedger(ledger));
}

/** When was this exact line last changed? The ratchet is derived from git, never from a list. */
export function lineChangedAt(file, line) {
  try {
    const out = execFileSync("git", ["blame", "-L", `${line},${line}`, "--porcelain", "--", file],
      { encoding: "utf8", cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] });
    const m = out.match(/^author-time (\d+)$/m);
    return m ? new Date(Number(m[1]) * 1000).toISOString().slice(0, 10) : null;
  } catch (_) { return null; }
}

function renderLedger(l) {
  const keys = Object.keys(l.legs).sort();
  const alone = keys.filter((k) => l.legs[k].status === "RED ALONE");
  const compound = keys.filter((k) => l.legs[k].status === "COMPOUND");
  const nope = keys.filter((k) => l.legs[k].status === "NOT RED");
  const skipped = keys.filter((k) => l.legs[k].status === "SKIPPED");
  return `# The red-proof ledger — GENERATED, DO NOT EDIT

Written by \`scripts/redproof-run.mjs\` from \`docs/red-proof-ledger.json\`. Edit the declarations in
the checks, not this file.

**This exists because the evidence used to evaporate.** A break happens in a terminal and survives, if
at all, as prose in a commit message — so *"has this leg ever been shown red alone"* was a question
with a memory instead of an answer. On 2026-09-17 the repo held **252 negative assertions and zero
recorded red-proofs**, which is not 252 unbroken legs; it is a repo with nowhere to put the evidence.

**Ratchet date: ${l.ratchetSince}.** A purely-negative leg whose line was last changed on or after
that date MUST declare a break, and \`check-negative-legs-declare-a-break.mjs\` fails if it does not.
Legs older than that date are grandfathered — there were 78 of them and failing all at once would
have made the rule the first thing anyone switched off.

**Last run: ${l.runs.length ? l.runs[l.runs.length - 1].at : "never"}** · ${l.runs.length} run(s) recorded.

| status | n | what it means |
| --- | --- | --- |
| **RED ALONE** | ${alone.length} | the break fired exactly this leg and nothing else. **This is a red-proof.** |
| COMPOUND | ${compound.length} | the break turned this leg red along with others. **Proves nothing about this leg** (L98) — it needs a narrower break |
| NOT RED | ${nope.length} | the break was applied and this leg stayed green. **The leg is vacuous, or the break misses it** |
| SKIPPED | ${skipped.length} | the break could not be applied (text not found, or a db break without \`--allow-db\`). **Not evidence of anything** |

${keys.length ? `## Every declared break

| check | leg | status | break | also went red |
| --- | --- | --- | --- | --- |
${keys.map((k) => {
  const e = l.legs[k];
  return `| \`${e.check}\` | ${e.leg} | **${e.status}** | ${e.why || "—"} | ${(e.also || []).length ? (e.also || []).join("<br>") : "—"} |`;
}).join("\n")}` : "No breaks declared yet."}

## Runs

${l.runs.length ? l.runs.map((r) => `- **${r.at}** — ${r.applied} break(s) applied · ${r.alone} red alone · ${r.compound} compound · ${r.notRed} not red · ${r.skipped} skipped`).join("\n") : "none"}
`;
}

/* ══ WHICH LEGS ARE NEGATIVE, AND WHICH ARE PURELY SO ═══════════════════════════════════════════
 *
 * ONE READER, used by BOTH `audit-negative-assertions` (which counts them) and
 * `check-negative-legs-declare-a-break` (which enforces the ratchet). Two copies of this scan would
 * disagree within a week — one would be tightened and the other would not — and then the audit's
 * count and the ratchet's enforcement would be about different sets while sharing a name. That is
 * the two-of-everything pattern arriving in the instrument that measures it.
 *
 * A NEGATIVE ASSERTION is a negation appearing in a leg's own assertion expression. A PURELY
 * NEGATIVE one has no clause requiring anything to BE there, so it passes on a blank page, a failed
 * load or an unrendered room — the shape BREAK 1 had (Lesson 98).
 */
const NEG_FORMS = [
  { id: "!includes", rx: /!\s*[\w.$[\]()"'`]*\.includes\(([^)]*)\)/g },
  { id: "!some", rx: /!\s*[\w.$[\]()"'`]*\.some\(/g },
  { id: "!test", rx: /!\s*\/((?:[^\/\\\n]|\\.)+)\/[a-z]*\.test\(/g },
  { id: "!match", rx: /!\s*[\w.$[\]()"'`]*\.match\(/g },
  { id: "!querySel", rx: /!\s*[\w.$]*\.?querySelector\(([^)]*)\)/g },
  { id: "!contains", rx: /!\s*[\w.$[\]()"'`]*\.contains\(([^)]*)\)/g },
  { id: "=== null", rx: /===\s*null\b/g },
  { id: "length === 0", rx: /\.length\s*===\s*0\b/g },
  { id: "!length", rx: /!\s*[\w.$[\]()]*\.length\b/g },
  { id: "=== 0", rx: /\b(?:count|n|hits|found|bad|leaks?|rows?)\s*===\s*0\b/gi },
];
const ASSERTING = /\b(say|leg|assert|expect|ok\s*[:=]|pass\s*[:=]|report)\s*\(|\bpass:|\bok:/;

/** Does this window contain a clause that requires something to BE there? */
export function hasPositiveClause(win) {
  const blanked = win.replace(/![\s]*(?:\/(?:[^\/\\\n]|\\.)+\/[a-z]*|[\w.$\[\]()"'`]+)\.(?:test|includes|some|contains)\(/g, " NEG( ");
  if (/(?<![!\w])(?:\/(?:[^\/\\\n]|\\.)+\/[a-z]*|[\w.$\])"'`]+)\.(?:test|includes|some|contains)\(/.test(blanked)) return true;
  for (const m of win.matchAll(/===\s*([^\s,;)&|]+)/g)) {
    if (!/^(null|0|false|undefined|""|''|``|\[\])$/.test(m[1])) return true;
  }
  if (/!!/.test(win)) return true;
  if (/\.length\s*(?:>|>=)\s*\d|>\s*0\b|>=\s*1\b/.test(win)) return true;
  if (/\btrue\b/.test(win)) return true;
  return false;
}

/** Every negative assertion in a check's source, with whether it is purely negative. */
export function negativeLegs(src) {
  const lines = src.split("\n");
  const out = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) continue;
    const win5 = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
    if (!ASSERTING.test(win5)) continue;
    // A NEGATION INSIDE A DERIVATION IS NOT AN ASSERTION. `xs.filter((L) => !/^\\s*\\/\\//.test(L))`
    // strips comments; it claims nothing. The window test above catches such a line whenever a
    // reporter call happens to sit within two lines of it, which is common — the derivation usually
    // feeds the assertion right below. `xs.filter(...).length === 0` still counts, because that
    // negation is outside the callback.
    const derivAt = L.search(/\.(?:filter|map|forEach|reduce|find|findIndex|flatMap)\s*\(/);
    for (const form of NEG_FORMS) {
      form.rx.lastIndex = 0;
      let m;
      while ((m = form.rx.exec(L))) {
        if (derivAt >= 0 && m.index > derivAt) continue;
        const at = `${i + 1}:${m.index}`;
        if (seen.has(at)) continue;
        seen.add(at);
        const win = lines.slice(Math.max(0, i - 3), i + 3).join(" ");
        out.push({ line: i + 1, col: m.index, form: form.id, subject: (m[1] || "").trim(),
                   text: L.trim().slice(0, 150), purelyNegative: !hasPositiveClause(win) });
      }
    }
  }
  return out;
}
