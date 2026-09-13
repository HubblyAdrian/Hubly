#!/usr/bin/env node
/**
 * THE OPEN COST OF EVERY CHOICE WE HAVE MADE, IN ONE SCREEN.
 *
 *   node scripts/decisions-open.mjs            # every open item, newest decision first
 *   node scripts/decisions-open.mjs --all      # closed ones too, with their evidence
 *   node scripts/decisions-open.mjs --check    # exit 2 if the file is malformed (CI/self-proof)
 *
 * WHY THIS EXISTS. On 2026-08-20, commit c2ff42d switched page generation to freeform and did
 * the honest thing: it listed what it was giving up — no booking, no reviews, no map, no
 * structural editing — and it wrote down, in the same message, that "a freeform page renders
 * in an iframe, so nothing the shell wires to #hc-doc-root can reach inside it." That is the
 * fragment-link defect, foreseen a month before we found it by clicking. The list died anyway,
 * because A COMMIT MESSAGE IS WRITTEN ONCE AND READ NEVER (Lesson 50).
 *
 * Scored 2026-09-13: 7 of that commit's 11 recorded gaps were still open or partial a month on.
 *
 * A document nobody opens is what caused this, so this is the thing that gets run — not the
 * document. Same rule as Lesson 42: a rule that lives only in prose is a preference.
 *
 * Exit: 0 ok · 2 cannot run / malformed
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.env.HUBLY_DECISIONS || join(ROOT, "docs/DECISIONS.md");
const ALL = process.argv.includes("--all");
const CHECK = process.argv.includes("--check");

let src;
try { src = readFileSync(FILE, "utf8"); }
catch (e) { console.error("CANNOT RUN — no decisions record at " + FILE); process.exit(2); }

/** One pass, line by line: a `## D-xxx — title` opens a decision, `- **Date / commit:**` dates
 *  it, and every `- [ ]` / `- [x]` under it is an item. No line windows (Lesson 39). */
const decisions = [];
let cur = null;
for (const raw of src.split("\n")) {
  const line = raw.trimEnd();
  const head = /^##\s+(D-\d+)\s+—\s+(.+)$/.exec(line.trim());
  if (head) { cur = { id: head[1], title: head[2], date: null, items: [] }; decisions.push(cur); continue; }
  if (!cur) continue;
  const date = /\*\*Date \/ commit:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(line);
  if (date) { cur.date = date[1]; continue; }
  const item = /^\s*-\s*\[( |x)\]\s*(.+)$/.exec(line);
  if (item) cur.items.push({ open: item[1] === " ", text: item[2].trim() });
}

if (!decisions.length) { console.error("CANNOT RUN — no decisions parsed; the record or this parser is broken"); process.exit(2); }
const undated = decisions.filter((d) => !d.date);
const itemless = decisions.filter((d) => !d.items.length);
if (CHECK) {
  const problems = [...undated.map((d) => `${d.id} has no date`), ...itemless.map((d) => `${d.id} has no outstanding list`)];
  if (problems.length) { console.error("MALFORMED:\n  " + problems.join("\n  ")); process.exit(2); }
  console.log(`OK — ${decisions.length} decisions, all dated, all with an outstanding list.`);
  process.exit(0);
}

const openTotal = decisions.reduce((n, d) => n + d.items.filter((i) => i.open).length, 0);
const closedTotal = decisions.reduce((n, d) => n + d.items.filter((i) => !i.open).length, 0);
decisions.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || b.id.localeCompare(a.id));

console.log(`\nTHE OPEN COST OF EVERY CHOICE — ${openTotal} outstanding across ${decisions.length} decisions (${closedTotal} closed)\n`);
for (const d of decisions) {
  const open = d.items.filter((i) => i.open);
  if (!open.length && !ALL) continue;
  console.log(`${d.date || "????-??-??"}  ${d.id} — ${d.title}`);
  for (const i of open) console.log(`   ·  ${i.text}`);
  if (ALL) for (const i of d.items.filter((x) => !x.open)) console.log(`   ✓  ${i.text}`);
  console.log("");
}
if (undated.length) console.log(`(${undated.length} decision(s) carry no date — they sort last)`);
