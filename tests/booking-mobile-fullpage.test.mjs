import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');
const booking = fs.readFileSync(path.join(root, 'public/smart-quote/booking.js'), 'utf8');
const skin = fs.readFileSync(path.join(root, 'public/booking-wizard/mock-skin.css'), 'utf8');

test('booking header does not show Edited gallery / trust tagline', () => {
  assert.match(booking, /Don't put frame trust lines/);
  assert.match(html, /\.booking-tag\{display:none!important\}/);
  assert.doesNotMatch(
    booking,
    /tag\.textContent = tagline/
  );
});

test('mobile booking hides summary and uses full-page scroll', () => {
  assert.match(booking, /Mobile: no booking-summary card/);
  assert.match(html, /\.bk-sq-mode \.bk-sq-mobile-est[\s\S]*?display:none!important/);
  assert.match(html, /\.bk-sq-mode \.booking-steps\{[\s\S]*?overflow-y:auto/);
  assert.match(html, /\.bk-sq-mode \.bk-step-inner\{[\s\S]*?border:none!important/);
  assert.match(html, /\.bk-sq-mode \.bk-step-body\{[\s\S]*?overflow:visible!important/);
  assert.match(skin, /\.bk-sq-mobile-est\{display:none!important\}/);
});
