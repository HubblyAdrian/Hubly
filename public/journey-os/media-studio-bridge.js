/**
 * Hubly Media ↔ Studio bridge.
 * Hubly is the source of truth: Media owns assets, Studio owns campaigns.
 * sessionStorage handoff so the same photo is never re-uploaded.
 */
(function (global) {
  'use strict';

  var KEY = 'hubly_media_studio_bridge';

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function get() {
    try {
      var data = safeParse(global.sessionStorage && global.sessionStorage.getItem(KEY));
      if (!data || data.v !== 1) return null;
      return data;
    } catch (e) { return null; }
  }

  function set( partial) {
    var cur = get() || { v: 1, selected: [] };
    var next = Object.assign({}, cur, partial || {}, { v: 1, updatedAt: new Date().toISOString() });
    if (!Array.isArray(next.selected)) next.selected = [];
    try {
      if (global.sessionStorage) global.sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {}
    return next;
  }

  function clear() {
    try {
      if (global.sessionStorage) global.sessionStorage.removeItem(KEY);
    } catch (e) {}
  }

  /** Normalize a Media upload / tile into a durable Studio asset shape. */
  function toStudioAsset(item) {
    if (!item) return null;
    var url = item.url || item.previewUrl || '';
    if (!url || String(url).indexOf('blob:') === 0 || String(url).indexOf('data:') === 0) {
      url = item.previewUrl && String(item.previewUrl).indexOf('blob:') !== 0 ? item.previewUrl : (item.url || '');
    }
    if (!url || String(url).indexOf('blob:') === 0) return null;
    return {
      id: item.id || ('media_' + Math.random().toString(36).slice(2, 9)),
      url: url,
      previewUrl: item.previewUrl || url,
      name: item.name || 'Photo',
      kind: item.kind || 'media',
      source: 'hubly_media',
      media_job_id: item.media_job_id || item.projectId || null
    };
  }

  function switchTo(view) {
    try {
      var ni = document.querySelector('[data-v="' + view + '"]');
      if (ni && typeof global.switchV === 'function') {
        global.switchV(ni);
        return true;
      }
    } catch (e) {}
    return false;
  }

  global.HublyMediaStudioBridge = {
    KEY: KEY,
    get: get,
    set: set,
    clear: clear,
    toStudioAsset: toStudioAsset,
    switchToStudio: function () { return switchTo('studio') || switchTo('marketing'); },
    switchToMedia: function () { return switchTo('photo-projects'); }
  };
})(typeof window !== 'undefined' ? window : this);
