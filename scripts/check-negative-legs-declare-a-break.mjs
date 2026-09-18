#!/usr/bin/env node
/**
 * [RULE] A PURELY NEGATIVE LEG WRITTEN FROM TODAY ON MUST DECLARE ITS OWN BREAK.
 *
 *   node scripts/check-negative-legs-declare-a-break.mjs
 *
 * ══ THE RULE, AND WHY IT IS RATCHETED ═══════════════════════════════════════════════════════
 *
 * Lesson 98: a negative assertion is satisfied by the thing not existing, which is a different
 * reason from the thing being correctly prevented. A leg with a negation and NO positive clause
 * passes on a blank page, a failed load, or an unrendered room — and BREAK 1 on 2026-09-17 is the
 * case: a leg written for Adrian's own bug report was green with the fix removed, because it asserted
 * the absence of a string the correct code never produced either.
 *
 * So from the ratchet date on, such a leg must carry a `declareBreak({...})` beside it, naming what
 * to break and which leg must go red. **The ratchet exists because the alternative is 78 instant
 * failures**, and a rule that fails 78 things on the day it lands is the first rule anyone switches
 * off. Adrian: *"Not on day one — you would have 78 instant failures. Ratchet it: the failure applies
 * to legs added or modified from today."*
 *
 * THE DATE IS NOT "TODAY". It is stored in `docs/red-proof-ledger.json` when the ledger is born, so
 * it survives a context loss — recomputing it as "today" every run would exempt every leg, forever,
 * which is a rule that can never fire.
 *
 * WHETHER A LEG IS NEW IS READ FROM `git blame`, PER LINE — never from a list of exempted files. A
 * hand-maintained exemption list is the disease this repo pays for most, and it would grow every time
 * someone wanted to ship.
 *
 * ══ SCOPED ══════════════════════════════════════════════════════════════════════════════════
 *
 * "Purely negative" is measured by `negativeLegs()` in scripts/lib/redproof.mjs — ONE reader, shared
 * with audit-negative-assertions, so the count and the enforcement can never be about different sets.
 * It sees a negation in an assertion expression in a `scripts/check-*.mjs` file. It does NOT see a
 * negation hidden behind a helper the leg calls, and it does not judge whether a declared break is a
 * GOOD one — `redproof-run.mjs` answers that, by applying it.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readLedger, negativeLegs, parseBreaks, lineChangedAt } from "./lib/redproof.mjs";

const SCRIPTS = join(ROOT, "scripts");
const ledger = readLedger();
const since = ledger.ratchetSince;
if (!since) { console.error("CANNOT RUN — the ledger carries no ratchet date, so 'new' has no meaning here."); process.exit(2); }

const files = readdirSync(SCRIPTS).filter((f) => /^check-.*\.mjs$/.test(f));
let grandfathered = 0, covered = 0;
const offenders = [];

for (const f of files) {
  const src = readFileSync(join(SCRIPTS, f), "utf8");
  const legs = negativeLegs(src).filter((l) => l.purelyNegative);
  if (!legs.length) continue;
  const breaks = parseBreaks(src, f).filter((b) => !b.__broken);
  for (const l of legs) {
    const when = lineChangedAt(`scripts/${f}`, l.line);
    // An UNCOMMITTED line has no author-time and is by definition newer than any commit — it counts
    // as new rather than being waved through, which is the direction that cannot hide a regression.
    const isNew = when === null || when >= since;
    if (!isNew) { grandfathered++; continue; }
    // A break declared anywhere in the file within 30 lines of the leg is "beside" it. Not the whole
    // file: a check with one declaration at the top would otherwise cover every leg it has.
    const near = breaks.some((b) => Math.abs((b.__line || 0) - l.line) <= 30);
    if (near) { covered++; continue; }
    offenders.push({ f, line: l.line, form: l.form, when: when || "uncommitted", text: l.text });
  }
}

console.log(`RATCHET DATE: ${since} (stored in the ledger, so it survives a session)\n`);
console.log(`${grandfathered} purely-negative leg(s) predate it and are GRANDFATHERED — they are the 78`);
console.log(`counted on 2026-09-17, and failing them all at once would have made this rule the first`);
console.log(`thing anyone switched off. They are still findings; they are listed by`);
console.log(`scripts/audit-negative-assertions.mjs and fixed deliberately, ten at a time.\n`);
console.log(`${covered} purely-negative leg(s) written or modified since then DO declare a break.`);

if (offenders.length) {
  console.error(`\nFAIL — ${offenders.length} purely-negative leg(s) written or modified since ${since} declare NO break:`);
  for (const o of offenders) console.error(`  scripts/${o.f}:${o.line}  [${o.form}]  last changed ${o.when}\n      ${o.text}`);
  console.error(`\nA negation with no positive clause passes on a blank page. Either add a positive clause`);
  console.error(`(the surface rendered, AND the thing is absent) or declare the break that proves it fires.`);
  process.exit(1);
}
console.log(`\nPASS — every purely-negative leg written since ${since} declares a break aimed at it.`);
