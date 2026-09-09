#!/usr/bin/env node
/**
 * DRAFT TOKEN IS NOT AN AUTHORISATION TEST.
 *
 *   node scripts/check-draft-token-truthiness.mjs
 *
 * THE CLASS, which appeared SEVEN times in one day (2026-09-08):
 *
 *   A CLAIMED business usually has draft_token NULL — 9 of 34, and 4 of those are market
 *   accounts including Graef. The draft predicate in hubly-conversation resolves such a
 *   business by VERIFIED OWNERSHIP and sets draftToken to the empty string. So every guard
 *   of the shape `if (… && draftToken)` is false for exactly the owners we care about.
 *
 *   Four of the seven REFUSED, which at least said something. The other three — gated
 *   document generation, the photo upload, and the record-changes writer — simply fell
 *   through with no branch taken and NO ERROR. Silent, which is worse than a refusal: the
 *   owner sends a photo, is told "I'll put it straight on the page", and nothing happens.
 *
 * Grepping harder is not the remedy. It is the thing that failed twice: the first sweep
 * fixed four and missed three, and the three were found by clicking a suggestion, not by
 * searching. So the invariant is enforced here instead.
 *
 * THE RULE: inside an `if` condition, `draftToken` may never be the only credential. Every
 * such condition must also admit a verified owner — ownerUid / ownerId / getOwnerUid() /
 * injectedOwnerUid() / p_owner_id.
 *
 * ── HOW THIS PARSES, AND WHY NOT BY LINE REGEX ────────────────────────────────
 * The `storefront` capability was invisible to an indent-anchored regex for weeks
 * (check-capability-reachable.mjs). So conditions are found STRUCTURALLY: locate `if`,
 * brace-match its parentheses to get the WHOLE condition however many lines it spans, and
 * test that. A condition split across three lines is one condition here, as it is to the
 * engine running it.
 *
 * ── WHERE THIS STOPS ──────────────────────────────────────────────────────────
 *  - It reads `if` conditions only. A ternary or an early-return guard written some other
 *    way is not covered; all seven real instances were `if` conditions.
 *  - It cannot tell a correct owner check from an incorrect one. It proves an owner term is
 *    PRESENT in the condition, never that the authorisation is right.
 *  - Comments and string literals are blanked first, so `draftToken` in prose never counts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FN_DIR = path.join(ROOT, "supabase/functions");

let failures = 0;
const fail = (m) => { failures++; console.error("FAIL  " + m); };

/** Blank comments and string/template literals, preserving offsets. Code positions only. */
function codeOnly(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const j = src.indexOf("\n", i); const k = j < 0 ? src.length : j; out += " ".repeat(k - i); i = k; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); const k = j < 0 ? src.length : j + 2; out += src.slice(i, k).replace(/[^\n]/g, " "); i = k; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      const k = Math.min(j + 1, src.length);
      out += src.slice(i, k).replace(/[^\n]/g, " "); i = k; continue;
    }
    out += c; i++;
  }
  return out;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Every `if (...)` condition in the file, paren-matched so multi-line conditions stay whole. */
function ifConditions(code) {
  const out = [];
  const re = /\bif\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    const start = m.index + m[0].length - 1;   // at the '('
    let depth = 0, end = -1;
    for (let j = start; j < code.length; j++) {
      const c = code[j];
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end > start) out.push({ at: start, text: code.slice(start + 1, end) });
  }
  return out;
}

// ── EXEMPT, EACH WITH ITS REASON ──────────────────────────────────────────────
//
// Listed explicitly rather than pattern-matched away, so the reasons stay visible and a
// future reader can disagree with them. A checker that cries wolf gets ignored, which is
// the same failure as one that never fires.
const EXEMPT = [
  {
    file: "supabase/functions/hubly-conversation/index.ts",
    match: /actionName === .* raw\.id && raw\.draftToken && raw\.slug/,
    why: "startDraft's RESULT. A draft that was just created always has a token; this reads " +
         "the newly-returned row, it does not authorise an existing business.",
  },
  {
    file: "supabase/functions/hubly-conversation/index.ts",
    match: /^\s*a\.draftToken\s*$/,
    why: "log redaction — `if (a.draftToken) a.draftToken = '[redacted]'`. The opposite of a " +
         "hazard: it exists to keep the token OUT of the action log.",
  },
  {
    file: "supabase/functions/resume-draft/index.ts",
    match: /!biz\.draft_token/,
    why: "unclaimed-only path. The line above is `if (biz.owner_id) return already_claimed`, " +
         "so by construction this only ever sees an unclaimed draft, which always has a token.",
  },
];
function exempt(relFile, condText) {
  return EXEMPT.some((e) => relFile === e.file && e.match.test(condText.trim()));
}

const OWNER = /\bowner_?[Uu]id\b|\bownerId\b|getOwnerUid\s*\(|injectedOwnerUid\s*\(|\bp_owner_id\b|_verifiedOwnerOfDraft/;
const TOKEN = /\bdraft_?[Tt]oken\b/;

const files = walk(FN_DIR);
let conditionsScanned = 0, tokenConditions = 0, exemptCount = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const code = codeOnly(raw);
  for (const cond of ifConditions(code)) {
    conditionsScanned++;
    if (!TOKEN.test(cond.text)) continue;
    tokenConditions++;
    if (OWNER.test(cond.text)) continue;
    const line = raw.slice(0, cond.at).split("\n").length;
    const rel = path.relative(ROOT, file);
    if (exempt(rel, cond.text)) { exemptCount++; continue; }
    fail(`${rel}:${line} guards on draftToken with no owner alternative.\n` +
         `      condition: ${cond.text.replace(/\s+/g, " ").trim().slice(0, 110)}\n` +
         `      A CLAIMED business resolved by ownership has draftToken "", so this is false for\n` +
         `      the owners it is meant to protect — 9 of 34 claimed businesses, 4 of them market.\n` +
         `      Accept a verified owner too: (… || ownerUid).`);
  }
}

console.log(`TypeScript files scanned        : ${files.length}`);
console.log(`if-conditions parsed            : ${conditionsScanned}`);
console.log(`  of those mentioning draftToken: ${tokenConditions}`);
console.log(`  exempt (listed, with reasons)  : ${exemptCount}`);
console.log(`  lacking an owner alternative  : ${failures} (must be 0)`);

if (!conditionsScanned) fail("parsed ZERO conditions — this check has stopped checking anything");
if (!tokenConditions) fail("found NO draftToken conditions at all — either they were all removed or this check has gone blind");

if (failures) { console.error(`\n${failures} failure(s).`); process.exit(1); }
console.log("\nPASS — no guard treats draftToken as the only credential.");
