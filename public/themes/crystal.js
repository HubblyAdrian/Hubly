HublyThemes.registerTheme({
  id: 'crystal',
  name: 'Crystal',
  description: 'Cool white and blue-glass clarity for window specialists',
  tier: 'free',
  order: 20,
  preview: 'linear-gradient(145deg,#e0f2fe 0%,#0388bf 55%,#0c4a6e 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#f8fcff',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#cfe7f5',
    headingColor: '#0c4a6e',
    textColor: '#164e63',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#f8fcff');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#cfe7f5');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#0c4a6e');
    siteEl.style.setProperty('--ws-text', t.textColor || '#164e63');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
