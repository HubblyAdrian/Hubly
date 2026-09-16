#!/usr/bin/env node
/**
 * ONCE WE PUT AN ADDRESS IN WRITING, IT STOPS MOVING SILENTLY.
 *
 *   node scripts/check-promise-gates-rename.mjs
 *
 * Adrian's ruling, 2026-09-16: "The promise creates the obligation. Before we put an address in
 * writing, a draft slug moves freely — nobody has been told anything. The moment we say
 * 'apollow.myhubly.app is reserved for you,' it stops being free."
 *
 * THE REASONING WAS ALREADY IN THE TRIGGER, WITH THE WRONG CONDITION ATTACHED. slug_follows_name
 * said, verbatim: "Sharing is what makes an address load-bearing, not authorship — by now someone
 * may hold the link." Correct — and it then used `owner_id is not null` (claimed) as the proxy for
 * "shared". Claiming is not when an address becomes load-bearing. Writing it down for someone is.
 *
 * MEASURED: apollo-weeds was told "apollow.myhubly.app is reserved for you" at 03:07:08 and was
 * renamed twice more inside 108 seconds, unconfirmed and unmentioned. Three turns in the whole
 * corpus named an address that is not the address today, and NONE of those three resolves.
 *
 * IT RUNS AGAINST THE DATABASE, AND IT READS WHAT IS DEPLOYED — not the migration file. A
 * migration that was written and never applied looks identical on disk to one that shipped; this
 * asks Postgres what it actually has installed.
 *
 * IT WRITES NOTHING. hubly_address_promised is a pure read, and the two gate assertions read
 * pg_get_functiondef. Calling set_business_slug for real would RENAME A BUSINESS if the gate were
 * broken, which is not a side effect a check may have.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const dir = mkdtempSync(join(tmpdir(), "promise-gate-"));
function q(sql) {
  const f = join(dir, "q.sql");
  writeFileSync(f, sql);
  const out = execFileSync("supabase", ["db", "query", "--linked", "-f", f], { encoding: "utf8", stdio: "pipe" });
  const i = out.indexOf("{");
  if (i < 0) throw new Error("no JSON in output: " + out.slice(0, 200));
  return JSON.parse(out.slice(i)).rows;
}

let rows;
try {
  rows = q(`select
      public.hubly_address_promised((select id from businesses where slug='apollo-weeds')) as apollo,
      public.hubly_address_promised((select id from businesses where slug='toms-gutters-more')) as toms,
      public.hubly_address_promised((select id from businesses where slug='bright-clear-window-care')) as bright,
      public.hubly_address_promised((select id from businesses where slug='hubly-classic-fixture')) as fixture,
      (select count(*) from businesses where owner_id is null and public.hubly_address_promised(id)) as gated,
      (select count(*) from businesses where owner_id is null and not public.hubly_address_promised(id)) as still_free;`);
} catch (e) {
  console.error("CANNOT RUN — the database could not be reached: " + String(e.message).slice(0, 200));
  process.exit(2);
}

const r = rows[0];
// ── 1-2. THE PREDICATE, EXECUTED, IN BOTH DIRECTIONS. A predicate that is true of everything
//         gates nothing, and one that is true of nothing is a gate that never fires. ─────────
say("1 every business whose promised address later died is gated",
  r.apollo === true && r.toms === true && r.bright === true,
  `apollo-weeds=${r.apollo} toms-gutters-more=${r.toms} bright-clear-window-care=${r.bright}`);
say("2 and a business we never named an address to is NOT gated",
  r.fixture === false, `hubly-classic-fixture=${r.fixture}`);
// ── 3. IT IS NARROW. A gate that catches every draft is a blanket restriction wearing a
//       ruling's clothes; this one must leave un-promised drafts free to rename. ────────────
say("3 the gate is narrow — un-promised drafts still rename freely",
  Number(r.still_free) > Number(r.gated) && Number(r.gated) > 0,
  `${r.gated} gated · ${r.still_free} still free`);

// ── 4-5. BOTH RENAME PATHS CONSULT IT, AS DEPLOYED. The trigger is the one that actually fired
//         on apollo-weeds (a name write drags the slug); setAddress is the explicit path. ────
let defs;
try {
  defs = q(`select p.proname, pg_get_functiondef(p.oid) as def
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname in ('slug_follows_name','set_business_slug');`);
} catch (e) { console.error("CANNOT RUN — " + String(e.message).slice(0, 160)); process.exit(2); }
const byName = Object.fromEntries(defs.map((d) => [d.proname, d.def]));
say("4 the name-change trigger consults the promise (this is the path apollo-weeds took)",
  /hubly_address_promised/.test(byName.slug_follows_name || ""),
  byName.slug_follows_name ? "slug_follows_name checks it" : "slug_follows_name NOT FOUND");
say("5 and the explicit address writer asks for confirmation once promised",
  /hubly_address_promised/.test(byName.set_business_slug || "")
    && /needs_confirm/.test(byName.set_business_slug || ""),
  byName.set_business_slug ? "set_business_slug gates on promised OR claimed" : "set_business_slug NOT FOUND");

// ── 6. AND THE CONFIRM STILL NAMES THE COST IN WORDS. The gate is worthless if the question it
//       forces is "are you sure?" — the owner has to be told what breaks. ───────────────────
const { readFileSync } = await import("node:fs");
const reg = readFileSync("supabase/functions/_shared/hubly_capability_registry.ts", "utf8");
say("6 the refusal tells the owner the old address stops working",
  /STOPS WORKING the moment it changes/.test(reg) && /anyone holding the old link/.test(reg),
  "the cost is stated, not 'are you sure'");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nAn address we put in writing does not move without being confirmed and explained.");
process.exit(failed ? 1 : 0);
