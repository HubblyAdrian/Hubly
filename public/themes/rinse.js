HublyThemes.registerTheme({
  id: 'rinse',
  name: 'Rinse',
  description: 'Steel and electric blue for pressure washing power',
  tier: 'free',
  order: 23,
  preview: 'linear-gradient(145deg,#eff6ff 0%,#1d4ed8 50%,#0f172a 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#f1f5f9',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#cbd5e1',
    headingColor: '#0f172a',
    textColor: '#1e293b',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#f1f5f9');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#cbd5e1');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#0f172a');
    siteEl.style.setProperty('--ws-text', t.textColor || '#1e293b');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
