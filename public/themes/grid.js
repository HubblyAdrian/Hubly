HublyThemes.registerTheme({
  id: 'grid',
  name: 'Grid Tech',
  description: 'Light grid and cyan accent for HVAC/tech systems',
  tier: 'free',
  order: 24,
  preview: 'linear-gradient(145deg,#ecfeff 0%,#0891b2 55%,#164e63 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#f8fafc',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#cfe8ee',
    headingColor: '#0e7490',
    textColor: '#164e63',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#f8fafc');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#cfe8ee');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#0e7490');
    siteEl.style.setProperty('--ws-text', t.textColor || '#164e63');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
