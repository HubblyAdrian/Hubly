HublyThemes.registerTheme({
  id: 'vibrant',
  name: 'Vibrant',
  description: 'Colorful sections, energetic layout, stands out',
  tier: 'free',
  order: 6,
  preview: 'linear-gradient(145deg, #ec4899 0%, #8b5cf6 45%, #06b6d4 100%)',
  tokenDefaults: {
    borderRadius: 'xl',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'pill',
    containerWidth: 'wide',
    pageBg: '#fdf4ff',
    sectionAltBg: '#f0fdfa',
    headingColor: '#1e1b4b',
    textColor: '#312e81',
    mutedColor: '#6366f1',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fdf4ff');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#f0fdfa');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#1e1b4b');
    siteEl.style.setProperty('--ws-text', t.textColor || '#312e81');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#6366f1');
  },
});
