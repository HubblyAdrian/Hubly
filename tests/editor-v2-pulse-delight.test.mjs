import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('contextual inspector opens only from Style', () => {
  const html = read('public/hubly.html');
  assert.match(html, /openEdSheet\('layout'/);
  assert.match(html, /wsPeToolbarActions/);
  assert.match(html, /Replace Photo/);
  assert.doesNotMatch(html, /if\(act==='edit'\|\|act==='style'\)/);
});

test('true inline editing helpers exist', () => {
  const html = read('public/hubly.html');
  assert.match(html, /function startWsPeInlineEdit/);
  assert.match(html, /function finishWsPeInlineEdit/);
  assert.match(html, /function commitWsPeInlineValue/);
  assert.match(html, /WS_PE_INLINE_TYPES/);
  assert.match(html, /contenteditable/);
  assert.match(html, /ws-pe-inline-editing/);
});

test('page-specific AI prompts and FAB wiring', () => {
  const js = read('public/journey-os/journey.js');
  const html = read('public/hubly.html');
  assert.match(js, /var PAGE_AI = \{/);
  assert.match(js, /jobs:\s*\{\s*label:\s*'Jobs AI'/);
  assert.match(js, /calendar:\s*\{\s*label:\s*'Calendar AI'/);
  assert.match(js, /chats:\s*\{\s*label:\s*'Inbox AI'/);
  assert.match(js, /money:\s*\{\s*label:\s*'Invoices AI'/);
  assert.match(js, /editor:\s*\{\s*label:\s*'Website AI'/);
  assert.match(js, /function askForCurrentPage/);
  assert.match(js, /askForCurrentPage:\s*askForCurrentPage/);
  assert.match(html, /HublyJourneyOS\?\.askForCurrentPage/);
  assert.match(html, /Website AI/);
});

test('Business Pulse chrome exists', () => {
  const html = read('public/hubly.html');
  const js = read('public/journey-os/journey.js');
  const css = read('public/journey-os/hubly-layout.css');
  assert.match(html, /jos-business-pulse/);
  assert.match(html, /data-jos-act="toggle-business-pulse"/);
  assert.match(js, /function openBusinessPulse/);
  assert.match(js, /function computeBusinessPulse/);
  assert.match(js, /AI Opportunity/);
  assert.match(css, /\.jos-business-pulse/);
  assert.match(css, /\.jos-pulse-pop/);
});

test('delight moments helpers exist', () => {
  const html = read('public/hubly.html');
  assert.match(html, /function delightToast/);
  assert.match(html, /function delightOnce/);
  assert.match(html, /Your website is ready/);
  assert.match(html, /maybeDelightReviews/);
  assert.match(html, /maybeDelightLargestJob/);
  assert.match(html, /is-delight/);
});
