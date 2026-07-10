HublyThemes.registerTheme({
  id: 'warm',
  name: 'Warm',
  description: 'Cream backgrounds, earthy tones, welcoming feel',
  tier: 'free',
  order: 7,
  preview: 'linear-gradient(145deg, #fef3c7 0%, #f59e0b 50%, #92400e 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'pill',
    containerWidth: 'default',
    pageBg: '#fffbeb',
    sectionAltBg: '#fef3c7',
    surfaceBg: '#fffdf7',     
    borderColor: '#fde68a',   
    headingColor: '#451a03',
    textColor: '#78350f',
    mutedColor: '#a16207',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fffbeb');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#fef3c7');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#fffdf7');      
    siteEl.style.setProperty('--ws-border', t.borderColor || '#fde68a');     
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#451a03');
    siteEl.style.setProperty('--ws-text', t.textColor || '#78350f');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#a16207');
  },
});
