import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const hublySrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public/hubly.html'),
  'utf8'
);

describe('Customers day/week/month on mobile', () => {
  it('exposes All time / Today / This week / This month controls', () => {
    assert.match(hublySrc, /id="cust-range-bar"/);
    assert.match(hublySrc, /setCustRange\('day'\)/);
    assert.match(hublySrc, /setCustRange\('week'\)/);
    assert.match(hublySrc, /setCustRange\('month'\)/);
    assert.match(hublySrc, /setCustRange\('all'\)/);
    assert.match(hublySrc, /function setCustRange/);
    assert.match(hublySrc, /custRange:'all'/);
  });

  it('puts the customer list above side cards on narrow layouts', () => {
    assert.match(hublySrc, /\.cust-main-card\{order:1\}/);
    assert.match(hublySrc, /\.cust-layout>aside\{order:2\}/);
  });

  it('keeps Revenue period select usable on mobile', () => {
    assert.match(hublySrc, /#v-money \.report-period-select\{flex:1;min-width:0;width:100%\}/);
  });
});
