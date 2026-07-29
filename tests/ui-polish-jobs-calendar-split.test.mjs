import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Jobs and Calendar are separate nav tabs', () => {
  const html = read('public/hubly.html');
  assert.match(html, /data-v="jobs"[^>]*>[\s\S]*?<span class="ni-lbl">Jobs<\/span>/);
  assert.match(html, /data-v="calendar"[^>]*>[\s\S]*?<span class="ni-lbl">Calendar<\/span>/);
  assert.match(html, /id="v-calendar"/);
  assert.match(html, /id="jos-calendar-root"/);
  assert.doesNotMatch(html, /ni-lbl">Jobs &amp; Calendar</);
});

test('Journey OS exposes renderCalendar and forces list vs calendar', () => {
  const js = read('public/journey-os/journey.js');
  assert.match(js, /function renderCalendar\s*\(/);
  assert.match(js, /calendar:\s*renderCalendar/);
  assert.match(js, /renderCalendar:\s*renderCalendar/);
  assert.match(js, /root\._josForcedView = 'list'/);
  assert.match(js, /root\._josForcedView = 'calendar'/);
  assert.match(js, /switchNav\('calendar'\)/);
  assert.match(js, /Job Summary/);
  assert.match(js, /AI Schedule Assistant/);
  assert.match(js, /Plan your day\. Stay on schedule/);
});

test('Shared layout tokens and PageLayout helpers exist', () => {
  const css = read('public/journey-os/hubly-layout.css');
  const ds = read('public/journey-os/design-system.js');
  const html = read('public/hubly.html');
  assert.match(css, /--hub-title:\s*32px/);
  assert.match(css, /--hub-input-h:\s*48px/);
  assert.match(css, /--hub-btn-h:\s*44px/);
  assert.match(css, /\.hub-page-header/);
  assert.match(css, /\.hub-kpi-card/);
  assert.match(ds, /function pageLayout\s*\(/);
  assert.match(ds, /pageLayout:\s*pageLayout/);
  assert.match(ds, /kpiCard:\s*kpiCard/);
  assert.match(html, /hubly-layout\.css/);
});

test('Inbox header styles remain untouched by polish overrides', () => {
  const css = read('public/journey-os/operate-pixel.css');
  const layout = read('public/journey-os/hubly-layout.css');
  assert.match(css, /\.jos-ibx-title h1\{[^}]*font-size:22px/);
  assert.doesNotMatch(layout, /\.jos-ibx-title h1/);
});

test('Editor v2 always-editable (no Edit Mode toggle)', () => {
  const html = read('public/hubly.html');
  const layout = read('public/journey-os/hubly-layout.css');
  assert.match(html, /function setEdEditMode\s*\(/);
  assert.match(html, /function toggleEdEditMode\s*\(/);
  assert.match(html, /function isWebsitePeEnabled\s*\(/);
  assert.match(html, /return isEditorViewOpen\(\)/);
  assert.doesNotMatch(html, /id="ed-edit-mode-btn"/);
  assert.doesNotMatch(html, /Hold Space or click Edit Mode/);
  assert.match(html, /ws-pe-context-bar/);
  assert.match(html, /cta-secondary/);
  assert.match(html, /secondaryCtaText/);
  assert.match(html, /closeEdSettingsRail\(\{persist:false\}\)/);
  assert.match(html, /id="ws-sec-store"/);
  assert.match(html, /function renderWsStoreSection/);
  assert.match(html, /websiteEmbed:\s*true/);
  assert.match(layout, /body\.ed-editor-open #ed-ws-preview \.ws-pe-target:hover/);
  assert.match(layout, /#ws-pe-context-bar/);
  assert.match(layout, /\.ed-edit-mode-btn\s*\{[^}]*display:\s*none/);
});
