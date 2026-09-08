#!/usr/bin/env node
/**
 * PHASE 1b — seed business_places from what each business ACTUALLY USES.
 *
 *   node scripts/backfill-business-places.mjs                 # dry run (default)
 *   node scripts/backfill-business-places.mjs --apply
 *   node scripts/backfill-business-places.mjs --only <slug>
 *   node scripts/backfill-business-places.mjs --restore <slug> [--apply]
 *
 * THE RULING THIS SCRIPT EXISTS TO OBEY: a kind with NO usage signal defaults to
 * KEEP, never DROP. Only take away what we can positively show is unused. If we
 * cannot write a query proving a business does not use something, the honest
 * answer is "we don't know" and we do not touch it — otherwise the backfill
 * silently removes every tab nobody got round to writing a query for, turning
 * absence of evidence into a deletion. That is the failure family running through
 * this whole week.
 *
 * So every kind lands in one of three buckets, and the loss table names all three:
 *
 *   KEEP  (used)      a signal exists and it measured > 0
 *   KEEP  (no signal) no signal exists for this kind — we cannot judge it
 *   DROP              a signal exists and it measured ZERO
 *
 * Only the third loses a tab. Round one deliberately keeps more than Adrian hoped;
 * the unmeasurable ones get a signal written later and the mechanism is live and
 * load-bearing meanwhile.
 *
 * ACCESS: goes through `supabase db query --linked`, the same admin connection used
 * all session. No service-role key is read, printed, or written anywhere — the
 * safest handling of a key is not to touch one.
 *
 * SAFETY, same discipline the image migration earned:
 *   - DRY RUN IS THE DEFAULT; --apply is required to write.
 *   - Backups are written on the DRY RUN too, so they exist before they are needed.
 *   - --restore consumes its own backup file and is tested before anything applies.
 *   - Per-business failure never abandons the rest.
 *   - It re-reads afterwards and verifies from the DATA, not from what it believes.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const arg = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const ONLY = arg('--only');
const RESTORE = arg('--restore');
const BACKUP_DIR = path.join(ROOT, 'backups', 'places-' + new Date().toISOString().slice(0, 10));

const fail = (m) => { console.error('  FAIL  ' + m); failures++; };
let failures = 0;

function sql(text) {
  const tmp = path.join(ROOT, 'node_modules', '.cache', 'places-q.sql');
  mkdirSync(path.dirname(tmp), { recursive: true });
  writeFileSync(tmp, text);
  const out = execFileSync('supabase', ['db', 'query', '--linked', '-f', tmp], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const i = out.indexOf('{');
  if (i < 0) throw new Error('no JSON in CLI output: ' + out.slice(0, 200));
  const parsed = JSON.parse(out.slice(i));
  if (parsed._tag === 'Error') throw new Error(JSON.stringify(parsed.error).slice(0, 400));
  return parsed.rows || [];
}
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

/* ── THE CATALOGUE ──────────────────────────────────────────────────────────────
 * Every kind the table allows, with the signal that decides it — or null, which
 * means "no signal exists, so KEEP and say so". `sig` names a column produced by
 * the census query below. Kinds are the rail's own data-v strings.        */
const CATALOGUE = [
  // ── tabs ────────────────────────────────────────────  signal (null = unmeasurable)
  { kind: 'store',          scope: 'tab',     sig: 'store_on' },
  { kind: 'customers',      scope: 'tab',     sig: 'customers' },
  { kind: 'jobs',           scope: 'tab',     sig: 'jobs' },
  { kind: 'leads',          scope: 'tab',     sig: 'pipeline' },
  { kind: 'pipeline',       scope: 'tab',     sig: 'pipeline' },
  { kind: 'memberships',    scope: 'tab',     sig: 'memberships' },
  { kind: 'reviews',        scope: 'tab',     sig: 'reviews' },
  { kind: 'studio',         scope: 'tab',     sig: 'studio' },
  { kind: 'photo-projects', scope: 'tab',     sig: 'photo_projects' },
  { kind: 'marketplace',    scope: 'tab',     sig: 'marketplace' },
  { kind: 'chats',          scope: 'tab',     sig: 'conversations' },
  { kind: 'calendar',       scope: 'tab',     sig: 'calendar' },
  { kind: 'apps',           scope: 'tab',     sig: 'apps' },
  // Revenue is deliberately BROAD: orders OR jobs OR bookings. A service business
  // earns without a single commerce order, and the ruling says the tie goes to keep.
  { kind: 'money',          scope: 'tab',     sig: 'revenue_any' },

  // NO SIGNAL EXISTS. There is no table and no meta key that distinguishes a
  // business using these from one that never opened them, so they are KEPT and
  // reported as unjudged. Writing a guess here would be the deletion this ruling
  // forbids — `ask_hubly_activity_feed` is NOT known to back the `activity` tab,
  // and assuming it does is exactly the kind of inference that has been wrong all
  // week. A signal can be added later; a tab removed today cannot be un-removed
  // from an owner's memory.
  { kind: 'activity',       scope: 'tab',     sig: null },
  { kind: 'growth',         scope: 'tab',     sig: null },
  { kind: 'marketing',      scope: 'tab',     sig: null },
  { kind: 'opportunities',  scope: 'tab',     sig: null },
  { kind: 'quotes',         scope: 'tab',     sig: null },
  { kind: 'reports',        scope: 'tab',     sig: null },
  { kind: 'projects',       scope: 'tab',     sig: null },

  // ── sections (SECTION_DEFS, public/hubly.html:50388) ──────────────────────
  // SECTIONS: the signal is "did they ARRANGE it", not "does it have content".
  // A section sitting in section_order is on the page today — the owner put it
  // there — so an empty one is still a section they asked for. Judging sections by
  // content alone dropped Graef's Our Story, which is in his section_order and
  // renders on his page; that is a removal of something he can see, justified by a
  // signal that was answering the wrong question. Content still counts, as an OR.
  { kind: 'portfolio',      scope: 'section', sig: 'sec_portfolio' },
  { kind: 'services',       scope: 'section', sig: 'sec_services' },
  { kind: 'about',          scope: 'section', sig: 'sec_about' },
  { kind: 'story',          scope: 'section', sig: 'sec_story' },
  { kind: 'reviews',        scope: 'section', sig: 'sec_reviews' },
];

const CENSUS = `
with m as (select id, slug, account_kind, coalesce(nullif(meta,'')::jsonb,'{}'::jsonb) j from businesses ${ONLY ? `where slug = ${lit(ONLY)}` : ''})
select m.slug, m.id::text as id, m.account_kind,
  (coalesce(((m.j->'storeOs'->'settings'->>'enabled')::boolean),false)
    or (select count(*) from commerce_products p where p.business_id=m.id) > 0)::int as store_on,
  (select count(*) from customers c where c.business_id=m.id) as customers,
  (select count(*) from jobs jj where jj.business_id=m.id) as jobs,
  jsonb_array_length(coalesce(m.j->'pipeline'->'manual','[]'::jsonb)) as pipeline,
  (jsonb_array_length(coalesce(m.j->'website'->'membershipOffers','[]'::jsonb))
    + (select count(*) from memberships mm where mm.business_id=m.id)) as memberships,
  (jsonb_array_length(coalesce(m.j->'website'->'manualReviews','[]'::jsonb))
    + (select count(*) from review_submissions r where r.business_id=m.id)) as reviews,
  jsonb_array_length(coalesce(m.j->'studioOs'->'projects','[]'::jsonb)) as studio,
  (select count(*) from photography_projects pp where pp.business_id=m.id) as photo_projects,
  (select count(*) from marketplace_providers mp where mp.business_id=m.id) as marketplace,
  ((select count(*) from chatbot_conversations cc where cc.business_id=m.id)
    + (select count(*) from business_conversations bc where bc.business_id=m.id)) as conversations,
  ((select count(*) from google_calendar_connections gc where gc.business_id=m.id)
    + (select count(*) from google_calendar_events ge where ge.business_id=m.id)) as calendar,
  (select count(*) from hubly_app_connections ha where ha.business_id=m.id) as apps,
  ((select count(*) from commerce_orders o where o.business_id=m.id)
    + (select count(*) from jobs j2 where j2.business_id=m.id)
    + (select count(*) from booking_requests br where br.business_id=m.id)) as revenue_any,
  (jsonb_array_length(coalesce(m.j->'portfolioUrls','[]'::jsonb))
    + coalesce((select sum(jsonb_array_length(coalesce(a->'urls','[]'::jsonb)))
                from jsonb_array_elements(coalesce(m.j->'website'->'galleryAlbums','[]'::jsonb)) a),0)) as portfolio,
  (jsonb_array_length(coalesce(m.j->'service_catalog'->'services','[]'::jsonb))
    + (select count(*) from services s where s.business_id=m.id)) as services,
  (length(coalesce(m.j->'website'->>'ownerBio',''))
    + length(coalesce((select about from businesses b2 where b2.id=m.id),''))) as about,
  length(coalesce(m.j->'website'->>'ourStory','')) as story,
  -- SECTION signals: arranged into the page (section_order or page.blocks) OR has
  -- content. Either is positive evidence the owner wanted the section.
  (coalesce(array_position(b3.section_order,'portfolio'),0)
    + jsonb_array_length(coalesce(m.j->'portfolioUrls','[]'::jsonb))) as sec_portfolio,
  (coalesce(array_position(b3.section_order,'services'),0)
    + jsonb_array_length(coalesce(m.j->'service_catalog'->'services','[]'::jsonb))) as sec_services,
  (coalesce(array_position(b3.section_order,'about'),0)
    + length(coalesce(m.j->'website'->>'ownerBio',''))) as sec_about,
  (coalesce(array_position(b3.section_order,'story'),0)
    + length(coalesce(m.j->'website'->>'ourStory',''))) as sec_story,
  (coalesce(array_position(b3.section_order,'reviews'),0)
    + jsonb_array_length(coalesce(m.j->'website'->'manualReviews','[]'::jsonb))) as sec_reviews
from m join businesses b3 on b3.id = m.id order by m.slug`;

function classify(row) {
  const keepUsed = [], keepUnjudged = [], drop = [];
  for (const c of CATALOGUE) {
    if (c.sig === null) { keepUnjudged.push(c); continue; }
    const v = Number(row[c.sig] || 0);
    (v > 0 ? keepUsed : drop).push(c);
  }
  return { keepUsed, keepUnjudged, drop };
}

// ── RESTORE — consumes its own backup, and is proven before anything applies ───
if (RESTORE) {
  const dirs = existsSync(path.join(ROOT, 'backups')) ? readdirSync(path.join(ROOT, 'backups')).filter((d) => d.startsWith('places-')).sort() : [];
  const dir = existsSync(BACKUP_DIR) ? BACKUP_DIR : (dirs.length ? path.join(ROOT, 'backups', dirs[dirs.length - 1]) : null);
  const file = dir && path.join(dir, `${RESTORE}.places.json`);
  if (!file || !existsSync(file)) {
    console.error(`No backup for ${RESTORE}. Looked in ${dir || '(no backups dir)'}.`);
    if (dirs.length) console.error(`Backup directories present: ${dirs.join(', ')}`);
    process.exit(1);
  }
  let prior;
  try { prior = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error(`Backup ${file} is not valid JSON (${e.message}) — refusing to act on it.`); process.exit(1); }
  const now = sql(`select kind,scope,sort_order,visible,added_by from business_places p join businesses b on b.id=p.business_id where b.slug=${lit(RESTORE)} order by scope,sort_order,kind`);
  console.log(`RESTORE ${RESTORE}\n  backup holds ${prior.rows.length} place(s); the row currently has ${now.length}`);
  if (!APPLY) { console.log('\n(DRY RUN — nothing written. Re-run with --apply.)'); process.exit(0); }
  const vals = prior.rows.map((r) => `((select id from businesses where slug=${lit(RESTORE)}),${lit(r.kind)},${lit(r.scope)},${Number(r.sort_order)},${r.visible ? 'true' : 'false'},${lit(r.added_by)})`);
  sql(`begin;
delete from business_places where business_id=(select id from businesses where slug=${lit(RESTORE)});
${vals.length ? `insert into business_places(business_id,kind,scope,sort_order,visible,added_by) values ${vals.join(',')};` : ''}
commit;
select 1 as ok`);
  const after = sql(`select kind,scope,sort_order,visible,added_by from business_places p join businesses b on b.id=p.business_id where b.slug=${lit(RESTORE)} order by scope,sort_order,kind`);
  const same = JSON.stringify(after) === JSON.stringify(prior.rows);
  console.log(same ? `  SUCCESS — the row now byte-matches the backup (${after.length} place(s)).`
                   : `  MISMATCH — restored ${after.length}, backup had ${prior.rows.length}. Investigate before anything else.`);
  process.exit(same ? 0 : 1);
}

// ── THE RUN ───────────────────────────────────────────────────────────────────
console.log(`━━ census${ONLY ? ` (--only ${ONLY})` : ''}`);
const rows = sql(CENSUS);
if (!rows.length) { console.error(ONLY ? `No business with slug "${ONLY}".` : 'No businesses returned — refusing to proceed.'); process.exit(1); }
console.log(`   ${rows.length} business(es)`);

mkdirSync(BACKUP_DIR, { recursive: true });
const lossTable = [];
let totKeepUsed = 0, totUnjudged = 0, totDrop = 0;

for (const row of rows) {
  const { keepUsed, keepUnjudged, drop } = classify(row);
  totKeepUsed += keepUsed.length; totUnjudged += keepUnjudged.length; totDrop += drop.length;
  // BACKUP FIRST, on the dry run too — before it is needed, not when it is.
  const prior = sql(`select kind,scope,sort_order,visible,added_by from business_places p where p.business_id=${lit(row.id)}::uuid order by scope,sort_order,kind`);
  writeFileSync(path.join(BACKUP_DIR, `${row.slug}.places.json`),
    JSON.stringify({ slug: row.slug, takenAt: new Date().toISOString(), rows: prior }, null, 1));
  lossTable.push({ slug: row.slug, kind: row.account_kind,
    keepUsed: keepUsed.map((c) => `${c.kind}/${c.scope}`),
    keepUnjudged: keepUnjudged.map((c) => `${c.kind}/${c.scope}`),
    drop: drop.map((c) => `${c.kind}/${c.scope}`) });

  if (!APPLY) continue;
  const grant = [...keepUsed, ...keepUnjudged];
  const vals = grant.map((c, i) => `(${lit(row.id)}::uuid,${lit(c.kind)},${lit(c.scope)},${(i + 1) * 10},true,'backfill')`);
  try {
    sql(`insert into business_places(business_id,kind,scope,sort_order,visible,added_by)
         values ${vals.join(',')}
         on conflict (business_id,kind,scope) do nothing;
         select 1 as ok`);
  } catch (e) { fail(`${row.slug}: insert failed (${String(e.message).slice(0, 120)}) — other businesses continue`); }
}

// ── THE LOSS TABLE, written whether or not anything is applied ────────────────
const md = [
  '# BACKFILL LOSS TABLE — every business, what it keeps and what it loses',
  '',
  `Generated ${new Date().toISOString()} by \`scripts/backfill-business-places.mjs\`${ONLY ? ` (--only ${ONLY})` : ''}.`,
  `**Written before \`--apply\`, committed to the repo, so the answer to "why did that tab go" is a file with a date on it.**`,
  '',
  '**A kind with no usage signal is KEPT and named as unjudged.** Only a kind whose signal',
  'measured ZERO is dropped. Absence of evidence is not a deletion.',
  '',
  `- businesses: **${rows.length}**`,
  `- KEEP (used): **${totKeepUsed}** place-decisions`,
  `- KEEP (no signal, cannot judge): **${totUnjudged}**`,
  `- DROP (signal measured zero): **${totDrop}**`,
  '',
  '| business | kind | KEEP — used | KEEP — no signal | **DROP** |',
  '| --- | --- | --- | --- | --- |',
  ...lossTable.map((r) =>
    `| \`${r.slug}\` | ${r.kind} | ${r.keepUsed.join(', ') || '—'} | ${r.keepUnjudged.join(', ')} | **${r.drop.join(', ') || '—'}** |`),
  '',
];
const lossPath = path.join(ROOT, 'docs', ONLY ? `PLACES_LOSS_TABLE_${ONLY}.md` : 'PLACES_LOSS_TABLE.md');
writeFileSync(lossPath, md.join('\n'));
console.log(`\n━━ loss table -> ${path.relative(ROOT, lossPath)}`);
console.log(`   KEEP(used) ${totKeepUsed}   KEEP(no signal) ${totUnjudged}   DROP ${totDrop}`);

if (!APPLY) { console.log('\n(DRY RUN — nothing written to business_places. Backups WERE written.)'); process.exit(failures ? 1 : 0); }

// ── VERIFY FROM THE DATA, not from what this script believes it did ───────────
const check = sql(`select count(*) n, count(distinct business_id) b from business_places${ONLY ? ` where business_id=(select id from businesses where slug=${lit(ONLY)})` : ''}`);
console.log(`\n━━ verification (re-read): ${check[0].n} place rows across ${check[0].b} business(es)`);
const expected = totKeepUsed + totUnjudged;
if (Number(check[0].n) !== expected) fail(`expected ${expected} rows, found ${check[0].n}`);
console.log(failures ? `\n${failures} failure(s).` : '\nSUCCESS — row count matches the plan.');
process.exit(failures ? 1 : 0);
