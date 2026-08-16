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

test('booking hides the floating chat bubble and the site sticky bar', () => {
  // Renamed and inverted. This test was called "keeps floating chat bubble
  // visible" and kept passing after the bubble was hidden, because it asserted
  // on #ws-chat-bubble — an id that is not the widget — while the widget is
  // .ws-chat-widget. A test whose name and subject disagree proves nothing.
  //
  // The requirement is now the opposite: at the payment step nothing may float
  // over the primary action, and the business site's own sticky Book Now bar
  // must not show through beneath the booking overlay (it produced two stacked
  // sticky bars on a real iPhone).
  assert.match(html, /body\.ws-booking-open #ws-chat-teaser\{display:none!important\}/);
  assert.match(
    html,
    /body\.ws-booking-open \.ws-chat-widget,[\s\S]{0,200}?display:none!important/
  );
  assert.match(
    html,
    /body\.ws-booking-open \.ws-sticky-cta,[\s\S]{0,200}?display:none!important/
  );
  // The overlay must fill the inset box rather than being shortened by dvh.
  assert.match(
    html,
    /body\.ws-booking-open #p-booking\.active\{[\s\S]*?height:100%;max-height:100%/
  );
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
