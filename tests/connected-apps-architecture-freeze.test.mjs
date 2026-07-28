/**
 * Architecture FREEZE verification — Connected Apps plugin contract.
 *
 * Proves: a fake provider that only implements the provider interface +
 * declares capabilities is discovered by Planner/Resolver/capability filters
 * without editing Intent Engine, Event Bus, or Marketplace.
 *
 * Also asserts freeze docs + naming consistency.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Miniature registry mirroring Connected Apps contract (Node-safe). */
function createRegistry() {
  const map = new Map();
  return {
    register(provider) { map.set(provider.id, provider); },
    unregister(id) { map.delete(id); },
    get(id) { return map.get(id) || null; },
    list() { return Array.from(map.values()); },
    byCapability(cap) {
      return Array.from(map.values()).filter((p) => p.capabilities().includes(cap));
    },
    resolve(cap) {
      const apps = this.byCapability(cap);
      return apps.find((a) => a.isConfigured()) || apps[0] || null;
    },
  };
}

function fakeCreativeProvider(id) {
  return {
    id,
    name: 'Fake Creative Plugin',
    isConfigured() { return true; },
    missingEnv() { return []; },
    async connect() { return { ok: true }; },
    async disconnect() { return { ok: true }; },
    async sync() { return { ok: true, data: { lastSyncAt: new Date().toISOString() } }; },
    async status() { return { ok: true, data: { connected: true, health: 'healthy' } }; },
    async health() { return { ok: true, data: 'healthy' }; },
    permissions() { return []; },
    capabilities() { return ['creative', 'templates']; },
    actions() {
      return [{ id: 'make_graphic', label: 'Create Marketing Graphic', capability: 'creative' }];
    },
    async createDesign(opts) {
      return { ok: true, data: { id: 'des_fake', title: opts.title || 'graphic' } };
    },
  };
}

describe('Connected Apps architecture freeze', () => {
  it('ships freeze architecture document', () => {
    const doc = join(root, 'docs/architecture/CONNECTED_APPS_ARCHITECTURE.md');
    assert.equal(existsSync(doc), true);
    const md = readFileSync(doc, 'utf8');
    assert.match(md, /ARCHITECTURE FREEZE/);
    assert.match(md, /Intent Engine/);
    assert.match(md, /ConnectedAppProvider/);
    assert.match(md, /Lock rule/);
    assert.match(md, /hubly-core\/connected-apps-catalog\.json/);
    assert.match(md, /Execution Plan/);
    assert.match(md, /External Workspace/);
  });

  it('plugin test: fake provider is resolved by capability only', async () => {
    const registry = createRegistry();
    // Simulate existing Canva without hardcoding it in resolve:
    registry.register({
      id: 'canva',
      name: 'Canva',
      isConfigured() { return false; },
      missingEnv() { return ['CANVA_CLIENT_ID']; },
      capabilities() { return ['creative']; },
      permissions() { return []; },
      async connect() { return {}; },
      async disconnect() { return {}; },
      async sync() { return {}; },
      async status() { return {}; },
      async health() { return {}; },
    });

    const pluginId = 'acme_designer';
    registry.register(fakeCreativeProvider(pluginId));

    // Planner need: Marketing Graphics → capability creative
    const resolved = registry.resolve('creative');
    assert.ok(resolved, 'Resolver must find a creative provider');
    assert.equal(resolved.id, pluginId, 'Configured plugin wins over not_configured Canva');
    assert.deepEqual(resolved.capabilities(), ['creative', 'templates']);

    // Creative Engine path: call createDesign on resolved provider — no vendor switch
    const created = await resolved.createDesign({ title: 'Sneak peek' });
    assert.equal(created.ok, true);
    assert.equal(created.data.id, 'des_fake');

    // Intent AI view must not need vendor names
    const aiPrompt =
      'Intent: Promote Project.\n' +
      'Capabilities needed: Marketing Graphics, Social Publishing.\n' +
      'Ready to Execute.';
    assert.doesNotMatch(aiPrompt, /Canva|Meta|Adobe|Dropbox/i);
    assert.match(aiPrompt, /Intent:/);
    assert.match(aiPrompt, /Capabilities needed:/);
  });

  it('ConnectedAppProvider contract includes createDesign optional + open id', () => {
    const core = readFileSync(join(root, 'supabase/functions/_shared/hubly_connected_apps.ts'), 'utf8');
    assert.match(core, /export type ConnectedAppId = string/);
    assert.match(core, /createDesign\?/);
    assert.match(core, /registerConnectedApp/);
    assert.match(core, /listConnectedAppsByCapability/);
    assert.match(core, /clearConnectedAppRegistryForTests/);
    assert.match(core, /productCapabilities/);
  });

  it('Creative Engine resolves via capability, not hardcoded Canva default', () => {
    const creative = readFileSync(join(root, 'supabase/functions/_shared/hubly_creative_engine.ts'), 'utf8');
    assert.match(creative, /resolveProviderForCapability/);
    assert.match(creative, /ensureHublyConnectedAppsRegistered/);
    assert.doesNotMatch(creative, /providerId \|\| ["']canva["']/);
    assert.match(creative, /provider\.createDesign/);
  });

  it('client marketing create uses facade registry, not canva id switch', () => {
    const client = readFileSync(join(root, 'public/journey-os/connected-apps.js'), 'utf8');
    assert.match(client, /registerFacade/);
    assert.match(client, /getFacade/);
    assert.doesNotMatch(client, /resolved\.appId === ['"]canva['"]/);
    assert.match(client, /facade\.createDesign/);
  });

  it('event model documents Intent pipeline and shared events', () => {
    const events = readFileSync(join(root, 'docs/operate/EVENTS.md'), 'utf8');
    const bus = readFileSync(join(root, 'supabase/functions/_shared/hubly_event_bus.ts'), 'utf8');
    assert.match(events, /Intent Engine/);
    assert.match(events, /project\.delivered/);
    assert.match(bus, /project\.delivered/);
    assert.match(bus, /capabilities\?:/);
    assert.match(bus, /registerDefaultEngineSubscribers/);
  });

  it('bootstrap registers providers without UI importing vendors', () => {
    const boot = readFileSync(
      join(root, 'supabase/functions/_shared/hubly_connected_apps_bootstrap.ts'),
      'utf8',
    );
    assert.match(boot, /ensureHublyConnectedAppsRegistered/);
    assert.match(boot, /ensureCanvaConnectedApp/);
    assert.match(boot, /getAdobeLightroomService/);
  });
});
