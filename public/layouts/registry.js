/**
 * Hubly Website Layout Engine
 * Detailers pick a complete layout; themes/fonts/structure are bundled per layout.
 */
(function (global) {
  const layouts = {};
  const LEGACY_THEME_TO_LAYOUT = {
    modern: 'clean-modern',
    dark: 'premium-dark',
    bold: 'bold-impact',
    classic: 'classic-trust',
    minimal: 'minimal-pro',
    vibrant: 'vibrant-pop',
    warm: 'warm-local',
  };

  function registerLayout(def) {
    if (!def || !def.id) return;
    layouts[def.id] = def;
  }

  function getLayout(id) {
    return layouts[id] || layouts['premium-dark'] || Object.values(layouts)[0];
  }

  function getCatalog() {
    return Object.values(layouts)
      .filter((l) => !l.hiddenFromPicker)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function getActiveLayoutId(website) {
    const w = website || {};
    if (w.layout && layouts[w.layout]) return w.layout;
    if (w.theme && LEGACY_THEME_TO_LAYOUT[w.theme]) return LEGACY_THEME_TO_LAYOUT[w.theme];
    return 'premium-dark';
  }

  function resolveLayout(website) {
    return getLayout(getActiveLayoutId(website));
  }

  function applyLayout(siteEl, website) {
    if (!siteEl) return;
    const layout = resolveLayout(website);
    Array.from(siteEl.classList).forEach((c) => {
      if (c.indexOf('ws-layout-') === 0) siteEl.classList.remove(c);
    });
    siteEl.classList.add('ws-layout-' + layout.id);
    return layout;
  }

  global.HublyLayouts = {
    registerLayout,
    getLayout,
    getCatalog,
    getActiveLayoutId,
    resolveLayout,
    applyLayout,
    LEGACY_THEME_TO_LAYOUT,
  };
})(typeof window !== 'undefined' ? window : global);
