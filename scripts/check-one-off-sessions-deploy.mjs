#!/usr/bin/env node
/**
 * One-Off Sessions — deployment verifier.
 *
 * Runs the checks that can ONLY be answered by a real Supabase project: does the
 * migration actually exist, does RLS actually deny anon, are the Edge Functions
 * actually on the new code, and does the private link actually work end to end.
 *
 * Everything here is read-only unless you explicitly pass --smoke.
 *
 *   node scripts/check-one-off-sessions-deploy.mjs --pre     # BEFORE deploying
 *   node scripts/check-one-off-sessions-deploy.mjs --post    # AFTER deploying
 *   node scripts/check-one-off-sessions-deploy.mjs --post --smoke   # + live lifecycle
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_ANON_KEY   default to the public Hubly values
 *   OWNER_JWT                         a signed-in owner's access token (enables owner checks)
 *   OWNER_BUSINESS_ID                 that owner's business id  (enables --smoke)
 *   FOREIGN_BUSINESS_ID               a business the owner does NOT own (isolation check)
 *
 * --smoke writes: it creates ONE draft session, publishes it, then closes and
 * cancels it. It never takes a payment and never touches an existing session.
 * A cancelled session is left behind on purpose — sessions are never deleted.
 */

const URL_BASE = (process.env.SUPABASE_URL || 'https://rtwxxkxpkqdrhclkozma.supabase.co').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d3h4a3hwa3FkcmhjbGtvem1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjA4MjgsImV4cCI6MjA5Nzk5NjgyOH0.ky9ycGJ621E4ab078pCIR4-1X_XS6OUpfPmH3v8tzf8';
const OWNER_JWT = process.env.OWNER_JWT || '';
const OWNER_BUSINESS_ID = process.env.OWNER_BUSINESS_ID || '';
const FOREIGN_BUSINESS_ID = process.env.FOREIGN_BUSINESS_ID || '';

const MODE = process.argv.includes('--pre') ? 'pre' : process.argv.includes('--post') ? 'post' : null;
const SMOKE = process.argv.includes('--smoke');
if (!MODE) {
  console.error('Pass --pre or --post. See the header of this file.');
  process.exit(2);
}

let passed = 0;
const failures = [];
const skipped = [];
const ck = (name, cond, detail) => {
  if (cond) { passed++; console.log('PASS · ' + name); }
  else { failures.push(name); console.log('FAIL · ' + name + (detail !== undefined ? '\n        ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) : '')); }
};
const skip = (name, why) => { skipped.push(name); console.log('SKIP · ' + name + '  (' + why + ')'); };

async function rest(path, jwt) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwt || ANON}` },
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}

async function fn(name, payload, jwt) {
  const res = await fetch(`${URL_BASE}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${jwt || ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}

console.log(`\n=== One-Off Sessions deploy check · ${MODE.toUpperCase()} · ${URL_BASE} ===\n`);

/* ────────────────────────── PRE ────────────────────────── */
if (MODE === 'pre') {
  const s = await rest('one_off_sessions?select=id&limit=1');
  ck('pre · one_off_sessions does NOT exist yet', s.status === 404 && s.body?.code === 'PGRST205', s.body);
  const b = await rest('one_off_session_bookings?select=id&limit=1');
  ck('pre · one_off_session_bookings does NOT exist yet', b.status === 404 && b.body?.code === 'PGRST205', b.body);
  const f = await fn('one-off-sessions', { action: 'public_get', token: 'probe' });
  ck('pre · one-off-sessions function is NOT deployed yet', f.status === 404, f.body);
  const control = await fn('customer-portal', { action: 'verify', token: 'probe' });
  ck('pre · control: an existing function answers (probe method works)', control.status === 401, control.body);
  console.log('\nBaseline recorded. Deploy, then re-run with --post.');
}

/* ────────────────────────── POST ────────────────────────── */
if (MODE === 'post') {
  // 1. Migration actually applied
  const s = await rest('one_off_sessions?select=id&limit=1');
  ck('db · one_off_sessions exists', s.status !== 404 || s.body?.code !== 'PGRST205', s.body);
  const b = await rest('one_off_session_bookings?select=id&limit=1');
  ck('db · one_off_session_bookings exists', b.status !== 404 || b.body?.code !== 'PGRST205', b.body);

  // 2. RLS actually denies anon. There is NO anon policy, so PostgREST must
  //    return an empty set (or an explicit denial) — never a row.
  ck('rls · anon cannot read any session row',
    s.status === 401 || s.status === 403 || (Array.isArray(s.body) && s.body.length === 0),
    { status: s.status, body: s.body });
  ck('rls · anon cannot read any booking row',
    b.status === 401 || b.status === 403 || (Array.isArray(b.body) && b.body.length === 0),
    { status: b.status, body: b.body });

  // 3. anon cannot WRITE either (this is what a hostile caller would try)
  const wr = await fetch(`${URL_BASE}/rest/v1/one_off_sessions`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify({ business_id: '00000000-0000-0000-0000-000000000000', name: 'hostile', session_date: '2099-01-01', start_time: '08:00', end_time: '09:00', booking_token: 'x' }),
  });
  ck('rls · anon cannot insert a session', wr.status === 401 || wr.status === 403, { status: wr.status });

  // 4. Function deployed and behaving
  const bogus = await fn('one-off-sessions', { action: 'public_get', token: 'definitely-not-a-real-token' });
  ck('fn · one-off-sessions is deployed', bogus.status !== 404 || bogus.body?.code !== 'NOT_FOUND', bogus.body);
  ck('fn · an unknown token 404s cleanly', bogus.status === 404 && bogus.body?.error === 'not_found', bogus.body);
  ck('fn · an unknown token leaks nothing',
    !JSON.stringify(bogus.body || {}).match(/business|owner|stripe|token|session_id/i), bogus.body);

  const noAuth = await fn('one-off-sessions', { action: 'list', business_id: FOREIGN_BUSINESS_ID || '00000000-0000-0000-0000-000000000000' });
  ck('authz · an owner action with no owner JWT is rejected', noAuth.status === 401, { status: noAuth.status, body: noAuth.body });

  const badAction = await fn('one-off-sessions', { action: 'definitely_not_an_action' });
  ck('fn · unknown actions are rejected', badAction.status === 400 || badAction.status === 401, badAction.body);

  // 5. Modified functions are on the NEW code.
  //    stripe-webhook must reject an unsigned POST — proves it is live and verifying.
  const wh = await fetch(`${URL_BASE}/functions/v1/stripe-webhook`, {
    method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: '{}',
  });
  ck('fn · stripe-webhook is live and rejects unsigned payloads', wh.status === 400, { status: wh.status });

  const cbc = await fn('create-booking-checkout', { business_id: '00000000-0000-0000-0000-000000000000' });
  ck('fn · create-booking-checkout is live',
    [400, 404, 409, 503].includes(cbc.status), { status: cbc.status, body: cbc.body });

  // 6. Owner-scoped checks
  if (!OWNER_JWT) {
    skip('authz · cross-business isolation', 'set OWNER_JWT (+ FOREIGN_BUSINESS_ID)');
    skip('owner · list own sessions', 'set OWNER_JWT + OWNER_BUSINESS_ID');
  } else {
    if (FOREIGN_BUSINESS_ID) {
      const foreign = await fn('one-off-sessions', { action: 'list', business_id: FOREIGN_BUSINESS_ID }, OWNER_JWT);
      ck('authz · an owner CANNOT list another business\'s sessions', foreign.status === 403,
        { status: foreign.status, body: foreign.body });
    } else {
      skip('authz · cross-business isolation', 'set FOREIGN_BUSINESS_ID');
    }
    if (OWNER_BUSINESS_ID) {
      const mine = await fn('one-off-sessions', { action: 'list', business_id: OWNER_BUSINESS_ID }, OWNER_JWT);
      ck('owner · can list own sessions', mine.status === 200 && mine.body?.ok === true,
        { status: mine.status, body: mine.body });
    }
  }

  /* ────────────────── live lifecycle smoke (opt-in, writes) ────────────────── */
  if (SMOKE) {
    if (!OWNER_JWT || !OWNER_BUSINESS_ID) {
      skip('smoke · live lifecycle', 'needs OWNER_JWT + OWNER_BUSINESS_ID');
    } else {
      const future = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
      const name = `__deploy-smoke ${new Date().toISOString().slice(0, 16)}`;
      console.log(`\n--- live smoke: creating "${name}" on ${future} ---`);

      const created = await fn('one-off-sessions', {
        action: 'create', business_id: OWNER_BUSINESS_ID,
        session: {
          name, session_date: future, start_time: '08:00', end_time: '14:00',
          appointment_duration_minutes: 20, buffer_minutes: 0, location: 'Deploy Smoke Test',
          price_cents: 15000, payment_mode: 'deposit', deposit_type: 'flat', deposit_cents: 5000,
        },
      }, OWNER_JWT);
      ck('smoke · create returns a draft', created.body?.session?.status === 'draft', created.body);
      ck('smoke · 18 slots are derived', created.body?.session?.slot_count === 18, created.body?.session?.slot_count);
      const id = created.body?.session?.id;
      const token = created.body?.session?.booking_url?.split('/session/')[1];
      ck('smoke · a private booking URL is issued', !!token, created.body?.session?.booking_url);

      if (id && token) {
        const draftPublic = await fn('one-off-sessions', { action: 'public_get', token });
        ck('smoke · a DRAFT is not publicly readable', draftPublic.status === 404, draftPublic.body);

        const pub = await fn('one-off-sessions', { action: 'publish', business_id: OWNER_BUSINESS_ID, session_id: id }, OWNER_JWT);
        ck('smoke · publish succeeds', pub.body?.session?.status === 'published', pub.body);
        ck('smoke · publishing blocks the calendar', pub.body?.session?.calendar_blocked === true, pub.body?.session);

        const live = await fn('one-off-sessions', { action: 'public_get', token });
        ck('smoke · the private link now works logged-out', live.status === 200 && live.body?.ok === true, live.body);
        ck('smoke · it offers 18 times', live.body?.availability?.slots?.length === 18, live.body?.availability?.slots?.length);
        ck('smoke · it shows the $50 deposit', live.body?.payment?.charge_now_cents === 5000, live.body?.payment);
        ck('smoke · the public payload hides the business id',
          !JSON.stringify(live.body).includes(OWNER_BUSINESS_ID), 'business id leaked');
        ck('smoke · the public payload hides the session id',
          !JSON.stringify(live.body).includes(id), 'session id leaked');

        const closed = await fn('one-off-sessions', { action: 'close', business_id: OWNER_BUSINESS_ID, session_id: id }, OWNER_JWT);
        ck('smoke · close succeeds', closed.body?.session?.status === 'closed', closed.body);
        ck('smoke · closing releases the calendar', closed.body?.session?.calendar_blocked === false, closed.body?.session);

        const afterClose = await fn('one-off-sessions', { action: 'public_get', token });
        ck('smoke · a closed session is not bookable', afterClose.body?.session?.bookable === false, afterClose.body?.session);

        const cancelled = await fn('one-off-sessions', { action: 'cancel', business_id: OWNER_BUSINESS_ID, session_id: id }, OWNER_JWT);
        ck('smoke · cancel succeeds (test session retired)', cancelled.body?.session?.status === 'cancelled', cancelled.body);
        console.log(`--- smoke session left cancelled (id ${id}) — sessions are never deleted ---`);
      }
    }
  } else {
    skip('smoke · live lifecycle', 'pass --smoke to run it');
  }
}

console.log(`\n==== ${MODE.toUpperCase()}: ${passed} passed, ${failures.length} failed, ${skipped.length} skipped ====`);
if (failures.length) { failures.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
