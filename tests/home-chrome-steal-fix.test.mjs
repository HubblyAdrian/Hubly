import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hubly = fs.readFileSync('public/hubly.html', 'utf8');
const journey = fs.readFileSync('public/journey-os/journey.js', 'utf8');

test('Operate Home chrome i18n says Home, not Dashboard', () => {
  assert.match(hubly, /dashboard:'Home'/);
  assert.doesNotMatch(hubly, /\/\/ Dashboard\s*\n\s*dashboard:'Dashboard'/);
  assert.match(hubly, /dashboard:'Inicio'/);
  assert.match(journey, /dashboard:\s*\{\s*title:\s*'Home'/);
});

test('realtime refresh does not unconditionally re-render Home', () => {
  const fn = hubly.match(/async function refreshOpenAppViews\(\)\{[\s\S]*?\n\}/);
  assert.ok(fn, 'refreshOpenAppViews present');
  const body = fn[0];
  assert.doesNotMatch(body, /await loadCustomers\(\);[\s\S]{0,80}enhanceDashboard/);
  assert.match(body, /if\(viewIsOpen\('v-dashboard'\)\)[\s\S]*?enhanceDashboard/);
});

test('enhanceDashboard and Home live timer refuse to steal other tabs', () => {
  assert.match(journey, /function isHomeViewActive\(\)/);
  assert.match(journey, /function enhanceDashboard\(\)[\s\S]*?if \(!isHomeViewActive\(\)\) return;/);
  assert.match(journey, /if \(!isHomeViewActive\(\)\) return;[\s\S]*?enhanceDashboard\(\)/);
});
