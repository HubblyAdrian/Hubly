/**
 * Smoke tests — Hubly Event Bus, Action Engine, Apps Marketplace.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Hubly Event Bus + Apps Marketplace', () => {
  it('ships server Event Bus with capability subscriptions', () => {
    const bus = readFileSync(join(root, 'supabase/functions/_shared/hubly_event_bus.ts'), 'utf8');
    assert.match(bus, /HublyBusinessEventType/);
    assert.match(bus, /project\.delivered/);
    assert.match(bus, /gallery\.delivered/);
    assert.match(bus, /capabilities\?:/);
    assert.match(bus, /registerDefaultEngineSubscribers/);
    assert.match(bus, /capabilityMatchedApps/);
    assert.match(bus, /HublyEventBus/);
  });

  it('ships Action Engine that plans by capability, not vendor names', () => {
    const eng = readFileSync(join(root, 'supabase/functions/_shared/hubly_action_engine.ts'), 'utf8');
    assert.match(eng, /resolveProviderForCapability/);
    assert.match(eng, /planAction/);
    assert.match(eng, /describePlanForAi/);
    assert.match(eng, /Marketing Graphics/);
    assert.match(eng, /Capability-first/);
    assert.doesNotMatch(eng, /Use Canva/);
    // Runtime messages must speak capabilities (INTENT_NEEDS labels), not vendor CTAs
    assert.match(eng, /Need: \$\{needs/);
    const creative = readFileSync(join(root, 'supabase/functions/_shared/hubly_creative_engine.ts'), 'utf8');
    assert.match(creative, /resolveProviderForCapability/);
    assert.match(creative, /Need: Marketing Graphics/);
  });

  it('catalog declares productCapabilities for Marketplace + AI', () => {
    const core = readFileSync(join(root, 'supabase/functions/_shared/hubly_connected_apps.ts'), 'utf8');
    assert.match(core, /productCapabilities/);
    assert.match(core, /RAW Editing/);
    assert.match(core, /Marketing Graphics/);
    assert.match(core, /MARKETPLACE_SOON/);
    const client = readFileSync(join(root, 'public/journey-os/connected-apps.js'), 'utf8');
    assert.match(client, /productCapabilities/);
    assert.match(client, /HublyConnectedApps/);
    assert.match(client, /install:/);
  });

  it('ships Apps Marketplace UI (not buried in Settings)', () => {
    assert.equal(existsSync(join(root, 'public/journey-os/app-marketplace.js')), true);
    assert.equal(existsSync(join(root, 'public/journey-os/app-marketplace.css')), true);
    const js = readFileSync(join(root, 'public/journey-os/app-marketplace.js'), 'utf8');
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    assert.match(js, /Hubly Marketplace/);
    assert.match(js, /Installed/);
    assert.match(js, /Available/);
    assert.match(js, /Capabilities/);
    assert.match(js, /HublyActionEngine/);
    assert.match(html, /data-v="apps"/);
    assert.match(html, /jos-apps-root/);
    assert.match(html, /app-marketplace\.js/);
    assert.match(html, /hubly-action-engine\.js/);
  });

  it('extends client HublyEvents with project / app lifecycle events', () => {
    const ev = readFileSync(join(root, 'public/journey-os/hubly-events.js'), 'utf8');
    assert.match(ev, /PROJECT_DELIVERED:\s*'project\.delivered'/);
    assert.match(ev, /GALLERY_DELIVERED:\s*'gallery\.delivered'/);
    assert.match(ev, /APP_CONNECTED:\s*'app\.connected'/);
    assert.match(ev, /CREATIVE_ASSET_PLANNED/);
  });

  it('photography delivery publishes Event Bus events', () => {
    const js = readFileSync(join(root, 'public/journey-os/photography-projects.js'), 'utf8');
    assert.match(js, /publishBus\('project\.delivered'/);
    assert.match(js, /publishBus\('gallery\.delivered'/);
    assert.match(js, /Need: Marketing Graphics/);
  });

  it('documents Connected Apps events in EVENTS.md', () => {
    const md = readFileSync(join(root, 'docs/operate/EVENTS.md'), 'utf8');
    assert.match(md, /Connected Apps \+ Event Bus/);
    assert.match(md, /project\.delivered/);
    assert.match(md, /capability/);
  });
});
