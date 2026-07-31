/**
 * Hubly Business Quality — Phase 2 · Make It Beautiful
 *
 * Not "a good website." A believable business.
 * Brand System → Section Quality → Copy Review → Image Direction →
 * Trust → Conversion → Mobile → Launch Review → Business Health
 *
 * Extends Website Quality. Does not invent Brain layers.
 * Confidence comes from evidence — never from sounding decisive.
 */
(function (global) {
  'use strict';

  var HEALTH_DIMS = Object.freeze(['brand', 'website', 'trust', 'conversion', 'mobile', 'readiness']);

  function S() {
    return global.S || (global.S = {});
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, Number(n) || 0));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function industryKey(ctx) {
    ctx = ctx || {};
    var raw = String(ctx.industryKey || ctx.industry || ctx.industryLabel || ctx.seed ||
      (ctx.business && ctx.business.industry) || '').toLowerCase();
    if (/candle|soap|jewelry|handmade|merch|retail|product/.test(raw)) return 'maker';
    if (/photo|wedding/.test(raw)) return 'photography';
    if (/clean|maid|airbnb|turnover/.test(raw)) return 'cleaning';
    if (/hvac|heating|furnace|air\s*condition/.test(raw)) return 'hvac';
    if (/pressure|power\s*wash|soft\s*wash/.test(raw)) return 'pressure_washing';
    if (/lawn|landscap|mow/.test(raw)) return 'lawn';
    if (/spa|massage|salon/.test(raw)) return 'spa';
    return 'local_service';
  }

  function modelOf(ctx) {
    var key = industryKey(ctx);
    if (key === 'maker') return 'commerce';
    if (key === 'photography') return 'creative_services';
    return 'local_service';
  }

  /* ── 1. Real Brand Systems ── */

  function buildBrandSystem(ctx) {
    ctx = ctx || {};
    var key = industryKey(ctx);
    var model = modelOf(ctx);
    var direction = String(ctx.direction || ctx.theme || 'minimal').toLowerCase();
    var name = String(ctx.businessName || ctx.biz || (ctx.business && ctx.business.name) || 'Your business').trim();
    var buyerIntent = (ctx.business && ctx.business.buyerIntent) || ctx.buyerIntent || '';

    var packs = {
      maker: {
        personality: direction === 'bold' ? 'Bold artisan' : (direction === 'classic' || direction === 'warm' ? 'Warm maker' : 'Quiet craft'),
        voice: buyerIntent === 'gift'
          ? 'Warm, occasion-aware, generous — help people pick the right gift without pressure.'
          : 'Honest craft, sensory detail, first-person maker pride — never corporate.',
        imageStyle: 'Natural light, textured surfaces, hands-in-frame process shots',
        photography: buyerIntent === 'gift'
          ? 'Lifestyle moments (gift-giving, tablescapes) over dense product grids'
          : 'Hero product on clean surface + one lifestyle scene; skip five tiny thumbnails',
        iconStyle: 'Line icons, soft corners, minimal fill',
        buttonStyle: 'Solid brand CTA, 12px radius, high contrast label',
        cardStyle: 'Soft border, generous padding, one focal image',
        motionStyle: 'Slow fade / gentle lift — calm, never flashy',
      },
      photography: {
        personality: 'Editorial & intimate',
        voice: 'Quiet confidence. Story first. Never salesy.',
        imageStyle: 'Full-bleed gallery, muted grade, emotion over gear',
        photography: 'Three atmosphere photos above the fold — not a grid of twenty',
        iconStyle: 'Thin line, gallery-adjacent',
        buttonStyle: 'Soft outline secondary + solid inquire primary',
        cardStyle: 'Image-led, sparse text',
        motionStyle: 'Slow crossfade between frames',
      },
      cleaning: {
        personality: 'Reliable & calm',
        voice: 'Clear, on-time language. Hosts hate ambiguity.',
        imageStyle: 'Bright, tidy proof — before/after pairs',
        photography: 'One before/after hero beats a collage of mops',
        iconStyle: 'Simple filled icons',
        buttonStyle: 'Solid book CTA, secondary plan link',
        cardStyle: 'Plan cards with one proof line',
        motionStyle: 'Quick, tidy transitions',
      },
      pressure_washing: {
        personality: 'Premium & reliable',
        voice: 'Proof before the quote. No hype.',
        imageStyle: 'High-contrast before/after curb appeal',
        photography: 'Wide property shot + tight before/after — not stock smiles',
        iconStyle: 'Solid trust icons',
        buttonStyle: 'Bold quote CTA',
        cardStyle: 'Package cards with outcome line',
        motionStyle: 'Crisp, confident',
      },
      hvac: {
        personality: 'Trusted & steady',
        voice: 'Peace of mind. Plans before panic.',
        imageStyle: 'Clean technician professionalism, credential-forward',
        photography: 'Licensed tech + home comfort scene — avoid scary broken units as hero',
        iconStyle: 'Solid, readable',
        buttonStyle: 'Plan CTA primary, emergency secondary only if needed',
        cardStyle: 'Plan-led cards',
        motionStyle: 'Steady, low drama',
      },
      local_service: {
        personality: direction === 'bold' ? 'Bold local' : 'Clear & trustworthy',
        voice: 'Neighborly expertise. Specific about what you do and who you serve.',
        imageStyle: 'Real local work, faces when possible',
        photography: 'One strong proof image in the hero band',
        iconStyle: 'Simple line',
        buttonStyle: 'Single primary CTA',
        cardStyle: 'Service cards with outcome',
        motionStyle: 'Subtle',
      },
    };

    var pack = packs[key] || packs.local_service;
    if (key === 'lawn' || key === 'spa') pack = packs.local_service;

    return {
      version: '1.0.0',
      businessName: name,
      model: model,
      industryKey: key,
      personality: pack.personality,
      voice: pack.voice,
      imageStyle: pack.imageStyle,
      photographyDirection: pack.photography,
      iconStyle: pack.iconStyle,
      buttonStyle: pack.buttonStyle,
      cardStyle: pack.cardStyle,
      motionStyle: pack.motionStyle,
      typography: direction === 'classic'
        ? { heading: 'Georgia', body: 'DM Sans' }
        : { heading: 'Plus Jakarta Sans', body: 'DM Sans' },
      colors: {
        primary: (global.S && global.S.color) || '#D9632D',
        navy: '#141B2B',
        surface: direction === 'bold' ? '#141B2B' : '#FCFCFC',
      },
      inheritNote: 'Every future page should inherit this Brand System automatically.',
    };
  }

  /** Merge Brand System into a Studio-style brand kit object (mutates). */
  function applyBrandSystemToKit(kit, system) {
    kit = kit || {};
    system = system || buildBrandSystem({});
    kit.system = system;
    kit.personality = system.personality;
    kit.voice = system.voice;
    kit.imageStyle = system.imageStyle;
    kit.photographyDirection = system.photographyDirection;
    kit.iconStyle = system.iconStyle;
    kit.buttonStyle = system.buttonStyle;
    kit.cardStyle = system.cardStyle;
    kit.motionStyle = system.motionStyle;
    if (system.typography) kit.typography = Object.assign({}, kit.typography || {}, system.typography);
    if (!Array.isArray(kit.voice_tones) || !kit.voice_tones.length) {
      kit.voice_tones = [
        { id: 'primary', label: system.personality, status: 'active', blurb: system.voice },
      ];
    } else {
      kit.voice_tones[0].label = system.personality;
      kit.voice_tones[0].blurb = system.voice;
      kit.voice_tones[0].status = 'active';
    }
    kit.updatedAt = new Date().toISOString();
    return kit;
  }

  /* ── 2. Section Quality — justify every section ── */

  function sectionPlan(ctx) {
    ctx = ctx || {};
    var key = industryKey(ctx);
    var plans = {
      maker: [
        { id: 'hero', title: 'Hero', why: 'Lead with the feeling of the product — shoppers decide in seconds.' },
        { id: 'story', title: 'Maker story', why: 'Handmade brands sell trust in the maker before the SKU.' },
        { id: 'products', title: 'Featured products', why: 'Three heroes beat a wall of everything.' },
        { id: 'trust', title: 'Reviews & guarantee', why: 'First-time buyers need social proof and a clear return promise.' },
        { id: 'process', title: 'How it\'s made', why: 'Process photos justify price without a hard sell.' },
        { id: 'faq', title: 'Shipping & care FAQ', why: 'Removes friction before checkout.' },
      ],
      photography: [
        { id: 'hero', title: 'Hero gallery', why: 'Emotion first — couples buy the feeling.' },
        { id: 'portfolio', title: 'Selected work', why: 'Proof of craft before packages.' },
        { id: 'about', title: 'About the photographer', why: 'People hire people.' },
        { id: 'packages', title: 'Experiences', why: 'Simplified choices convert better than menus.' },
        { id: 'reviews', title: 'Kind words', why: 'Trust closes the inquiry.' },
        { id: 'inquire', title: 'Inquire', why: 'One clear next step — no competing CTAs.' },
      ],
      cleaning: [
        { id: 'hero', title: 'Hero', why: 'Reliability promise first for hosts.' },
        { id: 'plans', title: 'Recurring plans', why: 'The real growth engine is recurrence.' },
        { id: 'reviews', title: 'Host reviews', why: 'Hosts punish no-shows harder than price.' },
        { id: 'process', title: 'How turnovers work', why: 'Clarity reduces back-and-forth.' },
        { id: 'book', title: 'Book', why: 'Easy recurring book path.' },
      ],
      pressure_washing: [
        { id: 'hero', title: 'Hero', why: 'Proof-first curb appeal with an immediate quote path.' },
        { id: 'proof', title: 'Before / after', why: 'Visual proof beats paragraphs for this trade.' },
        { id: 'packages', title: 'Packages', why: 'Three clear tiers increase conversion.' },
        { id: 'reviews', title: 'Reviews', why: 'Local trust closes the quote.' },
        { id: 'book', title: 'Book / Get quote', why: 'One ask on the homepage.' },
      ],
      hvac: [
        { id: 'hero', title: 'Hero', why: 'Peace of mind before price.' },
        { id: 'plans', title: 'Maintenance plans', why: 'Plans grow steadier than emergency-only shops.' },
        { id: 'trust', title: 'Credentials & reviews', why: 'Licensed language reduces fear.' },
        { id: 'process', title: 'What to expect', why: 'Removes appointment anxiety.' },
        { id: 'book', title: 'Book service', why: 'Fast path without burying the plan.' },
      ],
      local_service: [
        { id: 'hero', title: 'Hero', why: 'Who you help and the clear next step.' },
        { id: 'services', title: 'Services', why: 'Specific offers beat generic about pages.' },
        { id: 'proof', title: 'Proof', why: 'Reviews or before/after before long biography.' },
        { id: 'about', title: 'About', why: 'Personality after trust is earned.' },
        { id: 'book', title: 'Book', why: 'One primary CTA.' },
      ],
    };

    var sections = plans[key] || plans.local_service;
    return {
      industryKey: key,
      firstMessage: sections[0] ? sections[0].why : 'Lead with the clearest customer outcome.',
      sections: sections,
      rationale: 'I ordered this page around what this business should say first — not a generic template.',
      avoid: ['Random About early', 'Five competing CTAs', 'Gallery before trust for local trades without proof'],
    };
  }

  /* ── 3. AI Copy Review — generate → critique → rewrite ── */

  function reviewCopy(copy, ctx) {
    ctx = ctx || {};
    copy = copy || {};
    var brand = ctx.brandSystem || buildBrandSystem(ctx);
    var drafts = [];
    var fields = [
      { key: 'heroTitle', label: 'Hero title', value: copy.heroTitle || copy.hero || '' },
      { key: 'heroSub', label: 'Hero subtitle', value: copy.heroSub || copy.tagline || '' },
      { key: 'about', label: 'About', value: copy.about || copy.aboutBody || '' },
      { key: 'cta', label: 'CTA', value: copy.cta || '' },
    ];

    fields.forEach(function (f) {
      var text = String(f.value || '').trim();
      if (!text) return;
      var issues = [];
      if (/taking shape|built with care|local —|best in town|we care about|quality service|your one.?stop/i.test(text)) {
        issues.push('Sounds generic — could belong to any business.');
      }
      if (text.length < 12 && f.key !== 'cta') issues.push('Too thin to feel specific.');
      if (/\b(synergy|leverage|solutions|passionate about)\b/i.test(text)) {
        issues.push('Corporate filler — rewrite in human voice.');
      }
      var rewrite = text;
      if (issues.length) {
        if (f.key === 'heroSub') {
          rewrite = brand.model === 'commerce'
            ? 'Handmade with care — clear photos, honest materials, easy checkout.'
            : 'Clear pricing, real proof, and a booking path that doesn\'t waste your time.';
        } else if (f.key === 'about') {
          rewrite = brand.voice.split('—')[0].trim() + ' Here\'s how we work with customers like you.';
        } else if (f.key === 'cta') {
          rewrite = brand.model === 'commerce' ? 'Shop the collection' : (brand.industryKey === 'photography' ? 'Inquire' : 'Get a quote');
        }
      }
      drafts.push({
        key: f.key,
        label: f.label,
        original: text,
        issues: issues,
        rewrite: issues.length ? rewrite : text,
        changed: issues.length > 0 && rewrite !== text,
      });
    });

    var changed = drafts.filter(function (d) { return d.changed; });
    return {
      ok: true,
      brandVoice: brand.voice,
      drafts: drafts,
      changedCount: changed.length,
      message: changed.length
        ? 'I reviewed the copy. ' + changed.length + ' paragraph' + (changed.length === 1 ? '' : 's') + ' felt generic — I rewrote ' + (changed.length === 1 ? 'it' : 'them') + ' in your brand voice.'
        : 'Copy review passed — the language already feels specific enough to ship.',
      apply: function (target) {
        target = target || copy;
        changed.forEach(function (d) { target[d.key] = d.rewrite; });
        return target;
      },
    };
  }

  /* ── 4. Image Direction — coach, don't just ask for uploads ── */

  function imageDirection(ctx, live) {
    ctx = ctx || {};
    live = live || {};
    var brand = ctx.brandSystem || buildBrandSystem(ctx);
    var key = brand.industryKey;
    var tips = [];

    if (key === 'maker') {
      tips.push({
        id: 'lifestyle_hero',
        title: 'One wide lifestyle photo',
        detail: 'I think your homepage would be much stronger with one wide lifestyle photo instead of five small product images.',
        action: 'Prefer a single hero scene; keep product grid below.',
      });
    } else if (key === 'photography') {
      tips.push({
        id: 'atmosphere_three',
        title: 'Three atmosphere frames',
        detail: 'Lead with three atmosphere photos above the fold — emotion converts before packages.',
        action: 'Pin three full-bleed frames; hide the rest behind Selected work.',
      });
    } else if (key === 'pressure_washing' || key === 'cleaning') {
      tips.push({
        id: 'before_after',
        title: 'Before / after pair',
        detail: 'A single before/after pair above the fold will outperform a collage of equipment.',
        action: 'Shoot or crop one wide proof pair for the hero band.',
      });
    } else {
      tips.push({
        id: 'one_proof',
        title: 'One proof image',
        detail: 'One strong photo of real work beats a stock smile. I can place it as soon as you drop it in.',
        action: 'Upload one wide proof photo — I\'ll place and crop it.',
      });
    }

    tips.push({
      id: 'coach_not_dump',
      title: 'I\'ll coach the shot list',
      detail: brand.photographyDirection,
      action: 'Follow Brand System photography direction on every new page.',
    });

    if ((live.chips || []).filter(function (c) { return /gallery|portfolio|photo/i.test(c.label || ''); }).length > 3) {
      tips.unshift({
        id: 'too_many_thumbs',
        title: 'Too many small images',
        detail: 'Five small thumbnails dilute the first impression. Let\'s promote one hero and demote the rest.',
        action: 'Collapse to one hero + proof strip.',
      });
    }

    return {
      brandImageStyle: brand.imageStyle,
      photographyDirection: brand.photographyDirection,
      tips: tips.slice(0, 3),
      message: tips[0].detail,
      coach: true,
    };
  }

  /* ── 5. Trust Building — AI decides the mix ── */

  function trustPlan(ctx, live) {
    ctx = ctx || {};
    live = live || {};
    var key = industryKey(ctx);
    var reviewCount = Number(ctx.reviewCount);
    if (!Number.isFinite(reviewCount)) {
      reviewCount = (live.reviews && live.reviews.length) || 0;
    }
    var elements = [];

    if (key === 'pressure_washing' || key === 'cleaning') {
      elements.push({ id: 'before_after', label: 'Before / After', priority: 'high', why: 'Visual proof is the trust language for this trade.' });
      elements.push({ id: 'guarantee', label: 'Satisfaction guarantee', priority: 'high', why: 'Removes fear of damage or no-shows.' });
    }
    if (key === 'hvac') {
      elements.push({ id: 'badges', label: 'Licensed & insured badges', priority: 'high', why: 'Credentials reduce emergency fear.' });
      elements.push({ id: 'process', label: 'What to expect', priority: 'med', why: 'Process clarity builds calm.' });
    }
    if (key === 'maker') {
      elements.push({ id: 'reviews', label: 'Customer reviews', priority: 'high', why: 'First-time buyers need social proof.' });
      elements.push({ id: 'policies', label: 'Shipping & returns', priority: 'high', why: 'Policies remove checkout anxiety.' });
      elements.push({ id: 'process', label: 'How it\'s made', priority: 'med', why: 'Maker process justifies price.' });
    }
    if (key === 'photography') {
      elements.push({ id: 'reviews', label: 'Couple / client reviews', priority: 'high', why: 'People hire people they trust.' });
      elements.push({ id: 'faq', label: 'Booking FAQ', priority: 'med', why: 'Answers timing and deliverables early.' });
    }

    elements.push({ id: 'reviews', label: 'Reviews', priority: reviewCount < 3 ? 'high' : 'med', why: 'Social proof compounds trust.' });
    elements.push({ id: 'faq', label: 'FAQs', priority: 'med', why: 'Answers objections without a sales call.' });

    /* Deduplicate by id */
    var seen = {};
    elements = elements.filter(function (e) {
      if (seen[e.id]) return false;
      seen[e.id] = true;
      return true;
    });

    var honest = [];
    if (reviewCount <= 1) {
      honest.push('You only have ' + reviewCount + ' review' + (reviewCount === 1 ? '' : 's') + ' showing — customers may still struggle to trust you until we collect a few more.');
    }
    if (!live.trustBadges || !live.trustBadges.length) {
      honest.push('I\'d add a simple guarantee or credential line above the fold.');
    }

    return {
      elements: elements.slice(0, 5),
      reviewCount: reviewCount,
      honest: honest,
      message: honest[0] || ('I\'d lead trust with ' + elements[0].label + ' — ' + elements[0].why),
      applyDefaults: function (target) {
        target = target || live;
        target.trustBadges = target.trustBadges || [];
        if (elements.some(function (e) { return e.id === 'guarantee' || e.id === 'badges'; })) {
          if (!target.trustBadges.length) {
            target.trustBadges = key === 'hvac'
              ? ['Licensed & insured', 'Maintenance plans', 'Clear pricing']
              : ['Satisfaction guarantee', 'Local & insured', 'Clear pricing'];
          }
        }
        if (elements.some(function (e) { return e.id === 'policies'; }) && !target.policies) {
          target.policies = ['Shipping timelines posted', 'Easy returns within 30 days'];
        }
        return target;
      },
    };
  }

  /* ── 6. Conversion Coaching ── */

  function conversionCoach(live, ctx) {
    live = live || {};
    ctx = ctx || {};
    var findings = [];
    if (live.ctaSecondary) {
      findings.push({
        id: 'competing_cta',
        title: 'Competing CTAs',
        detail: 'I think your CTA is competing with a second ask. Let\'s simplify to one clear action.',
        improve: 'one_cta',
      });
    }
    if (live.nav && live.nav.length > 5) {
      findings.push({
        id: 'nav_noise',
        title: 'Nav is stealing attention',
        detail: 'Your navigation is competing with the primary action. Lean it down so Book / Shop wins.',
        improve: 'lean_nav',
      });
    }
    if ((live.packages || []).length && (live.chips || []).filter(function (c) { return /gallery|portfolio/i.test(c.label || ''); }).length && live.ctaSecondary) {
      findings.push({
        id: 'gallery_vs_cta',
        title: 'Gallery vs CTA',
        detail: 'I think your CTA is competing with your gallery. Let\'s simplify — proof first, then one ask.',
        improve: 'one_cta',
      });
    }
    if (!findings.length) {
      findings.push({
        id: 'steady',
        title: 'Conversion path is clear',
        detail: 'One primary action is visible — I\'ll keep watching as we add sections.',
        improve: null,
      });
    }
    return {
      findings: findings.slice(0, 3),
      message: findings[0].detail,
      needsSimplify: findings.some(function (f) { return f.improve; }),
    };
  }

  /* ── 7. Mobile Perfection ── */

  function mobileReview(live) {
    live = live || {};
    var findings = [];
    if (live.nav && live.nav.length > 4) {
      findings.push({
        id: 'mobile_nav',
        title: 'Hide crowded nav on phones',
        detail: 'Most customers will never see desktop first — keep the CTA and trust line above the fold on mobile.',
      });
    }
    if (live.ctaSecondary) {
      findings.push({
        id: 'mobile_cta',
        title: 'One thumb-friendly CTA',
        detail: 'On a phone, two buttons fight for the same thumb. Keep one primary.',
      });
    }
    if (!(live.quality && live.quality.spacing === 'premium')) {
      findings.push({
        id: 'mobile_space',
        title: 'Breathing room',
        detail: 'Increase hero padding on small screens so the headline and CTA don\'t feel cramped.',
      });
    }
    if (!findings.length) {
      findings.push({
        id: 'mobile_ok',
        title: 'Mobile hierarchy looks solid',
        detail: 'CTA and trust can land without scrolling past noise.',
      });
    }
    return {
      findings: findings.slice(0, 3),
      message: findings[0].detail,
      score: clamp(96 - findings.filter(function (f) { return f.id !== 'mobile_ok'; }).length * 8, 60, 99),
    };
  }

  /* ── 8. Launch Review ── */

  function launchReview(ctx, live) {
    ctx = ctx || {};
    live = live || {};
    var brand = ctx.brandSystem || buildBrandSystem(ctx);
    var sections = sectionPlan(ctx);
    var copy = reviewCopy({
      heroTitle: live.heroTitle,
      heroSub: live.heroSub,
      cta: live.cta,
      about: live.about,
    }, { brandSystem: brand, business: ctx.business });
    var images = imageDirection({ brandSystem: brand, industry: ctx.industry }, live);
    var trust = trustPlan(ctx, live);
    var conversion = conversionCoach(live, ctx);
    var mobile = mobileReview(live);
    var websiteScores = null;
    if (global.HublyWebsiteQuality && global.HublyWebsiteQuality.score) {
      websiteScores = global.HublyWebsiteQuality.score(live, { theme: live.theme });
    }

    var improvements = [];
    copy.drafts.filter(function (d) { return d.changed; }).forEach(function (d) {
      improvements.push({ area: 'Copy', title: d.label, detail: d.issues[0] || 'Rewrite for brand voice.', action: 'rewrite_copy' });
    });
    if (trust.honest.length) {
      improvements.push({ area: 'Trust', title: 'Trust gap', detail: trust.honest[0], action: 'trust_strip' });
    }
    if (conversion.needsSimplify) {
      improvements.push({ area: 'Conversion', title: conversion.findings[0].title, detail: conversion.findings[0].detail, action: conversion.findings[0].improve });
    }
    improvements.push({ area: 'Images', title: images.tips[0].title, detail: images.tips[0].detail, action: 'image_direction' });
    if (mobile.score < 90) {
      improvements.push({ area: 'Mobile', title: mobile.findings[0].title, detail: mobile.findings[0].detail, action: 'mobile_cta' });
    }

    improvements = improvements.slice(0, 5);

    return {
      headline: 'I reviewed everything.',
      intro: 'Here\'s what I\'d improve before going live.',
      brandSystem: brand,
      sections: sections,
      copy: copy,
      images: images,
      trust: trust,
      conversion: conversion,
      mobile: mobile,
      websiteScores: websiteScores,
      improvements: improvements,
      message: [
        'I reviewed everything.',
        '',
        'Here\'s what I\'d improve before going live:',
        improvements.map(function (item, i) {
          return (i + 1) + '. ' + item.area + ' — ' + item.detail;
        }).join('\n'),
        '',
        'Your Brand System (' + brand.personality + ') will carry through every page from here.',
      ].join('\n'),
      actions: [
        { id: 'improve', label: 'Improve' },
        { id: 'ignore', label: 'Launch anyway' },
        { id: 'compare', label: 'Compare' },
      ],
    };
  }

  function launchReviewHtml(review) {
    if (!review) return '';
    var rows = (review.improvements || []).map(function (item) {
      return '<div class="bq-item"><span>' + esc(item.area) + '</span><strong>' + esc(item.title) + '</strong><p>' + esc(item.detail) + '</p></div>';
    }).join('');
    var acts = (review.actions || []).map(function (a) {
      return '<button type="button" class="bq-act" data-bq-act="' + esc(a.id) + '">' + esc(a.label) + '</button>';
    }).join('');
    return (
      '<div class="bq-launch" data-business-quality="launch">' +
      '<div class="bq-head"><strong>Launch Review</strong><em>Before going live</em></div>' +
      '<p class="bq-intro">' + esc(review.intro) + '</p>' +
      '<div class="bq-items">' + rows + '</div>' +
      '<div class="bq-acts">' + acts + '</div></div>'
    );
  }

  /* ── 9. Business Health — not analytics ── */

  function assessHealth(ctx) {
    ctx = ctx || {};
    var live = ctx.live || {};
    var reviewCount = Number(ctx.reviewCount);
    if (!Number.isFinite(reviewCount)) reviewCount = (live.reviews && live.reviews.length) || 0;
    var hasEmailCapture = !!(ctx.hasEmailCapture || live.emailCapture);
    var hasBrandSystem = !!(ctx.brandSystem || (live && live.brandSystem));
    var websiteOverall = 80;
    if (global.HublyWebsiteQuality && global.HublyWebsiteQuality.score) {
      websiteOverall = global.HublyWebsiteQuality.score(live, { theme: live.theme }).overall;
    } else if (ctx.websiteScore != null) {
      websiteOverall = Number(ctx.websiteScore) || 80;
    }

    var scores = {
      brand: hasBrandSystem ? 90 : 72,
      website: clamp(websiteOverall, 40, 99),
      trust: clamp(55 + Math.min(reviewCount, 8) * 5 + ((live.trustBadges && live.trustBadges.length) ? 10 : 0), 40, 99),
      conversion: live.ctaSecondary || (live.nav && live.nav.length > 6) ? 68 : 88,
      mobile: mobileReview(live).score,
      readiness: ctx.websiteLive === false ? 60 : (ctx.stripeConnected ? 92 : 78),
    };

    /* Evidence discipline — don't pretend certainty with empty data */
    var evidenceNotes = [];
    if (!Number.isFinite(Number(ctx.reviewCount)) && !(live.reviews && live.reviews.length)) {
      evidenceNotes.push('I don\'t have enough review data yet to score Trust confidently.');
      scores.trust = Math.min(scores.trust, 70);
    }
    if (ctx.bookingCount == null && ctx.revenueLabel == null) {
      evidenceNotes.push('I don\'t have enough information to judge revenue health yet — I\'m scoring what customers can see.');
    }

    var weakest = HEALTH_DIMS.slice().sort(function (a, b) { return scores[a] - scores[b]; })[0];
    var overall = Math.round(HEALTH_DIMS.reduce(function (a, k) { return a + scores[k]; }, 0) / HEALTH_DIMS.length);

    var narrative;
    if (overall >= 88 && scores.trust >= 80) {
      narrative = 'Your business looks healthy — clear brand, solid site, and enough trust signals to launch with confidence.';
    } else if (scores.website >= 85 && scores.trust < 75) {
      narrative = 'Your website is beautiful, but customers may still struggle to trust you' +
        (reviewCount <= 1 ? ' because you only have ' + reviewCount + ' review' + (reviewCount === 1 ? '' : 's') + '.' : '.');
    } else if (scores.brand >= 85 && !hasEmailCapture && modelOf(ctx) === 'commerce') {
      narrative = 'You have excellent products, but no email capture — visitors leave without a way back.';
    } else if (evidenceNotes.length && overall < 80) {
      narrative = evidenceNotes[0] + ' Here\'s what I can see so far — and what I\'d improve next.';
    } else {
      narrative = 'Solid start. I\'d focus on ' + labelHealth(weakest) + ' next so the business feels as strong as it looks.';
    }

    var recommendations = [];
    if (scores.trust < 80) {
      recommendations.push({
        id: 'trust',
        title: 'Strengthen trust',
        detail: reviewCount <= 1
          ? 'Collect two more real reviews before you spend on ads.'
          : 'Add a guarantee or credential line above the fold.',
      });
    }
    if (!hasEmailCapture && modelOf(ctx) === 'commerce') {
      recommendations.push({
        id: 'email',
        title: 'Add email capture',
        detail: 'A simple “new drops” capture turns one-time visitors into customers you can reach again.',
      });
    }
    if (scores.conversion < 80) {
      recommendations.push({
        id: 'cta',
        title: 'Simplify the ask',
        detail: 'One clear CTA — stop competing with gallery and secondary buttons.',
      });
    }
    if (!hasBrandSystem) {
      recommendations.push({
        id: 'brand',
        title: 'Lock the Brand System',
        detail: 'Personality, voice, and image direction should inherit on every new page.',
      });
    }

    return {
      overall: overall,
      label: overall >= 88 ? 'Healthy' : (overall >= 75 ? 'Promising' : 'Needs care'),
      narrative: narrative,
      scores: scores,
      weakest: weakest,
      dimensions: HEALTH_DIMS.map(function (id) {
        return {
          id: id,
          label: labelHealth(id),
          score: scores[id],
          why: dimensionWhy(id, scores[id], { reviewCount: reviewCount, hasEmailCapture: hasEmailCapture }),
        };
      }),
      recommendations: recommendations.slice(0, 3),
      evidenceNotes: evidenceNotes,
      message: narrative,
    };
  }

  function labelHealth(id) {
    return ({
      brand: 'Brand',
      website: 'Website',
      trust: 'Trust',
      conversion: 'Conversion',
      mobile: 'Mobile',
      readiness: 'Readiness',
    })[id] || id;
  }

  function dimensionWhy(id, score, meta) {
    if (id === 'trust' && meta.reviewCount <= 1) {
      return 'Only ' + meta.reviewCount + ' review' + (meta.reviewCount === 1 ? '' : 's') + ' on the surface — trust is the gap.';
    }
    if (id === 'conversion' && score < 80) return 'More than one ask is diluting the primary action.';
    if (id === 'brand' && score < 80) return 'Brand System isn\'t locked — future pages may drift.';
    if (id === 'mobile') return 'Most customers will see mobile first.';
    if (id === 'readiness') return 'Launch readiness — payments and live paths when credentials exist.';
    return 'Based on what customers can experience today.';
  }

  function healthHtml(health) {
    if (!health || !health.scores) return '';
    var rows = HEALTH_DIMS.map(function (k) {
      var weak = k === health.weakest ? ' is-weak' : '';
      return '<div class="bq-score' + weak + '"><span>' + esc(labelHealth(k)) + '</span><strong>' + esc(String(health.scores[k])) + '</strong></div>';
    }).join('');
    var recs = (health.recommendations || []).map(function (r) {
      return '<div class="bq-rec"><strong>' + esc(r.title) + '</strong><p>' + esc(r.detail) + '</p></div>';
    }).join('');
    return (
      '<div class="bq-health" data-business-quality="health">' +
      '<div class="bq-head"><strong>Business Health</strong><em>' + esc(health.label) + ' · ' + esc(String(health.overall)) + '</em></div>' +
      '<p class="bq-intro">' + esc(health.narrative) + '</p>' +
      '<div class="bq-scores">' + rows + '</div>' +
      (recs ? '<div class="bq-recs">' + recs + '</div>' : '') +
      '</div>'
    );
  }

  function brandSystemHtml(system) {
    if (!system) return '';
    var rows = [
      ['Personality', system.personality],
      ['Voice', system.voice],
      ['Image style', system.imageStyle],
      ['Photography', system.photographyDirection],
      ['Buttons', system.buttonStyle],
      ['Motion', system.motionStyle],
    ].map(function (pair) {
      return '<div class="bq-brand-row"><span>' + esc(pair[0]) + '</span><p>' + esc(pair[1]) + '</p></div>';
    }).join('');
    return (
      '<div class="bq-brand" data-business-quality="brand">' +
      '<div class="bq-head"><strong>Brand System</strong><em>' + esc(system.personality) + '</em></div>' +
      rows +
      '<p class="bq-note">' + esc(system.inheritNote) + '</p></div>'
    );
  }

  /** Apply a Business Quality improvement onto live preview (uses WQ when available). */
  function applyImprovement(live, action, ctx) {
    live = live || {};
    ctx = ctx || {};
    if (action === 'rewrite_copy') {
      var copy = reviewCopy({
        heroTitle: live.heroTitle,
        heroSub: live.heroSub,
        cta: live.cta,
        about: live.about,
      }, ctx);
      copy.apply(live);
      return live;
    }
    if (action === 'image_direction') {
      live.imageDirection = imageDirection(ctx, live);
      live.chips = live.chips || [];
      if (!live.chips.some(function (c) { return c.label === 'Image direction'; })) {
        live.chips.push({ label: 'Image direction', on: true });
      }
      return live;
    }
    if (action === 'trust_strip' || action === 'one_cta' || action === 'lean_nav' || action === 'mobile_cta' || action === 'hero_specific' || action === 'polish_spacing') {
      if (global.HublyWebsiteQuality && global.HublyWebsiteQuality.applyImprovement) {
        return global.HublyWebsiteQuality.applyImprovement(live, action, ctx);
      }
    }
    if (action === 'trust_strip') {
      trustPlan(ctx, live).applyDefaults(live);
    }
    return live;
  }

  function handleLaunchAction(act, review, experience) {
    act = String(act || '');
    if (act === 'ignore') {
      return { ok: true, launch: true, message: 'Understood — we can launch. I\'ll keep coaching improvements after you\'re live.' };
    }
    if (act === 'compare') {
      return { ok: true, compare: true, message: 'I\'ll show the current version beside the improved one.' };
    }
    if (act === 'improve') {
      var live = (experience && experience.live) || {};
      var top = review && review.improvements && review.improvements[0];
      applyImprovement(live, (top && top.action) || 'trust_strip', {
        brandSystem: review && review.brandSystem,
        business: experience && experience.business,
        industry: experience && experience.industryLabel,
        biz: live.heroTitle,
      });
      if (experience) experience.live = live;
      var next = launchReview({ brandSystem: review && review.brandSystem, industry: experience && experience.industryLabel }, live);
      if (experience) experience.launchReview = next;
      return {
        ok: true,
        improved: true,
        live: live,
        review: next,
        message: 'Updated. I re-reviewed — we can keep improving or go live when you\'re ready.',
      };
    }
    return { ok: false };
  }

  /** Full pass used by Creative Build / Workspace after website quality. */
  function enrichExperience(experience) {
    if (!experience || !experience.live) return null;
    var ctx = {
      industry: experience.industryLabel || experience.industryKey,
      industryKey: experience.industryKey,
      direction: experience.chosenDirection || experience.live.theme,
      businessName: (global.S && global.S.biz) || experience.live.heroTitle,
      business: experience.business,
      live: experience.live,
      reviewCount: experience.reviewCount,
    };
    var brand = buildBrandSystem(ctx);
    experience.live.brandSystem = brand;
    experience.brandSystem = brand;

    try {
      if (global.HublyStudio && typeof global.HublyStudio.ensureBrandKit === 'function') {
        var kit = global.HublyStudio.ensureBrandKit();
        applyBrandSystemToKit(kit, brand);
        if (typeof global.HublyStudio.saveBrandKit === 'function') {
          global.HublyStudio.saveBrandKit({ silent: true });
        }
      } else {
        var st = S();
        st._studio = st._studio || {};
        st._studio.brandKit = applyBrandSystemToKit(st._studio.brandKit || {}, brand);
      }
    } catch (e) {}

    experience.sectionPlan = sectionPlan(ctx);
    experience.live.sectionPlan = experience.sectionPlan;
    experience.live.sectionOrder = experience.sectionPlan.sections.map(function (s) { return s.id; });

    var copy = reviewCopy({
      heroTitle: experience.live.heroTitle,
      heroSub: experience.live.heroSub,
      cta: experience.live.cta,
      about: experience.live.about,
    }, { brandSystem: brand });
    copy.apply(experience.live);
    experience.copyReview = copy;

    experience.imageDirection = imageDirection({ brandSystem: brand }, experience.live);
    experience.trustPlan = trustPlan(ctx, experience.live);
    experience.trustPlan.applyDefaults(experience.live);
    experience.conversionCoach = conversionCoach(experience.live, ctx);
    experience.mobileReview = mobileReview(experience.live);
    experience.health = assessHealth(ctx);
    return experience;
  }

  global.HublyBusinessQuality = {
    version: '1.0.0',
    HEALTH_DIMS: HEALTH_DIMS,
    industryKey: industryKey,
    buildBrandSystem: buildBrandSystem,
    applyBrandSystemToKit: applyBrandSystemToKit,
    sectionPlan: sectionPlan,
    reviewCopy: reviewCopy,
    imageDirection: imageDirection,
    trustPlan: trustPlan,
    conversionCoach: conversionCoach,
    mobileReview: mobileReview,
    launchReview: launchReview,
    launchReviewHtml: launchReviewHtml,
    assessHealth: assessHealth,
    healthHtml: healthHtml,
    brandSystemHtml: brandSystemHtml,
    applyImprovement: applyImprovement,
    handleLaunchAction: handleLaunchAction,
    enrichExperience: enrichExperience,
  };
})(typeof window !== 'undefined' ? window : globalThis);
