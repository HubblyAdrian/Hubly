import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');

test('website editor does not show purple pe word chips', () => {
  assert.match(
    html,
    /\.ed-ws-preview \.ws-pe-target\[data-pe\]::before[\s\S]*?display:\s*none\s*!important/,
    'pe-label ::before chips must be hidden'
  );
  assert.doesNotMatch(
    html,
    /content:\s*attr\(\s*data-pe-label\s*\)/,
    'must not render data-pe-label as visible purple chips'
  );
  assert.doesNotMatch(
    html,
    /id="ed-pe-hint"/,
    'purple click-anything hint bar must be removed from the preview'
  );
});
