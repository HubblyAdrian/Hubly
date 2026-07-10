HublyThemes.registerTheme({
  id: 'sunset',
  name: 'Sunset',
  description: 'Warm coral-to-peach gradient, rounded shapes, friendly and approachable',
  tier: 'free',
  order: 11,
  preview: 'linear-gradient(145deg, #fb923c 0%, #f472b6 55%, #fbbf24 100%)',
  tokenDefaults: {
    borderRadius: 'xl',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'pill',
    containerWidth: 'default',
    pageBg: '#fff7ed',
    sectionAltBg: '#ffedd5',
    surfaceBg: '#ffffff',
    borderColor: '#fed7aa',
    headingColor: '#7c2d12',
    textColor: '#9a3412',
    mutedColor: '#c2410c',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fff7ed');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffedd5');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#fed7aa');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#7c2d12');
    siteEl.style.setProperty('--ws-text', t.textColor || '#9a3412');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#c2410c');
  },
});
