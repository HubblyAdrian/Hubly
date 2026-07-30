/**
 * Mobile audit — Studio / Projects / Apps stay usable on phone widths.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Operate mobile audit', () => {
  it('Studio ships mobile nav chrome instead of hiding the sidebar', () => {
    const studio = read('public/journey-os/hubly-studio.js');
    const css = read('public/journey-os/hubly-studio.css');
    const hubly = read('public/hubly.html');

    assert.match(studio, /hs-mobile-bar/);
    assert.match(studio, /data-hs-act="toggle-nav"/);
    assert.match(studio, /data-hs-act="close-nav"/);
    assert.match(studio, /function toggleStudioNav/);
    assert.match(studio, /hs-ws-mobile-strip/);
    assert.match(css, /\.hs-mobile-bar/);
    assert.match(css, /\.hs-shell\.hs-nav-open/);
    assert.match(css, /100dvh/);
    // Must not hard-hide workspace panels without a mobile surface
    assert.doesNotMatch(
      css,
      /@media \(max-width: 1200px\) \{[\s\S]*?\.hs-ws-left,\s*\.hs-props \{ display: none; \}/,
    );
    assert.match(hubly, /hubly-studio\.js\?v=studio-14/);
    assert.match(hubly, /hubly-studio\.css\?v=studio-14/);
  });

  it('Studio phone rules enlarge touch targets and wrap AI search', () => {
    const css = read('public/journey-os/hubly-studio.css');
    assert.match(css, /\.hs-ai-search \{ flex-wrap: wrap/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /@media \(hover: none\)/);
    assert.match(css, /\.hs-cal-head,\s*\.hs-cal-grid/);
    assert.match(css, /minmax\(44px, 1fr\)/);
  });

  it('Projects phone pass avoids 320px overflow and stacks Lightroom CTAs', () => {
    const css = read('public/journey-os/photography-projects.css');
    const hubly = read('public/hubly.html');
    assert.match(css, /minmax\(min\(100%, 280px\), 1fr\)/);
    assert.match(css, /@media \(max-width: 560px\)/);
    assert.match(css, /\.pp-between \{[\s\S]*flex-direction: column/);
    assert.match(css, /\.pp-seg \{[\s\S]*flex-wrap: wrap/);
    assert.match(css, /\.pp-lr-panels \{[\s\S]*overflow-x: auto/);
    assert.match(hubly, /photography-projects\.js\?v=projects-15/);
    assert.match(hubly, /photography-projects\.css\?v=projects-15/);
  });

  it('Apps marketplace tightens phone padding and touch buttons', () => {
    const css = read('public/journey-os/app-marketplace.css');
    const hubly = read('public/hubly.html');
    assert.match(css, /\.am-grid \{[\s\S]*grid-template-columns: 1fr/);
    assert.match(css, /\.am-btn \{[\s\S]*min-height: 44px/);
    assert.match(hubly, /app-marketplace\.css\?v=projects-15/);
  });
});
