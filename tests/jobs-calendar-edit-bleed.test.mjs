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

test('Job details Overview is always editable without Edit mode', () => {
  assert.match(journey, /function renderJobEditForm/);
  assert.match(journey, /jos-je-customer/);
  assert.match(journey, /jos-je-address/);
  assert.match(journey, /jos-je-number/);
  assert.match(journey, /renderJobEditForm\(j, \{ inline: true \}\)/);
  assert.match(journey, /function applyJobEditFormToJob/);
  assert.match(journey, /act === 'jobs-edit-save'/);
  assert.match(journey, /Customer name is required/);
  assert.doesNotMatch(journey, /data-jos-act="jobs-edit">Edit</);
  assert.doesNotMatch(journey, /Edit details/);
});

test('Jobs list supports inline field editing', () => {
  assert.match(journey, /data-jos-job-field="customer"/);
  assert.match(journey, /data-jos-job-field="service"/);
  assert.match(journey, /data-jos-job-field="amount"/);
  assert.match(journey, /function applyJobListField/);
  assert.match(css, /\.jos-jobs-inline\{/);
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
