HublyThemes.registerTheme({
  id: 'neon',
  name: 'Neon',
  description: 'Near-black with cyan/magenta glow accents — genuinely futuristic, tech-forward',
  tier: 'free',
  order: 12,
  preview: 'linear-gradient(135deg, #050508 0%, #22d3ee 50%, #e879f9 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'tall',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#050508',
    sectionAltBg: '#0a0a10',
    surfaceBg: '#181820',
    borderColor: '#1f1f2e',
    headingColor: '#ffffff',
    textColor: '#e4e4e7',
    mutedColor: '#a1a1aa',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#050508');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#0a0a10');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#181820');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#1f1f2e');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#ffffff');
    siteEl.style.setProperty('--ws-text', t.textColor || '#e4e4e7');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#a1a1aa');
  },
});
