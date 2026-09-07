#!/usr/bin/env node
/**
 * EXPORT ONE BUSINESS, COMPLETELY — a snapshot taken BEFORE anyone needs it.
 *
 * WHY THIS EXISTS
 *
 * Graef's AutoCare is the one real owner who has put sustained work into his site,
 * and the question on the table is whether a new structure can be built from what
 * he has already entered rather than making him start over. That question cannot be
 * answered from a summary — it needs an itemised list of every piece of content he
 * owns and where it currently sits. And the snapshot has to exist before the
 * planning goes any further, on the same discipline as the migration backups: a
 * backup taken when you realise you need it is not a backup.
 *
 *   node scripts/export-business-snapshot.mjs --slug graefs-autocare
 *
 * READ-ONLY BY CONSTRUCTION. It issues GETs only; there is no write path in this
 * file. It never prints a key.
 *
 * TWO CREDENTIALS, AND IT IS HONEST ABOUT WHICH IT HAD
 *
 *   - the PUBLISHABLE key (always available, read from public/journey-os/) reaches
 *     the two public RPCs and whatever RLS lets anon read.
 *   - SUPABASE_SERVICE_ROLE_KEY (from the environment, if Adrian exported it)
 *     reaches everything else — bookings, customers, jobs, memories, storage.
 *
 * Every table lands in the manifest either with a row count or with the reason it
 * could not be read, and the header says which credential was in play. An export
 * that silently skipped the owner's bookings would be the same defect as any other
 * unearned green — so a denial is recorded as a DENIAL, never as "0 rows".
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const SLUG = argv.includes('--slug') ? argv[argv.indexOf('--slug') + 1] : 'graefs-autocare';
const URL_ = 'https://rtwxxkxpkqdrhclkozma.supabase.co';

// ── the publishable key, lifted from the one file that owns it. Never printed. ──
function publishableKey() {
  const src = readFileSync(path.join(ROOT, 'public/journey-os/hubly-public-key.js'), 'utf8');
  const m = src.match(/HUBLY_PUBLISHABLE_KEY\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('could not read the publishable key from public/journey-os/hubly-public-key.js');
  return m[1];
}
const ANON = publishableKey();
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KEY = SRK || ANON;
const CRED = SRK ? 'service-role' : 'publishable (anon)';

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
async function get(pathname, params) {
  const u = new URL(URL_ + pathname);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: H });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}
async function rpc(name, args) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(ROOT, 'exports', `${SLUG}-${stamp}`);
mkdirSync(OUT, { recursive: true });

const manifest = { slug: SLUG, takenAt: new Date().toISOString(), credential: CRED, tables: {}, notes: [] };
const write = (name, obj) => {
  const p = path.join(OUT, name);
  writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  return { file: name, bytes: (typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)).length };
};

console.log(`━━ export ${SLUG}   credential: ${CRED}`);
if (!SRK) console.log('   NOTE: no SUPABASE_SERVICE_ROLE_KEY in the environment — RLS-protected tables will record as DENIED, not as empty.\n');

// ── 1. the business row, whole ────────────────────────────────────────────────
const biz = await rpc('get_public_business', { p_slug: SLUG });
if (!biz.ok || !biz.body) { console.error(`FATAL: get_public_business failed (${biz.status})`); process.exit(1); }
const row = Array.isArray(biz.body) ? biz.body[0] : biz.body;
if (!row || !row.id) { console.error('FATAL: no business row returned'); process.exit(1); }
const BID = row.id;
const w1 = write('01-businesses-row.json', row);
console.log(`   businesses row            ${String(w1.bytes).padStart(9)} bytes  (${Object.keys(row).length} columns)`);
manifest.businessId = BID;
manifest.tables['businesses'] = { rows: 1, columns: Object.keys(row).length, file: w1.file };

// ── 2. the rendered website document(s) ───────────────────────────────────────
const docs = {};
for (const tag of ['website', 'booking', 'store', 'profile', 'marketplace']) {
  const d = await rpc('get_public_business_document', { p_slug: SLUG, p_tag: tag });
  const got = Array.isArray(d.body) ? d.body[0] : null;
  if (got && got.rendered_html) {
    docs[tag] = { version: got.version, bytes: got.rendered_html.length };
    write(`02-document-${tag}.html`, got.rendered_html);
    console.log(`   document '${tag}'`.padEnd(29) + `${String(got.rendered_html.length).padStart(9)} bytes  v${got.version}`);
  }
}
manifest.tables['business_documents'] = { byTag: docs, note: 'read through get_public_business_document (latest version per tag)' };

// ── 3. every related table ────────────────────────────────────────────────────
// The live OpenAPI spec would be the right source for this list, but PostgREST
// serves it only to a SECRET key ("Only secret API keys can be used for this
// endpoint"), so under the publishable credential we fall back to the list below.
// A hand-written list is exactly how an inventory silently omits the thing that
// mattered — so when a table is added, it must be added here too, and the manifest
// says which source the list came from.
const FALLBACK_TABLES = [
  'services', 'booking_requests', 'customers', 'jobs', 'memberships', 'review_submissions',
  'business_documents', 'business_memories', 'business_conversations', 'business_timeline_events',
  'business_dna', 'business_table_config', 'chatbot_conversations', 'commerce_products',
  'commerce_orders', 'commerce_order_items', 'commerce_store_settings', 'commerce_carts',
  'commerce_collections', 'commerce_discounts', 'studio_projects', 'studio_assets',
  'studio_brand_kit', 'studio_social_accounts', 'photography_projects', 'marketplace_providers',
  'marketplace_bookings', 'marketplace_requests', 'marketplace_conversations',
  'notification_deliveries', 'page_loads', 'placed_images', 'recurring_schedules',
  'settings_business', 'settings_business_hours', 'settings_branding', 'settings_notifications',
  'settings_integrations', 'stripe_connect_accounts', 'hubly_conversation_memories',
  'website_pages', 'draft_claims', 'google_calendar_connections', 'google_calendar_events',
  'ask_hubly_conversations', 'ask_hubly_messages', 'ask_hubly_activity_feed', 'workspace_memories',
  'portal_access_tokens', 'document_build_jobs', 'rebuild_outcome_events', 'capture_miss_events',
  'price_extraction_miss_events', 'hubly_app_connections', 'adobe_lightroom_connections',
];
const spec = await get('/rest/v1/', {});
const defs = (spec.body && (spec.body.definitions || spec.body.components?.schemas)) || {};
const fromSpec = Object.keys(defs).length > 0;
const tables = fromSpec
  ? Object.keys(defs).filter((t) => Object.keys(defs[t].properties || {}).includes('business_id')).sort()
  : FALLBACK_TABLES.slice().sort();
manifest.tableListSource = fromSpec
  ? `live OpenAPI spec (${tables.length} tables carry business_id)`
  : `HAND-MAINTAINED FALLBACK LIST (${tables.length}) — the OpenAPI spec needs a secret key, so a table absent from this list is absent from this export`;
manifest.notes.push(manifest.tableListSource);
console.log(`\n━━ related tables — ${manifest.tableListSource}`);

const linked = [], denied = [], zero = [], missing = [];
for (const t of tables) {
  if (t === 'businesses') continue;
  const r = await get(`/rest/v1/${t}`, { select: '*', business_id: `eq.${BID}` });
  const msg = (r.body && r.body.message) ? String(r.body.message) : '';
  if (r.status === 404 || /does not exist|schema cache/i.test(msg)) {
    missing.push({ table: t, reason: msg.slice(0, 90) });
    manifest.tables[t] = { NOT_QUERYABLE: true, status: r.status, reason: msg.slice(0, 200) };
    continue;
  }
  if (!r.ok) {
    denied.push({ table: t, status: r.status, reason: msg.slice(0, 90) });
    manifest.tables[t] = { DENIED: true, status: r.status, reason: msg.slice(0, 200) };
    continue;
  }
  const rows = Array.isArray(r.body) ? r.body : [];
  if (!rows.length) {
    // ── THE MOST IMPORTANT LINE IN THIS FILE ──────────────────────────────────
    // An empty array is NOT proof of zero rows. supabase-js/PostgREST return
    // {data: []} for "RLS filtered everything out" exactly as they do for "the
    // table is empty", and under the publishable credential this export has no
    // owner claim on any of his data — so almost every one of these would be a
    // silent lie recorded as a fact. Only the service role can distinguish them.
    const verdict = SRK ? { rows: 0, meaning: 'genuinely empty (service role sees all rows)' }
                        : { rows: 0, UNKNOWN: true, meaning: 'EMPTY OR RLS-FILTERED — this credential cannot tell the difference' };
    zero.push({ table: t, unknown: !SRK });
    manifest.tables[t] = verdict;
    continue;
  }
  const f = write(`03-${t}.json`, rows);
  linked.push({ table: t, rows: rows.length, bytes: f.bytes });
  manifest.tables[t] = { rows: rows.length, columns: Object.keys(rows[0]).length, file: f.file };
}

for (const l of linked) console.log(`   ${l.table.padEnd(34)} ${String(l.rows).padStart(4)} rows  ${String(l.bytes).padStart(9)} bytes`);
if (!linked.length) console.log('   (no table returned a row to this credential)');
console.log(SRK
  ? `\n   ${zero.length} table(s) genuinely held 0 rows.`
  : `\n   ${zero.length} table(s) returned an empty array — which under the publishable key means EMPTY OR RLS-FILTERED, indistinguishable. Recorded as UNKNOWN, never as 0.`);
if (missing.length) console.log(`   ${missing.length} table(s) are not queryable by business_id (no such table, or no such column).`);
if (denied.length) {
  console.log(`\n   ${denied.length} table(s) COULD NOT BE READ with the ${CRED} credential:`);
  for (const d of denied) console.log(`     ${d.table.padEnd(34)} ${d.status}  ${d.reason}`.slice(0, 150));
  console.log('   Recorded as DENIED in the manifest, never as empty.');
}

manifest.summary = {
  tablesWithRows: linked.length, totalRelatedRows: linked.reduce((a, l) => a + l.rows, 0),
  tablesZeroOrFiltered: zero.length, tablesDenied: denied.length, tablesNotQueryable: missing.length,
  zeroOrFiltered: zero.map((z) => z.table), deniedTables: denied.map((d) => d.table),
  notQueryable: missing.map((z) => z.table),
  COMPLETE: Boolean(SRK),
  completenessNote: SRK
    ? 'Service role: every related table was readable, so a 0 means 0.'
    : 'PUBLISHABLE KEY ONLY. This export is COMPLETE for the businesses row and the public document, and INCOMPLETE for every related table: an empty result cannot be distinguished from an RLS denial. Re-run with SUPABASE_SERVICE_ROLE_KEY exported to finish it.',
};
write('00-MANIFEST.json', manifest);
console.log(`\n━━ written to exports/${path.basename(OUT)}/`);
console.log(`   ${linked.length} tables with rows, ${manifest.summary.totalRelatedRows} related rows, ${denied.length} denied.`);
