import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/operate-pixel.css'), 'utf8');
const layout = readFileSync(join(root, 'public/journey-os/hubly-layout.css'), 'utf8');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('Leads chrome matches Jobs Operate pattern', () => {
  it('uses Jobs-style page header actions without fake app-bar chrome', () => {
    const start = journey.indexOf('function renderLeadsPage');
    const end = journey.indexOf('function readLeadAddDraft');
    assert.ok(start > -1 && end > start);
    const page = journey.slice(start, end);
    assert.match(page, /class="jos-ld-header hub-page-header"/);
    assert.match(page, /class="jos-btn jos-ld-export"/);
    assert.match(page, /jos-ld-bulk/);
    assert.match(page, /\+ New Lead/);
    assert.doesNotMatch(page, /jos-leads-global-search/);
    assert.doesNotMatch(page, /jos-ld-global-search/);
    assert.doesNotMatch(page, /class="jos-ld-biz"/);
    assert.doesNotMatch(page, /class="jos-ld-ava-btn"/);
    assert.doesNotMatch(page, /toggle-notifs/);
    assert.doesNotMatch(page, /⌘K/);
  });

  it('keeps a single toolbar search and Jobs-like filter row', () => {
    assert.match(journey, /class="jos-ld-toolbar"/);
    assert.match(journey, /id="jos-leads-search"/);
    assert.match(journey, /Search leads, customers, phone, or email/);
    assert.match(journey, /More Filters · /);
    assert.equal((journey.match(/id="jos-leads-search"/g) || []).length, 1);
  });

  it('ensures jos-pixel in leads mode like jobs mode', () => {
    assert.match(journey, /function setLeadsMode\(on\) \{[\s\S]*?app\.classList\.add\('jos-pixel'\)/);
  });

  it('styles Leads header and tabs like Jobs, not sticky app bar', () => {
    assert.match(css, /\.jos-ld-header\{[\s\S]*?position:static/);
    assert.match(css, /\.jos-ld-header\{[\s\S]*?background:transparent/);
    assert.match(css, /\.jos-ld-stab\.on\{[\s\S]*?border-bottom-color:var\(--jos-brand\)/);
    assert.match(css, /\.jos-ld-toolbar\{/);
    assert.match(css, /\.jos-ld-page\{/);
    assert.doesNotMatch(css, /\.jos-ld-global-search\{/);
    assert.match(layout, /\.jos-ld-header h1/);
    assert.match(layout, /\.jos-ld-export/);
  });

  it('cache-busts Leads chrome assets', () => {
    assert.match(hubly, /operate-pixel\.css\?v=leads-chrome-1/);
    assert.match(hubly, /hubly-layout\.css\?v=leads-chrome-1/);
    assert.match(hubly, /journey\.js\?v=leads-chrome-1/);
  });
});
