HublyThemes.registerTheme({
  id: 'obsidian',
  name: 'Obsidian',
  description: 'Black and metallic gold — premium, formal, high-ticket credibility',
  tier: 'free',
  order: 13,
  preview: 'linear-gradient(135deg, #0a0a0a 0%, #b8901f 60%, #1a1508 100%)',
  tokenDefaults: {
    borderRadius: 'md',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#ffffff',
    sectionAltBg: '#f5f5f5',
    surfaceBg: '#ffffff',
    borderColor: '#e5e5e5',
    headingColor: '#171717',
    textColor: '#404040',
    mutedColor: '#737373',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#f5f5f5');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#e5e5e5');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#171717');
    siteEl.style.setProperty('--ws-text', t.textColor || '#404040');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#737373');
  },
});
