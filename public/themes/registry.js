/**
 * Hubly Website Theme Engine
 * Content (WebsiteData) is separate from presentation (theme + tokens).
 */
(function (global) {
  const RADIUS_MAP = { sm: '8px', md: '12px', lg: '18px', xl: '24px' };
  const SPACING_MAP = { tight: '48px', default: '72px', airy: '96px' };
  const HERO_MAP = {
    compact: 'min(52vh, 480px)',
    default: 'min(62vh, 580px)',
    tall: 'min(78vh, 680px)',
  };
  const WIDTH_MAP = { narrow: '960px', default: '1200px', wide: '1320px' };

  const TOKEN_DEFAULTS = {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'pill',
    containerWidth: 'wide',
    animationStyle: 'subtle',
  };

  const LIGHT_TEXT = {
    headingColor: '#0f172a',
    textColor: '#0f172a',
    mutedColor: '#64748b',
  };
  const DARK_TEXT = {
    headingColor: '#f8fafc',
    textColor: '#e2e8f0',
    mutedColor: '#94a3b8',
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

  function parseHex(color) {
    if (!color || typeof color !== 'string') return null;
    let c = color.trim();
    if (c.startsWith('rgb')) {
      const m = c.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (!m) return null;
      return { r: +m[1], g: +m[2], b: +m[3] };
    }
    if (c[0] === '#') c = c.slice(1);
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length < 6) return null;
    return {
      r: parseInt(c.slice(0, 2), 16),
      g: parseInt(c.slice(2, 4), 16),
      b: parseInt(c.slice(4, 6), 16),
    };
  }

  function relativeLuminance(color) {
    const rgb = parseHex(color);
    if (!rgb) return 0.5;
    const chan = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
  }

  function contrastRatio(a, b) {
    const L1 = relativeLuminance(a);
    const L2 = relativeLuminance(b);
    const hi = Math.max(L1, L2);
    const lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /**
   * Keep headings/body readable against pageBg.
   * Flips text to a paired light or dark set — does not invent random hues.
   */
  function healContrast(tokens) {
    const t = Object.assign({}, tokens || {});
    const pageBg = t.pageBg || t.sectionAltBg || '#fafafa';
    const heading = t.headingColor || t.textColor || '#0f172a';
    const pageDark = relativeLuminance(pageBg) < 0.35;
    const ratio = contrastRatio(pageBg, heading);
    if (ratio >= 3.2) {
      t._wsTone = pageDark ? 'dark' : 'light';
      return t;
    }
    const pair = pageDark ? DARK_TEXT : LIGHT_TEXT;
    t.headingColor = pair.headingColor;
    t.textColor = pair.textColor;
    t.mutedColor = pair.mutedColor;
    t._wsTone = pageDark ? 'dark' : 'light';
    return t;
  }

  function mergeTokens(themeId, website, accentColor) {
    const theme = getTheme(themeId);
    const user = (website && website.themeSettings) || {};
    const merged = Object.assign({}, TOKEN_DEFAULTS, theme.tokenDefaults || {}, user);
    if (accentColor) merged.accentColor = accentColor;
    return healContrast(merged);
  }

  function applyTheme(siteEl, themeId, tokens) {
    if (!siteEl) return;
    const id = themes[themeId] ? themeId : 'modern';
    const t = healContrast(tokens || mergeTokens(id, null, null));
    Array.from(siteEl.classList).forEach((c) => {
      if (c.indexOf('ws-theme-') === 0) siteEl.classList.remove(c);
    });
    siteEl.classList.add('ws-theme-' + id);
    if (t._wsTone === 'dark') siteEl.setAttribute('data-ws-tone', 'dark');
    else siteEl.setAttribute('data-ws-tone', 'light');

    siteEl.style.setProperty('--ws-accent', t.accentColor || '#1a3a6e');
    siteEl.style.setProperty('--ws-radius', RADIUS_MAP[t.borderRadius] || RADIUS_MAP.lg);
    siteEl.style.setProperty('--ws-section-pad', SPACING_MAP[t.sectionSpacing] || SPACING_MAP.default);
    siteEl.style.setProperty('--ws-hero-min', HERO_MAP[t.heroHeight] || HERO_MAP.default);
    siteEl.style.setProperty('--ws-btn-radius', t.buttonShape === 'pill' ? '999px' : t.buttonShape === 'square' ? '4px' : '12px');
    siteEl.style.setProperty('--ws-max', WIDTH_MAP[t.containerWidth] || WIDTH_MAP.default);

    const theme = getTheme(id);
    if (theme.onApply) theme.onApply(siteEl, t);
    // Re-assert healed text tokens after onApply (themes set from t already, but belt-and-suspenders).
    if (t.headingColor) siteEl.style.setProperty('--ws-heading', t.headingColor);
    if (t.textColor) siteEl.style.setProperty('--ws-text', t.textColor);
    if (t.mutedColor) siteEl.style.setProperty('--ws-muted', t.mutedColor);
    if (t.pageBg) siteEl.style.setProperty('--ws-bg', t.pageBg);
  }

  global.HublyThemes = {
    registerTheme,
    getTheme,
    getCatalog,
    getActiveThemeId,
    mergeTokens,
    applyTheme,
    healContrast,
    relativeLuminance,
    contrastRatio,
    RADIUS_MAP,
    SPACING_MAP,
    HERO_MAP,
    WIDTH_MAP,
    TOKEN_DEFAULTS,
  };
})(typeof window !== 'undefined' ? window : global);
