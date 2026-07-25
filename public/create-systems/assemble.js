/**
 * Hubly Create Systems — Assemble
 *
 * Conversation → OpenAI Business Blueprint → Design → Layout → Components → Site
 *
 * No industry templates. AI picks combinations; Hubly provides building blocks.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pick(list, id, fallbackIndex) {
    if (!list || !list.length) return null;
    if (id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
    }
    return list[Math.min(fallbackIndex || 0, list.length - 1)];
  }

  /**
   * Normalize AI / partial blueprint into a durable Create plan.
   */
  function normalizeBlueprint(raw, facts) {
    raw = raw || {};
    facts = facts || {};
    var Sys = global.HublyCreateSystems;
    var directionId = raw.designDirection || raw.visualStyle || facts.visualStyle || facts.positioning || 'modern';
    var direction = Sys ? Sys.getDirection(directionId) : { id: 'modern', layoutIds: ['clean-modern'], accent: '#D9632D', composition: 'classic' };

    var components = raw.components || {};
    function comp(slot, fallbackId) {
      var id = components[slot] || raw[slot] || fallbackId;
      return Sys ? Sys.getComponent(slot, id) : { id: fallbackId || slot + '_01', css: '' };
    }

    var priceLevel = String(raw.priceLevel || facts.positioning || 'mid').toLowerCase();
    var showPrice = !/high|luxury|premium|consult/.test(priceLevel);
    var pricing = comp('pricing', showPrice ? 'prc_02' : 'prc_04');
    if (pricing && pricing.showPrice === false) showPrice = false;

    var packages = Array.isArray(raw.packages) ? raw.packages.filter(Boolean).slice(0, 5) : [];
    if (!packages.length && Array.isArray(raw.offers)) packages = raw.offers.slice(0, 5);
    if (!packages.length) {
      packages = ['Starter', 'Popular', 'Pro'];
    }

    var booking = comp('booking', /consult|high|luxury/.test(priceLevel) ? 'bk_02' : 'bk_01');
    var cta = comp('cta', booking && booking.strategy === 'consult-first' ? 'cta_02' : 'cta_01');

    var layoutId = raw.layoutId || raw.layout_id || null;
    if (!layoutId && direction.layoutIds && direction.layoutIds.length) {
      layoutId = direction.layoutIds[0];
    }
    // Prefer a layout that actually exists
    if (global.HublyLayouts && typeof global.HublyLayouts.getLayout === 'function') {
      if (!global.HublyLayouts.getLayout(layoutId)) {
        layoutId = (direction.layoutIds || []).find(function (id) {
          return global.HublyLayouts.getLayout(id);
        }) || 'clean-modern';
      }
    }

    return {
      version: 1,
      source: raw.source || 'ai',
      business: {
        name: raw.businessName || raw.business?.name || facts.businessName || null,
        industry: raw.industry || facts.industry || null,
        industryId: raw.industryId || facts.industryId || null,
        idealCustomer: raw.idealCustomer || facts.customer || 'clients',
        brandVoice: raw.brandVoice || facts.brandVoice || 'clear and confident',
        offer: raw.offer || raw.positioning || facts.positioning || 'results-first service',
        trustSignals: Array.isArray(raw.trustSignals) ? raw.trustSignals.slice(0, 4) : ['Clear packages', 'Easy booking', 'Real results'],
        competitivePosition: raw.competitivePosition || facts.positioning || 'premium local',
        priceLevel: priceLevel,
        desiredFeeling: raw.desiredFeeling || direction.feeling || 'trust and momentum',
        area: raw.area || facts.area || null,
      },
      design: {
        direction: direction.id,
        layoutId: layoutId,
        accent: raw.accent || direction.accent || '#D9632D',
        composition: raw.composition || direction.composition || 'classic',
        showPrice: showPrice,
      },
      components: {
        hero: comp('hero', 'hero_01'),
        nav: comp('nav', 'nav_03'),
        cta: cta,
        services: comp('services', 'svc_03'),
        gallery: comp('gallery', 'gal_05'),
        testimonials: comp('testimonials', 'tst_01'),
        pricing: pricing,
        faq: comp('faq', 'faq_01'),
        footer: comp('footer', 'ftr_01'),
        booking: booking,
      },
      copy: {
        headline: raw.headline || raw.heroHeadline || null,
        sub: raw.heroSub || raw.sub || null,
        ctaLabel: raw.ctaLabel || (cta && /consult/.test(cta.id) ? 'Book a free consult' : 'Book now'),
        about: raw.about || null,
        bookingHeadline: raw.bookingHeadline || null,
        bookingBlurb: raw.bookingBlurb || facts.bookingStrategy || null,
      },
      packages: packages,
      bookingChips: Array.isArray(raw.bookingChips)
        ? raw.bookingChips.slice(0, 4)
        : booking && booking.strategy === 'consult-first'
          ? ['Consult', 'Book session']
          : ['Book session', 'Ask a question'],
      sectionOrder: Array.isArray(raw.sectionOrder) ? raw.sectionOrder : null,
      strategy: {
        summary: raw.strategySummary || null,
        automations: Array.isArray(raw.automations) ? raw.automations.slice(0, 6) : ['Booking confirmation', 'No-show follow-up'],
      },
    };
  }

  /**
   * Apply blueprint onto live S + website AST + Create studio.
   * Returns the normalized plan.
   */
  function assemble(rawBlueprint, opts) {
    opts = opts || {};
    var S = global.S;
    if (!S) return null;
    var facts = opts.facts || (S._is && S._is.discovery && S._is.discovery.aiFacts) || {};
    var plan = normalizeBlueprint(rawBlueprint, facts);
    S._is = S._is || {};
    S._is.createSystemsPlan = plan;
    S._is.createAiDesigned = true;
    S._is._createLayoutLocked = true;

    var biz = plan.business;
    var name =
      biz.name ||
      S.biz ||
      (biz.industry ? String(biz.industry).replace(/\s+services$/i, '') : null) ||
      'Your Business';
    // Avoid bare industry as brand when AI didn't name it — keep assumed Create brand if present
    if (!biz.name && S.biz && S.biz !== 'Your Business' && S.biz !== 'My Business') name = S.biz;
    S.biz = name;
    if (biz.industryId) S.businessType = biz.industryId;
    if (biz.industry) S.industry = biz.industry;
    if (biz.area) {
      S.city = biz.area;
    }

    S.website = S.website && typeof S.website === 'object' ? S.website : {};
    S.color = plan.design.accent || '#D9632D';
    S.website.layout = plan.design.layoutId;
    S.website.composition = plan.design.composition;
    S.website.customHeroHeadline = true;
    S.website.customHeroSub = true;

    var headline =
      plan.copy.headline ||
      (biz.offer ? String(biz.offer).charAt(0).toUpperCase() + String(biz.offer).slice(1) : null) ||
      'Built for real results';
    var sub =
      plan.copy.sub ||
      (biz.idealCustomer
        ? 'For ' + biz.idealCustomer + ' who want ' + (biz.desiredFeeling || 'progress') + '.'
        : 'Clear packages. Easy booking. Built around you.');
    S.website.heroHeadline = headline;
    S.website.heroSub = sub;
    S.website.ctaLabel = plan.copy.ctaLabel || 'Book now';
    S.tag = sub;
    S.website.trustBadges = (biz.trustSignals || []).slice();
    S.website.trustStats = (biz.trustSignals || []).map(function (t) {
      return { value: String(t), label: '' };
    });
    S.website._trustClearedByOwner = false;
    if (plan.copy.about) {
      S.website.ownerBio = plan.copy.about;
      S.website.aboutText = plan.copy.about;
    } else {
      S.website.ownerBio =
        name +
        ' is built for ' +
        (biz.idealCustomer || 'clients') +
        ' — ' +
        (biz.brandVoice || 'clear') +
        ', easy to book, focused on ' +
        (biz.desiredFeeling || 'results') +
        '.';
      S.website.aboutText = S.website.ownerBio;
    }
    S.website.whySub = biz.competitivePosition || 'Clear packages, careful work, easy booking.';
    S.website.contactBlurb = biz.area
      ? 'Serving ' + biz.area + '. Book online — we’ll follow up.'
      : 'Book online or leave a message — we’ll follow up.';

    // Packages → SaaS services
    var pkgs = plan.packages || [];
    var priced = pkgs.map(function (p, i) {
      var nm = typeof p === 'string' ? p : p.name || 'Package ' + (i + 1);
      var price =
        typeof p === 'object' && p.price != null
          ? Number(p.price)
          : plan.design.showPrice
            ? [149, 299, 499, 799][Math.min(i, 3)]
            : 0;
      return {
        id: 'create_sys_' + i,
        name: String(nm),
        price: price,
        dur: (typeof p === 'object' && p.dur) || '',
        desc: (typeof p === 'object' && p.desc) || biz.offer || 'Clear package',
        showPrice: !!plan.design.showPrice,
        pricingType: 'flat',
        status: 'active',
        website: true,
        popular: i === 1,
      };
    });
    S.services = priced;
    S.editorSvcs = priced.map(function (s) {
      return Object.assign({}, s);
    });

    // Booking wizard from booking component strategy
    var bk = plan.components.booking || {};
    S.bookingWizard = Object.assign({}, S.bookingWizard || {}, {
      headline: plan.copy.bookingHeadline || (bk.strategy === 'consult-first' ? "Let's find the right fit" : "Let's book your session"),
      blurb:
        plan.copy.bookingBlurb ||
        (bk.strategy === 'consult-first'
          ? 'Start with a consult — then pick a package that fits.'
          : 'Pick a package — then choose a time that works.'),
      helpBlurb: 'Questions before you book? We’re here.',
      sidebarIncludes: (biz.trustSignals || []).slice(0, 3),
    });
    S.paymentSetting = /high|luxury|premium/.test(biz.priceLevel) ? 'deposit' : S.paymentSetting || 'later';

    // AST: layout + composition + block variants + visibility
    if (global.HublyWebsiteAst && typeof global.HublyWebsiteAst.ensurePage === 'function') {
      global.HublyWebsiteAst.ensurePage(S.website, {
        layout: plan.design.layoutId,
        composition: plan.design.composition,
        priority: plan.sectionOrder || ['services', 'reviews', 'gallery', 'about'],
      });
      global.HublyWebsiteAst.setLayout(S.website, plan.design.layoutId);
      global.HublyWebsiteAst.setComposition(S.website, plan.design.composition);
      global.HublyWebsiteAst.setHeroCopy(S.website, { headline: headline, sub: sub });
      var page = S.website.page;
      if (page && page.hero) {
        page.hero.variant = (plan.components.hero && plan.components.hero.id) || 'default';
      }
      if (page && Array.isArray(page.blocks)) {
        page.blocks.forEach(function (b) {
          if (b.type === 'services' || b.type === 'pricing') {
            b.variant = (plan.components.services && plan.components.services.id) || (plan.components.pricing && plan.components.pricing.id) || b.variant;
          }
          if (b.type === 'gallery') {
            b.variant = (plan.components.gallery && plan.components.gallery.id) || b.variant;
            if (plan.components.gallery && plan.components.gallery.hide) b.visible = false;
          }
          if (b.type === 'reviews') {
            b.variant = (plan.components.testimonials && plan.components.testimonials.id) || b.variant;
            if (plan.components.testimonials && plan.components.testimonials.hide) b.visible = false;
          }
          if (b.type === 'faq') {
            b.variant = (plan.components.faq && plan.components.faq.id) || b.variant;
            if (plan.components.faq && plan.components.faq.hide) b.visible = false;
          }
        });
      }
      if (Array.isArray(plan.sectionOrder)) {
        global.HublyWebsiteAst.reorderBlocks(S.website, plan.sectionOrder);
      }
    }

    // Select layout through existing engine (fonts/theme bundle)
    if (typeof global.selectWebsiteLayout === 'function') {
      try {
        global.selectWebsiteLayout(plan.design.layoutId);
      } catch (e) {
        S.website.layout = plan.design.layoutId;
      }
    }

    // CSS component hooks on storefront + create preview roots
    applyComponentClasses(plan);

    // Drive Create studio so canvas/checklist stay honest
    var session = S._is.discovery;
    if (session) {
      session.studio = session.studio || {};
      session.studio.heroTitle = name;
      session.studio.heroSub = sub;
      session.studio.cta = plan.copy.ctaLabel || 'Book now';
      session.studio.ctaElevated = true;
      session.studio.rewrite = true;
      session.studio.bookingOn = true;
      session.studio.packagesOn = true;
      session.studio.brandOn = true;
      session.studio.logo = true;
      session.studio.logoName = name;
      session.studio.pkgChips = pkgs.map(function (p) {
        return typeof p === 'string' ? p : p.name;
      });
      session.studio.bookingChips = plan.bookingChips.slice();
      session.studio.sections = { about: true, services: true, reviews: !(plan.components.testimonials && plan.components.testimonials.hide) };
      session.holyPack = session.holyPack || {};
      session.holyPack.industry = biz.industry || session.holyPack.industry;
      session.holyPack.industryId = biz.industryId || session.holyPack.industryId;
      session.holyPack.packages = session.studio.pkgChips.slice();
      session.holyPack.booking = plan.bookingChips.slice();
      session.holyPack.rewrite = headline;
      session.businessBlueprint = plan;
    }

    S._is._createMediaSeeded = S._is._createMediaSeeded || false;
    S.websiteReady = true;
    return plan;
  }

  function applyComponentClasses(plan) {
    if (!plan || !plan.components) return;
    var roots = [];
    if (global.document) {
      ['p-storefront', 'ws-page', 'is-aw-preview', 'ed-ws-preview'].forEach(function (id) {
        var el = global.document.getElementById(id);
        if (el) roots.push(el);
      });
    }
    var classes = [];
    Object.keys(plan.components).forEach(function (slot) {
      var c = plan.components[slot];
      if (c && c.css) classes.push(c.css);
    });
    if (plan.design && plan.design.direction) {
      classes.push('is-design-' + plan.design.direction);
    }
    roots.forEach(function (root) {
      // Strip prior create-system component classes
      if (root.classList) {
        Array.prototype.slice.call(root.classList).forEach(function (cn) {
          if (/^is-comp-/.test(cn) || /^is-design-/.test(cn)) root.classList.remove(cn);
        });
        classes.forEach(function (cn) {
          root.classList.add(cn);
        });
        root.setAttribute('data-create-systems', '1');
        root.setAttribute('data-design-direction', (plan.design && plan.design.direction) || '');
      }
    });
  }

  /** Build a minimal blueprint from facts when OpenAI omitted the object (still not an industry template). */
  function blueprintFromFacts(facts) {
    facts = facts || {};
    var positioning = String(facts.positioning || '').toLowerCase();
    var visual = String(facts.visualStyle || facts.brandVoice || '').toLowerCase();
    var direction = 'modern';
    if (/premium|luxury/.test(positioning) || /luxury|premium/.test(visual)) direction = 'luxury';
    else if (/bold|athletic|energy/.test(visual)) direction = 'bold';
    else if (/calm|quiet|spa|minimal/.test(visual)) direction = 'minimal';
    else if (/editorial|story/.test(visual)) direction = 'editorial';
    else if (/dark/.test(visual)) direction = 'dark';

    return {
      source: 'facts',
      industry: facts.industry,
      industryId: facts.industryId,
      businessName: facts.businessName,
      idealCustomer: facts.customer || 'clients',
      brandVoice: facts.brandVoice || 'clear and confident',
      offer: facts.positioning || facts.industry || 'results-first service',
      designDirection: direction,
      visualStyle: facts.visualStyle,
      bookingStrategy: facts.bookingStrategy,
      priceLevel: /premium|luxury/.test(positioning) ? 'high' : 'mid',
      area: facts.area,
      components: {},
    };
  }

  global.HublyCreateAssemble = {
    normalizeBlueprint: normalizeBlueprint,
    assemble: assemble,
    applyComponentClasses: applyComponentClasses,
    blueprintFromFacts: blueprintFromFacts,
  };
})(typeof window !== 'undefined' ? window : globalThis);
