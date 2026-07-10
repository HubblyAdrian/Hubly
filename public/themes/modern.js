HublyThemes.registerTheme({
  id: 'modern',
  name: 'Modern',
  description: 'Rounded corners, soft shadows, Apple-inspired spacing',
  tier: 'free',
  order: 1,
  preview: 'linear-gradient(145deg, #6366f1 0%, #312e81 55%, #0f172a 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'pill',
    containerWidth: 'wide',
    pageBg: '#fafafa',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',     
    borderColor: '#e2e8f0',   
    headingColor: '#0f172a',
    textColor: '#0f172a',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fafafa');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');      
    siteEl.style.setProperty('--ws-border', t.borderColor || '#e2e8f0');     
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#0f172a');
    siteEl.style.setProperty('--ws-text', t.textColor || '#0f172a');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
