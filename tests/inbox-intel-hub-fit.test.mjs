import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const journey = fs.readFileSync('public/journey-os/journey.js', 'utf8');
const css = fs.readFileSync('public/journey-os/operate-pixel.css', 'utf8');

test('empty Inbox chat does not render Intelligence Hub overlay', () => {
  assert.doesNotMatch(journey, /Intelligence Hub appears when a conversation is open/);
  assert.match(journey, /Select a conversation/);
  assert.match(journey, /jos-ibx-empty-chat/);
  assert.match(journey, /Intelligence hub — only when a conversation is open/);
});

test('Inbox body marks hub presence so columns can fit together', () => {
  assert.match(journey, /jos-ibx-body' \+ \(hubHtml && hubOpen \? ' has-hub' : ' no-hub'\)/);
  assert.match(journey, /jos-ibx-hub-backdrop/);
  assert.match(journey, /aria-label="Intelligence Hub"/);
});

test('hub shares the grid on desktop and drawers only on narrow screens', () => {
  assert.match(css, /\.jos-ibx-body\.has-hub\{[\s\S]*?grid-template-columns:var\(--jos-ibx-list\) minmax\(0,1fr\) var\(--jos-ibx-hub\)/);
  assert.match(css, /@media\(min-width:1200px\)[\s\S]*?\.jos-ibx-hub\{[\s\S]*?position:relative!important/);
  assert.match(css, /@media\(max-width:1199px\)[\s\S]*?\.jos-ibx-hub\{[\s\S]*?position:fixed/);
  assert.match(css, /\.jos-ibx-empty-chat\{/);
  assert.doesNotMatch(css, /@media\(min-width:1600px\)/);
  assert.doesNotMatch(css, /@media\(max-width:1440px\)[\s\S]{0,200}\.jos-ibx-hub\{[\s\S]{0,80}position:fixed/);
});
