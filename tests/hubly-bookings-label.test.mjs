import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hublySrc = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('Hubly bookings label', () => {
  it('uses Hubly bookings in owner UI copy', () => {
    assert.match(hublySrc, /onlineBookingsLbl:'Hubly bookings'/);
    assert.match(hublySrc, /filterStorefront:'Hubly bookings'/);
    assert.match(hublySrc, />Hubly bookings</);
    assert.match(hublySrc, /booking:'Hubly booking'/);
    assert.match(hublySrc, /⚡ Hubly booking/);
    assert.match(hublySrc, /Pads Hubly booking/);
  });

  it('scopes the dashboard Hubly bookings KPI to this month', () => {
    assert.match(
      hublySrc,
      /id="kpi-bookings">0<\/div>\s*<div class="dash-kpi-sub" data-i18n="thisMonth">This month</
    );
    assert.match(
      hublySrc,
      /getElementById\('kpi-bookings'\);\s*if\(bks\)bks\.textContent=jobsThisMonth\(\)\.filter\(j=>j\.fromBooking\)\.length;/
    );
  });

  it('does not keep Online bookings as the product label', () => {
    assert.doesNotMatch(hublySrc, /onlineBookingsLbl:'Online bookings'/);
    assert.doesNotMatch(hublySrc, /filterStorefront:'Online bookings'/);
    assert.doesNotMatch(hublySrc, /booking:'Online booking'/);
    assert.doesNotMatch(hublySrc, />Online bookings</);
    assert.doesNotMatch(hublySrc, /⚡ Online booking/);
  });
});
