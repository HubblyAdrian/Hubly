import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');
const journey = fs.readFileSync(path.join(root, 'public/journey-os/journey.js'), 'utf8');

test('Payments is not in Website builder Booking nav', () => {
  const bookingGroup = html.match(
    /ed-settings-group-label">Booking<\/div>[\s\S]*?ed-settings-group-label">Integrations/
  );
  assert.ok(bookingGroup, 'expected Booking then Integrations groups');
  assert.doesNotMatch(
    bookingGroup[0],
    /data-ed-nav="payment"/,
    'Payments nav item must leave Website builder Booking rail'
  );
});

test('Payment mode lives in Settings → Integrations next to Stripe', () => {
  assert.match(journey, /function renderSetPayMode\(/);
  assert.match(journey, /id="jos-set-pay-mode"/);
  assert.match(journey, /renderSetPayMode\(\)/);
  assert.match(journey, /act === 'set-pay-mode'/);
  assert.match(html, /function goToPaymentSettings\(\)/);
  assert.match(html, /_josSetTab='integrations'/);
  assert.match(html, /id="ed-payment-acc"[^>]*hidden/);
});
