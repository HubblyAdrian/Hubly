#!/usr/bin/env node
/**
 * COUNT THE BUSINESSES THE SEED TRIGGER MISSED.
 *
 *   node scripts/check-places-seeded.mjs
 *
 * WHY THIS EXISTS: seed_business_places() never fails a signup — if it cannot write
 * the place row it raises a warning and lets the business through. That trade is
 * right (a signup that 500s is worse than a business with the wrong rail), but a
 * `raise warning` goes to the Postgres log and nobody reads the Postgres log. A
 * fallback that keeps the system running while nothing tells anyone is the exact
 * silent-failure shape this codebase has spent two days digging out.
 *
 * So the swallow gets a counter. A business created AFTER the trigger existed, with
 * no workspace place, is a seed that quietly failed — and under fail-open it shows
 * the FULL rail rather than the minimal one, which is survivable and wrong.
 *
 * UPDATED 2026-09-09, when the backfill ran. The "parked backfill" framing is gone:
 * every CLAIMED business now has at least a floor row (55 rows, 34 businesses), and a
 * second trigger seeds on claim (after update of owner_id). What is deliberately NOT
 * seeded is the 145 UNCLAIMED drafts — a draft nobody has claimed does not need a rail,
 * and 145 rows for people who do not exist is noise. Fail-open still protects them, and
 * the claim trigger covers them the moment somebody arrives.
 *
 * So the two checks that matter now are: no CLAIMED business is missing its floor row,
 * and no business created since the trigger is missing one. Unclaimed drafts with no
 * places are correct, not a backlog.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The moment the trigger began covering new rows. Anything created after this and
// missing a workspace place is a real miss.
const TRIGGER_LIVE_FROM = '2026-09-08T03:50:00Z';

function sql(text) {
  const tmp = path.join(ROOT, 'node_modules', '.cache', 'places-check.sql');
  mkdirSync(path.dirname(tmp), { recursive: true });
  writeFileSync(tmp, text);
  const out = execFileSync('supabase', ['db', 'query', '--linked', '-f', tmp], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const i = out.indexOf('{');
  if (i < 0) throw new Error('no JSON in CLI output');
  const p = JSON.parse(out.slice(i));
  if (p._tag === 'Error') throw new Error(JSON.stringify(p.error).slice(0, 300));
  return p.rows || [];
}

let failures = 0;
const rows = sql(`
  select
    (select count(*) from pg_trigger where tgname='businesses_seed_places') as trigger_present,
    (select count(*) from businesses b
       where b.created_at >= '${TRIGGER_LIVE_FROM}'::timestamptz
         and not exists (select 1 from business_places p where p.business_id=b.id and p.scope='workspace')) as missed_since_trigger,
    (select count(*) from businesses b where b.created_at >= '${TRIGGER_LIVE_FROM}'::timestamptz) as created_since_trigger,
    (select count(*) from businesses b
       where b.created_at < '${TRIGGER_LIVE_FROM}'::timestamptz
         and not exists (select 1 from business_places p where p.business_id=b.id and p.scope='workspace')) as pre_trigger_unseeded,
    (select count(*) from businesses b
       where b.owner_id is not null
         and not exists (select 1 from business_places p where p.business_id=b.id and p.scope='workspace')) as claimed_without_floor,
    (select count(*) from businesses b where b.owner_id is null
         and not exists (select 1 from business_places p where p.business_id=b.id and p.scope='workspace')) as unclaimed_unseeded,
    (select count(*) from pg_trigger where tgname='businesses_seed_places_on_claim') as claim_trigger_present`);
const r = rows[0] || {};

if (Number(r.trigger_present) !== 1) {
  console.error('FAIL  businesses_seed_places trigger is MISSING — every new business is created without places.');
  failures++;
} else {
  console.log('seed trigger present                       : yes');
}
console.log(`businesses created since the trigger      : ${r.created_since_trigger}`);
console.log(`  of those, MISSING a workspace place     : ${r.missed_since_trigger}`);
console.log(`unclaimed drafts with no places           : ${r.unclaimed_unseeded}  (correct — a draft nobody has claimed does not need a rail)`);
console.log(`created before the trigger, still unseeded : ${r.pre_trigger_unseeded}`);
if (Number(r.claim_trigger_present) !== 1) {
  console.error('FAIL  businesses_seed_places_on_claim is MISSING — claiming a draft would not seed it,');
  console.error('      so every owner arriving on an existing draft falls open to the full rail.');
  failures++;
} else {
  console.log('claim-time seed trigger present            : yes');
}
if (Number(r.claimed_without_floor) > 0) {
  console.error(`FAIL  ${r.claimed_without_floor} CLAIMED business(es) have no workspace place at all.`);
  console.error('      The floor is what lets a rail respond to anything: without a row, store and jobs');
  console.error('      stay gated behind hcPlacesKnown() and the earning rule is invisible for them.');
  failures++;
} else {
  console.log('claimed businesses missing the floor      : 0');
}

if (Number(r.missed_since_trigger) > 0) {
  console.error(`\nFAIL  ${r.missed_since_trigger} business(es) created after the seed trigger have no workspace place.`);
  console.error('      The trigger swallowed a failure. Each of these shows the FULL rail instead of the minimal one.');
  console.error('      The Postgres log has a warning naming the business id; this count is the thing anyone actually sees.');
  failures++;
}

if (failures) { console.error(`\n${failures} failure(s).`); process.exit(1); }
console.log('\nPASS — every business created since the trigger has its workspace place.');
