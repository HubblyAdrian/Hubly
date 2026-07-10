HublyThemes.registerTheme({
  id: 'garage',
  name: 'Garage',
  description: 'Charcoal + amber, monospace accents, mechanical and technical',
  tier: 'free',
  order: 10,
  preview: 'linear-gradient(145deg, #292524 0%, #d97706 70%, #1c1917 100%)',
  tokenDefaults: {
    borderRadius: 'sm',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'square',
    containerWidth: 'wide',
    pageBg: '#1c1917',
    sectionAltBg: '#292524',
    surfaceBg: '#3f3a37',
    borderColor: '#57534e',
    headingColor: '#fafaf9',
    textColor: '#e7e5e4',
    mutedColor: '#a8a29e',
    accentColor: '#f59e0b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#1c1917');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#292524');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#3f3a37');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#57534e');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#fafaf9');
    siteEl.style.setProperty('--ws-text', t.textColor || '#e7e5e4');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#a8a29e');
  },
});
