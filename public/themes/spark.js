HublyThemes.registerTheme({
  id: 'spark',
  name: 'Spark Home',
  description: 'Fresh mint and white for residential cleaning',
  tier: 'free',
  order: 25,
  preview: 'linear-gradient(145deg,#ecfdf5 0%,#34d399 45%,#065f46 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#f4fbf7',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#cfe9db',
    headingColor: '#065f46',
    textColor: '#134e4a',
    mutedColor: '#5b7168',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#f4fbf7');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#cfe9db');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#065f46');
    siteEl.style.setProperty('--ws-text', t.textColor || '#134e4a');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#5b7168');
  },
});
