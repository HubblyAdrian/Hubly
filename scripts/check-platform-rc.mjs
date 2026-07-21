#!/usr/bin/env node
/**
 * Platform RC smoke — public routes + marketplace intake/match/catalog.
 * Does not claim a full QA pass; see docs/PLATFORM_RC_VALIDATION.md.
 */
import fs from 'fs';

const BASE = process.env.HUBLY_BASE || 'https://myhubly.app';
let failed = false;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('OK:', msg);
  }
}
function warn(cond, msg) {
  if (!cond) console.warn('WARN:', msg);
  else console.log('OK:', msg);
}

async function get(path) {
  const res = await fetch(BASE + path, { redirect: 'follow' });
  const text = await res.text();
  return { status: res.status, url: res.url, text };
}

const routes = [
  ['/', /What can we help you/i],
  ['/get-done', /get done/i],
  ['/marketplace', /Marketplace/i],
  ['/marketplace/join', /Join|Marketplace/i],
  ['/marketplace/login', /Sign|Marketplace/i],
  ['/pro', /Hubly|business/i],
  ['/enter', /Sign in to the right place|Get Done/i],
  ['/login', /Sign in|Email|Password/i],
  ['/signup', /Hubly|Instant|Sign/i],
];

for (const [path, re] of routes) {
  const r = await get(path);
  ok(r.status === 200, `${path} → ${r.status}`);
  ok(re.test(r.text), `${path} body matches ${re}`);
}

const lite = await fetch(BASE + '/lite', { redirect: 'manual' });
ok(lite.status === 302 || lite.status === 301, `/lite redirects (${lite.status})`);
const loc = lite.headers.get('location') || '';
ok(/marketplace\/login/.test(loc), `/lite → marketplace/login (${loc})`);

const html = fs.readFileSync('public/get-done.html', 'utf8');
const anon = html.match(/['"](eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)['"]/)?.[1];
const supa = html.match(/https:\/\/[a-z0-9.-]+\.supabase\.co/)?.[0];
ok(!!anon && !!supa, 'get-done has Supabase URL + anon key');

if (anon && supa) {
  const call = async (payload) => {
    const res = await fetch(supa + '/functions/v1/marketplace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + anon,
        apikey: anon,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  };

  const intake = await call({
    action: 'intake',
    messages: [{ role: 'user', content: 'I need my windows cleaned this weekend in Toronto' }],
  });
  ok(intake.status === 200 && intake.json.ok, 'intake returns ok');

  const match = await call({
    action: 'match',
    need: { service: 'Window Cleaning', category: 'windows', city: 'Toronto', when: 'this weekend' },
  });
  ok(match.status === 200 && match.json.ok, 'match returns ok');
  const rec = (match.json.recommendations || [])[0];
  ok(!!rec, 'match returns at least one provider');

  if (rec) {
    const catalog = await call({
      action: 'booking_catalog',
      provider_id: rec.provider_id,
      business_id: rec.business_id,
    });
    ok(catalog.status === 200 && catalog.json.ok, 'booking_catalog returns ok');
    const services = catalog.json.services || [];
    warn(services.length > 0, `matched provider has published services (got ${services.length})`);
    if (!services.length) {
      console.error('BLOCKER: empty catalog — customer booking dead-ends after Match');
      failed = true;
    }
  }
}

// Known stubs / regressions in source
const home = fs.readFileSync('public/platform-home.html', 'utf8');
if (/You’re on the list[\s\S]{0,120}disabled = true/.test(home) || /disabled = true[\s\S]{0,80}You’re on the list/.test(home)) {
  console.error('BLOCKER: Business Readiness Notify me is a false-success stub');
  failed = true;
} else if (/id="notifyForm"/.test(home) && !/api\/notify/.test(home)) {
  console.error('BLOCKER: Business Readiness notify form has no backend');
  failed = true;
}

const gd = fs.readFileSync('public/get-done.html', 'utf8');
if (/function showFollowUps[\s\S]{0,800}submitNeed\(\s*q\s*\)/.test(gd)) {
  console.error('BLOCKER: get-done follow-ups still submit Hubly questions as user turns (merge PR #129)');
  failed = true;
}

if (failed) {
  console.error('\nRC smoke FAILED — do not start Phase 7');
  process.exit(1);
}
console.log('\nRC smoke passed (still run full checklist in docs/PLATFORM_RC_VALIDATION.md)');
