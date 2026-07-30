/**
 * Hubly Session (Rule #24)
 * One anonymous session across Landing → Builder → Marketplace → Ask Hubly.
 * Not product-specific. Survives until TTL, upgrade, or explicit clear.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'hubly_session_v1';
  var LEGACY_KEY = 'hubly_builder_session_v1';
  var ANALYTICS_KEY = 'hubly_landing_analytics_v1';
  var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days from last update
  var VERSION = '1.0.0';

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

  function now() { return new Date().toISOString(); }
  function nowMs() { return Date.now(); }

  function emptyImports() {
    return {
      website: null,
      instagram: null,
      google_business: null,
      facebook: null
    };
  }

  function newSession() {
    var created = now();
    return {
      id: 'hs_' + Math.random().toString(36).slice(2, 12),
      version: VERSION,
      kind: 'hubly_session',
      status: 'anonymous',
      createdAt: created,
      updatedAt: created,
      expiresAt: new Date(nowMs() + SESSION_TTL_MS).toISOString(),
      conversation: [],
      memory: [],
      lastText: '',
      progress: 0,
      detected: {
        industry: '',
        businessName: '',
        location: '',
        stage: '',
        intent: 'unknown',
        confidence: 0,
        destination: 'business_builder'
      },
      imports: emptyImports(),
      importJobs: [],
      importProgress: [],
      accountId: null,
      businessId: null,
      handedOffAt: null,
      upgradedAt: null
    };
  }

  function migrateLegacy(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.kind === 'hubly_session') return raw;
    var s = newSession();
    s.id = raw.id || s.id;
    s.createdAt = raw.createdAt || s.createdAt;
    s.updatedAt = raw.updatedAt || s.updatedAt;
    s.conversation = Array.isArray(raw.conversation) ? raw.conversation : [];
    s.lastText = raw.lastText || '';
    s.progress = raw.progress || 0;
    if (raw.detected) {
      s.detected = Object.assign(s.detected, raw.detected);
    }
    if (Array.isArray(raw.detected && raw.detected.imports)) {
      raw.detected.imports.forEach(function (imp) {
        if (imp && imp.type && s.imports[imp.type] === null) {
          s.imports[imp.type] = { type: imp.type, url: imp.url || '', label: imp.label || imp.type, status: 'detected' };
        }
      });
    }
    return s;
  }

  function isExpired(session) {
    if (!session) return true;
    var exp = Date.parse(session.expiresAt || '');
    if (!exp) {
      var updated = Date.parse(session.updatedAt || session.createdAt || '');
      return updated && nowMs() - updated > SESSION_TTL_MS;
    }
    return nowMs() > exp;
  }

  function touch(session) {
    session.updatedAt = now();
    session.expiresAt = new Date(nowMs() + SESSION_TTL_MS).toISOString();
    return session;
  }

  function loadSession() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(SESSION_KEY);
      if (!raw) {
        var legacy = global.localStorage && global.localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          var migrated = migrateLegacy(JSON.parse(legacy));
          if (migrated && !isExpired(migrated)) {
            saveSession(migrated);
            try { global.localStorage.removeItem(LEGACY_KEY); } catch (_) {}
            return migrated;
          }
        }
        return null;
      }
      var parsed = migrateLegacy(JSON.parse(raw));
      if (!parsed || typeof parsed !== 'object') return null;
      if (isExpired(parsed)) {
        clearSession();
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    try {
      if (!session) return null;
      touch(session);
      if (global.localStorage) {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        try { global.localStorage.removeItem(LEGACY_KEY); } catch (_) {}
      }
    } catch (_) { /* quota */ }
    return session;
  }

  function clearSession() {
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(SESSION_KEY);
        global.localStorage.removeItem(LEGACY_KEY);
      }
    } catch (_) {}
  }

  function track(event, payload) {
    try {
      var list = [];
      var raw = global.localStorage && global.localStorage.getItem(ANALYTICS_KEY);
      if (raw) list = JSON.parse(raw) || [];
      list.unshift({ event: event, at: now(), payload: payload || {} });
      if (list.length > 80) list.length = 80;
      if (global.localStorage) global.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function extractUrl(text, re) {
    var m = String(text || '').match(re);
    return m ? m[0] : '';
  }

  function detectImports(text) {
    var t = String(text || '');
    var imports = [];
    var ig = extractUrl(t, /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i);
    if (ig || (/\binstagram\b/i.test(t) && /@[\w.]+/.test(t))) {
      imports.push({ type: 'instagram', label: 'Instagram', url: ig || '' });
    }
    var fb = extractUrl(t, /https?:\/\/(?:www\.)?(?:facebook|fb)\.com\/[^\s]+/i);
    if (fb) imports.push({ type: 'facebook', label: 'Facebook', url: fb });
    var g = extractUrl(t, /https?:\/\/(?:www\.)?(?:google\.[^\s]+\/maps[^\s]*|g\.page\/[^\s]+|business\.google[^\s]*)/i);
    if (g) imports.push({ type: 'google_business', label: 'Google Business', url: g });
    var web = extractUrl(t, /https?:\/\/[^\s]+/i);
    if (web && !/(instagram|facebook|fb\.com|google\.|g\.page)/i.test(web)) {
      imports.push({ type: 'website', label: 'Website', url: web });
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

  function statusLine(u, session) {
    var jobs = (session && session.importProgress) || [];
    if (jobs.length) {
      return 'Hubly ' + jobs[jobs.length - 1];
    }
    var active = session && session.imports ? Object.keys(session.imports).map(function (k) { return session.imports[k]; }).filter(Boolean) : [];
    var analyzing = active.filter(function (i) { return i.status === 'analyzing' || i.status === 'detected'; });
    if (analyzing.length) {
      return 'Hubly detected: ' + analyzing.map(function (i) { return i.label || i.type; }).join(' · ') + ' · starting analysis…';
    }
    var done = active.filter(function (i) { return i.status === 'ready' || i.status === 'partial'; });
    if (done.length) {
      var bits = done.map(function (i) {
        var a = i.analysis || {};
        if (i.type === 'website') {
          var parts = [i.label || 'Website'];
          if (a.serviceCount) parts.push(a.serviceCount + ' services');
          if (a.imageCount) parts.push(a.imageCount + ' photos');
          return parts.join(' · ');
        }
        return (i.label || i.type) + (a.handle ? ' · @' + a.handle : '');
      });
      return 'Hubly detected: ' + bits.join(' · ');
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

  function understand(text, preferredPath) {
    var t = String(text || '');
    var trade = detectTrade(t);
    var location = detectLocation(t);
    var businessName = detectBusinessName(t);
    var stage = detectStage(t);
    var foundImports = detectImports(t);
    var scored = scoreIntent(t, preferredPath || 'business');
    var ready =
      scored.intent === 'hire_pro'
        ? t.trim().length >= 10 && scored.confidence >= 0.55
        : t.trim().length >= 16 && (!!trade || !!businessName || !!location || scored.confidence >= 0.7 || foundImports.length > 0);

    return {
      text: t,
      industry: trade ? trade.label : '',
      tradeId: trade ? trade.id : '',
      location: location,
      businessName: businessName,
      stage: stage || (scored.intent === 'build_business' ? 'startup' : ''),
      intent: scored.intent,
      confidence: scored.confidence,
      imports: foundImports,
      ready: ready,
      destination: scored.intent === 'hire_pro' ? 'marketplace_concierge' : (scored.intent === 'build_business' ? 'business_builder' : (preferredPath === 'help' ? 'marketplace_concierge' : 'business_builder'))
    };
  }

  function upsertSession(understanding) {
    var prev = loadSession() || newSession();
    if (prev.status === 'upgraded' && prev.businessId) {
      /* keep upgraded sessions editable until explicit clear */
    } else if (prev.status !== 'handed_off') {
      prev.status = 'anonymous';
    }
    prev.detected = {
      industry: understanding.industry || prev.detected.industry,
      businessName: understanding.businessName || prev.detected.businessName,
      location: understanding.location || prev.detected.location,
      stage: understanding.stage || prev.detected.stage,
      intent: understanding.intent || prev.detected.intent,
      confidence: understanding.confidence != null ? understanding.confidence : prev.detected.confidence,
      destination: understanding.destination || prev.detected.destination
    };
    prev.lastText = understanding.text;
    prev.progress = understanding.ready ? 1 : (understanding.text.trim().length ? 0.4 : 0);
    if (understanding.text.trim()) {
      var last = prev.conversation[prev.conversation.length - 1];
      if (!last || last.text !== understanding.text) {
        prev.conversation.push({ role: 'user', text: understanding.text, at: now() });
        if (prev.conversation.length > 40) prev.conversation = prev.conversation.slice(-40);
      }
    }
    (understanding.imports || []).forEach(function (imp) {
      if (!imp || !imp.type) return;
      var cur = prev.imports[imp.type];
      if (!cur) {
        prev.imports[imp.type] = {
          type: imp.type,
          label: imp.label || imp.type,
          url: imp.url || '',
          status: 'detected',
          analysis: null,
          startedAt: null,
          finishedAt: null
        };
      } else if (imp.url && !cur.url) {
        cur.url = imp.url;
      }
    });
    understanding.statusLine = statusLine(understanding, prev);
    saveSession(prev);
    return prev;
  }

  function pushProgress(session, line) {
    session.importProgress = session.importProgress || [];
    session.importProgress.push(line);
    if (session.importProgress.length > 12) session.importProgress = session.importProgress.slice(-12);
    saveSession(session);
  }

  function analyzeImportClient(type, url) {
    return fetch('/api/import-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, url: url })
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, json: j };
      });
    }).catch(function (err) {
      return { ok: false, json: { error: String(err && err.message || err) } };
    });
  }

  /**
   * Start real import analysis immediately when URLs are detected.
   * Website: server HTML parse. Social: structured queue + handle extraction.
   */
  function startImportPipeline(onProgress) {
    var session = loadSession();
    if (!session) return Promise.resolve(null);
    var types = ['website', 'instagram', 'google_business', 'facebook'];
    var jobs = [];
    types.forEach(function (type) {
      var item = session.imports[type];
      if (!item || !item.url) return;
      if (item.status === 'ready' || item.status === 'analyzing') return;
      item.status = 'analyzing';
      item.startedAt = now();
      session.status = 'importing';
      jobs.push(type);
    });
    if (!jobs.length) {
      saveSession(session);
      return Promise.resolve(session);
    }
    saveSession(session);
    track('import_pipeline_start', { jobs: jobs });

    var steps = {
      website: ['Reading services…', 'Reading branding…', 'Reading reviews…', 'Reading photos…'],
      instagram: ['Linking Instagram…', 'Queuing profile media…'],
      google_business: ['Linking Google Business…', 'Reading listing signals…'],
      facebook: ['Linking Facebook…', 'Queuing page signals…']
    };

    var chain = Promise.resolve();
    jobs.forEach(function (type) {
      chain = chain.then(function () {
        session = loadSession() || session;
        var item = session.imports[type];
        if (!item) return;
        var msgs = steps[type] || ['Analyzing…'];
        msgs.forEach(function (m, idx) {
          setTimeout(function () {
            var s = loadSession() || session;
            pushProgress(s, m);
            if (typeof onProgress === 'function') onProgress(m, s);
          }, idx * 280);
        });
        return analyzeImportClient(type, item.url).then(function (res) {
          session = loadSession() || session;
          item = session.imports[type];
          if (!item) return;
          if (res.ok && res.json && res.json.ok) {
            item.status = res.json.partial ? 'partial' : 'ready';
            item.analysis = res.json.analysis || {};
            item.finishedAt = now();
            if (res.json.analysis && res.json.analysis.businessName && !session.detected.businessName) {
              session.detected.businessName = res.json.analysis.businessName;
            }
            if (res.json.analysis && res.json.analysis.location && !session.detected.location) {
              session.detected.location = res.json.analysis.location;
            }
            pushProgress(session, (item.label || type) + ' analysis ready');
          } else {
            item.status = 'partial';
            item.analysis = {
              error: (res.json && (res.json.error || res.json.reason)) || 'analyze_failed',
              note: 'Queued for deeper import in Builder'
            };
            item.finishedAt = now();
            pushProgress(session, (item.label || type) + ' linked — deeper import continues in Builder');
          }
          session.importJobs.push({ type: type, status: item.status, at: now() });
          var still = Object.keys(session.imports).some(function (k) {
            return session.imports[k] && session.imports[k].status === 'analyzing';
          });
          if (!still && session.status === 'importing') session.status = 'anonymous';
          saveSession(session);
          if (typeof onProgress === 'function') onProgress(item.status, session);
          track('import_pipeline_item', { type: type, status: item.status });
        });
      });
    });
    return chain.then(function () { return loadSession(); });
  }

  function routeUrl(understanding, session) {
    var sess = session || loadSession();
    var q = encodeURIComponent(String((understanding && understanding.text) || (sess && sess.lastText) || '').trim());
    var hs = sess && sess.id ? '&hs=' + encodeURIComponent(sess.id) : '';
    if ((understanding && (understanding.destination === 'marketplace_concierge' || understanding.intent === 'hire_pro')) ||
        (sess && sess.detected && sess.detected.intent === 'hire_pro')) {
      return q ? '/get-done?q=' + q + hs : '/get-done';
    }
    return q ? '/create?q=' + q + hs : (hs ? '/create?' + hs.slice(1) : '/create');
  }

  function markHandedOff() {
    var s = loadSession();
    if (!s) return null;
    s.status = 'handed_off';
    s.handedOffAt = now();
    return saveSession(s);
  }

  /** Account creation upgrades the anonymous Hubly Session — nothing is recreated. */
  function upgradeToAccount(opts) {
    opts = opts || {};
    var s = loadSession() || newSession();
    s.status = 'upgraded';
    s.upgradedAt = now();
    s.accountId = opts.accountId || s.accountId || ('acct_' + Math.random().toString(36).slice(2, 10));
    s.businessId = opts.businessId || s.businessId || null;
    s.memory = s.memory || [];
    s.memory.push({ kind: 'lifecycle', text: 'Session upgraded to account', at: now() });
    track('session_upgraded', { accountId: s.accountId, businessId: s.businessId });
    return saveSession(s);
  }

  function tradeCatalog() {
    return TRADES.map(function (t) {
      return { id: t.id, label: t.label, phrase: t.phrase };
    });
  }

  /** Builder consumption: structured snapshot — do not re-infer when present. */
  function toBuilderPayload(session) {
    var s = session || loadSession();
    if (!s) return null;
    return {
      sessionId: s.id,
      conversation: s.conversation || [],
      memory: s.memory || [],
      industry: s.detected.industry || '',
      businessName: s.detected.businessName || '',
      location: s.detected.location || '',
      stage: s.detected.stage || '',
      intent: s.detected.intent || '',
      confidence: s.detected.confidence || 0,
      destination: s.detected.destination || 'business_builder',
      imports: {
        website: s.imports.website,
        instagram: s.imports.instagram,
        google_business: s.imports.google_business,
        facebook: s.imports.facebook
      },
      lastText: s.lastText || '',
      importProgress: s.importProgress || []
    };
  }

  var api = {
    version: VERSION,
    SESSION_KEY: SESSION_KEY,
    SESSION_TTL_MS: SESSION_TTL_MS,
    understand: understand,
    upsertSession: upsertSession,
    loadSession: loadSession,
    saveSession: saveSession,
    clearSession: clearSession,
    routeUrl: routeUrl,
    track: track,
    tradeCatalog: tradeCatalog,
    startImportPipeline: startImportPipeline,
    markHandedOff: markHandedOff,
    upgradeToAccount: upgradeToAccount,
    toBuilderPayload: toBuilderPayload,
    statusLine: function (u) {
      return statusLine(u, loadSession());
    },
    isExpired: isExpired
  };

  global.HublySession = api;
  /** Back-compat alias used by landing gates / early PR */
  global.HublyLandingIntent = api;
})(typeof window !== 'undefined' ? window : globalThis);
