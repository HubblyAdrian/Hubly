import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = fs.readFileSync(path.join(root, 'public/journey-os/photography-projects.js'), 'utf8');

test('Media dashboard does not repeat the page title under the chrome', () => {
  const dash = js.match(/return '<div class="pp-shell pp-dash">[\s\S]*?<\/header>'/);
  assert.ok(dash, 'expected Media dashboard header markup');
  assert.match(dash[0], /pp-dash-head--actions/);
  assert.doesNotMatch(dash[0], /pp-eyebrow/);
  assert.doesNotMatch(dash[0], /pp-title/);
  assert.doesNotMatch(dash[0], /pp-sub/);
  assert.match(dash[0], /\+ New job|\+ New Project/);
});

test('Media chrome still owns the single title', () => {
  assert.match(js, /titleEl\.textContent = 'Media'/);
  assert.match(js, /subEl\.textContent = profile\.subtitle/);
});
