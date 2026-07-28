/**
 * Hubly Core — Connected Apps (client catalog)
 * Product language: Connected Apps. Internal project links may use workspace rows.
 * UI renders actions from declared capabilities — avoid provider-specific branches.
 * AI / Action Engine speaks capability labels, never hardcodes vendor names.
 */
(function (global) {
  'use strict';

  var CATALOG = [
    {
      id: 'google',
      name: 'Google',
      role: 'Workspace',
      capabilities: ['calendar', 'storage', 'publishing', 'reviews'],
      productCapabilities: ['Calendar', 'Drive', 'Business Profile', 'Reviews'],
      installable: true
    },
    {
      id: 'stripe',
      name: 'Stripe',
      role: 'Payments',
      capabilities: ['payments'],
      productCapabilities: ['Payments', 'Invoices', 'Payouts'],
      installable: true
    },
    {
      id: 'adobe_lightroom',
      name: 'Adobe Lightroom',
      role: 'Editing',
      capabilities: ['editing', 'assets_import', 'assets_export'],
      productCapabilities: ['RAW Editing', 'Albums', 'Metadata', 'Photo Sync'],
      installable: true
    },
    {
      id: 'canva',
      name: 'Canva',
      role: 'Creative',
      capabilities: ['creative', 'templates', 'publishing', 'assets_import', 'assets_export'],
      productCapabilities: ['Marketing Graphics', 'Social Graphics', 'Flyers', 'Brand Assets', 'Templates'],
      actions: [
        { id: 'instagram_carousel', label: 'Create Instagram Carousel', capability: 'creative' },
        { id: 'facebook_post', label: 'Create Facebook Post', capability: 'creative' },
        { id: 'story', label: 'Create Story', capability: 'creative' },
        { id: 'flyer', label: 'Create Flyer', capability: 'creative' },
        { id: 'gift_card', label: 'Create Gift Certificate', capability: 'creative' },
        { id: 'thank_you', label: 'Create Thank You Card', capability: 'creative' },
        { id: 'before_after', label: 'Create Before & After Graphic', capability: 'creative' }
      ],
      installable: true
    },
    {
      id: 'frame_io',
      name: 'Frame.io',
      role: 'Review',
      capabilities: ['creative', 'assets_import', 'reviews'],
      productCapabilities: ['Review links', 'Asset comments', 'Client review'],
      actions: [{ id: 'open_review', label: 'Open Review', capability: 'reviews' }],
      installable: true
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      role: 'Storage',
      capabilities: ['storage', 'assets_import', 'assets_export'],
      productCapabilities: ['File Storage', 'Folder Sync', 'Asset Delivery'],
      actions: [{ id: 'sync_folder', label: 'Sync Folder', capability: 'storage' }],
      installable: true
    },
    {
      id: 'google_drive',
      name: 'Google Drive',
      role: 'Storage',
      capabilities: ['storage', 'assets_import', 'assets_export'],
      productCapabilities: ['File Storage', 'Folder Sync', 'Shared drives'],
      actions: [{ id: 'sync_folder', label: 'Sync Folder', capability: 'storage' }],
      installable: true
    },
    {
      id: 'meta',
      name: 'Meta',
      role: 'Publishing',
      capabilities: ['publishing', 'messaging', 'scheduling'],
      productCapabilities: ['Instagram', 'Facebook', 'Messenger', 'Publishing'],
      actions: [{ id: 'schedule_post', label: 'Schedule Post', capability: 'scheduling' }],
      installable: true
    },
    {
      id: 'google_business',
      name: 'Google Business',
      role: 'Local',
      capabilities: ['publishing', 'reviews'],
      productCapabilities: ['Google listing', 'Reviews', 'Local posts'],
      actions: [{ id: 'update_gbp', label: 'Update listing', capability: 'publishing' }],
      installable: true
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      role: 'Publishing',
      capabilities: ['publishing', 'scheduling'],
      productCapabilities: ['TikTok Publishing', 'Short video'],
      installable: false,
      soon: true
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      role: 'Publishing',
      capabilities: ['publishing'],
      productCapabilities: ['Pins', 'Idea pins'],
      installable: false,
      soon: true
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      role: 'Accounting',
      capabilities: ['payments', 'analytics'],
      productCapabilities: ['Invoices', 'Expenses', 'Taxes'],
      installable: false,
      soon: true
    },
    {
      id: 'zoom',
      name: 'Zoom',
      role: 'Meetings',
      capabilities: ['calendar', 'scheduling'],
      productCapabilities: ['Video meetings', 'Scheduling'],
      installable: false,
      soon: true
    },
    {
      id: 'capture_one',
      name: 'Capture One',
      role: 'Editing',
      capabilities: ['editing', 'assets_import', 'assets_export'],
      productCapabilities: ['RAW Editing', 'Tethered Capture', 'Photo Sync'],
      installable: false,
      soon: true
    }
  ];

  var MARKETING_KINDS = [
    { id: 'instagram_carousel', label: 'Instagram Carousel', capability: 'creative' },
    { id: 'facebook_post', label: 'Facebook Post', capability: 'creative' },
    { id: 'story', label: 'Story', capability: 'creative' },
    { id: 'flyer', label: 'Flyer', capability: 'creative' },
    { id: 'gift_card', label: 'Gift Card', capability: 'creative' },
    { id: 'thank_you', label: 'Thank You Card', capability: 'creative' },
    { id: 'before_after', label: 'Before & After Graphic', capability: 'creative' }
  ];

  var DEFAULT_INSTALLED = ['google', 'stripe', 'canva', 'adobe_lightroom'];
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

  /** Client provider facades register here — createMarketingAsset never switches on vendor names. */
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

  /**
   * Plan a marketing asset by capability (creative), not by hardcoding a vendor.
   * Resolver picks an app; facade registry executes createDesign.
   */
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
    marketingKinds: marketingKinds,
    createMarketingAsset: createMarketingAsset,
    catalog: CATALOG,
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

  // Facades may load before or after this file — bind whatever is already present.
  if (global.CanvaConnectedApp) registerFacade('canva', global.CanvaConnectedApp);
  if (global.AdobeLightroomService) registerFacade('adobe_lightroom', global.AdobeLightroomService);
})(typeof window !== 'undefined' ? window : globalThis);
