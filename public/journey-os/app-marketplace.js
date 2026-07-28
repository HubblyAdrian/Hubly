/**
 * Hubly Apps Marketplace — Connected Apps install surface.
 * Not Settings. Not photography-only. Like Slack / Shopify / Notion apps.
 *
 * Installed / Available · each app shows product Capabilities
 * so AI knows what providers can do without hardcoding vendors.
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
      if (global.HublyJourney && typeof global.HublyJourney.getActiveBusinessId === 'function') {
        return global.HublyJourney.getActiveBusinessId() || '';
      }
      var S = global.S || {};
      return S.businessId || S.bizId || (S.business && S.business.id) || '';
    } catch (_) {
      return '';
    }
  }

  function Apps() {
    return global.HublyConnectedApps || null;
  }

  function renderAppCard(app, installed) {
    var caps = app.productCapabilities || [];
    var soon = !!app.soon;
    var canInstall = app.installable !== false && !soon;
    var btn;
    if (installed) {
      btn = '<button type="button" class="am-btn am-btn-ghost" data-am-act="manage" data-am-id="' + esc(app.id) + '">Manage</button>' +
        '<button type="button" class="am-btn am-btn-ghost" data-am-act="uninstall" data-am-id="' + esc(app.id) + '">Remove</button>';
    } else if (canInstall) {
      btn = '<button type="button" class="am-btn am-btn-brand" data-am-act="install" data-am-id="' + esc(app.id) + '">Connect</button>';
    } else {
      btn = '<button type="button" class="am-btn am-btn-ghost" disabled>Soon</button>';
    }
    return '<article class="am-card' + (installed ? ' is-on' : '') + '">' +
      '<div class="am-card-top">' +
        '<div><h3>' + esc(app.name) + '</h3><p class="am-role">' + esc(app.role || '') + '</p></div>' +
        '<span class="am-mark">' + (installed ? '\u2713 Installed' : (soon ? 'Soon' : 'Available')) + '</span>' +
      '</div>' +
      '<p class="am-cap-label">Capabilities</p>' +
      '<ul class="am-caps">' +
        (caps.length
          ? caps.map(function (c) { return '<li>\u2713 ' + esc(c) + '</li>'; }).join('')
          : '<li class="am-muted">—</li>') +
      '</ul>' +
      '<div class="am-card-actions">' + btn + '</div>' +
      '</article>';
  }

  function renderPromoteDemo(bizId) {
    var IE = global.HublyIntentEngine;
    var pipeline = IE && typeof IE.run === 'function'
      ? IE.run('promote_project', { businessId: bizId, emit: false })
      : null;
    if (!pipeline || !pipeline.ai) {
      var AE = global.HublyActionEngine;
      if (!AE) return '';
      var plan = AE.plan('promote_project', { businessId: bizId });
      var ai = AE.forAi(plan);
      pipeline = {
        ai: {
          intent: 'Promote Project',
          capabilities: ai.need,
          required: ai.need,
          optional: [],
          prompt: ai.prompt
        }
      };
    }
    var ai = pipeline.ai;
    return '<section class="am-panel am-ai">' +
      '<p class="am-eyebrow">Intent Engine</p>' +
      '<h2>Ask Hubly → Intent → Capabilities → Execute</h2>' +
      '<p class="am-lead">AI never names apps. It only declares intent and needed capabilities — Connected Apps resolve the rest.</p>' +
      '<ol class="am-pipeline">' +
        '<li><strong>Intent</strong> ' + esc(ai.intent) + '</li>' +
        '<li><strong>Capabilities</strong> ' + esc((ai.capabilities || []).join(' · ')) + '</li>' +
        '<li><strong>Execute</strong> Event Bus → Connected Apps</li>' +
      '</ol>' +
      '<div class="am-need-box">' +
        '<p class="am-need-k">Intent</p>' +
        '<p class="am-intent-name">' + esc(ai.intent) + '</p>' +
        '<p class="am-need-k am-mt">Capabilities needed</p>' +
        '<ul class="am-need-list">' +
          (ai.capabilities || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') +
        '</ul>' +
        ((ai.optional && ai.optional.length)
          ? '<p class="am-muted am-mt">Optional: ' + esc(ai.optional.join(', ')) + '</p>'
          : '') +
        ((pipeline.execution && !pipeline.execution.ready) || (ai.prompt && /Missing:/.test(ai.prompt))
          ? '<p class="am-missing">Connect apps that provide missing capabilities, then Execute.</p>'
          : '<p class="am-ok">Ready to Execute via Connected Apps.</p>') +
      '</div>' +
      '<pre class="am-prompt">' + esc(ai.prompt) + '</pre>' +
      '</section>';
  }

  function render() {
    var root = el('jos-apps-root');
    if (!root) return;
    var CA = Apps();
    var bizId = businessId();
    var installed = CA ? CA.installedApps(bizId) : [];
    var available = CA ? CA.availableApps(bizId) : [];

    root.innerHTML =
      '<div class="am-shell">' +
        '<header class="am-hero">' +
          '<p class="am-eyebrow">Hubly Marketplace</p>' +
          '<h1>Apps</h1>' +
          '<p class="am-lead">Connect the tools you already use. Hubly stays the operating system — apps plug in through capabilities.</p>' +
        '</header>' +
        renderPromoteDemo(bizId) +
        '<section class="am-panel">' +
          '<h2>Installed</h2>' +
          '<div class="am-grid">' +
            (installed.length
              ? installed.map(function (a) { return renderAppCard(a, true); }).join('')
              : '<p class="am-muted">No apps installed yet. Open Available below and connect the tools you already use.</p>') +
          '</div>' +
        '</section>' +
        '<section class="am-panel">' +
          '<h2>Available</h2>' +
          '<div class="am-grid">' +
            (available.length
              ? available.map(function (a) { return renderAppCard(a, false); }).join('')
              : '<p class="am-muted">You\u2019re caught up — every listed app is installed.</p>') +
          '</div>' +
        '</section>' +
        '<p class="am-footnote">Event Bus fans out project / gallery / payment events to apps by capability. Providers never call each other directly.</p>' +
      '</div>';
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('[data-am-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-am-act');
    var id = btn.getAttribute('data-am-id');
    var CA = Apps();
    if (!CA || !id) return;
    var bizId = businessId();
    if (act === 'install') {
      CA.install(bizId, id);
      toast('Connected ' + ((CA.get(id) && CA.get(id).name) || id));
      render();
      return;
    }
    if (act === 'uninstall') {
      CA.uninstall(bizId, id);
      toast('Removed ' + ((CA.get(id) && CA.get(id).name) || id));
      render();
      return;
    }
    if (act === 'manage') {
      var app = CA.get(id);
      toast((app && app.name ? app.name : id) + ' — open a project to use Connected Apps.');
      return;
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

  /** Capability subscribers — react to HublyEvents without knowing vendors. */
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
              emit: true
            });
          } else if (AE && typeof AE.plan === 'function') {
            var plan = AE.plan('promote_project', {
              businessId: (payload && payload.businessId) || businessId()
            });
            AE.publishProposed(plan, {
              sourceEvent: type,
              projectId: payload && (payload.projectId || payload.id)
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
    wireEventBus: wireEventBus
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireEventBus);
  } else {
    wireEventBus();
  }
})(typeof window !== 'undefined' ? window : globalThis);
