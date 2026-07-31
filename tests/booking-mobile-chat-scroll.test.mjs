import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/hubly.html'), 'utf8');
const booking = fs.readFileSync(path.join(root, 'public/smart-quote/booking.js'), 'utf8');
const skin = fs.readFileSync(path.join(root, 'public/booking-wizard/mock-skin.css'), 'utf8');

test('booking sidebar does not emit mid-flow Chat with us help card', () => {
  assert.doesNotMatch(booking, /bk-help-card/);
  assert.doesNotMatch(booking, /Chat with us ›/);
  assert.match(booking, /Chat lives on the floating #ws-chat-bubble/);
});

test('booking keeps floating chat bubble visible', () => {
  assert.doesNotMatch(
    html,
    /body\.ws-booking-open #ws-chat-bubble[\s\S]{0,80}display:none/
  );
  assert.match(html, /body\.ws-booking-open #ws-chat-teaser\{display:none!important\}/);
  assert.match(html, /body\.ws-booking-open \.ws-chat-widget\{/);
});

test('booking steps use a single scroller (no nested overflow on step-inner)', () => {
  assert.match(html, /\.bk-sq-mode \.bk-step-inner\{[\s\S]*?overflow:hidden/);
  assert.match(
    html,
    /\.bk-sq-mode \.bk-step-body\{[\s\S]*?overflow-y:auto[\s\S]*?-webkit-overflow-scrolling:touch/
  );
  assert.match(skin, /overflow:hidden/);
});

test('mobile service picker is a single-column list with readable prompt', () => {
  assert.match(booking, /bk-svc-prompt/);
  assert.match(html, /\.bk-svc-prompt\{/);
  assert.match(html, /@media\(max-width:860px\)\{[\s\S]*?\.bk-svc-pick\{grid-template-columns:1fr/);
  assert.match(skin, /\.booking-shell\.bk-mock \.bk-svc-pick\{[\s\S]*?grid-template-columns:1fr/);
});
