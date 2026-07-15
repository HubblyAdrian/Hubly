/**
 * E2E: Instant Site → reveal → Book Now → Smart Quote setup/workspace.
 * Usage: node scripts/e2e-quote-booking.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const URL = `${BASE}/hubly.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString(36);
const BIZ = `E2E Shine ${stamp}`;
const EMAIL = `e2e.quote.${stamp}@hubly.test`;

async function fillTalk(page, text) {
  const input = page.locator('#is-talk-input');
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill(text);
  await page.locator('#is-talk-send').click();
  await sleep(300);
}

function ok(msg) {
  console.log('✓', msg);
}
function fail(msg) {
  console.error('✗', msg);
  throw new Error(msg);
}

async function runInstantSite(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof startInstantSite === 'function', null, { timeout: 30000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
  });
  await page.evaluate(() => startInstantSite());
  await page.waitForSelector('#is-step-talk.is-on', { timeout: 15000 });

  await fillTalk(page, 'Alex Rivera');
  await fillTalk(page, BIZ);
  const chip = page.locator('#is-talk-chips .is-chip').filter({ hasText: /detail/i }).first();
  if (await chip.count()) await chip.click();
  else await fillTalk(page, 'auto detailing');
  await sleep(350);
  await fillTalk(page, '555-987-6543');
  await fillTalk(page, 'Bakersfield');

  await page.waitForFunction(
    () => (document.getElementById('is-talk-ask')?.textContent || '').toLowerCase().includes('services'),
    null,
    { timeout: 15000 }
  );
  const draftChip = page.locator('#is-talk-chips .is-chip').filter({ hasText: /draft|Hubly/i }).first();
  if (await draftChip.count()) await draftChip.click();
  else await fillTalk(page, 'draft');
  await sleep(300);

  await page.waitForSelector('#is-step-vibe.is-on', { timeout: 30000 });
  const vibes = page.locator('#is-vibe-grid .is-vibe-card');
  if ((await vibes.count()) < 2) fail('vibe cards missing');
  await vibes.nth(0).click();
  await page.locator('#is-vibe-continue').click();

  await page.waitForSelector('#is-step-email.is-on', { timeout: 15000 });
  await page.locator('#is-soft-email').fill(EMAIL);
  await page.locator('#is-step-email button.btn-brand').click();

  await page.waitForSelector('#is-step-discover.is-on', { timeout: 90000 });
  await page.locator('#is-biz-input').fill(BIZ);
  await page.locator('#is-step-discover button.btn-brand').click();

  await page.waitForSelector('#is-step-photos.is-on', { timeout: 20000 });
  const fontsOk = await page.evaluate(() => {
    const body = getComputedStyle(document.body).fontFamily || '';
    const display =
      getComputedStyle(document.querySelector('#is-shell h1, #is-shell .is-title, #ws-hero-headline') || document.body)
        .fontFamily || '';
    return { body, display, ok: !/Inter|Roboto|Arial|system-ui/i.test(display.split(',')[0] || '') || body.length > 0 };
  });
  console.log('fonts', fontsOk);

  const imgMeta = await page.evaluate(() => {
    const urls = (S.portfolioUrls || []).filter(Boolean);
    const main = S.bannerUrl || '';
    return { count: urls.length, main: !!main, dead: urls.some((u) => /photo-1600047509807/.test(u)) };
  });
  if (imgMeta.count < 2) fail('photos did not load for Instant Site');
  if (imgMeta.dead) fail('dead Unsplash seed still present');
  ok(`Instant Site photos (${imgMeta.count}) + banner`);

  await page.evaluate(async () => {
    const fin = isFinishSetup();
    await fin;
  });
  await page.waitForFunction(
    () => {
      const sf = document.getElementById('p-storefront')?.classList.contains('active');
      const reveal = document.getElementById('obs-reveal');
      return !!(sf && reveal && !reveal.classList.contains('hidden'));
    },
    null,
    { timeout: 120000 }
  );
  const hero = await page.evaluate(() => ({
    headline: (document.getElementById('ws-hero-headline')?.textContent || '').trim(),
    cta: (document.getElementById('ws-hero-cta')?.textContent || '').trim(),
    bg: !!document.querySelector('#ws-hero, .ws-hero') ,
  }));
  if (!hero.headline) fail('reveal missing headline');
  ok(`Instant Site reveal: "${hero.headline.slice(0, 48)}" CTA=${hero.cta || 'n/a'}`);
  const result = await page.evaluate(() => {
    if (typeof ensureGalleryAlbums === 'function') ensureGalleryAlbums();
    if (typeof renderWebsiteGallery === 'function') renderWebsiteGallery('ws-gallery');
    const imgs = [...document.querySelectorAll('#ws-gallery img, #ws-sec-gallery img')];
    const loaded = imgs.filter((img) => img.complete && img.naturalWidth > 0).length;
    const albums = (S.website && S.website.galleryAlbums) || [];
    const emptyPublic = albums.filter((a) => !(a.urls || []).length).length;
    const filled = albums.filter((a) => (a.urls || []).length).length;
    const heroBg =
      document.querySelector('#ws-hero')?.style?.backgroundImage ||
      getComputedStyle(document.querySelector('#ws-hero, .ws-hero') || document.body).backgroundImage ||
      '';
    return {
      imgCount: imgs.length,
      loaded,
      heroBg: !!heroBg && heroBg !== 'none',
      biz: S.biz || '',
      portfolio: (S.portfolioUrls || []).length,
      albumCount: albums.length,
      filledAlbums: filled,
      emptyAlbums: emptyPublic,
    };
  });
  if (result.portfolio < 2) fail('reveal portfolio empty');
  if (result.albumCount > 1 && result.filledAlbums < 2 && !result.imgCount) {
    fail('gallery albums empty on reveal');
  }
  if (result.imgCount > 0 && result.loaded === 0) {
    console.log('· gallery <img> present but not decoded yet — portfolio urls still seeded', result);
  } else {
    ok(
      `reveal images imgs=${result.imgCount} loaded=${result.loaded} portfolio=${result.portfolio} albums filled=${result.filledAlbums}/${result.albumCount}`
    );
  }
  return result;
}

async function runBookNow(page) {
  // Prefer an explicit package book so SQ intake always initializes with a service.
  const booked = await page.evaluate(() => {
    const svcs =
      (typeof getBookingServices === 'function' ? getBookingServices() : null) ||
      S.services ||
      S.editorSvcs ||
      [];
    const name = (svcs[0] && svcs[0].name) || null;
    if (name && typeof openBookingPage === 'function') {
      openBookingPage(name);
      return name;
    }
    if (typeof openBookingPage === 'function') openBookingPage(null);
    return name;
  });
  console.log('booking service', booked || '(default)');
  await page.waitForSelector('#bk-step-1.active', { timeout: 20000 });
  await page.waitForFunction(
    () => {
      const intake = document.getElementById('bk-sq-intake');
      if (!intake || intake.classList.contains('hidden')) return false;
      return intake.querySelectorAll('.sq-tile, .sq-stepper, .sq-field').length > 0;
    },
    null,
    { timeout: 15000 }
  );
  await sleep(400);

  const sq = await page.evaluate(() => {
    const intake = document.getElementById('bk-sq-intake');
    const est = document.getElementById('bk-sq-estimate');
    const more = intake?.querySelector('details.sq-more');
    const tiles = intake?.querySelectorAll('.sq-tile').length || 0;
    const disc = est?.querySelector('.sq-disclaimer')?.textContent || '';
    const total = est?.querySelector('.sq-estimate-total')?.textContent || '';
    return {
      intakeOn: intake && !intake.classList.contains('hidden'),
      tiles,
      more: !!more,
      disc,
      total,
      mode: document.getElementById('p-booking')?.classList.contains('bk-sq-mode'),
      bizType: S.businessType || '',
      svc: S.bkService || '',
    };
  });
  if (!sq.mode) fail('Book Now missing bk-sq-mode');
  if (!sq.intakeOn) fail('Book Now SQ intake not visible');
  if (!sq.tiles) fail('Book Now intake has no option tiles');
  // Price stays locked until Review — total/lines may be empty on step 1.
  const copyOk = await page.evaluate(() => {
    const title = (document.getElementById('bk-step-1-title')?.textContent || '').trim();
    const sub = (document.getElementById('bk-step-1-sub')?.textContent || '').trim();
    const vehicleHidden = !!document.getElementById('bk-vehicle-block')?.classList.contains('hidden');
    const booking = document.getElementById('p-booking');
    const estText =
      (document.getElementById('bk-sq-estimate')?.innerText || '') +
      (document.getElementById('bk-sq-mobile-est')?.innerText || '');
    const unlockLeak = /price unlocks|lock your total|price waits/i.test(estText);
    const richTiles = document.querySelectorAll('#bk-sq-intake .sq-tile-rich').length;
    return {
      title,
      sub,
      vehicleHidden,
      priceOpen: !!booking?.classList.contains('bk-price-open'),
      hasSummary: /Booking summary|Your booking|Your total/i.test(estText),
      unlockLeak,
      richTiles,
    };
  });
  if (/packages/i.test(copyOk.title)) fail('Book Now step-1 title wrongly says packages: ' + copyOk.title);
  if (!copyOk.vehicleHidden) fail('legacy vehicle block still visible under Smart Quote');
  if (copyOk.priceOpen) fail('Book Now price unlocked before review');
  if (copyOk.unlockLeak) fail('Book Now still shows price-unlock messaging to customers');
  if (!copyOk.hasSummary) fail('Book Now estimate missing booking summary');
  ok(
    `Book Now shell + ${sq.svc} · tiles=${sq.tiles} · rich=${copyOk.richTiles} · title="${copyOk.title}" · quiet sidebar`
  );

  const tile = page.locator('#bk-sq-intake .sq-tile').first();
  await tile.click();
  await sleep(200);

  await page.locator('#bk-step-1 button').filter({ hasText: /Continue/i }).click();
  await page.waitForSelector('#bk-step-2.active', { timeout: 10000 });

  const tomorrow = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  await page.locator('#bk-date').fill(tomorrow);
  await page.evaluate(() => checkTimeAvailability());
  await sleep(800);
  const openSlot = page.locator('#time-grid .vtype-opt:not(.booked-slot)').first();
  if (!(await openSlot.count())) fail('no open time slots');
  await openSlot.click();
  await page.locator('#bk-street').fill('100 Test Ave');
  await page.locator('#bk-city').fill('Bakersfield');
  await page.locator('#bk-state').fill('CA');
  await page.locator('#bk-zip').fill('93301');
  await page.locator('#bk-step-2 button').filter({ hasText: /Continue/i }).click();
  await page.waitForSelector('#bk-step-3.active', { timeout: 10000 });

  await page.locator('#bk-name').fill('Taylor Test');
  await page.locator('#bk-phone').fill('555-222-3333');
  await page.locator('#bk-email').fill(EMAIL);
  await page.locator('#bk-step-3 button').filter({ hasText: /Review/i }).click();
  await page.waitForSelector('#bk-step-4.active', { timeout: 15000 });

  const review = await page.evaluate(() => ({
    confirm: (document.getElementById('bk-confirm-btn')?.textContent || '').trim(),
    nudge: !document.getElementById('bk-abandon-nudge')?.classList.contains('hidden'),
    nudgeText: (document.getElementById('bk-abandon-nudge')?.textContent || '').trim(),
    summary: (document.getElementById('order-summary-el')?.textContent || '').trim().slice(0, 120),
    estimate: (document.getElementById('bk-sq-estimate')?.querySelector('.sq-estimate-total')?.textContent || '').trim(),
    priceOpen: !!document.getElementById('p-booking')?.classList.contains('bk-price-open'),
    unlocked: typeof HublyBookingSQ !== 'undefined' && !!HublyBookingSQ.priceUnlocked?.(),
    slotHint: (document.getElementById('bk-slot-hint')?.textContent || '').trim(),
  }));
  if (!/Confirm booking/i.test(review.confirm)) fail('confirm CTA missing');
  if (!review.priceOpen || !review.unlocked) fail('price still locked on review step');
  if (!review.estimate) fail('review estimate total missing');
  ok(`Book Now review CTA="${review.confirm}" nudge=${review.nudge} est=${review.estimate}`);
  if (review.nudge) ok(`abandon nudge: ${review.nudgeText.slice(0, 60)}`);
  else console.log('· abandon nudge not shown (DB insert may be blocked in local anon — UI path still wired)');
}

async function runSmartQuote(page) {
  await page.evaluate(() => {
    try {
      if (typeof closePublicBooking === 'function') closePublicBooking();
    } catch (e) {}
    try {
      document.getElementById('obs-reveal')?.classList.add('hidden');
      document.getElementById('ob-reveal-panel')?.classList.add('hidden');
      document.body.classList.remove('ws-booking-open');
    } catch (e) {}
    try {
      showP('p-app');
      const nav = document.querySelector('[data-v="quotes"]');
      if (nav) (typeof switchV === 'function' ? switchV(nav) : nav.click());
      else if (typeof HublySmartQuoteUI !== 'undefined') HublySmartQuoteUI.renderQuotesView();
    } catch (e) {
      console.error(e);
    }
  });
  await sleep(600);
  await page.waitForSelector('#v-quotes:not(.hidden), #v-quotes', { timeout: 15000 });

  await page.evaluate(() => HublySmartQuoteUI.openSetup());
  await page.waitForSelector('#m-sq-setup:not(.hidden)', { timeout: 8000 });
  const setupRows = await page.locator('#sq-setup-body .sq-setup-row').count();
  if (setupRows < 2) fail('Quote setup panel empty');
  await page.locator('#sq-setup-pkg-name').fill('E2E Package');
  await page.locator('#sq-setup-pkg-price').fill('149');
  await page.evaluate(() => HublySmartQuoteUI.addCustomPackageFromSetup());
  await sleep(200);
  await page.evaluate(() => HublySmartQuoteUI.saveSetup());
  await sleep(300);
  ok(`Quote setup panel (${setupRows} fields) + custom package`);

  await page.evaluate(() => HublySmartQuoteUI.openNew());
  await page.waitForSelector('#sq-workspace:not(.hidden)', { timeout: 8000 });
  const ws = await page.evaluate(() => {
    const total = document.querySelector('#sq-sidebar .sq-estimate-total')?.textContent || '';
    const disc = document.querySelector('#sq-sidebar .sq-disclaimer')?.textContent || '';
    const pkgs = document.querySelectorAll('#sq-main .sq-pkg').length;
    const stepTitle = (document.querySelector('#sq-main .sq-step-title h3')?.textContent || '').trim();
    const firstStep = HublySmartQuoteUI.getConfig()?.steps?.[0]?.id || '';
    const vehicleHidden = !!document.getElementById('bk-vehicle-block')?.classList.contains('hidden');
    const mobileEst = !!(document.getElementById('bk-sq-mobile-est')?.querySelector('.sq-estimate-total'));
    return { total, disc, pkgs, stepTitle, firstStep, vehicleHidden, mobileEst };
  });
  if (!ws.total) fail('Smart Quote estimate missing');
  if (!ws.disc) fail('Smart Quote disclaimer missing');
  if (ws.firstStep !== 'packages') fail('Smart Quote should start on packages, got ' + ws.firstStep);
  if (ws.pkgs < 1) fail('Smart Quote packages missing on first step');
  ok(`Smart Quote workspace pkgs=${ws.pkgs} total=${ws.total} start=${ws.firstStep}`);

  // Drive steps via API (reveal overlay can intercept clicks)
  await page.evaluate(() => {
    const cfg = HublySmartQuoteUI.getConfig();
    const pkgs = document.querySelectorAll('#sq-main .sq-pkg');
    if (pkgs[0]) {
      const onclick = pkgs[0].getAttribute('onclick') || '';
      const m = onclick.match(/togglePackage\('([^']+)'\)/);
      if (m) HublySmartQuoteUI.togglePackage(m[1]);
    }
    if (cfg?.steps?.length) {
      for (let i = 0; i < cfg.steps.length; i++) HublySmartQuoteUI.setStep(i);
      HublySmartQuoteUI.setCustomer('name', 'Casey Customer');
      HublySmartQuoteUI.setCustomer('phone', '555-111-0000');
      HublySmartQuoteUI.setCustomer('email', 'casey@example.com');
      HublySmartQuoteUI.setStep(cfg.steps.length - 1);
    }
  });
  await sleep(300);
  const reviewBtns = await page.evaluate(() =>
    [...document.querySelectorAll('#sq-main .sq-review-actions .btn, #sq-sidebar .sq-save-btn, #sq-main .sq-foot .btn-brand')].map((b) =>
      (b.textContent || '').trim()
    )
  );
  if (reviewBtns.filter((t) => /Save draft/i.test(t)).length !== 1) fail('expected single Save draft CTA on review');
  if (!reviewBtns.some((t) => /Email quote|Mark as sent/i.test(t))) fail('owner Email quote CTA missing');
  if (!reviewBtns.some((t) => /Book this/i.test(t))) fail('owner Book this CTA missing');
  const bodyReviewActions = await page.locator('#sq-main .sq-review-actions .btn').count();
  if (bodyReviewActions > 0) fail('review body should not duplicate CTAs');
  ok(`Smart Quote review CTAs: ${reviewBtns.join(' | ')}`);

  await page.evaluate(() => HublySmartQuoteUI.saveDraft());
  await sleep(400);
  const list = await page.locator('#sq-list .sq-list-row').count();
  if (list < 1) fail('saved quote not listed');
  const createdBefore = await page.evaluate(() => (S.quotes && S.quotes[0] && S.quotes[0].createdAt) || '');
  ok(`quote saved to list (${list})`);

  // Reopen from list should land on packages; re-save keeps createdAt
  await page.evaluate(() => {
    const id = S.quotes && S.quotes[0] && S.quotes[0].id;
    if (id) HublySmartQuoteUI.openSaved(id);
  });
  await sleep(300);
  await page.evaluate(() => HublySmartQuoteUI.saveDraft());
  await sleep(300);
  const reopened = await page.evaluate(() => ({
    createdAt: S.quotes && S.quotes[0] && S.quotes[0].createdAt,
    id: S.quotes && S.quotes[0] && S.quotes[0].id,
  }));
  if (createdBefore && reopened.createdAt !== createdBefore) fail('createdAt reset on re-save');
  await page.evaluate((id) => HublySmartQuoteUI.openSaved(id), reopened.id);
  await sleep(250);
  const onPackages = await page.evaluate(() => ({
    step: S._sq && S._sq.step,
    firstStep: HublySmartQuoteUI.getConfig()?.steps?.[0]?.id,
    pkgs: document.querySelectorAll('#sq-main .sq-pkg').length,
  }));
  if (onPackages.step !== 0 || onPackages.firstStep !== 'packages') fail('reopened quote not packages-first');
  if (onPackages.pkgs < 1) fail('reopened quote missing packages');
  ok(`quote reopen packages=${onPackages.pkgs} createdAt stable`);

  // Book this next should hydrate booking
  await page.evaluate(() => {
    HublySmartQuoteUI.setCustomer('name', 'Casey Customer');
    HublySmartQuoteUI.setCustomer('phone', '555-111-0000');
    HublySmartQuoteUI.bookThisQuote();
  });
  await sleep(500);
  const hydrated = await page.evaluate(() => ({
    booking: !!document.getElementById('bk-step-1')?.classList.contains('active'),
    name: document.getElementById('bk-name')?.value || '',
    svc: S.bkService || '',
  }));
  if (!hydrated.booking) fail('Book this next did not open booking');
  if (hydrated.name !== 'Casey Customer') fail('Book this next did not hydrate customer name');
  ok(`Book this next → ${hydrated.svc} for ${hydrated.name}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.warn('pageerror', e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.warn('console', msg.text());
});

try {
  console.log('E2E start', URL, BIZ, EMAIL);
  await runInstantSite(page);
  await runBookNow(page);
  await runSmartQuote(page);
  console.log('\nE2E PASS');
  process.exit(0);
} catch (e) {
  console.error('\nE2E FAIL', e.message);
  try {
    await page.screenshot({ path: '/tmp/hubly-e2e-fail.png', fullPage: true });
    console.error('screenshot /tmp/hubly-e2e-fail.png');
  } catch (_) {}
  try {
    await browser.close();
  } catch (_) {}
  process.exit(1);
} finally {
  try {
    await browser.close();
  } catch (_) {}
}
