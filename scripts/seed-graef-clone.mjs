#!/usr/bin/env node
/**
 * SEED A CLONE OF GRAEF — the rehearsal subject, so the real one is never it.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-graef-clone.mjs \
 *     --export exports/graefs-autocare-2026-09-07T18-05-36 --owner <uid> [--apply]
 *
 * WHY: Graef's bar is "all the buttons work", and the only way to know is to click
 * them. Clicking them on Graef is not an option — he has 11 booking requests, 4
 * customers and 2 jobs. So we click them on a business that has his exact record
 * and none of his consequences.
 *
 * THE CLONE IS CHOSEN TO SHOW THE DEFECT, NOT TO BE SAFE. It carries every item in
 * GRAEF_INVENTORY.md, so an editor path that is broken for his content is broken
 * here too, in the same way. (2026-09-07: the migration pilot was picked by blast
 * radius, landed on a case that could not fail, and proved nothing. This is the
 * opposite choice.)
 *
 * ONE WRITE, AND ONLY ONE: a single INSERT into `businesses`. It never updates
 * graefs-autocare, never touches any other row, and never copies his operational
 * data — no bookings, no customers, no jobs. The clone is inert on purpose: a test
 * row that could send a notification is not a test row.
 *
 * DRY RUN IS THE DEFAULT. --apply is required to write.
 *
 * SOURCE IS THE EXPORT, NEVER THE LIVE ROW. Re-reading graefs-autocare to seed the
 * clone is one more chance to touch him, and the export is already proven complete
 * (00-MANIFEST.json, COMPLETE: true).
 *
 * OWNERSHIP: --owner takes a uid that ALREADY EXISTS — pass Adrian's own, so the
 * clone opens in a session he is already signed into. This script does not create
 * accounts and does not handle credentials.
 *
 * PII: meta.pipeline.manual holds THREE REAL CUSTOMERS with name, phone, email,
 * address and message history. Copying real people's contact details into a test
 * row is a privacy cost with no testing benefit, so those three entries are
 * REDACTED — every key kept, every value replaced with a marked placeholder of the
 * same type. The structure is what the editor test needs; the values are not. What
 * was redacted is printed, so it is never a silent edit.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const APPLY = argv.includes('--apply');
const DELETE = arg('--delete', '');
const EXPORT = arg('--export', 'exports/graefs-autocare-2026-09-07T18-05-36');
const OWNER = arg('--owner', '');
const SLUG = arg('--slug', `graef-clone-${new Date().toISOString().slice(0, 10)}`);

const URL_ = 'https://rtwxxkxpkqdrhclkozma.supabase.co';
const SRK = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!SRK) { console.error('SUPABASE_SERVICE_ROLE_KEY is not set. Export it (read -rs) and re-run.'); process.exit(1); }
if (!OWNER) { console.error('--owner <uid> is required: an EXISTING auth uid, so the clone opens in a session you are already signed into.'); process.exit(1); }
/* ── TEARDOWN IS A COMMAND, NOT A MEMORY ──────────────────────────────────────
   The clone is publicly reachable at <slug>.myhubly.app carrying a real
   customer's name, phone, email and photos, at a URL he does not control. That
   is accepted deliberately and for a bounded time — not left live because nobody
   remembered. So deletion ships in the same file as creation.

   It refuses any slug that is not a `test` row, so a mistyped slug can never
   delete a real business. */
if (DELETE) {
  const q = new URL(`${URL_}/rest/v1/businesses`);
  q.searchParams.set('select', 'id,slug,name,account_kind,owner_id');
  q.searchParams.set('slug', `eq.${DELETE}`);
  const r = await fetch(q, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) { console.error(`No business with slug "${DELETE}".`); process.exit(1); }
  const t = rows[0];
  console.log(`found: ${t.slug}  "${t.name}"  account_kind=${t.account_kind}`);
  if (t.account_kind !== 'test') {
    console.error(`REFUSING — account_kind is "${t.account_kind}", not "test". This script only deletes test rows.`);
    process.exit(1);
  }
  if (!APPLY) { console.log(`(DRY RUN — would DELETE businesses row ${t.id}. Re-run with --apply.)`); process.exit(0); }
  const d = await fetch(`${URL_}/rest/v1/businesses?id=eq.${t.id}`, { method: 'DELETE', headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
  if (!d.ok) { console.error(`DELETE failed ${d.status}: ${(await d.text()).slice(0, 200)}`); process.exit(1); }
  // Assert the postcondition rather than trusting the status code.
  const back = await fetch(q, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
  const left = await back.json();
  if (Array.isArray(left) && left.length) { console.error('DELETE reported success but the row is still there. Investigate.'); process.exit(1); }
  console.log(`DELETED ${t.slug}. Confirmed gone by re-reading, not by the status code.`);
  console.log(`https://${t.slug}.myhubly.app is now dead.`);
  process.exit(0);
}

const rowPath = path.join(EXPORT, '01-businesses-row.json');
if (!existsSync(rowPath)) { console.error(`no export at ${rowPath}`); process.exit(1); }

const src = JSON.parse(readFileSync(rowPath, 'utf8'));
console.log(`━━ source: ${EXPORT}  (${Object.keys(src).length} columns, slug ${src.slug})`);

// ── build the clone row ───────────────────────────────────────────────────────
const row = { ...src };
delete row.id; delete row.created_at; delete row.first_visitor_at;
row.slug = SLUG;
// THE NAME IS NOT CHANGED. An earlier draft of this script appended " (CLONE)",
// which would have broken the very comparison the clone exists for: the
// fingerprint in scripts/baselines is a diff of the page's visible TEXT RUNS, and
// the business name is in several of them. Fidelity is the point — a clone that
// reads differently is not a rehearsal. The exposure that creates is handled by
// account_kind, by the noindex question recorded in docs/GRAEF_EDITOR_BAR.md, and
// above all by DELETING IT (--delete) the moment the click-through is done.
row.owner_id = OWNER;
// NEVER 'market'. Graef's row says market; inheriting that would put a duplicate
// business into every user/adoption number we have measured all day (the
// denominator rule) and into anything that reads account_kind downstream.
row.account_kind = 'test';
row.owner_identified = false;

// ── redact the three real customers, keeping the shape ────────────────────────
let meta = {}; try { meta = JSON.parse(src.meta); } catch { console.error('meta did not parse'); process.exit(1); }
const redactedFields = [];
const scrub = (v, key) => {
  if (typeof v === 'string' && v) { redactedFields.push(key); return `REDACTED-${key}`; }
  if (Array.isArray(v) && v.length) { redactedFields.push(`${key}[${v.length}]`); return []; }
  return v;
};
if (meta.pipeline && Array.isArray(meta.pipeline.manual)) {
  meta.pipeline.manual = meta.pipeline.manual.map((e, i) => {
    const out = { ...e };
    for (const k of ['name', 'phone', 'email', 'address', 'lastMessage', 'notes']) if (k in out) out[k] = scrub(out[k], `${i}.${k}`);
    for (const k of ['messages', 'notesList', 'activity']) if (k in out) out[k] = scrub(out[k], `${i}.${k}`);
    return out;
  });
}
// manualReviews carry real reviewer names; the QUOTE is his page content and stays.
if (meta.website && Array.isArray(meta.website.manualReviews)) {
  meta.website.manualReviews = meta.website.manualReviews.map((r, i) => (r.author ? { ...r, author: `Reviewer ${i + 1}` } : r));
}
row.meta = JSON.stringify(meta);

// ── THE BUSINESS'S OWN CONTACT DETAILS GO TO A SINK. ALWAYS. ─────────────────
//
// STANDING RULE, paid for on 2026-09-08: a clone of Graef carried his REAL email
// (austinjgraef@gmail.com) and phone. Testing the public booking chat on it drove a
// conversation to "You're booked" — one more message and booking-notify would have
// emailed a real customer a fake $85 appointment on a Saturday. It was caught by
// noticing mid-test, which is not a control.
//
// So the scrub happens HERE, at creation, not before the risky step — because
// "before the risky step" requires remembering which step is risky, and the risky
// step is whichever one someone tries next. A clone that cannot reach a real person
// is safe under every future test, including the ones nobody has thought of.
//
// .invalid is reserved by RFC 2606 and can never resolve, so a misdirected send
// fails at the sender rather than reaching a stranger.
const SINK_EMAIL = 'sink@clone.invalid';
const SINK_PHONE = '555-000-0000';
const contactScrubbed = [];
for (const [col, sink] of [['email', SINK_EMAIL], ['phone', SINK_PHONE], ['sms_number', SINK_PHONE]]) {
  if (col in row && row[col]) { contactScrubbed.push(`${col}: ${String(row[col]).slice(0, 3)}…`); row[col] = sink; }
}

// ── what the clone must still carry, asserted before writing ──────────────────
const w = meta.website || {};
const checks = [
  ['services (meta.service_catalog)', ((meta.service_catalog || {}).services || []).length, 8],
  ['why-choose cards', (w.whyChooseUs || []).length, 5],
  ['trust pills (incl. the blank one)', (w.trustStats || []).length, 3],
  ['memberships', (w.membershipOffers || []).length, 2],
  ['manual reviews', (w.manualReviews || []).length, 2],
  ['FAQ', (w.faq || []).length, 6],
  ['gallery albums (incl. 3 empty)', (w.galleryAlbums || []).length, 7],
  ['portfolio images', (meta.portfolioUrls || []).length, 26],
  ['booking wizard keys', Object.keys(meta.bookingWizard || {}).length, 21],
  ['hours days', Object.keys(meta.hours || {}).length, 7],
  ['pipeline entries (redacted, shape kept)', ((meta.pipeline || {}).manual || []).length, 3],
];
console.log('\n━━ the clone must carry all of this, or it is not a rehearsal:');
let bad = 0;
for (const [label, got, want] of checks) {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`   ${ok ? '✓' : '✗'} ${label.padEnd(40)} ${String(got).padStart(3)} (expected ${want})`);
}
const customFlags = ['customHeroHeadline', 'customHeroSub', 'customFooterCta', 'customOwnerTitle'].filter((k) => w[k] === true);
console.log(`   ${customFlags.length === 4 ? '✓' : '✗'} custom* flags carried                    ${customFlags.length} (expected 4)`);
console.log(`   ${w.ourStory === '' ? '✓' : '✗'} ourStory still EMPTY                     ${JSON.stringify(w.ourStory)}`);
if (bad || customFlags.length !== 4) { console.error('\nFATAL: the clone would not carry his content. Not writing.'); process.exit(1); }

console.log(`\n━━ contact details sent to a sink (so this clone can never reach a real person): ${contactScrubbed.length}`);
console.log(`   ${contactScrubbed.join(', ') || '(none present on the source row)'} -> ${SINK_EMAIL} / ${SINK_PHONE}`);
console.log(`\n━━ redacted from meta.pipeline.manual (privacy, shape preserved): ${redactedFields.length} fields`);
console.log(`   ${redactedFields.join(', ')}`);
console.log(`━━ reviewer names replaced with "Reviewer N"; review QUOTES kept (they are page content).`);

if (!APPLY) {
  console.log(`\n(DRY RUN — nothing written. Would INSERT one businesses row: slug "${SLUG}", account_kind test, owner ${OWNER.slice(0, 8)}….)`);
  console.log('Re-run with --apply to write.');
  process.exit(0);
}

const res = await fetch(`${URL_}/rest/v1/businesses`, {
  method: 'POST',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify(row),
});
const body = await res.text();
if (!res.ok) { console.error(`\nINSERT FAILED ${res.status}: ${body.slice(0, 300)}`); process.exit(1); }
const made = JSON.parse(body)[0];
console.log(`\n━━ CREATED  slug: ${made.slug}   https://${made.slug}.myhubly.app`);
console.log('   Nothing else was written. graefs-autocare was never read or touched by this run.');
console.log(`   Baseline the clone before any editor work:  node scripts/check-graefs-page.mjs --slug ${made.slug} --update`);
console.log('');
console.log('━━ THIS PAGE IS PUBLIC AND CARRIES A REAL CUSTOMER\'S NAME, PHONE, EMAIL AND PHOTOS.');
console.log('   It is accepted deliberately, for the duration of the click-through, and no longer.');
console.log('   DELETE IT THE MOMENT YOU ARE DONE — the command, so it is not a memory:');
console.log(`     node scripts/seed-graef-clone.mjs --delete ${made.slug} --apply`);
