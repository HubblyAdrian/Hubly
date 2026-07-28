import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = fs.readFileSync(path.join(root, 'public/journey-os/photography-projects.js'), 'utf8');

test('renderDashboard declares profile before using it', () => {
  const fn = js.match(/function renderDashboard\([^)]*\) \{[\s\S]*?\n  function metric/);
  assert.ok(fn, 'expected renderDashboard');
  const body = fn[0];
  const decl = body.indexOf('var profile = projectWorkspaceProfile()');
  assert.ok(decl >= 0, 'dashboard must declare profile');
  const firstUse = body.search(/profile\.(teamFilterLabel|dateLabel|emptyHint)/);
  assert.ok(firstUse >= 0, 'dashboard uses profile fields');
  assert.ok(decl < firstUse, 'profile must be declared before use');
});

test('renderPhotoProjects recovers if paint throws', () => {
  assert.match(js, /Projects paint failed/);
  assert.match(js, /Couldn\\u2019t open Projects|Couldn.t open Projects/);
});
