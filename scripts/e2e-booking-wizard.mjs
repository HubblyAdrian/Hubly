/**
 * E2E: Instant Site → Publish path → Booking Wizard → Book Now
 * Covers detailing + windows frames (where grid, save & exit, wizard shell).
 * Usage: node scripts/e2e-booking-wizard.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const URL = `${BASE}/hubly.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString(36);

function ok(msg) {
  console.log('✓', msg);
}
function fail(msg) {
  console.error('✗', msg);
  throw new Error(msg);
}

async function fillTalk(page, text) {
  const input = page.locator('#is-talk-input');
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill(text);
  await page.locator('#is-talk-send').click();
  await sleep(280);
}

async function runInstantSite(page, tradeChip) {
  const biz = `BW ${tradeChip} ${stamp}`;
  const email = `e2e.bw.${tradeChip}.${stamp}@hubly.test`;
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

  await fillTalk(page, 'Jordan Blake');
  await fillTalk(page, biz);
  const chip = page.locator('#is-talk-chips .is-chip').filter({ hasText: new RegExp(tradeChip, 'i') }).first();
  if (await chip.count()) await chip.click();
  else await fillTalk(page, tradeChip);
  await sleep(350);
  await fillTalk(page, '555-444-2211');
  await fillTalk(page, 'Provo');

  // Services choice beat (draft / now / later)
  await page.waitForFunction(
    () => (document.getElementById('is-talk-ask')?.textContent || '').toLowerCase().includes('services'),
    null,
    { timeout: 15000 }
  );
  const draftChip = page.locator('#is-talk-chips .is-chip').filter({ hasText: /draft|Hubly/i }).first();
  if (await draftChip.count()) await draftChip.click();
  else await fillTalk(page, 'draft');
  await sleep(350);

  await page.waitForSelector('#is-step-vibe.is-on', { timeout: 30000 });
  await page.locator('#is-vibe-grid .is-vibe-card').first().click();
  await page.locator('#is-vibe-continue').click();

  await page.waitForSelector('#is-step-email.is-on', { timeout: 15000 });
  await page.locator('#is-soft-email').fill(email);
  await page.locator('#is-step-email button.btn-brand').click();

  await page.waitForSelector('#is-step-discover.is-on', { timeout: 90000 });
  await page.locator('#is-biz-input').fill(biz);
  await page.locator('#is-step-discover button.btn-brand').click();

  await page.waitForSelector('#is-step-photos.is-on', { timeout: 20000 });
  await page.evaluate(async () => {
    await isFinishSetup();
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
  ok(`Instant Site reveal (${tradeChip})`);
  return { biz, email };
}

async function openWizardFromPublish(page) {
  const launched = await page.evaluate(() => {
    S._bookingWizardDone = false;
    S._suppressBookingWizard = false;
    try {
      localStorage.removeItem('hubly_booking_wizard_done_' + (S.slug || 'draft'));
    } catch (e) {}
    // Soft-mock a claimed account so finish paths can run locally without auth.
    if (!window.currentBusiness) {
      window.currentBusiness = {
        id: 'e2e-bw-' + Date.now(),
        slug: S.slug || 'e2e-bw',
        name: S.biz || 'E2E',
      };
    }
    if (typeof HublyBookingFrames !== 'undefined') HublyBookingFrames.loadAll();
    if (typeof openBookingWizardFromSuccess === 'function') openBookingWizardFromSuccess();
    else if (typeof HublyBookingWizardUI !== 'undefined') HublyBookingWizardUI.open();
    else return false;
    return true;
  });
  if (!launched) fail('Booking wizard open helpers missing');
  await page.waitForSelector('#v-booking-wizard:not(.hidden)', { timeout: 20000 });
  await page.waitForFunction(
    () => {
      const ed = document.getElementById('bw-editor');
      return ed && ed.querySelectorAll('.bw-sec').length >= 3;
    },
    null,
    { timeout: 15000 }
  );
  const prev = await page.locator('#bw-preview .bw-prev-shell').count();
  if (!prev) fail('wizard live preview missing');
  ok('Booking Wizard shell + preview');
}

async function editWizardAndPreview(page) {
  await page.locator('#bw-editor input.bw-input').first().fill('Book a standout visit');
  await sleep(200);
  const headline = await page.evaluate(() => {
    const h = document.querySelector('#bw-preview h2');
    return (h && h.textContent) || '';
  });
  if (!/standout/i.test(headline)) fail('wizard preview did not update headline');
  ok('wizard edit → live preview');
}

async function runBookNowSmoke(page, trade) {
  await page.evaluate(() => {
    try {
      document.getElementById('obs-reveal')?.classList.add('hidden');
      document.getElementById('ob-reveal-panel')?.classList.add('hidden');
      document.body.classList.remove('ws-booking-open');
    } catch (e) {}
    try {
      HublyBookingWizardUI.syncServicesOut();
      HublyBookingWizardUI.persistLocal();
    } catch (e) {}
    S._bookingWizardDone = true;
    const svcs =
      (typeof getBookingServices === 'function' ? getBookingServices() : null) ||
      S.editorSvcs ||
      S.services ||
      [];
    const name = (svcs[0] && svcs[0].name) || null;
    if (typeof setOwnerPreview === 'function') setOwnerPreview(true);
    if (name) openBookingPage(name, { forceNoPromo: true });
    else openBookingPage(null, { forceNoPromo: true });
  });
  await page.waitForSelector('#bk-step-1.active', { timeout: 20000 });
  await page.waitForSelector('#bk-save-exit', { timeout: 8000 });

  const step1 = await page.evaluate(() => {
    const title = (document.getElementById('bk-step-1-title')?.textContent || '').trim();
    const where = document.getElementById('bk-where-grid');
    return {
      title,
      mode: document.getElementById('p-booking')?.classList.contains('bk-sq-mode'),
      whereBefore: where ? where.children.length : 0,
      unlockLeak: /price unlocks|lock your total/i.test(document.getElementById('bk-sq-estimate')?.innerText || ''),
    };
  });
  if (!step1.mode) fail('Book Now not in SQ mode');
  if (step1.unlockLeak) fail('price unlock copy leaked');
  ok(`Book Now step 1 (${trade}) title="${step1.title.slice(0, 48)}"`);

  await page.evaluate(() => bkNext(1));
  await page.waitForSelector('#bk-step-2.active', { timeout: 10000 });
  await page.waitForFunction(() => (document.getElementById('bk-where-grid')?.children.length || 0) > 0, null, {
    timeout: 8000,
  });
  const whereN = await page.locator('#bk-where-grid .bk-where-card').count();
  if (whereN < 2) fail('where options missing on step 2');
  await page.evaluate(() => {
    const card = document.querySelector('#bk-where-grid .bk-where-card');
    if (card) card.click();
  });
  ok(`Where & When cards (${whereN})`);

  const tomorrow = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  await page.evaluate((ds) => {
    if (typeof selBkCalDate === 'function') selBkCalDate(ds);
    else {
      const el = document.getElementById('bk-date');
      if (el) {
        el.value = ds;
        el.dispatchEvent(new Event('change'));
      }
    }
    try {
      checkTimeAvailability();
    } catch (e) {}
  }, tomorrow);
  await sleep(600);
  await page.evaluate(() => {
    const slot = document.querySelector('#time-grid .vtype-opt:not(.booked-slot)');
    if (slot) slot.click();
  });
  await page.locator('#bk-street').fill('200 Wizard Ave');
  await page.locator('#bk-city').fill('Provo');
  await page.locator('#bk-state').fill('UT');
  await page.locator('#bk-zip').fill('84601');
  await page.evaluate(() => bkNext(2));
  await page.waitForSelector('#bk-step-3.active', { timeout: 10000 });

  await page.locator('#bk-name').fill('Sam Softlead');
  await page.locator('#bk-phone').fill('555-777-8899');
  await page.locator('#bk-email').fill(`save.exit.${stamp}@hubly.test`);

  await page.evaluate(() => saveAndExitBooking());
  await sleep(500);
  ok('Save & exit invoked');

  // Re-enter for review Edit links smoke
  await page.evaluate(() => {
    document.getElementById('obs-reveal')?.classList.add('hidden');
    const svcs =
      (typeof getBookingServices === 'function' ? getBookingServices() : null) ||
      S.editorSvcs ||
      S.services ||
      [];
    const name = (svcs[0] && svcs[0].name) || null;
    if (name) openBookingPage(name, { forceNoPromo: true });
  });
  await page.waitForSelector('#bk-step-1.active', { timeout: 15000 });
  await page.evaluate(() => bkNext(1));
  await page.waitForSelector('#bk-step-2.active', { timeout: 8000 });
  await page.evaluate((ds) => {
    if (typeof selBkCalDate === 'function') selBkCalDate(ds);
    else {
      const el = document.getElementById('bk-date');
      if (el) {
        el.value = ds;
        el.dispatchEvent(new Event('change'));
      }
    }
    try {
      checkTimeAvailability();
    } catch (e) {}
  }, tomorrow);
  await sleep(400);
  await page.evaluate(() => {
    const slot = document.querySelector('#time-grid .vtype-opt:not(.booked-slot)');
    if (slot) slot.click();
  });
  await page.locator('#bk-street').fill('200 Wizard Ave');
  await page.locator('#bk-city').fill('Provo');
  await page.locator('#bk-state').fill('UT');
  await page.locator('#bk-zip').fill('84601');
  await page.evaluate(() => bkNext(2));
  await page.waitForSelector('#bk-step-3.active', { timeout: 8000 });
  await page.locator('#bk-name').fill('Sam Softlead');
  await page.locator('#bk-phone').fill('555-777-8899');
  await page.locator('#bk-email').fill(`review.${stamp}@hubly.test`);
  await page.evaluate(() => bkNext(3));
  await page.waitForSelector('#bk-step-4.active', { timeout: 12000 });
  const edits = await page.locator('#bk-details-summary .bk-review-edit').count();
  if (edits < 2) fail('review Edit links missing');
  ok(`Review summary with ${edits} Edit links`);
}

async function assertFramesLoaded(page) {
  const ids = await page.evaluate(async () => {
    if (typeof HublyBookingFrames === 'undefined') return [];
    await HublyBookingFrames.loadAll();
    return HublyBookingFrames.list().map((f) => f.id);
  });
  for (const need of ['detailing', 'windows', 'cleaning', 'hvac', 'landscaping', 'spa', 'pressure_washing', 'photography']) {
    if (!ids.includes(need)) fail('missing booking frame: ' + need);
  }
  ok(`booking frames loaded (${ids.length})`);
}

async function runTrade(browser, tradeChip, tradeId) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  try {
    await runInstantSite(page, tradeChip);
    await assertFramesLoaded(page);
    await openWizardFromPublish(page);
    await editWizardAndPreview(page);
    // Force frame id alignment for windows path
    await page.evaluate((id) => {
      S.businessType = id;
      if (typeof HublyBookingFrames !== 'undefined') {
        S.bookingWizard = HublyBookingFrames.seedWizard({
          businessType: id,
          services: S.editorSvcs || S.services,
          addons: S.editorAddons,
          existing: null,
        });
      }
      try {
        HublyBookingWizardUI.renderEditor();
        HublyBookingWizardUI.renderPreview();
      } catch (e) {}
    }, tradeId);
    await runBookNowSmoke(page, tradeId);
    ok(`trade path complete: ${tradeId}`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await runTrade(browser, 'detail', 'detailing');
    await runTrade(browser, 'window', 'windows');
    console.log('\nAll Booking Wizard e2e checks passed.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
