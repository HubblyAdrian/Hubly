/**
 * Hubly Core — Connected Apps (client catalog)
 * Product language: Connected Apps. Internal project links may use workspace rows.
 * UI renders actions from declared capabilities — avoid provider-specific branches.
 */
(function (global) {
  'use strict';

  var CATALOG = [
    {
      id: 'adobe_lightroom',
      name: 'Adobe Lightroom',
      role: 'Editing',
      capabilities: ['editing', 'assets_import', 'assets_export'],
      actions: [
        { id: 'create_album', label: 'Create Lightroom Album', capability: 'editing' },
        { id: 'sync_photos', label: 'Sync Photos', capability: 'assets_import' },
        { id: 'open_lightroom', label: 'Open Lightroom', capability: 'editing' }
      ]
    },
    {
      id: 'canva',
      name: 'Canva',
      role: 'Creative',
      capabilities: ['creative', 'templates', 'publishing', 'assets_import', 'assets_export'],
      actions: [
        { id: 'instagram_carousel', label: 'Create Instagram Carousel', capability: 'creative' },
        { id: 'facebook_post', label: 'Create Facebook Post', capability: 'creative' },
        { id: 'story', label: 'Create Story', capability: 'creative' },
        { id: 'flyer', label: 'Create Flyer', capability: 'creative' },
        { id: 'gift_card', label: 'Create Gift Certificate', capability: 'creative' },
        { id: 'thank_you', label: 'Create Thank You Card', capability: 'creative' },
        { id: 'before_after', label: 'Create Before & After Graphic', capability: 'creative' }
      ]
    },
    {
      id: 'frame_io',
      name: 'Frame.io',
      role: 'Review',
      capabilities: ['creative', 'assets_import', 'reviews'],
      actions: [
        { id: 'open_review', label: 'Open Review', capability: 'reviews' }
      ]
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      role: 'Storage',
      capabilities: ['storage', 'assets_import', 'assets_export'],
      actions: [{ id: 'sync_folder', label: 'Sync Folder', capability: 'storage' }]
    },
    {
      id: 'google_drive',
      name: 'Google Drive',
      role: 'Storage',
      capabilities: ['storage', 'assets_import', 'assets_export'],
      actions: [{ id: 'sync_folder', label: 'Sync Folder', capability: 'storage' }]
    },
    {
      id: 'meta',
      name: 'Meta',
      role: 'Publishing',
      capabilities: ['publishing', 'messaging', 'scheduling'],
      actions: [{ id: 'schedule_post', label: 'Schedule Post', capability: 'scheduling' }]
    },
    {
      id: 'google_business',
      name: 'Google Business',
      role: 'Local',
      capabilities: ['publishing', 'reviews'],
      actions: [{ id: 'update_gbp', label: 'Update listing', capability: 'publishing' }]
    },
    {
      id: 'capture_one',
      name: 'Capture One',
      role: 'Editing',
      capabilities: ['editing', 'assets_import', 'assets_export'],
      actions: [{ id: 'sync_photos', label: 'Sync Photos', capability: 'assets_import' }]
    }
  ];

  var MARKETING_KINDS = [
    { id: 'instagram_carousel', label: 'Instagram Carousel' },
    { id: 'facebook_post', label: 'Facebook Post' },
    { id: 'story', label: 'Story' },
    { id: 'flyer', label: 'Flyer' },
    { id: 'gift_card', label: 'Gift Card' },
    { id: 'thank_you', label: 'Thank You Card' },
    { id: 'before_after', label: 'Before & After Graphic' }
  ];

  function list() { return CATALOG.slice(); }

  function byCapability(cap) {
    return CATALOG.filter(function (a) {
      return (a.capabilities || []).indexOf(cap) !== -1;
    });
  }

  function get(id) {
    return CATALOG.find(function (a) { return a.id === id; }) || null;
  }

  function creativeApps() {
    var map = {};
    byCapability('creative').concat(byCapability('templates')).forEach(function (a) {
      map[a.id] = a;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function marketingKinds() { return MARKETING_KINDS.slice(); }

  /**
   * Plan a marketing asset. Calls Canva when available; otherwise returns an
   * honest not_configured plan Hubly can still track on the project.
   */
  async function createMarketingAsset(opts) {
    opts = opts || {};
    var providerId = opts.providerId || 'canva';
    var kind = opts.kind || 'instagram_carousel';
    var canva = global.CanvaConnectedApp;
    if (providerId === 'canva' && canva && typeof canva.createDesign === 'function') {
      var res = await canva.createDesign({
        businessId: opts.businessId,
        projectId: opts.projectId,
        title: opts.title || kind,
        brand: opts.brand,
        assetUrls: opts.photoUrls,
        copy: opts.copy
      });
      return res;
    }
    return {
      ok: false,
      status: 'not_configured',
      provider: providerId,
      message: 'Connect ' + ((get(providerId) && get(providerId).name) || providerId) + ' to create this asset. Hubly saved the request on the project.',
      data: { kind: kind, status: 'planned' },
      meta: { canvaRequired: providerId === 'canva' }
    };
  }

  global.HublyConnectedApps = {
    list: list,
    get: get,
    byCapability: byCapability,
    creativeApps: creativeApps,
    marketingKinds: marketingKinds,
    createMarketingAsset: createMarketingAsset,
    catalog: CATALOG
  };
})(typeof window !== 'undefined' ? window : globalThis);
