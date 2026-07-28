import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('gallery album editor chrome', () => {
  it('puts Add photos in the album grid, not far-right header buttons', () => {
    assert.match(hubly, /class="ws-gal-album-add"/);
    assert.match(hubly, /pickGalleryPhotosForAlbum/);
    assert.match(hubly, /ws-gal-album-title/);
    // Old far-right pair should be gone from album header markup
    assert.doesNotMatch(
      hubly,
      /ws-gal-album-actions">\s*<button[^>]*>Add photos<\/button>\s*<button[^>]*ws-gal-rename-btn/
    );
  });

  it('keeps Rename beside the title with readable styles', () => {
    assert.match(hubly, /ws-gal-album-title"><h3>\$\{escPeHtml\(alb\.name\)\}<\/h3>\$\{rename\}/);
    assert.match(hubly, /\.ws-gal-album-add\{/);
    assert.match(hubly, /border:2px dashed #94a3b8/);
    assert.match(hubly, /color:#141B2B/);
    assert.match(hubly, /justify-content:flex-start/);
  });
});
