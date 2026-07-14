/**
 * Browser smoke: Instant Site talk → build → reveal (no blank screen on save).
 * Usage: node scripts/smoke-instant-site.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8766';
const URL = `${BASE.replace(/\/$/, '')}/hubly.html`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fillTalk(page, text) {
  const input = page.locator('#is-talk-input');
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill(text);
  await page.locator('#is-talk-send').click();
  await sleep(350);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  console.log('open', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.startInstantSite === 'function', null, {
    timeout: 30000,
  });

  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    startInstantSite();
  });

  await page.waitForSelector('#is-shell', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('#is-step-talk.is-on', { timeout: 15000 });

  const stamp = Date.now().toString(36).slice(-5);
  const bizName = `Jordan Windows ${stamp}`;

  await fillTalk(page, 'Jordan Lee');
  await fillTalk(page, bizName);

  // Prefer window-cleaning chip; fall back to typed trade
  const windowChip = page.locator('#is-talk-chips .is-chip').filter({ hasText: /window/i }).first();
  if (await windowChip.count()) {
    const label = await windowChip.innerText();
    console.log('pick trade chip', label.trim());
    await windowChip.click();
    await sleep(400);
  } else {
    await fillTalk(page, 'window cleaning');
  }

  await fillTalk(page, '555-123-4567');
  await fillTalk(page, 'Austin');

  // Build → discover
  await page.waitForSelector('#is-step-discover.is-on', { timeout: 90000 });
  console.log('discover step');
  const bizInput = page.locator('#is-biz-input');
  if (await bizInput.count()) {
    await bizInput.fill(bizName);
  }
  await page.locator('#is-step-discover button.btn-brand').click();

  // Inspire → skip
  await page.waitForSelector('#is-step-inspire.is-on', { timeout: 20000 });
  console.log('inspire step — skip');
  await page.locator('#is-step-inspire .btn-out, #is-step-inspire button:has-text("Skip")').first().click();

  // Photos → Show my site
  await page.waitForSelector('#is-step-photos.is-on', { timeout: 20000 });
  console.log('photos step — finish');

  // Observe blank-gap risk during save: track active page + building flag around finish
  const transition = page.evaluate(async () => {
    const snapshots = [];
    const snap = (label) => {
      const active = [...document.querySelectorAll('.page.active')].map((p) => p.id);
      const building = document.getElementById('p-onboard')?.classList.contains('cd-building');
      const isShell = document.getElementById('is-shell');
      const isDisp = isShell ? getComputedStyle(isShell).display : 'missing';
      const storefront = document.getElementById('p-storefront')?.classList.contains('active');
      const revealHidden = document.getElementById('obs-reveal')?.classList.contains('hidden');
      const buildingHidden = document.getElementById('obs-building')?.classList.contains('hidden');
      const textLen = (document.getElementById('ws-hero-headline')?.textContent || '').trim().length;
      snapshots.push({
        label,
        active,
        building,
        isDisp,
        storefront,
        revealHidden,
        buildingHidden,
        textLen,
      });
    };
    snap('before-finish');
    const fin = isFinishSetup();
    // sample a few frames while save runs
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 200));
      snap(`t=${(i + 1) * 200}ms`);
    }
    await fin;
    snap('after-finish');
    return snapshots;
  });

  // Also click the button path isn't needed since we called isFinishSetup
  const snaps = await transition;

  await page.waitForFunction(
    () => {
      const sf = document.getElementById('p-storefront')?.classList.contains('active');
      const reveal = document.getElementById('obs-reveal');
      const revealOn = reveal && !reveal.classList.contains('hidden');
      const recovered =
        document.getElementById('p-onboard')?.classList.contains('is-active') &&
        getComputedStyle(document.getElementById('is-shell') || document.body).display !== 'none';
      return !!(sf && revealOn) || recovered;
    },
    null,
    { timeout: 120000 }
  );

  const result = await page.evaluate(() => {
    const sf = document.getElementById('p-storefront');
    const reveal = document.getElementById('obs-reveal');
    const headline = (document.getElementById('ws-hero-headline')?.textContent || '').trim();
    const onboardingActive = document.getElementById('p-onboard')?.classList.contains('active');
    const building = document.getElementById('p-onboard')?.classList.contains('cd-building');
    const toast = document.getElementById('toast')?.textContent || '';
    return {
      storefrontActive: !!sf?.classList.contains('active'),
      revealVisible: !!(reveal && !reveal.classList.contains('hidden')),
      headline,
      onboardingActive,
      building,
      toast,
      biz: window.S?.biz || '',
      instant: !!window.S?._instantSite,
      blankSuspect:
        !sf?.classList.contains('active') &&
        onboardingActive &&
        !document.getElementById('p-onboard')?.classList.contains('is-active') &&
        !document.getElementById('p-onboard')?.classList.contains('cd-building'),
    };
  });

  console.log('transition samples:', JSON.stringify(snaps, null, 2));
  console.log('result:', JSON.stringify(result, null, 2));
  if (errors.length) console.log('errors:', errors.slice(0, 12));

  // Fail if we ever sat on active onboard with shell hidden and no building chrome (true blank)
  const trueBlank = snaps.filter(
    (s) =>
      s.label !== 'before-finish' &&
      s.active.length === 1 &&
      s.active[0] === 'p-onboard' &&
      !s.building &&
      (s.isDisp === 'none' || s.isDisp === 'missing') &&
      s.buildingHidden
  );

  let failed = false;
  const recovered =
    result.onboardingActive &&
    !result.building &&
    !result.blankSuspect &&
    (result.toast || '').toLowerCase().includes('could not save');

  if (result.storefrontActive && result.revealVisible) {
    console.log('path: reveal ok');
  } else if (recovered || (result.onboardingActive && !result.blankSuspect && !(result.toast || '').includes('Could not save'))) {
    // Recovered Instant Site shell after save error — must not be blank
    const shellOk = await page.evaluate(() => {
      const shell = document.getElementById('is-shell');
      return (
        document.getElementById('p-onboard')?.classList.contains('is-active') &&
        shell &&
        getComputedStyle(shell).display !== 'none'
      );
    });
    if (!shellOk) {
      console.error('FAIL: save failed but Instant Site shell not restored');
      failed = true;
    } else {
      console.log('path: save failed, Instant Site chrome restored (not blank)');
    }
  } else {
    console.error('FAIL: expected storefront + reveal (or recovered Instant Site shell)');
    failed = true;
  }
  if (result.blankSuspect) {
    console.error('FAIL: blank-screen state detected at end');
    failed = true;
  }
  if (trueBlank.length) {
    console.error('FAIL: blank frames during transition', trueBlank);
    failed = true;
  }
  if (result.storefrontActive && !result.headline) {
    console.error('FAIL: storefront headline empty (looks blank)');
    failed = true;
  }
  if (errors.some((e) => /Maximum call stack/i.test(e))) {
    console.error('FAIL: stack overflow during Instant Site');
    failed = true;
  }

  await browser.close();
  if (failed) process.exit(1);
  console.log('SMOKE OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
