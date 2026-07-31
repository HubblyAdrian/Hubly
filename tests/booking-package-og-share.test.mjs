import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const router = require(path.join(root, 'api/router.js'));
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');
const booking = fs.readFileSync(path.join(root, 'public/smart-quote/booking.js'), 'utf8');

test('business subdomain share meta uses business name not Hubly marketing', () => {
  assert.equal(typeof router.applyBusinessShareMeta, 'function');
  assert.equal(router.slugToDisplayName('everlasting'), 'Everlasting');
  const out = router.applyBusinessShareMeta(
    '<html><head><title>Hubly · Book more jobs</title><meta property="og:title" content="Hubly · Book more jobs"><meta property="og:description" content="Website and booking"></head><body></body></html>',
    {
      title: 'Everlasting',
      description: 'Timeless photos. Real moments.',
      image: 'https://example.com/banner.jpg',
      url: 'https://everlasting.myhubly.app/',
      siteName: 'Everlasting',
      updatedTime: '2026-07-31T00:00:00.000Z',
    }
  );
  assert.match(out, /<title>Everlasting<\/title>/);
  assert.match(out, /property="og:title" content="Everlasting"/);
  assert.match(out, /property="og:site_name" content="Everlasting"/);
  assert.match(out, /property="og:updated_time" content="2026-07-31T00:00:00\.000Z"/);
  assert.match(out, /property="og:description" content="Timeless photos\. Real moments\."/);
  assert.match(out, /property="og:image" content="https:\/\/example\.com\/banner\.jpg"/);
  assert.doesNotMatch(out, /Hubly · Book more jobs/);
});

test('router resolves business slug from host', () => {
  assert.equal(
    router.businessSlugFromReq({ headers: { host: 'everlasting.myhubly.app' } }),
    'everlasting'
  );
  assert.equal(router.businessSlugFromReq({ headers: { host: 'myhubly.app' } }), null);
});

test('client applyWebsiteSeo updates og:title for public sites', () => {
  assert.match(html, /function applyWebsiteSeo/);
  assert.match(html, /setOg\('og:title',title\)/);
  assert.match(html, /applyWebsiteSeo\(\)/);
  assert.match(html, /function resolveShareImageUrl/);
  assert.match(html, /resolveShareImageUrl\(\)/);
  assert.match(html, /shareImageUrl/);
  assert.match(html, /function handleShareImageUpload/);
  assert.match(html, /Link preview photo/);
});

test('mobile package cards keep faces in frame (taller crop + top position)', () => {
  assert.match(html, /object-position:center 18%/);
  assert.match(html, /\.ws-svc-img\{height:auto;aspect-ratio:5\/6/);
  assert.match(html, /\.ws-bk-svc-card \.ws-svc-img\{height:auto!important;aspect-ratio:5\/6/);
});

test('site package click locks package and skips re-picker', () => {
  assert.match(html, /autoPicked:true/);
  assert.match(html, /S\._bkPackageLocked=!opts\.autoPicked&&!opts\.fromQuote/);
  assert.match(html, /Pick a package to continue/);
  assert.match(html, /ws-svc-card-bookable/);
  assert.match(booking, /function packageLocked/);
  assert.match(booking, /renderSelectedPackageChip/);
  assert.match(booking, /Customer already picked a package on the website/);
  assert.match(booking, /You selected/);
  assert.match(booking, /bk-selected-pkg-host/);
  assert.match(html, /Package already chosen on the website/);
  assert.match(html, /bk-step-2/);
});

test('photography booking asks Choose a package not What kind of shoot', () => {
  const frame = fs.readFileSync(
    path.join(root, 'public/booking-frames/photography.json'),
    'utf8'
  );
  assert.match(frame, /"servicePrompt": "Choose a package"/);
  assert.doesNotMatch(frame, /What kind of shoot\?/);
});