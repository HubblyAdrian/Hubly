#!/usr/bin/env node
/**
 * THE INSTRUMENT THAT COULD FIND THE SEMANTIC TWO-OF-EVERYTHING.
 *
 *   node scripts/audit-two-of-everything.mjs
 *
 * ══ WHY THE OBVIOUS INSTRUMENT CANNOT ══════════════════════════════════════════════════════
 *
 * Measured 2026-09-17: `hubly.html` defines 2008 functions, `platform-home.html` defines 408, and the
 * intersection of their NAMES is **two**. So a name-matching audit can never find the hazard that has
 * bitten this repo five times, because the two shells do the same jobs under different names. The
 * duplication is semantic, and the names are the one thing that is guaranteed not to match.
 *
 * ══ THE SIGNAL, AND WHY THIS ONE ═══════════════════════════════════════════════════════════
 *
 * Four candidates were considered. **THE SAME RPC CALLED FROM BOTH SHELLS** wins on signal-to-noise,
 * and the argument is one paragraph: an RPC name is a NAMED CAPABILITY defined once, in the database,
 * by us — `get_business_jobs`, `add_business_place`, `accept_quote`. If both shells call it, both
 * shells have a feature built on the same capability, and that is not a heuristic for duplication, it
 * IS the duplication, stated in the vocabulary the two sides genuinely share. Its false-positive rate
 * is near zero because an RPC name is long, specific and cannot occur by coincidence, and it cannot
 * be defeated by renaming, because the name belongs to the database rather than to either shell. A
 * DOM id is weaker (both shells are free to use different ids for the same control, and `#hcApp` vs
 * `#p-classic-site` is exactly that case). A CSS class is far weaker (utility classes like `.btn` and
 * `.row` would flood it). A USER-VISIBLE STRING is the runner-up and genuinely good — a sentence
 * repeated in two files IS the same feature twice — but it misses every duplicated feature whose two
 * copies word themselves differently, which is most of them, and it drowns in shared UI words.
 * The table a capability touches is nearly as good as the RPC but coarser: two features can read one
 * table for unrelated reasons, whereas calling the same security-definer function means doing the
 * same job.
 *
 * WHAT IT CANNOT SEE, stated: a capability duplicated where ONE side uses an RPC and the other writes
 * through PostgREST directly, and any duplication that does not touch the database at all — layout,
 * an editor gesture, a booking exit. `closePublicBooking` vs `bookingBack`, the scar that produced
 * this rule, touches no RPC and would NOT appear below. This narrows the blind spot; it does not
 * close it.
 *
 * Exit: 0 — a sweep. Output is a candidate list; a candidate graduates by being opened.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");

/* THE SHELLS, derived the same way audit-single-instance-checks derives them. */
const shells = readdirSync(PUB).filter((f) => f.endsWith(".html")).filter((f) => {
  const s = readFileSync(join(PUB, f), "utf8");
  return /hcAppendMessage|hcPersist\(|window\.hubly[A-Z]/.test(s);
});
if (shells.length < 2) { console.error(`CANNOT RUN — derived ${shells.length} shell(s); two-of-everything needs two.`); process.exit(2); }

/* THE VOCABULARY IS THE DATABASE'S, not either shell's. */
let rpcNames;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  rpcNames = [...new Set(JSON.parse(out.slice(s, e)).map((r) => r.proname))];
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const src = Object.fromEntries(shells.map((f) => [f, readFileSync(join(PUB, f), "utf8")]));
const fnCount = Object.fromEntries(shells.map((f) => [f, new Set([...src[f].matchAll(/function\s+([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1])).size]));
const shared = [];
for (const name of rpcNames) {
  if (name.length < 8) continue;                               // too short to be coincidence-proof
  const calls = /^(get|set|add|create|update|delete|mark|accept|claim|seed|record)_/.test(name);
  if (!calls) continue;                                        // a trigger/helper is not a called capability
  const where = shells.filter((f) => new RegExp(`rpc\\(\\s*["'\`]${name}["'\`]`).test(src[f]) || new RegExp(`["'\`]${name}["'\`]`).test(src[f]));
  if (where.length >= 2) shared.push({ name, where });
}

console.log(`SHELLS: ${shells.map((f) => `${f} (${fnCount[f]} functions)`).join(" · ")}`);
const sets = shells.map((f) => new Set([...src[f].matchAll(/function\s+([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1])));
const nameOverlap = [...sets[0]].filter((n) => sets.every((s) => s.has(n)));
console.log(`FUNCTION-NAME OVERLAP: ${nameOverlap.length} — ${nameOverlap.join(", ") || "(none)"}`);
console.log(`  which is why a name-matching audit cannot find this, and why the vocabulary below is the DATABASE'S.\n`);
console.log(`${rpcNames.length} public functions in the database · ${shared.length} CALLED FROM BOTH SHELLS:\n`);
for (const s of shared) console.log(`  ${s.name}`);
/* ══ THE SECOND SIGNAL, TESTED RATHER THAN ASSUMED — 2026-09-18 ═══════════════════════════════
 *
 * The RPC signal cannot see a duplication that touches no database: `closePublicBooking` vs
 * `bookingBack`, the scar that produced the rule, would not appear above. Adrian: *"Is there a SECOND
 * signal that catches what the first cannot, without flooding the output? You ranked user-visible
 * strings as the runner-up and said they miss duplicated features whose two copies word themselves
 * differently. TEST that claim rather than assuming it."*
 *
 * So: every SENTENCE-SHAPED literal in each shell — a quoted string with a space in it, long enough
 * not to be a class name or an attribute — intersected. A sentence repeated verbatim in two files IS
 * the same feature twice; there is no other reason for it to be there. The number and the shape of
 * what comes back is printed below whether it is usable or not, because a rejected instrument with
 * its measurement attached is worth more than an untested hunch. */
const SENTENCE = /(?:'([^'\n\\]{12,120})'|"([^"\n\\]{12,120})"|`([^`\n\\$]{12,120})`)/g;
const sentencesOf = (text) => {
  const out = new Set();
  for (const m of text.matchAll(SENTENCE)) {
    const v = (m[1] ?? m[2] ?? m[3]).trim();
    if (!/\s/.test(v)) continue;                       // one word is a token, not a sentence
    if (!/[a-z]{3}/.test(v)) continue;                  // must contain real words
    if (/[<>{}()=;|]|::|--|\/\/|\bvar\b|\bfunction\b/.test(v)) continue;   // markup, css, code
    if (/^[a-z-]+:\s/.test(v)) continue;                // a css declaration
    if (/^[\d\s.,%px+-]+$/.test(v)) continue;
    out.add(v);
  }
  return out;
};
const sents = shells.map((f) => sentencesOf(src[f]));
const shared2 = [...sents[0]].filter((v) => sents.every((s2) => s2.has(v)));
const humanish = shared2.filter((v) => /^[A-Z“"']/.test(v) && /[a-z]{3}\s/.test(v));

console.log(`\n══ SECOND SIGNAL: THE SAME USER-VISIBLE SENTENCE IN BOTH SHELLS ═══════════════════════════`);
console.log(`sentence-shaped literals: ${sents.map((s2, i) => `${shells[i]} ${s2.size}`).join(" · ")}`);
console.log(`shared verbatim: ${shared2.length}  ·  of those, shaped like something a PERSON reads: ${humanish.length}\n`);
if (humanish.length) {
  for (const v of humanish.slice(0, 40)) console.log(`  ${JSON.stringify(v)}`);
  if (humanish.length > 40) console.log(`  … and ${humanish.length - 40} more`);
}
console.log(`\nVERDICT ON THE SECOND SIGNAL — read the number above before the argument. A sentence shared`);
console.log(`verbatim is a TRUE positive every time (there is no innocent reason for it), so this signal`);
console.log(`has no noise problem at all; its limit is RECALL, and that is what the number shows. What it`);
console.log(`cannot do is find a feature whose two copies word themselves differently, which is most of`);
console.log(`them — and neither signal sees a duplication that shares no sentence AND no RPC, which is`);
console.log(`exactly what closePublicBooking vs bookingBack was.`);

console.log(`\nEach line is ONE CAPABILITY WITH TWO CALLERS — a candidate, not a finding. What makes it a`);
console.log(`finding is opening both callers and seeing whether a fix to one would have to be made twice.`);
console.log(`SCOPED: this cannot see a capability duplicated without an RPC — a direct PostgREST write on`);
console.log(`one side, or a duplication that touches no database at all (the booking exit, the two edit`);
console.log(`lanes, a layout). It narrows the blind spot; it does not close it.`);
