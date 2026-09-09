/**
 * NO UNAWAITED SUPABASE BUILDER, ANYWHERE IN supabase/functions.
 *
 * A supabase-js query builder is THENABLE, NOT A PROMISE: it constructs a request and
 * sends it when .then() is called. So a builder that is never awaited, returned, assigned
 * or .then()'d is a request that is built and never sent — dead code that type-checks,
 * lints, deploys and does nothing.
 *
 * On 2026-09-09 three writes were shipped exactly that way:
 *     void createAdminClient().rpc("record_endpoint_failure", { ... });
 * One was the first-turn counter, caught within minutes because a proof looked for its row
 * and found none. Another was the endpoint-failure writer behind the outage alert, which
 * had already been REPORTED AS PROVED — proved by inserting rows in SQL and watching the
 * cron email arrive, which exercised the read path perfectly and never touched the write
 * path at all.
 *
 * The class is bigger than .rpc(): every terminal operation on a PostgrestBuilder behaves
 * this way — insert, update, upsert, delete, select. This guards the class, so the fourth
 * one fails here instead of shipping silent.
 *
 * If a write is genuinely fire-and-forget, attach .then() and LOG the error. A write that
 * fails silently cannot be counted, which defeats the point of writing it.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "supabase/functions");

const TERMINAL = /\.(rpc|insert|update|upsert|delete|select)\s*\(/;
const LOOKS_SUPABASE = /\.from\s*\(|\.rpc\s*\(/;
// The value is consumed if it is awaited, returned, assigned, then'd, or combined.
const CONSUMED = /\bawait\b|\breturn\b|=>|\.then\s*\(|\.catch\s*\(|Promise\s*\.\s*(all|allSettled|race|resolve)|\byield\b|(?<![=!<>+\-*/%&|^])=(?!=)/;

/** Strip comments and string/template bodies so punctuation inside them can't fool the split. */
function scrub(src) {
  let out = "", i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { i++; } continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") out += "\n"; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === "\\") i++; if (src[i] === "\n") out += "\n"; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Statements, with the line each began on.
 *
 *  A BRACKET STACK, not a paren counter. Nearly every edge function is one
 *  `Deno.serve(async (req) => { ... })`, so paren depth is NEVER 0 inside the body — a
 *  depth-0 splitter collapses the whole file into a single "statement", which contains an
 *  await somewhere and therefore reads as consumed. That version of this check could not
 *  go red on any real file, which is Lesson 9 wearing a new hat: it was not passing, it
 *  was not running. A `;` ends a statement when the innermost open bracket is a BLOCK
 *  (`{`) or nothing — that is true inside an arrow body however deeply nested. */
function statements(src) {
  const s = scrub(src);
  const out = [];
  const stack = [];
  let start = 0, line = 1, startLine = 1;
  const cut = (i) => { out.push({ line: startLine, text: s.slice(start, i) }); start = i + 1; startLine = line; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\n") { line++; continue; }
    const top = stack[stack.length - 1];
    // A brace only ends a statement when it is a BLOCK brace — i.e. we are in statement
    // position. Cutting on every `{` splits object literals in half, which severed
    // `.update({ ... })` from the `.then()` on the next line and reported correct
    // fire-and-forget code as a silent write.
    if (c === "(" || c === "[") stack.push(c);
    else if (c === "{") { const inStatement = top === undefined || top === "{"; stack.push(c); if (inStatement) cut(i); }
    else if (c === ")" || c === "]") stack.pop();
    else if (c === "}") { stack.pop(); const now = stack[stack.length - 1]; if (now === undefined || now === "{") cut(i); }
    else if (c === ";" && (top === undefined || top === "{")) cut(i);
  }
  out.push({ line: startLine, text: s.slice(start) });
  return out;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

test("no unawaited supabase query builder in supabase/functions", () => {
  const offenders = [];
  for (const file of walk(DIR)) {
    const src = readFileSync(file, "utf8");
    if (!LOOKS_SUPABASE.test(src)) continue;
    for (const { line, text } of statements(src)) {
      const t = text.trim();
      if (!t || !TERMINAL.test(t) || !LOOKS_SUPABASE.test(t)) continue;
      if (CONSUMED.test(t)) continue;
      offenders.push(`${path.relative(ROOT, file)}:${line} — ${t.replace(/\s+/g, " ").slice(0, 110)}`);
    }
  }
  assert.deepEqual(offenders, [],
    `These build a supabase request and never send it — thenable, not a promise:\n  ${offenders.join("\n  ")}\n` +
    `Await it, return it, assign it, or attach .then() and log the error.`);
});
