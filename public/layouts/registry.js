/**
 * Hubly Website Layout Engine
 * Owners pick a complete layout; themes/fonts/structure are bundled per layout.
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

  // Chat widget works off --ws-accent/--ws-surface/--ws-border/--ws-radius
  // for every layout. This set tracks bespoke group treatments on top.
  const BESPOKE_WIDGET_TREATMENTS = new Set([
    'clean-modern', 'minimal-pro', 'sunset-coastal', 'vibrant-pop', 'warm-local', 'simple-profile',
    'spark-home', 'lawn-day', 'clear-view', // local home-service
    'aurora-gradient', 'classic-trust', 'editorial', 'obsidian-gold', 'premium-dark',
    'crystal-pane', 'estate-green', 'calm-service', // premium home-service
    'bold-impact', 'garage-industrial', 'neon-nights', 'chrome-velocity',
    'rinse-force', 'field-crew', 'grid-tech', // technical home-service
  ]);

  const TYPE_DEFAULTS = {
    detailing: 'obsidian-gold',
    windows: 'crystal-pane',
    pressure_washing: 'rinse-force',
    landscaping: 'estate-green',
    cleaning: 'calm-service',
    photography: 'editorial',
  };

  function registerLayout(def) {
    if (!def || !def.id) return;
    layouts[def.id] = def;
    if (!BESPOKE_WIDGET_TREATMENTS.has(def.id)) {
      console.warn(`HublyLayouts: "${def.id}" has no bespoke chat-widget treatment yet -- falls back to the CSS-variable-only baseline.`);
    }
  }

  function getLayout(id) {
    return layouts[id] || layouts['premium-dark'] || Object.values(layouts)[0];
  }

  function getCatalog() {
    return Object.values(layouts)
      .filter((l) => !l.hiddenFromPicker)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function matchesBusinessType(layout, businessType) {
    const verts = Array.isArray(layout.verticals) ? layout.verticals : ['*'];
    if (verts.includes('*')) return true;
    if (!businessType) return true;
    return verts.includes(businessType);
  }

  function getCatalogForType(businessType) {
    return getCatalog().filter((l) => matchesBusinessType(l, businessType));
  }

  function getTypeDefault(businessType) {
    if (global.HublyBlueprints && typeof global.HublyBlueprints.defaultLayout === 'function') {
      try {
        const fromBp = global.HublyBlueprints.defaultLayout(businessType);
        if (fromBp && layouts[fromBp]) return fromBp;
      } catch (e) { /* blueprint not ready */ }
    }
    const id = TYPE_DEFAULTS[businessType] || 'clean-modern';
    return layouts[id] ? id : 'clean-modern';
  }

  function getActiveLayoutId(website) {
    const w = website || {};
    if (w.layout && layouts[w.layout]) return w.layout;
    if (w.theme && LEGACY_THEME_TO_LAYOUT[w.theme]) return LEGACY_THEME_TO_LAYOUT[w.theme];
    // Prefer a readable light default — premium-dark left Instant Site titles invisible
    // when layout had not been selected yet (dark page + navy headings).
    return layouts['clean-modern'] ? 'clean-modern' : 'premium-dark';
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
    getCatalogForType,
    getTypeDefault,
    matchesBusinessType,
    getActiveLayoutId,
    resolveLayout,
    applyLayout,
    LEGACY_THEME_TO_LAYOUT,
    TYPE_DEFAULTS,
  };
})(typeof window !== 'undefined' ? window : global);
