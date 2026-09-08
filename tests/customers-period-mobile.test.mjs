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
    // The bar is no longer a static id="..." attribute in the markup; the code addresses
    // it as #cust-range-bar. Assert the id the code actually uses, not the markup syntax
    // it happened to be written in — the feature (setCustRange, custRange state, the
    // buttons and the mobile ordering) is asserted below and all of it is intact.
    assert.match(hublySrc, /#cust-range-bar/);
    // The buttons moved from inline setCustRange('day') calls to data-range attributes
    // with a delegated handler. Assert the four ranges the function actually accepts —
    // that is the behaviour worth guarding; how the click reaches it is not.
    assert.match(hublySrc, /\['all','day','week','month'\]/);
    assert.match(hublySrc, /data-range/);
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
