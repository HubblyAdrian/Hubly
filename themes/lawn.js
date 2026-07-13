HublyThemes.registerTheme({
  id: 'lawn',
  name: 'Lawn Day',
  description: 'Leaf green and soft sun for lawn care',
  tier: 'free',
  order: 26,
  preview: 'linear-gradient(145deg,#fefce8 0%,#65a30d 50%,#365314 100%)',
  tokenDefaults: {
    borderRadius: 'lg',
    heroHeight: 'default',
    sectionSpacing: 'default',
    buttonShape: 'rounded',
    containerWidth: 'wide',
    pageBg: '#fbfef5',
    sectionAltBg: '#ffffff',
    surfaceBg: '#ffffff',
    borderColor: '#dde8c8',
    headingColor: '#3f6212',
    textColor: '#365314',
    mutedColor: '#6b7280',
  },
  onApply(siteEl, t) {
    siteEl.style.setProperty('--ws-bg', t.pageBg || '#fbfef5');
    siteEl.style.setProperty('--ws-surface-alt', t.sectionAltBg || '#ffffff');
    siteEl.style.setProperty('--ws-surface', t.surfaceBg || '#ffffff');
    siteEl.style.setProperty('--ws-border', t.borderColor || '#dde8c8');
    siteEl.style.setProperty('--ws-heading', t.headingColor || '#3f6212');
    siteEl.style.setProperty('--ws-text', t.textColor || '#365314');
    siteEl.style.setProperty('--ws-muted', t.mutedColor || '#6b7280');
  },
});
