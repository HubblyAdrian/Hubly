HublyThemes.registerTheme({
  id: 'calm',
  name: 'Calm Service',
  description: 'Slate and soft teal for trusted home-systems pros',
  tier: 'free',
  order: 22,
  preview: 'linear-gradient(145deg,#f0fdfa 0%,#0f766e 55%,#134e4a 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#f8fafc',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#d7e2ea',
    headingColor: '#134e4a',
    textColor: '#1e293b',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#f8fafc');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#d7e2ea');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#134e4a');
    siteEl.style.setProperty('--ws-text', t.textColor || '#1e293b');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
