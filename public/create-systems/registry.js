/**
 * Hubly Create Systems — Component + Design catalogs
 *
 * Durable builds websites from templates.
 * Hubly assembles businesses from reusable variants.
 *
 * Never ask "which template?" — ask "which combination of components?"
 */
(function (global) {
  'use strict';

  /** Design Engine directions — not industry themes. */
  var DESIGN_DIRECTIONS = {
    luxury: {
      id: 'luxury',
      label: 'Luxury',
      layoutIds: ['obsidian-gold', 'premium-dark', 'editorial', 'estate-green'],
      themeHints: ['dark', 'premium'],
      accent: '#D9632D',
      composition: 'classic',
      feeling: 'quiet confidence',
    },
    minimal: {
      id: 'minimal',
      label: 'Minimal',
      layoutIds: ['minimal-pro', 'clean-modern', 'clear-view'],
      themeHints: ['light', 'modern'],
      accent: '#141B2B',
      composition: 'minimal',
      feeling: 'calm clarity',
    },
    editorial: {
      id: 'editorial',
      label: 'Editorial',
      layoutIds: ['editorial', 'premium-dark', 'crystal-pane'],
      themeHints: ['editorial', 'dark'],
      accent: '#D9632D',
      composition: 'portfolio',
      feeling: 'story-led authority',
    },
    bold: {
      id: 'bold',
      label: 'Bold',
      layoutIds: ['bold-impact', 'neon-nights', 'chrome-velocity'],
      themeHints: ['bold', 'dark'],
      accent: '#D9632D',
      composition: 'services',
      feeling: 'high energy',
    },
    playful: {
      id: 'playful',
      label: 'Playful',
      layoutIds: ['vibrant-pop', 'sunset-coastal', 'warm-local'],
      themeHints: ['vibrant', 'warm'],
      accent: '#D9632D',
      composition: 'classic',
      feeling: 'friendly momentum',
    },
    corporate: {
      id: 'corporate',
      label: 'Corporate',
      layoutIds: ['classic-trust', 'grid-tech', 'clean-modern'],
      themeHints: ['classic', 'modern'],
      accent: '#141B2B',
      composition: 'services',
      feeling: 'reliable professionalism',
    },
    modern: {
      id: 'modern',
      label: 'Modern',
      layoutIds: ['clean-modern', 'crystal-pane', 'aurora-gradient'],
      themeHints: ['modern', 'light'],
      accent: '#D9632D',
      composition: 'classic',
      feeling: 'fresh and sharp',
    },
    dark: {
      id: 'dark',
      label: 'Dark',
      layoutIds: ['premium-dark', 'obsidian-gold', 'garage-industrial'],
      themeHints: ['dark'],
      accent: '#D9632D',
      composition: 'classic',
      feeling: 'immersive focus',
    },
    light: {
      id: 'light',
      label: 'Light',
      layoutIds: ['clean-modern', 'calm-service', 'lawn-day'],
      themeHints: ['light', 'warm'],
      accent: '#D9632D',
      composition: 'classic',
      feeling: 'open and welcoming',
    },
  };

  /**
   * Component Library — starter variants (grow toward 40/25/30/…).
   * Each id is stable so AI can pick by name forever.
   */
  var COMPONENTS = {
    hero: [
      { id: 'hero_01', label: 'Outcome headline', css: 'is-comp-hero-outcome' },
      { id: 'hero_02', label: 'Proof-first', css: 'is-comp-hero-proof' },
      { id: 'hero_03', label: 'Split media', css: 'is-comp-hero-split' },
      { id: 'hero_04', label: 'Centered minimal', css: 'is-comp-hero-center' },
      { id: 'hero_05', label: 'Bold condensed', css: 'is-comp-hero-bold' },
      { id: 'hero_06', label: 'Editorial long-form', css: 'is-comp-hero-editorial' },
      { id: 'hero_07', label: 'Consult CTA lead', css: 'is-comp-hero-consult' },
      { id: 'hero_08', label: 'Results strip', css: 'is-comp-hero-results' },
      { id: 'hero_09', label: 'Dark immersive', css: 'is-comp-hero-dark' },
      { id: 'hero_10', label: 'Light airy', css: 'is-comp-hero-light' },
      { id: 'hero_11', label: 'Social proof hero', css: 'is-comp-hero-social' },
      { id: 'hero_12', label: 'High-ticket quiet', css: 'is-comp-hero-quiet' },
    ],
    nav: [
      { id: 'nav_01', label: 'Minimal links', css: 'is-comp-nav-minimal' },
      { id: 'nav_02', label: 'Full menu + CTA', css: 'is-comp-nav-full' },
      { id: 'nav_03', label: 'Logo-left CTA-right', css: 'is-comp-nav-cta' },
      { id: 'nav_04', label: 'Centered brand', css: 'is-comp-nav-center' },
      { id: 'nav_05', label: 'Transparent over hero', css: 'is-comp-nav-overlay' },
      { id: 'nav_06', label: 'Compact mobile-first', css: 'is-comp-nav-compact' },
    ],
    cta: [
      { id: 'cta_01', label: 'Book now', css: 'is-comp-cta-book' },
      { id: 'cta_02', label: 'Free consult', css: 'is-comp-cta-consult' },
      { id: 'cta_03', label: 'Get a quote', css: 'is-comp-cta-quote' },
      { id: 'cta_04', label: 'Primary + ghost', css: 'is-comp-cta-dual' },
      { id: 'cta_05', label: 'Soft inquire', css: 'is-comp-cta-inquire' },
      { id: 'cta_06', label: 'Start today', css: 'is-comp-cta-start' },
      { id: 'cta_07', label: 'View packages', css: 'is-comp-cta-packages' },
      { id: 'cta_08', label: 'Premium apply', css: 'is-comp-cta-apply' },
    ],
    services: [
      { id: 'svc_01', label: 'Three-up cards', css: 'is-comp-svc-cards' },
      { id: 'svc_02', label: 'List with prices', css: 'is-comp-svc-list' },
      { id: 'svc_03', label: 'Featured popular', css: 'is-comp-svc-popular' },
      { id: 'svc_04', label: 'Icon grid', css: 'is-comp-svc-icons' },
      { id: 'svc_05', label: 'Programs narrative', css: 'is-comp-svc-programs' },
      { id: 'svc_06', label: 'Compact chips', css: 'is-comp-svc-chips' },
    ],
    gallery: [
      { id: 'gal_01', label: 'Masonry', css: 'is-comp-gal-masonry' },
      { id: 'gal_02', label: 'Carousel', css: 'is-comp-gal-carousel' },
      { id: 'gal_03', label: 'Before/after', css: 'is-comp-gal-ba' },
      { id: 'gal_04', label: 'Film strip', css: 'is-comp-gal-strip' },
      { id: 'gal_05', label: 'Grid 3×2', css: 'is-comp-gal-grid' },
      { id: 'gal_06', label: 'Single hero proof', css: 'is-comp-gal-single' },
      { id: 'gal_07', label: 'Hidden (minimal)', css: 'is-comp-gal-hidden', hide: true },
      { id: 'gal_08', label: 'Portfolio lead', css: 'is-comp-gal-lead' },
    ],
    testimonials: [
      { id: 'tst_01', label: 'Quote cards', css: 'is-comp-tst-cards' },
      { id: 'tst_02', label: 'Single featured', css: 'is-comp-tst-featured' },
      { id: 'tst_03', label: 'Logo wall', css: 'is-comp-tst-logos' },
      { id: 'tst_04', label: 'Stars + short', css: 'is-comp-tst-stars' },
      { id: 'tst_05', label: 'Hidden until reviews', css: 'is-comp-tst-hidden', hide: true },
      { id: 'tst_06', label: 'Results metrics', css: 'is-comp-tst-metrics' },
    ],
    pricing: [
      { id: 'prc_01', label: 'Three tiers visible', css: 'is-comp-prc-tiers', showPrice: true },
      { id: 'prc_02', label: 'Popular highlighted', css: 'is-comp-prc-popular', showPrice: true },
      { id: 'prc_03', label: 'Price on request', css: 'is-comp-prc-request', showPrice: false },
      { id: 'prc_04', label: 'High-ticket consult', css: 'is-comp-prc-highticket', showPrice: false },
      { id: 'prc_05', label: 'Simple two-pack', css: 'is-comp-prc-duo', showPrice: true },
      { id: 'prc_06', label: 'Membership lead', css: 'is-comp-prc-member', showPrice: true },
    ],
    faq: [
      { id: 'faq_01', label: 'Accordion 5', css: 'is-comp-faq-acc' },
      { id: 'faq_02', label: 'Two-column', css: 'is-comp-faq-cols' },
      { id: 'faq_03', label: 'Minimal 3', css: 'is-comp-faq-min' },
      { id: 'faq_04', label: 'Hidden', css: 'is-comp-faq-hidden', hide: true },
    ],
    footer: [
      { id: 'ftr_01', label: 'Simple bar', css: 'is-comp-ftr-simple' },
      { id: 'ftr_02', label: 'Links + CTA', css: 'is-comp-ftr-links' },
      { id: 'ftr_03', label: 'Brand heavy', css: 'is-comp-ftr-brand' },
      { id: 'ftr_04', label: 'Minimal line', css: 'is-comp-ftr-line' },
    ],
    booking: [
      { id: 'bk_01', label: 'Instant book', css: 'is-comp-bk-instant', strategy: 'book-session' },
      { id: 'bk_02', label: 'Consult first', css: 'is-comp-bk-consult', strategy: 'consult-first' },
      { id: 'bk_03', label: 'Quote then book', css: 'is-comp-bk-quote', strategy: 'quote-then-book' },
      { id: 'bk_04', label: 'Package pick', css: 'is-comp-bk-package', strategy: 'book-session' },
      { id: 'bk_05', label: 'Premium apply', css: 'is-comp-bk-apply', strategy: 'consult-first' },
      { id: 'bk_06', label: 'Mobile-first steps', css: 'is-comp-bk-mobile', strategy: 'book-session' },
    ],
  };

  function listSlot(slot) {
    return (COMPONENTS[slot] || []).slice();
  }

  function getComponent(slot, id) {
    var list = COMPONENTS[slot] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || null;
  }

  function getDirection(id) {
    var key = String(id || '').toLowerCase().replace(/\s+/g, '_');
    if (DESIGN_DIRECTIONS[key]) return DESIGN_DIRECTIONS[key];
    // Fuzzy map from AI free text
    if (/luxury|premium|high.?ticket/.test(key)) return DESIGN_DIRECTIONS.luxury;
    if (/minimal|simple|clean/.test(key)) return DESIGN_DIRECTIONS.minimal;
    if (/editorial|story/.test(key)) return DESIGN_DIRECTIONS.editorial;
    if (/bold|athletic|energy/.test(key)) return DESIGN_DIRECTIONS.bold;
    if (/playful|fun|friendly/.test(key)) return DESIGN_DIRECTIONS.playful;
    if (/corporate|professional|b2b/.test(key)) return DESIGN_DIRECTIONS.corporate;
    if (/dark/.test(key)) return DESIGN_DIRECTIONS.dark;
    if (/light|bright|airy/.test(key)) return DESIGN_DIRECTIONS.light;
    return DESIGN_DIRECTIONS.modern;
  }

  function catalogForAi() {
    var out = { designDirections: Object.keys(DESIGN_DIRECTIONS), components: {} };
    Object.keys(COMPONENTS).forEach(function (slot) {
      out.components[slot] = COMPONENTS[slot].map(function (c) {
        return c.id + ' (' + c.label + ')';
      });
    });
    return out;
  }

  global.HublyCreateSystems = {
    DESIGN_DIRECTIONS: DESIGN_DIRECTIONS,
    COMPONENTS: COMPONENTS,
    listSlot: listSlot,
    getComponent: getComponent,
    getDirection: getDirection,
    catalogForAi: catalogForAi,
  };
})(typeof window !== 'undefined' ? window : globalThis);
