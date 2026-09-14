#!/usr/bin/env node
/**
 * NO ID MAY APPEAR TWICE IN THE SERVED DOCUMENT.
 *
 * graefs-autocare's live page carried 85 duplicate ids — the owner's editor preview,
 * 45,267 bytes of it, cloned into the same document that serves his website and shipped
 * hidden to every visitor. It came first in document order, so it won every
 * `document.getElementById` and every native `#fragment` lookup on his own site.
 *
 * Two ids answering to one name is not a style violation. It is a lookup that returns the
 * wrong element silently, forever, and the next person to write `getElementById` has no
 * way to know. (It is NOT, as it turns out, the cause of the dead nav on classic pages —
 * that was tested and disproved. It is its own defect, and this check is why it cannot
 * come back.)
 *
 * SCOPE, chosen after the first version of this check over-reported 14 times:
 *
 *   IN  — ids in the authored MARKUP (outside every <script> block). Those elements are all
 *         in the document at once, always, so two of them is always wrong.
 *   OUT — ids minted inside scripts. `#ws-pe-inp` is written by 19 different builders and
 *         only ever one is mounted; counting those as duplicates is counting a FORM, not
 *         the fact (CLAUDE.md). A static file cannot tell "one at a time" from "both at
 *         once", so it does not guess.
 *   OUT — the runtime clone, which is a different mechanism with a different guard:
 *         stripPreviewCloneIds removes the id after copying it to data-ws-clone-id. That is
 *         where graefs-autocare's 85 came from, and this check cannot see it. Both halves
 *         are needed; neither covers the other, and this comment says so rather than
 *         letting a green here be read as "no duplicate ids anywhere".
 *
 *   node scripts/check-no-duplicate-ids.mjs
 *
 * Exit: 0 clean · 1 a duplicate id · 2 cannot run
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["public/hubly.html", "public/platform-home.html"];

let failed = 0;
for (const rel of FILES) {
  let html;
  try { html = readFileSync(resolve(ROOT, rel), "utf8"); }
  catch (e) { console.error(`CANNOT RUN — ${rel}: ${e.message}`); process.exit(2); }

  // Scan tags, read their id attribute.
  // Blank out every <script> body so ids minted at runtime are invisible to this scan.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => " ".repeat(m.length));

  const seen = new Map();
  for (const m of markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const attrs = m[2];
    const id = /(?:^|\s)id\s*=\s*"([^"]+)"/.exec(attrs) || /(?:^|\s)id\s*=\s*'([^']+)'/.exec(attrs);
    if (!id) continue;
    const val = id[1];
    if (val.includes("${") || val.includes("'+") || val.includes('"+')) continue;  // interpolated
    const line = markup.slice(0, m.index).split("\n").length;
    if (!seen.has(val)) seen.set(val, []);
    seen.get(val).push(line);
  }
  const dups = [...seen.entries()].filter(([, lines]) => lines.length > 1);
  console.log(`${rel.padEnd(28)} literal ids: ${seen.size}  ·  duplicated: ${dups.length}`);
  for (const [id, lines] of dups) {
    console.log(`  FAIL  #${id} appears ${lines.length}× — lines ${lines.join(", ")}`);
    failed++;
  }
}
console.log(failed ? `\n${failed} duplicate id(s). Two elements answering to one name is a silent wrong answer.` : "\nPASS — every literal id is unique in its document.");
process.exit(failed ? 1 : 0);
