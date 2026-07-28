import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/operate-pixel.css'), 'utf8');

describe('Home chrome dedupe', () => {
  it('hides the app-bar Home title on dashboard', () => {
    assert.match(journey, /hideTitle = \(v === 'dashboard'\)/);
    assert.match(journey, /titleBlock\.hidden = hideTitle/);
    assert.doesNotMatch(journey, /homeChromeSub/);
    assert.doesNotMatch(journey, /let\\u2019s grow your business today/);
  });

  it('keeps the in-page greeting hero', () => {
    assert.match(journey, /jos-home-hero/);
    assert.match(journey, /timeOfDayGreeting\(\)/);
    assert.match(css, /\.bar-title-block\[hidden\]/);
  });
});
