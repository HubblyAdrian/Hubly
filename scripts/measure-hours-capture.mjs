#!/usr/bin/env node
/**
 * WHAT DOES THE HOURS GAP ACTUALLY COST? — the extractor, measured rather than asserted.
 *
 *   node scripts/measure-hours-capture.mjs
 *
 * `business.setHours` has two of its three doors (talk · do-it-yourself) and the model is told
 * never to invent a time. That is the WRITE side and it is in good shape. This measures the
 * side nobody has: **when an owner says their hours in conversation, does the record end up
 * holding them?**
 *
 * THE FORM, NAMED, BECAUSE A HEURISTIC COUNTS A FORM AND NOT A FACT (CLAUDE.md). A message is
 * counted as POSSIBLY stating hours if it matches any of: a clock time (`8`, `8am`, `8:30 pm`),
 * a range (`9-5`, `9 to 5`), a weekday or weekend word, or one of the words we have already been
 * burned by — closed, hours, open, appointment, `call for`. The hours detector's last miss was
 * exactly this class: it matched formatted times and missed "Closed", "Call for hours", "open
 * daily". This list is deliberately over-generous: over-counting the denominator UNDERSTATES the
 * capture rate, which is the safe direction for a number that argues for building something.
 *
 * TWO STORES, BOTH COUNTED (SETTLED #2): `settings_business_hours` rows, and
 * `businesses.meta->'hours'`. A business with either is counted as captured.
 *
 * Read-only. Exit: 0 · 2 cannot run.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rateLine, subsetLine, withoutFixtures, loadKinds } from "./lib/kind-split.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  const i = out.indexOf('"rows":'); if (i < 0) return [];
  let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
}

const FORM = "(\\\\m\\\\d{1,2}\\\\s*(:\\\\d{2})?\\\\s*(am|pm)\\\\M)|(\\\\m\\\\d{1,2}\\\\s*(-|–|to)\\\\s*\\\\d{1,2}\\\\M)|(\\\\mmon|tues|tue|wed|thur|thu|fri|sat|sun|weekday|weekend)|(\\\\mclosed?\\\\M)|(\\\\mhours?\\\\M)|(\\\\mopen\\\\M)|(appointment)|(call for)";

let rows;
try {
  rows = sql(`
    with said as (
      select business_id,
             count(*) filter (where role = 'user') as user_msgs,
             bool_or(role = 'user'      and content::text ~* '${FORM}') as owner_said,
             bool_or(role = 'assistant' and content::text ~* '\\\\mhours?\\\\M')   as hubly_asked
      from business_conversations group by business_id
    ),
    have as (
      select b.id, b.slug, b.account_kind,
             (exists (select 1 from settings_business_hours h where h.business_id = b.id)) as rows_store,
             (jsonb_typeof(nullif((b.meta::jsonb)->'hours','null'::jsonb)) = 'object'
              and (b.meta::jsonb)->'hours' <> '{}'::jsonb) as meta_store
      from businesses b
    )
    select h.slug, h.account_kind, coalesce(s.user_msgs,0) as user_msgs,
           coalesce(s.owner_said,false) as owner_said,
           coalesce(s.hubly_asked,false) as hubly_asked, h.rows_store, h.meta_store
    from have h left join said s on s.business_id = h.id
    order by h.slug`);
} catch (e) { console.error("CANNOT RUN — database unreachable: " + String(e.message).slice(0, 140)); process.exit(2); }

const kinds = loadKinds();
const everything = withoutFixtures(rows);
const captured = (r) => r.rows_store || r.meta_store;
// THE DENOMINATOR IS BUSINESSES WITH A TRANSCRIPT. A business that never said anything cannot
// have had a statement missed, and including it would make the extractor look worse than it is
// while telling us nothing. The ones outside are reported on their own line, because hours
// arriving WITHOUT a conversation is its own fact about where hours come from.
const all = everything.filter((r) => r.user_msgs > 0);
const noConvo = everything.filter((r) => r.user_msgs === 0);
const said = all.filter((r) => r.owner_said);
const saidAndCaptured = said.filter(captured);
const saidAsked = said.filter((r) => r.hubly_asked);
const saidUnasked = said.filter((r) => !r.hubly_asked);

console.log(`\nbusinesses in the corpus: ${everything.length}  ·  with at least one owner message: ${all.length}  ·  with none: ${noConvo.length}`);
console.log(`  hours in the record with NO conversation at all: ${noConvo.filter(captured).length} (imported, generated, or entered — not extracted)`);
console.log("  " + rateLine("businesses whose owner MIGHT have stated hours (the form above)", said.length, all, kinds));
console.log("  " + rateLine("of those, hours actually in the record (either store)", saidAndCaptured.length, said, kinds));
console.log("  " + subsetLine("the misses", said.filter((r) => !captured(r)), kinds));
console.log(`\n  split by whether Hubly raised hours at all in that conversation:`);
if (saidAsked.length)   console.log("    " + rateLine("captured where Hubly mentioned hours", saidAsked.filter(captured).length, saidAsked, kinds));
if (saidUnasked.length) console.log("    " + rateLine("captured where it never came up from Hubly", saidUnasked.filter(captured).length, saidUnasked, kinds));
console.log(`\n  store split among the captured: rows only ${all.filter((r) => r.rows_store && !r.meta_store).length} · meta only ${all.filter((r) => r.meta_store && !r.rows_store).length} · both ${all.filter((r) => r.rows_store && r.meta_store).length}`);

const marketMisses = said.filter((r) => !captured(r) && kinds.get(r.slug) === "market");
if (marketMisses.length) {
  console.log(`\n  MARKET businesses in the miss set (${marketMisses.length}): ${marketMisses.map((r) => r.slug).join(", ")}`);
}
console.log(`\nThe number above counts a FORM, not a fact: a business is in the denominator because a message\nLOOKED like it might carry hours. Read it as a ceiling on what was missed, not a count of it.`);
process.exit(0);
