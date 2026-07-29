import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubly = readFileSync(join(root, 'public/hubly.html'), 'utf8');
const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
const studio = readFileSync(join(root, 'public/journey-os/hubly-studio.js'), 'utf8');
const css = readFileSync(join(root, 'public/journey-os/hubly-studio.css'), 'utf8');
const api = readFileSync(join(root, 'public/journey-os/studio/api.js'), 'utf8');
const edge = readFileSync(join(root, 'supabase/functions/studio-api/index.ts'), 'utf8');
const migration = readFileSync(join(root, 'supabase/migrations/20260729200000_hubly_studio.sql'), 'utf8');
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
const spec = readFileSync(join(root, 'docs/HUBLY_STUDIO_IMPLEMENTATION_SPEC.md'), 'utf8');

describe('Hubly Studio replaces Marketing', () => {
  it('ships Studio nav and view host instead of Marketing label', () => {
    assert.match(hubly, /data-v="studio"/);
    assert.match(hubly, /id="v-studio"/);
    assert.match(hubly, /id="jos-studio-root"/);
    assert.match(hubly, /hubly-studio\.js\?v=studio-1/);
    assert.match(hubly, /hubly-studio\.css\?v=studio-1/);
    assert.match(hubly, /studio\/api\.js\?v=studio-1/);
    assert.match(hubly, /studio:'Studio'/);
    assert.doesNotMatch(hubly, /title="Marketing"/);
  });

  it('wires journey onSwitchView to HublyStudio', () => {
    assert.match(journey, /HublyStudio\.setMode/);
    assert.match(journey, /studio: function/);
    assert.match(journey, /open-studio/);
    assert.match(journey, /jos-studio-promo/);
    assert.match(journey, /studio: \{ title: 'Studio'/);
  });

  it('exposes Studio screens and editor', () => {
    assert.match(studio, /HublyStudio/);
    assert.match(studio, /AI Creative Partner/);
    assert.match(studio, /Publish Center/);
    assert.match(studio, /Brand Kit/);
    assert.match(studio, /Template Studio/);
    assert.match(studio, /hs-editor-shell/);
    assert.match(studio, /Publish to Queue/);
    assert.match(api, /HublyStudioApi/);
    assert.match(css, /--hs-brand:\s*#D9632D/);
    assert.match(css, /\.hs-shell/);
    assert.match(css, /\.jos-studio-promo/);
  });

  it('persists studioOs in business meta', () => {
    assert.match(hubly, /studioOs:S\.studioOs/);
    assert.match(hubly, /if\(meta\.studioOs/);
  });

  it('ships Studio backend schema and edge API', () => {
    assert.ok(existsSync(join(root, 'supabase/functions/studio-api/index.ts')));
    assert.match(migration, /studio_projects/);
    assert.match(migration, /studio_brand_kit/);
    assert.match(migration, /studio_publish_queue/);
    assert.match(migration, /studio_social_accounts/);
    assert.match(edge, /studio-api/);
    assert.match(edge, /Provider not configured/);
    assert.match(config, /\[functions\.studio-api\]/);
    assert.match(spec, /replaces Operate \*\*Marketing\*\*/);
  });
});
