/**
 * Capture Booking Wizard screenshots for review.
 * Usage: node scripts/screenshot-booking-wizard.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'tmp');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

import { mkdir } from 'fs/promises';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/hubly.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof HublyBookingWizardUI !== 'undefined', null, { timeout: 30000 });
await sleep(800);

await page.evaluate(async () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {}
  S.biz = 'Summit Shine Detailing';
  S.slug = 'summit-shine';
  S.businessType = 'detailing';
  S._blueprintConfirmed = true;
  S.city = 'Provo';
  S.editorSvcs = [
    {
      name: 'Interior Detail',
      desc: 'Deep clean seats, carpets, and surfaces',
      price: 149,
      dur: '2',
      imgUrl: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=600&q=80',
      popular: true,
    },
    {
      name: 'Exterior Detail',
      desc: 'Wash, clay, and hand-wax finish',
      price: 129,
      dur: '1.5',
      imgUrl: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=600&q=80',
      popular: false,
    },
    {
      name: 'Full Detail',
      desc: 'Interior + exterior package',
      price: 249,
      dur: '3',
      imgUrl: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=600&q=80',
      popular: false,
    },
  ];
  S.editorAddons = [
    { name: 'Pet hair removal', price: 35 },
    { name: 'Engine bay clean', price: 45 },
  ];
  S.services = S.editorSvcs.map((s) => ({ name: s.name, price: s.price, dur: s.dur, desc: s.desc, imgUrl: s.imgUrl }));
  if (typeof HublyBookingFrames !== 'undefined') {
    await HublyBookingFrames.loadAll();
    S.bookingWizard = HublyBookingFrames.seedWizard({
      businessType: 'detailing',
      services: S.editorSvcs,
      addons: S.editorAddons,
    });
  }
  window.currentBusiness = { id: 'shot-demo', slug: S.slug, name: S.biz };
  HublyBookingWizardUI.open();
});

await page.waitForSelector('#v-booking-wizard:not(.hidden)', { timeout: 15000 });
await page.waitForSelector('#bw-preview .bw-prev-shell', { timeout: 10000 });
await sleep(1200);

const wizardPath = path.join(OUT, 'booking-wizard.png');
await page.screenshot({ path: wizardPath, fullPage: false });
console.log('saved', wizardPath);

// Book Now preview from wizard
await page.evaluate(() => {
  document.getElementById('obs-reveal')?.classList.add('hidden');
  HublyBookingWizardUI.syncServicesOut();
  openBookingPage('Interior Detail', { forceNoPromo: true });
});
await page.waitForSelector('#bk-step-1.active', { timeout: 15000 });
await sleep(1000);
const book1 = path.join(OUT, 'book-now-step1.png');
await page.screenshot({ path: book1, fullPage: false });
console.log('saved', book1);

await page.evaluate(() => {
  if (typeof HublyBookingSQ !== 'undefined') {
    const tiles = document.querySelectorAll('#bk-sq-intake .sq-tile');
    if (tiles[0]) tiles[0].click();
  }
  bkNext(1);
});
await page.waitForSelector('#bk-step-2.active', { timeout: 10000 });
await sleep(800);
const book2 = path.join(OUT, 'book-now-where.png');
await page.screenshot({ path: book2, fullPage: false });
console.log('saved', book2);

await browser.close();
console.log('done');
