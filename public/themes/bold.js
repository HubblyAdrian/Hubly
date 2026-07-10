HublyThemes.registerTheme({
  id: 'bold',
  name: 'Bold',
  description: 'Bright contrast, large buttons, strong typography',
  tier: 'free',
  order: 2,
  preview: 'linear-gradient(145deg, #f59e0b 0%, #ea580c 45%, #b91c1c 100%)',
  tokenDefaults: {
    borderRadius: 'sm',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'square',
    containerWidth: 'wide',
    pageBg: '#fff7ed',
    sectionAltBg: '#ffedd5',
    surfaceBg: '#ffffff',     
    borderColor: '#fdba74',   
    headingColor: '#7c2d12',
    textColor: '#431407',
    mutedColor: '#c2410c',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fff7ed');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffedd5');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');      
    siteEl.style.setProperty('--ws-border', t.borderColor || '#fdba74');     
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#7c2d12');
    siteEl.style.setProperty('--ws-text', t.textColor || '#431407');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#c2410c');
  },
});
