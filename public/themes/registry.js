/**
 * Hubly Website Theme Engine
 * Content (WebsiteData) is separate from presentation (theme + tokens).
 */
(function (global) {
  const RADIUS_MAP = { sm: '8px', md: '12px', lg: '18px', xl: '24px' };
  const SPACING_MAP = { tight: '48px', default: '72px', airy: '96px' };
  const HERO_MAP = {
    compact: 'min(70vh, 560px)',
    default: 'min(85vh, 720px)',
    tall: 'min(92vh, 820px)',
  };
  const WIDTH_MAP = { narrow: '880px', default: '1080px', wide: '1200px' };

  const TOKEN_DEFAULTS = {
    borderRadius: 'lg',
    heroHeight: 'tall',
    sectionSpacing: 'airy',
    buttonShape: 'pill',
    containerWidth: 'default',
    animationStyle: 'subtle',
  };

  const themes = {};

  function registerTheme(def) {
    if (!def || !def.id) return;
    themes[def.id] = def;
  }

  function getTheme(id) {
    return themes[id] || themes.modern;
  }

  function getCatalog() {
    return Object.values(themes).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function getActiveThemeId(website) {
    const id = (website && website.theme) || 'modern';
    return themes[id] ? id : 'modern';
  }

  function mergeTokens(themeId, website, accentColor) {
    const theme = getTheme(themeId);
    const user = (website && website.themeSettings) || {};
    const merged = Object.assign({}, TOKEN_DEFAULTS, theme.tokenDefaults || {}, user);
    if (accentColor) merged.accentColor = accentColor;
    return merged;
  }

  function applyTheme(siteEl, themeId, tokens) {
    if (!siteEl) return;
    const id = themes[themeId] ? themeId : 'modern';
    const t = tokens || mergeTokens(id, null, null);
    Array.from(siteEl.classList).forEach((c) => {
      if (c.indexOf('ws-theme-') === 0) siteEl.classList.remove(c);
    });
    siteEl.classList.add('ws-theme-' + id);

    siteEl.style.setProperty('--ws-accent', t.accentColor || '#1a3a6e');
    siteEl.style.setProperty('--ws-radius', RADIUS_MAP[t.borderRadius] || RADIUS_MAP.lg);
    siteEl.style.setProperty('--ws-section-pad', SPACING_MAP[t.sectionSpacing] || SPACING_MAP.default);
    siteEl.style.setProperty('--ws-hero-min', HERO_MAP[t.heroHeight] || HERO_MAP.tall);
    siteEl.style.setProperty('--ws-btn-radius', t.buttonShape === 'pill' ? '999px' : t.buttonShape === 'square' ? '4px' : '12px');
    siteEl.style.setProperty('--ws-max', WIDTH_MAP[t.containerWidth] || WIDTH_MAP.default);

    const theme = getTheme(id);
    if (theme.onApply) theme.onApply(siteEl, t);
  }

  global.HublyThemes = {
    registerTheme,
    getTheme,
    getCatalog,
    getActiveThemeId,
    mergeTokens,
    applyTheme,
    RADIUS_MAP,
    SPACING_MAP,
    HERO_MAP,
    WIDTH_MAP,
    TOKEN_DEFAULTS,
  };
})(typeof window !== 'undefined' ? window : global);
