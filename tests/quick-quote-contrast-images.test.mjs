import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hubly = fs.readFileSync('public/hubly.html', 'utf8');
const ui = fs.readFileSync('public/smart-quote/ui.js', 'utf8');
const engine = fs.readFileSync('public/smart-quote/engine.js', 'utf8');

test('Quick Quote list action buttons stay dark-on-light', () => {
  assert.match(hubly, /#v-quotes \.sq-page-actions \.btn-out[\s\S]*?color:#141B2B!important/);
  assert.doesNotMatch(hubly, /\.sq-head-actions \.sq-draft-btn\{\s*background:var\(--ink\)!important/);
});

test('Quick Quote Save draft never uses night ink as background', () => {
  assert.match(hubly, /\.sq-head-actions \.sq-draft-btn[\s\S]*?background:#141B2B!important/);
  assert.match(hubly, /#v-quotes\.sq-workspace-open \.sq-head-actions \.sq-draft-btn[\s\S]*?color:#fff!important/);
});

test('Quick Quote dark workspace uses light headings and dark-on-mint active steps', () => {
  assert.match(hubly, /#v-quotes\.sq-workspace-open \.sq-head h2[\s\S]*?color:#f8fafc!important/);
  assert.match(hubly, /#v-quotes\.sq-workspace-open \.sq-prog-step\.on[\s\S]*?color:#065f46!important/);
  assert.match(hubly, /#v-quotes\.sq-workspace-open \.sq-prog-step\.on \.sq-qq-step-copy strong\{color:#065f46!important\}/);
});

test('Quick Quote resolves package images from imgUrl and photos', () => {
  assert.match(ui, /function resolveServiceImage/);
  assert.match(engine, /function resolvePkgImage/);
  assert.match(engine, /image: resolvePkgImage\(s\)/);
  assert.match(ui, /image,\s*imgUrl: image/);
});
