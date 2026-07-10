HublyThemes.registerTheme({
  id: 'dark',
  name: 'Dark',
  description: 'Dark backgrounds, modern cards, crisp accents',
  tier: 'free',
  order: 3,
  preview: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 50%, #020617 100%)',
  tokenDefaults: {
    borderRadius: 'md',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'pill',
    containerWidth: 'default',
    pageBg: '#0b1220',
    sectionAltBg: '#111827',
    headingColor: '#f8fafc',
    textColor: '#e2e8f0',
    mutedColor: '#94a3b8',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#0b1220');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#111827');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#f8fafc');
    siteEl.style.setProperty('--ws-text', t.textColor || '#e2e8f0');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#94a3b8');
  },
});
