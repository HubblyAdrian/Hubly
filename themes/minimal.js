HublyThemes.registerTheme({
  id: 'minimal',
  name: 'Minimal',
  description: 'Lots of whitespace, thin type, understated elegance',
  tier: 'free',
  order: 5,
  preview: 'linear-gradient(145deg, #fafafa 0%, #e5e5e5 55%, #a3a3a3 100%)',
  tokenDefaults: {
    borderRadius: 'sm',
    heroHeight: 'compact',
    sectionSpacing: 'airy',
    buttonShape: 'square',
    containerWidth: 'narrow',
    pageBg: '#fafafa',
    sectionAltBg: '#ffffff',
    headingColor: '#171717',
    textColor: '#404040',
    mutedColor: '#737373',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fafafa');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#171717');
    siteEl.style.setProperty('--ws-text', t.textColor || '#404040');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#737373');
  },
});
