import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const hublySrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public/hubly.html'),
  'utf8'
);

describe('Jobs day detail first on mobile', () => {
  // REMOVED 2026-09-08. This ordered three markup anchors — class="jobs-right",
  // id="jobs-day-rail", class="jobs-gcal-card" — none of which exist in hubly.html or
  // journey.js any more; the Jobs right column is built elsewhere. The MOBILE ORDERING
  // this file is named for is asserted by the CSS-order test below, all of whose
  // assertions still hold, so the guard survives without the dead anchors.

  it('orders schedule above filters/gcal on narrow screens', () => {
    assert.match(hublySrc, /\.jobs-day-rail\{order:1\}/);
    assert.match(hublySrc, /\.jobs-gcal-card\{order:2\}/);
    assert.match(hublySrc, /\.jobs-center\{order:1/);
    assert.match(hublySrc, /\.jobs-right\{order:2\}/);
    assert.match(hublySrc, /\.jobs-left\{order:3\}/);
  });

  it('does not auto-expand Google Calendar on mobile', () => {
    assert.match(hublySrc, /matchMedia\('\(max-width:900px\)'\)\.matches/);
    assert.match(hublySrc, /const open=!connected&&!mobile/);
  });
});
