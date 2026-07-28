import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/operate-pixel.css'), 'utf8');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');
const ppCss = readFileSync(join(root, 'public/journey-os/photography-projects.css'), 'utf8');

describe('Operate UI audit polish', () => {
  it('keeps Create dialog and menu Hubly-branded and readable', () => {
    assert.match(css, /color-scheme:\s*light/);
    assert.match(css, /\.jos-gcal-create-types button\.on\{[^}]*#B84E1F/);
    assert.match(css, /\.jos-gcal-create-title\{[^}]*#D9632D/s);
    assert.match(css, /\.jos-gcal-create-foot \.jos-btn-brand\{[^}]*#D9632D/s);
    assert.match(css, /\.jos-gcal-create-hint\{[^}]*#5F6368/);
  });

  it('makes calendar delete and slot + discoverable on touch', () => {
    assert.match(css, /@media \(hover:none\)\{[\s\S]*?\.jos-gcal-slot-add\{opacity:1/);
    assert.match(css, /\.jos-gcal-del\{[\s\S]*?width:20px/);
    assert.match(css, /\.jos-gcal-event\.info\{background:#0277BD\}/);
    assert.match(css, /\.jos-gcal-event\.mute\{/);
  });

  it('closes Create menu on outside click and Escape', () => {
    assert.match(journey, /closeGcalCreateMenu\(\)/);
    assert.ok(journey.includes("e.key === 'Escape'"));
    assert.match(journey, /#jos-gcal-create-pop, #jos-gcal-create-menu/);
  });

  it('keeps gallery Add photos / New bucket high-contrast', () => {
    assert.match(hubly, /class="ws-gal-album-add"/);
    assert.match(hubly, /class="ws-gal-new-bucket"/);
    assert.match(hubly, /\.ws-gal-album-add\{[\s\S]*?color:#141B2B/);
    assert.match(hubly, /\.ws-gal-new-bucket\{[\s\S]*?color:#141B2B!important/);
  });

  it('keeps Projects ghost buttons outlined and readable', () => {
    assert.match(ppCss, /\.pp-btn-ghost \{[\s\S]*?background: #fff/);
    assert.match(ppCss, /\.pp-btn-brand \{[\s\S]*?color: #fff/);
  });
});
