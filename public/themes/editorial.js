HublyThemes.registerTheme({
  id: 'editorial',
  name: 'Editorial',
  description: 'Magazine-style type, asymmetric grid, generous whitespace',
  tier: 'free',
  order: 9,
  preview: 'linear-gradient(145deg, #fafaf9 0%, #e7e5e4 60%, #a8a29e 100%)',
  tokenDefaults: {
    borderRadius: 'sm',
    heroHeight: 'tall',
    sectionSpacing: 'airy',
    buttonShape: 'square',
    containerWidth: 'wide',
    pageBg: '#fafaf9',
    sectionAltBg: '#f5f5f4',
    surfaceBg: '#ffffff',
    borderColor: '#e7e5e4',
    headingColor: '#1c1917',
    textColor: '#292524',
    mutedColor: '#78716c',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fafaf9');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#f5f5f4');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#e7e5e4');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#1c1917');
    siteEl.style.setProperty('--ws-text', t.textColor || '#292524');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#78716c');
  },
});
