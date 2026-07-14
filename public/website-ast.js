/**
 * Hubly Website Page AST (Phase 1)
 * --------------------------------
 * The site is a versioned JSON document (S.website.page). Today's #ws-page
 * shell still renders it — the AST drives layout / composition / hero
 * placement / section order+visibility. Later phases add block variants
 * and free HTML regions without rewriting booking/PE.
 */
(function (global) {
  'use strict';

  var VERSION = 1;
  var COMPOSITIONS = ['classic', 'portfolio', 'services', 'profile', 'minimal'];
  var PLACEMENTS = ['full', 'left', 'right'];
  var SECTION_KEYS = ['services', 'membership', 'gallery', 'reviews', 'about', 'why', 'area', 'faq'];
  var SECTION_DOM = {
    services: 'ws-sec-services',
    membership: 'ws-sec-membership',
    gallery: 'ws-sec-gallery',
    reviews: 'ws-sec-reviews',
    about: 'ws-sec-owner',
    why: 'ws-sec-why',
    area: 'ws-sec-area',
    faq: 'ws-sec-faq',
  };

  function leadOrder(composition) {
    if (composition === 'portfolio') {
      return ['gallery', 'about', 'services', 'reviews', 'why', 'area', 'faq', 'membership'];
    }
    if (composition === 'services') {
      return ['services', 'reviews', 'gallery', 'about', 'why', 'area', 'membership', 'faq'];
    }
    return ['services', 'gallery', 'reviews', 'about', 'why', 'area', 'faq', 'membership'];
  }

  function normalizeKey(key) {
    var x = String(key || '').toLowerCase();
    if (x === 'portfolio' || x === 'instagram') return 'gallery';
    if (x === 'testimonials') return 'reviews';
    if (x === 'pricing' || x === 'booking') return 'services';
    if (x === 'service-area') return 'area';
    if (x === 'owner') return 'about';
    return x;
  }

  function validComp(c) {
    return COMPOSITIONS.indexOf(c) >= 0 ? c : 'classic';
  }

  function validPlace(p) {
    return PLACEMENTS.indexOf(p) >= 0 ? p : 'full';
  }

  function buildBlocks(composition, preferredKeys) {
    var lead = leadOrder(composition);
    var keys = [];
    var seen = {};
    function push(k) {
      k = normalizeKey(k);
      if (SECTION_KEYS.indexOf(k) < 0 || seen[k]) return;
      seen[k] = true;
      keys.push(k);
    }
    (preferredKeys || []).forEach(push);
    lead.forEach(push);
    SECTION_KEYS.forEach(push);

    var hideExtras = composition === 'portfolio' || composition === 'minimal';
    return keys.map(function (key, i) {
      var hiddenByDefault = hideExtras && (key === 'why' || key === 'area' || key === 'faq');
      return {
        type: key,
        variant: 'default',
        order: 10 + i,
        visible: !hiddenByDefault,
      };
    });
  }

  function migrateFromFlat(website, ctx) {
    ctx = ctx || {};
    var composition = validComp(website.composition || ctx.composition || 'classic');
    var preferred = Array.isArray(ctx.priority) ? ctx.priority : [];
    return {
      version: VERSION,
      layout: website.layout || ctx.layout || 'premium-dark',
      composition: composition,
      theme: website.theme || null,
      hero: {
        mediaPlacement: validPlace(website.heroMediaPlacement || 'full'),
        variant: 'default',
        headline: website.heroHeadline || '',
        sub: website.heroSub || '',
      },
      blocks: buildBlocks(composition, preferred),
      ticker: {
        enabled: !!website.tickerEnabled,
        text: website.tickerText || '',
      },
      meta: {
        source: 'migrate',
        updatedAt: Date.now(),
      },
    };
  }

  function syncFlatMirror(website, page) {
    if (!website || !page) return;
    if (page.layout) website.layout = page.layout;
    if (page.theme) website.theme = page.theme;
    website.composition = validComp(page.composition);
    if (!website.heroMediaPlacement && page.hero) {
      website.heroMediaPlacement = validPlace(page.hero.mediaPlacement);
    } else if (page.hero) {
      website.heroMediaPlacement = validPlace(page.hero.mediaPlacement);
    }
    if (page.hero) {
      if (page.hero.headline != null && page.hero.headline !== '') {
        // Keep flat copy as source of truth for PE until Phase 2; only push if AST was patched.
        if (page.meta && page.meta.headlineFromAst) {
          website.heroHeadline = page.hero.headline;
          website.customHeroHeadline = true;
        } else {
          page.hero.headline = website.heroHeadline || page.hero.headline || '';
        }
      }
      if (page.hero.sub != null && page.meta && page.meta.subFromAst) {
        website.heroSub = page.hero.sub;
        website.customHeroSub = true;
      } else if (page.hero) {
        page.hero.sub = website.heroSub || page.hero.sub || '';
      }
    }
    if (page.ticker) {
      website.tickerEnabled = !!page.ticker.enabled;
      if (page.ticker.text != null) website.tickerText = page.ticker.text;
    }
  }

  function ensurePage(website, ctx) {
    if (!website || typeof website !== 'object') return null;
    ctx = ctx || {};
    if (!website.page || typeof website.page !== 'object' || !website.page.version) {
      website.page = migrateFromFlat(website, ctx);
    } else {
      // Pull flat mirrors that click-edit may have changed.
      var page = website.page;
      page.version = VERSION;
      if (website.layout) page.layout = website.layout;
      if (website.theme) page.theme = website.theme;
      page.composition = validComp(website.composition || page.composition);
      if (!page.hero || typeof page.hero !== 'object') page.hero = { mediaPlacement: 'full', variant: 'default' };
      page.hero.mediaPlacement = validPlace(website.heroMediaPlacement || page.hero.mediaPlacement);
      page.hero.headline = website.heroHeadline || page.hero.headline || '';
      page.hero.sub = website.heroSub || page.hero.sub || '';
      if (!Array.isArray(page.blocks) || !page.blocks.length) {
        page.blocks = buildBlocks(page.composition, ctx.priority);
      } else {
        // Normalize keys / drop unknowns
        page.blocks = page.blocks
          .map(function (b, i) {
            if (!b || typeof b !== 'object') return null;
            var type = normalizeKey(b.type || b.key);
            if (SECTION_KEYS.indexOf(type) < 0) return null;
            return {
              type: type,
              variant: b.variant || 'default',
              order: typeof b.order === 'number' ? b.order : 10 + i,
              visible: b.visible !== false,
            };
          })
          .filter(Boolean);
      }
    }
    syncFlatMirror(website, website.page);
    return website.page;
  }

  function setComposition(website, composition) {
    var page = ensurePage(website);
    if (!page) return null;
    page.composition = validComp(composition);
    page.blocks = buildBlocks(page.composition, page.blocks.map(function (b) { return b.type; }));
    page.meta = page.meta || {};
    page.meta.updatedAt = Date.now();
    page.meta.source = 'ast';
    syncFlatMirror(website, page);
    return page;
  }

  function setHeroPlacement(website, placement) {
    var page = ensurePage(website);
    if (!page) return null;
    if (!page.hero) page.hero = {};
    page.hero.mediaPlacement = validPlace(placement);
    page.meta = page.meta || {};
    page.meta.updatedAt = Date.now();
    page.meta.source = 'ast';
    syncFlatMirror(website, page);
    return page;
  }

  function setLayout(website, layoutId) {
    var page = ensurePage(website);
    if (!page || !layoutId) return null;
    page.layout = String(layoutId);
    page.meta = page.meta || {};
    page.meta.updatedAt = Date.now();
    syncFlatMirror(website, page);
    return page;
  }

  function setHeroCopy(website, fields) {
    var page = ensurePage(website);
    if (!page) return null;
    if (!page.hero) page.hero = {};
    page.meta = page.meta || {};
    if (fields && fields.headline != null) {
      page.hero.headline = String(fields.headline);
      page.meta.headlineFromAst = true;
    }
    if (fields && fields.sub != null) {
      page.hero.sub = String(fields.sub);
      page.meta.subFromAst = true;
    }
    page.meta.updatedAt = Date.now();
    syncFlatMirror(website, page);
    return page;
  }

  function reorderBlocks(website, orderedKeys) {
    var page = ensurePage(website);
    if (!page || !Array.isArray(orderedKeys)) return null;
    var byType = {};
    (page.blocks || []).forEach(function (b) { byType[b.type] = b; });
    var next = [];
    var seen = {};
    orderedKeys.forEach(function (k, i) {
      k = normalizeKey(k);
      if (SECTION_KEYS.indexOf(k) < 0 || seen[k]) return;
      seen[k] = true;
      var prev = byType[k] || { type: k, variant: 'default', visible: true };
      next.push({
        type: k,
        variant: prev.variant || 'default',
        order: 10 + i,
        visible: prev.visible !== false,
      });
    });
    SECTION_KEYS.forEach(function (k) {
      if (seen[k]) return;
      var prev = byType[k];
      if (!prev) return;
      next.push({
        type: k,
        variant: prev.variant || 'default',
        order: 10 + next.length,
        visible: prev.visible !== false,
      });
    });
    page.blocks = next;
    page.meta = page.meta || {};
    page.meta.updatedAt = Date.now();
    return page;
  }

  function setBlockVisible(website, key, visible) {
    var page = ensurePage(website);
    if (!page) return null;
    key = normalizeKey(key);
    var block = (page.blocks || []).find(function (b) { return b.type === key; });
    if (!block) {
      block = { type: key, variant: 'default', order: 50, visible: !!visible };
      page.blocks.push(block);
    } else {
      block.visible = !!visible;
    }
    page.meta = page.meta || {};
    page.meta.updatedAt = Date.now();
    return page;
  }

  /**
   * Apply AST section order + visibility onto the live #ws-page shell.
   * Returns true if AST drove the order (caller can skip legacy lead logic).
   */
  function applySectionDom(website) {
    var page = website && website.page;
    if (!page || !Array.isArray(page.blocks) || !page.blocks.length) return false;
    var root = global.document && global.document.getElementById('ws-page');
    if (!root) return false;

    var blocks = page.blocks.slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    var order = 10;
    var used = {};
    blocks.forEach(function (b) {
      var id = SECTION_DOM[b.type];
      if (!id) return;
      var el = global.document.getElementById(id);
      if (!el) return;
      el.style.order = String(order++);
      used[id] = true;
      if (b.visible === false) {
        el.classList.add('ws-sec-omitted');
        el.style.display = 'none';
      } else {
        el.classList.remove('ws-sec-omitted');
        if (el.style.display === 'none') el.style.removeProperty('display');
      }
    });
    Object.keys(SECTION_DOM).forEach(function (k) {
      var id = SECTION_DOM[k];
      if (used[id]) return;
      var el = global.document.getElementById(id);
      if (el) el.style.order = String(order++);
    });
    return true;
  }

  /** Apply high-level patch from Editor AI / Creative Director. */
  function patch(website, ops) {
    if (!website || !ops || typeof ops !== 'object') return null;
    ensurePage(website);
    if (ops.composition) setComposition(website, ops.composition);
    if (ops.heroMediaPlacement || ops.placement) {
      setHeroPlacement(website, ops.heroMediaPlacement || ops.placement);
    }
    if (ops.layout || ops.layoutId) setLayout(website, ops.layout || ops.layoutId);
    if (ops.headline != null || ops.sub != null || ops.heroSub != null) {
      setHeroCopy(website, {
        headline: ops.headline,
        sub: ops.sub != null ? ops.sub : ops.heroSub,
      });
    }
    if (Array.isArray(ops.blockOrder)) reorderBlocks(website, ops.blockOrder);
    if (ops.hideBlock) setBlockVisible(website, ops.hideBlock, false);
    if (ops.showBlock) setBlockVisible(website, ops.showBlock, true);
    if (ops.visibleBlocks && typeof ops.visibleBlocks === 'object') {
      Object.keys(ops.visibleBlocks).forEach(function (k) {
        setBlockVisible(website, k, !!ops.visibleBlocks[k]);
      });
    }
    return website.page;
  }

  global.HublyWebsiteAst = {
    VERSION: VERSION,
    SECTION_KEYS: SECTION_KEYS,
    SECTION_DOM: SECTION_DOM,
    ensurePage: ensurePage,
    migrateFromFlat: migrateFromFlat,
    setComposition: setComposition,
    setHeroPlacement: setHeroPlacement,
    setLayout: setLayout,
    setHeroCopy: setHeroCopy,
    reorderBlocks: reorderBlocks,
    setBlockVisible: setBlockVisible,
    applySectionDom: applySectionDom,
    patch: patch,
    syncFlatMirror: syncFlatMirror,
  };
})(typeof window !== 'undefined' ? window : globalThis);
