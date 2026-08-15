/**
 * One-Off Sessions — real browser proof.
 *
 * Drives the ACTUAL shipped pages in Chromium:
 *   * public/session.html                       — the customer booking page
 *   * public/journey-os/one-off-sessions.js     — the provider Sessions surface
 *   * public/journey-os/commerce/store-page.js  — the storefront promo banner
 *
 * The API is intercepted and answered with fixtures emitted by the REAL engine
 * (tests/support/emit_fixtures.ts), so what the browser renders is what the
 * server genuinely returns. Nothing here re-implements a page.
 *
 * Run: node tests/one_off_sessions_ui.mjs
 * (regenerate fixtures first:
 *  deno run --allow-env --allow-net --allow-write --no-check tests/support/emit_fixtures.ts)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const F = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/support/fixtures.json'), 'utf8'));

let passed = 0;
const failures = [];
const ck = (name, cond, detail) => {
  if (cond) { passed++; console.log('PASS · ' + name); }
  else { failures.push(name); console.log('FAIL · ' + name + (detail !== undefined ? '  [' + String(JSON.stringify(detail)).slice(0, 200) + ']' : '')); }
};
const eq = (name, a, b) => ck(name, JSON.stringify(a) === JSON.stringify(b), { actual: a, expected: b });

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const HOST = 'adrian-photo.myhubly.app';

/** Serve public/ exactly as api/router.js does for these routes. */
function staticRoute(extraDocs = {}) {
  return async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.hostname !== HOST) return route.continue();
    for (const [prefix, file] of Object.entries(extraDocs)) {
      if (u.pathname === prefix || u.pathname.startsWith(prefix)) {
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(file, 'utf8') });
      }
    }
    const fp = path.join(PUBLIC, decodeURIComponent(u.pathname));
    if (fp.startsWith(PUBLIC) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      return route.fulfill({ status: 200, contentType: MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(fp) });
    }
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  };
}

const browser = await chromium.launch();

/* ══════════════════ PHASE 5 + 22 — customer booking page ══════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone-ish: these links are shared on social
  const errors = [];
  page.on('pageerror', (e) => errors.push('EX:' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CE:' + m.text()); });

  const apiCalls = [];
  await page.route('**/functions/v1/one-off-sessions', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    apiCalls.push(body);
    if (body.action === 'public_get') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(F.publicPayload) });
    }
    if (body.action === 'public_book') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          ok: true, booking_id: 'bk-test', requires_payment: true, charge_now_cents: 5000,
          confirmation: null,
        }),
      });
    }
    if (body.action === 'public_checkout') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: 'https://checkout.stripe.test/pay' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
  });
  await page.route(`https://${HOST}/**`, staticRoute({ '/session/': path.join(PUBLIC, 'session.html') }));
  // Never actually leave for Stripe.
  await page.route('https://checkout.stripe.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>stripe</h1>' }));

  await page.goto(`https://${HOST}/session/${F.bookingToken}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero h1', { timeout: 10000 });

  const text = await page.textContent('body');
  ck('customer · shows the business name', text.includes('Adrian Smith Photography'));
  ck('customer · shows the business logo', await page.locator('.biz img').count() === 1);
  ck('customer · shows the session name', (await page.textContent('.hero h1')).includes('Fall Mini Sessions'));
  ck('customer · shows the description', text.includes('20-minute photography sessions'));
  ck('customer · shows the date', /Thursday, August 20|August 20/.test(text), text.slice(0, 400));
  ck('customer · shows the time window', text.includes('8:00 AM') && text.includes('2:00 PM'));
  ck('customer · shows the location', text.includes('Thanksgiving Point'));
  ck('customer · shows the price', text.includes('$150'));
  ck('customer · shows the deposit line', text.includes('$50 deposit due today'));
  ck('customer · shows the balance', text.includes('$100 at your session'));
  ck('customer · shows the cancellation policy', text.includes('non-refundable'));

  // Slots
  const slots = page.locator('.slot');
  eq('customer · renders all 18 slots', await slots.count(), 18);
  eq('customer · first slot is 8:00 AM', (await slots.nth(0).textContent()).trim(), '8:00 AM');
  eq('customer · last slot is 1:40 PM', (await slots.nth(17).textContent()).trim(), '1:40 PM');
  const disabled = await page.locator('.slot[disabled]').allTextContents();
  eq('customer · already-booked slots are not selectable', disabled.map((s) => s.trim()), ['8:20 AM', '9:00 AM']);
  ck('customer · remaining count is shown', text.includes('16 of 18 spots left'), text.match(/\d+ of \d+ spot[^.]*/)?.[0]);

  // No booking form until a time is chosen — the page is not a wall of inputs.
  eq('customer · the form is hidden until a time is picked', await page.locator('#f-name').count(), 0);

  await page.locator('.slot:not([disabled])', { hasText: '9:20 AM' }).click();
  await page.waitForSelector('#f-name');
  ck('customer · picking a time reveals the details form', await page.locator('#f-name').count() === 1);
  ck('customer · asks for email', await page.locator('#f-email').count() === 1);
  ck('customer · asks for phone', await page.locator('#f-phone').count() === 1);
  eq('customer · renders the session-specific questions', await page.locator('[data-q]').count(), 2);
  const review = await page.textContent('.review');
  ck('customer · review shows the chosen time', review.includes('9:20 AM'), review);
  ck('customer · review shows what is due today', review.includes('$50'), review);
  ck('customer · review shows what is due at the session', review.includes('$100'), review);
  ck('customer · trust copy mentions Stripe', text.includes('Stripe'));

  // Validation before anything is sent.
  await page.locator('#confirm-btn').click();
  await page.waitForSelector('.err');
  ck('customer · refuses to submit without a name', (await page.textContent('.err')).includes('name'));
  eq('customer · nothing was booked', apiCalls.filter((c) => c.action === 'public_book').length, 0);

  await page.fill('#f-name', 'Jamie Rivera');
  await page.fill('#f-email', 'jamie@example.com');
  await page.locator('#confirm-btn').click();
  await page.waitForSelector('.err');
  ck('customer · refuses to submit without a required answer', (await page.textContent('.err')).includes('How many people'));

  ck('customer · a validation error does NOT wipe the name already typed',
    await page.inputValue('#f-name') === 'Jamie Rivera');
  ck('customer · nor the email', await page.inputValue('#f-email') === 'jamie@example.com');
  ck('customer · nor the chosen time', (await page.textContent('.review')).includes('9:20 AM'));
  await page.fill('#q_0', '4');
  const navPromise = page.waitForURL('https://checkout.stripe.test/**', { timeout: 10000 }).catch(() => null);
  await page.locator('#confirm-btn').click();
  await navPromise;
  const bookCall = apiCalls.find((c) => c.action === 'public_book');
  ck('customer · sends the booking with the chosen slot', bookCall && bookCall.slot_time === '09:20', bookCall);
  ck('customer · sends the answers', bookCall && bookCall.answers && bookCall.answers.party === '4', bookCall?.answers);
  ck('customer · never sends a business id', !JSON.stringify(apiCalls).includes('business_id'));
  ck('customer · never sends an amount the browser chose', !JSON.stringify(apiCalls).includes('amount'));
  ck('customer · goes to Stripe checkout opened server-side',
    apiCalls.some((c) => c.action === 'public_checkout') && page.url().startsWith('https://checkout.stripe.test'));

  eq('customer · no page errors', errors, []);
  await page.close();
}

/* ══════════════════ mobile layout ══════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
  await page.route('**/functions/v1/one-off-sessions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(F.publicPayload) }));
  await page.route(`https://${HOST}/**`, staticRoute({ '/session/': path.join(PUBLIC, 'session.html') }));
  await page.goto(`https://${HOST}/session/${F.bookingToken}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.slot');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  eq('mobile · no horizontal overflow at 360px', overflow <= 0, true);
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.slot')].filter((b) => b.getBoundingClientRect().height < 36).length);
  eq('mobile · every time button is a real tap target (>=36px)', tooSmall, 0);
  const heroTop = await page.evaluate(() => document.querySelector('.hero h1').getBoundingClientRect().top);
  ck('mobile · the session name is above the fold', heroTop < 400, heroTop);
  const firstSlotTop = await page.evaluate(() => document.querySelector('.slot').getBoundingClientRect().top);
  ck('mobile · times are reachable without hunting (< 2 screens down)', firstSlotTop < 1400, firstSlotTop);

  // §22 hierarchy: business → session → when/where → times → price is above times
  const order = await page.evaluate(() => {
    const y = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().top : -1; };
    return { biz: y('.biz'), name: y('.hero h1'), facts: y('.facts'), price: y('.price-row'), slots: y('.slots') };
  });
  ck('hierarchy · business identity first', order.biz < order.name);
  ck('hierarchy · session name before what/where/when', order.name < order.facts);
  ck('hierarchy · what/where/when before price', order.facts < order.price);
  ck('hierarchy · price before the time grid', order.price < order.slots);
  await page.close();
}

/* ══════════════════ closed / sold-out customer states ══════════════════ */
{
  const closed = JSON.parse(JSON.stringify(F.publicPayload));
  closed.session.status = 'closed';
  closed.session.bookable = false;
  closed.session.block_reason = 'This session is no longer accepting bookings.';
  closed.session.cta = 'No longer available';

  const page = await browser.newPage();
  await page.route('**/functions/v1/one-off-sessions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(closed) }));
  await page.route(`https://${HOST}/**`, staticRoute({ '/session/': path.join(PUBLIC, 'session.html') }));
  await page.goto(`https://${HOST}/session/${F.bookingToken}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero h1');
  const t = await page.textContent('body');
  ck('closed · says it is no longer available', t.includes('No longer available'));
  ck('closed · explains why', t.includes('no longer accepting bookings'));
  eq('closed · offers NO time buttons', await page.locator('.slot').count(), 0);
  eq('closed · offers no booking form', await page.locator('#f-name').count(), 0);
  await page.close();
}

/* ══════════════════ bad / missing token ══════════════════ */
{
  const page = await browser.newPage();
  await page.route('**/functions/v1/one-off-sessions', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"error":"not_found"}' }));
  await page.route(`https://${HOST}/**`, staticRoute({ '/session/': path.join(PUBLIC, 'session.html') }));
  await page.goto(`https://${HOST}/session/deadbeef`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.state-msg');
  ck('bad token · shows a plain unavailable message', (await page.textContent('.state-msg')).includes("isn't available"));
  ck('bad token · leaks nothing about the business', !(await page.textContent('body')).includes('Adrian Smith'));
  await page.close();
}

/* ══════════════════ PHASE 11 + 12 — storefront promo banner ══════════════════ */
{
  const harness = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <div id="store"></div>
    <script>window.HublySupabase={url:'https://supa.test',anonKey:'anon'};</script>
    <script src="/journey-os/commerce/types.js"></script>
    <script src="/journey-os/commerce/components.js"></script>
    <script src="/journey-os/commerce/storefront-ast.js"></script>
    <script src="/journey-os/commerce/store-page.js"></script>
  </body></html>`;

  for (const [state, expectCta, expectLink] of [
    ['active', 'Book Your Session', true],
    ['sold_out', 'Sold Out', false],
    ['closed', 'No longer available', false],
  ]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/functions/v1/one-off-sessions', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(F.promotions[state]) }));
    await page.route(`https://${HOST}/**`, async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === '/harness') {
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: harness });
      }
      return staticRoute()(route);
    });
    await page.goto(`https://${HOST}/harness`, { waitUntil: 'domcontentloaded' });

    await page.evaluate((sessionId) => {
      window.HublyStorePage.renderInto(document.getElementById('store'), {
        businessId: 'biz-photographer',
        brand: { name: 'Adrian Smith Photography', brandColor: '#D9632D' },
        os: { settings: { enabled: true }, products: [], collections: [], bundles: [] },
        ast: {
          version: 1,
          theme: { style: 'clean', accent: '#D9632D', font: 'sans', density: 'cozy' },
          blocks: [
            { id: 'h', type: 'storeHero', order: 10, visible: true, variant: 'standard', config: { headline: 'Shop', sub: '', showSearch: false } },
            {
              id: 'p', type: 'promoBanner', order: 11, visible: true, variant: 'bold',
              config: { text: 'FALL MINI SESSIONS — August 20 • Limited Spots', ctaText: 'Book Your Session', linkType: 'oneOffSession', linkTarget: sessionId },
            },
          ],
        },
      });
    }, F.sessionId);

    await page.waitForFunction(() => {
      const el = document.querySelector('.sp-promo .sp-promo-cta');
      return el && el.textContent.trim().length > 0;
    }, { timeout: 8000 }).catch(() => {});

    const cta = (await page.textContent('.sp-promo .sp-promo-cta').catch(() => '') || '').trim();
    const isLink = await page.locator('a.sp-promo').count() === 1;
    const href = isLink ? await page.getAttribute('a.sp-promo', 'href') : null;
    const bannerText = await page.textContent('.sp-promo');

    eq(`promo(${state}) · CTA reflects live session state`, cta, expectCta);
    eq(`promo(${state}) · clickable only when bookable`, isLink, expectLink);
    if (expectLink) {
      ck(`promo(${state}) · links straight to the private session page`,
        href === F.bookingUrl, href);
      ck(`promo(${state}) · does NOT link to normal booking`, !String(href).includes('#book'));
    }
    ck(`promo(${state}) · banner copy is the owner's text`, bannerText.includes('FALL MINI SESSIONS'));
    eq(`promo(${state}) · no page errors`, errors, []);
    await page.close();
  }
}

/* ══════════════════ PHASE 20 + 21 — provider Sessions surface ══════════════════ */
{
  const harness = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <div id="p-app"><div id="v-sessions" class="body hidden"><div id="jos-sessions-root"></div></div></div>
    <script>
      window.HublySupabase={url:'https://supa.test',anonKey:'anon',session:{access_token:'jwt-owner'}};
      window.currentBusiness={id:'biz-photographer'};
      window.toast=function(m){ (window.__toasts=window.__toasts||[]).push(m); };
    </script>
    <script src="/journey-os/one-off-sessions.js"></script>
  </body></html>`;

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const calls = [];
  await page.route('**/functions/v1/one-off-sessions', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const auth = route.request().headers()['authorization'] || '';
    calls.push({ ...body, _auth: auth });
    const map = { list: F.ownerList, get: F.ownerGet, bookings: F.ownerBookings };
    if (body.action === 'cancel_booking') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, booking: { customer_name: 'Sarah Chen' }, refund_due_cents: 5000, session: F.ownerGet.session }) });
    }
    if (body.action === 'update') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session: F.ownerGet.session, warnings: ['This changes the price for NEW bookings only.'] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(map[body.action] || { ok: true }) });
  });
  await page.route(`https://${HOST}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/harness') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: harness });
    return staticRoute()(route);
  });
  await page.goto(`https://${HOST}/harness`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.HublyOneOffSessions.render());
  await page.waitForSelector('.oos-card');

  const listText = await page.textContent('.oos-wrap');
  ck('provider · titled Sessions', (await page.textContent('.oos-head h1')).trim() === 'Sessions');
  ck('provider · has a Create Session button', listText.includes('+ Create Session'));
  ck('provider · lists the session name', listText.includes('Fall Mini Sessions'));
  ck('provider · shows the date', listText.includes('Aug 20'));
  ck('provider · shows the time window', listText.includes('8:00 AM') && listText.includes('2:00 PM'));
  ck('provider · shows spots / booked / available', /Spots[\s\S]*18[\s\S]*Booked[\s\S]*2[\s\S]*Available[\s\S]*16/.test(listText), listText.slice(0, 500));
  ck('provider · shows price and deposit together', listText.includes('$150 · $50 deposit'), listText.match(/\$150[^<]*/)?.[0]);
  ck('provider · offers View and Share', listText.includes('View') && listText.includes('Share'));
  ck('provider · a draft is labelled draft', listText.toLowerCase().includes('draft'));
  ck('provider · sends the owner JWT', calls.every((c) => c._auth === 'Bearer jwt-owner'));
  ck('provider · never invents a business id', calls.every((c) => c.business_id === 'biz-photographer'));

  // Detail
  await page.locator('[data-oos-act="open"]').first().click();
  await page.waitForSelector('.oos-sec');
  const detail = await page.textContent('.oos-wrap');
  for (const section of ['Overview', 'Availability', 'Bookings', 'Sharing', 'Website', 'Calendar', 'Actions']) {
    ck(`detail · has a ${section} section`, detail.includes(section));
  }
  ck('detail · Overview shows price and deposit rows', detail.includes('$150') && detail.includes('$50 due at booking'));
  ck('detail · lists the real customers', detail.includes('Sarah Chen') && detail.includes('Marcus Webb'));
  ck('detail · shows payment status per booking', detail.includes('awaiting payment') || detail.includes('paid'));
  ck('detail · shows the private booking link', (await page.inputValue('.oos-link input')).includes('/session/'));
  ck('detail · says the calendar is blocked', detail.includes('Blocked 8:00 AM'));
  ck('detail · offers Edit / Share / Close / Cancel', ['Edit', 'Share', 'Close bookings', 'Cancel session'].every((a) => detail.includes(a)));
  ck('detail · avoids backend jargon',
    !/business_id|booking_token|calendar_block_job_id|payment_mode/.test(detail));

  // Edit
  await page.locator('[data-oos-act="edit"]').click();
  await page.waitForSelector('#oos-name');
  eq('edit · prefills the real name', await page.inputValue('#oos-name'), 'Fall Mini Sessions');
  eq('edit · prefills the real price in dollars', await page.inputValue('#oos-price'), '150');
  eq('edit · prefills the real deposit in dollars', await page.inputValue('#oos-dep'), '50');
  eq('edit · prefills the window', [await page.inputValue('#oos-start'), await page.inputValue('#oos-end')], ['08:00', '14:00']);
  await page.fill('#oos-price', '175');
  await page.locator('[data-oos-act="save"]').click();
  await page.waitForFunction(() => /NEW bookings only/.test(document.body.textContent || ''), { timeout: 8000 }).catch(() => {});
  const updateCall = calls.find((c) => c.action === 'update');
  eq('edit · sends the new price in cents', updateCall.session.price_cents, 17500);
  const noticeText = await page.textContent('.oos-wrap');
  ck('edit · surfaces the backend warning to the owner', noticeText.includes('NEW bookings only'), noticeText.slice(0, 300));

  // Cancel one booking — must warn about the un-refunded money
  page.on('dialog', (d) => { page.__dialog = d.message(); d.accept(); });
  await page.locator('[data-oos-act="cancel-booking"][data-paid="5000"]').first().click();
  await page.waitForFunction(() => (window.__toasts || []).includes('Booking cancelled'), { timeout: 8000 }).catch(() => {});
  ck('cancel-booking · warns that Hubly cannot refund', String(page.__dialog || '').includes('Stripe'), page.__dialog);
  const afterCancel = await page.textContent('.oos-wrap');
  ck('cancel-booking · reports what still needs refunding', afterCancel.includes('needs refunding in Stripe'), afterCancel.slice(0, 300));

  eq('provider · no page errors', errors, []);
  await page.close();
}

await browser.close();
console.log(`\n==== BROWSER UI: ${passed} passed, ${failures.length} failed ====`);
if (failures.length) { failures.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
