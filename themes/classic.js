HublyThemes.registerTheme({
  id: 'classic',
  name: 'Classic',
  description: 'Clean white sections, serif headlines, timeless feel',
  tier: 'free',
  order: 4,
  preview: 'linear-gradient(145deg, #f8fafc 0%, #cbd5e1 50%, #475569 100%)',
  tokenDefaults: {
    borderRadius: 'md',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'narrow',
    pageBg: '#ffffff',
    sectionAltBg: '#f8fafc',
    surfaceBg: '#ffffff',     
    borderColor: '#e2e8f0',   
    headingColor: '#0f172a',
    textColor: '#334155',
    mutedColor: '#64748b',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#f8fafc');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');      
    siteEl.style.setProperty('--ws-border', t.borderColor || '#e2e8f0');     
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#0f172a');
    siteEl.style.setProperty('--ws-text', t.textColor || '#334155');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#64748b');
  },
});
