/**
 * Client-facing AdobeLightroomService facade.
 * UI components call this only — never Adobe APIs directly.
 * Attaches an External Workspace (provider = adobe_lightroom) to a Hubly Project.
 * Projects, galleries, invoices, and delivery work without Adobe.
 */
(function (global) {
  'use strict';

  var PROVIDER = 'adobe_lightroom';

  function result(partial) {
    return Object.assign({
      ok: false,
      status: 'not_configured',
      provider: PROVIDER,
      message: 'Adobe Lightroom is not connected yet. You can still run projects in Hubly.',
    }, partial || {});
  }

  function notConfigured(extra) {
    return result(Object.assign({
      ok: false,
      status: 'not_configured',
      error: {
        code: 'PROVIDER_NOT_CONFIGURED',
        detail: 'ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET',
        retryable: false,
      },
      meta: { adobeRequired: false, missing: ['ADOBE_CLIENT_ID', 'ADOBE_CLIENT_SECRET'] },
    }, extra || {}));
  }

  function toast(msg) {
    try {
      if (typeof global.toast === 'function') global.toast(msg);
    } catch (e) {}
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

  var AdobeLightroomService = {
    id: PROVIDER,

    isConfigured: function () {
      return false;
    },

    connect: async function (opts) {
      var edge = await invokeEdge('adobe-oauth-start', opts || {});
      if (edge && edge.url) {
        return result({
          ok: true,
          status: 'ready',
          message: 'Continue in Adobe to connect Lightroom.',
          data: { authorizeUrl: edge.url },
        });
      }
      var r = notConfigured({
        message: 'Connect Adobe when ready — Hubly still manages projects, galleries, and delivery without Lightroom.',
      });
      toast(r.message);
      return r;
    },

    disconnect: async function (opts) {
      await invokeEdge('adobe-oauth-disconnect', opts || {});
      return notConfigured({ message: 'Adobe is not connected.' });
    },

    refreshToken: async function (opts) {
      await invokeEdge('adobe-oauth-refresh', opts || {});
      return notConfigured();
    },

    createAlbum: async function (opts) {
      var edge = await invokeEdge('adobe-lightroom', Object.assign({ action: 'createAlbum' }, opts || {}));
      if (edge && edge.ok) return edge;
      var r = notConfigured({
        message: 'Lightroom album creation needs Adobe. Your Hubly project folder still works.',
      });
      toast(r.message);
      return r;
    },

    renameAlbum: async function (opts) {
      await invokeEdge('adobe-lightroom', Object.assign({ action: 'renameAlbum' }, opts || {}));
      return notConfigured();
    },

    listAlbums: async function (opts) {
      var edge = await invokeEdge('adobe-lightroom', Object.assign({ action: 'listAlbums' }, opts || {}));
      if (edge && edge.ok) return edge;
      return notConfigured({ data: [] });
    },

    syncProject: async function (opts) {
      var edge = await invokeEdge('adobe-lightroom', Object.assign({ action: 'syncProject' }, opts || {}));
      if (edge && edge.ok) return edge;
      var r = notConfigured({
        message: 'Sync Lightroom when Adobe is connected. Upload and deliver from Hubly anytime.',
      });
      toast(r.message);
      return r;
    },

    uploadPhotos: async function (opts) {
      await invokeEdge('adobe-lightroom', Object.assign({ action: 'uploadPhotos' }, opts || {}));
      return notConfigured({
        message: 'Upload photos in Hubly now. Lightroom sync will enhance this later.',
      });
    },

    downloadEditedPhotos: async function (opts) {
      await invokeEdge('adobe-lightroom', Object.assign({ action: 'downloadEditedPhotos' }, opts || {}));
      return notConfigured();
    },

    listAssets: async function (opts) {
      await invokeEdge('adobe-lightroom', Object.assign({ action: 'listAssets' }, opts || {}));
      return notConfigured({ data: [] });
    },

    getFavorites: async function (opts) {
      await invokeEdge('adobe-lightroom', Object.assign({ action: 'getFavorites' }, opts || {}));
      return notConfigured({ data: [] });
    },

    syncWorkspace: async function (opts) {
      return AdobeLightroomService.syncProject(opts);
    },

    connectWorkspace: async function (opts) {
      return AdobeLightroomService.connect(opts);
    },

    disconnectWorkspace: async function (opts) {
      return AdobeLightroomService.disconnect(opts);
    },

    publishGallery: async function (opts) {
      // Hubly gallery publish does not require Adobe.
      return result({
        ok: true,
        status: 'ready',
        message: 'Publish from the Gallery tab — Adobe export is optional.',
        data: { shareUrl: undefined },
        meta: { adobeRequired: false },
      });
    },

    archiveProject: async function (opts) {
      return result({
        ok: true,
        status: 'ready',
        message: 'Project can be archived in Hubly without Adobe.',
        data: { archived: true },
        meta: { adobeRequired: false },
      });
    },
  };

  global.AdobeLightroomService = AdobeLightroomService;
})(typeof window !== 'undefined' ? window : globalThis);
