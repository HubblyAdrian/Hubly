/**
 * Client-facing AdobeLightroomService facade.
 * UI components call this only — never Adobe APIs directly.
 * OAuth: adobe-oauth-start → browser redirect → adobe-oauth-callback → return ?adobe_oauth=
 * Tokens never leave the server (adobe_lightroom_connections, service-role only).
 */
(function (global) {
  'use strict';

  var PROVIDER = 'adobe_lightroom';
  var _configuredCache = null;
  var _connectedCache = null;

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

  function currentBusinessId(opts) {
    var fromOpts = opts && (opts.businessId || opts.business_id);
    if (fromOpts) return String(fromOpts).trim();
    try {
      if (global.currentBusiness && global.currentBusiness.id) {
        return String(global.currentBusiness.id).trim();
      }
    } catch (e) {}
    return '';
  }

  function defaultReturnTo() {
    try {
      var path = (global.location && (global.location.pathname || '/')) || '/';
      var search = (global.location && (global.location.search || '')) || '';
      var origin = (global.location && global.location.origin) || '';
      var full = origin + path + search;
      if (full.indexOf('/app') >= 0) return full;
      return origin + '/app';
    } catch (e) {
      return '/app';
    }
  }

  async function invokeEdge(name, body) {
    try {
      var db = global._hublyDb || (global.window && global.window._hublyDb);
      if (!db || !db.functions || !db.functions.invoke) {
        return { data: null, error: { message: 'Database not ready' } };
      }
      var res = await db.functions.invoke(name, { body: body || {} });
      var payload = res && res.data;
      if (res && res.error) {
        try {
          if (!payload && res.error.context && typeof res.error.context.json === 'function') {
            payload = await res.error.context.json();
          }
        } catch (e) {}
        return {
          data: payload,
          error: {
            message: (payload && payload.error) || res.error.message || 'Request failed',
            code: payload && payload.code,
          },
        };
      }
      return { data: payload, error: null };
    } catch (e) {
      return { data: null, error: { message: (e && e.message) || 'Request failed' } };
    }
  }

  var AdobeLightroomService = {
    id: PROVIDER,

    isConfigured: function () {
      return _configuredCache === true;
    },

    isConnected: function () {
      return _connectedCache === true;
    },

    status: async function (opts) {
      var businessId = currentBusinessId(opts);
      if (!businessId) {
        return notConfigured({ message: 'Save your business first to connect Adobe Lightroom.' });
      }
      var res = await invokeEdge('adobe-oauth-disconnect', {
        action: 'status',
        business_id: businessId,
      });
      var edge = res.data;
      if (!edge) {
        return notConfigured({
          message: (res.error && res.error.message) ||
            'Could not check Adobe status. Projects still work in Hubly.',
        });
      }
      if (edge.configured === false || edge.health === 'not_configured') {
        _configuredCache = false;
        _connectedCache = false;
        return notConfigured({
          message: edge.message ||
            'Adobe Lightroom isn’t configured yet. Projects still work without Lightroom.',
        });
      }
      _configuredCache = true;
      _connectedCache = !!edge.connected;
      return result({
        ok: true,
        status: edge.connected ? 'connected' : 'ready',
        message: edge.connected
          ? ('Connected as ' + (edge.account_label || 'Adobe'))
          : 'Adobe is ready — connect Lightroom when you want album sync.',
        data: {
          configured: true,
          connected: !!edge.connected,
          health: edge.health || (edge.connected ? 'healthy' : 'disconnected'),
          accountLabel: edge.account_label || null,
          adobeUserId: edge.adobe_user_id || null,
          connectedAt: edge.connected_at || null,
          lastSyncAt: edge.last_sync_at || null,
          lastError: edge.last_error || null,
        },
      });
    },

    connect: async function (opts) {
      opts = opts || {};
      var businessId = currentBusinessId(opts);
      if (!businessId) {
        var needBiz = notConfigured({
          message: 'Save your business first to connect Adobe Lightroom.',
        });
        toast(needBiz.message);
        return needBiz;
      }
      var body = {
        business_id: businessId,
        return_to: opts.returnTo || opts.return_to || defaultReturnTo(),
      };
      if (opts.projectId || opts.project_id) {
        body.project_id = opts.projectId || opts.project_id;
      }
      var res = await invokeEdge('adobe-oauth-start', body);
      var edge = res.data;
      if (edge && edge.code === 'PROVIDER_NOT_CONFIGURED') {
        _configuredCache = false;
        var nc = notConfigured({
          message: edge.error ||
            'Connect Adobe when ready — Hubly still manages projects, galleries, and delivery without Lightroom.',
        });
        toast(nc.message);
        return nc;
      }
      if (edge && edge.url) {
        _configuredCache = true;
        return result({
          ok: true,
          status: 'ready',
          message: 'Continue in Adobe to connect Lightroom.',
          data: { authorizeUrl: edge.url },
        });
      }
      var msg = (edge && edge.error) ||
        (res.error && res.error.message) ||
        'Could not start Adobe sign-in';
      toast(msg);
      return result({
        ok: false,
        status: 'error',
        message: msg,
        error: { code: 'ADOBE_OAUTH_START_FAILED', detail: msg, retryable: true },
      });
    },

    /** Start OAuth and navigate the browser to Adobe IMS. */
    connectAndRedirect: async function (opts) {
      var r = await AdobeLightroomService.connect(opts);
      if (r && r.ok && r.data && r.data.authorizeUrl) {
        try {
          global.location.href = r.data.authorizeUrl;
        } catch (e) {
          toast('Could not open Adobe sign-in');
        }
      }
      return r;
    },

    disconnect: async function (opts) {
      var businessId = currentBusinessId(opts);
      if (!businessId) {
        return notConfigured({ message: 'Save your business first.' });
      }
      var res = await invokeEdge('adobe-oauth-disconnect', {
        action: 'disconnect',
        business_id: businessId,
      });
      var edge = res.data;
      if (edge && edge.ok && edge.disconnected) {
        _connectedCache = false;
        toast('Adobe Lightroom disconnected');
        return result({
          ok: true,
          status: 'ready',
          message: 'Adobe Lightroom disconnected.',
          data: { disconnected: true },
        });
      }
      var msg = (edge && edge.error) ||
        (res.error && res.error.message) ||
        'Could not disconnect Adobe';
      toast(msg);
      return result({
        ok: false,
        status: 'error',
        message: msg,
        error: { code: 'ADOBE_DISCONNECT_FAILED', detail: msg, retryable: true },
      });
    },

    refreshToken: async function (opts) {
      var businessId = currentBusinessId(opts);
      if (!businessId) return notConfigured();
      var res = await invokeEdge('adobe-oauth-refresh', { business_id: businessId });
      var edge = res.data;
      if (edge && edge.ok) {
        return result({
          ok: true,
          status: 'connected',
          message: 'Adobe token refreshed.',
          data: { expiresAt: edge.expires_at || null },
        });
      }
      return result({
        ok: false,
        status: 'error',
        message: (edge && edge.error) ||
          (res.error && res.error.message) ||
          'Could not refresh Adobe token',
      });
    },

    createAlbum: async function (opts) {
      var edge = await invokeEdge('adobe-lightroom', Object.assign({ action: 'createAlbum' }, opts || {}));
      if (edge.data && edge.data.ok) return edge.data;
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
      if (edge.data && edge.data.ok) return edge.data;
      return notConfigured({ data: [] });
    },

    syncProject: async function (opts) {
      var edge = await invokeEdge('adobe-lightroom', Object.assign({ action: 'syncProject' }, opts || {}));
      if (edge.data && edge.data.ok) return edge.data;
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
      return AdobeLightroomService.connectAndRedirect(opts);
    },

    disconnectWorkspace: async function (opts) {
      return AdobeLightroomService.disconnect(opts);
    },

    publishGallery: async function (opts) {
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
  if (global.HublyConnectedApps && typeof global.HublyConnectedApps.registerFacade === 'function') {
    global.HublyConnectedApps.registerFacade(PROVIDER, AdobeLightroomService);
  }
})(typeof window !== 'undefined' ? window : globalThis);
