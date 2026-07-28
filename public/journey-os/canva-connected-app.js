/**
 * Client Canva Connected App facade.
 * UI calls this only — never Canva APIs directly.
 * Part of Hubly Core Creative Engine via Connected Apps.
 */
(function (global) {
  'use strict';

  var PROVIDER = 'canva';

  function notConfigured(extra) {
    return Object.assign({
      ok: false,
      status: 'not_configured',
      provider: PROVIDER,
      message: 'Canva isn’t connected yet. Connect Canva to create designs — Hubly still plans creative work on the project.',
      error: {
        code: 'PROVIDER_NOT_CONFIGURED',
        detail: 'CANVA_CLIENT_ID, CANVA_CLIENT_SECRET',
        retryable: false
      },
      meta: { canvaRequired: true, missing: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET'] }
    }, extra || {});
  }

  function toast(msg) {
    try { if (typeof global.toast === 'function') global.toast(msg); } catch (e) {}
  }

  async function invokeEdge(name, body) {
    try {
      var db = global._hublyDb || (global.window && global.window._hublyDb);
      if (!db || !db.functions || !db.functions.invoke) return null;
      var res = await db.functions.invoke(name, { body: body || {} });
      if (res && res.data) return res.data;
      return null;
    } catch (e) {
      return null;
    }
  }

  var CanvaConnectedApp = {
    id: PROVIDER,
    name: 'Canva',
    capabilities: function () {
      return ['creative', 'templates', 'publishing', 'assets_import', 'assets_export'];
    },
    actions: function () {
      var entry = global.HublyConnectedApps && global.HublyConnectedApps.get
        ? global.HublyConnectedApps.get(PROVIDER)
        : null;
      return (entry && entry.actions) || [];
    },
    connect: async function (opts) {
      var edge = await invokeEdge('canva-oauth-start', opts || {});
      if (edge && edge.url) {
        return {
          ok: true,
          status: 'ready',
          provider: PROVIDER,
          message: 'Continue in Canva to connect.',
          data: { authorizeUrl: edge.url }
        };
      }
      var r = notConfigured();
      toast(r.message);
      return r;
    },
    disconnect: async function (opts) {
      await invokeEdge('canva-oauth-disconnect', opts || {});
      return notConfigured({ message: 'Canva is not connected.' });
    },
    refreshToken: async function (opts) {
      await invokeEdge('canva-oauth-refresh', opts || {});
      return notConfigured();
    },
    sync: async function (opts) {
      await invokeEdge('canva-sync', opts || {});
      return notConfigured();
    },
    status: async function () {
      return notConfigured({
        data: { connected: false, health: 'not_configured' }
      });
    },
    health: async function () {
      return { ok: true, status: 'ready', provider: PROVIDER, data: 'not_configured', message: 'Canva not configured' };
    },
    listDesigns: async function (opts) {
      await invokeEdge('canva-designs', Object.assign({ action: 'list' }, opts || {}));
      return notConfigured({ data: [] });
    },
    createDesign: async function (opts) {
      var edge = await invokeEdge('canva-designs', Object.assign({ action: 'create' }, opts || {}));
      if (edge && edge.ok) return edge;
      var r = notConfigured({
        message: 'Connect Canva to create this design. Hubly kept the creative request on the project.'
      });
      toast(r.message);
      return r;
    },
    importPhotos: async function (opts) {
      await invokeEdge('canva-designs', Object.assign({ action: 'importPhotos' }, opts || {}));
      return notConfigured();
    },
    exportDesign: async function (opts) {
      await invokeEdge('canva-designs', Object.assign({ action: 'export' }, opts || {}));
      return notConfigured();
    },
    listTemplates: async function (opts) {
      await invokeEdge('canva-designs', Object.assign({ action: 'templates' }, opts || {}));
      return notConfigured({ data: [] });
    },
    permissions: function () {
      return [
        { id: 'design:read', label: 'Read designs' },
        { id: 'design:write', label: 'Create and edit designs' },
        { id: 'asset:read', label: 'Import assets' },
        { id: 'asset:write', label: 'Export assets' }
      ];
    }
  };

  global.CanvaConnectedApp = CanvaConnectedApp;
  if (global.HublyConnectedApps && typeof global.HublyConnectedApps.registerFacade === 'function') {
    global.HublyConnectedApps.registerFacade(PROVIDER, CanvaConnectedApp);
  }
})(typeof window !== 'undefined' ? window : globalThis);
