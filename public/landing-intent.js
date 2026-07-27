/**
 * Hubly Landing Intent Router (Rule #24)
 * Local understanding only — no Brain layer, no account creation.
 * Routes Business Builder vs Marketplace Concierge without removing Marketplace.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'hubly_builder_session_v1';
  var ANALYTICS_KEY = 'hubly_landing_analytics_v1';

  var TRADES = [
    { id: 'detailing', label: 'Detailing', patterns: /\b(detail|detailing|car wash|auto detail|mobile detail)\b/i, phrase: "I'm starting a mobile detailing company" },
    { id: 'cleaning', label: 'Cleaning', patterns: /\b(clean(ing|er)?|housekeep|maid|janitorial)\b/i, phrase: "I'm starting a cleaning company" },
    { id: 'pressure', label: 'Pressure Washing', patterns: /\b(pressure\s*wash|power\s*wash|soft\s*wash)\b/i, phrase: "I'm starting a pressure washing business" },
    { id: 'windows', label: 'Window Cleaning', patterns: /\b(window\s*clean|windows?\s*wash)\b/i, phrase: "I'm starting a window cleaning business" },
    { id: 'photo', label: 'Photography', patterns: /\b(photograph|photographer|wedding\s*photo|headshot)\b/i, phrase: "I'm starting a photography business" },
    { id: 'hvac', label: 'HVAC', patterns: /\b(hvac|air\s*condition|furnace|heating\s*and\s*cooling)\b/i, phrase: "I'm starting an HVAC business" },
    { id: 'lawn', label: 'Lawn Care', patterns: /\b(lawn|landscap|mow(ing)?|yard\s*care)\b/i, phrase: "I'm starting a lawn care business" },
    { id: 'plumbing', label: 'Plumbing', patterns: /\b(plumb(er|ing)?)\b/i, phrase: "I'm starting a plumbing business" }
  ];

  var HIRE_PATTERNS = [
    /\b(i\s+need|need\s+(someone|a|my)|find\s+(me\s+)?(a|someone)|hire|book\s+(a|me)|looking\s+for\s+a)\b/i,
    /\b(my\s+(house|home|car|tesla|windows?|lawn|yard|driveway))\b/i,
    /\b(tomorrow|this\s+(week|weekend|friday|saturday)|asap|urgent)\b/i,
    /\b(get\s+(it\s+)?(done|cleaned|washed|fixed|coated))\b/i
  ];

  var BUILD_PATTERNS = [
    /\b(i\s+(own|run|have|operate)|i'?m\s+(starting|building|launching)|my\s+(business|company|studio))\b/i,
    /\b(need\s+a\s+website|build\s+(my\s+)?(website|business)|price\s+my\s+services|more\s+customers)\b/i,
    /\b(crm|booking\s+software|operating\s+system|grow\s+my\s+business)\b/i,
    /\b(called|doing\s+business\s+as|dba)\b/i
  ];

  function now() {
    return new Date().toISOString();
  }

  function loadSession() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    try {
      if (global.localStorage) global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) { /* ignore quota */ }
    return session;
  }

  function track(event, payload) {
    try {
      var list = [];
      var raw = global.localStorage && global.localStorage.getItem(ANALYTICS_KEY);
      if (raw) list = JSON.parse(raw) || [];
      list.unshift({ event: event, at: now(), payload: payload || {} });
      if (list.length > 80) list.length = 80;
      if (global.localStorage) global.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(list));
    } catch (_) { /* ignore */ }
  }

  function detectImports(text) {
    var t = String(text || '');
    var imports = [];
    if (/instagram\.com\//i.test(t) || /\b@[\w.]+/.test(t) && /instagram/i.test(t)) {
      imports.push({ type: 'instagram', label: 'Instagram' });
    }
    if (/facebook\.com\//i.test(t) || /fb\.com\//i.test(t)) {
      imports.push({ type: 'facebook', label: 'Facebook' });
    }
    if (/google\.(com|co).*\/maps|g\.page\/|business\.google/i.test(t)) {
      imports.push({ type: 'google_business', label: 'Google Business' });
    }
    if (/https?:\/\/[^\s]+/i.test(t) && !/(instagram|facebook|fb\.com|google)/i.test(t)) {
      imports.push({ type: 'website', label: 'Website' });
    }
    return imports;
  }

  function detectTrade(text) {
    for (var i = 0; i < TRADES.length; i++) {
      if (TRADES[i].patterns.test(text)) return TRADES[i];
    }
    return null;
  }

  function detectLocation(text) {
    var m = String(text || '').match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)(?:,\s*([A-Z]{2}))?/);
    if (m) return m[2] ? m[1] + ', ' + m[2] : m[1];
    m = String(text || '').match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
    if (m) return m[1] + ', ' + m[2];
    return '';
  }

  function detectBusinessName(text) {
    var m = String(text || '').match(/\b(?:called|named)\s+([A-Z][\w&'’.-]*(?:\s+[A-Z][\w&'’.-]*){0,4})/);
    if (m) return m[1].trim();
    m = String(text || '').match(/\bmy\s+(?:company|business|studio)\s+([A-Z][\w&'’.-]*(?:\s+[A-Z][\w&'’.-]*){0,3})/);
    if (m) return m[1].trim();
    return '';
  }

  function detectStage(text) {
    var t = String(text || '').toLowerCase();
    if (/\b(starting|start\s+up|startup|new\s+business|just\s+started|launching)\b/.test(t)) return 'startup';
    if (/\b(already\s+have|existing|established|been\s+doing|for\s+\d+\s+years)\b/.test(t)) return 'established';
    if (/\b(grow|more\s+customers|scale|expand)\b/.test(t)) return 'growing';
    return '';
  }

  function scoreIntent(text, preferredPath) {
    var t = String(text || '').trim();
    var hire = 0;
    var build = 0;
    HIRE_PATTERNS.forEach(function (re) { if (re.test(t)) hire += 1; });
    BUILD_PATTERNS.forEach(function (re) { if (re.test(t)) build += 1; });
    if (detectTrade(t) && /\b(i\s+own|i\s+run|i'?m\s+starting|my\s+business|company)\b/i.test(t)) build += 2;
    if (detectTrade(t) && /\b(i\s+need|find|hire|book)\b/i.test(t) && !/\b(own|run|starting|business|company)\b/i.test(t)) hire += 2;

    var intent = 'unknown';
    var confidence = 0.35;
    if (build > hire && build > 0) {
      intent = 'build_business';
      confidence = Math.min(0.98, 0.55 + build * 0.12);
    } else if (hire > build && hire > 0) {
      intent = 'hire_pro';
      confidence = Math.min(0.98, 0.55 + hire * 0.12);
    } else if (preferredPath === 'business') {
      intent = t.length >= 12 ? 'build_business' : 'unknown';
      confidence = t.length >= 24 ? 0.72 : (t.length >= 12 ? 0.55 : 0.3);
    } else if (preferredPath === 'help') {
      intent = t.length >= 8 ? 'hire_pro' : 'unknown';
      confidence = t.length >= 20 ? 0.72 : (t.length >= 8 ? 0.55 : 0.3);
    }
    return { intent: intent, confidence: confidence, hireScore: hire, buildScore: build };
  }

  function understand(text, preferredPath) {
    var t = String(text || '');
    var trade = detectTrade(t);
    var location = detectLocation(t);
    var businessName = detectBusinessName(t);
    var stage = detectStage(t);
    var imports = detectImports(t);
    var scored = scoreIntent(t, preferredPath || 'business');
    var signals = [];
    if (trade) signals.push(trade.label);
    if (location) signals.push(location);
    if (businessName) signals.push(businessName);
    if (stage) signals.push(stage === 'startup' ? 'Startup Business' : (stage === 'growing' ? 'Growing Business' : 'Established Business'));
    if (imports.length) signals.push(imports.map(function (i) { return i.label; }).join(' · '));

    var ready =
      scored.intent === 'hire_pro'
        ? t.trim().length >= 10 && scored.confidence >= 0.55
        : t.trim().length >= 16 && (!!trade || !!businessName || !!location || scored.confidence >= 0.7 || imports.length > 0);

    return {
      text: t,
      industry: trade ? trade.label : '',
      tradeId: trade ? trade.id : '',
      location: location,
      businessName: businessName,
      stage: stage || (scored.intent === 'build_business' ? 'startup' : ''),
      intent: scored.intent,
      confidence: scored.confidence,
      imports: imports,
      signals: signals,
      ready: ready,
      destination: scored.intent === 'hire_pro' ? 'marketplace_concierge' : (scored.intent === 'build_business' ? 'business_builder' : (preferredPath === 'help' ? 'marketplace_concierge' : 'business_builder')),
      statusLine: statusLine({ trade: trade, location: location, stage: stage, imports: imports, intent: scored.intent, ready: ready, text: t })
    };
  }

  function statusLine(u) {
    if (u.imports && u.imports.length) {
      return 'Hubly detected: ' + u.imports.map(function (i) { return i.label; }).join(' · ') + ' · ready to import during setup';
    }
    var parts = [];
    if (u.trade) parts.push(u.trade.label);
    if (u.location) parts.push(u.location);
    if (u.stage === 'startup') parts.push('Startup Business');
    else if (u.stage === 'growing') parts.push('Growing Business');
    else if (u.stage === 'established') parts.push('Established Business');
    if (!parts.length) {
      if (u.intent === 'hire_pro' && String(u.text || '').trim().length >= 8) return 'Hubly understands: looking for a pro';
      if (String(u.text || '').trim().length >= 8) return 'Hubly is learning about your business…';
      return '';
    }
    return 'Hubly understands: ' + parts.join(' · ');
  }

  function upsertSession(understanding) {
    var prev = loadSession() || {
      id: 'bs_' + Math.random().toString(36).slice(2, 10),
      createdAt: now(),
      conversation: [],
      progress: 0
    };
    prev.updatedAt = now();
    prev.detected = {
      industry: understanding.industry,
      businessName: understanding.businessName,
      location: understanding.location,
      stage: understanding.stage,
      intent: understanding.intent,
      confidence: understanding.confidence,
      imports: understanding.imports,
      destination: understanding.destination
    };
    prev.lastText = understanding.text;
    prev.progress = understanding.ready ? 1 : (understanding.text.trim().length ? 0.4 : 0);
    if (understanding.text.trim()) {
      var last = prev.conversation[prev.conversation.length - 1];
      if (!last || last.text !== understanding.text) {
        prev.conversation.push({ role: 'user', text: understanding.text, at: now() });
        if (prev.conversation.length > 24) prev.conversation = prev.conversation.slice(-24);
      }
    }
    return saveSession(prev);
  }

  function routeUrl(understanding) {
    var q = encodeURIComponent(String(understanding.text || '').trim());
    if (understanding.destination === 'marketplace_concierge' || understanding.intent === 'hire_pro') {
      return q ? '/get-done?q=' + q : '/get-done';
    }
    return q ? '/signup?q=' + q : '/signup';
  }

  function tradeCatalog() {
    return TRADES.map(function (t) {
      return { id: t.id, label: t.label, phrase: t.phrase };
    });
  }

  global.HublyLandingIntent = {
    version: '1.0.0',
    understand: understand,
    upsertSession: upsertSession,
    loadSession: loadSession,
    routeUrl: routeUrl,
    track: track,
    tradeCatalog: tradeCatalog,
    SESSION_KEY: SESSION_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
