#!/usr/bin/env node
/**
 * NO SHELL MAY LOAD A FLOATING DEPENDENCY.
 *
 *   node scripts/check-no-floating-pin.mjs
 *
 * THE DEFECT (measured 2026-09-15): every shell loaded `@supabase/supabase-js@2` — a floating
 * MAJOR pin. Production was serving 2.116.0 while everything here was developed and tested against
 * 2.110.5. Nobody chose that difference and nothing in the repo recorded it. Any 2.x release
 * reached every owner with no deploy, no review and no test, on the code path that handles
 * sessions and tokens.
 *
 * And the bytes cannot be pinned either: jsdelivr's own response says, in the file we serve,
 * "Do NOT use SRI with dynamically generated files!" — so Subresource Integrity, the one mechanism
 * that would detect the file changing underneath us, is explicitly unavailable on that URL. An
 * exact version in the URL is therefore the ONLY control we have.
 *
 * DERIVED, NOT A LIST. This does not check "the dependencies we remember" — it enumerates every
 * external URL in every shell and demands an exact version of each one that comes from a package
 * CDN. A new shell, or a new dependency in an old shell, is covered the day it is added. That is
 * the whole point: the previous version of this problem was a hand-maintained set (Lesson 87), and
 * a hand-written list of pinned deps would be the same disease one layer up.
 *
 * WHAT COUNTS AS EXACT: `name@1.2.3`. A bare `name`, `name@2`, `name@^2.1`, `name@latest` or
 * `name@next` all fail — each of them resolves to something the repo does not record.
 *
 * Exit: 0 PASS · 1 FAIL
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// Package CDNs: hosts where the path carries a version that can float.
const PKG_CDN = /^(cdn\.jsdelivr\.net|unpkg\.com|esm\.sh|cdnjs\.cloudflare\.com|skypack\.dev|ga\.jspm\.io|cdn\.skypack\.dev)$/;
// An exact version: @1, @1.2 and @^1.2.3 are NOT exact; @1.2.3 (with optional prerelease) is.
const EXACT = /@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\/|$)/;

const shells = readdirSync(join(ROOT, "public")).filter((f) => f.endsWith(".html"));
say("0 there are shells to scan", shells.length > 0, `${shells.length} html files under public/`);

const refs = [];
for (const f of shells) {
  const src = readFileSync(join(ROOT, "public", f), "utf8");
  // Every URL on a package CDN, however it is written — a static src=, a dynamically injected
  // string, an import(). Enumerating the HOST rather than the syntax is what makes this derived:
  // a dependency added by string concatenation is still found.
  const re = /(?:https?:)?\/\/((?:cdn\.jsdelivr\.net|unpkg\.com|esm\.sh|cdnjs\.cloudflare\.com|skypack\.dev|ga\.jspm\.io|cdn\.skypack\.dev))\/([^\s"'`)]+)/g;
  let m;
  while ((m = re.exec(src))) refs.push({ file: f, host: m[1], path: m[2], line: src.slice(0, m.index).split("\n").length });
}
say("1 the scan found the dependencies we know exist", refs.length >= 4,
  `${refs.length} package-CDN references across ${new Set(refs.map((r) => r.file)).size} shell(s)`);

const floating = refs.filter((r) => !EXACT.test(r.path));
say("2 every package-CDN dependency carries an EXACT version", floating.length === 0,
  floating.length ? floating.map((r) => `${r.file}:${r.line} ${r.host}/${r.path}`).join(" | ")
                  : refs.map((r) => r.path.replace(/^npm\//, "")).filter((v, i, a) => a.indexOf(v) === i).join(", "));

// ── 3. AND THE AUTH LIBRARY'S PIN MUST MATCH WHAT WE TEST AGAINST ──────────────────────
// Pinning to a version nobody runs locally would swap unreviewed drift for a version skew we
// chose, which is not better. The pin and node_modules have to agree.
const sb = refs.filter((r) => /@supabase\/supabase-js@/.test(r.path));
say("3 the auth library is referenced and pinned in every shell that uses it", sb.length >= 3, `${sb.length} reference(s)`);
let installed = null;
try { installed = JSON.parse(readFileSync(join(ROOT, "node_modules/@supabase/supabase-js/package.json"), "utf8")).version; }
catch { /* not installed here */ }
if (installed) {
  const pinned = [...new Set(sb.map((r) => (r.path.match(/@supabase\/supabase-js@([0-9][^/\s"']*)/) || [])[1]))];
  say("4 every shell pins the SAME version", pinned.length === 1, pinned.join(" vs ") || "none found");
  say("5 and that version is the one node_modules has (dev and prod agree)", pinned[0] === installed,
    `pinned ${pinned[0]} · installed ${installed}`);
} else {
  console.log("SKIP  4-5 node_modules/@supabase/supabase-js is not installed here, so the pin cannot be compared");
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nNo shell loads a dependency whose version the repo does not record.");
process.exit(failed ? 1 : 0);
