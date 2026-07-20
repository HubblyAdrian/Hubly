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
  it('places day rail before Google Calendar in the right column', () => {
    const right = hublySrc.indexOf('class="jobs-right"');
    const day = hublySrc.indexOf('id="jobs-day-rail"', right);
    const gcal = hublySrc.indexOf('class="jobs-gcal-card"', right);
    assert.ok(right >= 0 && day > right && gcal > right);
    assert.ok(day < gcal, 'Day detail should come before Google Calendar');
  });

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
