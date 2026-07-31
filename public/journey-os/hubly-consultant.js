/**
 * Hubly Consultant — make Hubly feel like an expert.
 *
 * Measure success by meaningful progress after each interaction —
 * not by how many questions the AI asks.
 *
 * Pattern: Understand → Recommend → Build → Show → Feedback → Improve → Continue
 */
(function (global) {
  'use strict';

  var MEMORY_KEY = 'hubly_consultant_memory_v1';
  var PATTERN = Object.freeze([
    'understand', 'recommend', 'build', 'show', 'feedback', 'improve', 'continue',
  ]);

  var INTENTS = Object.freeze({
    build_business: 'build_business',
    grow_business: 'grow_business',
    find_help: 'find_help',
    unknown: 'unknown',
  });

  var FOCUS = Object.freeze({
    website: 'Building Website',
    products: 'Creating Products',
    storefront: 'Building Storefront',
    brand: 'Shaping Brand',
    launch: 'Preparing Launch',
    campaign: 'Designing Campaign',
    marketplace: 'Marketplace Request',
    home: 'Home',
  });

  function S() {
    return global.S || (global.S = {});
  }

  function now() {
    return new Date().toISOString();
  }

  function loadMemory() {
    try {
      var raw = localStorage.getItem(MEMORY_KEY);
      if (!raw) return null;
      var m = JSON.parse(raw);
      if (!m || typeof m !== 'object') return null;
      return m;
    } catch (e) {
      return null;
    }
  }

  function saveMemory(mem) {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(mem));
    } catch (e) {}
  }

  function emptyMemory() {
    return {
      version: 1,
      updatedAt: now(),
      intent: INTENTS.unknown,
      focusId: 'vision',
      focusLabel: FOCUS.home,
      project: null,
      business: {
        name: '',
        industry: '',
        offer: '',
        channels: '',
        customers: '',
        city: '',
        hasWebsite: null,
        sells: '',
      },
      finished: [],
      sessions: [],
      lastPrideAt: null,
      turns: 0,
    };
  }

  function ensure() {
    var st = S();
    if (!st._consultant) {
      var mem = loadMemory() || emptyMemory();
      st._consultant = {
        phase: 'understand',
        memory: mem,
        contextUploads: [],
        lastRecommendation: null,
        lastBuild: null,
        lastTurn: null,
      };
    }
    if (!st._consultant.memory) st._consultant.memory = loadMemory() || emptyMemory();
    return st._consultant;
  }

  function persist() {
    var c = ensure();
    c.memory.updatedAt = now();
    saveMemory(c.memory);
  }

  function setPhase(phase) {
    ensure().phase = PATTERN.indexOf(phase) >= 0 ? phase : 'understand';
    return ensure().phase;
  }

  function setFocus(focusId, label) {
    var mem = ensure().memory;
    mem.focusId = focusId || mem.focusId;
    mem.focusLabel = label || FOCUS[focusId] || mem.focusLabel;
    persist();
  }

  function markFinished(label) {
    var mem = ensure().memory;
    if (label && mem.finished.indexOf(label) < 0) mem.finished.push(label);
    mem.lastPrideAt = now();
    persist();
  }

  function startSession(project) {
    var mem = ensure().memory;
    mem.project = project || mem.project || 'website';
    mem.sessions = mem.sessions || [];
    mem.sessions.push({ project: mem.project, startedAt: now(), focus: mem.focusLabel });
    if (mem.sessions.length > 20) mem.sessions = mem.sessions.slice(-20);
    persist();
  }

  /** Continuous intent — can switch mid-conversation. */
  function detectIntent(text, prev) {
    var t = String(text || '').toLowerCase();
    if (/i need|need someone|find (me )?(a |someone)|hire|book (a|me)|get .+ done|airbnb|clean my|fix my/.test(t)
      && !/my (business|company|studio|brand|shop)/.test(t)) {
      return INTENTS.find_help;
    }
    if (/grow|more customers|more bookings|marketing|campaign|seo|ads|leads|scale/.test(t)) {
      return INTENTS.grow_business;
    }
    if (/build|start(ing)?|launch|website|storefront|shop|sell|candle|photograph|business|company|studio/.test(t)) {
      return INTENTS.build_business;
    }
    return prev || INTENTS.unknown;
  }

  function detectIndustry(text) {
    var t = String(text || '');
    var map = [
      [/candle|soy wax|scented/i, 'Candles', 'product'],
      [/photograph|photographer|wedding photo|prints?/i, 'Photography', 'photo'],
      [/pressure\s*wash|power\s*wash/i, 'Pressure Washing', 'service'],
      [/clean(ing|er)?|maid|airbnb|turnover/i, 'Cleaning', 'service'],
      [/lawn|landscap|mow/i, 'Lawn Care', 'service'],
      [/detail|car wash/i, 'Auto Detailing', 'service'],
      [/hvac|heating|air condition/i, 'HVAC', 'service'],
      [/coffee|bakery|food truck|restaurant/i, 'Food & Drink', 'product'],
      [/jewelry|apparel|clothing|merch/i, 'Retail', 'product'],
      [/spa|massage|salon/i, 'Spa & Wellness', 'service'],
    ];
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(t)) return { label: map[i][1], kind: map[i][2] };
    }
    return null;
  }

  function detectChannels(text) {
    var t = String(text || '').toLowerCase();
    if (/both|online and (local|markets)|markets and online/.test(t)) return 'both';
    if (/online|ecommerce|e-commerce|website|instagram shop|etsy|shopify/.test(t)) return 'online';
    if (/market|farmers|popup|local|in.?person|storefront/.test(t)) return 'local';
    if (/referral|word of mouth/.test(t)) return 'referrals';
    if (/marketplace|hubly|find help/.test(t)) return 'marketplace';
    return '';
  }

  function detectSellMode(text) {
    var t = String(text || '').toLowerCase();
    if (/booking|book clients|sessions?/.test(t) && /print|download|digital/.test(t)) return 'bookings_and_commerce';
    if (/print|download|digital|sell (photos|prints)/.test(t)) return 'commerce';
    if (/booking|book clients|sessions?|appointments?/.test(t)) return 'bookings';
    return '';
  }

  function updateBusinessFromText(text) {
    var mem = ensure().memory;
    var b = mem.business;
    var ind = detectIndustry(text);
    if (ind) {
      b.industry = ind.label;
      b.offer = ind.kind;
    }
    var ch = detectChannels(text);
    if (ch) b.channels = ch;
    var sell = detectSellMode(text);
    if (sell) b.sells = sell;
    if (/already have (a )?website|my website is|https?:\/\//i.test(text)) b.hasWebsite = true;
    var nameM = text.match(/(?:called|named)\s+([A-Z][\w\s&'-]{1,40})/);
    if (nameM) b.name = nameM[1].trim();
    var cityM = text.match(/\bin\s+([A-Z][A-Za-z.\s-]{1,32}?)(?:\s*[—,\.]|\s+I\b|\s+we\b|$)/);
    if (cityM) b.city = cityM[1].trim();
    persist();
    return b;
  }

  function confLabel(n) {
    if (n >= 90) return 'Highly Recommended';
    if (n >= 78) return 'Worth Comparing';
    return 'Alternative Direction';
  }

  function recommendation(choice, reasoning, confidence, extras) {
    extras = extras || {};
    return {
      choice: choice,
      reasoning: reasoning,
      confidence: confidence,
      confidenceLabel: confLabel(confidence),
      surface: extras.surface || null,
      focusId: extras.focusId || null,
      focusLabel: extras.focusLabel || null,
      choices: extras.choices || null,
      build: extras.build || null,
      pointTarget: extras.pointTarget || null,
      celebrate: !!extras.celebrate,
      nextLead: extras.nextLead || null,
    };
  }

  function welcomeBack() {
    var mem = ensure().memory;
    if (!mem.finished.length && !mem.project) return null;
    var yesterday = mem.finished[mem.finished.length - 1] || mem.focusLabel;
    var next = 'build your first product collection';
    if (/product|collection|catalog/i.test(String(yesterday))) next = 'prepare your launch';
    else if (/website|storefront/i.test(String(yesterday))) next = 'build your first product collection';
    else if (/campaign/i.test(String(yesterday))) next = 'review what\'s converting';
    else if (/marketplace/i.test(String(yesterday))) next = 'check in on that job';
    var when = 'Earlier';
    try {
      var t = Date.parse(mem.updatedAt || '');
      if (t && Date.now() - t > 12 * 60 * 60 * 1000) when = 'Yesterday';
      else if (t && Date.now() - t > 60 * 60 * 1000) when = 'Earlier today';
    } catch (e) {}
    return {
      text: 'Welcome back. ' + when + ' we ' + (mem.finished.length ? 'finished your ' + yesterday.toLowerCase() : 'were ' + String(mem.focusLabel || 'building').toLowerCase()) + '. Today I\'d love to help you ' + next + '.',
      recommendation: recommendation(
        'Continue where we left off',
        'Continuous sessions feel like a partner — not a reset chat.',
        92,
        { focusId: 'catalog', focusLabel: FOCUS.products, nextLead: 'Shall we pick that up, or start something new?' }
      ),
    };
  }

  /**
   * Core expert turn.
   * Internally answers: need? recommend? build now? upload instead? biggest visible progress?
   */
  function think(ownerText, opts) {
    opts = opts || {};
    var c = ensure();
    var mem = c.memory;
    mem.turns = (mem.turns || 0) + 1;
    var text = String(ownerText || '').trim();
    var prevIntent = mem.intent;
    mem.intent = detectIntent(text, mem.intent);
    var business = updateBusinessFromText(text);
    var replies = [];
    var actions = [];
    var rec = null;

    /* Storefront / shop — morph center immediately */
    if (/\b(storefront|build.*(shop|store)|open.*(shop|store))\b/i.test(text) || /^build my storefront/i.test(text)) {
      setFocus('commerce', FOCUS.storefront);
      startSession('storefront');
      rec = recommendation(
        'Show three storefront directions',
        'People choose better than they invent — three concrete directions beat open-ended design questions.',
        91,
        {
          surface: 'directions',
          focusId: 'commerce',
          focusLabel: FOCUS.storefront,
          build: { kind: 'storefront_directions' },
          nextLead: 'Pick a direction and I\'ll build it live.',
        }
      );
      replies.push({ text: 'Awesome. Before we build it I\'d love your opinion — I created three directions. The workspace is becoming your storefront builder now.' });
      replies.push({ text: rec.reasoning, recommendation: rec });
      replies.push({ text: rec.nextLead });
      c.lastRecommendation = rec;
      setPhase('recommend');
      persist();
      return pack(
        replies,
        [{ type: 'enter_building', project: 'storefront' }, { type: 'set_surface', surface: 'directions' }],
        rec,
        { complete: false, showProgress: true }
      );
    }

    /* Major Studio / campaign projects — re-enter Building Mode */
    if (/campaign|holiday promo|christmas|marketing campaign|email campaign/i.test(text)) {
      setFocus('growth', FOCUS.campaign);
      startSession('campaign');
      rec = recommendation(
        'Open Studio canvas',
        'Major creative work deserves Building Mode — no sidebar, no distraction — so we can ship the campaign visibly.',
        90,
        {
          surface: 'studio',
          focusId: 'growth',
          focusLabel: FOCUS.campaign,
          build: { kind: 'campaign' },
          nextLead: 'Tell me the offer and who it\'s for — I\'ll draft the first campaign in the workspace.',
        }
      );
      replies.push({ text: 'Building Mode is back. Studio is opening in the center — same home, new project.' });
      replies.push({ text: rec.reasoning, recommendation: rec });
      replies.push({ text: rec.nextLead });
      c.lastRecommendation = rec;
      setPhase('build');
      persist();
      return pack(
        replies,
        [{ type: 'enter_building', project: 'campaign' }, { type: 'set_surface', surface: 'studio' }],
        rec,
        { complete: false, showProgress: true }
      );
    }

    /* Intent switch — same conversation */
    if (prevIntent && prevIntent !== INTENTS.unknown && mem.intent !== prevIntent && mem.intent === INTENTS.find_help) {
      setFocus('media', FOCUS.marketplace);
      startSession('marketplace');
      rec = recommendation(
        'Switch to finding help',
        'You shifted from building to getting something done — I\'ll keep this one conversation and open Marketplace in the workspace.',
        93,
        {
          surface: 'marketplace',
          focusId: 'media',
          focusLabel: FOCUS.marketplace,
          build: { kind: 'marketplace_brief' },
          nextLead: 'Tell me the job in one sentence — what needs doing, and when.',
        }
      );
      replies.push({
        text: 'Got it — pivoting. Same chat. I\'m opening Marketplace in the Live Workspace so we can find the right pro.',
      });
      replies.push({ text: rec.reasoning, recommendation: rec });
      replies.push({ text: rec.nextLead });
      c.lastRecommendation = rec;
      c.lastTurn = { text: text, at: now(), intent: mem.intent };
      setPhase('build');
      persist();
      return pack(replies, actions, rec, { complete: false, pride: false });
    }

    /* Find help path */
    if (mem.intent === INTENTS.find_help) {
      return thinkFindHelp(text, business, replies);
    }

    /* Existing website import */
    if (/already have (a )?website|here('?s| is) (my )?site|https?:\/\//i.test(text) || business.hasWebsite) {
      return thinkImportWebsite(text, business, replies);
    }

    /* Photography sell mode — before channel heuristics (\"both\" means bookings+prints here) */
    if (/photograph/i.test(business.industry || '')) {
      if (business.sells || /booking|print|download|sessions?|both/.test(text.toLowerCase())) {
        if (!business.sells) {
          business.sells = detectSellMode(text) || (/both/.test(text.toLowerCase()) ? 'bookings_and_commerce' : '');
          persist();
        }
        if (business.sells) return thinkPhotoSell(text, business, replies);
      }
    }

    /* Channel answer unlocks storefront (product businesses) */
    if (business.channels && /online|local|both|market|referral/.test(business.channels)
      && (/mostly online|local markets|farmers|in person|referrals|mix of both|online and local/i.test(text) || opts.forceChannel
        || (/^(online|local|both|markets?)$/i.test(text.trim())))) {
      return thinkChannelDecision(text, business, replies);
    }

    /* Photography first touch */
    if (/photograph/i.test(business.industry || text) && !business.sells) {
      setFocus('website', FOCUS.website);
      startSession('website');
      rec = recommendation(
        'Clarify booking vs selling',
        'Photographers often need bookings, print sales, digital downloads — or a mix. That answer shapes Website and Commerce together.',
        93,
        {
          focusId: 'website',
          focusLabel: FOCUS.website,
          choices: [
            { id: 'bookings', label: 'Bookings / sessions' },
            { id: 'commerce', label: 'Prints & downloads' },
            { id: 'bookings_and_commerce', label: 'Both' },
          ],
        }
      );
      replies.push({ text: 'Photography — I\'d love to help you sell your work the right way.' });
      replies.push({
        text: 'Quick one that unlocks everything: do you want bookings, print/digital sales, or both?',
        recommendation: rec,
      });
      c.lastRecommendation = rec;
      setPhase('understand');
      persist();
      return pack(replies, actions, rec, { complete: false });
    }

    /* Candle / product business first touch (not photography — handled above) */
    if (
      (!/photograph/i.test(business.industry || text)) &&
      (/candle|soy wax|\bretail\b|product business|sell (candles|soap|jewelry|merch)/i.test(text) || business.offer === 'product')
    ) {
      if (!business.channels) {
        setFocus('commerce', FOCUS.storefront);
        startSession('storefront');
        rec = recommendation(
          'Ask where customers find you',
          'Online vs local markets changes storefront layout, checkout, and how we showcase products.',
          94,
          {
            focusId: 'commerce',
            focusLabel: FOCUS.storefront,
            choices: [
              { id: 'online', label: 'Mostly online' },
              { id: 'local', label: 'Local markets / in person' },
              { id: 'both', label: 'Both' },
            ],
            nextLead: null,
          }
        );
        replies.push({
          text: 'A candle company — nice. I have a couple ideas.',
        });
        replies.push({
          text: 'Are you planning to sell mostly online, at local markets, or both? That changes how I\'d build your storefront.',
          recommendation: rec,
        });
        if (!opts.skipUploadNudge) {
          replies.push({
            text: 'If you already have a logo, price sheet, or Instagram, drop it here — I\'ll build from that instead of guessing.',
          });
        }
        c.lastRecommendation = rec;
        setPhase('understand');
        persist();
        return pack(replies, actions, rec, { complete: false });
      }
      /* Product business answered channel via chip labels */
      if (!business.channels || opts.forceChannel || /online|market|local|both/i.test(text)) {
        if (!business.channels) {
          business.channels = detectChannels(text) || 'both';
          persist();
        }
        return thinkChannelDecision(text, business, replies);
      }
    }

    /* Generic build with industry known — recommend directions and build */
    if (business.industry || detectIndustry(text)) {
      return thinkRecommendAndBuild(text, business, replies);
    }

    /* Grow intent without industry */
    if (mem.intent === INTENTS.grow_business) {
      setFocus('growth', FOCUS.campaign);
      rec = recommendation(
        'Start with the growth lever',
        'Growth without a clear offer usually wastes spend — I\'d rather sharpen what you sell, then campaign.',
        88,
        { focusId: 'growth', focusLabel: FOCUS.campaign }
      );
      replies.push({
        text: 'Let\'s grow. Tell me a little about the business — what you sell and who buys — and I\'ll recommend the highest-leverage next move.',
        recommendation: rec,
      });
      replies.push({
        text: 'If you already have a website, paste the URL and I\'ll import what I can first.',
      });
      c.lastRecommendation = rec;
      persist();
      return pack(replies, actions, rec, { complete: false });
    }

    /* Cold start */
    replies.push({
      text: 'Tell me a little about the business you\'re building — or what you need done today.',
    });
    replies.push({
      text: 'If you have a website, screenshot, PDF, or logo, drop it here. That\'s faster than answering a bunch of questions.',
    });
    setPhase('understand');
    persist();
    return pack(replies, actions, null, { complete: false });
  }

  function thinkChannelDecision(text, business, replies) {
    var c = ensure();
    var ch = business.channels || detectChannels(text) || 'both';
    business.channels = ch;
    persist();
    setFocus('commerce', FOCUS.storefront);
    startSession('storefront');

    var layoutWhy = ch === 'online'
      ? 'Most of your customers will discover you on mobile — I\'d lead with a clean product grid and fast checkout.'
      : ch === 'local'
        ? 'Local markets need a brand-forward look that feels premium in person — and a simple way to reorder online later.'
        : 'You\'ll need both: a strong brand for markets and an easy online shop for people who find you after.';

    var directions = [
      { id: 'minimal', label: 'Minimal', hint: 'Quiet product photography, lots of space', recommended: ch === 'online' },
      { id: 'warm', label: 'Warm artisan', hint: 'Craft, texture, handmade feel', recommended: ch === 'local' || ch === 'both' },
      { id: 'bold', label: 'Bold brand', hint: 'High contrast, unforgettable name lockup', recommended: false },
    ];
    var top = directions.find(function (d) { return d.recommended; }) || directions[0];

    var rec = recommendation(
      top.label + ' storefront',
      layoutWhy,
      ch === 'both' ? 90 : 94,
      {
        surface: 'directions',
        focusId: 'commerce',
        focusLabel: FOCUS.storefront,
        build: { kind: 'storefront_directions', channels: ch, directions: directions },
        choices: directions.map(function (d) {
          return { id: d.id, label: d.label, hint: d.hint, recommended: d.recommended };
        }),
        celebrate: false,
        nextLead: 'Pick a direction and I\'ll build it live in the workspace.',
      }
    );

    replies.push({
      text: 'Perfect — that changes how I\'d build your storefront.',
    });
    replies.push({
      text: 'I created three storefront directions I think fit a ' + (business.industry || 'product') + ' business. ' + layoutWhy,
      recommendation: rec,
    });
    replies.push({ text: rec.nextLead });

    c.lastRecommendation = rec;
    setPhase('recommend');
    persist();
    return pack(replies, [{ type: 'set_surface', surface: 'directions' }, { type: 'enter_building', project: 'storefront' }], rec, {
      complete: false,
      showProgress: true,
    });
  }

  function thinkPhotoSell(text, business, replies) {
    var c = ensure();
    var mode = business.sells || detectSellMode(text) || 'bookings';
    business.sells = mode;
    persist();
    setFocus('website', FOCUS.website);
    startSession('website');

    var rec = recommendation(
      mode === 'bookings_and_commerce' ? 'Website + Commerce together' : (mode === 'commerce' ? 'Lead with shop' : 'Lead with booking'),
      mode === 'bookings'
        ? 'Session photographers convert when the portfolio and Book CTA share the first screen.'
        : mode === 'commerce'
          ? 'Print and download sales need a product-forward storefront, not just a gallery brochure.'
          : 'You need both paths — I\'ll put Book and Shop in the nav and build the homepage around your strongest work.',
      92,
      {
        surface: 'website',
        focusId: 'website',
        focusLabel: FOCUS.website,
        build: { kind: 'website_preview', sellMode: mode },
        pointTarget: mode === 'commerce' ? 'logo' : 'cta',
        celebrate: true,
        nextLead: mode === 'bookings'
          ? 'Next I\'d love to shape your packages — or import a price sheet if you have one.'
          : 'Next let\'s add your first collection so the shop doesn\'t feel empty.',
      }
    );

    replies.push({ text: 'Got it — I\'m updating the Live Workspace to match.' });
    replies.push({
      text: 'I recommend we ' + rec.choice.toLowerCase() + '. ' + rec.reasoning,
      recommendation: rec,
    });
    replies.push({ text: 'Watch the center — that\'s your site taking shape.' });
    replies.push({ text: rec.nextLead });

    markFinished('Website foundation');
    c.lastRecommendation = rec;
    setPhase('show');
    persist();
    return pack(
      replies,
      [
        { type: 'enter_building', project: 'website' },
        { type: 'set_surface', surface: 'website' },
        { type: 'point', target: rec.pointTarget },
        { type: 'celebrate' },
      ],
      rec,
      { complete: false, pride: true, showProgress: true }
    );
  }

  function thinkImportWebsite(text, business, replies) {
    var c = ensure();
    business.hasWebsite = true;
    persist();
    setFocus('website', FOCUS.website);
    startSession('website');
    var urlM = text.match(/https?:\/\/[^\s]+/i);
    var rec = recommendation(
      'Import and improve',
      'Starting from what you already have is faster than rebuilding from zero — then we make the book path and trust signals obvious.',
      91,
      {
        surface: 'website',
        focusId: 'website',
        focusLabel: FOCUS.website,
        build: { kind: 'import_website', url: urlM ? urlM[0] : null },
        pointTarget: 'cta',
        celebrate: true,
        nextLead: 'I\'d move your booking (or shop) CTA higher next — want me to do that?',
      }
    );
    replies.push({
      text: urlM
        ? 'I\'m reading ' + urlM[0] + ' and bringing what I can into the Live Workspace.'
        : 'Paste the URL whenever you\'re ready — I\'ll import what I can and show what changed.',
      recommendation: rec,
    });
    if (urlM) {
      replies.push({ text: 'I\'ll show what I imported, then recommend the highest-impact improvements — not a rebuild for its own sake.' });
      replies.push({ text: rec.nextLead });
      markFinished('Website import');
    }
    c.lastRecommendation = rec;
    setPhase(urlM ? 'show' : 'understand');
    persist();
    return pack(
      replies,
      urlM
        ? [
          { type: 'enter_building', project: 'website' },
          { type: 'set_surface', surface: 'website' },
          { type: 'point', target: 'cta' },
          { type: 'celebrate' },
        ]
        : [],
      rec,
      { complete: false, pride: !!urlM, showProgress: !!urlM }
    );
  }

  function thinkFindHelp(text, business, replies) {
    var c = ensure();
    setFocus('media', FOCUS.marketplace);
    startSession('marketplace');
    var job = '';
    if (/airbnb|turnover|short.?term/i.test(text)) job = 'Airbnb cleaning / turnover';
    else if (/clean/i.test(text)) job = 'Cleaning';
    else if (/photograph/i.test(text)) job = 'Photography';
    else if (/lawn|mow/i.test(text)) job = 'Lawn care';
    else job = 'Home service';

    var needWhen = !/(tomorrow|today|this week|weekend|friday|saturday|asap|urgent)/i.test(text);
    var needPlace = !/\bin\s+[A-Z]/.test(text) && !business.city;

    if (needWhen || needPlace) {
      var recQ = recommendation(
        'One unlocking follow-up',
        'Timing and place change which pros I recommend — I ask only what changes the match.',
        90,
        { surface: 'marketplace', focusId: 'media', focusLabel: FOCUS.marketplace }
      );
      replies.push({ text: 'I can help with that — still one conversation.' });
      if (needWhen) {
        replies.push({
          text: 'When do you need it done — and is this a one-time job or recurring?',
          recommendation: recQ,
        });
      } else if (needPlace) {
        replies.push({
          text: 'Where should the pro show up? City or neighborhood is enough.',
          recommendation: recQ,
        });
      }
      c.lastRecommendation = recQ;
      setPhase('understand');
      persist();
      return pack(replies, [{ type: 'enter_building', project: 'marketplace' }, { type: 'set_surface', surface: 'marketplace' }], recQ, {
        complete: false,
        showProgress: true,
      });
    }

    var rec = recommendation(
      'Show trusted pros',
      'You gave enough to match — visible recommendations beat more questions.',
      91,
      {
        surface: 'marketplace',
        focusId: 'media',
        focusLabel: FOCUS.marketplace,
        build: { kind: 'marketplace_match', job: job },
        celebrate: true,
        nextLead: 'Pick a pro and I\'ll help you book — or tweak the brief.',
      }
    );
    replies.push({ text: 'Here\'s what I\'m matching: ' + job + (business.city ? ' in ' + business.city : '') + '.' });
    replies.push({
      text: 'I\'m putting trusted recommendations in the Live Workspace now.',
      recommendation: rec,
    });
    replies.push({ text: rec.nextLead });
    c.lastRecommendation = rec;
    setPhase('show');
    persist();
    return pack(
      replies,
      [
        { type: 'enter_building', project: 'marketplace' },
        { type: 'set_surface', surface: 'marketplace' },
        { type: 'celebrate' },
      ],
      rec,
      { complete: false, pride: true, showProgress: true }
    );
  }

  function thinkRecommendAndBuild(text, business, replies) {
    var c = ensure();
    var ind = business.industry || (detectIndustry(text) && detectIndustry(text).label) || 'your business';
    setFocus('website', FOCUS.website);
    startSession('website');

    var rec = recommendation(
      'Three homepage directions',
      'People choose better than they invent — three concrete directions beat open-ended design questions, and local trust converts faster with a clear next step.',
      93,
      {
        surface: 'directions',
        focusId: 'website',
        focusLabel: FOCUS.website,
        build: { kind: 'website_directions', industry: ind },
        choices: [
          { id: 'minimal', label: 'Minimal', hint: 'Clean, calm, book-first', recommended: true },
          { id: 'bold', label: 'Bold', hint: 'High energy, unmistakable CTA' },
          { id: 'classic', label: 'Classic', hint: 'Warm, established, trust-led' },
        ],
        nextLead: 'Pick one and I\'ll build it live — then we\'ll improve together.',
      }
    );

    replies.push({ text: 'I understand ' + ind + '. Here\'s what I\'d do first.' });
    replies.push({
      text: 'I created three directions for your homepage. I recommend Minimal because a clear path to act beats a long brochure for first-time visitors.',
      recommendation: rec,
    });
    replies.push({ text: rec.nextLead });

    c.lastRecommendation = rec;
    setPhase('recommend');
    persist();
    return pack(
      replies,
      [{ type: 'enter_building', project: 'website' }, { type: 'set_surface', surface: 'directions' }],
      rec,
      { complete: true, showProgress: true }
    );
  }

  function pack(replies, actions, recommendation, meta) {
    meta = meta || {};
    ensure().lastTurn = { at: now(), replies: replies.length, intent: ensure().memory.intent };
    return {
      ok: true,
      replies: replies,
      actions: actions || [],
      recommendation: recommendation || null,
      memory: ensure().memory,
      phase: ensure().phase,
      complete: !!meta.complete,
      pride: !!meta.pride,
      showProgress: !!meta.showProgress,
    };
  }

  /** Apply think() actions onto HublyAIWorkspace when available. */
  function applyToWorkspace(result) {
    var AW = global.HublyAIWorkspace;
    if (!AW || !result) return;
    (result.actions || []).forEach(function (a) {
      if (!a) return;
      if (a.type === 'enter_building' && AW.enterBuildingMode) AW.enterBuildingMode(a.project);
      if (a.type === 'set_surface' && AW.setSurface) AW.setSurface(a.surface);
      if (a.type === 'point' && AW.pointAt) AW.pointAt(a.target);
      if (a.type === 'celebrate' && AW.celebrate) AW.celebrate();
    });
    if (result.recommendation && result.recommendation.focusId && AW.setMilestone) {
      AW.setMilestone(result.recommendation.focusId);
    }
    if (result.pride && AW.celebrate) AW.celebrate();
    if (result.showProgress && AW.setDoing) {
      AW.setDoing(result.recommendation && result.recommendation.choice
        ? ('Building: ' + result.recommendation.choice + '…')
        : 'Updating the workspace…');
    }
  }

  function shouldSkipQuestionnaire(discoverySession) {
    if (!discoverySession) return false;
    var facts = discoverySession.facts || {};
    var hasIndustry = !!(facts.industry && facts.industry.confidence >= 70);
    var seed = String(discoverySession.seed || '').trim();
    return (seed.length >= 18 && hasIndustry) || (hasIndustry && seed.length >= 10);
  }

  function firstRecommendation(discoverySession) {
    var seeded = think(
      (discoverySession && discoverySession.seed) || 'I want to build my business',
      { skipUploadNudge: false }
    );
    if (seeded.recommendation) return Object.assign({}, seeded.recommendation, {
      industry: (discoverySession && discoverySession.facts && discoverySession.facts.industry && discoverySession.facts.industry.value) || '',
      nextSurface: (seeded.recommendation.surface) || 'website',
      message: (seeded.replies[0] && seeded.replies[0].text) || seeded.recommendation.choice,
    });
    return {
      choice: 'Build with you',
      confidence: 88,
      reasoning: 'Visible progress beats a questionnaire.',
      message: 'Let\'s build something you can see.',
      nextSurface: 'website',
    };
  }

  function encourageContext(phase) {
    var lines = {
      understand: 'If you already have a price sheet, website, logo, or Instagram — drop it here. I\'ll import instead of interrogating.',
      recommend: 'A screenshot of a brand you love makes my recommendation sharper.',
      build: 'Logo, menu PDF, or Canva export — I\'ll build from your materials.',
      improve: 'Paste a screenshot of what feels off and I\'ll point at the workspace and fix it.',
    };
    return lines[phase] || lines.understand;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function buildFromContext(opts) {
    opts = opts || {};
    var st = S();
    var bizId = (global.currentBusiness && global.currentBusiness.id) || st.businessId || opts.businessId || null;
    var db = global.db || (global.HublySupabase && global.HublySupabase.client) || null;
    if (!db || typeof db.functions === 'undefined' || typeof db.functions.invoke !== 'function') {
      return {
        ok: false,
        error: 'not_configured',
        message: 'Provider not configured — Hubly can\'t call AI until keys exist.',
      };
    }
    var inspiration = opts.inspirationImage || null;
    var ownerMessage = String(opts.message || opts.prompt || '').trim();
    var files = opts.files || [];
    if (!inspiration && files.length) {
      var img = files.find(function (f) { return /^image\//.test(f.type || ''); });
      if (img) {
        try { inspiration = await fileToDataUrl(img); } catch (e) {}
      }
    }
    ensure().contextUploads = (ensure().contextUploads || []).concat(
      (files || []).map(function (f) { return f.name; })
    );
    setPhase('build');
    if (inspiration) {
      try {
        var cd = await db.functions.invoke('creative-director', {
          body: {
            business_id: bizId,
            owner_message: ownerMessage || 'Build from this inspiration. Recommend layout, colors, CTA. Show concrete changes.',
            inspiration_image: inspiration,
            surface: opts.surface || 'website',
          },
        });
        if (cd.error || (cd.data && cd.data.error)) {
          var msg = (cd.data && cd.data.error) || (cd.error && cd.error.message) || 'AI unavailable';
          if (/not configured|API_KEY|isn't configured/i.test(String(msg))) {
            return { ok: false, error: 'not_configured', message: 'Provider not configured' };
          }
          return { ok: false, error: 'ai_failed', message: String(msg) };
        }
        setPhase('show');
        markFinished('Build from upload');
        ensure().lastBuild = { kind: 'creative_director', data: cd.data };
        return { ok: true, kind: 'creative_director', data: cd.data };
      } catch (e) {
        return { ok: false, error: 'ai_failed', message: String(e && e.message || e) };
      }
    }
    if (bizId) {
      try {
        var gs = await db.functions.invoke('generate-site', {
          body: {
            business_id: bizId,
            business_name: st.biz || opts.businessName || 'Your Business',
            description: ownerMessage || st.about || st.tag || '',
            service_area_cities: st.serviceAreaCities || (st.city ? [st.city] : []),
            business_type: st.businessType || null,
            context_notes: ownerMessage,
            inspiration_image: inspiration || undefined,
            blueprint: (typeof global.HublyBlueprints !== 'undefined' && global.HublyBlueprints.aiGuidance)
              ? global.HublyBlueprints.aiGuidance(st.businessType)
              : null,
          },
        });
        if (gs.error || (gs.data && gs.data.error)) {
          var gmsg = (gs.data && gs.data.error) || (gs.error && gs.error.message) || 'AI unavailable';
          if (/not configured|API_KEY|isn't configured/i.test(String(gmsg))) {
            return { ok: false, error: 'not_configured', message: 'Provider not configured' };
          }
          return { ok: false, error: 'ai_failed', message: String(gmsg) };
        }
        setPhase('show');
        markFinished('Website copy');
        ensure().lastBuild = { kind: 'generate_site', data: gs.data };
        return { ok: true, kind: 'generate_site', data: gs.data };
      } catch (e2) {
        return { ok: false, error: 'ai_failed', message: String(e2 && e2.message || e2) };
      }
    }
    return {
      ok: false,
      error: 'need_context',
      message: 'Share a screenshot, logo, PDF, or website — I\'ll build as soon as we have something real to work from.',
    };
  }

  global.HublyConsultant = {
    version: '2.0.0',
    pattern: PATTERN,
    intents: INTENTS,
    focusLabels: FOCUS,
    ensure: ensure,
    persist: persist,
    loadMemory: loadMemory,
    setPhase: setPhase,
    setFocus: setFocus,
    startSession: startSession,
    markFinished: markFinished,
    detectIntent: detectIntent,
    welcomeBack: welcomeBack,
    think: think,
    applyToWorkspace: applyToWorkspace,
    shouldSkipQuestionnaire: shouldSkipQuestionnaire,
    firstRecommendation: firstRecommendation,
    encourageContext: encourageContext,
    buildFromContext: buildFromContext,
    fileToDataUrl: fileToDataUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
