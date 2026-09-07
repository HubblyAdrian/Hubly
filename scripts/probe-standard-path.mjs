#!/usr/bin/env node
/**
 * WHO IS ALREADY ON THE STANDARD PATH? — read-only census.
 *
 * Graef's acceptance criterion is "the same display as the others". Before anyone
 * converts him TO that, we have to know that "the others" exist — and which state
 * they are actually in. This counts it instead of assuming it.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/probe-standard-path.mjs
 *
 * READ-ONLY. GETs only; there is no write path in this file. Never prints a key.
 *
 * THE THREE STATES a business can be in, and why the third is the target:
 *
 *   1. NO business_documents row  -> the legacy archetype renderer.
 *      Every website.* AI action has nothing to patch.  <- Graef is here.
 *   2. Row with format 'ast'      -> the AST renderer.
 *      patchDocument works; the other SIX helpers return not_freeform.
 *   3. Row with format 'html'     -> freeform.
 *      applyDirectFreeformEdit, applyOwnerStyleEdit, applyOwnerSectionMove,
 *      applyOwnerNodeMove, applyOwnerNodeDelete, applyOwnerDesignEdit all work;
 *      patchDocument does not.
 *
 * There is no state in which ALL SEVEN work — so "fully green" as the coverage
 * matrix defines it is not reachable today for anybody. This script measures how
 * many businesses sit in each state so the target is chosen from data.
 *
 * It also reports, per business, the two splits that decide whether a conversion
 * is even expressible: services in the `services` TABLE vs in meta.service_catalog,
 * and whether meta carries the website content the archetype renderer draws from.
 */
import { readFileSync } from 'node:fs';

const URL_ = 'https://rtwxxkxpkqdrhclkozma.supabase.co';
const SRK = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!SRK) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set. Export it (read -rs, nothing on a command line) and re-run.');
  process.exit(1);
}
const H = { apikey: SRK, Authorization: `Bearer ${SRK}` };
const get = async (p, q) => {
  const u = new URL(URL_ + p);
  for (const [k, v] of Object.entries(q || {})) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: H });
  if (!r.ok) { console.error(`FAILED ${p}: ${r.status} ${(await r.text()).slice(0, 160)}`); process.exit(1); }
  return r.json();
};

const biz = await get('/rest/v1/businesses', {
  select: 'id,slug,name,account_kind,tier,site_mode,owner_id,meta', order: 'created_at.asc',
});
const docs = await get('/rest/v1/business_documents', { select: 'business_id,tag,format,version' });
const svc = await get('/rest/v1/services', { select: 'business_id' });

const docByBiz = new Map();
for (const d of docs) {
  if (d.tag !== 'website') continue;
  const cur = docByBiz.get(d.business_id);
  if (!cur || d.version > cur.version) docByBiz.set(d.business_id, d);
}
const svcCount = new Map();
for (const s of svc) svcCount.set(s.business_id, (svcCount.get(s.business_id) || 0) + 1);

const rows = biz.map((b) => {
  let m = {}; try { m = typeof b.meta === 'string' ? JSON.parse(b.meta) : (b.meta || {}); } catch { m = {}; }
  const d = docByBiz.get(b.id);
  const state = !d ? 'NO_DOC' : d.format === 'html' ? 'FREEFORM' : 'AST';
  const cat = ((m.service_catalog || {}).services || []).length;
  const w = m.website || {};
  const owned = ['whyChooseUs', 'trustStats', 'membershipOffers', 'manualReviews', 'faq', 'galleryAlbums']
    .reduce((a, k) => a + (Array.isArray(w[k]) ? w[k].length : 0), 0);
  return {
    slug: b.slug, kind: b.account_kind || '?', tier: b.tier || '?', siteMode: b.site_mode || '?',
    claimed: !!b.owner_id, state, docVersion: d ? d.version : null,
    svcTable: svcCount.get(b.id) || 0, svcMeta: cat, ownedItems: owned, metaBytes: (typeof b.meta === 'string' ? b.meta : JSON.stringify(b.meta || {})).length,
  };
});

const tally = (f) => rows.reduce((a, r) => { const k = f(r); a[k] = (a[k] || 0) + 1; return a; }, {});
const market = rows.filter((r) => r.kind === 'market');

console.log(`━━ ${rows.length} businesses  (market ${market.length}, test ${rows.filter(r=>r.kind==='test').length}, internal ${rows.filter(r=>r.kind==='internal').length}, unset ${rows.filter(r=>!['market','test','internal'].includes(r.kind)).length})\n`);
console.log('RENDERER STATE — all businesses :', JSON.stringify(tally((r) => r.state)));
console.log('RENDERER STATE — MARKET only    :', JSON.stringify(market.reduce((a, r) => { a[r.state] = (a[r.state] || 0) + 1; return a; }, {})));
console.log('site_mode column                :', JSON.stringify(tally((r) => r.siteMode)), ' <- reminder: NOTHING reads this column');
console.log('\nSERVICES — where they actually live (market only):');
const both = market.filter((r) => r.svcTable > 0 && r.svcMeta > 0).length;
const tblOnly = market.filter((r) => r.svcTable > 0 && r.svcMeta === 0).length;
const metaOnly = market.filter((r) => r.svcTable === 0 && r.svcMeta > 0).length;
const neither = market.filter((r) => r.svcTable === 0 && r.svcMeta === 0).length;
console.log(`  table only ${tblOnly}   meta only ${metaOnly}   BOTH ${both}   neither ${neither}   (denominator: ${market.length} market)`);
console.log('  meta-only is the #54 shape: the page renders services the editor and the AI both address in an empty table.');

console.log('\n━━ MARKET businesses with hand-entered content, richest first');
console.log('  slug                       state      docV  svcTbl  svcMeta  owned  metaKB');
for (const r of market.filter((x) => x.ownedItems > 0 || x.svcMeta > 0).sort((a, b) => b.ownedItems - a.ownedItems).slice(0, 20)) {
  console.log(`  ${r.slug.padEnd(26)} ${r.state.padEnd(9)} ${String(r.docVersion ?? '-').padStart(4)} ${String(r.svcTable).padStart(7)} ${String(r.svcMeta).padStart(8)} ${String(r.ownedItems).padStart(6)} ${(r.metaBytes / 1024).toFixed(1).padStart(7)}`);
}

const green = market.filter((r) => r.state === 'FREEFORM' && r.svcTable > 0 && r.ownedItems > 0);
console.log(`\n━━ CANDIDATE "already good" businesses (market, FREEFORM doc, services in the TABLE, some hand-entered content): ${green.length}`);
if (green.length) for (const r of green) console.log(`   ${r.slug}  (doc v${r.docVersion}, ${r.svcTable} services, ${r.ownedItems} items)`);
else console.log('   NONE. The target state does not exist in the corpus — it has to be BUILT before anyone is converted to it.');
console.log('\nNOTE: even a FREEFORM business is not "all green" by the coverage matrix — patchDocument needs ast,');
console.log('and the editor-only content types (why-cards, trust pills, memberships, reviews, FAQ, gallery) have no AI action in ANY state.');
