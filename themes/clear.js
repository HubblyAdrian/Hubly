HublyThemes.registerTheme({
  id: 'clear',
  name: 'Clear View',
  description: 'Sky blue friendly clarity for residential windows',
  tier: 'free',
  order: 27,
  preview: 'linear-gradient(145deg,#e0f2fe 0%,#38bdf8 50%,#0369a1 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#f7fbff',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#d0e7f7',
    headingColor: '#075985',
    textColor: '#0c4a6e',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#f7fbff');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#d0e7f7');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#075985');
    siteEl.style.setProperty('--ws-text', t.textColor || '#0c4a6e');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
