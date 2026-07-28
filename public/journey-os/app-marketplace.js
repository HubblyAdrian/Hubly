/**
 * Hubly Apps — Connected Apps (owner-facing).
 * Overview · status · available integrations · connect/disconnect · last sync · settings.
 * Intent pipeline stays available as an internal developer tool (collapsed).
 */
(function (global) {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg) {
    try { if (typeof global.toast === 'function') global.toast(msg); } catch (_) {}
  }
  function businessId() {
    try {
      if (global.currentBusiness && global.currentBusiness.id) return String(global.currentBusiness.id);
      if (global.HublyJourney && typeof global.HublyJourney.getActiveBusinessId === 'function') {
        return global.HublyJourney.getActiveBusinessId() || '';
      }
      var S = global.S || {};
      return S.businessId || S.bizId || (S.business && S.business.id) || '';
    } catch (_) {
      return '';
    }
  }
  function Apps() { return global.HublyConnectedApps || null; }

  function formatWhen(iso) {
    if (!iso) return 'Never';
    try {
      var d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return 'Never';
      var diff = Date.now() - d.getTime();
      if (diff < 60e3) return 'Just now';
      if (diff < 3600e3) return Math.floor(diff / 60e3) + 'm ago';
      if (diff < 86400e3) return Math.floor(diff / 3600e3) + 'h ago';
      return d.toLocaleDateString();
    } catch (_) {
      return 'Never';
    }
  }

  function readConnectionMeta(appId) {
    try {
      var raw = global.localStorage && localStorage.getItem('hubly_app_meta_' + businessId());
      if (!raw) return {};
      var all = JSON.parse(raw) || {};
      return all[appId] || {};
    } catch (_) {
      return {};
    }
  }

  function writeConnectionMeta(appId, patch) {
    try {
      var key = 'hubly_app_meta_' + businessId();
      var all = {};
      try { all = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { all = {}; }
      all[appId] = Object.assign({}, all[appId] || {}, patch || {});
      localStorage.setItem(key, JSON.stringify(all));
    } catch (_) {}
  }

  async function liveStatusFor(app) {
    var facade = Apps() && Apps().getFacade(app.id);
    var meta = readConnectionMeta(app.id);
    var base = {
      connected: false,
      health: 'disconnected',
      accountLabel: null,
      lastSyncAt: meta.lastSyncAt || null,
      message: 'Not connected',
    };
    if (!facade) return base;
    try {
      if (typeof facade.status === 'function') {
        var res = await facade.status({ businessId: businessId() });
        var data = (res && res.data) || {};
        return {
          connected: !!(data.connected || (res && res.status === 'connected')),
          health: data.health || (data.connected ? 'healthy' : 'disconnected'),
          accountLabel: data.accountLabel || data.adobeAccount || null,
          lastSyncAt: data.lastSyncAt || meta.lastSyncAt || null,
          tokenExpiresAt: data.tokenExpiresAt || null,
          message: (res && res.message) || data.message || '',
        };
      }
      if (typeof facade.isConnected === 'function' && facade.isConnected()) {
        return Object.assign(base, { connected: true, health: 'healthy', message: 'Connected' });
      }
    } catch (_) {}
    return base;
  }

  function statusPill(st) {
    if (st.health === 'not_configured') {
      return '<span class="am-pill am-pill-warn">Needs setup</span>';
    }
    if (st.connected) return '<span class="am-pill am-pill-ok">Connected</span>';
    return '<span class="am-pill">Available</span>';
  }

  function renderOverview(stats) {
    return '<section class="am-overview">' +
      '<div class="am-stat"><span class="am-stat-n">' + esc(String(stats.connected)) + '</span><span class="am-stat-l">Connected</span></div>' +
      '<div class="am-stat"><span class="am-stat-n">' + esc(String(stats.available)) + '</span><span class="am-stat-l">Available</span></div>' +
      '<div class="am-stat"><span class="am-stat-n">' + esc(stats.lastSyncLabel) + '</span><span class="am-stat-l">Last sync</span></div>' +
      '</section>';
  }

  function renderAppRow(app, st, installed) {
    var soon = !!app.soon;
    var actions = '';
    if (soon) {
      actions = '<button type="button" class="am-btn am-btn-ghost" disabled>Soon</button>';
    } else if (st.connected || installed) {
      actions =
        '<button type="button" class="am-btn am-btn-brand" data-am-act="connect" data-am-id="' + esc(app.id) + '">Manage</button>' +
        '<button type="button" class="am-btn am-btn-ghost" data-am-act="disconnect" data-am-id="' + esc(app.id) + '">Disconnect</button>' +
        '<button type="button" class="am-btn am-btn-ghost" data-am-act="settings" data-am-id="' + esc(app.id) + '">Settings</button>';
    } else {
      actions =
        '<button type="button" class="am-btn am-btn-brand" data-am-act="connect" data-am-id="' + esc(app.id) + '">Connect</button>' +
        '<button type="button" class="am-btn am-btn-ghost" data-am-act="settings" data-am-id="' + esc(app.id) + '">Settings</button>';
    }

    var account = st.accountLabel
      ? '<p class="am-account">' + esc(st.accountLabel) + '</p>'
      : '';
    var sync = '<p class="am-sync">Last sync · ' + esc(formatWhen(st.lastSyncAt)) + '</p>';
    var caps = (app.productCapabilities || []).slice(0, 3);
    var capsHtml = caps.length
      ? '<p class="am-caps-line">' + esc(caps.join(' · ')) + '</p>'
      : '';

    return '<article class="am-row' + (st.connected ? ' is-on' : '') + '">' +
      '<div class="am-row-main">' +
        '<div class="am-row-title">' +
          '<h3>' + esc(app.name) + '</h3>' +
          statusPill(st) +
        '</div>' +
        '<p class="am-role">' + esc(app.role || 'Connected App') + '</p>' +
        account +
        capsHtml +
        sync +
        (st.message && !st.connected ? '<p class="am-muted">' + esc(st.message) + '</p>' : '') +
      '</div>' +
      '<div class="am-row-actions">' + actions + '</div>' +
      '</article>';
  }

  function renderDeveloperTool(bizId) {
    var IE = global.HublyIntentEngine;
    var pipeline = IE && typeof IE.run === 'function'
      ? IE.run('promote_project', { businessId: bizId, emit: false })
      : null;
    var ai = pipeline && pipeline.ai;
    if (!ai && global.HublyActionEngine) {
      var plan = global.HublyActionEngine.plan('promote_project', { businessId: bizId });
      var forAi = global.HublyActionEngine.forAi(plan);
      ai = {
        intent: 'Promote Project',
        capabilities: forAi.need,
        prompt: forAi.prompt,
      };
    }
    if (!ai) return '';
    return '<details class="am-dev">' +
      '<summary>Developer · Intent pipeline</summary>' +
      '<div class="am-dev-body">' +
        '<p class="am-muted">Internal tool — owners use Connected Apps above. AI speaks Intent + Capabilities only.</p>' +
        '<ol class="am-pipeline">' +
          '<li><strong>Intent</strong> ' + esc(ai.intent) + '</li>' +
          '<li><strong>Capabilities</strong> ' + esc((ai.capabilities || []).join(' · ')) + '</li>' +
          '<li><strong>Execution Plan</strong> draft → approve → Event Bus → Providers</li>' +
        '</ol>' +
        (ai.prompt ? '<pre class="am-prompt">' + esc(ai.prompt) + '</pre>' : '') +
      '</div>' +
      '</details>';
  }

  async function render() {
    var root = el('jos-apps-root');
    if (!root) return;
    var CA = Apps();
    var bizId = businessId();
    var catalog = CA ? CA.list() : [];
    var installedIds = CA ? CA.installedApps(bizId).map(function (a) { return a.id; }) : [];

    root.innerHTML =
      '<div class="am-shell">' +
        '<header class="am-hero">' +
          '<p class="am-eyebrow">Connected Apps</p>' +
          '<h1>Your tools, connected</h1>' +
          '<p class="am-lead">Connect the apps you already use. Hubly stays the operating system — status, sync, and settings live here.</p>' +
        '</header>' +
        '<p class="am-muted">Loading connection status…</p>' +
      '</div>';

    var rows = [];
    var connectedCount = 0;
    var latestSync = null;
    for (var i = 0; i < catalog.length; i++) {
      var app = catalog[i];
      var st = await liveStatusFor(app);
      var installed = installedIds.indexOf(app.id) !== -1;
      if (st.connected) connectedCount += 1;
      if (st.lastSyncAt) {
        var t = Date.parse(st.lastSyncAt);
        if (Number.isFinite(t) && (!latestSync || t > latestSync)) latestSync = t;
      }
      rows.push({ app: app, st: st, installed: installed });
    }

    // Connected first, then available, then soon
    rows.sort(function (a, b) {
      var as = a.st.connected ? 0 : (a.app.soon ? 2 : 1);
      var bs = b.st.connected ? 0 : (b.app.soon ? 2 : 1);
      if (as !== bs) return as - bs;
      return String(a.app.name).localeCompare(String(b.app.name));
    });

    var overview = renderOverview({
      connected: connectedCount,
      available: rows.filter(function (r) { return !r.st.connected && !r.app.soon; }).length,
      lastSyncLabel: latestSync ? formatWhen(new Date(latestSync).toISOString()) : 'Never',
    });

    var connectedRows = rows.filter(function (r) { return r.st.connected; });
    var availableRows = rows.filter(function (r) { return !r.st.connected; });

    root.innerHTML =
      '<div class="am-shell">' +
        '<header class="am-hero">' +
          '<p class="am-eyebrow">Connected Apps</p>' +
          '<h1>Your tools, connected</h1>' +
          '<p class="am-lead">Connect the apps you already use. Hubly stays the operating system — status, sync, and settings live here.</p>' +
        '</header>' +
        overview +
        '<section class="am-panel">' +
          '<h2>Connected</h2>' +
          '<div class="am-list">' +
            (connectedRows.length
              ? connectedRows.map(function (r) { return renderAppRow(r.app, r.st, true); }).join('')
              : '<p class="am-muted">Nothing connected yet — pick an app below.</p>') +
          '</div>' +
        '</section>' +
        '<section class="am-panel">' +
          '<h2>Available integrations</h2>' +
          '<div class="am-list">' +
            (availableRows.length
              ? availableRows.map(function (r) { return renderAppRow(r.app, r.st, r.installed); }).join('')
              : '<p class="am-muted">You\u2019re caught up.</p>') +
          '</div>' +
        '</section>' +
        renderDeveloperTool(bizId) +
      '</div>';
  }

  async function connectApp(id) {
    var CA = Apps();
    if (!CA) return;
    var app = CA.get(id);
    var facade = CA.getFacade(id);
    var bizId = businessId();
    CA.install(bizId, id);

    if (facade && typeof facade.connectAndRedirect === 'function') {
      await facade.connectAndRedirect({ businessId: bizId });
      return;
    }
    if (facade && typeof facade.connect === 'function') {
      var res = await facade.connect({ businessId: bizId });
      if (res && res.ok && res.data && res.data.authorizeUrl) {
        try { global.location.href = res.data.authorizeUrl; } catch (_) {}
        return;
      }
      toast((res && res.message) || ((app && app.name) + ' connect started'));
      await render();
      return;
    }
    toast('Connected ' + ((app && app.name) || id));
    await render();
  }

  async function disconnectApp(id) {
    var CA = Apps();
    if (!CA) return;
    var app = CA.get(id);
    var facade = CA.getFacade(id);
    var bizId = businessId();
    if (facade && typeof facade.disconnect === 'function') {
      await facade.disconnect({ businessId: bizId });
    }
    CA.uninstall(bizId, id);
    writeConnectionMeta(id, { lastSyncAt: null });
    toast('Disconnected ' + ((app && app.name) || id));
    await render();
  }

  function openSettings(id) {
    var CA = Apps();
    var app = CA && CA.get(id);
    var name = (app && app.name) || id;
    if (id === 'adobe_lightroom') {
      toast(name + ' settings — use Photography → Connected Apps for album sync, or reconnect from here.');
      return;
    }
    toast(name + ' settings — manage connection from this page. Deeper settings open inside each workflow.');
  }

  async function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('[data-am-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-am-act');
    var id = btn.getAttribute('data-am-id');
    if (!id) return;
    btn.disabled = true;
    try {
      if (act === 'connect' || act === 'install' || act === 'manage') await connectApp(id);
      else if (act === 'disconnect' || act === 'uninstall') await disconnectApp(id);
      else if (act === 'settings') openSettings(id);
    } finally {
      try { btn.disabled = false; } catch (_) {}
    }
  }

  function wire() {
    var root = el('jos-apps-root');
    if (!root || root._amWired) return;
    root._amWired = true;
    root.addEventListener('click', onClick);
  }

  function mount() {
    wire();
    render();
  }

  function wireEventBus() {
    var HE = global.HublyEvents;
    if (!HE || typeof HE.on !== 'function' || HE._hublyAppsWired) return;
    HE._hublyAppsWired = true;

    function onCapabilityEvent(payload, meta) {
      try {
        var type = meta && meta.type;
        if (type === 'project.delivered' || type === 'gallery.delivered') {
          var IE = global.HublyIntentEngine;
          var AE = global.HublyActionEngine;
          if (IE && typeof IE.run === 'function') {
            IE.run('promote_project', {
              businessId: (payload && payload.businessId) || businessId(),
              projectId: payload && (payload.projectId || payload.id),
              emit: true,
            });
          } else if (AE && typeof AE.plan === 'function') {
            var plan = AE.plan('promote_project', {
              businessId: (payload && payload.businessId) || businessId(),
            });
            AE.publishProposed(plan, {
              sourceEvent: type,
              projectId: payload && (payload.projectId || payload.id),
            });
          }
        }
      } catch (err) {
        console.warn('Apps event subscriber', err);
      }
    }

    HE.on('project.delivered', onCapabilityEvent);
    HE.on('gallery.delivered', onCapabilityEvent);
    HE.on('project.editing_complete', onCapabilityEvent);
    HE.on('job.completed', onCapabilityEvent);
    HE.on('app.connected', function () { try { render(); } catch (_) {} });
    HE.on('app.disconnected', function () { try { render(); } catch (_) {} });
  }

  global.HublyAppMarketplace = {
    render: mount,
    remount: mount,
    wireEventBus: wireEventBus,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireEventBus);
  } else {
    wireEventBus();
  }
})(typeof window !== 'undefined' ? window : globalThis);
