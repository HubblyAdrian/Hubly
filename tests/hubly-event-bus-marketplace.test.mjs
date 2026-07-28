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
    assert.match(eng, /Planner \+ Resolver/);
    assert.doesNotMatch(eng, /Use Canva/);
    assert.match(eng, /Need: \$\{needs/);
    const creative = readFileSync(join(root, 'supabase/functions/_shared/hubly_creative_engine.ts'), 'utf8');
    assert.match(creative, /resolveProviderForCapability/);
    assert.match(creative, /Need: Marketing Graphics/);
  });

  it('ships Intent Engine above Planner / Resolver / Event Bus', () => {
    const intent = readFileSync(join(root, 'supabase/functions/_shared/hubly_intent_engine.ts'), 'utf8');
    const client = readFileSync(join(root, 'public/journey-os/hubly-intent-engine.js'), 'utf8');
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    const journey = readFileSync(join(root, 'public/journey-os/journey.js'), 'utf8');
    const apps = readFileSync(join(root, 'public/journey-os/app-marketplace.js'), 'utf8');
    assert.match(intent, /HublyIntentEngine/);
    assert.match(intent, /recognizeIntent/);
    assert.match(intent, /runIntentPipeline/);
    assert.match(intent, /executionPlan/);
    assert.match(intent, /Promote Project/);
    assert.doesNotMatch(intent, /Use Canva/);
    assert.match(client, /HublyIntentEngine/);
    assert.match(client, /handleAsk/);
    assert.match(client, /approve/);
    assert.match(client, /Execution Plan/);
    assert.match(html, /hubly-intent-engine\.js/);
    assert.match(journey, /HublyIntentEngine/);
    assert.match(apps, /Intent Engine|Intent pipeline/);
    assert.match(apps, /Execution Plan/);
  });

  it('catalog SSOT is hubly-core and copies stay in sync', () => {
    const ssot = readFileSync(join(root, 'hubly-core/connected-apps-catalog.json'), 'utf8');
    const pub = readFileSync(join(root, 'public/journey-os/connected-apps-catalog.json'), 'utf8');
    const shared = readFileSync(join(root, 'supabase/functions/_shared/connected_apps_catalog.json'), 'utf8');
    assert.equal(ssot, pub);
    assert.equal(ssot, shared);
    assert.match(ssot, /"apps"/);
    const gen = readFileSync(join(root, 'public/journey-os/connected-apps-catalog.generated.js'), 'utf8');
    assert.match(gen, /HUBLY_CONNECTED_APPS_CATALOG/);
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    assert.match(html, /connected-apps-catalog\.generated\.js/);
    const client = readFileSync(join(root, 'public/journey-os/connected-apps.js'), 'utf8');
    assert.match(client, /HUBLY_CONNECTED_APPS_CATALOG/);
    assert.doesNotMatch(client, /var CATALOG = \[/);
  });

  it('Execution Plan module supports draft → approve → execute', () => {
    const xp = readFileSync(join(root, 'supabase/functions/_shared/hubly_execution_plan.ts'), 'utf8');
    assert.match(xp, /buildExecutionPlan/);
    assert.match(xp, /approveExecutionPlan/);
    assert.match(xp, /cancelExecutionPlan/);
    assert.match(xp, /Status: draft/);
    assert.match(xp, /executionPlanForAi/);
  });

  it('catalog declares productCapabilities for Marketplace + AI', () => {
    const ssot = readFileSync(join(root, 'hubly-core/connected-apps-catalog.json'), 'utf8');
    const core = readFileSync(join(root, 'supabase/functions/_shared/hubly_connected_apps.ts'), 'utf8');
    assert.match(ssot, /productCapabilities/);
    assert.match(ssot, /RAW Editing/);
    assert.match(ssot, /Marketing Graphics/);
    assert.match(core, /CONNECTED_APP_CATALOG/);
    assert.match(core, /connected_apps_catalog\.json/);
    const client = readFileSync(join(root, 'public/journey-os/connected-apps.js'), 'utf8');
    assert.match(client, /HublyConnectedApps/);
    assert.match(client, /install:/);
  });

  it('ships Apps Marketplace UI (not buried in Settings)', () => {
    assert.equal(existsSync(join(root, 'public/journey-os/app-marketplace.js')), true);
    assert.equal(existsSync(join(root, 'public/journey-os/app-marketplace.css')), true);
    const js = readFileSync(join(root, 'public/journey-os/app-marketplace.js'), 'utf8');
    const html = readFileSync(join(root, 'public/hubly.html'), 'utf8');
    assert.match(js, /HublyAppMarketplace/);
    assert.match(js, /Business apps/);
    assert.match(js, /Creative & project apps/);
    assert.match(js, /Connect the tools you already use/);
    assert.match(js, /HublyActionEngine|HublyIntentEngine/);
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
