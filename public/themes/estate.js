HublyThemes.registerTheme({
  id: 'estate',
  name: 'Estate',
  description: 'Deep green and ivory for premium outdoor brands',
  tier: 'free',
  order: 21,
  preview: 'linear-gradient(145deg,#ecfdf5 0%,#166534 55%,#052e16 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#f7faf7',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#d7e3d7',
    headingColor: '#14532d',
    textColor: '#1f2937',
    mutedColor: '#6b7280',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#f7faf7');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#d7e3d7');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#14532d');
    siteEl.style.setProperty('--ws-text', t.textColor || '#1f2937');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#6b7280');
  },
});
