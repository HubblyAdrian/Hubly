import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');

test('website editor pe-labels sit inside targets (not clipped by overflow:hidden)', () => {
  const block = html.match(
    /\/\* Click-to-edit preview[\s\S]*?\.ed-ws-preview \.ws-pe-target:hover::before[\s\S]*?opacity:1\}/
  );
  assert.ok(block, 'expected click-to-edit pe CSS block');
  const css = block[0];
  assert.match(css, /position:absolute;top:\s*8px/, 'label must be inset (top:8px), not hanging above the box');
  assert.doesNotMatch(css, /position:absolute;top:\s*-/, 'must not hang labels above the box (overflow clips)');
  assert.match(css, /outline-offset:\s*-3px/, 'hover outline must be inset so overflow:hidden parents do not clip it');
  assert.match(css, /z-index:\s*40/, 'label must stack above hero media/overlays');
});

test('simple-profile hero chrome still uses overflow:hidden for banner crop', () => {
  assert.match(
    html,
    /\.ws-layout-simple-profile \.ws-top-wrap\{[^}]*overflow:\s*hidden/,
    'top-wrap keeps overflow:hidden — labels must not rely on escaping the box'
  );
  assert.match(html, /\.ws-hero\{[^}]*overflow:\s*hidden/, 'hero keeps overflow:hidden for media');
});
