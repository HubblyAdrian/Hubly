HublyThemes.registerTheme({
  id: 'chrome',
  name: 'Chrome',
  description: 'Charcoal and red, motorsport-inspired, speed and precision',
  tier: 'free',
  order: 14,
  preview: 'linear-gradient(135deg, #0d0d0f 0%, #dc2626 55%, #27272a 100%)',
  tokenDefaults: {
    borderRadius: 'sm',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'square',
    containerWidth: 'wide',
    pageBg: '#0d0d0f',
    sectionAltBg: '#141416',
    surfaceBg: '#18181b',
    borderColor: '#27272a',
    headingColor: '#ffffff',
    textColor: '#e4e4e7',
    mutedColor: '#a1a1aa',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#0d0d0f');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#141416');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#18181b');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#27272a');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#ffffff');
    siteEl.style.setProperty('--ws-text', t.textColor || '#e4e4e7');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#a1a1aa');
  },
});
