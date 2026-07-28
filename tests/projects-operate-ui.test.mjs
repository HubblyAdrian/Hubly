/**
 * Projects Operate UI — bleed-through, FAB collision, contrast, auth gate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Projects Operate UI fixes', () => {
  it('paints an opaque Projects shell so Home cannot bleed through', () => {
    const css = read('public/journey-os/photography-projects.css');
    assert.match(css, /jos-photo-projects-mode #v-photo-projects/);
    assert.match(css, /#jos-photo-projects-root/);
    assert.match(css, /background: var\(--pp-bg\)/);
    assert.match(css, /min-height: 100vh/);
    assert.doesNotMatch(css, /#jos-photo-projects-root \{[^}]*animation: pp-fade-in/);
  });

  it('strengthens pill and status bubble borders', () => {
    const css = read('public/journey-os/photography-projects.css');
    assert.match(css, /--pp-border-strong/);
    assert.match(css, /\.pp-pill \{[\s\S]*border: 1\.5px solid var\(--pp-border-strong\)/);
    assert.match(css, /\.pp-status-booked \{[^}]*background:/);
  });

  it('hides Ask Hubly FAB and coach on Projects', () => {
    const css = read('public/journey-os/photography-projects.css');
    const journey = read('public/journey-os/journey.js');
    const html = read('public/hubly.html');
    assert.match(css, /jos-photo-projects-mode #jos-ask-fab/);
    assert.match(css, /jos-photo-projects-mode \.hubly-coach/);
    assert.match(journey, /v === 'photo-projects'/);
    assert.match(html, /onProjects/);
  });

  it('offers a Sign in CTA when create has no business session', () => {
    const js = read('public/journey-os/photography-projects.js');
    assert.match(js, /function requireBusinessSession/);
    assert.match(js, /function showAuthGate/);
    assert.match(js, /go-signin/);
    assert.match(js, /showP\('p-signin'/);
    assert.match(js, /if \(!requireBusinessSession\(\)\) return;/);
  });
});
