#!/usr/bin/env node
/**
 * [RULE] A ROOT-LEVEL SCRIPT UNDER public/ IS SERVED AS A SCRIPT — DERIVED, NOT LISTED.
 *
 *   node scripts/check-root-scripts-are-served.mjs
 *
 * WHAT HAPPENED, 2026-09-16. `api/router.js` served root-level scripts from a hand-written list of
 * three: `/website-ast.js`, `/landing-intent.js`, `/hubly-session.js`. `public/contact-pick.js`
 * shipped, was not on the list, and the catch-all answered it with **hubly.html** — 3 MB of HTML with
 * an `application/javascript` expectation.
 *
 * **IT DOES NOT 404.** The browser loads a document as a script, the parse fails, and whatever the
 * script defined is silently undefined. `HublyContactPick` was missing in BOTH shells — including
 * `hubly.html`'s own `pickContactInto`, which had just been changed to delegate to it. **A working
 * feature broken by a file that deployed and did not serve.**
 *
 * THIS IS THE HAND-MAINTAINED-SET DISEASE IN A ROUTER. `fs.existsSync` + `isFile()` already decide
 * whether a path is real, so the allowlist added nothing but the chance to forget — and forgetting is
 * invisible, which is what makes it expensive.
 *
 * THE CHECK IS DERIVED TOO: it reads every root-level `.js` in `public/` off the DISK and asserts the
 * router would serve each one. Adding a script makes it green by itself; adding one the router cannot
 * serve makes it red. No list here either.
 *
 * [RULE], not [SHAPE]: the legs are "every script on disk is servable" and "nothing outside public/
 * is", never a count of scripts.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { codeOf } from "./lib/absence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const scripts = readdirSync(PUBLIC).filter((f) => f.endsWith(".js") &&
  statSync(join(PUBLIC, f)).isFile());
if (!scripts.length) {
  console.error("CANNOT RUN — no root-level scripts found in public/. That is a reader failure, not an");
  console.error("  absence: refusing to report 'all served' off a listing that found nothing.");
  process.exit(2);
}

const router = readFileSync(join(ROOT, "api/router.js"), "utf8");
const code = codeOf(router);

// THE ROUTER'S OWN TEST, EXTRACTED AND RUN. Not a re-implementation of it: the regex is read out of
// the file and applied, so a change to the pattern changes what this check asserts.
// THE TWO FORMS ARE READ INDEPENDENTLY, and that ordering is the whole point of this block.
//
// A check that needed the PATTERN before it could say anything reported CANNOT RUN when the router was
// reverted to a list — and a list is the defect, so "cannot run" is the wrong answer: it is not red,
// and a red is what a broken router must produce. The list form is detectable on its own, so it is
// asserted on its own, first.
const listForm = /urlPath === '\/[A-Za-z0-9._-]+\.js'/.test(code);
// ══ EXTRACTING A REGEX LITERAL NEEDS A SCANNER, NOT A REGEX ═══════════════════════════════════
//
// This was `/(\/(?:[^/\\\n]|\\.)+\/)\.test\(urlPath\)/`, which stops at the first unescaped `/`.
// On 2026-09-18 the router's pattern was widened from `.js` to every extension and became
// `/^\/[^/]*\.[^/.]+$/` — a `/` inside a CHARACTER CLASS, which needs no escape and is not a
// delimiter. The extractor truncated it, applied the fragment, and reported that the router "cannot
// serve" five scripts it demonstrably does serve — /status-words.js returns its own bytes in
// production, verified. A [SHAPE] leg going red because the shape moved is not an alarm; the leg is
// what is wrong, and undoing the improvement to satisfy it would have been the real defect
// (CLAUDE.md on [RULE] vs [SHAPE]).
//
// So the literal is scanned: inside `[...]` a `/` is a character, outside it is the delimiter.
const extractRegexLiteral = (src) => {
  const at = src.indexOf(".test(urlPath)");
  if (at < 0) return null;
  // walk back from `.test(` to the `/` that closes the literal, then back to the one that opens it
  let end = src.lastIndexOf("/", at);
  if (end < 0) return null;
  let i = end - 1, inClass = false, esc = false;
  const chars = [];
  for (; i >= 0; i--) {
    const c = src[i];
    chars.push(c);
    if (esc) { esc = false; continue; }
    if (src[i - 1] === "\\") { esc = true; continue; }
    if (c === "]") { inClass = true; continue; }
    if (c === "[") { inClass = false; continue; }
    if (c === "/" && !inClass) return "/" + chars.reverse().slice(1).join("") + "/";
    if (c === "\n") return null;
  }
  return null;
};
const extracted = extractRegexLiteral(code);
const m = extracted ? [extracted, extracted] : null;

say("1 the router decides by a PATTERN, not by a list of filenames",
    !listForm && !!m, listForm ? "a filename equality test is back in api/router.js" : (m ? m[1] : "no pattern found"));

// ABSENT IS NOT BROKEN — but only once leg 1 has had its say. If there is no pattern AND no list, this
// check genuinely cannot measure how the router decides, and it says so instead of guessing.
if (!m) {
  if (!listForm) {
    console.error("\nCANNOT RUN — could not find how api/router.js decides on root scripts (no pattern, no list).");
    console.error("  That is a reader failure on our side. Refusing to report the remaining legs off it.");
    process.exit(2);
  }
  console.log("\n(the remaining legs need a pattern to test; leg 1 above is the failure)\n");
  process.exit(1);
}
let pat = null;
try { pat = new RegExp(m[1].slice(1, -1)); } catch (e) { pat = null; }
if (!pat) {
  console.error("CANNOT RUN — the router's pattern would not compile here: " + m[1]);
  process.exit(2);
}

const unserved = scripts.filter((f) => !pat.test("/" + f));
say(`2 every one of the ${scripts.length} root scripts in public/ would be served as a script`,
    unserved.length === 0,
    unserved.length ? `NOT SERVED: ${unserved.join(", ")}` : scripts.join(", "));

// ── AND NOTHING OUTSIDE public/ IS REACHABLE ──────────────────────────────────────────────
const escapes = ["/../package.json", "/../../etc/passwd", "/a/b.js", "//evil.js", "/..%2Fx.js"];
say("3 no traversal or nested path matches the pattern — a root script has no slash after the first",
    escapes.every((u) => !pat.test(u)),
    escapes.filter((u) => pat.test(u)).join(", ") || "none match");
say("4 and the router verifies the resolved path is inside public/ regardless of the pattern",
    /startsWith\(publicRoot \+ path\.sep\)/.test(code),
    "resolved-path prefix guard present");

// ── THE SHELLS' OWN <script src> TAGS MUST ALL BE SERVABLE ───────────────────────────────
// A tag pointing at a path the router cannot serve is the defect this check exists for, and the
// shells are where such a tag actually appears.
const shells = ["public/hubly.html", "public/platform-home.html"];
const bad = [];
for (const sh of shells) {
  const html = readFileSync(join(ROOT, sh), "utf8");
  for (const tag of html.matchAll(/<script[^>]*\ssrc="(\/[^"]+)"/g)) {
    const src = tag[1].split("?")[0];
    if (/^https?:/.test(src)) continue;
    const onDisk = existsSync(join(PUBLIC, src.replace(/^\//, "")));
    const routable = /^\/(themes|layouts|assets|business-blueprints|booking-frames|booking-wizard|smart-quote|journey-os)\//.test(src) ||
                     pat.test(src);
    if (onDisk && !routable) bad.push(`${sh} -> ${src} (on disk, router cannot serve it)`);
  }
}
say("5 every local <script src> in either shell is on a path the router can actually serve",
    bad.length === 0, bad.length ? bad.join(" · ") : "all shell scripts routable");

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — a script that ships is a script that serves.\n");
process.exit(failed ? 1 : 0);
