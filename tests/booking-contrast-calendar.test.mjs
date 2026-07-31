import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');

test('public customer sites force light / day theme', () => {
  assert.match(html, /hubly-public-boot[\s\S]{0,120}data-theme',\s*'day'/);
  assert.match(html, /hubly-public-site/);
  assert.match(html, /html\.hubly-public-site\{[\s\S]*?color-scheme:light!important/);
});

test('booking shell locks readable dark ink on white cards', () => {
  assert.match(html, /#p-booking\.booking-shell[\s\S]*?--ink:#0f172a!important/);
  assert.match(html, /#p-booking\.booking-shell \.bk-sum-line[\s\S]*?color:#0f172a!important/);
  assert.match(html, /#p-booking\.booking-shell \.bk-svc-prompt[\s\S]*?color:#0f172a!important/);
  assert.match(html, /#p-booking\.booking-shell \.bk-cal-day[\s\S]*?color:#0f172a!important/);
});

test('booking calendar parses YYYY-MM-DD as local (no UTC month slip)', () => {
  assert.match(html, /function parseBkLocalDate/);
  assert.match(html, /new Date\(Number\(m\[1\]\),Number\(m\[2\]\)-1,Number\(m\[3\]\)\)/);
  assert.doesNotMatch(
    html,
    /if\(!focus&&S\._bkCalMonth\)focus=new Date\(S\._bkCalMonth\);/
  );
  assert.match(html, /Prefer the selected booking date over a cached month/);
  assert.match(html, /S\._bkCalMonth=null;/);
});

test('mobile booking summary is compact and chat clears Continue', () => {
  assert.match(html, /\.bk-sq-mobile-est \.bk-sum-lines[\s\S]*?display:none!important/);
  assert.match(
    html,
    /body\.ws-booking-open \.ws-chat-widget\{[\s\S]*?bottom:calc\(84px/
  );
  assert.match(html, /padding-right:68px/);
});
