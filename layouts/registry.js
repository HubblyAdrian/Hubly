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

  // Chat widget (chatbot step 4) works off --ws-accent/--ws-surface/
  // --ws-border/--ws-radius alone, so every layout gets a coherent baseline
  // for free with zero entries here. This set tracks which layouts have a
  // bespoke widget treatment on top of that baseline (piece 2) -- it is not
  // a requirement gate, just a dev-facing nudge so a future layout's gap is
  // visible instead of silently shipping the generic look forever.
  const BESPOKE_WIDGET_TREATMENTS = new Set([
    // Piece 2: group-level signatures (local/premium/technical, matching
    // each layout's own `group` below) plus two flagships turned up
    // beyond their group baseline (neon-nights, obsidian-gold). A future
    // 16th layout not added here will warn until it's placed in a group.
    'clean-modern', 'minimal-pro', 'sunset-coastal', 'vibrant-pop', 'warm-local', 'simple-profile', // local
    'aurora-gradient', 'classic-trust', 'editorial', 'obsidian-gold', 'premium-dark', // premium
    'bold-impact', 'garage-industrial', 'neon-nights', 'chrome-velocity', // technical
  ]);

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
