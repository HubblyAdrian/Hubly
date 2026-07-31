/**
 * HublyTaste — Recommendation Engine (Sprint 2)
 *
 * Professional judgment, not opinionless answers.
 * Hubly recommends, explains, compares, and lets the customer choose.
 * Never authoritarian. Never neutral when it has enough evidence.
 *
 * Inputs: Business Context, goals, uploads, workspace object, Hubly data
 * Outputs: recommendation, confidence, why, tradeoffs, alternatives, next action
 *
 * Domains: website · commerce · media · marketing · marketplace · branding · pricing
 */
(function (global) {
  'use strict';

  var PREFS_KEY = 'hubly_taste_prefs_v1';

  var STARS = Object.freeze({
    5: { stars: '★★★★★', label: 'Strong Recommendation', min: 90 },
    4: { stars: '★★★★', label: 'Worth Comparing', min: 78 },
    3: { stars: '★★★', label: 'Possible Direction', min: 0 },
  });

  var DOMAINS = Object.freeze([
    'website', 'commerce', 'media', 'marketing', 'marketplace', 'branding', 'pricing', 'copy', 'general',
  ]);

  function S() {
    return global.S || (global.S = {});
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { choices: [], style: null, updatedAt: null };
      var p = JSON.parse(raw);
      return p && typeof p === 'object' ? p : { choices: [], style: null, updatedAt: null };
    } catch (e) {
      return { choices: [], style: null, updatedAt: null };
    }
  }

  function savePrefs(p) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch (e) {}
  }

  function ensurePrefs() {
    var st = S();
    st._taste = st._taste || { prefs: loadPrefs() };
    if (!st._taste.prefs) st._taste.prefs = loadPrefs();
    return st._taste.prefs;
  }

  /** Learn from customer choices — stop making them repeat themselves. */
  function rememberChoice(choiceId, meta) {
    meta = meta || {};
    var prefs = ensurePrefs();
    prefs.choices = prefs.choices || [];
    prefs.choices.push({
      id: String(choiceId || ''),
      style: meta.style || inferStyle(choiceId),
      domain: meta.domain || 'general',
      at: new Date().toISOString(),
    });
    if (prefs.choices.length > 40) prefs.choices = prefs.choices.slice(-40);
    prefs.style = dominantStyle(prefs.choices) || prefs.style;
    prefs.updatedAt = new Date().toISOString();
    savePrefs(prefs);
    return prefs;
  }

  function inferStyle(id) {
    var s = String(id || '').toLowerCase();
    if (/minimal|simple|clean|quiet/.test(s)) return 'minimal';
    if (/luxury|premium|bold|high.?contrast/.test(s)) return 'premium';
    if (/artisan|warm|craft|handmade|classic/.test(s)) return 'artisan';
    return null;
  }

  function dominantStyle(choices) {
    var counts = {};
    (choices || []).forEach(function (c) {
      if (!c.style) return;
      counts[c.style] = (counts[c.style] || 0) + 1;
    });
    var best = null;
    var n = 0;
    Object.keys(counts).forEach(function (k) {
      if (counts[k] > n) { n = counts[k]; best = k; }
    });
    return n >= 2 ? best : best;
  }

  function preferredStyle() {
    return ensurePrefs().style || null;
  }

  function starTier(confidence) {
    var n = Number(confidence) || 0;
    if (n >= 90) return STARS[5];
    if (n >= 78) return STARS[4];
    return STARS[3];
  }

  /**
   * Infer business understanding from context — not just literal words.
   */
  function understand(ctx) {
    ctx = ctx || {};
    var text = String(ctx.text || ctx.seed || '').toLowerCase();
    var biz = ctx.business || {};
    var industry = String(biz.industry || ctx.industry || '');
    var out = {
      model: 'unknown',
      audience: '',
      goals: [],
      brandPersonality: '',
      competitionNote: '',
      experience: ctx.experience || '',
      budget: ctx.budget || '',
      inferences: [],
      evidence: [],
    };

    if (/candle|handmade|soap|jewelry|merch|retail|product/i.test(industry + ' ' + text) || biz.offer === 'product') {
      out.model = 'commerce';
      out.inferences.push('Commerce business — catalog and checkout matter');
      out.inferences.push('Story matters for handmade / maker brands');
      out.inferences.push('Photography quality drives trust');
      out.inferences.push('Repeat customers and mobile shoppers are likely');
      out.audience = 'Shoppers discovering the brand on mobile';
      out.brandPersonality = 'maker / artisan';
      out.evidence.push('stated_offer');
    } else if (/photograph/i.test(industry + ' ' + text)) {
      out.model = 'creative_services';
      out.inferences.push('Portfolio and trust convert before price');
      out.inferences.push('May need bookings, print sales, or both');
      out.audience = 'Clients hiring for emotion and craft';
      out.brandPersonality = 'editorial / premium';
      out.evidence.push('stated_offer');
    } else if (/clean|pressure|lawn|hvac|detail/i.test(industry + ' ' + text) || biz.offer === 'service') {
      out.model = 'local_service';
      out.inferences.push('Trust and booking speed beat brochure length');
      out.inferences.push('Before/after and reviews convert local work');
      out.audience = 'Homeowners hiring locally';
      out.brandPersonality = 'reliable / clear';
      out.evidence.push('stated_offer');
    }

    if (biz.channels === 'online') {
      out.goals.push('online_conversion');
      out.evidence.push('stated_channels');
    } else if (biz.channels === 'local') {
      out.goals.push('brand_in_person');
      out.evidence.push('stated_channels');
    } else if (biz.channels === 'both') {
      out.goals.push('omni_channel');
      out.evidence.push('stated_channels');
    }

    if (ctx.goals) out.goals = out.goals.concat([].concat(ctx.goals));
    if (ctx.uploads && ctx.uploads.length) out.evidence.push('uploads');
    if (ctx.hasWebsite) out.evidence.push('existing_website');

    var pref = preferredStyle();
    if (pref) {
      out.brandPersonality = out.brandPersonality || pref;
      out.evidence.push('learned_preference:' + pref);
      out.inferences.push('You tend to prefer ' + pref + ' directions — I\'ll lean that way unless you say otherwise');
    }

    return out;
  }

  /**
   * Build a typed recommendation card.
   * Requires evidence — if insufficient, returns ask instead of pretending.
   */
  function make(opts) {
    opts = opts || {};
    var understanding = opts.understanding || understand(opts.context || {});
    var evidence = [].concat(opts.evidence || []).concat(understanding.evidence || []);
    evidence = evidence.filter(Boolean);

    if (!opts.allowWithoutEvidence && evidence.length === 0 && !opts.why) {
      return {
        ok: false,
        needClarify: true,
        ask: opts.clarifyAsk || 'Tell me a little more about who you\'re trying to reach — that changes what I\'d recommend.',
        understanding: understanding,
      };
    }

    var confidence = Math.max(0, Math.min(99, Number(opts.confidence) || 85));
    var tier = starTier(confidence);
    var domain = DOMAINS.indexOf(opts.domain) >= 0 ? opts.domain : 'general';

    /* Lean into learned style when recommending among alternatives */
    var preferred = preferredStyle();
    var choice = opts.choice;
    var alternatives = (opts.alternatives || []).slice();
    if (preferred && opts.choices && opts.choices.length) {
      var match = opts.choices.find(function (c) {
        return inferStyle(c.id || c.label) === preferred;
      });
      if (match && !opts.forceChoice) {
        choice = match.label || match.id;
        confidence = Math.min(99, confidence + 3);
        tier = starTier(confidence);
        evidence = evidence.concat(['learned_preference:' + preferred]);
      }
    }

    var card = {
      ok: true,
      recommended: true,
      domain: domain,
      choice: choice,
      title: opts.title || choice,
      confidence: confidence,
      stars: tier.stars,
      confidenceLabel: tier.label,
      why: opts.why || opts.reasoning || '',
      reasoning: opts.why || opts.reasoning || '',
      tradeoffs: opts.tradeoffs || [],
      tradeoffSummary: opts.tradeoffSummary || '',
      alternatives: alternatives,
      compareWith: opts.compareWith || (alternatives[0] && (alternatives[0].id || alternatives[0].label)) || null,
      nextAction: opts.nextAction || opts.nextLead || null,
      nextLead: opts.nextAction || opts.nextLead || null,
      factors: opts.factors || [],
      evidence: evidence,
      understanding: understanding,
      surface: opts.surface || null,
      focusId: opts.focusId || null,
      focusLabel: opts.focusLabel || null,
      choices: opts.choices || null,
      build: opts.build || null,
      pointTarget: opts.pointTarget || null,
      celebrate: !!opts.celebrate,
      coach: opts.coach || null,
    };

    return card;
  }

  /** Domain helpers — same Taste pattern everywhere */
  function forWebsite(ctx, extras) {
    extras = extras || {};
    var u = understand(ctx);
    var pref = preferredStyle();
    var primary = pref === 'premium' ? 'Bold' : (pref === 'artisan' ? 'Classic' : 'Minimal');
    var why = primary === 'Minimal'
      ? 'Most first-time visitors decide in seconds — a clear path to act beats a long brochure.'
      : primary === 'Bold'
        ? 'A high-energy first screen matches a premium brand and makes the CTA unmistakable.'
        : 'Warm, established presence builds trust before the ask — especially for local or handmade brands.';
    return make({
      domain: 'website',
      context: ctx,
      understanding: u,
      choice: primary,
      title: primary,
      confidence: extras.confidence || 93,
      why: extras.why || why,
      tradeoffs: extras.tradeoffs || [
        { label: 'Tradeoff', text: primary === 'Minimal' ? 'Less storytelling up front.' : 'Slightly more visual weight.' },
        { label: 'Gain', text: primary === 'Minimal' ? 'Higher conversion to book or buy.' : 'Stronger emotional first impression.' },
      ],
      alternatives: extras.alternatives || [
        { id: 'minimal', label: 'Minimal', when: 'Best when speed-to-action matters most' },
        { id: 'bold', label: 'Bold', when: 'Better if you want unmistakable brand energy' },
        { id: 'classic', label: 'Classic', when: 'Better if trust and warmth lead' },
      ],
      factors: ['goals', 'audience', 'usability', 'conversion'],
      evidence: extras.evidence || u.evidence,
      choices: extras.choices,
      surface: extras.surface || 'directions',
      focusId: extras.focusId || 'website',
      nextAction: extras.nextAction || 'Pick a direction and I\'ll build it live.',
      build: extras.build,
    });
  }

  function forCommerce(ctx, extras) {
    extras = extras || {};
    var u = understand(ctx);
    var channels = (ctx.business && ctx.business.channels) || '';
    var choice = channels === 'local' ? 'Warm artisan' : (channels === 'online' ? 'Minimal' : 'Warm artisan');
    var why = channels === 'online'
      ? 'Most of your customers will likely shop from mobile — this layout gets them to products faster.'
      : channels === 'local'
        ? 'Handmade and market shoppers buy the story — lead with maker narrative before the product grid.'
        : 'You need both: brand for markets and a fast path to buy online for people who find you later.';
    return make({
      domain: 'commerce',
      context: ctx,
      understanding: u,
      choice: choice,
      title: choice + ' storefront',
      confidence: extras.confidence || (channels ? 94 : 88),
      why: extras.why || why,
      tradeoffs: extras.tradeoffs || [
        { label: 'Tradeoff', text: choice.indexOf('Minimal') === 0 ? 'Less storytelling.' : 'Slightly slower path to checkout.' },
        { label: 'Gain', text: choice.indexOf('Minimal') === 0 ? 'Higher conversion.' : 'Stronger emotional connection for first-time buyers.' },
      ],
      alternatives: [
        { id: 'minimal', label: 'Minimal', when: 'Better if customers already know your brand' },
        { id: 'warm', label: 'Warm artisan', when: 'Best for first-time buyers who need the story' },
        { id: 'bold', label: 'Bold brand', when: 'If your name should dominate the first screen' },
      ],
      factors: ['business_model', 'audience', 'conversion', 'brand'],
      evidence: (channels ? ['stated_channels'] : []).concat(u.evidence),
      surface: 'directions',
      focusId: 'commerce',
      choices: extras.choices,
      nextAction: extras.nextAction || 'Pick a direction and I\'ll build it live in the workspace.',
      build: extras.build,
      allowWithoutEvidence: !!channels || u.evidence.length > 0,
    });
  }

  function forMarketplace(ctx, extras) {
    extras = extras || {};
    return make({
      domain: 'marketplace',
      context: ctx,
      choice: extras.choice || 'Best-fit provider',
      confidence: extras.confidence || 91,
      why: extras.why || 'I recommend the pro whose specialty matches the job — not just the lowest quote.',
      tradeoffs: extras.tradeoffs || [
        { label: 'Tradeoff', text: 'May not be the cheapest option.' },
        { label: 'Gain', text: 'Higher chance the work fits the first time.' },
      ],
      alternatives: extras.alternatives || [],
      factors: ['specialty', 'trust', 'timing'],
      evidence: extras.evidence || ['job_brief'],
      surface: 'marketplace',
      nextAction: extras.nextAction,
      allowWithoutEvidence: true,
    });
  }

  function forMarketing(ctx, extras) {
    extras = extras || {};
    return make({
      domain: 'marketing',
      context: ctx,
      choice: extras.choice || 'Email first',
      confidence: extras.confidence || 87,
      why: extras.why || 'For local promotions, email usually outperforms broad Instagram reach when you already have customer contacts.',
      tradeoffs: [
        { label: 'Tradeoff', text: 'Needs a list or capture path.' },
        { label: 'Gain', text: 'Higher intent and measurable bookings.' },
      ],
      alternatives: [{ id: 'instagram', label: 'Instagram', when: 'Better for brand discovery cold' }],
      factors: ['audience', 'conversion', 'simplicity'],
      evidence: extras.evidence || ['stated_goals'],
      allowWithoutEvidence: true,
      nextAction: extras.nextAction,
    });
  }

  /**
   * Consultative pushback — never "No." Educate + offer compare.
   */
  function consultPushback(request, ctx) {
    var t = String(request || '').toLowerCase();
    var prefs = ensurePrefs();

    if (/twenty|20|\b(lots?|tons?|many)\b.*nav|nav.*\b(items?|links?)\b|clutter/i.test(t) || /\b(15|16|17|18|19|20|25)\s+(menu|nav)/i.test(t)) {
      return {
        ok: true,
        pushback: true,
        message: 'I can absolutely do that. I wanted to mention that websites with fewer navigation options generally help customers find what they\'re looking for faster. Would you like to compare both versions?',
        recommendation: make({
          domain: 'website',
          choice: 'Fewer nav items',
          confidence: 92,
          why: 'Shorter navigation reduces choice overload — customers reach Book or Shop faster.',
          tradeoffs: [
            { label: 'Tradeoff', text: 'Some secondary pages sit one click deeper.' },
            { label: 'Gain', text: 'Clearer path to the action that grows the business.' },
          ],
          alternatives: [{ id: 'full_nav', label: 'Keep all items', when: 'If every link is truly essential' }],
          evidence: ['design_practice'],
          allowWithoutEvidence: true,
          nextAction: 'I can show Simple nav vs Full nav side by side.',
        }),
      };
    }

    if (/neon|hot pink|lime|bright green|comic sans/i.test(t)) {
      return {
        ok: true,
        pushback: true,
        message: 'I can build that. Before I do, would you like to see the version I\'d recommend as well?',
        recommendation: make({
          domain: 'branding',
          choice: 'Brand-safe palette with your accent',
          confidence: 90,
          why: 'Extreme contrast or novelty type can hurt readability and trust — especially on mobile commerce and booking pages.',
          tradeoffs: [
            { label: 'Tradeoff', text: 'Less shock value.' },
            { label: 'Gain', text: 'Easier reading and a more premium first impression.' },
          ],
          alternatives: [{ id: 'as_requested', label: 'Your exact request', when: 'We can still ship it after you compare' }],
          evidence: ['usability_practice'],
          allowWithoutEvidence: true,
          nextAction: 'Compare my recommendation with your request in the workspace.',
        }),
      };
    }

    if (/cheapest|race to the bottom|undercut/i.test(t)) {
      return {
        ok: true,
        pushback: true,
        message: 'I can price it that way. I\'d also show a trust-led package — local customers often choose reliability over the lowest number.',
        recommendation: make({
          domain: 'pricing',
          choice: 'Trust-led pricing',
          confidence: 88,
          why: 'Competing only on price invites churn; leading with proof and a clear mid package usually earns better customers.',
          tradeoffs: [
            { label: 'Tradeoff', text: 'May win fewer bargain hunters.' },
            { label: 'Gain', text: 'Stronger margins and fewer tire-kickers.' },
          ],
          evidence: ['business_practice'],
          allowWithoutEvidence: true,
        }),
      };
    }

    return { ok: false, pushback: false };
  }

  /** Coaching — protect the customer without sounding like a warning banner. */
  function coach(signals) {
    signals = signals || {};
    var tips = [];
    if (signals.pricingLow) {
      tips.push('I noticed your pricing sits lower than similar businesses — we can keep it, or test a mid package that signals quality.');
    }
    if (signals.noDifferentiation) {
      tips.push('Your homepage doesn\'t yet explain what makes you different — one clear sentence above the fold usually helps.');
    }
    if (signals.noReviews) {
      tips.push('You don\'t have reviews yet — I\'d lead with proof photos or a simple guarantee until testimonials land.');
    }
    if (signals.heavyBookingForm) {
      tips.push('Your booking page asks for a lot up front — fewer fields usually means more completed books.');
    }
    return tips;
  }

  function celebrate(kind) {
    var lines = {
      storefront: 'Your storefront is looking fantastic.',
      website: 'I love the direction we\'re taking with the site.',
      progress: 'We\'ve already built more than most businesses launch with.',
      products: 'Nice — the catalog is starting to feel real.',
      general: 'This is coming together beautifully.',
    };
    return lines[kind] || lines.general;
  }

  /** Render recommendation card HTML (workspace + Instant Site). */
  function cardHtml(rec, escFn) {
    if (!rec || !rec.ok && rec.needClarify) return '';
    if (!rec || !(rec.choice || rec.title)) return '';
    var esc = escFn || function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    var stars = rec.stars || starTier(rec.confidence).stars;
    var label = rec.confidenceLabel || starTier(rec.confidence).label;
    var why = rec.why || rec.reasoning || '';
    var trade = '';
    if (rec.tradeoffs && rec.tradeoffs.length) {
      trade = '<ul class="aw-taste-tradeoffs">' + rec.tradeoffs.map(function (t) {
        if (typeof t === 'string') return '<li>' + esc(t) + '</li>';
        return '<li><strong>' + esc(t.label || 'Note') + ':</strong> ' + esc(t.text || '') + '</li>';
      }).join('') + '</ul>';
    } else if (rec.tradeoffSummary) {
      trade = '<p class="aw-taste-tradeoffs">' + esc(rec.tradeoffSummary) + '</p>';
    }
    var alt = '';
    if (rec.alternatives && rec.alternatives.length) {
      var first = rec.alternatives[0];
      var altLabel = typeof first === 'string' ? first : (first.label || first.id);
      var altWhen = typeof first === 'object' && first.when ? first.when : '';
      alt = '<div class="aw-taste-compare"><span class="lbl">Compare</span> ' +
        '<button type="button" class="aw-taste-compare-btn" data-aw-compare="' + esc(altLabel) + '">' +
        esc(altLabel) + '</button>' +
        (altWhen ? '<span class="hint">' + esc(altWhen) + '</span>' : '') +
        '</div>';
    }
    return (
      '<div class="aw-rec aw-taste-card" data-aw-rec="1" data-taste="1">' +
      '<div class="aw-taste-head"><span class="aw-taste-badge">★ Recommended</span>' +
      '<span class="aw-taste-stars" aria-label="' + esc(label) + '">' + esc(stars) + '</span></div>' +
      '<div class="aw-taste-title">' + esc(rec.title || rec.choice) + '</div>' +
      '<div class="aw-taste-conf">' + esc(label) + (rec.confidence != null ? ' · ' + esc(String(rec.confidence)) + '%' : '') + '</div>' +
      (why ? '<p class="aw-rec-why"><strong>Why</strong> — ' + esc(why) + '</p>' : '') +
      (trade ? '<div class="aw-taste-trade"><strong>Tradeoffs</strong>' + trade + '</div>' : '') +
      alt +
      '</div>'
    );
  }

  /** Normalize legacy consultant recommendation into Taste card. */
  function fromLegacy(rec) {
    if (!rec) return null;
    if (rec.stars && rec.why) return rec;
    return make({
      choice: rec.choice,
      title: rec.choice,
      confidence: rec.confidence,
      why: rec.reasoning || rec.why,
      tradeoffs: rec.tradeoffs,
      alternatives: rec.alternatives || (rec.compareWith ? [{ label: rec.compareWith }] : []),
      nextAction: rec.nextLead || rec.nextAction,
      surface: rec.surface,
      focusId: rec.focusId,
      focusLabel: rec.focusLabel,
      choices: rec.choices,
      build: rec.build,
      pointTarget: rec.pointTarget,
      celebrate: rec.celebrate,
      evidence: rec.evidence || ['conversation'],
      allowWithoutEvidence: true,
      domain: rec.domain || 'general',
    });
  }

  global.HublyTaste = {
    version: '1.0.0',
    STARS: STARS,
    DOMAINS: DOMAINS,
    understand: understand,
    make: make,
    forWebsite: forWebsite,
    forCommerce: forCommerce,
    forMarketplace: forMarketplace,
    forMarketing: forMarketing,
    consultPushback: consultPushback,
    coach: coach,
    celebrate: celebrate,
    rememberChoice: rememberChoice,
    preferredStyle: preferredStyle,
    cardHtml: cardHtml,
    fromLegacy: fromLegacy,
    ensurePrefs: ensurePrefs,
    starTier: starTier,
  };
})(typeof window !== 'undefined' ? window : globalThis);
