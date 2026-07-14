/**
 * Browser smoke: Instant Site talk → vibe → soft email → build → reveal.
 * Also checks draft reuse on restart (same browser storage) and no blank save→reveal.
 * Usage: node scripts/smoke-instant-site.mjs [baseUrl]
 */
console.log('smoke boot');
const { chromium } = await import('playwright');
console.log('playwright loaded');

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

async function runThroughTalkToReveal(page, { bizName, softEmail, clearStorage }) {
  if (clearStorage) {
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
    });
  }

  await page.evaluate(() => startInstantSite());
  await page.waitForSelector('#is-shell', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('#is-step-talk.is-on', { timeout: 15000 });

  await fillTalk(page, 'Jordan Lee');
  await fillTalk(page, bizName);

  const windowChip = page.locator('#is-talk-chips .is-chip').filter({ hasText: /window/i }).first();
  if (await windowChip.count()) {
    console.log('pick trade chip', (await windowChip.innerText()).trim());
    await windowChip.click();
    await sleep(400);
  } else {
    await fillTalk(page, 'window cleaning');
  }

  await fillTalk(page, '555-123-4567');
  await fillTalk(page, 'Austin');

  // Vibe step (replaces skippable inspire as the taste moment)
  await page.waitForSelector('#is-step-vibe.is-on', { timeout: 30000 });
  const vibeCards = page.locator('#is-vibe-grid .is-vibe-card');
  const vibeCount = await vibeCards.count();
  console.log('vibe cards', vibeCount);
  if (vibeCount < 3) throw new Error('expected ≥3 vibe cards');
  await vibeCards.nth(Math.min(1, vibeCount - 1)).click();
  await page.locator('#is-vibe-continue').click();

  // Soft email
  await page.waitForSelector('#is-step-email.is-on', { timeout: 15000 });
  if (softEmail) {
    await page.locator('#is-soft-email').fill(softEmail);
    await page.locator('#is-step-email button.btn-brand').click();
  } else {
    await page.locator('#is-step-email button.btn-out').click();
  }

  // Build → discover
  await page.waitForSelector('#is-step-discover.is-on', { timeout: 90000 });
  console.log('discover step');
  await page.locator('#is-biz-input').fill(bizName);
  await page.locator('#is-step-discover button.btn-brand').click();

  // Photos (inspire skipped on main path)
  await page.waitForSelector('#is-step-photos.is-on', { timeout: 20000 });
  console.log('photos step — hero + gallery');

  await page.waitForSelector('#is-photo-hero .is-photo-hero-btn, #is-photo-hero .is-photo-hero-empty', {
    timeout: 10000,
  });
  const photoMeta = await page.evaluate(() => {
    const seeds =
      typeof HublyBlueprints !== 'undefined' && HublyBlueprints.seedImages
        ? HublyBlueprints.seedImages(S.businessType || 'windows') || []
        : [];
    const detailing =
      typeof HublyBlueprints !== 'undefined' && HublyBlueprints.seedImages
        ? HublyBlueprints.seedImages('detailing') || []
        : [];
    const portfolio = (S.portfolioUrls || []).filter(Boolean);
    const bleed = portfolio.filter((u) => detailing.includes(u) && !seeds.includes(u));
    const main = S.bannerUrl || '';
    const atmos = document.getElementById('is-atmos');
    const bg = atmos ? atmos.style.backgroundImage || '' : '';
    return {
      trade: S.businessType || '',
      portfolioCount: portfolio.length,
      main,
      mainIsInPortfolio: portfolio.includes(main),
      heroLabeled: !!document.querySelector('#is-photo-hero .is-photo-hero-badge'),
      galleryCount: document.querySelectorAll('#is-photo-thumbs .is-photo-thumb').length,
      deadSeedPresent: portfolio.some((u) => /photo-1600047509807-ba8f99d2cdbc/i.test(u)),
      detailingBleed: bleed,
      atmosHasMain: !!(main && bg.includes(main.split('?')[0].split('/').pop())),
    };
  });
  console.log('photos meta', JSON.stringify(photoMeta, null, 2));
  if (!photoMeta.heroLabeled) throw new Error('main photo not labeled');
  if (photoMeta.portfolioCount < 3) throw new Error('expected stock gallery on photos step');
  if (!photoMeta.mainIsInPortfolio) throw new Error('bannerUrl not in portfolio');
  if (photoMeta.deadSeedPresent) throw new Error('dead window seed still present');
  if (photoMeta.detailingBleed.length) {
    throw new Error('detailing stock bled into windows portfolio');
  }

  const galleryBtn = page.locator('#is-photo-thumbs .is-photo-thumb').first();
  if ((await galleryBtn.count()) > 0) {
    const before = photoMeta.main;
    await galleryBtn.click();
    await sleep(200);
    const after = await page.evaluate(() => S.bannerUrl || '');
    if (!after || after === before) throw new Error('tapping gallery thumb did not change main photo');
    const atmosOk = await page.evaluate(() => {
      const main = S.bannerUrl || '';
      const bg = document.getElementById('is-atmos')?.style.backgroundImage || '';
      return !!(main && bg.includes(main.split('?')[0].split('/').pop()));
    });
    if (!atmosOk) throw new Error('atmosphere did not follow new main photo');
    console.log('path: gallery tap set main');
  }

  console.log('photos step — finish');

  const snaps = await page.evaluate(async () => {
    const snapshots = [];
    const snap = (label) => {
      const active = [...document.querySelectorAll('.page.active')].map((p) => p.id);
      const building = document.getElementById('p-onboard')?.classList.contains('cd-building');
      const isShell = document.getElementById('is-shell');
      const isDisp = isShell ? getComputedStyle(isShell).display : 'missing';
      snapshots.push({
        label,
        active,
        building,
        isDisp,
        storefront: !!document.getElementById('p-storefront')?.classList.contains('active'),
        revealHidden: !!document.getElementById('obs-reveal')?.classList.contains('hidden'),
        buildingHidden: !!document.getElementById('obs-building')?.classList.contains('hidden'),
        preferred: window.S?._preferredLayout || null,
      });
    };
    snap('before-finish');
    const fin = isFinishSetup();
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 200));
      snap(`t=${(i + 1) * 200}ms`);
    }
    await fin;
    snap('after-finish');
    return snapshots;
  });

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

  const result = await page.evaluate(() => ({
    storefrontActive: !!document.getElementById('p-storefront')?.classList.contains('active'),
    revealVisible: !document.getElementById('obs-reveal')?.classList.contains('hidden'),
    headline: (document.getElementById('ws-hero-headline')?.textContent || '').trim(),
    preferred: typeof S !== 'undefined' ? S._preferredLayout : null,
    softEmail: (() => {
      try {
        return localStorage.getItem('hubly_soft_email') || '';
      } catch (e) {
        return '';
      }
    })(),
    draftEmail: (() => {
      try {
        return JSON.parse(localStorage.getItem('hubly_draft_login') || 'null')?.email || '';
      } catch (e) {
        return '';
      }
    })(),
    toast: document.getElementById('toast')?.textContent || '',
  }));

  return { snaps, result };
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

  const stamp = Date.now().toString(36).slice(-5);
  const bizName = `Jordan Windows ${stamp}`;
  const softEmail = `jordan.${stamp}@example.com`;

  const first = await runThroughTalkToReveal(page, {
    bizName,
    softEmail,
    clearStorage: true,
  });
  console.log('first reveal', JSON.stringify(first.result, null, 2));

  if (!first.result.storefrontActive || !first.result.revealVisible) {
    throw new Error('first run did not reach storefront + reveal');
  }
  if (!first.result.softEmail || first.result.softEmail !== softEmail) {
    throw new Error('soft email not stored');
  }
  if (!first.result.draftEmail || !/^draft-/i.test(first.result.draftEmail)) {
    throw new Error('draft login missing after first save');
  }
  if (!first.result.preferred) {
    throw new Error('preferred layout missing after vibe');
  }

  const trueBlank = first.snaps.filter(
    (s) =>
      s.label !== 'before-finish' &&
      s.active.length === 1 &&
      s.active[0] === 'p-onboard' &&
      !s.building &&
      (s.isDisp === 'none' || s.isDisp === 'missing') &&
      s.buildingHidden
  );
  if (trueBlank.length) {
    console.error('blank frames', trueBlank);
    throw new Error('blank frames during save→reveal');
  }
  console.log('path: reveal ok + vibe preferred=', first.result.preferred);

  // Restart Instant Site in same browser — must reuse the same draft auth email.
  const draftBefore = first.result.draftEmail;
  const secondBiz = `Jordan Windows ${stamp}b`;
  const second = await runThroughTalkToReveal(page, {
    bizName: secondBiz,
    softEmail,
    clearStorage: false,
  });
  console.log('second reveal', JSON.stringify(second.result, null, 2));
  if (second.result.draftEmail !== draftBefore) {
    throw new Error(
      `draft spam: expected reuse ${draftBefore}, got ${second.result.draftEmail}`
    );
  }
  console.log('path: draft reused on restart');

  if (errors.some((e) => /Maximum call stack/i.test(e))) {
    throw new Error('stack overflow during Instant Site');
  }

  await browser.close();
  console.log('SMOKE OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
