HublyThemes.registerTheme({
  id: 'aurora',
  name: 'Aurora',
  description: 'Animated gradient hero, serif display type, glass-morphism accents',
  tier: 'free',
  order: 8,
  preview: 'linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #1e1b4b 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'tall',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#0f0a1f',
    sectionAltBg: '#1a1332',
    surfaceBg: '#221a3d',
    borderColor: '#3d2f66',
    headingColor: '#ffffff',
    textColor: '#e4dcf7',
    mutedColor: '#a696c9',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#0f0a1f');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#1a1332');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#221a3d');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#3d2f66');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#ffffff');
    siteEl.style.setProperty('--ws-text', t.textColor || '#e4dcf7');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#a696c9');
  },
});
