/**
 * Hubly Core — Connected Apps (client)
 * Catalog SSOT: hubly-core/connected-apps-catalog.json
 * (loaded via connected-apps-catalog.generated.js)
 */
(function (global) {
  'use strict';

  var PACK = global.HUBLY_CONNECTED_APPS_CATALOG || { apps: [], marketingKinds: [], defaultInstalled: [] };
  var CATALOG = Array.isArray(PACK.apps) ? PACK.apps.slice() : [];
  var MARKETING_KINDS = Array.isArray(PACK.marketingKinds) ? PACK.marketingKinds.slice() : [];
  var DEFAULT_INSTALLED = Array.isArray(PACK.defaultInstalled)
    ? PACK.defaultInstalled.slice()
    : ['google', 'stripe', 'canva', 'adobe_lightroom'];
  var _facades = Object.create(null);

  function list() { return CATALOG.slice(); }

  function byCapability(cap) {
    return CATALOG.filter(function (a) {
      return (a.capabilities || []).indexOf(cap) !== -1;
    });
  }

  function get(id) {
    return CATALOG.find(function (a) { return a.id === id; }) || null;
  }

  function registerFacade(id, facade) {
    if (!id || !facade) return;
    _facades[id] = facade;
  }

  function getFacade(id) {
    return id ? (_facades[id] || null) : null;
  }

  function creativeApps() {
    var map = {};
    byCapability('creative').concat(byCapability('templates')).forEach(function (a) {
      map[a.id] = a;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function appScope(app) {
    if (!app) return 'business';
    if (app.scope === 'project' || app.scope === 'business') return app.scope;
    // Legacy fallback by id when catalog predates scope.
    if (['adobe_lightroom', 'canva', 'frame_io', 'dropbox', 'google_drive', 'capture_one'].indexOf(app.id) !== -1) {
      return 'project';
    }
    return 'business';
  }

  function businessApps() {
    return CATALOG.filter(function (a) { return appScope(a) === 'business'; });
  }

  function projectApps() {
    return CATALOG.filter(function (a) { return appScope(a) === 'project'; });
  }

  function tradeIdHint() {
    try {
      var biz = global.currentBusiness || {};
      var S = global.S || {};
      return String(S.businessType || biz.business_type || biz.type || '').toLowerCase();
    } catch (_) {
      return '';
    }
  }

  /** Only show project/creative apps that fit this trade (Lightroom for photo, etc.). */
  function isRelevantForTrade(app, tradeId) {
    if (!app) return false;
    var tid = String(tradeId || tradeIdHint() || '').toLowerCase();
    var photo = tid === 'photography' || tid.indexOf('photo') >= 0 || tid === 'weddings' ||
      tid === 'wedding' || tid.indexOf('video') >= 0;
    try {
      if (typeof global.isPhotoLedTrade === 'function' && global.isPhotoLedTrade()) photo = true;
    } catch (_) {}
    if (app.id === 'adobe_lightroom') {
      try {
        if (typeof global.hasBusinessCapability === 'function' && global.hasBusinessCapability('lightroom')) return true;
      } catch (_) {}
      return photo;
    }
    if (Array.isArray(app.trades) && app.trades.length) {
      if (!tid && !photo) {
        // Unknown trade — show universal project apps only (no trades list = universal).
        return false;
      }
      return app.trades.some(function (t) {
        var x = String(t || '').toLowerCase();
        return tid === x || tid.indexOf(x) >= 0 || (photo && (x.indexOf('photo') >= 0 || x === 'wedding' || x === 'weddings' || x === 'video'));
      });
    }
    return true;
  }

  function relevantApps(tradeId) {
    return CATALOG.filter(function (a) {
      if (appScope(a) === 'business') {
        // Hide "soon" business apps from the default owner surface.
        return !a.soon;
      }
      return isRelevantForTrade(a, tradeId);
    });
  }

  function marketingKinds() { return MARKETING_KINDS.slice(); }

  function prefsKey(businessId) {
    return 'hubly_apps_installed_' + String(businessId || 'anon');
  }

  function readInstalled(businessId) {
    try {
      var raw = global.localStorage && localStorage.getItem(prefsKey(businessId));
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return DEFAULT_INSTALLED.slice();
  }

  function writeInstalled(businessId, ids) {
    try {
      if (global.localStorage) {
        localStorage.setItem(prefsKey(businessId), JSON.stringify(ids || []));
      }
    } catch (_) {}
  }

  function isInstalled(businessId, appId) {
    return readInstalled(businessId).indexOf(appId) !== -1;
  }

  function install(businessId, appId) {
    var ids = readInstalled(businessId);
    if (ids.indexOf(appId) === -1) ids.push(appId);
    writeInstalled(businessId, ids);
    publishAppEvent('app.connected', { businessId: businessId, appId: appId });
    return ids;
  }

  function uninstall(businessId, appId) {
    var ids = readInstalled(businessId).filter(function (id) { return id !== appId; });
    writeInstalled(businessId, ids);
    publishAppEvent('app.disconnected', { businessId: businessId, appId: appId });
    return ids;
  }

  function publishAppEvent(type, payload) {
    try {
      if (global.HublyEvents && typeof global.HublyEvents.publish === 'function') {
        global.HublyEvents.publish(type, payload);
      }
    } catch (_) {}
  }

  function installedApps(businessId) {
    var ids = readInstalled(businessId);
    return ids.map(get).filter(Boolean);
  }

  function availableApps(businessId) {
    var ids = readInstalled(businessId);
    return CATALOG.filter(function (a) {
      return ids.indexOf(a.id) === -1;
    });
  }

  async function createMarketingAsset(opts) {
    opts = opts || {};
    var kind = opts.kind || 'instagram_carousel';
    var capability = opts.capability || 'creative';
    var resolved = null;

    if (global.HublyActionEngine && typeof global.HublyActionEngine.resolveForCapability === 'function') {
      resolved = global.HublyActionEngine.resolveForCapability(capability, {
        businessId: opts.businessId,
        preferredProviderId: opts.providerId
      });
    }

    var appId = (resolved && resolved.appId) || opts.providerId || null;
    var facade = getFacade(appId);
    if (facade && typeof facade.createDesign === 'function') {
      return facade.createDesign({
        businessId: opts.businessId,
        projectId: opts.projectId,
        title: opts.title || kind,
        brand: opts.brand,
        assetUrls: opts.photoUrls,
        copy: opts.copy
      });
    }

    if (resolved && resolved.status === 'not_configured') {
      return {
        ok: false,
        status: 'not_configured',
        provider: resolved.appId || null,
        message: 'Need: Marketing Graphics. Connect a creative app — Hubly saved the request on the project.',
        data: { kind: kind, status: 'planned', capability: capability }
      };
    }

    return {
      ok: false,
      status: 'not_configured',
      provider: appId,
      message: 'Need: Marketing Graphics. Install a creative Connected App from the Apps Marketplace.',
      data: { kind: kind, status: 'planned', capability: capability }
    };
  }

  global.HublyConnectedApps = {
    list: list,
    get: get,
    byCapability: byCapability,
    creativeApps: creativeApps,
    businessApps: businessApps,
    projectApps: projectApps,
    appScope: appScope,
    isRelevantForTrade: isRelevantForTrade,
    relevantApps: relevantApps,
    marketingKinds: marketingKinds,
    createMarketingAsset: createMarketingAsset,
    catalog: CATALOG,
    pack: PACK,
    installedApps: installedApps,
    availableApps: availableApps,
    isInstalled: isInstalled,
    install: install,
    uninstall: uninstall,
    readInstalled: readInstalled,
    registerFacade: registerFacade,
    getFacade: getFacade,
    DEFAULT_INSTALLED: DEFAULT_INSTALLED
  };

  if (global.CanvaConnectedApp) registerFacade('canva', global.CanvaConnectedApp);
  if (global.AdobeLightroomService) registerFacade('adobe_lightroom', global.AdobeLightroomService);
})(typeof window !== 'undefined' ? window : globalThis);
