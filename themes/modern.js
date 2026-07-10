HublyThemes.registerTheme({
  id: 'modern',
  name: 'Modern',
  description: 'Rounded corners, soft shadows, Apple-inspired spacing',
  tier: 'free',
  order: 1,
  preview: 'linear-gradient(145deg, #6366f1 0%, #312e81 55%, #0f172a 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'tall',
    sectionSpacing: 'airy',
    buttonShape: 'pill',
    containerWidth: 'default',
    pageBg: '#fafafa',
    sectionAltBg: '#ffffff',
    headingColor: '#0f172a',
    textColor: '#0f172a',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fafafa');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#0f172a');
    siteEl.style.setProperty('--ws-text', t.textColor || '#0f172a');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
