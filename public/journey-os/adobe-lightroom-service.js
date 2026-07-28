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
      // Prefer provider Edge (verifies catalog + returns token expiry / last refresh).
      var res = await invokeEdge('adobe-lightroom', {
        action: 'status',
        business_id: businessId,
      });
      var edge = res.data;
      if (!edge || edge.error) {
        res = await invokeEdge('adobe-oauth-disconnect', {
          action: 'status',
          business_id: businessId,
        });
        edge = res.data;
      }
      if (!edge) {
        return notConfigured({
          message: (res.error && res.error.message) ||
            'Could not check Adobe status. Projects still work in Hubly.',
        });
      }
      if (edge.configured === false || edge.health === 'not_configured' ||
          (edge.data && edge.data.health === 'not_configured')) {
        _configuredCache = false;
        _connectedCache = false;
        return notConfigured({
          message: edge.message ||
            'Adobe Lightroom isn’t configured yet. Projects still work without Lightroom.',
        });
      }
      var data = edge.data || edge;
      var connected = !!(data.connected || edge.connected);
      _configuredCache = true;
      _connectedCache = connected;
      return result({
        ok: true,
        status: connected ? 'connected' : 'ready',
        message: data.message || edge.message ||
          (connected
            ? ('Connected as ' + (data.adobeAccount || data.adobe_account || edge.account_label || 'Adobe'))
            : 'Adobe is ready — connect Lightroom when you want album sync.'),
        data: {
          configured: true,
          connected: connected,
          health: data.health || edge.health || (connected ? 'healthy' : 'disconnected'),
          accountLabel: data.adobeAccount || data.adobe_account || edge.account_label || null,
          adobeUserId: data.adobeUserId || edge.adobe_user_id || null,
          tokenExpiresAt: data.tokenExpiresAt || data.token_expires_at || edge.token_expires_at || null,
          lastRefreshAt: data.lastRefreshAt || data.last_refresh_at || edge.last_refresh_at || null,
          catalogId: data.catalogId || data.catalog_id || edge.catalog_id || null,
          connectedAt: data.connectedAt || edge.connected_at || null,
          lastSyncAt: data.lastSyncAt || edge.last_sync_at || null,
          lastError: data.lastError || edge.last_error || null,
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

    health: async function (opts) {
      var businessId = currentBusinessId(opts);
      var res = await invokeEdge('adobe-lightroom', {
        action: 'health',
        business_id: businessId || undefined,
      });
      if (res.data && (res.data.ok || res.data.data)) return res.data;
      return result({
        ok: false,
        status: 'error',
        message: (res.data && res.data.message) ||
          (res.error && res.error.message) ||
          'Could not check Lightroom health',
      });
    },

    createAlbum: async function (opts) {
      opts = opts || {};
      var businessId = currentBusinessId(opts);
      var res = await invokeEdge('adobe-lightroom', {
        action: 'createAlbum',
        business_id: businessId,
        project_id: opts.projectId || opts.project_id,
        name: opts.name,
      });
      var edge = res.data;
      if (edge && edge.ok && edge.data) {
        toast(edge.message || 'Lightroom album ready');
        return edge;
      }
      var msg = (edge && (edge.message || (edge.error && edge.error.detail) || edge.error)) ||
        (res.error && res.error.message) ||
        'Could not create Lightroom album. Connect Adobe first.';
      toast(typeof msg === 'string' ? msg : 'Could not create Lightroom album');
      return edge || result({ ok: false, status: 'error', message: String(msg) });
    },

    renameAlbum: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'renameAlbum',
        business_id: currentBusinessId(opts),
        album_id: opts.albumId || opts.album_id,
        name: opts.name,
        catalog_id: opts.catalogId || opts.catalog_id,
        project_id: opts.projectId || opts.project_id,
      });
      return res.data || result({ ok: false, status: 'error', message: 'Rename failed' });
    },

    listAlbums: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'listAlbums',
        business_id: currentBusinessId(opts),
        subtype: opts.subtype || 'project',
      });
      if (res.data && res.data.ok) return res.data;
      return result({ ok: false, status: 'error', message: 'Could not list albums', data: [] });
    },

    listAssets: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'listAssets',
        business_id: currentBusinessId(opts),
        album_id: opts.albumId || opts.album_id,
        catalog_id: opts.catalogId || opts.catalog_id,
      });
      if (res.data && res.data.ok) return res.data;
      return result({ ok: false, status: 'error', message: 'Could not list assets', data: [] });
    },

    getAsset: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'getAsset',
        business_id: currentBusinessId(opts),
        asset_id: opts.assetId || opts.asset_id,
        catalog_id: opts.catalogId || opts.catalog_id,
      });
      return res.data || result({ ok: false, status: 'error', message: 'Could not load asset' });
    },

    downloadEditedAsset: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'downloadEditedAsset',
        business_id: currentBusinessId(opts),
        asset_id: opts.assetId || opts.asset_id,
        catalog_id: opts.catalogId || opts.catalog_id,
        rendition_type: opts.renditionType || opts.rendition_type,
      });
      return res.data || result({ ok: false, status: 'error', message: 'Could not download rendition' });
    },

    downloadEditedPhotos: async function (opts) {
      return AdobeLightroomService.downloadEditedAsset(opts);
    },

    getFavorites: async function (opts) {
      var listed = await AdobeLightroomService.listAssets(opts);
      if (!listed || !listed.ok) return listed || notConfigured({ data: [] });
      var assets = (listed.data || []).filter(function (a) { return a && a.favorite; });
      return result({
        ok: true,
        status: 'ready',
        message: assets.length + ' favorite(s)',
        data: assets,
      });
    },

    openAlbum: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'openAlbum',
        business_id: currentBusinessId(opts),
        project_id: opts.projectId || opts.project_id,
        album_id: opts.albumId || opts.album_id,
        catalog_id: opts.catalogId || opts.catalog_id,
      });
      var edge = res.data;
      var hint = (edge && edge.data && edge.data.hint) ||
        'Open Adobe Lightroom → Connections to find this Hubly project album.';
      toast(hint);
      return edge || result({
        ok: false,
        status: 'error',
        message: hint,
        error: { code: 'UNSUPPORTED_OPERATION', detail: hint, retryable: false },
        data: { hint: hint },
      });
    },

    syncProject: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'syncProject',
        business_id: currentBusinessId(opts),
        project_id: opts.projectId || opts.project_id,
        album_id: opts.albumId || opts.album_id,
        catalog_id: opts.catalogId || opts.catalog_id,
      });
      var edge = res.data;
      if (edge && edge.ok) {
        toast(edge.message || 'Lightroom sync complete');
        return edge;
      }
      var msg = (edge && (edge.message || (edge.error && edge.error.detail))) ||
        (res.error && res.error.message) ||
        'Sync Lightroom when Adobe is connected. Upload and deliver from Hubly anytime.';
      toast(String(msg));
      return edge || result({ ok: false, status: 'error', message: String(msg) });
    },

    uploadPhotos: async function (opts) {
      opts = opts || {};
      var res = await invokeEdge('adobe-lightroom', {
        action: 'uploadPhotos',
        business_id: currentBusinessId(opts),
        project_id: opts.projectId || opts.project_id,
        album_id: opts.albumId || opts.album_id,
        file_refs: opts.fileRefs || opts.file_refs || [],
      });
      var edge = res.data;
      var msg = (edge && edge.message) ||
        'Upload photos in Hubly or Lightroom for now. Hubly→Lightroom upload is deferred.';
      toast(msg);
      return edge || result({
        ok: false,
        status: 'error',
        message: msg,
        error: { code: 'NOT_IMPLEMENTED', detail: msg, retryable: false },
      });
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
