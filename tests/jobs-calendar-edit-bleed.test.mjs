import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const journey = fs.readFileSync('public/journey-os/journey.js', 'utf8');
const css = fs.readFileSync('public/journey-os/operate-pixel.css', 'utf8');
const hubly = fs.readFileSync('public/hubly.html', 'utf8');

test('Jobs calendar mode titles the page Calendar', () => {
  assert.match(journey, /mainView === 'calendar'[\s\S]{0,160}<h1>Calendar<\/h1>/);
  assert.match(journey, /bar\.textContent = 'Calendar'/);
});

test('New jobs open an editable details form', () => {
  assert.match(journey, /function renderJobEditForm/);
  assert.match(journey, /jos-je-customer/);
  assert.match(journey, /jos-je-address/);
  assert.match(journey, /jos-je-number/);
  assert.match(journey, /_josJobEditOpen = true/);
  assert.match(journey, /act === 'jobs-edit-save'/);
  assert.match(journey, /Customer name is required/);
});

test('Jobs shell blocks Home bleed-through like Projects', () => {
  assert.match(css, /#jos-jobs-root\{[\s\S]*?isolation:isolate/);
  assert.match(css, /\.jos-jobs-shell\{[\s\S]*?animation:none/);
  assert.match(hubly, /body\.ed-editor-open #v-editor/);
  assert.match(hubly, /height:100vh!important/);
});

test('Jobs list is jobs-first with collapsed filters and compact stats', () => {
  assert.match(journey, /data-jos-act="jobs-filters-toggle"/);
  assert.match(journey, /act === 'jobs-filters-toggle'/);
  assert.match(journey, /_josJobsFiltersOpen/);
  assert.match(journey, /jos-jobs-table-card jos-jobs-first/);
  assert.match(journey, /jos-jobs-meta-chip/);
  assert.match(journey, /jos-jobs-foot/);
  assert.match(css, /\.jos-jobs-kpis\{display:none!important\}/);
  assert.match(css, /\.jos-jobs-meta-chip/);
  assert.doesNotMatch(journey, /class="jos-jobs-kpis"/);
});
