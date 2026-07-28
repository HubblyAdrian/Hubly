import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bw = fs.readFileSync(path.join(root, 'public/booking-wizard/ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');
const sq = fs.readFileSync(path.join(root, 'public/smart-quote/ui.js'), 'utf8');

test('Book Now add-ons editor uses labeled cards', () => {
  assert.match(bw, /bw-addon-card/);
  assert.match(bw, /bw-addon-fields/);
  assert.match(bw, /placeholder="e\.g\. Edging upgrade"/);
  assert.match(html, /\.bw-addon-card\{/);
});

test('Book Now live preview uses card chrome for add-ons and questions', () => {
  assert.match(bw, /bw-prev-addon/);
  assert.match(bw, /bw-prev-asked/);
  assert.match(bw, /Customize questions/);
  assert.match(html, /\.bw-prev-addon\{/);
  assert.match(html, /\.bw-prev-benefit\{/);
  assert.doesNotMatch(
    bw,
    /<input type="checkbox" disabled>/,
    'preview must not use bare disabled checkbox add-on rows'
  );
});

test('Questions hub has clearer section chrome', () => {
  assert.match(sq, /sq-setup-count/);
  assert.match(html, /Questions<\/h2>/);
  assert.match(html, /\.sq-setup-count\{/);
});

test('Add-ons rail deep-link uses setSection', () => {
  assert.match(html, /HublyBookingWizardUI\.setSection\('addons'\)/);
});
