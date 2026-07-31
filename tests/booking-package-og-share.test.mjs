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
    }
  );
  assert.match(out, /<title>Everlasting<\/title>/);
  assert.match(out, /property="og:title" content="Everlasting"/);
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
});

test('site package click locks package and skips re-picker', () => {
  assert.match(html, /autoPicked:true/);
  assert.match(html, /S\._bkPackageLocked=!opts\.autoPicked&&!opts\.fromQuote/);
  assert.match(booking, /function packageLocked/);
  assert.match(booking, /renderSelectedPackageChip/);
  assert.match(booking, /Customer already picked a package on the website/);
  assert.match(booking, /You selected/);
  assert.match(html, /Package already chosen on the website/);
  assert.match(html, /bk-step-2/);
});
